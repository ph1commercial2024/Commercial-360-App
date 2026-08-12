# RFA Document Issuance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Preview & Edit modal to the RFA document generation flow, persist each issuance to a new `rfa_documents` Supabase table, and show a versioned "Issued Documents" section on the RFA page for reprinting.

**Architecture:** All code changes are in `src/App.jsx` plus one Supabase migration. The existing `generateRFADocument(gf)` is renamed `printDocument(gf, bodies)` and accepts pre-built page bodies instead of building them inline. A new `buildPageBodies(gf)` function extracts the body HTML for pages 2–4 so the preview modal can initialize its contenteditable divs from it. Each "Issue Document" action inserts one row into `rfa_documents` storing the edited body HTML plus a `gen_form_snapshot`.

**Tech Stack:** React 19, Vite 8, Supabase JS SDK, `document.execCommand` for contenteditable formatting, CSS-in-JS inline styles, `C` design tokens, `useRef` for contenteditable divs.

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` line 1 | Add `useRef` to React imports |
| `src/App.jsx` ~line 6253 | Add 4 new `useState` variables + 3 `useRef` variables |
| `src/App.jsx` ~line 6383 | Add `issuedDocs` fetch inside `if (initialRfaId)` block |
| `src/App.jsx` ~line 6558 | Add new `buildPageBodies(gf)` function |
| `src/App.jsx` ~line 6559 | Refactor `generateRFADocument(gf)` → `printDocument(gf, bodies)` |
| `src/App.jsx` after `printDocument` | Add `issueDocument()` and `printIssuedDoc(record)` |
| `src/App.jsx` ~line 7140 | Add "Issued Documents" section JSX |
| `src/App.jsx` after gen modal | Add Preview & Edit modal JSX |
| `src/App.jsx` ~line 7233 | Change "Generate & Print" → "Preview & Edit" |
| Supabase | New `rfa_documents` table migration |

---

### Task 1: Create `rfa_documents` table in Supabase

**Files:**
- Supabase migration (apply via MCP or dashboard SQL editor)

- [ ] **Step 1: Apply migration**

Run this SQL via the Supabase dashboard (SQL Editor) or MCP `apply_migration` tool on project `nrdeigqqrrtgazdkdzlh`:

```sql
create table rfa_documents (
  id               uuid primary key default gen_random_uuid(),
  pr_id            integer not null references purchase_requests(id) on delete cascade,
  doc_type         text not null default 'NOA+NTP',
  revision_no      integer not null default 1,
  revision_comment text,
  page2_html       text,
  page3_html       text,
  page4_html       text,
  gen_form_snapshot jsonb not null default '{}'::jsonb,
  issued_at        timestamptz not null default now(),
  issued_by        text
);

alter table rfa_documents enable row level security;
create policy "anon full access rfa_documents" on rfa_documents for all using (true) with check (true);
```

- [ ] **Step 2: Build to verify no type errors**

```bash
npm run build
```

Expected: `✓ built in X.XXs` — no errors.

---

### Task 2: Add `useRef` import + new state and refs

**Files:**
- Modify: `src/App.jsx` line 1 and ~line 6253

- [ ] **Step 1: Add `useRef` to the React import**

Find line 1:
```js
import React, { useState, useEffect, useContext, createContext } from "react";
```

Replace with:
```js
import React, { useState, useEffect, useContext, createContext, useRef } from "react";
```

- [ ] **Step 2: Add new state variables and refs**

Find (~line 6253):
```js
  const [showGenModal, setShowGenModal] = useState(false);
  const [buLogoUrl, setBuLogoUrl]       = useState(null);
```

Replace with:
```js
  const [showGenModal, setShowGenModal]           = useState(false);
  const [showPreviewModal, setShowPreviewModal]   = useState(false);
  const [previewTab, setPreviewTab]               = useState("page2");
  const [revisionComment, setRevisionComment]     = useState("");
  const [issuedDocs, setIssuedDocs]               = useState([]);
  const [buLogoUrl, setBuLogoUrl]                 = useState(null);
  const page2EditRef = useRef(null);
  const page3EditRef = useRef(null);
  const page4EditRef = useRef(null);
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```

Expected: `✓ built in X.XXs` — no errors.

---

### Task 3: Fetch `issuedDocs` on RFA load

**Files:**
- Modify: `src/App.jsx` ~line 6383

- [ ] **Step 1: Add issuedDocs fetch inside the `if (initialRfaId)` block**

Find (~line 6383):
```js
        const prId = rfa.purchase_requests?.id;
        if (prId) { const { data: si } = await supabase.from("scope_items").select("*").eq("pr_id", prId).order("sort_order"); if (si) setScopeItems(si); }
```

Replace with:
```js
        const prId = rfa.purchase_requests?.id;
        if (prId) {
          const { data: si } = await supabase.from("scope_items").select("*").eq("pr_id", prId).order("sort_order");
          if (si) setScopeItems(si);
          const { data: docs } = await supabase.from("rfa_documents").select("*").eq("pr_id", prId).order("revision_no", { ascending: false });
          const docsArr = docs || [];
          setIssuedDocs(docsArr);
          if (docsArr.length > 0) fetchBuLogo(docsArr[0].gen_form_snapshot?.clientCompany);
        }
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

Expected: `✓ built in X.XXs` — no errors.

---

### Task 4: Add `buildPageBodies(gf)` function

