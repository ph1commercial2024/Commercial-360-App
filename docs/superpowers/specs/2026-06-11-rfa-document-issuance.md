# RFA Document Issuance

**Date:** 2026-06-11
**Status:** Approved

## Problem

The current document generation flow has no editing step and no persistence: clicking "Generate & Print" immediately opens a print window with auto-generated content that cannot be modified. There is no record of what was issued, no way to reprint, and no revision history.

## Solution

A **Preview & Edit modal** intercepts the generate flow so users can review and edit the three issued documents (NOA/NTP letter, Contract Agreement, Term Sheet) before issuing. Each issuance creates a versioned record in a new `rfa_documents` Supabase table. Issued documents can be reprinted at any time from the RFA page. Revisions require a comment and create a new version — old versions are preserved.

---

## User Flow

1. On the RFA page, click **"📄 Generate / Revise"** (renamed from "📄 Generate Package") → generate form modal opens (unchanged).
2. Fill in the form → click **"Preview & Edit"** (renamed from "Generate & Print").
3. Preview & Edit modal opens:
   - If a previous issuance exists for this PR: load `page2_html`, `page3_html`, `page4_html` from the latest `rfa_documents` record.
   - If no previous issuance: auto-generate body content from current `gf` + `pr` data (same logic as current `generateRFADocument`).
4. User edits content across the three tabs using the formatting toolbar.
5. Click **"Issue Document (v1)"** (first time) or enter a revision comment and click **"Issue Revision (vN)"** (subsequent times).
6. Record saved to `rfa_documents`. Print window opens automatically.
7. Modal closes. The "Issued Documents" section on the RFA page updates to show the new record.

**Reprint from Issued Documents section:** Click **"🖨 Print"** on any record → print window opens with that record's stored content.

---

## Database

### New table: `rfa_documents`

```sql
create table rfa_documents (
  id            uuid primary key default gen_random_uuid(),
  pr_id         integer not null references purchase_requests(id) on delete cascade,
  doc_type      text not null,        -- 'NOA+NTP' | 'NOA' | 'NTP'
  revision_no   integer not null,     -- 1, 2, 3 … auto-incremented per pr_id
  revision_comment text,              -- null for v1; required for v2+
  page2_html    text,                 -- editable body of NOA/NTP letter (no letterhead wrapper)
  page3_html    text,                 -- editable body of Contract Agreement
  page4_html    text,                 -- editable body of Term Sheet
  gen_form_snapshot jsonb not null,   -- full genForm state at issuance (for letterhead reconstruction)
  issued_at     timestamptz not null default now(),
  issued_by     text                  -- nullable; user email from Supabase auth session if available
);
```

Enable RLS with the same policy as other tables in the project (anon key read/write).

`revision_no` is computed at insert time as:
```sql
select coalesce(max(revision_no), 0) + 1 from rfa_documents where pr_id = $1
```

---

## Components

### A. "Issued Documents" section on the RFA page

Location: below the top-bar action buttons area (`~line 7140` in App.jsx), rendered as a collapsible card or inline section within the RFA page body.

**Structure:**
```
┌─ Issued Documents ─────────────────────── [📄 Generate / Revise] ─┐
│ v2 · Current   NOA + NTP · Contract · Term Sheet                   │
│ Jun 11, 2025 · Revised contract amount per agreed deduction  [Print]│
│─────────────────────────────────────────────────────────────────────│
│ v1 · Superseded  NOA + NTP · Contract · Term Sheet                 │
│ Jun 10, 2025 · Initial issuance                             [Print] │
└─────────────────────────────────────────────────────────────────────┘
```

State needed:
- `issuedDocs` — array of `rfa_documents` rows for current PR, ordered by `revision_no DESC`
- Fetched when PR loads (add to existing PR data fetch) using:
  ```js
  supabase.from("rfa_documents").select("*").eq("pr_id", pr.id).order("revision_no", { ascending: false })
  ```

Each row shows:
- Revision badge: coral "v2 · Current" for latest; grey "v1 · Superseded" for older
- `doc_type` + "Contract Agreement · Term Sheet" (pages 3 and 4 always present)
- `issued_at` formatted as date
- `revision_comment` (or "Initial issuance" if null)
- **"🖨 Print"** button → calls `printIssuedDoc(record)`

