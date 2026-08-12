# RFQ (Request for Quotation) Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a PR is approved, auto-create an RFQ. CO/CM edit and send the RFQ to vendors via unique token links. Vendors submit proposals through a public form. Vendor responses auto-populate the existing RFA with deviation highlights.

**Architecture:**
- New Supabase tables: `rfqs`, `rfq_vendors`, `rfq_submissions`
- New pages in `src/App.jsx`: `RFQListPage`, `RFQDetailPage` (CO/CM editing + vendor management)
- New route in `src/VendorApp.jsx`: `/vendor/rfq/:token` (public vendor submission form)
- PR approval handlers in `PRDetailPage` trigger auto-RFQ INSERT
- RFA auto-populated from `rfq_submissions` when vendor submits; deviations highlighted in comparison table

**Tech Stack:** React 19, Vite 8, Supabase PostgREST, CSS-in-JS inline styles, existing `C` color tokens and `styles` object

> **Note:** This codebase has no test suite. Each task uses browser verification in place of automated tests. All code goes into `src/App.jsx` (admin side) or `src/VendorApp.jsx` (vendor portal). No new files are created unless explicitly stated.

---

## File Map

| File | Change |
|---|---|
| `src/App.jsx` | New: `RFQListPage`, `RFQDetailPage` components; modified: approval handlers, PRDetailPage UI, RFA comparison table, nav/pageMap |
| `src/VendorApp.jsx` | New route + `VendorRFQPage` component for public token-based submission |
| Supabase (manual SQL) | New tables: `rfqs`, `rfq_vendors`, `rfq_submissions` |

---

## Task 1 — Supabase Schema

**Files:** Supabase SQL editor (manual step, no code file)

- [ ] **Step 1: Run this SQL in the Supabase dashboard SQL editor**

```sql
-- RFQ master record
create table rfqs (
  id              bigint primary key generated always as identity,
  rfq_number      text not null unique,
  pr_id           bigint references purchase_requests(id),
  status          text not null default 'Draft',
  -- status values: Draft | Open | Closed | Awarded
  work_duration   integer,          -- calendar days, pre-filled from PR
  payment_term_type text,           -- same enum as rfa_vendors.payment_term_type
  payment_term_data jsonb,          -- same shape as rfa_vendors.payment_term_data
  contract_terms  jsonb,            -- { warranty_months, perf_bond_pct, defects_liability_months, ld_rate, retention_pct, payment_currency }
  deadline        timestamptz,      -- vendor submission deadline
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Vendors invited per RFQ
create table rfq_vendors (
  id              bigint primary key generated always as identity,
  rfq_id          bigint references rfqs(id) on delete cascade,
  vendor_id       bigint,           -- null for ad-hoc vendors
  vendor_name     text not null,
  vendor_email    text not null,
  token           uuid not null default gen_random_uuid() unique,
  is_active       boolean not null default true,
  is_adhoc        boolean not null default false,
  opened_at       timestamptz,
  submitted_at    timestamptz,
  created_at      timestamptz default now()
);

-- Vendor proposal submissions
create table rfq_submissions (
  id                        bigint primary key generated always as identity,
  rfq_vendor_id             bigint references rfq_vendors(id) on delete cascade,
  rfq_id                    bigint references rfqs(id),
  quoted_amount             numeric,
  -- null = accept RFQ value; non-null = deviation
  proposed_work_duration    integer,
  proposed_payment_term_type text,
  proposed_payment_term_data jsonb,
  proposed_contract_terms   jsonb,   -- only terms they propose to change
  notes                     text,
  submitted_at              timestamptz default now()
);

-- Enable Row Level Security (permissive for now — tighten later)
alter table rfqs          enable row level security;
alter table rfq_vendors   enable row level security;
alter table rfq_submissions enable row level security;

create policy "allow all" on rfqs          for all using (true) with check (true);
create policy "allow all" on rfq_vendors   for all using (true) with check (true);
create policy "allow all" on rfq_submissions for all using (true) with check (true);
```

- [ ] **Step 2: Verify in Supabase Table Editor** — confirm all three tables exist with the correct columns.

---

## Task 2 — Auto-create RFQ on PR Approval

**Files:** `src/App.jsx` — `handleApproveBudgeted` (~line 1634) and `handleApproveUnbudgeted` (~line 1677)

Both approval paths set `status: "Approved"`. After each UPDATE succeeds, we INSERT an RFQ row pre-filled from the PR.

- [ ] **Step 1: Add `autoCreateRFQ` helper just before `handleApproveBudgeted`**

```js
const autoCreateRFQ = async (prData) => {
  const year = new Date().getFullYear();
  const { count } = await supabase.from("rfqs").select("id", { count: "exact", head: true });
  const rfqNumber = `RFQ-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
  // Derive work_duration from PR start/end dates
  let workDuration = null;
  if (prData?.start_date && prData?.end_date) {
    const diff = new Date(prData.end_date) - new Date(prData.start_date);
    workDuration = Math.round(diff / (1000 * 60 * 60 * 24));
  }
  await supabase.from("rfqs").insert({
    rfq_number: rfqNumber,
    pr_id: prId,
    status: "Draft",
    work_duration: workDuration,
    payment_term_type: "",
    payment_term_data: defaultPtData(),
    contract_terms: {
      warranty_months: 12,
      perf_bond_pct: 10,
      defects_liability_months: 12,
      ld_rate: DEFAULT_LD,
      retention_pct: 10,
      payment_currency: "PHP",
    },
    created_by: profile?.id || null,
  });
};
```

- [ ] **Step 2: Call `autoCreateRFQ(pr)` in `handleApproveBudgeted`** — add after the `await supabase.from("purchase_requests").update(...)` line and before `setA1Uploading(false)`:

```js
await autoCreateRFQ(pr);
```

- [ ] **Step 3: Call `autoCreateRFQ(pr)` in `handleApproveUnbudgeted`** — add after the UPDATE and before `await fetchPR()`:

```js
await autoCreateRFQ(pr);
```

- [ ] **Step 4: Browser verify** — approve a test PR, then check the Supabase `rfqs` table. Confirm one row was inserted with the correct `pr_id`, `rfq_number`, and `work_duration`.

---

## Task 3 — PRDetailPage: Replace "Create RFA" with "View RFQ" Badge

**Files:** `src/App.jsx` — PRDetailPage section (~line 1560)

- [ ] **Step 1: Add `linkedRFQ` state and fetch it in `fetchPR`**

In the state block near line 1489, add:
```js
const [linkedRFQ, setLinkedRFQ] = useState(null);
```

At the end of `fetchPR`, after `setLoading(false)`, add:
```js
const { data: rfqRow } = await supabase
  .from("rfqs").select("id, rfq_number, status")
  .eq("pr_id", prId).order("created_at", { ascending: false }).limit(1).maybeSingle();
