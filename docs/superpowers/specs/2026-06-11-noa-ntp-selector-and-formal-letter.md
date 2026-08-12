# NOA/NTP Selector and Formal Letter Format

**Date:** 2026-06-11
**Status:** Approved

## Problem

Page 2 of the generated document (the NOA/NTP letter) has two issues:

1. **Always issues NOA + NTP combined.** In practice, the award and the notice to proceed are sometimes issued separately — NOA first, NTP later once pre-commencement requirements are fulfilled.

2. **Missing formal letter elements.** The current letter is missing a subject/reference line, a document title heading, the contract amount in the opening paragraph, and a closing salutation — all standard in Philippine construction procurement correspondence.

## Design

### A. Document type selector in the generate form

Add a `docType` field to `genForm` with three options:

| Value | Label |
|---|---|
| `"NOA+NTP"` | NOA + NTP (combined) — default |
| `"NOA"` | Notice of Award only |
| `"NTP"` | Notice to Proceed only |

The selector renders as a segmented control (3 inline buttons that toggle active state) at the top of the "Client & Project" section in the generate modal, spanning the full width. Active button uses `background: C.coral; color: #fff`. Inactive uses `background: C.offWhite; color: C.textSec`.

`genForm` default state (line ~6257) gains `docType: "NOA+NTP"`.

### B. Page 2 formal letter changes

The `page2` template is restructured. Derive these variables at the top of the `page2` template string:

```js
const docType   = gf.docType || "NOA+NTP";
const isNOA     = docType !== "NTP";    // shows award language
const isNTP     = docType !== "NOA";    // shows proceed language
const docTitle  = docType === "NTP"
  ? "NOTICE TO PROCEED"
  : docType === "NOA"
  ? "NOTICE OF AWARD"
  : "NOTICE OF AWARD AND NOTICE TO PROCEED";
const docRef    = docType === "NTP"
  ? "Notice to Proceed"
  : docType === "NOA"
  ? "Notice of Award"
  : "Notice of Award and Notice to Proceed";
```

**Additions to the letter (in order):**

1. **Document title heading** — after the recipient address block, before the salutation:
   ```html
   <div style="font-weight:700;font-size:11px;text-transform:uppercase;text-align:center;
     letter-spacing:0.05em;margin:18px 0 14px;padding-bottom:6px;
     border-bottom:1.5px solid ${C.coral}">
     ${docTitle}
   </div>
   ```

2. **Subject / Re: line** — between the title and the salutation:
   ```html
   <div style="margin-bottom:12px;line-height:1.7">
     <strong>Re:</strong>&nbsp;&nbsp;${pr?.projects?.name||"[Project]"} — ${docRef}
   </div>
   ```

3. **Opening paragraph** — the existing paragraph gets the contract amount added:
   - For NOA or NOA+NTP: `"...amounting to Php ${fmtN(awarVc?.tot||0)} (VAT Inclusive), as detailed in the table below."`
   - For NTP only: `"We are pleased to inform you that [company] hereby issues this Notice to Proceed to [vendor] for the contract covering [project] amounting to Php [amount] (VAT Inclusive), as detailed below."`

4. **NTP body paragraph** — conditional on docType:
   - `NOA+NTP`: current text "This also serves as Notice to Proceed for Contractor to commence the work in accordance to the agreed terms, reference plans, specs and other issued documents."
   - `NOA only`: "A separate Notice to Proceed will be issued upon fulfillment of pre-commencement requirements."
   - `NTP only`: "You are hereby directed to commence the work in accordance with the agreed terms, reference plans, specifications, and other issued documents."

5. **Closing salutation** — after the last body paragraph, before the signature table:
   ```html
   <div style="margin-bottom:36px;line-height:1.7">Very truly yours,</div>
   ```

### Letter structure (after changes)

```
[letterhead]

[recipient address block]

[DOCUMENT TITLE — bold centered with coral underline]

Re:  [Project Name] — [Document Type]

Dear [name],

[opening paragraph with amount]

[scope table]

[NTP paragraph — conditional on docType]
[works conformance paragraph]
[term sheet reference paragraph]

Very truly yours,

[signature blocks]
[page number]
```

## Scope

All changes in `src/App.jsx`:
- `genForm` default state (~line 6257): add `docType: "NOA+NTP"`
- Generate modal form (~lines 7153–7168): add `docType` segmented control
- `page2` template (~lines 6787–6828): add title, Re: line, amount in opening, conditional NTP paragraph, closing

No new state variables, no DB changes, no new helpers.

## What Stays the Same

- Page 1, 3, 4 — unchanged
- Signature block structure — unchanged
- Scope table — unchanged
- `letterhead()` — unchanged
- All other `genForm` fields — unchanged
