# Vendor Self-Accreditation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow vendors to self-submit their accreditation details and documents via a public link or admin-generated invite link, eliminating the need for admin manual data entry.

**Architecture:** Two entry points — a public open-application page (`/vendor/accreditation/apply`) and an admin-generated invite link (`/vendor/accreditation/:token`). Both land on the same `VendorAccreditationPage` component in `VendorApp.jsx`. On submission, a `vendors` row + `vendor_company_info` row + `vendor_documents` rows are created in Supabase and files uploaded to the `vendor-documents` storage bucket. Admins review and approve/return submissions using the existing Vendors page (no change to that flow). Returned vendors revisit their link to see the return reason and resubmit.

**Tech Stack:** React 19, Supabase PostgREST + Storage, CSS-in-JS inline styles matching VendorApp's `C`/`S` token objects.

---

## Files

- **Modify:** `src/VendorApp.jsx` — add `VendorAccreditationPage` component and route detection
- **Modify:** `src/App.jsx` — add "Generate Invite Link" button + modal to `VendorsPage`

---

## Task 1: DB migration + storage bucket

**Files:**
- No code files — SQL run in Supabase dashboard + storage bucket created manually

- [ ] **Step 1: Run this SQL in Supabase SQL editor**

```sql
create table vendor_accreditation_tokens (
  id         uuid primary key default gen_random_uuid(),
  token      uuid unique not null default gen_random_uuid(),
  vendor_id  uuid references vendors(id) on delete set null,
  invited_email text,
  created_by uuid references profiles(id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Create storage bucket in Supabase dashboard**

Go to Storage → New bucket → Name: `vendor-documents` → Public: **yes** → Save.

Then add a policy: Storage → vendor-documents → Policies → New policy → "Allow all" (for now, since submissions are unauthenticated):
```sql
-- INSERT policy (for uploads)
create policy "Allow anonymous uploads"
on storage.objects for insert
with check (bucket_id = 'vendor-documents');

-- SELECT policy (for public reads)
create policy "Allow public reads"
on storage.objects for select
using (bucket_id = 'vendor-documents');
```

- [ ] **Step 3: Confirm**

Confirm both the table and bucket exist before moving to Task 2.

---

## Task 2: `VendorAccreditationPage` in VendorApp.jsx

**Files:**
- Modify: `src/VendorApp.jsx`

This is the largest task. Add the full self-accreditation form as a standalone page component, then wire up route detection at the top of `VendorApp`.

### Step 1: Add route detection at top of VendorApp

- [ ] In `VendorApp.jsx`, find the block near line 2018:
```js
const rfqToken = window.location.pathname.match(/\/vendor\/rfq\/([^/]+)/)?.[1];
if (rfqToken) return <VendorRFQPage token={rfqToken} />;
```

Add BEFORE that block:
```js
const accToken = window.location.pathname.match(/\/vendor\/accreditation\/([^/]+)/)?.[1];
if (accToken && accToken !== "apply") return <VendorAccreditationPage token={accToken} />;
if (window.location.pathname === "/vendor/accreditation/apply") return <VendorAccreditationPage token={null} />;
```

### Step 2: Define ACCREDITATION_DOCS constant

- [ ] Add this constant near the top of `VendorApp.jsx` (after the `S` styles object, around line 80):

```js
const ACCREDITATION_DOCS = [
  "Company Profile",
  "Organizational Chart",
  "PCAB License",
  "OR & Sales Invoice",
  "List of Clients",
  "List of Equipment",
  "DTI / SEC Certificate",
  "General Information Sheet",
  "Articles of Incorporation",
  "Secretary Certificate",
  "By-laws",
  "Municipality / Mayor's Permit",
  "BIR/VAT Registration",
  "Two (2) Valid Government IDs",
  "Location Sketch (Office/Store/Warehouse)",
  "Letter of Intent",
  "ISO Compliance Certificate (if available)",
  "Audited Financial Statement (2 years)",
  "Certificate of Good Credit Standing",
  "Copy of ITR Previous Year",
  "Sample Purchase Order / Job Order (5 Major Clients)",
];
```

### Step 3: Add `VendorAccreditationPage` component

- [ ] Add this full component BEFORE `// ─── ROOT VENDOR APP ───` (the `export default function VendorApp()` block):