if (rfqRow) setLinkedRFQ(rfqRow);
```

- [ ] **Step 2: Replace the "Create RFA" button with a "View RFQ" badge** — find `canCreateRFA` usage in the PRDetailPage render and replace the button:

```jsx
{/* If RFQ exists, show its status badge and link */}
{linkedRFQ ? (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ fontSize: 12, color: C.textSec }}>RFQ:</span>
    <button
      onClick={() => { setSelectedRFQId(linkedRFQ.id); setPage("rfq_detail"); }}
      style={{ background: C.tealBg, border: `1px solid ${C.tealText}40`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, color: C.tealText, cursor: "pointer" }}>
      {linkedRFQ.rfq_number} · {linkedRFQ.status}
    </button>
  </div>
) : canCreateRFA ? (
  <button onClick={handleCreateRFA} style={styles.btnPrimary}>Create RFA</button>
) : null}
```

- [ ] **Step 3: Add `selectedRFQId` state and `rfq_detail` to `pageMap`** in the main `App` function (near the other page state variables and the `pageMap` object). Add the state:

```js
const [selectedRFQId, setSelectedRFQId] = useState(null);
```

Add to `pageMap`:
```js
rfq_detail: <RFQDetailPage profile={profile} rfqId={selectedRFQId} setPage={setPage} />,
```

And pass `setSelectedRFQId` down to `PRDetailPage` in the `pageMap` where PRDetailPage is rendered.

- [ ] **Step 4: Browser verify** — open an approved PR. Confirm the "View RFQ" badge appears with the correct RFQ number and status. Clicking it should navigate (even if `RFQDetailPage` doesn't exist yet — a stub `function RFQDetailPage() { return <div>TODO</div>; }` is fine for now).

---

## Task 4 — RFQ List Page

**Files:** `src/App.jsx` — new `RFQListPage` component; nav/pageMap

This is the "RFQ Tab" — a list of all RFQs with status filters, mirroring the existing RFA list style.

- [ ] **Step 1: Add `RFQListPage` component** — insert after the existing `// ─── RFA LIST ───` section:

