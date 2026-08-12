# RFA Document Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 issues in the `generateRFADocument` function in `src/App.jsx`: duplicate sentence bug, small font sizes, missing page numbers, missing RFA number on pages 2–4, scope table showing `—` for all item amounts, and a too-subtle awarded vendor highlight.

**Architecture:** All changes are inside `generateRFADocument` (~lines 6552–6965 of `src/App.jsx`). Touches: CSS block, `letterhead()` function, `page1` template, `page2` template. No new state or helpers.

**Tech Stack:** React 19, Vite 8, plain JS string template literals (HTML generation), no JSX inside this function.

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` | 6 targeted edits inside `generateRFADocument` (~lines 6635–6795) |

---

### Task 1: Apply all 6 fixes to `generateRFADocument`

**Files:**
- Modify: `src/App.jsx`

All edits are inside `generateRFADocument`. They are independent of each other (different locations in the function) and can be applied as one commit.

---

- [ ] **Step 1: Fix 1 — Remove the duplicate hardcoded sentence from page1**

Find this block inside `page1` (around line 6742):

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

Replace with:

```js
      <div class="rec">
        <div class="sec-hdr">RECOMMENDATION</div>
        ${awarVInfo&&awarVc?reasonHtml:`<div style="color:#999;font-style:italic">No vendor recommended yet.</div>`}
      </div>