Empty state: "No documents issued yet — click Generate / Revise to create the first issuance."

### B. Preview & Edit Modal

New state variables (add near `showGenModal` ~line 6253):
```js
const [showPreviewModal, setShowPreviewModal] = useState(false);
const [revisionComment, setRevisionComment]   = useState("");
```

Three refs for the contenteditable divs:
```js
const page2EditRef = useRef(null);
const page3EditRef = useRef(null);
const page4EditRef = useRef(null);
```

One additional state to track which tab is active:
```js
const [previewTab, setPreviewTab] = useState("page2");  // "page2" | "page3" | "page4"
```

**Modal dimensions:** `position: fixed; inset: 0; zIndex: 1000` overlay with a centered container `width: 90vw; max-width: 1100px; height: 90vh`.

**Structure (top to bottom):**

1. **Header bar**: "Preview & Edit — RFA No. [rfaNumber]" + ✕ close button
2. **Tab bar**: three tabs — "NOA/NTP Letter" | "Contract Agreement" | "Term Sheet"
   - Active tab: `background: #fff; border-bottom: 2px solid C.coral; color: C.coral`
   - Inactive: `background: C.offWhite; color: C.textSec`
3. **Formatting toolbar** (always visible, applies to whichever tab is active):
   - [**B**] [*I*] [U] — calls `document.execCommand("bold"|"italic"|"underline")`
   - Divider
   - [↩ Undo] [↪ Redo] — calls `document.execCommand("undo"|"redo")`