```js
// ─── RFQ LIST PAGE ────────────────────────────────────────────────────────────
function RFQListPage({ profile, setPage, setSelectedRFQId }) {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const canManage = can(profile, "pr.review"); // CO / CM / D&C Head

  useEffect(() => {
    supabase.from("rfqs")
      .select("id, rfq_number, status, deadline, created_at, purchase_requests(pr_number, projects(name))")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRfqs(data || []); setLoading(false); });
  }, []);

  const statusColor = (s) => ({
    Draft:   { bg: C.offWhite,  text: C.textSec },
    Open:    { bg: C.tealBg,    text: C.tealText },
    Closed:  { bg: C.amberBg,   text: C.amberText },
    Awarded: { bg: C.greenBg,   text: C.greenText },
  }[s] || { bg: C.offWhite, text: C.textSec });

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.textSec }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px" }}>
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HamburgerBtn />
          <span style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>Requests for Quotation</span>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: 10, margin: "16px 0", flexWrap: "wrap" }}>
        {["Draft","Open","Closed","Awarded"].map(s => {
          const n = rfqs.filter(r => r.status === s).length;
          const sc = statusColor(s);
          return (
            <div key={s} style={{ background: sc.bg, color: sc.text, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600 }}>
              {s}: {n}
            </div>
          );
        })}
      </div>

      {rfqs.length === 0 ? (
        <div style={{ ...styles.card, textAlign: "center", padding: 40, color: C.textTer }}>No RFQs yet. They are created automatically when a PR is approved.</div>
      ) : (
        <div style={styles.card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                {["RFQ #","PR #","Project","Status","Deadline",""].map(h => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rfqs.map((r, i) => {
                const sc = statusColor(r.status);
                return (
                  <tr key={r.id}
                    onClick={() => { setSelectedRFQId(r.id); setPage("rfq_detail"); }}
                    style={{ borderBottom: i < rfqs.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer" }}
                    onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                    onMouseOut={e => e.currentTarget.style.background = ""}>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: C.coral, fontFamily: "monospace" }}>{r.rfq_number}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec, fontFamily: "monospace" }}>{r.purchase_requests?.pr_number || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: C.textPri }}>{r.purchase_requests?.projects?.name || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: sc.bg, color: sc.text, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: r.deadline ? C.textPri : C.textTer }}>
                      {r.deadline ? new Date(r.deadline).toLocaleDateString() : "Not set"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <span style={{ fontSize: 12, color: C.coral }}>View →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add nav item and pageMap entry** — in the nav items array add `{ key: "rfq_list", label: "RFQ" }` (visible to CO/CM). In pageMap add:

```js
rfq_list: <RFQListPage profile={profile} setPage={setPage} setSelectedRFQId={setSelectedRFQId} />,
```

- [ ] **Step 3: Browser verify** — navigate to the RFQ tab. Confirm the list loads and rows are clickable. Confirm status chips show correct counts.

---

## Task 5 — RFQ Detail / Edit Page

**Files:** `src/App.jsx` — new `RFQDetailPage` component

This is the main editing interface for CO/CM: view PR info, edit work duration + payment terms + contract terms, manage vendor list, and send.

- [ ] **Step 1: Add `RFQDetailPage` component** — insert after `RFQListPage`:

```js
// ─── RFQ DETAIL PAGE ──────────────────────────────────────────────────────────
function RFQDetailPage({ profile, rfqId, setPage }) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [rfq, setRfq]           = useState(null);
  const [pr, setPr]             = useState(null);
  const [rfqVendors, setRfqVendors] = useState([]);

  // Editable fields
  const [workDuration, setWorkDuration]       = useState("");
  const [ptType, setPtType]                   = useState("");
  const [ptData, setPtData]                   = useState(defaultPtData());
  const [contractTerms, setContractTerms]     = useState({
    warranty_months: 12, perf_bond_pct: 10,
    defects_liability_months: 12, ld_rate: DEFAULT_LD,
    retention_pct: 10, payment_currency: "PHP",
  });
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes]       = useState("");
  const [activeTab, setActiveTab] = useState("details");

  // Add vendor form
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [accreditedVendors, setAccreditedVendors] = useState([]);
  const [vendorMode, setVendorMode]   = useState("accredited"); // "accredited" | "adhoc"
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [adhocName, setAdhocName]     = useState("");
  const [adhocEmail, setAdhocEmail]   = useState("");

  const canEdit = can(profile, "pr.review"); // CO / CM

  useEffect(() => { fetchRFQ(); }, [rfqId]);

  const fetchRFQ = async () => {
    setLoading(true);
    const { data } = await supabase.from("rfqs")
      .select("*, purchase_requests(pr_number, description, start_date, end_date, projects(name, business_unit, project_code))")
      .eq("id", rfqId).single();
    if (data) {
      setRfq(data);
      setPr(data.purchase_requests);
      setWorkDuration(data.work_duration || "");
      setPtType(data.payment_term_type || "");
      setPtData({ ...defaultPtData(), ...(data.payment_term_data || {}) });
      setContractTerms({ warranty_months: 12, perf_bond_pct: 10, defects_liability_months: 12, ld_rate: DEFAULT_LD, retention_pct: 10, payment_currency: "PHP", ...(data.contract_terms || {}) });
      setDeadline(data.deadline ? data.deadline.split("T")[0] : "");
      setNotes(data.notes || "");
    }
    const { data: vs } = await supabase.from("rfq_vendors").select("*").eq("rfq_id", rfqId).order("created_at");
    setRfqVendors(vs || []);
    const { data: av } = await supabase.from("vendors")
      .select("id, accreditation_status, vendor_company_info(company_name, rfq_email)")
      .eq("accreditation_status", "Accredited");
    setAccreditedVendors(av || []);
    setLoading(false);
  };

  const saveRFQ = async () => {
    setSaving(true);
    await supabase.from("rfqs").update({
      work_duration: workDuration ? parseInt(workDuration) : null,
      payment_term_type: ptType,
      payment_term_data: ptData,
      contract_terms: contractTerms,
      deadline: deadline || null,
      notes,
      updated_at: new Date().toISOString(),
    }).eq("id", rfqId);
    setSaving(false);
    await fetchRFQ();
  };

  const addVendor = async () => {
    const isAdhoc = vendorMode === "adhoc";
    let name = adhocName, email = adhocEmail, vendorId = null;
    if (!isAdhoc) {
      const av = accreditedVendors.find(v => String(v.id) === String(selectedVendorId));
      name  = av?.vendor_company_info?.company_name || "";
      email = av?.vendor_company_info?.rfq_email || "";
      vendorId = av?.id || null;
    }
    if (!name || !email) { alert("Please provide vendor name and email."); return; }
    await supabase.from("rfq_vendors").insert({
      rfq_id: rfqId, vendor_id: vendorId,
      vendor_name: name, vendor_email: email,
      is_adhoc: isAdhoc, is_active: true,
    });
    setShowAddVendor(false); setAdhocName(""); setAdhocEmail(""); setSelectedVendorId("");
    await fetchRFQ();
  };

  const toggleVendorActive = async (vId, current) => {
    await supabase.from("rfq_vendors").update({ is_active: !current }).eq("id", vId);
    await fetchRFQ();
  };

  const sendRFQ = async () => {
    if (rfqVendors.filter(v => v.is_active).length === 0) { alert("Add at least one vendor before sending."); return; }
    if (!deadline) { alert("Please set a submission deadline before sending."); return; }
    const confirm = window.confirm(`Send RFQ ${rfq?.rfq_number} to ${rfqVendors.filter(v => v.is_active).length} vendor(s)?`);
    if (!confirm) return;
    setSaving(true);
    // Mark as Open
    await supabase.from("rfqs").update({ status: "Open", updated_at: new Date().toISOString() }).eq("id", rfqId);
    // TODO: trigger email via Supabase Edge Function or SMTP integration
    // For now, we surface the unique links in the UI so CO/CM can copy and share manually
    setSaving(false);
    await fetchRFQ();
    alert("RFQ marked as Open. Copy vendor links below and share them.");
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.textSec }}>Loading…</div>;

  const tabs = ["details", "vendors", "submissions"];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HamburgerBtn />
          <button onClick={() => setPage("rfq_list")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.coral }}>← RFQ List</button>
          <span style={{ color: C.textTer }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.textPri, fontFamily: "monospace" }}>{rfq?.rfq_number}</span>
          <span style={styles.badge(rfq?.status || "Draft")}>{rfq?.status}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canEdit && rfq?.status === "Draft" && (
            <>
              <button onClick={saveRFQ} disabled={saving} style={styles.btnSecondary}>{saving ? "Saving…" : "Save"}</button>
              <button onClick={sendRFQ} disabled={saving} style={styles.btnPrimary}>Send to Vendors</button>
            </>
          )}
        </div>
      </div>

      {/* PR Info card */}
      <div style={{ ...styles.card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>PR Reference</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: C.textSec }}>PR Number</div><div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: C.coral }}>{pr?.pr_number}</div></div>
          <div><div style={{ fontSize: 11, color: C.textSec }}>Project</div><div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>{pr?.projects?.name}</div></div>
          <div><div style={{ fontSize: 11, color: C.textSec }}>Business Unit</div><div style={{ fontSize: 13, color: C.textPri }}>{pr?.projects?.business_unit || "—"}</div></div>
          <div><div style={{ fontSize: 11, color: C.textSec }}>Description</div><div style={{ fontSize: 13, color: C.textPri }}>{pr?.description}</div></div>
          <div><div style={{ fontSize: 11, color: C.textSec }}>PR Start → End</div><div style={{ fontSize: 12, color: C.textPri }}>{pr?.start_date ? new Date(pr.start_date).toLocaleDateString() : "—"} → {pr?.end_date ? new Date(pr.end_date).toLocaleDateString() : "—"}</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "9px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: activeTab === t ? 700 : 400, color: activeTab === t ? C.coral : C.textSec, borderBottom: activeTab === t ? `2px solid ${C.coral}` : "2px solid transparent", textTransform: "capitalize" }}>
            {t === "details" ? "RFQ Details" : t === "vendors" ? `Vendors (${rfqVendors.length})` : "Submissions"}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === "details" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Work Duration + Deadline */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Schedule</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={styles.label}>Work Duration (calendar days) <span style={{ color: C.coral }}>*</span></label>
                <input type="number" min="1" value={workDuration} onChange={e => setWorkDuration(e.target.value)} disabled={!canEdit || rfq?.status !== "Draft"}
                  style={styles.input} />
                <p style={styles.hint}>Pre-filled from PR dates. Vendors may propose a different duration.</p>
              </div>
              <div>
                <label style={styles.label}>Submission Deadline <span style={{ color: C.coral }}>*</span></label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} disabled={!canEdit || rfq?.status !== "Draft"}
                  style={styles.input} />
              </div>
            </div>
          </div>

          {/* Payment Terms — uses existing PT components */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Payment Terms <span style={{ fontSize: 12, fontWeight: 400, color: C.textSec }}>(suggested — vendors may propose their own)</span></h3>
            <div>
              <label style={styles.label}>Payment Term Type</label>
              <select value={ptType} onChange={e => setPtType(e.target.value)} disabled={!canEdit || rfq?.status !== "Draft"} style={styles.input}>
                <option value="">— Select —</option>
                <option value="dp_progress_retention">DP + Progress + Retention</option>
                <option value="progress_retention">Progress + Retention</option>
                <option value="progress_only">Progress Only</option>
                <option value="full_turnkey">Full Turnkey</option>
                <option value="full_turnkey_retention">Full Turnkey + Retention</option>
                <option value="milestone">Milestone</option>
              </select>
            </div>
            {ptType && (
              <div style={{ marginTop: 12 }}>
                {PT_HAS_DP.has(ptType) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={styles.label}>Downpayment %</label>
                      <input type="number" min="0" max="100" value={ptData.dp_percent || ""} onChange={e => setPtData(p => ({ ...p, dp_percent: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
                    </div>
                  </div>
                )}
                {PT_HAS_PROGRESS.has(ptType) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={styles.label}>Performance Bond %</label>
                      <input type="number" value={ptData.performance_bond_percent || ""} onChange={e => setPtData(p => ({ ...p, performance_bond_percent: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
                    </div>
                  </div>
                )}
                {PT_HAS_RETENTION.has(ptType) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={styles.label}>Retention %</label>
                      <input type="number" value={ptData.retention_percent || ""} onChange={e => setPtData(p => ({ ...p, retention_percent: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contract Terms */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Contract Terms <span style={{ fontSize: 12, fontWeight: 400, color: C.textSec }}>(suggested — vendors may propose their own)</span></h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={styles.label}>Warranty (months)</label>
                <input type="number" min="0" value={contractTerms.warranty_months} onChange={e => setContractTerms(p => ({ ...p, warranty_months: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
              </div>
              <div>
                <label style={styles.label}>Performance Bond (%)</label>
                <input type="number" min="0" value={contractTerms.perf_bond_pct} onChange={e => setContractTerms(p => ({ ...p, perf_bond_pct: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
              </div>
              <div>
                <label style={styles.label}>Defects Liability (months)</label>
                <input type="number" min="0" value={contractTerms.defects_liability_months} onChange={e => setContractTerms(p => ({ ...p, defects_liability_months: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
              </div>
              <div>
                <label style={styles.label}>Retention (%)</label>
                <input type="number" min="0" value={contractTerms.retention_pct} onChange={e => setContractTerms(p => ({ ...p, retention_pct: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
              </div>
              <div>
                <label style={styles.label}>Payment Currency</label>
                <input type="text" value={contractTerms.payment_currency} onChange={e => setContractTerms(p => ({ ...p, payment_currency: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Liquidated Damages Rate</label>
                <input type="text" value={contractTerms.ld_rate} onChange={e => setContractTerms(p => ({ ...p, ld_rate: e.target.value }))} style={styles.input} disabled={!canEdit || rfq?.status !== "Draft"} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Notes / Instructions to Vendors</h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} style={{ ...styles.input, resize: "vertical" }} disabled={!canEdit || rfq?.status !== "Draft"} placeholder="Additional instructions for vendors…" />
          </div>
        </div>
      )}

      {/* ── Vendors Tab ── */}
      {activeTab === "vendors" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {canEdit && rfq?.status === "Draft" && (
            <button onClick={() => setShowAddVendor(true)} style={{ ...styles.btnPrimary, alignSelf: "flex-start" }}>+ Add Vendor</button>
          )}

          {rfqVendors.length === 0 && (
            <div style={{ ...styles.card, textAlign: "center", padding: 32, color: C.textTer }}>No vendors added yet.</div>
          )}

          {rfqVendors.map(v => {
            const token = v.token;
            const link = `${window.location.origin}/vendor/rfq/${token}`;
            return (
              <div key={v.id} style={{ ...styles.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: v.is_active ? C.textPri : C.textTer }}>{v.vendor_name} {v.is_adhoc && <span style={{ fontSize: 10, color: C.amberText, background: C.amberBg, borderRadius: 4, padding: "1px 6px", marginLeft: 4 }}>Ad-hoc</span>}</div>
                  <div style={{ fontSize: 12, color: C.textSec }}>{v.vendor_email}</div>
                  <div style={{ fontSize: 11, marginTop: 4, display: "flex", gap: 10 }}>
                    <span style={{ color: v.opened_at ? C.tealText : C.textTer }}>{v.opened_at ? `Opened ${new Date(v.opened_at).toLocaleDateString()}` : "Not opened"}</span>
                    <span style={{ color: v.submitted_at ? C.greenText : C.textTer }}>{v.submitted_at ? `Submitted ${new Date(v.submitted_at).toLocaleDateString()}` : "Not submitted"}</span>
                  </div>
                  {rfq?.status !== "Draft" && (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <input readOnly value={link} style={{ fontSize: 11, fontFamily: "monospace", color: C.coral, background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 6px", width: 320 }} />
                      <button onClick={() => navigator.clipboard.writeText(link)} style={{ fontSize: 11, color: C.coral, background: "none", border: `1px solid ${C.coral}40`, borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>Copy</button>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => toggleVendorActive(v.id, v.is_active)}
                    style={{ fontSize: 11, color: v.is_active ? C.redText : C.greenText, background: v.is_active ? C.redBg : C.greenBg, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
                    {v.is_active ? "Deactivate Link" : "Re-open Link"}
                  </button>
                )}
              </div>
            );
          })}

          {/* Add vendor modal */}
          {showAddVendor && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 440, maxWidth: "90vw" }}>
                <h3 style={{ ...styles.cardTitle, marginBottom: 16 }}>Add Vendor</h3>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {["accredited","adhoc"].map(m => (
                    <button key={m} onClick={() => setVendorMode(m)}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: `1px solid ${vendorMode === m ? C.coral : C.border}`, background: vendorMode === m ? C.coralLight : "#fff", color: vendorMode === m ? C.coral : C.textSec, fontWeight: vendorMode === m ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                      {m === "accredited" ? "Accredited Vendor" : "Ad-hoc"}
                    </button>
                  ))}
                </div>
                {vendorMode === "accredited" ? (
                  <div>
                    <label style={styles.label}>Select Vendor</label>
                    <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} style={styles.input}>
                      <option value="">— Select —</option>
                      {accreditedVendors.map(v => (
                        <option key={v.id} value={v.id}>{v.vendor_company_info?.company_name || `Vendor ${v.id}`}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={styles.label}>Company Name</label>
                      <input value={adhocName} onChange={e => setAdhocName(e.target.value)} style={styles.input} placeholder="e.g. ABC Construction" />
                      <p style={{ fontSize: 11, color: C.amberText, marginTop: 4 }}>⚠ Ad-hoc vendors cannot be awarded until accreditation is complete.</p>
                    </div>
                    <div>
                      <label style={styles.label}>Email Address</label>
                      <input type="email" value={adhocEmail} onChange={e => setAdhocEmail(e.target.value)} style={styles.input} placeholder="vendor@email.com" />
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button onClick={addVendor} style={{ ...styles.btnPrimary, flex: 1 }}>Add</button>
                  <button onClick={() => setShowAddVendor(false)} style={{ ...styles.btnSecondary, flex: 1 }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Submissions Tab ── */}
      {activeTab === "submissions" && (
        <SubmissionsTab rfqId={rfqId} rfq={rfq} rfqVendors={rfqVendors} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `SubmissionsTab` stub** — insert just before `RFQDetailPage` (it'll be completed in Task 7):

```js
function SubmissionsTab({ rfqId, rfq, rfqVendors }) {
  const [submissions, setSubmissions] = useState([]);
  useEffect(() => {
    supabase.from("rfq_submissions").select("*, rfq_vendors(vendor_name, is_adhoc)")
      .eq("rfq_id", rfqId).then(({ data }) => setSubmissions(data || []));
  }, [rfqId]);

  if (submissions.length === 0) {
    return <div style={{ ...styles.card, textAlign: "center", padding: 32, color: C.textTer }}>No submissions yet.</div>;
  }
  return (
    <div style={{ color: C.textSec, fontSize: 13 }}>
      {submissions.length} submission(s) received. Comparison table coming in Task 7.
    </div>
  );
}
```

- [ ] **Step 3: Browser verify** — open an RFQ from the list. Confirm Details tab shows pre-filled fields. Confirm Vendors tab lets you add an accredited or ad-hoc vendor. Confirm Save button works (check Supabase `rfqs` row is updated).

---

## Task 6 — Vendor Submission Page (VendorApp)

**Files:** `src/VendorApp.jsx`

Public page at `/vendor/rfq/:token`. No login required — the token IS the auth. Tracks `opened_at` on load and `submitted_at` on submit.

- [ ] **Step 1: Read current `VendorApp.jsx` router** to understand existing route pattern

- [ ] **Step 2: Add route** — in the VendorApp router, detect `/vendor/rfq/` path and render `VendorRFQPage`:

```js
// In VendorApp routing logic — detect token from path
const rfqToken = window.location.pathname.match(/\/vendor\/rfq\/([^/]+)/)?.[1];
if (rfqToken) return <VendorRFQPage token={rfqToken} />;
```

- [ ] **Step 3: Add `VendorRFQPage` component** in `VendorApp.jsx`:

```js
function VendorRFQPage({ token }) {
  const [loading, setLoading]     = useState(true);
  const [rfqVendor, setRfqVendor] = useState(null);
  const [rfq, setRfq]             = useState(null);
  const [pr, setPr]               = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Vendor's proposed values (null = accept RFQ value)
  const [quotedAmount, setQuotedAmount]       = useState("");
  const [deviateWorkDur, setDeviateWorkDur]   = useState(false);
  const [proposedWorkDur, setProposedWorkDur] = useState("");
  const [deviatePT, setDeviatePT]             = useState(false);
  const [proposedPTType, setProposedPTType]   = useState("");
  const [proposedPTData, setProposedPTData]   = useState({});
  const [deviateTerms, setDeviateTerms]       = useState({});     // { warranty_months: true, ... }
  const [proposedTerms, setProposedTerms]     = useState({});     // { warranty_months: "6", ... }
  const [vendorNotes, setVendorNotes]         = useState("");

  useEffect(() => {
    const load = async () => {
      // Look up vendor by token
      const { data: vRow } = await supabase.from("rfq_vendors")
        .select("*, rfqs(*, purchase_requests(pr_number, description, start_date, end_date, projects(name, business_unit)))")
        .eq("token", token).maybeSingle();

      if (!vRow) { setLoading(false); return; }

      // Mark as opened (only set once)
      if (!vRow.opened_at) {
        await supabase.from("rfq_vendors").update({ opened_at: new Date().toISOString() }).eq("id", vRow.id);
      }

      if (vRow.submitted_at) setAlreadySubmitted(true);
      if (!vRow.is_active)   setAlreadySubmitted(true); // treat inactive as closed

      setRfqVendor(vRow);
      setRfq(vRow.rfqs);
      setPr(vRow.rfqs?.purchase_requests);
      setLoading(false);
    };
    load();
  }, [token]);

  const handleSubmit = async () => {
    if (!quotedAmount) { alert("Please enter your quoted amount."); return; }
    setSubmitting(true);
    await supabase.from("rfq_submissions").insert({
      rfq_vendor_id: rfqVendor.id,
      rfq_id: rfq.id,
      quoted_amount: parseFloat(quotedAmount),
      proposed_work_duration: deviateWorkDur ? parseInt(proposedWorkDur) : null,
      proposed_payment_term_type: deviatePT ? proposedPTType : null,
      proposed_payment_term_data: deviatePT ? proposedPTData : null,
      proposed_contract_terms: Object.keys(deviateTerms).filter(k => deviateTerms[k]).length > 0
        ? Object.fromEntries(Object.keys(deviateTerms).filter(k => deviateTerms[k]).map(k => [k, proposedTerms[k]]))
        : null,
      notes: vendorNotes || null,
    });
    await supabase.from("rfq_vendors").update({ submitted_at: new Date().toISOString() }).eq("id", rfqVendor.id);
    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) return <div style={{ padding: 60, textAlign: "center" }}>Loading…</div>;

  if (!rfqVendor || !rfq) return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Link not found</div>
      <div style={{ color: "#888" }}>This link may be invalid or has expired.</div>
    </div>
  );

  if (!rfqVendor.is_active && !alreadySubmitted) return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>This link has been deactivated</div>
      <div style={{ color: "#888" }}>Please contact the project team if you believe this is an error.</div>
    </div>
  );

  if (submitted || alreadySubmitted) return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{submitted ? "Proposal submitted!" : "Already submitted"}</div>
      <div style={{ color: "#888" }}>Thank you for your response to {rfq.rfq_number}.</div>
    </div>
  );

  const ct = rfq.contract_terms || {};
  const termKeys = ["warranty_months","perf_bond_pct","defects_liability_months","ld_rate","retention_pct","payment_currency"];
  const termLabels = { warranty_months: "Warranty (months)", perf_bond_pct: "Performance Bond (%)", defects_liability_months: "Defects Liability (months)", ld_rate: "Liquidated Damages Rate", retention_pct: "Retention (%)", payment_currency: "Payment Currency" };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#ED6055", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{rfq.rfq_number}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E", margin: "0 0 6px" }}>Request for Quotation</h1>
        <div style={{ fontSize: 13, color: "#6B6B6B" }}>{pr?.projects?.name} · {pr?.description}</div>
        {rfq.deadline && <div style={{ fontSize: 12, color: "#FF3B30", marginTop: 4, fontWeight: 600 }}>Submission deadline: {new Date(rfq.deadline).toLocaleDateString()}</div>}
      </div>

      {/* RFQ Terms Summary */}
      <div style={{ background: "#F2F2F7", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginBottom: 14 }}>Required Terms</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><div style={{ fontSize: 11, color: "#6B6B6B" }}>Work Duration</div><div style={{ fontSize: 13, fontWeight: 600 }}>{rfq.work_duration ? `${rfq.work_duration} calendar days` : "—"}</div></div>
          <div><div style={{ fontSize: 11, color: "#6B6B6B" }}>Payment Type</div><div style={{ fontSize: 13, fontWeight: 600 }}>{rfq.payment_term_type || "—"}</div></div>
          {termKeys.filter(k => k !== "ld_rate").map(k => (
            <div key={k}><div style={{ fontSize: 11, color: "#6B6B6B" }}>{termLabels[k]}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{ct[k] ?? "—"}</div></div>
          ))}
          <div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 11, color: "#6B6B6B" }}>Liquidated Damages</div><div style={{ fontSize: 12 }}>{ct.ld_rate || "—"}</div></div>
        </div>
      </div>

      {/* Quoted Amount */}
      <div style={{ background: "#fff", border: "1px solid #E5E5EA", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>Your Quoted Amount (PHP) <span style={{ color: "#ED6055" }}>*</span></label>
        <input type="number" min="0" value={quotedAmount} onChange={e => setQuotedAmount(e.target.value)}
          style={{ width: "100%", padding: "10px 14px", fontSize: 16, border: "1px solid #E5E5EA", borderRadius: 8, fontFamily: "monospace", boxSizing: "border-box" }} placeholder="0.00" />
      </div>

      {/* Work Duration deviation */}
      <div style={{ background: "#fff", border: "1px solid #E5E5EA", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Work Duration</div>
            <div style={{ fontSize: 12, color: "#6B6B6B" }}>Required: {rfq.work_duration ? `${rfq.work_duration} calendar days` : "Not specified"}</div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#ED6055", cursor: "pointer" }}>
            <input type="checkbox" checked={deviateWorkDur} onChange={e => setDeviateWorkDur(e.target.checked)} />
            Propose different duration
          </label>
        </div>
        {deviateWorkDur && (
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, color: "#6B6B6B", display: "block", marginBottom: 4 }}>Your proposed duration (calendar days)</label>
            <input type="number" min="1" value={proposedWorkDur} onChange={e => setProposedWorkDur(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #E5E5EA", borderRadius: 8, fontSize: 13, width: 140 }} />
          </div>
        )}
      </div>

      {/* Contract Terms deviation */}
      <div style={{ background: "#fff", border: "1px solid #E5E5EA", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Contract Terms</div>
        {termKeys.map(k => (
          <div key={k} style={{ borderTop: "1px solid #F2F2F7", paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{termLabels[k]}</div>
                <div style={{ fontSize: 12, color: "#6B6B6B" }}>Required: {ct[k] ?? "—"}</div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#ED6055", cursor: "pointer" }}>
                <input type="checkbox" checked={!!deviateTerms[k]} onChange={e => setDeviateTerms(p => ({ ...p, [k]: e.target.checked }))} />
                Propose different
              </label>
            </div>
            {deviateTerms[k] && (
              <div style={{ marginTop: 8 }}>
                <input value={proposedTerms[k] || ""} onChange={e => setProposedTerms(p => ({ ...p, [k]: e.target.value }))}
                  style={{ padding: "8px 12px", border: "1px solid #E5E5EA", borderRadius: 8, fontSize: 13, width: "100%", boxSizing: "border-box" }}
                  placeholder={`Your proposed ${termLabels[k].toLowerCase()}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      <div style={{ background: "#fff", border: "1px solid #E5E5EA", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>Notes / Remarks (optional)</label>
        <textarea value={vendorNotes} onChange={e => setVendorNotes(e.target.value)} rows={4}
          style={{ width: "100%", padding: "10px 14px", border: "1px solid #E5E5EA", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
      </div>

      <button onClick={handleSubmit} disabled={submitting}
        style={{ width: "100%", padding: "14px 0", background: "#ED6055", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        {submitting ? "Submitting…" : "Submit Proposal"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Browser verify** — add a vendor to a test RFQ, open their link `/vendor/rfq/<token>`, confirm: page loads with RFQ terms, `opened_at` is set in `rfq_vendors`, submission creates a row in `rfq_submissions` and sets `submitted_at`, link shows "Already submitted" on second visit.

---

## Task 7 — RFA Integration: Auto-populate from Submissions + Deviation Highlights

**Files:** `src/App.jsx` — `SubmissionsTab`, `RFAFormPage` load logic, comparison table

When a vendor submits, their response should auto-populate an `rfa_vendors` row in the linked RFA. The RFA comparison table gets a "Required" first column showing RFQ baseline values, with deviation cells highlighted.

- [ ] **Step 1: Replace `SubmissionsTab` stub** with full comparison table:

```js
function SubmissionsTab({ rfqId, rfq, rfqVendors }) {
  const [submissions, setSubmissions] = useState([]);
  useEffect(() => {
    supabase.from("rfq_submissions")
      .select("*, rfq_vendors(vendor_name, is_adhoc)")
      .eq("rfq_id", rfqId)
      .then(({ data }) => setSubmissions(data || []));
  }, [rfqId]);

  if (submissions.length === 0) {
    return <div style={{ ...styles.card, textAlign: "center", padding: 32, color: C.textTer }}>No submissions yet.</div>;
  }

  const ct = rfq?.contract_terms || {};

  const devCell = (required, proposed) => {
    const isDeviation = proposed !== null && proposed !== undefined && String(proposed) !== String(required);
    return (
      <td style={{ padding: "8px 12px", fontSize: 12, background: isDeviation ? C.amberBg : "transparent", color: isDeviation ? C.amberText : C.textPri, fontWeight: isDeviation ? 700 : 400 }}>
        {proposed !== null && proposed !== undefined ? (
          <>
            {String(proposed)}
            {isDeviation && <span style={{ display: "block", fontSize: 10, fontWeight: 400, color: C.textSec }}>Required: {String(required)}</span>}
          </>
        ) : (
          <span style={{ color: C.greenText, fontSize: 11 }}>✓ Accept</span>
        )}
      </td>
    );
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
        <thead>
          <tr style={{ background: C.offWhite }}>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.05em", width: 160 }}>Term</th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.tealText, background: C.tealBg }}>Required (RFQ)</th>
            {submissions.map(s => (
              <th key={s.id} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textPri }}>
                {s.rfq_vendors?.vendor_name}
                {s.rfq_vendors?.is_adhoc && <span style={{ display: "block", fontSize: 10, color: C.amberText, fontWeight: 400 }}>Ad-hoc</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { label: "Quoted Amount", req: "—", vals: submissions.map(s => s.quoted_amount ? `₱${Number(s.quoted_amount).toLocaleString()}` : "—"), isAmount: true },
            { label: "Work Duration", req: rfq?.work_duration ? `${rfq.work_duration} days` : "—", vals: submissions.map(s => s.proposed_work_duration ? `${s.proposed_work_duration} days` : null) },
            { label: "Payment Type", req: rfq?.payment_term_type || "—", vals: submissions.map(s => s.proposed_payment_term_type || null) },
            { label: "Warranty (mo.)", req: ct.warranty_months ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.warranty_months ?? null) },
            { label: "Perf. Bond %", req: ct.perf_bond_pct ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.perf_bond_pct ?? null) },
            { label: "Defects Liab. (mo.)", req: ct.defects_liability_months ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.defects_liability_months ?? null) },
            { label: "Retention %", req: ct.retention_pct ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.retention_pct ?? null) },
            { label: "LD Rate", req: ct.ld_rate ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.ld_rate ?? null) },
            { label: "Currency", req: ct.payment_currency ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.payment_currency ?? null) },
          ].map((row, i) => (
            <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : C.offWhite }}>
              <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.textSec }}>{row.label}</td>
              <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.tealText, background: C.tealBg }}>{String(row.req)}</td>
              {row.vals.map((v, vi) => row.isAmount
                ? <td key={vi} style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: C.textPri }}>{v}</td>
                : devCell(row.req, v)
              )}
            </tr>
          ))}
          {/* Vendor notes row */}
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.textSec }}>Notes</td>
            <td style={{ padding: "8px 12px", fontSize: 12, color: C.textTer }}>—</td>
            {submissions.map(s => (
              <td key={s.id} style={{ padding: "8px 12px", fontSize: 12, color: C.textSec }}>{s.notes || "—"}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Auto-populate RFA when vendor submits** — in `handleSubmit` inside `VendorRFQPage` (VendorApp.jsx), after the `rfq_submissions` insert, trigger RFA population:

```js
// After submission insert — auto-populate or create RFA
const { data: rfaRows } = await supabase.from("rfas")
  .select("id").eq("pr_id", rfq.pr_id).order("created_at", { ascending: false }).limit(1);
let rfaId = rfaRows?.[0]?.id;

if (!rfaId) {
  // Create RFA if none exists yet
  const year = new Date().getFullYear();
  const { count } = await supabase.from("rfas").select("id", { count: "exact", head: true }).eq("pr_id", rfq.pr_id);
  const rfaNumber = `${String(rfq.pr_id).padStart(4,"0")}-RFA-${(count||0)+1}`;
  const { data: newRFA } = await supabase.from("rfas").insert({
    pr_id: rfq.pr_id,
    rfa_number: rfaNumber,
    status: "Draft",
    created_by: null,
  }).select("id").single();
  rfaId = newRFA?.id;
}

if (rfaId) {
  // Count existing vendor slots to assign next slot
  const { count: slotCount } = await supabase.from("rfa_vendors").select("id", { count: "exact", head: true }).eq("rfa_id", rfaId);
  const slot = (slotCount || 0) + 1;
  // Map vendor submission into rfa_vendors row
  await supabase.from("rfa_vendors").insert({
    rfa_id: rfaId,
    slot,
    vendor_id: null,
    participation_status: "Submitted",
    payment_term_type: quotedAmount && !deviatePT ? (rfq.payment_term_type || "") : (proposedPTType || rfq.payment_term_type || ""),
    payment_term_data: JSON.stringify({ __vendor_id: rfqVendor.vendor_id, ...(deviatePT ? proposedPTData : (rfq.payment_term_data || {})) }),
    completion_date: rfq.purchase_requests?.end_date || "",
    liquidated_damages: proposedTerms.ld_rate || rfq.contract_terms?.ld_rate || DEFAULT_LD,
    remarks: vendorNotes || "",
    proposals: [{ items: [], amount: parseFloat(quotedAmount) || 0, notes: vendorNotes || "" }],
  });
}
```

- [ ] **Step 3: Browser verify** — submit a vendor proposal via the token link. Open the RFA Form page for the linked PR. Confirm the vendor appears as a proposal row. Confirm the Submissions tab in RFQ Detail shows the deviation-highlighted comparison table.

---

## Self-Review Checklist

- [ ] All approval paths (`handleApproveBudgeted`, `handleApproveUnbudgeted`) create an RFQ
- [ ] `rfq_number` is unique and follows `RFQ-YYYY-NNNN` format
- [ ] Token links correctly track `opened_at` and `submitted_at`
- [ ] Inactive links show a "deactivated" message to the vendor
- [ ] Ad-hoc vendors are flagged in the comparison table
- [ ] Deviations are highlighted in amber in the Submissions tab
- [ ] RFA vendor row is inserted on first submission; subsequent submissions add new slots
- [ ] The "Create RFA" button is replaced by "View RFQ" badge on approved PRs
- [ ] RFQ list shows correct status counts
- [ ] Save and Send buttons are hidden when RFQ status is not Draft