```jsx
// ─── VENDOR ACCREDITATION PAGE ───────────────────────────────────────────────
function VendorAccreditationPage({ token }) {
  // token = null means open application; token = uuid string means invite link

  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [tokenRow, setTokenRow]     = useState(null);   // vendor_accreditation_tokens row
  const [existingVendor, setExistingVendor] = useState(null); // vendors row if resubmitting
  const [existingDocs, setExistingDocs]     = useState([]);   // vendor_documents rows

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  // Return state
  const [isReturned, setIsReturned] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");

  // Company info form
  const [form, setForm] = useState({
    company_name: "",
    primary_activity: "",
    registered_address: "",
    telephone: "",
    cell_number: "",
    rfq_email: "",
    contact_person: "",
    contact_position: "",
    authorized_representative: "",
    representative_title: "",
    remarks: "",
  });

  // Document uploads — { [docType]: File | null }
  const [docFiles, setDocFiles] = useState({});
  // Track already-uploaded docs for returning vendors — { [docType]: { url, name } }
  const [uploadedDocs, setUploadedDocs] = useState({});

  useEffect(() => { load(); }, [token]);

  const load = async () => {
    if (token) {
      // Invite link — load token row
      const { data: tRow } = await supabase
        .from("vendor_accreditation_tokens")
        .select("*, vendors(*, vendor_company_info(*))")
        .eq("token", token)
        .maybeSingle();

      if (!tRow) { setNotFound(true); setLoading(false); return; }
      setTokenRow(tRow);

      // If vendor already linked (previous submission), pre-fill form
      if (tRow.vendor_id && tRow.vendors) {
        const v = tRow.vendors;
        const ci = v.vendor_company_info;
        setExistingVendor(v);
        setIsReturned(v.accreditation_status === "Returned");
        setReturnNotes(v.return_notes || "");
        if (ci) {
          setForm({
            company_name: ci.company_name || "",
            primary_activity: ci.primary_activity || "",
            registered_address: ci.registered_address || "",
            telephone: ci.telephone || "",
            cell_number: ci.cell_number || "",
            rfq_email: ci.rfq_email || (tRow.invited_email || ""),
            contact_person: ci.contact_person || "",
            contact_position: ci.contact_position || "",
            authorized_representative: ci.authorized_representative || "",
            representative_title: ci.representative_title || "",
            remarks: ci.remarks || "",
          });
        }
        // Load existing uploaded docs
        const { data: docs } = await supabase
          .from("vendor_documents")
          .select("document_type, file_url, file_name")
          .eq("vendor_id", tRow.vendor_id);
        const docMap = {};
        (docs || []).forEach(d => { docMap[d.document_type] = { url: d.file_url, name: d.file_name }; });
        setUploadedDocs(docMap);
      } else if (tRow.invited_email) {
        setForm(f => ({ ...f, rfq_email: tRow.invited_email }));
      }
    }
    // Open application: no pre-fill
    setLoading(false);
  };

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleDocFile = (docType, file) => {
    setDocFiles(p => ({ ...p, [docType]: file }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    // Validate required company fields
    const required = ["company_name", "primary_activity", "registered_address", "cell_number", "rfq_email", "contact_person", "authorized_representative"];
    const missing = required.filter(k => !form[k].trim());
    if (missing.length > 0) {
      alert("Please fill in all required fields:\n• " + missing.map(k => k.replace(/_/g, " ")).join("\n• "));
      return;
    }

    setSubmitting(true);

    let vendorId = existingVendor?.id || null;

    // Create or update vendors row
    if (!vendorId) {
      const { data: vRow, error: vErr } = await supabase
        .from("vendors")
        .insert({ accreditation_status: "Submitted", profile_id: null })
        .select("id")
        .single();
      if (vErr || !vRow) {
        alert("Submission failed: " + (vErr?.message || "unknown error"));
        setSubmitting(false);
        return;
      }
      vendorId = vRow.id;
    } else {
      await supabase.from("vendors").update({
        accreditation_status: "Submitted",
        return_notes: null,
      }).eq("id", vendorId);
    }

    // Upsert vendor_company_info
    const ciPayload = {
      vendor_id: vendorId,
      company_name: form.company_name.trim(),
      primary_activity: form.primary_activity.trim(),
      registered_address: form.registered_address.trim(),
      telephone: form.telephone.trim(),
      cell_number: form.cell_number.trim(),
      rfq_email: form.rfq_email.trim(),
      contact_person: form.contact_person.trim(),
      contact_position: form.contact_position.trim(),
      authorized_representative: form.authorized_representative.trim(),
      representative_title: form.representative_title.trim(),
      remarks: form.remarks.trim(),
    };
    const { data: existingCI } = await supabase
      .from("vendor_company_info")
      .select("id")
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (existingCI) {
      await supabase.from("vendor_company_info").update(ciPayload).eq("vendor_id", vendorId);
    } else {
      await supabase.from("vendor_company_info").insert(ciPayload);
    }

    // Upload new document files
    for (const docType of ACCREDITATION_DOCS) {
      const file = docFiles[docType];
      if (!file) continue;
      const ext = file.name.split(".").pop();
      const safeName = docType.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const path = `vendor-docs/${vendorId}/${safeName}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("vendor-documents").upload(path, file, { upsert: true });
      if (upErr) { console.error("Upload failed for", docType, upErr.message); continue; }
      const { data: urlData } = supabase.storage.from("vendor-documents").getPublicUrl(path);
      // Upsert vendor_documents row
      const { data: existingDoc } = await supabase
        .from("vendor_documents")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("document_type", docType)
        .maybeSingle();
      if (existingDoc) {
        await supabase.from("vendor_documents").update({
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
        }).eq("id", existingDoc.id);
      } else {
        await supabase.from("vendor_documents").insert({
          vendor_id: vendorId,
          document_type: docType,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_at: new Date().toISOString(),
        });
      }
    }

    // Link token to vendor (first submission via invite link)
    if (token && tokenRow && !tokenRow.vendor_id) {
      await supabase.from("vendor_accreditation_tokens").update({
        vendor_id: vendorId,
        used_at: new Date().toISOString(),
      }).eq("id", tokenRow.id);
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  // ── Render ──

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
      <div style={{ fontSize: 14, color: C.textSec }}>Loading…</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
      <div style={{ ...S.card, maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>Link not found</div>
        <div style={{ fontSize: 13, color: C.textSec }}>This accreditation link is invalid or has expired. Please contact the admin for a new link.</div>
      </div>
    </div>
  );

  if (submitted) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
      <div style={{ ...S.card, maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>
          {isReturned ? "Resubmission received!" : "Application submitted!"}
        </div>
        <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
          Thank you, <strong>{form.company_name}</strong>. Your accreditation application has been received and is under review. We will get in touch with you at <strong>{form.rfq_email}</strong>.
          {token && <><br /><br />You may revisit this link at any time to check your status.</>}
        </div>
      </div>
    </div>
  );

  // If already accredited, show status message
  if (existingVendor && existingVendor.accreditation_status === "Accredited") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
      <div style={{ ...S.card, maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.greenText, marginBottom: 8 }}>You are accredited!</div>
        <div style={{ fontSize: 13, color: C.textSec }}>
          <strong>{form.company_name}</strong> is an accredited vendor. No further action is needed at this time.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.offWhite, padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${C.coral}, ${C.coralDark})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>V</span>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>Vendor Accreditation</div>
          <div style={{ fontSize: 12, color: C.textSec }}>Self-Service Application Form</div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px 0" }}>

        {/* Return banner */}
        {isReturned && (
          <div style={{ background: C.amberBg, border: `1px solid ${C.amberText}40`, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amberText, marginBottom: 4 }}>Your application was returned for correction</div>
            <div style={{ fontSize: 13, color: C.amberText, whiteSpace: "pre-wrap" }}>{returnNotes}</div>
            <div style={{ fontSize: 12, color: C.amberText, marginTop: 8, opacity: 0.8 }}>Please update the information below and resubmit.</div>
          </div>
        )}

        {/* Intro */}
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 6 }}>
            {isReturned ? "Update Your Application" : "Accreditation Application"}
          </div>
          <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
            Complete all required fields and upload your supporting documents. Fields marked <span style={S.required}>*</span> are required.
          </div>
        </div>

        {/* Section 1 — Company Information */}
        <div style={S.card}>
          <div style={S.cardTitle}>Company Information</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>Company Name <span style={S.required}>*</span></label>
              <input value={form.company_name} onChange={e => setField("company_name", e.target.value)} style={S.input} placeholder="Registered company name" />
            </div>
            <div>
              <label style={S.label}>Primary Activity / Trade <span style={S.required}>*</span></label>
              <input value={form.primary_activity} onChange={e => setField("primary_activity", e.target.value)} style={S.input} placeholder="e.g. General Construction, Electrical Works" />
            </div>
            <div>
              <label style={S.label}>Registered Address <span style={S.required}>*</span></label>
              <textarea value={form.registered_address} onChange={e => setField("registered_address", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} placeholder="Full registered business address" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Telephone</label>
                <input value={form.telephone} onChange={e => setField("telephone", e.target.value)} style={S.input} placeholder="(02) 8xxx-xxxx" />
              </div>
              <div>
                <label style={S.label}>Cell Number <span style={S.required}>*</span></label>
                <input value={form.cell_number} onChange={e => setField("cell_number", e.target.value)} style={S.input} placeholder="09xxxxxxxxx" />
              </div>
            </div>
            <div>
              <label style={S.label}>Email Address <span style={S.required}>*</span></label>
              <input type="email" value={form.rfq_email} onChange={e => setField("rfq_email", e.target.value)} style={S.input} placeholder="company@email.com" />
              <p style={S.hint}>Used for RFQ invitations and notifications.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Contact Person <span style={S.required}>*</span></label>
                <input value={form.contact_person} onChange={e => setField("contact_person", e.target.value)} style={S.input} placeholder="Day-to-day coordinator" />
              </div>
              <div>
                <label style={S.label}>Contact Position</label>
                <input value={form.contact_position} onChange={e => setField("contact_position", e.target.value)} style={S.input} placeholder="e.g. Project Coordinator" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Authorized Representative <span style={S.required}>*</span></label>
                <input value={form.authorized_representative} onChange={e => setField("authorized_representative", e.target.value)} style={S.input} placeholder="Signs contracts and NOA" />
              </div>
              <div>
                <label style={S.label}>Representative Title</label>
                <input value={form.representative_title} onChange={e => setField("representative_title", e.target.value)} style={S.input} placeholder="e.g. General Manager" />
              </div>
            </div>
            <div>
              <label style={S.label}>Remarks / Additional Notes</label>
              <textarea value={form.remarks} onChange={e => setField("remarks", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} placeholder="Optional additional information" />
            </div>
          </div>
        </div>

        {/* Section 2 — Documents */}
        <div style={S.card}>
          <div style={S.cardTitle}>Supporting Documents</div>
          <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px", lineHeight: 1.6 }}>
            Upload as many documents as possible. Accepted formats: PDF, JPG, PNG, DOCX, XLSX. Max 10 MB per file. You can come back to this link and add missing documents later.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ACCREDITATION_DOCS.map(docType => {
              const file = docFiles[docType];
              const existing = uploadedDocs[docType];
              const hasFile = !!file || !!existing;
              return (
                <div key={docType} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px",
                  background: hasFile ? C.greenBg : C.offWhite,
                  border: `1px solid ${hasFile ? "#86EFAC" : C.border}`,
                  borderRadius: 10,
                  gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textPri }}>{docType}</div>
                    {file && <div style={{ fontSize: 11, color: C.greenText, marginTop: 2 }}>New: {file.name}</div>}
                    {!file && existing && (
                      <div style={{ fontSize: 11, color: C.tealText, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <span>Uploaded: {existing.name}</span>
                        <a href={existing.url} target="_blank" rel="noreferrer" style={{ color: C.coral, textDecoration: "none", fontWeight: 600 }}>View</a>
                      </div>
                    )}
                    {!file && !existing && <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>Not yet uploaded</div>}
                  </div>
                  <label style={{ cursor: "pointer", flexShrink: 0 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: hasFile ? C.greenText : C.coral,
                      border: `1px solid ${hasFile ? "#86EFAC" : C.coral}40`,
                      borderRadius: 6, padding: "4px 10px",
                      background: hasFile ? C.greenBg : C.coralLight,
                    }}>
                      {hasFile ? "Replace" : "Upload"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                      style={{ display: "none" }}
                      onChange={e => handleDocFile(docType, e.target.files[0] || null)}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%", padding: "14px 0",
            background: `linear-gradient(135deg, ${C.coral}, ${C.coralDark})`,
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1, fontFamily: "inherit",
            boxShadow: "0 4px 16px rgba(239,95,80,0.4)",
          }}
        >
          {submitting ? "Submitting…" : isReturned ? "Resubmit Application" : "Submit Application"}
        </button>

        <p style={{ fontSize: 11, color: C.textTer, textAlign: "center", marginTop: 12 }}>
          {/* TODO: replace with email notification once email provider is configured */}
          Your application will be reviewed by our team. You can revisit this link to check your status.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify route detection works**

Start dev server (`npm run dev`), visit `http://localhost:5173/vendor/accreditation/apply`. Confirm the accreditation form loads without a login prompt and without a blank page.

- [ ] **Step 5: Test open application submission**

Fill in all required fields on the form, upload at least one document, submit. In Supabase Table Editor, confirm:
- A new row in `vendors` with `accreditation_status = "Submitted"`
- A matching row in `vendor_company_info` with the correct data
- A row in `vendor_documents` with the uploaded file URL
- The file appears in Storage → vendor-documents bucket

---

## Task 3: "Generate Invite Link" button in VendorsPage (App.jsx)

**Files:**
- Modify: `src/App.jsx` — add state + modal + handler to `VendorsPage`

### Step 1: Add state variables to VendorsPage

- [ ] Find the state block at the top of `VendorsPage` (around line 5107). Add after `const [importing, setImporting] = useState(false);`:

```js
const [showInviteModal, setShowInviteModal] = useState(false);
const [inviteEmail, setInviteEmail]         = useState("");
const [inviteLink, setInviteLink]           = useState("");
const [inviteLoading, setInviteLoading]     = useState(false);
```

### Step 2: Add `handleGenerateInvite` function

- [ ] After `const confirmImport = async () => { ... };` (around line 5303), add:

```js
const handleGenerateInvite = async () => {
  if (!inviteEmail.trim()) { alert("Please enter the vendor's email address."); return; }
  setInviteLoading(true);
  const { data, error } = await supabase
    .from("vendor_accreditation_tokens")
    .insert({ invited_email: inviteEmail.trim(), created_by: profile.id })
    .select("token")
    .single();
  setInviteLoading(false);
  if (error || !data) { alert("Failed to generate link: " + (error?.message || "unknown error")); return; }
  const url = `${window.location.origin}/vendor/accreditation/${data.token}`;
  setInviteLink(url);
};
```

### Step 3: Add the "Generate Invite Link" button to the Vendors page header

- [ ] In the `VendorsPage` render, find the top bar buttons area (where `+ Quick Add Vendor` and the import label exist, around line 5343). Add before `+ Quick Add Vendor`:

```jsx
{canManage && (
  <button style={styles.btnSecondary} onClick={() => { setShowInviteModal(true); setInviteEmail(""); setInviteLink(""); }}>
    Generate Invite Link
  </button>
)}
```

### Step 4: Add the invite modal

- [ ] Find the closing `</>` at the end of `VendorsPage`'s return statement (just before the final `}`). Add the modal before it:

```jsx
{showInviteModal && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
      <h3 style={{ ...styles.cardTitle, marginBottom: 16 }}>Generate Vendor Accreditation Link</h3>
      {!inviteLink ? (
        <>
          <label style={styles.label}>Vendor Email Address <span style={{ color: C.coral }}>*</span></label>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGenerateInvite()}
            placeholder="vendor@company.com"
            style={{ ...styles.input, marginBottom: 16 }}
          />
          <p style={styles.hint}>A unique link will be generated. Send it to the vendor — they fill in their own details and upload documents.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={handleGenerateInvite} disabled={inviteLoading} style={{ ...styles.btnPrimary, flex: 1 }}>
              {inviteLoading ? "Generating…" : "Generate Link"}
            </button>
            <button onClick={() => setShowInviteModal(false)} style={styles.btnSecondary}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: C.textSec, marginBottom: 12, lineHeight: 1.5 }}>
            Link generated for <strong>{inviteEmail}</strong>. Copy and send it to the vendor:
          </p>
          <div style={{ background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.textPri, wordBreak: "break-all", marginBottom: 14 }}>
            {inviteLink}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { navigator.clipboard.writeText(inviteLink); }}
              style={{ ...styles.btnPrimary, flex: 1 }}
            >
              Copy Link
            </button>
            <button onClick={() => { setShowInviteModal(false); setInviteLink(""); setInviteEmail(""); }} style={styles.btnSecondary}>Close</button>
          </div>
          <p style={{ fontSize: 11, color: C.textTer, marginTop: 10 }}>
            Also available: open application at <strong>{window.location.origin}/vendor/accreditation/apply</strong>
          </p>
        </>
      )}
    </div>
  </div>
)}
```

### Step 5: Verify end-to-end invite flow

- [ ] In the running dev server, go to Vendors page. Click "Generate Invite Link", enter a test email, click Generate. Confirm:
  - A token row is created in `vendor_accreditation_tokens` table
  - The generated URL is shown and copyable
  - Visiting the URL in a new tab loads the accreditation form with the email pre-filled

- [ ] Test the return flow: In Supabase, manually set a vendor's `accreditation_status = "Returned"` and `return_notes = "Please upload a valid DTI certificate"`. Visit their token link. Confirm:
  - Amber return banner is shown with the return notes
  - Form is pre-filled with their existing company info
  - Previously uploaded documents show "Uploaded: filename" with a View link
  - Can add new file uploads and resubmit
  - After resubmit: `accreditation_status` flips back to `"Submitted"`, `return_notes` clears