**Files:**
- Modify: `src/App.jsx` — add just above `const generateRFADocument = (gf) => {` (~line 6559)

This function extracts and returns the editable body HTML for pages 2, 3, and 4 (no `.pg pb` wrapper, no letterhead, no `pg-num` div). It uses component-state closures: `vendors`, `awardedSlot`, `vComputed`, `vendorList`, `pr`, `scopeItems`, `C`, `PT_HAS_DP`, `PT_HAS_PROGRESS`, `PT_IS_MILESTONE`, `COMMENCEMENT_TYPES`, `PROGRESS_FREQUENCIES`, `fmtShort`.

- [ ] **Step 1: Insert `buildPageBodies` before `generateRFADocument`**

Find:
```js
  const generateRFADocument = (gf) => {
```

Replace with:
```js
  const buildPageBodies = (gf) => {
    const awarV    = vendors.find(v => v.slot === awardedSlot);
    const awarVi   = awarV ? vendors.indexOf(awarV) : -1;
    const awarVc   = awarVi >= 0 ? vComputed[awarVi] : null;
    const awarVInfo = awarV ? vendorList.find(vl => String(vl.id) === String(awarV.vendor_id)) : null;
    const awarPtd  = awarV?.payment_term_data || {};
    const awarPtt  = awarVc?.ptt || "";
    const today = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
    const fmtN  = n => Number(n||0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

    const payText = (v, vc) => {
      const ptdV = v.payment_term_data || {};
      const pttV = v.payment_term_type || "";
      const ret  = ptdV.retention_percent || 10;
      if (PT_HAS_PROGRESS.has(pttV)) {
        const freq = PROGRESS_FREQUENCIES.find(f => f.value === ptdV.progress_freq)?.label || "Monthly (POC)";
        return `Progress billing (${freq}) with ${ret}% retention`;
      }
      if (PT_HAS_DP.has(pttV)) return `Balance upon completion with pro-rata DP recoupment and ${ret}% retention`;
      if (PT_IS_MILESTONE.has(pttV)) return "Milestone-based payments";
      return "Full payment upon completion";
    };
    const commText = v => {
      const ptdV = v.payment_term_data || {};
      const ct   = COMMENCEMENT_TYPES.find(c => c.value === ptdV.commencement_type);
      if (!ct) return "—";
      return ptdV.commencement_days ? `${ct.label} — within ${ptdV.commencement_days} days` : ct.label;
    };
    const durText = v => {
      const ptdV = v.payment_term_data || {};
      if (ptdV.completion_mode === "work_duration" && ptdV.work_duration)
        return `${ptdV.work_duration} ${ptdV.work_duration_type === "working_days" ? "working days" : "calendar days"}`;
      if (v.completion_date) return fmtShort(v.completion_date);
      return "—";
    };
    const sigBlock = (role, name, title, company) =>
      `<td style="text-align:center;padding:5px 10px;vertical-align:top">
        <div style="font-size:8.5px;color:#555;margin-bottom:2px">${role}:</div>
        <div style="border-top:1px solid #333;margin:34px 10px 4px"></div>
        <div style="font-weight:700;font-size:9.5px">${name || "________________________"}</div>
        <div style="font-size:8.5px;color:#444">${title || ""}</div>
        ${company ? `<div style="font-size:8.5px;color:#444">${company}</div>` : ""}
      </td>`;
    const tsRow = (label, value) =>
      `<tr><td style="width:38%;font-weight:600;background:#fafafa">${label}</td><td>${value}</td></tr>`;

    // ── Page 2 body ───────────────────────────────────────────────────────────
    const page2 = (()=>{
      const docType  = gf.docType||"NOA+NTP";
      const isNOA    = docType!=="NTP";
      const docTitle = docType==="NTP"?"NOTICE TO PROCEED":docType==="NOA"?"NOTICE OF AWARD":"NOTICE OF AWARD AND NOTICE TO PROCEED";
      const docRef   = docType==="NTP"?"Notice to Proceed":docType==="NOA"?"Notice of Award":"Notice of Award and Notice to Proceed";
      const openingBody = isNOA
        ? `We are pleased to inform you that <strong>${gf.clientCompany}</strong> hereby awards <strong>${awarVInfo?.full_name||"[Vendor]"}</strong> the contract for all associated scope and corresponding prices for <strong>${pr?.projects?.name||"[Project]"}</strong> amounting to <strong>Php ${fmtN(awarVc?.tot||0)} (VAT Inclusive)</strong>, as detailed in the table below.`
        : `We are pleased to inform you that <strong>${gf.clientCompany}</strong> hereby issues this Notice to Proceed to <strong>${awarVInfo?.full_name||"[Vendor]"}</strong> for the contract covering <strong>${pr?.projects?.name||"[Project]"}</strong> amounting to <strong>Php ${fmtN(awarVc?.tot||0)} (VAT Inclusive)</strong>, as detailed below.`;
      const ntpBody = docType==="NOA+NTP"
        ? `<div style="margin-bottom:10px;line-height:1.7">This also serves as Notice to Proceed for Contractor to commence the work in accordance to the agreed terms, reference plans, specs and other issued documents.</div>`
        : docType==="NOA"
        ? `<div style="margin-bottom:10px;line-height:1.7">A separate Notice to Proceed will be issued upon fulfillment of pre-commencement requirements.</div>`
        : `<div style="margin-bottom:10px;line-height:1.7">You are hereby directed to commence the work in accordance with the agreed terms, reference plans, specifications, and other issued documents.</div>`;
      return `
      ${awarVInfo?`
      <div style="margin-bottom:16px;line-height:1.7">
        <div>${awarVInfo.authorized_representative||awarVInfo.contact_person||""}</div>
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
      <div style="margin-bottom:36px;line-height:1.7">Very truly yours,</div>
      <table style="width:100%;border-collapse:collapse;margin-top:20px">
        <tr>
          ${sigBlock("Endorsed for Approval By", gf.endorsedByName, gf.endorsedByTitle, gf.clientCompany)}
          ${sigBlock("Approved By", gf.approvedBy1Name, gf.approvedBy1Title, gf.clientCompany)}
        </tr>
        <tr>
          ${sigBlock("Approved By", gf.approvedBy2Name||"________________________", gf.approvedBy2Title, gf.clientCompany)}
          ${sigBlock("Accepted and Confirmed By", awarVInfo?.authorized_representative||awarVInfo?.contact_person||"________________________", awarVInfo?.representative_title||"General Manager", awarVInfo?.full_name||"")}
        </tr>
      </table>`;
    })();

    // ── Page 3 body ───────────────────────────────────────────────────────────
    const page3 = `
      <h2 class="dt" style="margin-bottom:14px">Contract Agreement</h2>
      <div style="line-height:1.7;margin-bottom:12px">
        THIS AGREEMENT made the <strong>${today}</strong>, between
        <strong>${gf.clientCompany}</strong> (hereinafter &ldquo;Client&rdquo;), of the one part, and
        <strong>${awarVInfo?.full_name||"[Contractor]"}</strong> (hereinafter &ldquo;Contractor&rdquo;), of the other part:
      </div>
      <div style="line-height:1.7;margin-bottom:12px">
        WHEREAS the Client desires that the Works listed in the table below be executed by the Contractor,
        and has accepted a proposal by the Contractor for the execution and completion of these Works and
        the remedying of any defects therein.
      </div>
      <table class="ntbl" style="margin-bottom:14px">
        <thead><tr style="background:${C.coralLight}"><th>Item</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>${pr?.description||"Works as per scope"}</td><td style="text-align:right">${awarVc?.tot>0?fmtN(awarVc.tot):"—"}</td></tr>
        </tbody>
      </table>
      <div style="font-weight:700;margin-bottom:6px">The Employer and the Contractor agree as follows:</div>
      <ol>
        <li>In this Agreement, words and expressions shall have the same meanings as are respectively assigned to them in the Term Sheet and other contract documents referred to.</li>
        <li>The following documents shall be deemed to form and be read and construed as part of this Agreement:
          <ol type="a"><li>The Term Sheet,</li><li>Notice of Award,</li><li>Annex A (Contractor&rsquo;s Evaluated Proposal)</li></ol>
        </li>
        <li>In consideration of the payments to be made by the Client to the Contractor as indicated in this Agreement, the Contractor hereby covenants with the Client to execute the Works and to remedy defects therein in conformity in all respects with the provisions of the Term Sheet.</li>
        <li>The Client hereby covenants to pay the Contractor in consideration of the execution and completion of the Works and the remedying of defects therein, the Contract Price or such other sum as may become payable under the provisions of the Term Sheet at the times and in the manner prescribed by the Term Sheet.</li>
      </ol>
      <div style="line-height:1.7;margin-top:12px">IN WITNESS whereof the parties hereto have caused this Agreement to be executed in accordance with the laws of The Republic of the Philippines on the day, month and year indicated above.</div>
      <table style="width:100%;border-collapse:collapse;margin-top:30px">
        <tr>
          ${sigBlock("For and on behalf of the Contractor &mdash; Signed by", awarVInfo?.authorized_representative||awarVInfo?.contact_person||"________________________", awarVInfo?.representative_title||"General Manager", awarVInfo?.full_name||"")}
          ${sigBlock("For and on behalf of the Client &mdash; Signed by", gf.endorsedByName||"________________________", gf.endorsedByTitle, gf.clientCompany)}
        </tr>
      </table>
      <div style="text-align:center;margin-top:20px;font-size:9.5px;color:#888">in the presence of: ___________________________________</div>`;

    // ── Page 4 body ───────────────────────────────────────────────────────────
    const page4 = `
      <h2 class="dt">TERM SHEET</h2>
      <h2 class="dt" style="font-weight:400;font-size:10.5px;margin-bottom:2px">${pr?.description||"Works"}</h2>
      <h2 class="dt" style="font-weight:400;font-size:10px;margin-bottom:14px">${gf.clientCompany} &bull; ${awarVInfo?.full_name||"[Contractor]"}</h2>
      <div style="font-size:9.5px;font-style:italic;margin-bottom:12px">This Term Sheet is a binding agreement.</div>
      <table class="ptbl">
        <thead><tr><th colspan="2" style="text-align:left">1. PARTIES</th></tr></thead>
        <tbody>
          ${tsRow(`<strong>${gf.clientCompany}</strong> (&ldquo;Client&rdquo;)`, `with official business address at ${gf.projectAddress||pr?.projects?.business_unit||"—"}`)}
          ${tsRow(`<strong>${awarVInfo?.full_name||"[Contractor]"}</strong> (&ldquo;Contractor&rdquo;)`, `with address at ${awarVInfo?.address||"—"}`)}
        </tbody>
      </table>
      <table class="ptbl" style="margin-top:6px">
        <thead><tr><th colspan="2" style="text-align:left">2. SCOPE OF WORK</th></tr></thead>
        <tbody>
          <tr><td colspan="2">
            Contractor shall undertake the following: supply of labor, materials, and equipment, including supervision and all associated scope, in accordance with the approved scope and specifications.<br/><br/>
            <strong>Description:</strong> ${pr?.description||"—"}<br/>
            ${pr?.justification?`<strong>Justification:</strong> ${pr.justification}`:""}
          </td></tr>
        </tbody>
      </table>
      <table class="ptbl" style="margin-top:6px">
        <thead><tr><th colspan="2" style="text-align:left">3. CONTRACT PRICE</th></tr></thead>
        <tbody>
          <tr><td colspan="2">
            The Total Contract Price is <strong>Php ${fmtN(awarVc?.tot||0)}</strong>, VAT-inclusive, with a fixed lumpsum arrangement.
            The Contractor warrants that all plans and pertinent documents have been inspected and that the contract price is inclusive of all necessary scope to fully complete the works.
          </td></tr>
        </tbody>
      </table>
      <table class="ptbl" style="margin-top:6px">
        <thead><tr><th colspan="2" style="text-align:left">4. COMMENCEMENT DATE</th></tr></thead>
        <tbody><tr><td colspan="2">${commText(awarV||{payment_term_data:{}})}</td></tr></tbody>
      </table>
      <table class="ptbl" style="margin-top:6px">
        <thead><tr><th colspan="2" style="text-align:left">5. CONSTRUCTION PERIOD / COMPLETION</th></tr></thead>
        <tbody><tr><td colspan="2">${durText(awarV||{payment_term_data:{}})}</td></tr></tbody>
      </table>
      <table class="ptbl" style="margin-top:6px">
        <thead><tr><th style="width:38%">PROVISION</th><th>LIMIT / TERMS</th></tr></thead>
        <tbody>
          ${tsRow("Absence of Signed Contract", "Does not prohibit the Client from releasing any form of payment to the Contractor. Notwithstanding the absence of a Signed Contract, this Term Sheet prevails.")}
          ${tsRow("Insurance", "NOT APPLICABLE")}
          ${PT_HAS_DP.has(awarPtt)?tsRow("Down Payment (DP)",`${awarPtd.dp_percent||20}% of the Contract Amount — ${awarPtd.dp_recoupable===false?"<strong>Non-recoupable</strong>":"Recoupable at "+(awarPtd.dp_percent||20)+"% per progress billing until fully recouped"}`):""}
          ${PT_HAS_DP.has(awarPtt)?tsRow("Surety Bond / Down Payment Bond",`${awarPtd.dp_percent||20}% of the Contract Amount (${fmtN(awarVc?.autoAmts?.surety||0)})`):""}
          ${PT_HAS_PROGRESS.has(awarPtt)?tsRow("Performance Bond",`${awarPtd.performance_bond_percent||30}% of the Contract Amount (${fmtN(awarVc?.autoAmts?.performance||0)})`):tsRow("Performance Bond","NOT APPLICABLE")}
          ${PT_HAS_RETENTION.has(awarPtt)?tsRow("Retention Bond",`${awarPtd.retention_percent||10}% of the Contract Amount`):""}
          ${tsRow("Payment", payText(awarV||{payment_term_type:"",payment_term_data:{}}, awarVc||{}))}
          ${PT_HAS_RETENTION.has(awarPtt)?tsRow("Retention",`${awarPtd.retention_percent||10}% of the Contract Amount. Retention shall be paid upon 100% completion and acceptance, deductive of applicable taxes. Retention payment shall be released upon submission of an acceptable Warranty Bond, Signed and Sealed As-Built Plans (if applicable), and Final Billing Invoice.`):""}
          ${tsRow("Release of Payment (Duration)","30 days upon submission of complete billing requirements and the approved reconciliation sheet")}
          ${tsRow("Notice Period of Claims","Within 28 business days from the knowledge of the event.")}
          ${tsRow("Substantiation of Claim","Within 90 business days from notice.")}
          ${tsRow("Submission and Responses to RFI/RFA","Level of Priority: 3 calendar days &ndash; High &bull; 7 calendar days &ndash; Medium &bull; 14 calendar days &ndash; Low")}
          ${tsRow("Liquidated Damages (&ldquo;LD&rdquo;)",`${awarV?.liquidated_damages||"Per contract standard terms"}. The application of LDs shall be the Client&rsquo;s sole remedy for any delay. If LD amounts exceed 10% of the contract value, Client will have the option to call contractor-issued bonds and take over the remaining works.`)}
          ${tsRow("Client Option to Take Over due to Delay","If due to the fault of the Contractor, the maximum allowed delay in the Completion Schedule is 14 calendar days. Client will have the option to call bonds and take over remaining works.")}
          ${tsRow("Governing Law","Philippine Law")}
          ${tsRow("Instances of Force Majeure","War, hostilities, invasion; rebellion, terrorism, revolution, insurrection; riot or civil commotion by third parties; strike or lockout not involving Contractor&rsquo;s personnel; munitions or ionizing radiation; natural catastrophes (earthquake, tsunami, volcanic activity, hurricane, typhoon); pandemic, epidemic, famine, or plague.")}
          ${tsRow("Contractor&rsquo;s Entitlement due to Force Majeure","Extension of time")}
          ${tsRow("Termination for Convenience by Client","Client may terminate by written notice at least 60 days prior to intended termination date. Contractor entitled to: (a) Costs of all accomplished works and delivered materials; (b) Costs in anticipation of works; (c) Other reasonably incurred costs; (d) Demobilization costs; (e) 15% of remaining unconstructed portion (subject to mutual agreement).")}
          ${tsRow("Dispute Resolution","Amicable settlement &rarr; Mediation (PDRCI) &rarr; Arbitration (CIAC)")}
          ${tsRow("Set-Off","Client shall not be allowed to set-off any amount due to the Contractor on any other project against money due to the Contractor on this project.")}
          ${tsRow("Indemnity","Contractor shall indemnify, defend and hold harmless the Client for any and all claims, losses, liabilities, damages, interests, and attorney&rsquo;s fees by a third party arising out of or in relation to the acts or omissions of the Contractor resulting to: (a) personal physical injury or death; (b) damage to tangible personal property; (c) material breach of Contract. Contractor&rsquo;s total liability shall not exceed the Contract Price, save for personal injury/death or deliberate negligent acts.")}
        </tbody>
      </table>
      <table class="ptbl" style="margin-top:6px">
        <thead><tr><th colspan="2" style="text-align:left">COMPLETION</th></tr></thead>
        <tbody>
          ${tsRow("Issuance of Certificate of Completion and Acceptance (&ldquo;COCA&rdquo;)","Client to issue the COCA to Contractor within 7 days from the completion of the final inspection")}
          ${tsRow(`Defects Liability Period (&ldquo;DLP&rdquo;)`,`${awarPtd.warranty_period||12} month(s) commencing from the date of the issuance of COCA`)}
          ${tsRow("Certificate of Final Acceptance (&ldquo;COFA&rdquo;) and release of Contractor&rsquo;s DLP","Client to issue COFA within 7 days from the expiration of the Defects Liability Period.")}
        </tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:36px">
        <tr>
          ${sigBlock(awarVInfo?.full_name||"[Contractor]"+" &mdash; By", awarVInfo?.authorized_representative||awarVInfo?.contact_person||"________________________", awarVInfo?.representative_title||"General Manager","")}
          ${sigBlock(gf.clientCompany+" &mdash; By", gf.endorsedByName||"________________________", gf.endorsedByTitle,"")}
        </tr>
      </table>`;

    return { page2, page3, page4 };
  };

  const generateRFADocument = (gf) => {
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

Expected: `✓ built in X.XXs` — no errors.

---

### Task 5: Refactor `generateRFADocument` → `printDocument(gf, bodies)`

**Files:**
- Modify: `src/App.jsx` — the `generateRFADocument` function body

- [ ] **Step 1: Change function signature**

Find:
```js
  const generateRFADocument = (gf) => {
    localStorage.setItem("rfaGenForm", JSON.stringify(gf));
```

Replace with:
```js
  const printDocument = (gf, bodies) => {
    localStorage.setItem("rfaGenForm", JSON.stringify(gf));
```

- [ ] **Step 2: Replace pages 2, 3, 4 template blocks with body wrappers**

Find the comment and `page2` const (lines ~6788–6845):
```js
    // ── PAGE 2: NOA / NTP ────────────────────────────────────────────────────
    const page2 = `
    <div class="pg pb">
      ${letterhead()}
      ${(()=>{
```

And everything through:
```js
      <div class="pg-num">Page 2 of 4</div>
    </div>`;

    // ── PAGE 3: Contract Agreement ───────────────────────────────────────────
    const page3 = `
    <div class="pg pb">
      ${letterhead()}
```

And everything through:
```js
      <div class="pg-num">Page 3 of 4</div>
    </div>`;

    // ── PAGE 4: Term Sheet ───────────────────────────────────────────────────
    const tsRow = (label, value) =>
      `<tr><td style="width:38%;font-weight:600;background:#fafafa">${label}</td><td>${value}</td></tr>`;

    const page4 = `
    <div class="pg pb">
      ${letterhead()}
```

And everything through:
```js
      <div class="pg-num">Page 4 of 4</div>
    </div>`;
```

Replace ALL of that (pages 2, 3, 4 template definitions) with:

```js
    // ── PAGES 2–4: use pre-built bodies ─────────────────────────────────────
    const page2 = `<div class="pg pb">${letterhead()}${bodies.page2}<div class="pg-num">Page 2 of 4</div></div>`;
    const page3 = `<div class="pg pb">${letterhead()}${bodies.page3}<div class="pg-num">Page 3 of 4</div></div>`;
    const page4 = `<div class="pg pb">${letterhead()}${bodies.page4}<div class="pg-num">Page 4 of 4</div></div>`;
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```

Expected: `✓ built in X.XXs` — no errors. (The old "Generate & Print" button still calls `generateRFADocument` which no longer exists — this will produce a build error. That's expected. We'll fix it in Task 8.)

If build fails ONLY on `generateRFADocument is not defined` — that's expected, skip to Task 6.
If it fails on anything else, fix those errors first.

---

### Task 6: Add `issueDocument()` and `printIssuedDoc(record)` functions

**Files:**
- Modify: `src/App.jsx` — add both functions after `printDocument`, just before `const addItem = `

- [ ] **Step 1: Add both functions**

Find:
```js
  const addItem = (slot, pid) => setVendors(
```

Replace with:
```js
  const issueDocument = async () => {
    const nextRevNo = (issuedDocs[0]?.revision_no || 0) + 1;
    const bodies = {
      page2: page2EditRef.current?.innerHTML || "",
      page3: page3EditRef.current?.innerHTML || "",
      page4: page4EditRef.current?.innerHTML || "",
    };
    const { error } = await supabase.from("rfa_documents").insert({
      pr_id: pr?.id,
      doc_type: genForm.docType || "NOA+NTP",
      revision_no: nextRevNo,
      revision_comment: nextRevNo === 1 ? null : revisionComment || null,
      page2_html: bodies.page2,
      page3_html: bodies.page3,
      page4_html: bodies.page4,
      gen_form_snapshot: genForm,
      issued_at: new Date().toISOString(),
    });
    if (error) { alert("Failed to save: " + error.message); return; }
    const { data: docs } = await supabase.from("rfa_documents").select("*").eq("pr_id", pr?.id).order("revision_no", { ascending: false });
    setIssuedDocs(docs || []);
    setRevisionComment("");
    setShowPreviewModal(false);
    setShowGenModal(false);
    printDocument(genForm, bodies);
  };

  const printIssuedDoc = (record) => {
    const snapshot = record.gen_form_snapshot || {};
    printDocument(snapshot, {
      page2: record.page2_html || "",
      page3: record.page3_html || "",
      page4: record.page4_html || "",
    });
  };

  const addItem = (slot, pid) => setVendors(
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

Expected: `✓ built in X.XXs` (or still fails on `generateRFADocument` call — that's fixed in Task 8).

---

### Task 7: Add "Issued Documents" section JSX

**Files:**
- Modify: `src/App.jsx` — rename existing top bar button (~line 7131), add section after top bar close div (~line 7140)

- [ ] **Step 1: Rename the existing "Generate Package" top-bar button**

Find (lines ~7131–7135):
```jsx
          <button style={{ ...styles.btnSecondary, display: "flex", alignItems: "center", gap: 5 }}
            onClick={() => { setGenForm(f => ({ ...f, projectAddress: pr?.projects?.address || f.projectAddress || "" })); setShowGenModal(true); fetchBuLogo(genForm.clientCompany); }}
>
            📄 Generate Package
          </button>
```

Replace with:
```jsx
          <button style={{ ...styles.btnSecondary, display: "flex", alignItems: "center", gap: 5 }}
            onClick={() => { setGenForm(f => ({ ...f, projectAddress: pr?.projects?.address || f.projectAddress || "" })); setShowGenModal(true); fetchBuLogo(genForm.clientCompany); }}>
            📄 Generate / Revise
          </button>
```

- [ ] **Step 2: Add section after `</div>` that closes the top bar**

Find:
```jsx
      {/* ── Generate Package Modal ── */}
      {showGenModal && (() => {
```

Replace with:
```jsx
      {/* ── Issued Documents Section ── */}
      {(pr?.id) && (
        <div style={{ margin:"0 0 16px", padding:"14px 18px", background:C.offWhite, border:`1px solid ${C.border}`, borderRadius:10 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: issuedDocs.length > 0 ? 12 : 0 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:C.textPri }}>Issued Documents</div>
            <button style={{ ...styles.btnSecondary, fontSize:11, padding:"5px 12px", display:"flex", alignItems:"center", gap:5 }}
              onClick={() => { setGenForm(f => ({ ...f, projectAddress: pr?.projects?.address || f.projectAddress || "" })); setShowGenModal(true); fetchBuLogo(genForm.clientCompany); }}>
              📄 Generate / Revise
            </button>
          </div>
          {issuedDocs.length === 0 && (
            <div style={{ fontSize:11, color:C.textTer, fontStyle:"italic" }}>No documents issued yet — click Generate / Revise to create the first issuance.</div>
          )}
          {issuedDocs.map((doc, idx) => {
            const isCurrent = idx === 0;
            const fmtDate = d => d ? new Date(d).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—";
            return (
              <div key={doc.id} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"10px 0", borderTop:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                    <span style={{ background: isCurrent ? C.coral : "#e0e0e0", color: isCurrent ? "#fff" : "#888", fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:10 }}>
                      v{doc.revision_no} · {isCurrent ? "Current" : "Superseded"}
                    </span>
                    <span style={{ fontSize:11, color: isCurrent ? C.textPri : C.textTer, fontWeight: isCurrent ? 600 : 400 }}>
                      {doc.doc_type === "NOA+NTP" ? "NOA + NTP" : doc.doc_type} · Contract Agreement · Term Sheet
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:C.textTer }}>
                    {fmtDate(doc.issued_at)}{doc.revision_comment ? ` · ${doc.revision_comment}` : " · Initial issuance"}
                  </div>
                </div>
                <button style={{ ...styles.btnSecondary, fontSize:10, padding:"4px 10px", flexShrink:0, marginLeft:12 }}
                  onClick={() => printIssuedDoc(doc)}>
                  🖨 Print
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Generate Package Modal ── */}
      {showGenModal && (() => {
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```

Expected: `✓ built in X.XXs` (or still the `generateRFADocument` error — fixed in Task 8).

---

### Task 8: Add Preview & Edit Modal + fix "Generate & Print" button

**Files:**
- Modify: `src/App.jsx` — add modal JSX after the generate modal closing brace, and change the "Generate & Print" button

**Step 1: Change "Generate & Print" to "Preview & Edit" in the generate modal footer**

- [ ] Find (~line 7233):
```jsx
                  📄 Generate &amp; Print
```

The button that contains this text looks like:
```jsx
                <button style={styles.btnPrimary} onClick={() => { generateRFADocument(genForm); setShowGenModal(false); }}>
                  📄 Generate &amp; Print
                </button>
```

Read 5 lines around line 7228 to find the exact onClick handler text, then replace the full button with:
```jsx
                <button style={styles.btnPrimary} onClick={() => { setShowGenModal(false); setShowPreviewModal(true); }}>
                  👁 Preview &amp; Edit
                </button>
```

- [ ] **Step 2: Add the Preview & Edit modal JSX**

Find the closing of the generate modal:
```jsx
      {/* end showGenModal */}
```

If that comment doesn't exist, find the `})()}` that closes the generate modal IIFE and the `}` that closes `showGenModal &&`. Add the preview modal immediately after.

Insert the following block after the generate modal closing:

```jsx
      {/* ── Preview & Edit Modal ── */}
      {showPreviewModal && (() => {
        const tabs = [
          { key: "page2", label: "NOA/NTP Letter",     ref: page2EditRef },
          { key: "page3", label: "Contract Agreement", ref: page3EditRef },
          { key: "page4", label: "Term Sheet",         ref: page4EditRef },
        ];
        const isRevision = issuedDocs.length > 0;
        const nextRevNo  = (issuedDocs[0]?.revision_no || 0) + 1;
        const canIssue   = !isRevision || revisionComment.trim().length > 0;

        // Initialize contenteditable content
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (!showPreviewModal) return;
          const latest = issuedDocs[0];
          const bodies = latest
            ? { page2: latest.page2_html || "", page3: latest.page3_html || "", page4: latest.page4_html || "" }
            : buildPageBodies(genForm);
          if (page2EditRef.current) page2EditRef.current.innerHTML = bodies.page2;
          if (page3EditRef.current) page3EditRef.current.innerHTML = bodies.page3;
          if (page4EditRef.current) page4EditRef.current.innerHTML = bodies.page4;
          setPreviewTab("page2");
          setRevisionComment("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [showPreviewModal]);

        const execCmd = (cmd) => { document.execCommand(cmd, false, null); };
        const today = new Date().toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" });
        const fmtDate = d => d ? new Date(d).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—";
        const awarV    = vendors.find(v => v.slot === awardedSlot);
        const awarVi   = awarV ? vendors.indexOf(awarV) : -1;
        const awarVc   = awarVi >= 0 ? vComputed[awarVi] : null;

        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#fff", borderRadius:12, width:"92vw", maxWidth:1100, height:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>

              {/* Header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                <div style={{ fontWeight:700, fontSize:14, color:C.textPri }}>Preview &amp; Edit — RFA No. {rfaNumber||"—"}</div>
                <button type="button" onClick={() => setShowPreviewModal(false)}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.textTer, lineHeight:1 }}>✕</button>
              </div>

              {/* Tab bar */}
              <div style={{ display:"flex", background:C.offWhite, borderBottom:`2px solid ${C.border}`, flexShrink:0, padding:"0 16px" }}>
                {tabs.map(t => (
                  <button type="button" key={t.key}
                    onClick={() => setPreviewTab(t.key)}
                    style={{ padding:"9px 16px", border:"none", borderBottom: previewTab===t.key ? `2px solid ${C.coral}` : "2px solid transparent",
                      marginBottom:-2, background:"transparent", cursor:"pointer", fontSize:11, fontWeight:600,
                      color: previewTab===t.key ? C.coral : C.textSec }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Toolbar */}
              <div style={{ display:"flex", alignItems:"center", gap:4, padding:"6px 16px", background:"#fafafa", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                {[["bold","B","bold"],["italic","I","italic"],["underline","U","underline"]].map(([cmd,lbl,style]) => (
                  <button type="button" key={cmd} onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                    style={{ padding:"3px 9px", border:`1px solid ${C.border}`, borderRadius:4, background:"#fff", cursor:"pointer",
                      fontWeight:style==="bold"?"700":"400", fontStyle:style==="italic"?"italic":"normal",
                      textDecoration:style==="underline"?"underline":"none", fontSize:11, color:C.textPri }}>
                    {lbl}
                  </button>
                ))}
                <div style={{ width:1, height:16, background:C.border, margin:"0 4px" }} />
                {[["undo","↩ Undo"],["redo","↪ Redo"]].map(([cmd,lbl]) => (
                  <button type="button" key={cmd} onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                    style={{ padding:"3px 9px", border:`1px solid ${C.border}`, borderRadius:4, background:"#fff", cursor:"pointer", fontSize:10, color:C.textSec }}>
                    {lbl}
                  </button>
                ))}
                <div style={{ marginLeft:"auto", fontSize:9, color:C.textTer, fontStyle:"italic" }}>Click any text to edit</div>
              </div>

              {/* Content area — scrollable */}
              <div style={{ flex:1, overflowY:"auto", background:"#f0f0f0", padding:"24px" }}>
                <div style={{ background:"#fff", maxWidth:700, margin:"0 auto", borderRadius:8, boxShadow:"0 1px 6px rgba(0,0,0,0.1)", overflow:"hidden" }}>

                  {/* Locked letterhead */}
                  <div style={{ background:"#f8f8f8", padding:"12px 20px", borderBottom:`1px solid ${C.border}`, position:"relative" }}
                    contentEditable={false}>
                    <div style={{ position:"absolute", top:6, right:8, fontSize:8, background:"#e8e8e8", color:"#999", padding:"1px 6px", borderRadius:10 }}>🔒 locked</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", paddingBottom:10, borderBottom:`2px solid ${C.coral}` }}>
                      {buLogoUrl
                        ? <img src={buLogoUrl} style={{ height:42, width:"auto", objectFit:"contain", maxWidth:120 }} alt="logo" />
                        : <div style={{ width:88, height:38, border:"1.5px dashed #bbb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#bbb", letterSpacing:"0.07em", textTransform:"uppercase" }}>Logo</div>
                      }
                      <div style={{ textAlign:"right", fontSize:8.5, color:"#555", lineHeight:1.6 }}>
                        <div style={{ fontWeight:700, color:"#111", fontSize:9 }}>{genForm.clientCompany}</div>
                        <div>{today}</div>
                        <div>RFA No. {rfaNumber||"—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Editable body — one div per tab, only active is visible */}
                  {tabs.map(t => (
                    <div key={t.key}
                      ref={t.ref}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      style={{ padding:"20px", minHeight:300, outline:"none", fontSize:10, lineHeight:1.65, display: previewTab===t.key ? "block" : "none",
                        border: previewTab===t.key ? `2px dashed ${C.coralLight}` : "none" }}
                    />
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", borderTop:`1px solid ${C.border}`, background:"#fafafa", flexShrink:0, gap:12 }}>
                <div style={{ fontSize:10, color:C.textTer }}>
                  {isRevision
                    ? `Last issued: ${fmtDate(issuedDocs[0]?.issued_at)} (v${issuedDocs[0]?.revision_no})`
                    : "No previous issuance for this RFA"}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {isRevision && (
                    <input
                      type="text"
                      placeholder="Reason for revision (required)"
                      value={revisionComment}
                      onChange={e => setRevisionComment(e.target.value)}
                      style={{ fontSize:10, padding:"5px 10px", border:`1px solid ${C.border}`, borderRadius:6, width:260, outline:"none" }}
                    />
                  )}
                  <button type="button" style={styles.btnGhost} onClick={() => setShowPreviewModal(false)}>Cancel</button>
                  <button type="button" style={{ ...styles.btnPrimary, opacity: canIssue ? 1 : 0.5, cursor: canIssue ? "pointer" : "default" }}
                    disabled={!canIssue}
                    onClick={issueDocument}>
                    {isRevision ? `Issue Revision (v${nextRevNo})` : "Issue Document (v1)"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```

Expected: `✓ built in X.XXs` — no errors. The chunk-size warning is pre-existing, not an error.

---

### Task 9: Final integration test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173`.

- [ ] **Step 2: Verify first issuance flow**

1. Navigate to an RFA that has an awarded vendor.
2. Confirm the **"Issued Documents"** section appears below the top bar (shows "No documents issued yet").
3. Click **"📄 Generate / Revise"** → generate form modal opens.
4. Fill in required fields, click **"👁 Preview & Edit"** → preview modal opens.
5. Confirm three tabs (NOA/NTP Letter, Contract Agreement, Term Sheet) are present.
6. Confirm the letterhead (logo + company + date + RFA#) shows with 🔒 badge and is not editable.
7. Confirm the letter body is editable — click into it, type something, select text and click **B** for bold.
8. Click **"Issue Document (v1)"** → modal closes, print window opens, Issued Documents section shows "v1 · Current".

- [ ] **Step 3: Verify revision flow**

1. Click **"📄 Generate / Revise"** again → gen form opens.
2. Click **"👁 Preview & Edit"** → preview modal shows v1 content pre-loaded.
3. Make a change, type a revision comment ("Test revision").
4. Click **"Issue Revision (v2)"** → modal closes, Issued Documents shows v2 Current + v1 Superseded.
5. Click **"🖨 Print"** on v1 → print window opens with v1 content.

- [ ] **Step 4: Build final production check**

```bash
npm run build
```

Expected: `✓ built in X.XXs` — no errors.

---

## Verification Checklist

- [ ] `rfa_documents` table exists in Supabase with correct schema
- [ ] `useRef` is imported
- [ ] `issuedDocs` fetched on RFA load, pre-warms logo from latest snapshot
- [ ] `buildPageBodies(gf)` returns `{ page2, page3, page4 }` body HTML matching existing document content
- [ ] `printDocument(gf, bodies)` replaces `generateRFADocument` — page 1 unchanged, pages 2–4 use provided bodies
- [ ] `issueDocument()` inserts to DB, refreshes list, opens print window
- [ ] `printIssuedDoc(record)` opens print window with stored content
- [ ] "Issued Documents" section: empty state, list with revision badges, per-record Print button
- [ ] Preview modal: 3 tabs, toolbar (B/I/U + Undo/Redo), locked letterhead, editable body
- [ ] First issuance: footer shows "No previous issuance", button says "Issue Document (v1)"
- [ ] Revision: revision comment input required, button says "Issue Revision (vN)", disabled until comment entered
- [ ] Generate form "Generate & Print" → "Preview & Edit"
- [ ] Build passes with no errors