4. **Content area** (scrollable, `background: #f5f5f5; padding: 20px`):
   - White page card (max-width 680px, centered, box-shadow)
   - **Locked letterhead** (top of card): grey background, "🔒 locked" badge, `contenteditable="false"`. Rendered from current `genForm` (logo + company + date + RFA#). Not stored — regenerated at print time.
   - **Editable body** (`contenteditable="true"`, `outline: 2px dashed ${C.coralLight}`): initialized via `useEffect` when the modal opens.
   - Only the active tab's page is visible; the other two are rendered but `display: none` (keeps their refs intact).
5. **Footer**:
   - Left: "Last issued: [date]" or "No previous issuance for this RFA"
   - Right (first issuance): `[Cancel]` `[Issue Document (v1)]`
   - Right (revision — when `issuedDocs.length > 0`): revision comment `<input placeholder="Reason for revision (required)">` + `[Cancel]` + `[Issue Revision (v2)]` (disabled until comment is non-empty)

**Initialization logic** (in `useEffect` when `showPreviewModal` becomes true):

```js
useEffect(() => {
  if (!showPreviewModal) return;
  const latest = issuedDocs[0]; // latest record, or undefined
  if (latest) {
    page2EditRef.current.innerHTML = latest.page2_html || "";
    page3EditRef.current.innerHTML = latest.page3_html || "";
    page4EditRef.current.innerHTML = latest.page4_html || "";
  } else {
    const bodies = buildPageBodies(genForm);
    page2EditRef.current.innerHTML = bodies.page2;
    page3EditRef.current.innerHTML = bodies.page3;
    page4EditRef.current.innerHTML = bodies.page4;
  }
  setRevisionComment("");
  setPreviewTab("page2");
}, [showPreviewModal]);
```

### C. `buildPageBodies(gf)` — new helper

Extract the body-only HTML (no letterhead, no page wrapper) from the current `generateRFADocument` logic for pages 2, 3, and 4. Returns `{ page2: string, page3: string, page4: string }`.

This replaces the inline template literal logic currently inside `generateRFADocument`. The page bodies are the same content currently generated — just extracted so they can be (a) put into the preview modal's contenteditable divs, and (b) stored in `rfa_documents`.

All data dependencies (`awarVInfo`, `awarVc`, `scopeItems`, `pr`, `fmtN`, `C`, etc.) are already in scope as closures — the helper function is defined inside the same component.

### D. `generateRFADocument(gf)` — refactored

The existing function is kept but simplified: it now only handles page 1 generation + the print window assembly. On first load (before any issuance), the "Generate & Print" button no longer exists in the generate form — it's replaced by "Preview & Edit" which opens the preview modal instead.

`generateRFADocument` is repurposed as `printDocument(gf, bodies)`:
```
printDocument(gf, { page2, page3, page4 })
```
where `bodies` contains the HTML to use for pages 2-4. It:
1. Builds page 1 fresh from current PR data (unchanged)
2. Wraps each body in `letterhead(gf) + body + page-num div` inside `.pg.pb`
3. Assembles and opens the print window

### E. `printIssuedDoc(record)` — reprint function

Called from the "🖨 Print" button on each issued document row:

```js
const printIssuedDoc = (record) => {
  const snapshot = record.gen_form_snapshot;
  printDocument(snapshot, {
    page2: record.page2_html,
    page3: record.page3_html,
    page4: record.page4_html,
  });
};
```

**Logo pre-warming:** `fetchBuLogo` sets React state asynchronously — calling it inside `printIssuedDoc` and then immediately calling `printDocument` would race. Instead, call `fetchBuLogo` fire-and-forget when the Issued Documents section first renders (i.e., when `issuedDocs.length > 0` after fetch). Add this alongside the existing `fetchBuLogo(genForm.clientCompany)` call in the PR load effect:

```js
// When issuedDocs loads and has records, pre-warm logo using latest snapshot
if (docs.length > 0) fetchBuLogo(docs[0].gen_form_snapshot?.clientCompany);
```

By the time the user clicks "🖨 Print", `buLogoUrl` will already be populated.

### F. Issue action

When user clicks "Issue Document" or "Issue Revision":

```js
const issueDocument = async () => {
  const nextRevNo = (issuedDocs[0]?.revision_no || 0) + 1;
  const bodies = {
    page2: page2EditRef.current.innerHTML,
    page3: page3EditRef.current.innerHTML,
    page4: page4EditRef.current.innerHTML,
  };
  await supabase.from("rfa_documents").insert({
    pr_id: pr.id,
    doc_type: genForm.docType || "NOA+NTP",
    revision_no: nextRevNo,
    revision_comment: nextRevNo === 1 ? null : revisionComment,
    page2_html: bodies.page2,
    page3_html: bodies.page3,
    page4_html: bodies.page4,
    gen_form_snapshot: genForm,
    issued_at: new Date().toISOString(),
  });
  // Refresh issued docs list
  const { data } = await supabase.from("rfa_documents").select("*").eq("pr_id", pr.id).order("revision_no", { ascending: false });
  setIssuedDocs(data || []);
  setShowPreviewModal(false);
  setShowGenModal(false);
  // Open print window
  printDocument(genForm, bodies);
};
```

---

## Generate Form Modal: One Change

The "Generate & Print" button (`~line 7233`) becomes **"Preview & Edit"** and calls:
```js
setShowGenModal(false); // close gen form
setShowPreviewModal(true); // open preview modal
```

Everything else in the generate form modal is unchanged.

---

## What Stays the Same

- Page 1 (RFA recommendation): always auto-generated fresh, never stored
- `fetchBuLogo` — unchanged
- Generate form modal structure and fields — unchanged
- The `letterhead()` function — unchanged
- `genForm` state and localStorage persistence — unchanged
- The `C` design tokens, `styles` object — unchanged

---

## Scope

All changes in `src/App.jsx` plus one Supabase migration.

| Area | Change |
|---|---|
| Supabase | New `rfa_documents` table (migration) |
| `src/App.jsx` | New state: `issuedDocs`, `showPreviewModal`, `revisionComment`, `previewTab` |
| `src/App.jsx` | New refs: `page2EditRef`, `page3EditRef`, `page4EditRef` |
| `src/App.jsx` | New helper: `buildPageBodies(gf)` |
| `src/App.jsx` | Refactor: `generateRFADocument` → `printDocument(gf, bodies)` |
| `src/App.jsx` | New function: `printIssuedDoc(record)` |
| `src/App.jsx` | New function: `issueDocument()` |
| `src/App.jsx` | New JSX: Preview & Edit modal |
| `src/App.jsx` | New JSX: Issued Documents section on RFA page |
| `src/App.jsx` | Modified: "Generate & Print" button → "Preview & Edit" in gen form modal |
| `src/App.jsx` | Modified: "Generate Package" button → "Generate / Revise" in top bar |
| `src/App.jsx` | Modified: PR data fetch includes `rfa_documents` load |
