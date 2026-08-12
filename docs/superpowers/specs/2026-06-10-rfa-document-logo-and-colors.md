# RFA Document — Logo and Branding Colors

**Date:** 2026-06-10
**Status:** Approved

## Problem

1. **Logo not showing** — Pages 2–4 have logo support via `letterhead()` using `buLogoUrl`, but the logo appears as a dashed "LOGO" placeholder. Root cause: `fetchBuLogo` uses substring matching that fails when the project's `business_unit` field differs from the business unit name in the table by spacing or punctuation (e.g. `"Plushomes Communities, Inc."` vs `"Plus Homes Communities Inc."`). Both normalize to `"plushomescommunitiesinc"` but the current code never does a normalized comparison.

2. **Page 1 has no logo** — The page 1 header is a plain centered title (`company name in small caps + bold RECOMMENDATION FOR AWARD`). Pages 2–4 already have the letterhead layout (logo left, company/date/RFA# right). Page 1 should match.

3. **Document colors are generic gray** — Section headers, table column headers, divider lines, and sub-section rows all use hardcoded grays (`#f0f0f0`, `#e0e0e0`, `#333`, `#111`). The app's `C` design token object is in scope inside `generateRFADocument` (it's a closure) and can be used to apply brand colors.

## Design

### Fix 1: Normalized name matching in `fetchBuLogo`

Add a normalized-comparison fallback. "Normalize" means: lowercase + strip all non-alphanumeric characters.

```js
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const bu = allBUs.find(b =>
  b.name === buName ||
  b.name?.toLowerCase() === buName?.toLowerCase() ||
  b.name?.toLowerCase().includes(buName?.toLowerCase()) ||
  buName?.toLowerCase().includes(b.name?.toLowerCase()) ||
  norm(b.name) === norm(buName)
);
```

No other changes to the function.

### Fix 2: Add logo to page 1 header

Replace the current page 1 centered header block:
```js
<div style="text-align:center;margin-bottom:10px">
  <div style="font-size:7.5px;...;color:#888;...">${gf.clientCompany}</div>
  <div style="font-size:15px;font-weight:700;...;border-bottom:2.5px solid #111;...">RECOMMENDATION FOR AWARD</div>
</div>
```

With a two-part header:
1. A letterhead row identical to `letterhead()` in style: logo left, company+date+RFA# right, separated by `border-bottom:2px solid ${C.coral}`
2. A centered document title (`RECOMMENDATION FOR AWARD`) below, with its own `border-bottom:2px solid ${C.coral}`

The page 1 header does NOT call `letterhead()` as a function (that was added for pages 2–4); instead, inline the same HTML structure directly into `page1`. This keeps page 1 and pages 2–4 visually consistent.

### Fix 3: Branding colors

The `C` object (design tokens) is in scope inside `generateRFADocument`. Use it in the CSS template literal string and inline styles.

**CSS class changes:**

| Selector | Property | Before | After |
|---|---|---|---|
| `.vt thead th` | `background` | `#f0f0f0` | `${C.coralLight}` |
| `.sh td` | `background` | `#e0e0e0` | `${C.coralLight}` |
| `.sh td` | `color` | _(none, inherited)_ | `${C.coral}` |
| `.sec-hdr` | `border-bottom` | `1.5px solid #333` | `1.5px solid ${C.coral}` |
| `.ptbl th` | `background` | `#f0f0f0` | `${C.coralLight}` |

**Inline style changes (in letterhead and page templates):**

| Location | Property | Before | After |
|---|---|---|---|
| `letterhead()` div | `border-bottom` | `2px solid #111` | `2px solid ${C.coral}` |
| Page 1 new letterhead row | `border-bottom` | — | `2px solid ${C.coral}` |
| Page 1 title div | `border-bottom` | `2.5px solid #111` | `2.5px solid ${C.coral}` |
| Page 2 scope table header row | `background` | `#f0f0f0` | `${C.coralLight}` |
| Page 3 contract table header row | `background` | `#f0f0f0` | `${C.coralLight}` |

`.rl` (label column background `#f6f6f6`) is intentionally left as a neutral gray — coloring label cells would be too visually heavy.

## Scope

- `fetchBuLogo` function (~line 6298): fix 1
- CSS block inside `generateRFADocument` (~lines 6635–6671): fix 3 (CSS)
- `letterhead()` function (~lines 6674–6685): fix 3 (inline)
- `page1` template header (~lines 6691–6694): fix 2 + fix 3 (title underline)
- `page2` template scope table header row (~line 6789): fix 3 (inline)
- `page3` template contract table header row (~line 6828): fix 3 (inline)

No new state, no DB changes.

## What Stays the Same

- `letterhead()` function structure — only the `border-bottom` color changes
- Page 2–4 logo/placeholder logic — already works, no change needed
- `.awd` and `.vt thead th.awd` highlight rules — already amber, untouched
- All document content, signatures, and data rendering
