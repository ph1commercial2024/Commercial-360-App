# RFA Document Logo and Branding Colors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the BU logo not showing in generated documents (name matching bug), add logo to page 1 header, and apply brand colors throughout the document CSS.

**Architecture:** All changes are in `src/App.jsx`. Three locations: `fetchBuLogo` (component level), and inside `generateRFADocument` (CSS block, `letterhead()`, `page1`, `page2`, `page3` templates).

**Tech Stack:** React 19, Vite 8. `generateRFADocument` builds raw HTML strings with template literals. The `C` design token object is a component-level `const` and is in scope inside `generateRFADocument`.

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` | 3 targeted areas: `fetchBuLogo`, CSS block, page templates |

---

### Task 1: Apply all 3 improvements

All edits are in `src/App.jsx`. Apply in order:

---

- [ ] **Step 1: Fix normalized name matching in `fetchBuLogo`**

Find the `fetchBuLogo` function (~line 6298):

```js
  const fetchBuLogo = async (buName) => {
    if (!buName) return;
    const { data: allBUs } = await supabase.from("business_units").select("name, logo_url");
    if (!allBUs) return;
    const bu = allBUs.find(b =>
      b.name === buName ||
      b.name?.toLowerCase() === buName?.toLowerCase() ||
      b.name?.toLowerCase().includes(buName?.toLowerCase()) ||
      buName?.toLowerCase().includes(b.name?.toLowerCase())
    );
```

Replace the `allBUs.find(...)` block with:

```js
  const fetchBuLogo = async (buName) => {
    if (!buName) return;
    const { data: allBUs } = await supabase.from("business_units").select("name, logo_url");
    if (!allBUs) return;
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bu = allBUs.find(b =>
      b.name === buName ||
      b.name?.toLowerCase() === buName?.toLowerCase() ||
      b.name?.toLowerCase().includes(buName?.toLowerCase()) ||
      buName?.toLowerCase().includes(b.name?.toLowerCase()) ||
      norm(b.name) === norm(buName)
    );
```

Everything after `const bu = ...` stays exactly the same.

---

- [ ] **Step 2: Apply branding colors to CSS block**

In the CSS block (~lines 6635–6671), make these targeted replacements. Read the file first to confirm exact strings, then apply each Edit individually.

**Change 1** — `.vt thead th` background:
```
.vt thead th{background:#f0f0f0;font-weight:700;text-align:center;font-size:9.5px}
```
→
```
.vt thead th{background:${C.coralLight};font-weight:700;text-align:center;font-size:9.5px}
```

**Change 2** — `.sh td` background + add color:
```
.sh td{background:#e0e0e0;font-weight:700;text-align:center;font-size:8px;text-transform:uppercase;letter-spacing:.04em}
```
→
```
.sh td{background:${C.coralLight};color:${C.coral};font-weight:700;text-align:center;font-size:8px;text-transform:uppercase;letter-spacing:.04em}
```

**Change 3** — `.sec-hdr` border:
```
.sec-hdr{font-weight:700;font-size:9.5px;text-transform:uppercase;border-bottom:1.5px solid #333;padding-bottom:3px;margin:11px 0 7px}
```
→
```
.sec-hdr{font-weight:700;font-size:9.5px;text-transform:uppercase;border-bottom:1.5px solid ${C.coral};padding-bottom:3px;margin:11px 0 7px}
```

**Change 4** — `.ptbl th` background:
```
.ptbl th{background:#f0f0f0;font-weight:700}
```
→
```
.ptbl th{background:${C.coralLight};font-weight:700}
```

---

- [ ] **Step 3: Apply branding color to `letterhead()` divider**

Find the `letterhead()` function (~line 6675):
```js
      `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #111">
```
Replace:
```js
      `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid ${C.coral}">
```

---

- [ ] **Step 4: Restructure page 1 header — add logo row**

Find the current page 1 header block (after the DRAFT warning div, around line 6691):
```js
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-size:7.5px;letter-spacing:.12em;text-transform:uppercase;color:#888;margin-bottom:2px">${gf.clientCompany}</div>
        <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:2.5px solid #111;padding-bottom:5px;display:inline-block">RECOMMENDATION FOR AWARD</div>
      </div>
```

Replace with:
```js
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid ${C.coral}">
        ${buLogoUrl
          ? `<img src="${buLogoUrl}" style="height:42px;width:auto;object-fit:contain;max-width:120px" />`
          : `<div style="width:88px;height:38px;border:1.5px dashed #bbb;display:flex;align-items:center;justify-content:center;font-size:7px;color:#bbb;letter-spacing:.07em;text-transform:uppercase">Logo</div>`
        }
        <div style="text-align:right;font-size:8.5px;color:#555;line-height:1.6">
          <div style="font-weight:700;color:#111;font-size:9px">${gf.clientCompany}</div>
          <div>${today}</div>
          <div>RFA No. ${rfaNumber||"—"}</div>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:2.5px solid ${C.coral};padding-bottom:5px;display:inline-block">RECOMMENDATION FOR AWARD</div>
      </div>
```

Note: the small-caps company name line (`font-size:7.5px`) is removed — company info now lives in the letterhead row on the right side.

---

- [ ] **Step 5: Apply branding color to page 2 and page 3 table header rows**

**Page 2 scope table** (line ~6789):
```js
<thead><tr style="background:#f0f0f0"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
```
→
```js
<thead><tr style="background:${C.coralLight}"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
```

Also the multi-item variant (just above it at line ~6789):
```js
<thead><tr style="background:#f0f0f0"><th>#</th><th>Description</th></tr></thead>
```
→
```js
<thead><tr style="background:${C.coralLight}"><th>#</th><th>Description</th></tr></thead>
```

**Page 3 contract table** (line ~6828):
```js
<thead><tr style="background:#f0f0f0"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
```
→
```js
<thead><tr style="background:${C.coralLight}"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
```

---

- [ ] **Step 6: Build and verify**

Run:
```bash
npm run build
```

Expected: `✓ built in X.XXs` with no errors.

Then open `http://localhost:5173`, navigate to an RFA with a business unit that has a logo uploaded, click **📄 Generate Package** and verify:

1. Page 1 shows a letterhead row at the top (logo left + company/date/RFA# right), followed by the centered "RECOMMENDATION FOR AWARD" title — both with coral underlines
2. Pages 2–4 letterhead divider is coral (not black)
3. Vendor comparison table column headers have `C.coralLight` background
4. BONDS / PROPOSAL / TIMELINE sub-section rows have coral tint + coral text
5. Section headers (RECOMMENDATION, APPROVALS) have coral underline
6. Term sheet table headers (`ptbl th`) have coral tint
7. Logo shows as the actual business unit logo (not the dashed placeholder)

If logo still shows as placeholder, it means the BU has no logo uploaded or the name match still fails — check `buName` value in console or Supabase.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: rfa document - fix bu logo name matching, add logo to page 1, apply brand colors"
```

---

## Verification Checklist

- [ ] `fetchBuLogo` has the `norm()` normalized comparison as the 5th condition
- [ ] `letterhead()` divider is `border-bottom:2px solid ${C.coral}`
- [ ] Page 1 has a letterhead row (logo + company/date/RFA#) above the title
- [ ] Page 1 title underline is `${C.coral}`
- [ ] `.vt thead th` background is `${C.coralLight}` (vendor table column headers)
- [ ] `.sh td` has `${C.coralLight}` background and `${C.coral}` text (BONDS / PROPOSAL sub-headers)
- [ ] `.sec-hdr` border is `${C.coral}`
- [ ] `.ptbl th` background is `${C.coralLight}`
- [ ] Page 2 scope table `<tr>` header background is `${C.coralLight}`
- [ ] Page 3 contract table `<tr>` header background is `${C.coralLight}`
- [ ] Build passes with no errors
