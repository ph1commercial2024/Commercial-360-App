# NOA/NTP Selector and Formal Letter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a document type selector (NOA+NTP / NOA only / NTP only) to the generate modal and reformat page 2 as a proper formal letter with a title heading, Re: line, amount in opening paragraph, conditional NTP text, and closing salutation.

**Architecture:** All changes in `src/App.jsx`. Three locations: `genForm` default state, the generate modal form JSX, and the `page2` template string inside `generateRFADocument`.

**Tech Stack:** React 19, CSS-in-JS inline styles, design tokens (`C` object), plain JS template literal HTML generation.

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` | 3 targeted areas: genForm state, modal UI, page2 template |

---

### Task 1: Add `docType` to `genForm` default state

**Files:**
- Modify: `src/App.jsx` ~line 6257

- [ ] **Step 1: Add `docType` to the default `genForm` object**

Find the `genForm` initial state (~line 6255):
```js
  const [genForm, setGenForm] = useState(() => {
    try { const s = localStorage.getItem("rfaGenForm"); if (s) return JSON.parse(s); } catch {}
    return {
      clientCompany: "Plushomes Communities, Inc.",
      projectAddress: "",
```

Add `docType: "NOA+NTP"` as the first field:
```js
  const [genForm, setGenForm] = useState(() => {
    try { const s = localStorage.getItem("rfaGenForm"); if (s) return JSON.parse(s); } catch {}
    return {
      docType: "NOA+NTP",
      clientCompany: "Plushomes Communities, Inc.",
      projectAddress: "",
```

---

### Task 2: Add document type segmented control to the generate modal

**Files:**
- Modify: `src/App.jsx` ~lines 7153–7168

- [ ] **Step 2: Add the segmented control above the Client & Project fields**

Find the "Client & Project" section in the generate modal (~line 7153):
```jsx
                {/* Client & Project */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.textPri, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.04em" }}>Client & Project</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <GRow label="Client Company Name" field="clientCompany" placeholder="e.g. Plushomes Communities, Inc." wide />
```

Replace with (add doc type row before the grid):
```jsx
                {/* Client & Project */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.textPri, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.04em" }}>Client & Project</div>
                  {/* Document type selector */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:C.textTer, textTransform:"uppercase", marginBottom:6 }}>Document Type (Page 2)</div>
                    <div style={{ display:"flex", gap:0, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                      {[["NOA+NTP","NOA + NTP (Combined)"],["NOA","Notice of Award Only"],["NTP","Notice to Proceed Only"]].map(([val, lbl]) => (
                        <button key={val}
                          onClick={() => setGenForm(f => ({...f, docType: val}))}
                          style={{ flex:1, padding:"7px 10px", fontSize:10, fontWeight:600, border:"none", borderRight:`1px solid ${C.border}`, cursor:"pointer", background: genForm.docType===val ? C.coral : C.offWhite, color: genForm.docType===val ? "#fff" : C.textSec, transition:"background 0.15s" }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <GRow label="Client Company Name" field="clientCompany" placeholder="e.g. Plushomes Communities, Inc." wide />
```

Note: the last button in the row has `borderRight` on it. Add `borderRight:"none"` on the last button. Adjust the map to remove the trailing border on the last item:

```jsx
                      {[["NOA+NTP","NOA + NTP (Combined)"],["NOA","Notice of Award Only"],["NTP","Notice to Proceed Only"]].map(([val, lbl], idx, arr) => (
                        <button key={val}
                          onClick={() => setGenForm(f => ({...f, docType: val}))}
                          style={{ flex:1, padding:"7px 10px", fontSize:10, fontWeight:600, border:"none", borderRight: idx < arr.length-1 ? `1px solid ${C.border}` : "none", cursor:"pointer", background: genForm.docType===val ? C.coral : C.offWhite, color: genForm.docType===val ? "#fff" : C.textSec, transition:"background 0.15s" }}>
                          {lbl}
                        </button>
                      ))}
```

---

### Task 3: Reformat page 2 as a formal letter with conditional docType content

**Files:**
- Modify: `src/App.jsx` ~lines 6787–6830

- [ ] **Step 3: Replace the page2 template body**

Read lines 6787–6830 first to confirm exact current content, then replace the entire `page2` template body (everything inside `<div class="pg pb">` after `${letterhead()}`) with the new formal letter structure.

Find the current page2 body (starting after `${letterhead()}`):
```js
      ${awarVInfo?`
      <div style="margin-bottom:16px;line-height:1.7">
        <div>${awarVInfo.authorized_representative||awarVInfo.contact_person||"Dear Sir/Ma'am"}</div>
        <div style="font-weight:700">${awarVInfo.full_name}</div>
        <div>${awarVInfo.address||""}</div>
      </div>`:""}
      <div style="margin-bottom:12px">Dear ${awarVInfo?.authorized_representative||awarVInfo?.contact_person||"Sir/Ma'am"},</div>
      <div style="margin-bottom:12px;line-height:1.7">
        We are pleased to inform you that <strong>${gf.clientCompany}</strong> hereby awards
        <strong>${awarVInfo?.full_name||"[Vendor]"}</strong> the contract for all associated scope
        and corresponding prices for <strong>${pr?.projects?.name||"[Project]"}</strong>, as detailed in the table below.
      </div>
      <table class="ntbl" style="margin-bottom:12px">
        ${scopeItems.length>0
          ?`<thead><tr style="background:${C.coralLight}"><th>#</th><th>Description</th></tr></thead>
            <tbody>
              ${scopeItems.map((si,i)=>`<tr><td>${i+1}</td><td>${si.description||"—"}</td></tr>`).join("")}
              ${awarVc?.tot>0?`<tr><td></td><td style="font-weight:700;text-align:right">TOTAL &nbsp; Php ${fmtN(awarVc.tot)}</td></tr>`:""}
            </tbody>`
          :`<thead><tr style="background:${C.coralLight}"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>${pr?.description||"Works as per scope"}</td><td style="text-align:right">${awarVc?.tot>0?fmtN(awarVc.tot):"—"}</td></tr>
              ${awarVc?.tot>0?`<tr><td></td><td style="font-weight:700">TOTAL</td><td style="text-align:right;font-weight:700">${fmtN(awarVc.tot)}</td></tr>`:""}
            </tbody>`}
      </table>
      <div style="margin-bottom:10px;line-height:1.7">This also serves as Notice to Proceed for Contractor to commence the work in accordance to the agreed terms, reference plans, specs and other issued documents.</div>
      <div style="margin-bottom:10px;line-height:1.7">All works shall be in conformance to plans, standard technical specification and construction practice, including safety standards necessary to complete the scope of works.</div>
      <div style="margin-bottom:24px;line-height:1.7">Requisite project obligations can be found in the attached Term Sheet.</div>
```

Replace with:
```js
      ${(() => {
        const docType  = gf.docType || "NOA+NTP";
        const isNOA    = docType !== "NTP";
        const isNTP    = docType !== "NOA";
        const docTitle = docType === "NTP" ? "NOTICE TO PROCEED" : docType === "NOA" ? "NOTICE OF AWARD" : "NOTICE OF AWARD AND NOTICE TO PROCEED";
        const docRef   = docType === "NTP" ? "Notice to Proceed" : docType === "NOA" ? "Notice of Award" : "Notice of Award and Notice to Proceed";
        const openingBody = isNOA
          ? `We are pleased to inform you that <strong>${gf.clientCompany}</strong> hereby awards <strong>${awarVInfo?.full_name||"[Vendor]"}</strong> the contract for all associated scope and corresponding prices for <strong>${pr?.projects?.name||"[Project]"}</strong> amounting to <strong>Php ${fmtN(awarVc?.tot||0)} (VAT Inclusive)</strong>, as detailed in the table below.`
          : `We are pleased to inform you that <strong>${gf.clientCompany}</strong> hereby issues this Notice to Proceed to <strong>${awarVInfo?.full_name||"[Vendor]"}</strong> for the contract covering <strong>${pr?.projects?.name||"[Project]"}</strong> amounting to <strong>Php ${fmtN(awarVc?.tot||0)} (VAT Inclusive)</strong>, as detailed below.`;
        const ntpBody = docType === "NOA+NTP"
          ? `<div style="margin-bottom:10px;line-height:1.7">This also serves as Notice to Proceed for Contractor to commence the work in accordance to the agreed terms, reference plans, specs and other issued documents.</div>`
          : docType === "NOA"
          ? `<div style="margin-bottom:10px;line-height:1.7">A separate Notice to Proceed will be issued upon fulfillment of pre-commencement requirements.</div>`
          : `<div style="margin-bottom:10px;line-height:1.7">You are hereby directed to commence the work in accordance with the agreed terms, reference plans, specifications, and other issued documents.</div>`;
        return `
      ${awarVInfo?`
      <div style="margin-bottom:16px;line-height:1.7">
        <div>${awarVInfo.authorized_representative||awarVInfo.contact_person||"Dear Sir/Ma'am"}</div>
        <div style="font-weight:700">${awarVInfo.full_name}</div>
        <div>${awarVInfo.address||""}</div>
      </div>`:""}
      <div style="font-weight:700;font-size:11px;text-transform:uppercase;text-align:center;letter-spacing:0.05em;margin:14px 0 14px;padding-bottom:6px;border-bottom:1.5px solid ${C.coral}">${docTitle}</div>
      <div style="margin-bottom:12px;line-height:1.7"><strong>Re:</strong>&nbsp;&nbsp;${pr?.projects?.name||"[Project]"} &mdash; ${docRef}</div>
      <div style="margin-bottom:12px">Dear ${awarVInfo?.authorized_representative||awarVInfo?.contact_person||"Sir/Ma'am"},</div>
      <div style="margin-bottom:12px;line-height:1.7">${openingBody}</div>
      <table class="ntbl" style="margin-bottom:12px">
        ${scopeItems.length>0
          ?`<thead><tr style="background:${C.coralLight}"><th>#</th><th>Description</th></tr></thead>
            <tbody>
              ${scopeItems.map((si,i)=>`<tr><td>${i+1}</td><td>${si.description||"—"}</td></tr>`).join("")}
              ${awarVc?.tot>0?`<tr><td></td><td style="font-weight:700;text-align:right">TOTAL &nbsp; Php ${fmtN(awarVc.tot)}</td></tr>`:""}
            </tbody>`
          :`<thead><tr style="background:${C.coralLight}"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>${pr?.description||"Works as per scope"}</td><td style="text-align:right">${awarVc?.tot>0?fmtN(awarVc.tot):"—"}</td></tr>
              ${awarVc?.tot>0?`<tr><td></td><td style="font-weight:700">TOTAL</td><td style="text-align:right;font-weight:700">${fmtN(awarVc.tot)}</td></tr>`:""}
            </tbody>`}
      </table>
      ${ntpBody}
      <div style="margin-bottom:10px;line-height:1.7">All works shall be in conformance to plans, standard technical specification and construction practice, including safety standards necessary to complete the scope of works.</div>
      <div style="margin-bottom:36px;line-height:1.7">Requisite project obligations can be found in the attached Term Sheet.</div>
      <div style="margin-bottom:36px;line-height:1.7">Very truly yours,</div>`;
      })()}
```

---

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: `✓ built in X.XXs` — no errors.

Then open `http://localhost:5173`, navigate to an RFA, click **📄 Generate Package** and verify in the modal:

1. The "Document Type (Page 2)" segmented control appears at the top, with "NOA + NTP (Combined)" active by default
2. Switching to "Notice of Award Only" or "Notice to Proceed Only" highlights that button in coral
3. After clicking **Generate & Print**, page 2 shows:
   - The bold centered title matching the selected type (with coral underline)
   - "Re: [project name] — [doc type]" below the title
   - The salutation "Dear [name],"
   - Opening paragraph including "amounting to Php X (VAT Inclusive)"
   - Scope table
   - The correct NTP / NOA-only / combined paragraph
   - "Very truly yours," before the signatures
4. For NOA+NTP: "This also serves as Notice to Proceed..." is present
5. For NOA only: "A separate Notice to Proceed will be issued..." is present
6. For NTP only: "You are hereby directed to commence..." is present and the opening says "hereby issues this Notice to Proceed"

---

## Verification Checklist

- [ ] `genForm` default includes `docType: "NOA+NTP"`
- [ ] Generate modal shows 3-button segmented control for document type
- [ ] Active button is coral, inactive buttons are offWhite
- [ ] Page 2 title is bold centered uppercase with coral underline
- [ ] Title changes correctly based on docType
- [ ] Re: line appears between title and salutation
- [ ] Opening paragraph includes contract amount + "(VAT Inclusive)"
- [ ] NTP paragraph text is conditional: combined / NOA-only / NTP-only variants correct
- [ ] "Very truly yours," appears before signature table
- [ ] Build passes with no errors
