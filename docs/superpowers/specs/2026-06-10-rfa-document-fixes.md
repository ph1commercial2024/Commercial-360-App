# RFA Generated Document Fixes

**Date:** 2026-06-10
**Status:** Approved

## Problem

The `generateRFADocument` function (lines 6552–6965 of `src/App.jsx`) produces a 4-page printable procurement package. Six issues were identified:

1. **Duplicate sentence** — Page 1 hardcodes "1 To award to [vendor]…" then renders `reasonHtml`, which also starts with "1. To award to [vendor]…". The sentence appears twice.
2. **Font size too small** — Vendor comparison table (`.vt`) and attachments table (`.attbl`) use `font-size: 8.5px`, which is too small for print.
3. **No page numbers** — None of the 4 pages display a page number.
4. **Pages 2–4 missing RFA number** — The `letterhead()` function shows company name and date but not the RFA number.
5. **Scope table amounts show `—`** — When there are multiple scope items on Page 2, each item row shows `—` for Amount (individual pricing doesn't exist). The table looks broken.
6. **Awarded vendor highlight too subtle** — `.awd` uses `background: #FFF7ED` (very light amber). Hard to distinguish in print.

## Fixes

### Fix 1: Duplicate sentence (Bug)

Remove the hardcoded block at lines 6744–6748 from the page1 template. Render `reasonHtml` directly.

**Before** (lines 6742–6750):
```js
<div class="rec">
  <div class="sec-hdr">RECOMMENDATION</div>
  ${awarVInfo&&awarVc?`
  <div style="margin-bottom:6px"><strong>1</strong>&nbsp; To award to <strong>${awarVInfo.full_name}</strong> amounting to
    <strong>Php ${fmtN(awarVc.tot)}</strong> VAT Inclusive.
    This recommendation was also due to the following:</div>
  ${reasonHtml}`
  :`<div style="color:#999;font-style:italic">No vendor recommended yet.</div>`}
</div>
```

**After:**
```js
<div class="rec">
  <div class="sec-hdr">RECOMMENDATION</div>
  ${awarVInfo&&awarVc?reasonHtml:`<div style="color:#999;font-style:italic">No vendor recommended yet.</div>`}
</div>
```

`reasonHtml` (lines 6614–6622) already formats `1. [mainSentence]` followed by lettered sub-items (with the "This recommendation was also due to the following:" subheading) when `awardReason` has content, or just the numbered sentence when it doesn't. No behavior loss.

### Fix 2: Font sizes

Change in the CSS block (lines 6635–6669):

| Selector | Old | New |
|---|---|---|
| `.vt` | `font-size:8.5px` | `font-size:9.5px` |
| `.vt thead th` | `font-size:8.5px` | `font-size:9.5px` |
| `.attbl` | `font-size:8.5px` | `font-size:9.5px` |
| `.htbl` | `font-size:9px` | `font-size:9.5px` |

### Fix 3: Page numbers

Add `.pg-num` to the CSS block:
```css
.pg-num{position:absolute;bottom:12px;right:14px;font-size:8px;color:#888}
```

`.pg` already has `position:relative` so absolute positioning works. Add page number div as the last child inside each `.pg` div:
- Page 1: `<div class="pg-num">Page 1 of 4</div>`
- Page 2: `<div class="pg-num">Page 2 of 4</div>`
- Page 3: `<div class="pg-num">Page 3 of 4</div>`
- Page 4: `<div class="pg-num">Page 4 of 4</div>`

### Fix 4: RFA number in letterhead

In `letterhead()` (lines 6672–6682), the right-side block shows company and date. Add RFA number below date:

**Before:**
```js
<div style="text-align:right;font-size:8.5px;color:#555;line-height:1.6">
  <div style="font-weight:700;color:#111;font-size:9px">${gf.clientCompany}</div>
  <div>${today}</div>
</div>
```

**After:**
```js
<div style="text-align:right;font-size:8.5px;color:#555;line-height:1.6">
  <div style="font-weight:700;color:#111;font-size:9px">${gf.clientCompany}</div>
  <div>${today}</div>
  <div>RFA No. ${rfaNumber||"—"}</div>
</div>
```

`rfaNumber` is a component-level state variable (line 6243) accessible inside `generateRFADocument` (its closure).

### Fix 5: Scope table — remove per-item Amount column when scope items present

Page 2 (`page2`), lines 6788–6795. When `scopeItems.length > 0`, remove the Amount column from the header and per-item rows. Show # + Description only per item. The TOTAL row at the bottom retains the amount.

**Before:**
```js
<table class="ntbl" style="margin-bottom:12px">
  <thead><tr style="background:#f0f0f0"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
  <tbody>
    ${scopeItems.length>0
      ? scopeItems.map((si,i)=>`<tr><td>${i+1}</td><td>${si.description||"—"}</td><td style="text-align:right">—</td></tr>`).join("")
      : `<tr><td>1</td><td>${pr?.description||"Works as per scope"}</td><td style="text-align:right">${awarVc?.tot>0?fmtN(awarVc.tot):"—"}</td></tr>`}
    ${awarVc?.tot>0?`<tr><td></td><td style="font-weight:700">TOTAL</td><td style="text-align:right;font-weight:700">${fmtN(awarVc.tot)}</td></tr>`:""}
  </tbody>
</table>
```

**After:**
```js
<table class="ntbl" style="margin-bottom:12px">
  ${scopeItems.length>0
    ?`<thead><tr style="background:#f0f0f0"><th>#</th><th>Description</th></tr></thead>
      <tbody>
        ${scopeItems.map((si,i)=>`<tr><td>${i+1}</td><td>${si.description||"—"}</td></tr>`).join("")}
        ${awarVc?.tot>0?`<tr><td style="font-weight:700">TOTAL</td><td style="text-align:right;font-weight:700">Php ${fmtN(awarVc.tot)}</td></tr>`:""}
      </tbody>`
    :`<thead><tr style="background:#f0f0f0"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>${pr?.description||"Works as per scope"}</td><td style="text-align:right">${awarVc?.tot>0?fmtN(awarVc.tot):"—"}</td></tr>
        ${awarVc?.tot>0?`<tr><td></td><td style="font-weight:700">TOTAL</td><td style="text-align:right;font-weight:700">${fmtN(awarVc.tot)}</td></tr>`:""}
      </tbody>`}
</table>
```

### Fix 6: Awarded vendor highlight

In CSS, update `.awd` and add a targeted header rule:

**Before:**
```css
.awd{background:#FFF7ED;font-weight:700}
```

**After:**
```css
.awd{background:#FEF3C7;font-weight:700}
.vt thead th.awd{background:#FDE68A;color:#78350F}
```

- All `.awd` cells: stronger amber background (`#FEF3C7`, clearly yellow vs barely-there `#FFF7ED`)
- Vendor header `<th>` in awarded column: dark amber header (`#FDE68A` bg, `#78350F` text) for immediate visual distinction

## Scope

All changes are inside `generateRFADocument` in `src/App.jsx` (~lines 6552–6965):
- CSS block: fixes 2, 3, 6
- `letterhead()` function: fix 4
- `page1` template: fix 1
- `page2` template: fix 5

No new state, no new helpers, no database changes.

## What Stays the Same

- All document content and structure
- Signature blocks, approval flows
- All page 3 and page 4 content
- `reasonHtml` logic — untouched
- Page 2 when `scopeItems` is empty — 3-column table unchanged