```

---

- [ ] **Step 2: Fix 2 — Bump font sizes in the CSS block**

Find the CSS block (around line 6644). Make these 4 targeted changes:

Change `.htbl` `font-size` from `9px` to `9.5px`:
```
.htbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9px}
```
→
```
.htbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.5px}
```

Change `.vt` `font-size` from `8.5px` to `9.5px`:
```
.vt{width:100%;border-collapse:collapse;font-size:8.5px;margin:8px 0}
```
→
```
.vt{width:100%;border-collapse:collapse;font-size:9.5px;margin:8px 0}
```

Change `.vt thead th` `font-size` from `8.5px` to `9.5px`:
```
.vt thead th{background:#f0f0f0;font-weight:700;text-align:center;font-size:8.5px}
```
→
```
.vt thead th{background:#f0f0f0;font-weight:700;text-align:center;font-size:9.5px}
```

Change `.attbl` `font-size` from `8.5px` to `9.5px`:
```
.attbl{border-collapse:collapse;font-size:8.5px}
```
→
```
.attbl{border-collapse:collapse;font-size:9.5px}
```

---

- [ ] **Step 3: Fix 3 — Add page number CSS and page number divs to all 4 pages**

In the CSS block, add `.pg-num` after the existing `.attbl` rule (or before the `@media print` block):

Find:
```
      .ntbl{border-collapse:collapse;width:100%;margin:8px 0}
```

Replace with:
```
      .ntbl{border-collapse:collapse;width:100%;margin:8px 0}
      .pg-num{position:absolute;bottom:12px;right:14px;font-size:8px;color:#888}
```

Then add page numbers inside each page div. Each page is a `<div class="pg">` or `<div class="pg pb">`. Add `<div class="pg-num">Page X of 4</div>` as the last line before each closing `</div>`.

**Page 1** — find the closing div of the page1 template (just before `</div>\`;\n\n    // ── PAGE 2`):
```js
      </div>
    </div>`;

    // ── PAGE 2: NOA / NTP ────────────────────────────────────────────────────
```

Replace the `</div>\`;` with:
```js
      <div class="pg-num">Page 1 of 4</div>
    </div>`;

    // ── PAGE 2: NOA / NTP ────────────────────────────────────────────────────
```

**Page 2** — find the closing div of page2 (just before `</div>\`;\n\n    // ── PAGE 3`):
```js
      </table>
    </div>`;

    // ── PAGE 3: Contract Agreement ───────────────────────────────────────────
```

Replace:
```js
      </table>
      <div class="pg-num">Page 2 of 4</div>
    </div>`;

    // ── PAGE 3: Contract Agreement ───────────────────────────────────────────
```

**Page 3** — find the closing div of page3 (just before `</div>\`;\n\n    // ── PAGE 4`):
```js
      <div style="text-align:center;margin-top:20px;font-size:9.5px;color:#888">in the presence of: ___________________________________</div>
    </div>`;

    // ── PAGE 4: Term Sheet ───────────────────────────────────────────────────
```

Replace:
```js
      <div style="text-align:center;margin-top:20px;font-size:9.5px;color:#888">in the presence of: ___________________________________</div>
      <div class="pg-num">Page 3 of 4</div>
    </div>`;

    // ── PAGE 4: Term Sheet ───────────────────────────────────────────────────
```

**Page 4** — find the closing div of page4 (at end of `const page4 = ...`):
```js
      </table>
    </div>`;

    const win = window.open(
```

Replace:
```js
      </table>
      <div class="pg-num">Page 4 of 4</div>
    </div>`;

    const win = window.open(
```

---

- [ ] **Step 4: Fix 4 — Add RFA number to letterhead**

Find the `letterhead()` function (around line 6672):

```js
        <div style="text-align:right;font-size:8.5px;color:#555;line-height:1.6">
          <div style="font-weight:700;color:#111;font-size:9px">${gf.clientCompany}</div>
          <div>${today}</div>
        </div>
```

Replace with:

```js
        <div style="text-align:right;font-size:8.5px;color:#555;line-height:1.6">
          <div style="font-weight:700;color:#111;font-size:9px">${gf.clientCompany}</div>
          <div>${today}</div>
          <div>RFA No. ${rfaNumber||"—"}</div>
        </div>
```

---

- [ ] **Step 5: Fix 5 — Restructure Page 2 scope table**

Find the scope table in `page2` (around line 6788):

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

Replace with:

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

---

- [ ] **Step 6: Fix 6 — Strengthen awarded vendor highlight**

Find in the CSS block:

```
      .awd{background:#FFF7ED;font-weight:700}
```

Replace with:

```
      .awd{background:#FEF3C7;font-weight:700}
      .vt thead th.awd{background:#FDE68A;color:#78350F}
```

---

- [ ] **Step 7: Build and verify**

Run:
```bash
npm run build
```

Expected: build succeeds with no errors (383 modules transformed).

Then open `http://localhost:5173`, navigate to an RFA → Summary & Recommendation tab, click **📄 Generate Package**, and verify in the opened window:

1. Page 1 recommendation section shows "1. To award to [vendor]…" only once
2. Vendor table text is visibly larger and more readable
3. "Page 1 of 4" appears at bottom-right of page 1
4. Pages 2, 3, 4 each show their page number at bottom-right
5. Pages 2, 3, 4 letterhead shows "RFA No. [number]" below the date
6. Page 2 scope table: if scope items exist, shows # + Description only (no `—` per item), with Php total at the bottom
7. Awarded vendor column header is distinctly amber (`#FDE68A`), body cells are clearly yellow (`#FEF3C7`)

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "fix: rfa document - remove duplicate sentence, fix font sizes, add page numbers, rfa# in letterhead, scope table, award highlight"
```

---

## Verification Checklist

- [ ] "1. To award to…" appears exactly once on page 1
- [ ] Table font sizes all ≥ 9.5px (`.vt`, `.vt thead th`, `.attbl`, `.htbl`)
- [ ] "Page X of 4" visible at bottom-right of all 4 pages
- [ ] "RFA No. [number]" shown in letterhead on pages 2, 3, 4
- [ ] Page 2 scope table with multiple items shows no `—` in Amount column (column is hidden)
- [ ] Page 2 scope table with single item still shows 3-column format with amount
- [ ] Awarded vendor header cell has amber background (#FDE68A), body cells have #FEF3C7
- [ ] Build passes with no errors
- [ ] No console errors in the browser
