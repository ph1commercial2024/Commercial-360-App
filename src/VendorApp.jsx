import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { resolveVendorFromTokens } from "./lib/vendorDeduplication";
import { venCode } from "./lib/vendorCode";

const C = {
  coral:      "#3F3F3F",
  coralDark:  "#2A2A2A",
  coralLight: "#EFEFEF",
  coralMid:   "#E8E8E8",
  white:      "#FFFFFF",
  offWhite:   "#F8F7F5",
  surface:    "#F2F1EF",
  border:     "#E5E3DF",
  borderMid:  "#D0CEC9",
  textPri:    "#1A1917",
  textSec:    "#6B6860",
  textTer:    "#A09D97",
  tealBg:     "#E6F4EF",
  tealText:   "#0F6E56",
  greenBg:    "#EAF3DE",
  greenText:  "#3B6D11",
  amberBg:    "#FEF3E2",
  amberText:  "#92580A",
  redBg:      "#FDEDED",
  redText:    "#B91C1C",
  grayBg:     "#F1F0EE",
  grayText:   "#5F5E5A",
};

const S = {
  input: {
    width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 13,
    border: `1px solid ${C.border}`, borderRadius: 8, background: C.white,
    color: C.textPri, outline: "none", fontFamily: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  label:    { display: "block", fontSize: 12, fontWeight: 500, color: C.textSec, marginBottom: 5 },
  hint:     { fontSize: 11, color: C.textTer, marginTop: 4 },
  required: { color: C.coral, marginLeft: 2 },
  card: {
    background: C.white, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: "22px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)", marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14, fontWeight: 600, color: C.textPri,
    paddingBottom: 12, borderBottom: `1px solid ${C.border}`, margin: "0 0 18px",
  },
  btnPrimary: {
    background: `linear-gradient(135deg, ${C.coral}, ${C.coralDark})`,
    color: C.white, border: "none", borderRadius: 8,
    padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer",
    fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)",
  },
  btnSecondary: {
    background: C.white, color: C.textSec, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
  },
  btnGhost: {
    background: "transparent", color: C.textSec, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
  },
  badge: (status) => {
    const map = {
      "Draft":        { bg: C.grayBg,  color: C.grayText  },
      "Submitted":    { bg: C.tealBg,  color: C.tealText  },
      "Under Review": { bg: "#EEF2FF", color: "#4338CA"   },
      "Returned":     { bg: C.amberBg, color: C.amberText },
      "Accredited":   { bg: C.greenBg, color: C.greenText },
      "Declined":     { bg: C.redBg,   color: C.redText   },
    };
    const s = map[status] || map["Draft"];
    return { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color };
  },
};

const FONT = "'Calibri', Candara, 'Segoe UI', Arial, sans-serif";

// Business units: read from localStorage immediately (instant), then refresh from DB in background.
const _BUS_LS_KEY = "ph1_bus_cache";
let _busCache = (() => {
  try { const v = localStorage.getItem(_BUS_LS_KEY); return v ? JSON.parse(v) : null; }
  catch { return null; }
})();
const _busFetch = supabase.from("business_units").select("id, name, logo_url").order("name")
  .then(({ data }) => {
    _busCache = data || [];
    try { localStorage.setItem(_BUS_LS_KEY, JSON.stringify(_busCache)); } catch {}
    return _busCache;
  });

const GOV_DOCS = [
  "DTI / SEC Certificate",
  "General Information Sheet",
  "Articles of Incorporation",
  "Secretary Certificate",
  "By-laws (SEC-registered companies only)",
  "Municipality / Mayor's Permit",
  "BIR/VAT Registration",
  "PCAB License",
  "Authorized Distributorship / Dealership Certificate",
  "License (PTR / PRC ID)",
  "LTO Registration of Equipment",
  "ISO Compliance Certificate (if available)",
];

// Shown in Company Information tab (below Authorized Representative) — not in Gov Docs tab
const COMPANY_ID_DOCS = ["Valid Government ID 1", "Valid Government ID 2"];

const FIN_DOCS = [
  "OR & Sales Invoice",
  "Audited Financial Statement (2 years)",
  "Certificate of Good Credit Standing",
  "Copy of ITR Previous Year",
  "Sample Purchase Order / Job Order (5 Major Clients)",
];

// Always required fin docs for all vendor types
const FIN_DOCS_ALWAYS_REQUIRED = new Set([
  "OR & Sales Invoice",
  "Copy of ITR Previous Year",
]);
// AFS is required for SEC-registered vendors (all types); optional for DTI
const FIN_DOCS_SEC_REQUIRED = new Set([
  "Audited Financial Statement (2 years)",
]);
// Optional docs — submitting qualifies for Class A
const FIN_DOCS_CLASS_A_NOTE = new Set([
  "Certificate of Good Credit Standing",
  "Sample Purchase Order / Job Order (5 Major Clients)",
]);

const COMPLIANCE_DOCS = [
  "H&S Policy Statement",
  "QMS Certificate",
  "Internal QMS Procedures",
  "Environmental Management Policy",
];
const ACCREDITATION_DOCS = [...GOV_DOCS, ...COMPANY_ID_DOCS, ...FIN_DOCS, ...COMPLIANCE_DOCS];

// Phone number helpers
const cleanPhone      = v => v.replace(/[^\d+\-() ]/g, "");
const isValidMobile   = v => /^(09|\+639)\d{9}$/.test(v.replace(/[\s\-()]/g, ""));
const isValidLandline = v => v.replace(/\D/g, "").length >= 7;

const EWT_RATES = [
  { value: "1%",     label: "1% — Suppliers of goods" },
  { value: "2%",     label: "2% — Suppliers of services / labor" },
  { value: "5%",     label: "5% — Professionals (≤ ₱3M gross)" },
  { value: "10%",    label: "10% — Professionals (> ₱3M gross)" },
  { value: "15%",    label: "15% — Management / technical consultants" },
  { value: "Others", label: "Others" },
];

// Subset of GOV_DOCS that carry an expiry/validity date
const DOCS_WITH_EXPIRY = new Set([
  "DTI / SEC Certificate",
  "Municipality / Mayor's Permit",
  "BIR/VAT Registration",
  "Valid Government ID 1",
  "Valid Government ID 2",
  "PCAB License",
  "License (PTR / PRC ID)",
  "LTO Registration of Equipment",
  "ISO Compliance Certificate (if available)",
]);

// Docs that are only required for SEC-registered companies; not needed for DTI
const GOV_DOCS_SEC_ONLY = new Set([
  "General Information Sheet",
  "Articles of Incorporation",
  "Secretary Certificate",
  "By-laws (SEC-registered companies only)",
]);

// Always optional regardless of registration type
const GOV_DOCS_OPTIONAL = new Set(["ISO Compliance Certificate (if available)"]);

// Docs shown only for a specific vendor type (Class B gates)
const GOV_DOCS_CONTRACTOR_ONLY = new Set(["PCAB License"]);
const GOV_DOCS_SUPPLIER_ONLY   = new Set(["Authorized Distributorship / Dealership Certificate"]);
const GOV_DOCS_SERVICE_ONLY    = new Set(["License (PTR / PRC ID)"]);
const GOV_DOCS_RENTAL_ONLY     = new Set(["LTO Registration of Equipment"]);

// Static fallbacks — actual required lists are computed dynamically in render
// (based on form.registration_type and vendor_type)
const GOV_REQUIRED             = GOV_DOCS.filter(d => !GOV_DOCS_OPTIONAL.has(d));
const GOV_REQUIRED_WITH_EXPIRY = GOV_REQUIRED.filter(d => DOCS_WITH_EXPIRY.has(d));

// Helper: filter GOV_DOCS by vendor type (hides vendor-type-specific Class B docs that don't apply)
function govDocsForType(vendorType) {
  return GOV_DOCS.filter(d => {
    if (GOV_DOCS_CONTRACTOR_ONLY.has(d)) return vendorType === "Contractor";
    if (GOV_DOCS_SUPPLIER_ONLY.has(d))   return vendorType === "Supplier / Dealer";
    if (GOV_DOCS_SERVICE_ONLY.has(d))    return vendorType === "Service Provider";
    if (GOV_DOCS_RENTAL_ONLY.has(d))     return vendorType === "Equipment Rental";
    return true;
  });
}

function DocUploadRow({ docType, label, note, docFiles, uploadedDocs, handleDocFile, onDelete, expiryInfo, onExpiryChange, required, showRegInfo, regInfo, onRegInfoChange, minDaysValid }) {
  const file      = docFiles[docType];
  const existing  = uploadedDocs[docType];
  const hasFile   = !!file || !!existing;
  const hasExpiry = DOCS_WITH_EXPIRY.has(docType);

  const today          = new Date().toISOString().slice(0, 10);
  const isExpired      = expiryInfo?.expiry_date && expiryInfo.expiry_date < today;
  // Hard block: expiry is within minDaysValid days (e.g. 60) from today
  const minCutoff      = minDaysValid
    ? new Date(Date.now() + minDaysValid * 86400e3).toISOString().slice(0, 10)
    : null;
  const isTooSoon      = minCutoff && expiryInfo?.expiry_date && !isExpired &&
    expiryInfo.expiry_date <= minCutoff;
  const isSoonExpiring = !minDaysValid && expiryInfo?.expiry_date && !isExpired &&
    new Date(expiryInfo.expiry_date) <= new Date(Date.now() + 60 * 86400e3);

  return (
    <div style={{ border: `1px solid ${hasFile ? "#86EFAC" : C.border}`, borderRadius: 10, overflow: "hidden" }}>
      {/* Main row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", background: hasFile ? C.greenBg : C.offWhite, gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textPri }}>{label ?? docType}{required && <span style={{ color: C.coral, marginLeft: 2 }}>*</span>}</div>
          {note && <div style={{ fontSize: 11, color: C.amberText, marginTop: 2 }}>⚠ {note}</div>}
          {file && <div style={{ fontSize: 11, color: C.greenText, marginTop: 2 }}>New: {file.name}</div>}
          {!file && existing && (
            <div style={{ fontSize: 11, color: C.tealText, marginTop: 2 }}>
              Uploaded: {existing.name} &nbsp;
              <a href={existing.url} target="_blank" rel="noreferrer" style={{ color: C.coral, textDecoration: "none", fontWeight: 600 }}>View</a>
            </div>
          )}
          {!file && !existing && <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>Not yet uploaded</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {hasFile && onDelete && (
            <button onClick={() => onDelete(docType)} style={{
              fontSize: 11, fontWeight: 600, color: C.redText,
              border: `1px solid ${C.redBg}`, borderRadius: 6, padding: "4px 8px",
              background: C.redBg, cursor: "pointer", fontFamily: FONT,
            }}>Remove</button>
          )}
          <label style={{ cursor: "pointer" }}>
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: hasFile ? C.greenText : C.coral,
              border: `1px solid ${hasFile ? "#86EFAC" : C.coral}40`,
              borderRadius: 6, padding: "4px 10px",
              background: hasFile ? C.greenBg : C.coralLight,
            }}>
              {hasFile ? "Replace" : "Upload"}
            </span>
            <input type="file" accept=".pdf"
              style={{ display: "none" }}
              onChange={e => handleDocFile(docType, e.target.files[0] || null)} />
          </label>
        </div>
      </div>

      {/* Registration No. + Registration Date — shown for gov docs once file is present */}
      {showRegInfo && hasFile && (
        <div style={{ padding: "8px 14px 10px", borderTop: `1px solid ${C.border}`, background: "#fff", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: 11, color: C.textSec, marginBottom: 3 }}>Registration No.</div>
            <input
              type="text"
              value={regInfo?.reg_number || ""}
              onChange={e => onRegInfoChange(docType, "reg_number", e.target.value)}
              placeholder="Certificate / permit number"
              style={{ fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <div style={{ fontSize: 11, color: C.textSec, marginBottom: 3 }}>Registration Date</div>
            <input
              type="date"
              value={regInfo?.reg_date || ""}
              onChange={e => onRegInfoChange(docType, "reg_date", e.target.value)}
              style={{ fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontFamily: "inherit" }}
            />
          </div>
        </div>
      )}

      {/* Expiry date — shown only for docs that have one, once a file is present */}
      {hasExpiry && hasFile && (
        <div style={{ padding: "8px 14px 10px", borderTop: `1px solid ${C.border}`, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.textSec, whiteSpace: "nowrap" }}>Expiry date:{required && <span style={{ color: C.coral }}> *</span>}</span>
            <input
              type="date"
              value={expiryInfo?.expiry_date || ""}
              onChange={e => onExpiryChange(docType, e.target.value)}
              style={{ fontSize: 12, border: `1px solid ${isTooSoon || isExpired ? C.redText : C.border}`, borderRadius: 6, padding: "4px 8px", fontFamily: "inherit" }}
            />
            {expiryInfo?.expiry_date && (
              <span style={{ fontSize: 12, fontWeight: 600, color: isExpired || isTooSoon ? C.redText : isSoonExpiring ? C.amberText : C.greenText }}>
                {isExpired ? "Expired" : isTooSoon ? "Too soon" : isSoonExpiring ? "Expiring soon" : "Valid"}
              </span>
            )}
          </div>
          {isTooSoon && (
            <div style={{ fontSize: 11, color: C.redText, marginTop: 5, lineHeight: 1.5 }}>
              ✕ This ID expires within 60 days. Please provide a government ID that is valid for at least 60 more days.
            </div>
          )}
          {isExpired && (
            <div style={{ fontSize: 11, color: C.redText, marginTop: 5, lineHeight: 1.5 }}>
              ✕ This document is already expired. Please upload a valid, unexpired document.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SIGNATURE PAD ────────────────────────────────────────────────────────────
function SignaturePad({ value, onChange }) {
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const lastPos    = useRef(null);
  const hasStrokes = useRef(!!value);

  // On mount: if a saved data-URL exists, paint it
  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current;
        if (!c) return;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      };
      img.src = value;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getXY = (e, canvas) => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  };

  const onStart = useCallback((e) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getXY(e, canvasRef.current);
  }, []);

  const onMove = useCallback((e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const c   = canvasRef.current;
    const ctx = c.getContext("2d");
    const pos = getXY(e, c);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1C1C1E";
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    lastPos.current  = pos;
    hasStrokes.current = true;
  }, []);

  const onEnd = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasStrokes.current) onChange(canvasRef.current.toDataURL());
  }, [onChange]);

  const clear = () => {
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    hasStrokes.current = false;
    onChange(null);
  };

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <canvas
        ref={canvasRef}
        width={700} height={130}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        style={{
          display: "block", width: "100%", height: 110,
          border: `1.5px solid ${value ? C.border : C.border}`,
          borderRadius: 8, background: "#FAFAFA",
          cursor: "crosshair", touchAction: "none",
          boxSizing: "border-box",
        }}
      />
      {!value && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#C0C0C0", pointerEvents: "none",
        }}>
          Draw signature here
        </div>
      )}
      {value && (
        <button
          type="button" onClick={clear}
          style={{
            position: "absolute", top: 6, right: 6,
            fontSize: 10, fontWeight: 600, padding: "2px 9px",
            borderRadius: 5, border: `1px solid ${C.border}`,
            background: "#fff", color: C.textTer,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >Clear</button>
      )}
    </div>
  );
}

// ─── SHARED VENDOR PAGE HEADER ───────────────────────────────────────────────
// singleBuName: when provided, fetches only that one BU (RFQ page).
// When omitted, fetches all BUs (accreditation page).
export function VendorPageHeader({ title, subtitle, singleBuName }) {
  const [bus, setBus] = useState([]);

  useEffect(() => {
    if (singleBuName) {
      supabase.from("business_units").select("id, name, logo_url")
        .eq("name", singleBuName).limit(1)
        .then(({ data }) => { if (data) setBus(data); });
    } else {
      supabase.from("business_units").select("id, name, logo_url").order("name")
        .then(({ data }) => { if (data) setBus(data); });
    }
  }, [singleBuName]);

  const singleBu = singleBuName ? bus[0] : null;

  return (
    <div style={{ background: "rgba(63,63,63,1)", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, boxShadow: "0 2px 8px rgba(0,0,0,0.18), 0 1px 0 rgba(0,0,0,0.10)" }}>
      {/* Identity row */}
      <div style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        {singleBuName ? (
          /* RFQ mode: show the issuing BU as the primary identity */
          singleBu ? (
            singleBu.logo_url
              ? <img src={singleBu.logo_url} alt={singleBu.name} style={{ height: 34, width: "auto", maxWidth: 80, objectFit: "contain", flexShrink: 0 }} />
              : <div style={{ width: 34, height: 34, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "-0.3px" }}>{singleBu.name.charAt(0)}</span>
                </div>
          ) : (
            <div style={{ width: 34, height: 34, background: "rgba(255,255,255,0.10)", borderRadius: 8, flexShrink: 0 }} />
          )
        ) : (
          /* Accreditation mode: show the PH1 logo */
          <img src="/ph1-logo.png" alt="PH1 World Developers" style={{ height: 34, width: "auto", maxWidth: 80, objectFit: "contain", flexShrink: 0 }} />
        )}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
            {singleBuName ? (singleBu?.name ?? singleBuName) : "PH1 World Developers"}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1 }}>D&amp;C – Procurement, Commercial &amp; Contract Management</div>
        </div>
        {title && <>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", marginLeft: 4, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{subtitle}</div>}
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── RFQ SUBMISSION HELPERS ──────────────────────────────────────────────────
const V_PT_HAS_DP         = new Set(["dp_progress_retention","dp_progress","dp_completion","dp_only"]);
const V_PT_HAS_PROGRESS   = new Set(["dp_progress_retention","dp_progress","progress_retention","progress_only"]);
const V_PT_HAS_RETENTION  = new Set(["dp_progress_retention","progress_retention"]);
const V_PT_HAS_COMPLETION = new Set(["dp_completion"]);
const V_PAYMENT_TERM_TYPES = [
  { value: "dp_progress_retention", label: "DP + Progress + Retention" },
  { value: "dp_progress",           label: "DP + Progress" },
  { value: "dp_completion",         label: "DP + Completion" },
  { value: "dp_only",               label: "Downpayment Only" },
  { value: "progress_retention",    label: "Progress + Retention" },
  { value: "progress_only",         label: "Progress Only" },
  { value: "milestone",             label: "Milestone Billing" },
  { value: "full_turnkey",          label: "Full Turnkey / Lump Sum" },
];
const V_PROGRESS_FREQS = [
  { value: "monthly_poc", label: "Monthly (Percentage of Completion)" },
  { value: "weekly_poc",  label: "Weekly (Percentage of Completion)" },
];
const fmtPeso = n => (n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const V_ATC_CODES = [
  { code: "WC010", desc: "Services — General Contractors / Subcontractors", rate: 2 },
  { code: "WC011", desc: "Purchase of Goods / Supplies", rate: 1 },
  { code: "WC157", desc: "Professional Fees — Individual (gross ≤ ₱720K)", rate: 5 },
  { code: "WC158", desc: "Professional Fees — Individual (>₱720K) / Corporation", rate: 10 },
  { code: "WC120", desc: "Rental — Real Property", rate: 5 },
  { code: "WC130", desc: "Rental — Personal Property / Equipment", rate: 5 },
  { code: "other", desc: "Other (specify below)", rate: null },
];
function ordinalDay(n) {
  const i = parseInt(n);
  if (!i) return n;
  const s = ["th","st","nd","rd"];
  const v = i % 100;
  return i + (s[(v - 20) % 10] || s[v] || s[0]);
}

const RETENTION_PARTIAL_TRIGGERS = [
  { value: "final_acceptance",       label: "Final Acceptance" },
  { value: "substantial_completion", label: "Substantial Completion" },
  { value: "completion_cert",        label: "Certificate of Completion" },
  { value: "custom",                 label: "Custom trigger" },
];
function defaultRFQPtData() {
  return {
    dp_percent: "20", dp_recoupable: true,
    progress_freq: "monthly_poc",
    retention_percent: "10", retention_deduction_mode: "each_invoice",
    dp_bill_conditions: "",
    progress_bill_conditions: "",
    retention_bill_conditions: "",
    completion_bill_conditions: "",
    dp_billing_docs: [],
    progress_billing_docs: [],
    retention_billing_docs: [],
    completion_billing_docs: [],
    dp_release_days: "15",          dp_release_fixed: false, dp_release_remarks: "",
    progress_release_days: "30",    progress_release_fixed: false, progress_release_remarks: "",
    progress_billing_cutoff_day: "",
    progress_payment_target_day: "",
    retention_billing_months: "12", retention_release_fixed: false, retention_billing_remarks: "",
    retention_partial_release_days: "30",
    completion_release_days: "30",  completion_release_fixed: false, completion_release_remarks: "",
    surety_bond_override: false,      surety_bond_override_amount: "", surety_bond_remarks: "", surety_bond_release: "",
    performance_bond_percent: "30",
    performance_bond_override: false, performance_bond_override_amount: "", performance_bond_remarks: "", performance_bond_release: "",
    warranty_bond_override: false,    warranty_bond_override_amount: "", warranty_bond_remarks: "", warranty_bond_release: "",
    commencement_type: "noa_ntp", commencement_days: "14",
    work_duration: "", work_duration_type: "calendar_days",
    warranty_period: "12",
  };
}
function autoBondAmtsV(ptType, ptData, total) {
  return {
    surety:      V_PT_HAS_DP.has(ptType)        ? total * parseFloat(ptData.dp_percent || 0) / 100               : 0,
    performance: V_PT_HAS_PROGRESS.has(ptType)  ? total * parseFloat(ptData.performance_bond_percent || 30) / 100 : 0,
    warranty:    V_PT_HAS_RETENTION.has(ptType) ? total * parseFloat(ptData.retention_percent || 0) / 100          : 0,
  };
}
const BOND_RELEASE_OPTS = ["Upon project handover","Upon final payment","Upon warranty expiry","Upon mutual agreement"];

function VReleaseRow({ label, sublabel, std, unit, val, onChange, remarks, onRemarks, color, bg, border, conditions, fixed, docs, required, billingCutoffDay, paymentTargetDay }) {
  const reqVal    = required ? parseInt(required) : std;
  const proposed  = parseInt(val || std);
  const deviates  = !fixed && proposed !== reqVal;
  const diff      = proposed - reqVal;
  const favorable = diff > 0;
  const devBorder = deviates ? (favorable ? "#059669" : "#D97706") : null;

  const headerBg  = fixed ? "rgba(220,38,38,0.06)"
                  : deviates ? (favorable ? "rgba(5,150,105,0.06)" : "rgba(217,119,6,0.06)")
                  : `${color}10`;
  const accentStrip = fixed ? "#DC2626" : deviates ? (favorable ? "#059669" : "#D97706") : color;

  return (
    <div style={{ marginBottom: 12, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.05)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: headerBg, borderBottom: `0.5px solid ${accentStrip}28` }}>
        <div style={{ width: 3, height: 32, borderRadius: 2, background: accentStrip, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: sublabel ? 1 : 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: accentStrip, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
            {fixed && (
              <span style={{ fontSize: 9, fontWeight: 700, color: "#DC2626", background: "rgba(220,38,38,0.10)", border: "0.5px solid rgba(220,38,38,0.25)", borderRadius: 100, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ðŸ”’ Non-negotiable
              </span>
            )}
          </div>
          {sublabel && <div style={{ fontSize: 11, color: "#6B7280" }}>{sublabel}</div>}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.92)" }}>
        {conditions && (
          <div style={{ marginBottom: 10, padding: "9px 11px", background: `${color}0d`, borderRadius: 10, borderLeft: `3px solid ${color}80` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Right to Bill — Prerequisites</div>
            <pre style={{ margin: 0, fontFamily: "inherit", fontSize: 11, color: "#374151", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{conditions}</pre>
          </div>
        )}
        {docs && docs.length > 0 && (
          <div style={{ marginBottom: 10, padding: "9px 11px", background: "rgba(255,255,255,0.6)", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.08)", boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.8)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 7 }}>Required Billing Documents</div>
            {docs.map((doc, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: i < docs.length - 1 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: "1.5px solid #D1D5DB", background: "white", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>{doc}</span>
              </div>
            ))}
          </div>
        )}
        {billingCutoffDay && paymentTargetDay && (
          <div style={{ marginBottom: 10, padding: "8px 11px", background: "rgba(16,185,129,0.07)", borderRadius: 10, border: "0.5px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>ðŸ“…</span>
            <span style={{ fontSize: 11, color: "#065F46" }}>Cutoff: <strong>{ordinalDay(billingCutoffDay)} of each month</strong>{" · "}Payment target: <strong>{ordinalDay(paymentTargetDay)} of the following month</strong></span>
          </div>
        )}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Payment Release</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: deviates ? 8 : 0 }}>
          <input type="number" min="1" value={val} onChange={e => !fixed && onChange(e.target.value)}
            readOnly={fixed}
            style={{ padding: "7px 10px", fontSize: 13, fontWeight: 600, border: `0.5px solid ${devBorder || "rgba(0,0,0,0.15)"}`, borderRadius: 10, width: 72, textAlign: "right", fontFamily: "inherit",
              background: fixed ? "#F3F4F6" : "rgba(255,255,255,0.85)", color: fixed ? "#6B7280" : "#1d1d1f",
              cursor: fixed ? "not-allowed" : undefined, boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 0.5px 0 rgba(255,255,255,0.9)" }} />
          <span style={{ fontSize: 12, color: "#6B7280" }}>{unit} from complete billing submission</span>
          {!fixed && <span style={{ fontSize: 11, color: "#9CA3AF" }}>(std: {std} {unit})</span>}
          {fixed && <span style={{ fontSize: 11, color: "#DC2626" }}>· set by PH1, cannot be changed</span>}
        </div>
        {deviates && (
          <div style={{ padding: "9px 11px", borderRadius: 12,
            background: favorable ? "rgba(5,150,105,0.07)" : "rgba(217,119,6,0.07)",
            border: `0.5px solid ${favorable ? "rgba(5,150,105,0.25)" : "rgba(217,119,6,0.25)"}`,
            boxShadow: `0 2px 8px ${favorable ? "rgba(5,150,105,0.08)" : "rgba(217,119,6,0.08)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
              <span style={{ fontSize: 13 }}>{favorable ? "✅" : "⚠ï¸"}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 100, background: "rgba(16,185,129,0.12)", color: "#065F46", border: "0.5px solid rgba(16,185,129,0.25)" }}>Required: {reqVal} {unit}</span>
              <span style={{ fontSize: 11, color: favorable ? "#059669" : "#D97706" }}>→</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 100, background: favorable ? "rgba(16,185,129,0.12)" : "rgba(217,119,6,0.12)", color: favorable ? "#065F46" : "#92400E", border: `0.5px solid ${favorable ? "rgba(16,185,129,0.25)" : "rgba(217,119,6,0.25)"}` }}>Proposed: {proposed} {unit}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: favorable ? "#059669" : "#D97706" }}>{diff > 0 ? "+" : ""}{diff} {unit}</span>
            </div>
            {favorable
              ? <div style={{ fontSize: 10, color: "#065F46" }}>Vendor accepts a longer release timeline — favorable to PH1.</div>
              : <>
                  <div style={{ fontSize: 10, color: "#92400E", marginBottom: 5 }}>Deviation from PH1 required timeline — justification required.</div>
                  <input value={remarks || ""} onChange={e => onRemarks(e.target.value)} placeholder="Reason for requesting a shorter release period…"
                    style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", fontSize: 11, border: "0.5px solid rgba(217,119,6,0.3)", borderRadius: 8, fontFamily: "inherit", background: "rgba(255,255,255,0.75)" }} />
                </>
            }
          </div>
        )}
      </div>
    </div>
  );
}

function VBondRow({ label, color, auto, total, autoLabel, pctVal, onPct, isOverride, onToggleOverride, overrideAmt, onOverrideAmt, remarks, onRemarks, releaseVal, onRelease }) {
  const displayAmt = isOverride && overrideAmt ? parseFloat(overrideAmt) : auto;
  return (
    <div style={{ marginBottom: 10, padding: "12px 14px", background: "#FAFAFA", borderRadius: 8, border: "1px solid #E5E5EA" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1C1C1E" }}>{label}</span>
      </div>
      {pctVal !== undefined && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <input type="number" min="0" max="100" value={pctVal} onChange={e => onPct(e.target.value)}
            style={{ padding: "5px 8px", fontSize: 12, border: "1px solid #E5E5EA", borderRadius: 6, width: 60, textAlign: "right", fontFamily: "inherit" }} />
          <span style={{ fontSize: 11, color: "#6B6B6B" }}>% of contract</span>
        </div>
      )}
      {pctVal === undefined && <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 6 }}>{autoLabel}</div>}
      <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: isOverride ? "#92580A" : "#1C1C1E", marginBottom: 8 }}>
        {total > 0 ? `₱ ${fmtPeso(displayAmt)}` : "—"}
        {isOverride && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6, color: "#92580A" }}>⚠ override</span>}
      </div>
      <select value={releaseVal || ""} onChange={e => onRelease(e.target.value)}
        style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: "1px solid #E5E5EA", borderRadius: 6, marginBottom: 8, fontFamily: "inherit" }}>
        <option value="">Release trigger…</option>
        {BOND_RELEASE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 12 }}>
        <input type="checkbox" checked={isOverride} onChange={e => onToggleOverride(e.target.checked)} />
        Override amount
      </label>
      {isOverride && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <input type="number" placeholder="Override amount" value={overrideAmt || ""} onChange={e => onOverrideAmt(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 12, border: "1px solid #E5E5EA", borderRadius: 6, fontFamily: "inherit" }} />
          <input placeholder="Justification…" value={remarks || ""} onChange={e => onRemarks(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 12, border: "1px solid #E5E5EA", borderRadius: 6, fontFamily: "inherit" }} />
        </div>
      )}
    </div>
  );
}

// ─── VENDOR RFQ PAGE ─────────────────────────────────────────────────────────
function VendorRFQPage({ token }) {
  const [loading, setLoading]           = useState(true);
  const [ph1LogoUrl, setPh1LogoUrl]     = useState(null);
  const [rfqVendor, setRfqVendor]       = useState(null);
  const [rfq, setRfq]                   = useState(null);
  const [pr, setPr]                     = useState(null);
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [deactivated, setDeactivated]   = useState(false);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [uploading, setUploading]       = useState(false);

  // 'review' = requirements confirmation page | 'proposal' = form
  const [view, setView]                 = useState("review");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirming, setConfirming]     = useState(false);

  // Draft
  const [draftId, setDraftId]           = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [savingDraft, setSavingDraft]   = useState(false);

  const [lineItems, setLineItems]       = useState([]);
  const [acceptPT, setAcceptPT]         = useState(true);
  const [ptType, setPtType]             = useState("");
  const [ptData, setPtData]             = useState(defaultRFQPtData());
  const updPt = (key, val) => setPtData(p => ({ ...p, [key]: val }));
  const [priceValidity, setPriceValidity] = useState("");
  const [attachUrl, setAttachUrl]       = useState("");
  const [attachName, setAttachName]     = useState("");
  const [vendorNotes, setVendorNotes]   = useState("");
  const [vatStatus, setVatStatus]       = useState("exclusive"); // "inclusive" | "exclusive" | "non_vat"
  const [birDocUrl, setBirDocUrl]       = useState("");
  const [birDocName, setBirDocName]     = useState("");
  const [atcCode, setAtcCode]           = useState("WC010"); // default for construction contractors
  const [customAtcCode, setCustomAtcCode] = useState("");
  const [customEwtRate, setCustomEwtRate] = useState("");
  const [ewtProofUrl, setEwtProofUrl]   = useState("");
  const [ewtProofName, setEwtProofName] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: vRow } = await supabase.from("rfq_vendors")
        .select("*, rfqs(*, purchase_requests(pr_number, description, justification, start_date, end_date, plans_file_url, plans_file_name, tor_file_url, tor_file_name, specs_file_url, specs_file_name, projects(name, business_unit, project_code)))")
        .eq("token", token).maybeSingle();

      if (!vRow) { setLoading(false); return; }

      if (!vRow.opened_at) {
        await supabase.from("rfq_vendors").update({ opened_at: new Date().toISOString() }).eq("id", vRow.id);
      }

      if (!vRow.is_active) setDeactivated(true);

      setRfqVendor(vRow);
      setRfq(vRow.rfqs);
      setPr(vRow.rfqs?.purchase_requests);

      const rfqRow = vRow.rfqs || {};
      const basePtData = { ...defaultRFQPtData(), ...(rfqRow.payment_term_data || {}) };
      if (rfqRow.work_duration) basePtData.work_duration = String(rfqRow.work_duration);
      if (rfqRow.contract_terms?.warranty_months) basePtData.warranty_period = String(rfqRow.contract_terms.warranty_months);
      setPtData(basePtData);

      // Load draft and latest submitted separately
      const [{ data: draftRows }, { data: submittedRows }] = await Promise.all([
        supabase.from("rfq_submissions").select("*").eq("rfq_vendor_id", vRow.id).eq("status", "draft").limit(1),
        supabase.from("rfq_submissions").select("*").eq("rfq_vendor_id", vRow.id).eq("status", "submitted").order("version", { ascending: false }).limit(1),
      ]);

      const draft   = draftRows?.[0] || null;
      const lastSub = submittedRows?.[0] || null;
      if (lastSub) setExistingSubmission(lastSub);

      // Pre-fill: draft takes priority over latest submitted
      const source = draft || lastSub;
      if (source) {
        if (source.items?.length) setLineItems(source.items);
        if (source.price_validity) setPriceValidity(source.price_validity);
        if (source.attachment_url) { setAttachUrl(source.attachment_url); setAttachName(source.attachment_name || ""); }
        if (source.notes) setVendorNotes(source.notes);
        if (source.vat_status) setVatStatus(source.vat_status);
        if (source.bir_doc_url) { setBirDocUrl(source.bir_doc_url); setBirDocName(source.bir_doc_name || ""); }
        if (source.atc_code) {
          // Custom ATC is encoded as "custom|ATCCODE|RATE"
          if (source.atc_code.startsWith("custom|")) {
            const parts = source.atc_code.split("|");
            setAtcCode("other");
            setCustomAtcCode(parts[1] || "");
            setCustomEwtRate(parts[2] || "");
          } else {
            setAtcCode(source.atc_code);
          }
        }
        if (source.ewt_proof_url) { setEwtProofUrl(source.ewt_proof_url); setEwtProofName(source.ewt_proof_name || ""); }
        if (source.proposed_payment_term_type) {
          setAcceptPT(false);
          setPtType(source.proposed_payment_term_type);
          setPtData({ ...basePtData, ...(source.proposed_payment_term_data || {}) });
        } else if (source.proposed_payment_term_data) {
          setPtData({ ...basePtData, ...source.proposed_payment_term_data });
        }
      }

      if (draft) {
        setDraftId(draft.id);
        setDraftSavedAt(new Date(draft.updated_at || draft.created_at));
      }

      // Already confirmed → go straight to proposal form
      if (vRow.confirmed_at) setView("proposal");

      const prId = rfqRow.pr_id;
      if (prId && !source?.items?.length) {
        const { data: si } = await supabase.from("scope_items").select("*").eq("pr_id", prId).order("sort_order");
        setLineItems((si || []).map(s => ({
          scope_item_id: s.id, description: s.description,
          qty: String(s.quantity || "1"), unit: s.unit_of_measure || "lot",
          unit_price: "", is_custom: false,
        })));
      }

      setLoading(false);
    };
    load();
    supabase.from("business_units").select("logo_url").eq("name", "PH1 World Developers Inc.").maybeSingle()
      .then(({ data }) => { if (data?.logo_url) setPh1LogoUrl(data.logo_url); });
  }, [token]);

  const subtotal = lineItems.reduce((s, i) => s + parseFloat(i.unit_price || 0) * parseFloat(i.qty || 1), 0);
  const vatAmt   = vatStatus === "exclusive" ? subtotal * 0.12 : 0;
  const total    = subtotal + vatAmt;
  const ewtBase  = vatStatus === "exclusive" ? subtotal
                 : vatStatus === "inclusive" ? total / 1.12
                 : total; // non_vat: gross amount is the base
  const ewtRatePct = atcCode === "other"
    ? (parseFloat(customEwtRate) || 0)
    : (V_ATC_CODES.find(a => a.code === atcCode)?.rate || 0);
  const ewtAmt     = ewtBase * (ewtRatePct / 100);
  const netPayable = total - ewtAmt;
  const effPTType = acceptPT ? (rfq?.payment_term_type || "") : ptType;
  const bonds    = autoBondAmtsV(effPTType, ptData, total);
  const hasDP    = V_PT_HAS_DP.has(effPTType);
  const hasProg  = V_PT_HAS_PROGRESS.has(effPTType);
  const hasRet   = V_PT_HAS_RETENTION.has(effPTType);
  const hasComp  = V_PT_HAS_COMPLETION.has(effPTType);
  // RFQ-required flags (based on admin's required type, not vendor's proposed type)
  const rfqPTType  = rfq?.payment_term_type || "";
  const rfqPTData  = rfq?.payment_term_data || {};
  const rfqHasDP   = V_PT_HAS_DP.has(rfqPTType);
  const rfqHasProg = V_PT_HAS_PROGRESS.has(rfqPTType);
  const rfqHasRet  = V_PT_HAS_RETENTION.has(rfqPTType);
  const rfqHasComp = V_PT_HAS_COMPLETION.has(rfqPTType);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    const now = new Date().toISOString();
    await supabase.from("rfq_vendors").update({ confirmed_at: now }).eq("id", rfqVendor.id);
    setRfqVendor(v => ({ ...v, confirmed_at: now }));
    setView("proposal");
    setConfirming(false);
  };

  const handleSaveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    const nextVersion = (existingSubmission?.version || 0) + 1;
    const payload = {
      rfq_vendor_id: rfqVendor.id,
      rfq_id: rfq.id,
      status: "draft",
      version: nextVersion,
      quoted_amount: total,
      items: lineItems,
      proposed_payment_term_type: acceptPT ? null : ptType,
      proposed_payment_term_data: ptData,
      price_validity: priceValidity || null,
      attachment_url: attachUrl || null,
      attachment_name: attachName || null,
      notes: vendorNotes || null,
      vat_status: vatStatus,
      bir_doc_url: birDocUrl || null,
      bir_doc_name: birDocName || null,
      atc_code: atcCode === "other" ? `custom|${customAtcCode}|${customEwtRate}` : atcCode,
      ewt_proof_url: ewtProofUrl || null,
      ewt_proof_name: ewtProofName || null,
    };
    if (draftId) {
      await supabase.from("rfq_submissions").update(payload).eq("id", draftId);
    } else {
      const { data } = await supabase.from("rfq_submissions").insert(payload).select("id").single();
      if (data?.id) setDraftId(data.id);
    }
    setDraftSavedAt(new Date());
    setSavingDraft(false);
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const path = `rfq-submissions/${rfqVendor.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("vendor-documents").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("vendor-documents").getPublicUrl(path);
      setAttachUrl(publicUrl);
      setAttachName(file.name);
    }
    setUploading(false);
  };

  const handleBirUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const path = `rfq-submissions/${rfqVendor.id}/bir-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("vendor-documents").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("vendor-documents").getPublicUrl(path);
      setBirDocUrl(publicUrl);
      setBirDocName(file.name);
    }
    setUploading(false);
  };

  const handleEwtProofUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const path = `rfq-submissions/${rfqVendor.id}/ewt-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("vendor-documents").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("vendor-documents").getPublicUrl(path);
      setEwtProofUrl(publicUrl);
      setEwtProofName(file.name);
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!lineItems.some(i => parseFloat(i.unit_price || 0) > 0)) {
      alert("Please enter at least one unit price."); return;
    }
    setSubmitting(true);

    const nextVersion = (existingSubmission?.version || 0) + 1;
    const subPayload = {
      rfq_vendor_id: rfqVendor.id,
      rfq_id: rfq.id,
      status: "submitted",
      version: nextVersion,
      quoted_amount: total,
      items: lineItems,
      proposed_payment_term_type: acceptPT ? null : ptType,
      proposed_payment_term_data: ptData,
      price_validity: priceValidity || null,
      attachment_url: attachUrl || null,
      attachment_name: attachName || null,
      notes: vendorNotes || null,
      vat_status: vatStatus,
      bir_doc_url: birDocUrl || null,
      bir_doc_name: birDocName || null,
      atc_code: atcCode === "other" ? `custom|${customAtcCode}|${customEwtRate}` : atcCode,
      ewt_proof_url: ewtProofUrl || null,
      ewt_proof_name: ewtProofName || null,
    };
    let subError;
    if (draftId) {
      const { error } = await supabase.from("rfq_submissions").update(subPayload).eq("id", draftId);
      subError = error;
    } else {
      const { error } = await supabase.from("rfq_submissions").insert(subPayload);
      subError = error;
    }

    if (subError) { alert(`Submission failed: ${subError.message}`); setSubmitting(false); return; }

    await supabase.from("rfq_vendors").update({ submitted_at: new Date().toISOString() }).eq("id", rfqVendor.id);
    setExistingSubmission(prev => ({ ...(prev || {}), version: nextVersion }));
    setDraftId(null);
    setDraftSavedAt(null);

    const prId = rfq.pr_id;
    const { data: rfaRows } = await supabase.from("rfas").select("id").eq("pr_id", prId).order("created_at", { ascending: false }).limit(1);
    let rfaId = rfaRows?.[0]?.id;
    if (!rfaId) {
      const { count } = await supabase.from("rfas").select("id", { count: "exact", head: true }).eq("pr_id", prId);
      const rfaNumber = `${String(prId).padStart(4,"0")}-RFA-${(count||0)+1}`;
      const { data: newRFA } = await supabase.from("rfas").insert({ pr_id: prId, rfa_number: rfaNumber, status: "Draft", created_by: null }).select("id").single();
      rfaId = newRFA?.id;
    }
    if (rfaId) {
      const { data: existingSlots } = await supabase.from("rfa_vendors")
        .select("id, slot, proposals, payment_term_data")
        .eq("rfa_id", rfaId);

      // Check if this vendor already has a slot (e.g. re-submission / revision)
      const mySlot = (existingSlots || []).find(s =>
        String(s.payment_term_data?.__vendor_id) === String(rfqVendor.vendor_id)
      );

      const vatRate = vatStatus === "non_vat" ? "0" : "12";
      const newProposal = {
        id: Math.random().toString(36).slice(2, 11),
        date: new Date().toISOString().slice(0, 10),
        items: lineItems.map(i => ({
          description: i.description,
          qty: parseFloat(i.qty || 1),
          unit: i.unit,
          unit_price: parseFloat(i.unit_price || 0),
        })),
        taxes: [{ id: Math.random().toString(36).slice(2, 11), name: "VAT", rate: vatRate }],
        amount: total,
        notes: vendorNotes || "",
      };

      if (mySlot) {
        // Append new proposal to existing slot instead of creating a duplicate
        await supabase.from("rfa_vendors").update({
          participation_status: "Submitted",
          payment_term_type: effPTType,
          payment_term_data: { __vendor_id: rfqVendor.vendor_id, ...ptData },
          completion_date: pr?.end_date || "",
          price_validity: priceValidity || "",
          remarks: vendorNotes || "",
          proposals: [...(mySlot.proposals || []), newProposal],
        }).eq("id", mySlot.id);
      } else {
        const slotCount = (existingSlots || []).length;
        await supabase.from("rfa_vendors").insert({
          rfa_id: rfaId, slot: slotCount + 1,
          vendor_id: null, participation_status: "Submitted",
          payment_term_type: effPTType,
          payment_term_data: { __vendor_id: rfqVendor.vendor_id, ...ptData },
          completion_date: pr?.end_date || "",
          price_validity: priceValidity || "",
          liquidated_damages: rfq.contract_terms?.ld_rate || "1/10 of 1% per calendar day of delay on the contract amount",
          remarks: vendorNotes || "",
          proposals: [newProposal],
        });
      }
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
      <style>{`@keyframes ph1-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
      {ph1LogoUrl && <img src={ph1LogoUrl} alt="PH1 World Developers Inc." style={{ width: 200, maxWidth: "60vw", objectFit: "contain", animation: "ph1-pulse 1.8s ease-in-out infinite" }} />}
    </div>
  );
  if (!rfqVendor || !rfq) return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: FONT }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Link not found</div>
      <div style={{ color: "#888" }}>This link may be invalid or has expired.</div>
    </div>
  );
  if (deactivated) return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: FONT }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>This link has been deactivated</div>
      <div style={{ color: "#888" }}>Please contact the project team if you believe this is an error.</div>
    </div>
  );
  if (submitted) return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: FONT }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Version {existingSubmission?.version || 1} submitted!</div>
      <div style={{ color: "#888", marginBottom: 20 }}>Thank you for your response to {rfq.rfq_number}.</div>
      <button onClick={() => setSubmitted(false)}
        style={{ fontSize: 13, color: "#3F3F3F", background: "none", border: "1px solid #3F3F3F", borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}>
        Submit a revised version
      </button>
    </div>
  );

  const F = FONT;
  const card = { background: "#fff", border: "1px solid #E5E5EA", borderRadius: 12, padding: 20, marginBottom: 16 };
  const sTitle = { fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #F2F2F7" };
  const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 11px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 8, fontFamily: "inherit", background: "#fff" };
  const ct = rfq.contract_terms || {};

  // ── REVIEW PAGE ──────────────────────────────────────────────────────────────
  if (view === "review") return (
    <div style={{ minHeight: "100vh", background: C.offWhite, fontFamily: F, paddingTop: 58 }}>
    <VendorPageHeader title="Request for Quotation" subtitle={rfq.rfq_number} singleBuName={pr?.projects?.business_unit} />
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px" }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#3F3F3F", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{rfq.rfq_number}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E", margin: "0 0 6px" }}>Requirements Review</h1>
        <div style={{ fontSize: 13, color: "#6B6B6B" }}>{pr?.projects?.name} · {pr?.description}</div>
        {rfq.deadline && <div style={{ fontSize: 12, color: "#FF3B30", marginTop: 4, fontWeight: 600 }}>Submission deadline: {new Date(rfq.deadline).toLocaleDateString()}</div>}
      </div>

      {rfqVendor.confirmed_at && (
        <div style={{ background: "#E6F4EF", border: "1px solid #0F6E5630", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, color: "#0F6E56", fontWeight: 600 }}>Requirements confirmed</div>
            <div style={{ fontSize: 12, color: "#0F6E56" }}>{new Date(rfqVendor.confirmed_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</div>
          </div>
          <button onClick={() => setView("proposal")}
            style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "#3F3F3F", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
            Back to Proposal →
          </button>
        </div>
      )}

      {/* Project Description */}
      {(rfq.vendor_description || pr?.description) && (
        <div style={{ ...card }}>
          <div style={sTitle}>Project Description</div>
          <div style={{ fontSize: 13, color: "#1C1C1E", whiteSpace: "pre-wrap" }}>{rfq.vendor_description || pr?.description}</div>
          {(rfq.vendor_justification || pr?.justification) && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F2F2F7" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B6B", marginBottom: 4 }}>JUSTIFICATION</div>
              <div style={{ fontSize: 13, color: "#1C1C1E", whiteSpace: "pre-wrap" }}>{rfq.vendor_justification || pr?.justification}</div>
            </div>
          )}
        </div>
      )}

      {/* Required Terms */}
      <div style={{ ...card }}>
        <div style={sTitle}>Required Contract Terms</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>PAYMENT TYPE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{V_PAYMENT_TERM_TYPES.find(p => p.value === rfq.payment_term_type)?.label || rfq.payment_term_type || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>WORK DURATION</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{rfq.work_duration ? `${rfq.work_duration} calendar days` : "—"}</div>
          </div>
          {rfqHasDP && rfqPTData.dp_percent && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>DOWN PAYMENT</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{rfqPTData.dp_percent}%{rfqPTData.dp_recoupable !== false ? " · Recoupable" : " · Non-recoupable"}</div>
          </div>}
          {rfqHasProg && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>PROGRESS BILLING</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{V_PROGRESS_FREQS.find(f => f.value === (rfqPTData.progress_freq || "monthly_poc"))?.label || "Monthly"}</div>
          </div>}
          {rfqHasRet && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>RETENTION</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{rfqPTData.retention_percent ?? ct.retention_pct ?? "—"}%{rfqPTData.retention_deduction_mode === "final_invoice" ? " · Final invoice" : " · Each invoice"}</div>
          </div>}
          {rfqHasProg && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>PERFORMANCE BOND</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{rfqPTData.performance_bond_percent ?? ct.perf_bond_pct ?? "—"}%</div>
          </div>}
          {ct.warranty_months && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>WARRANTY</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{ct.warranty_months} months</div>
          </div>}
          {ct.defects_liability_months && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>DEFECTS LIABILITY</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{ct.defects_liability_months} months</div>
          </div>}

          {/* Right to Bill & Release */}
          {rfqHasDP && rfqPTData.dp_release_days && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>DP RELEASE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{rfqPTData.dp_release_days} days from billing submission</div>
          </div>}
          {rfqHasProg && rfqPTData.progress_release_days && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>PROGRESS RELEASE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{rfqPTData.progress_release_days} days from billing submission</div>
          </div>}
          {rfqHasRet && rfqPTData.retention_billing_months && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>RETENTION RELEASE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{rfqPTData.retention_billing_months} months after warranty period</div>
          </div>}
          {rfqHasComp && rfqPTData.completion_release_days && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>COMPLETION RELEASE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{rfqPTData.completion_release_days} days from final acceptance</div>
          </div>}

          {ct.ld_rate && <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>LIQUIDATED DAMAGES</div>
            <div style={{ fontSize: 13, color: "#1C1C1E", marginTop: 2 }}>{ct.ld_rate}</div>
          </div>}
          {ct.payment_currency && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>PAYMENT CURRENCY</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{ct.payment_currency}</div>
          </div>}
          {pr?.start_date && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>TARGET START DATE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{new Date(pr.start_date).toLocaleDateString()}</div>
          </div>}
          {pr?.end_date && <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>TARGET END DATE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginTop: 2 }}>{new Date(pr.end_date).toLocaleDateString()}</div>
          </div>}
        </div>
      </div>

      {/* Scope of Work */}
      {lineItems.length > 0 && (
        <div style={{ ...card }}>
          <div style={sTitle}>Scope of Work</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F2F2F7" }}>
                <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6B6B" }}>Description</th>
                <th style={{ padding: "7px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#6B6B6B", width: 60 }}>Qty</th>
                <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6B6B", width: 70 }}>Unit</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={item.scope_item_id || i} style={{ borderBottom: "1px solid #F2F2F7" }}>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "#1C1C1E" }}>{item.description}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 12, color: "#6B6B6B" }}>{item.qty}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: "#6B6B6B" }}>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Supporting Documents */}
      {[pr?.plans_file_url, pr?.tor_file_url, pr?.specs_file_url].some(Boolean) && (
        <div style={{ ...card }}>
          <div style={sTitle}>Supporting Documents</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Plans / Drawings", url: pr?.plans_file_url, name: pr?.plans_file_name },
              { label: "Terms of Reference", url: pr?.tor_file_url, name: pr?.tor_file_name },
              { label: "Technical Specifications", url: pr?.specs_file_url, name: pr?.specs_file_name },
            ].filter(d => d.url).map(doc => (
              <div key={doc.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#F2F2F7", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B" }}>{doc.label}</div>
                  <div style={{ fontSize: 12, color: "#1C1C1E" }}>{doc.name || "View file"}</div>
                </div>
                <a href={doc.url} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: "#3F3F3F", fontWeight: 600, textDecoration: "none", border: "1px solid rgba(237,96,85,0.3)", borderRadius: 6, padding: "5px 12px" }}>
                  Download
                </a>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#92580A", fontWeight: 600 }}>
            Please download and review all documents above before confirming.
          </div>
        </div>
      )}

      {/* Notes from Procurement Team */}
      {rfq.notes && (
        <div style={{ ...card }}>
          <div style={sTitle}>Notes from Procurement Team</div>
          <div style={{ fontSize: 13, color: "#1C1C1E", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{rfq.notes}</div>
        </div>
      )}

      {/* Confirmation */}
      <div style={{ background: rfqVendor.confirmed_at ? "#F0FDF4" : "#FDF1F0", border: `1px solid ${rfqVendor.confirmed_at ? "#BBF7D0" : "rgba(237,96,85,0.3)"}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        {rfqVendor.confirmed_at ? (
          <div style={{ fontSize: 13, color: "#059669" }}>
            You confirmed these requirements on {new Date(rfqVendor.confirmed_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}. You may review them again at any time.
          </div>
        ) : (
          <>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: "pointer" }} />
              <span style={{ fontSize: 13, color: "#1C1C1E", lineHeight: 1.5 }}>
                I confirm that I have read and fully understood the project description, scope of work, supporting documents, and all required contract terms above. I am submitting this quotation with full knowledge of the requirements.
              </span>
            </label>
            <button onClick={handleConfirm} disabled={!confirmChecked || confirming}
              style={{ width: "100%", padding: "13px 0", background: confirmChecked ? "#3F3F3F" : "#E5E5EA", color: confirmChecked ? "#fff" : "#C7C7CC", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: confirmChecked ? "pointer" : "not-allowed", transition: "background 0.15s" }}>
              {confirming ? "Saving…" : "I Confirm — Proceed to Submit Quotation →"}
            </button>
          </>
        )}
        {rfqVendor.confirmed_at && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setView("proposal")}
              style={{ width: "100%", padding: "13px 0", background: "#3F3F3F", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Go to Proposal Form →
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );

  // ── PROPOSAL PAGE ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.offWhite, fontFamily: F, paddingTop: 58 }}>
    <VendorPageHeader title="Request for Quotation" subtitle={rfq.rfq_number} singleBuName={pr?.projects?.business_unit} />
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px" }}>

      {/* Top nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button onClick={() => setView("review")}
          style={{ fontSize: 13, color: "#3F3F3F", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          ← Review Requirements
        </button>
        {draftSavedAt
          ? <span style={{ fontSize: 11, color: "#6B6B6B" }}>Draft saved {draftSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          : <span style={{ fontSize: 11, color: "#C7C7CC" }}>Not yet saved</span>
        }
      </div>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#3F3F3F", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{rfq.rfq_number}</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1E", margin: "0 0 4px" }}>Submit Quotation</h1>
        <div style={{ fontSize: 13, color: "#6B6B6B" }}>{pr?.projects?.name} · {pr?.description}</div>
        {rfq.deadline && <div style={{ fontSize: 12, color: "#FF3B30", marginTop: 4, fontWeight: 600 }}>Submission deadline: {new Date(rfq.deadline).toLocaleDateString()}</div>}
      </div>

      {rfq.notes && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Notes from Procurement Team</div>
          <div style={{ fontSize: 13, color: "#78350F", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{rfq.notes}</div>
        </div>
      )}

      {existingSubmission && (
        <div style={{ background: "#E6F4EF", border: "1px solid #0F6E5630", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#0F6E56", fontWeight: 600 }}>Version {existingSubmission.version} already submitted</div>
          <div style={{ fontSize: 12, color: "#0F6E56", marginTop: 2 }}>Your previous values are pre-filled. Edit and submit to save a new version.</div>
        </div>
      )}

      {(rfq.vendor_description || pr?.description) && (
        <div style={{ ...card }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Description</div>
          <div style={{ fontSize: 13, color: "#1C1C1E", whiteSpace: "pre-wrap" }}>{rfq.vendor_description || pr?.description}</div>
        </div>
      )}

      {[pr?.plans_file_url, pr?.tor_file_url, pr?.specs_file_url].some(Boolean) && (
        <div style={{ ...card }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Supporting Documents</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Plans", url: pr?.plans_file_url, name: pr?.plans_file_name },
              { label: "Terms of Reference", url: pr?.tor_file_url, name: pr?.tor_file_name },
              { label: "Specifications", url: pr?.specs_file_url, name: pr?.specs_file_name },
            ].filter(d => d.url).map(doc => (
              <div key={doc.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#F2F2F7", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B" }}>{doc.label}</div>
                  <div style={{ fontSize: 12, color: "#1C1C1E" }}>{doc.name || "View file"}</div>
                </div>
                <a href={doc.url} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: "#3F3F3F", fontWeight: 600, textDecoration: "none", border: "1px solid rgba(237,96,85,0.3)", borderRadius: 6, padding: "4px 10px" }}>
                  View / Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€ Section 1: Cost Proposal â”€â”€ */}
      <div style={{ ...card }}>
        <div style={sTitle}>1. Cost Proposal <span style={{ color: "#3F3F3F" }}>*</span></div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr style={{ background: "#F2F2F7" }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6B6B" }}>Description</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#6B6B6B", width: 55 }}>Qty</th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6B6B", width: 55 }}>Unit</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#6B6B6B", width: 120 }}>Unit Price</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#6B6B6B", width: 120 }}>Amount</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => {
                const amt = parseFloat(item.unit_price || 0) * parseFloat(item.qty || 1);
                const setItem = patch => setLineItems(li => li.map((x, i) => i === idx ? { ...x, ...patch } : x));
                return (
                  <tr key={item.scope_item_id || idx} style={{ borderBottom: "1px solid #F2F2F7", background: item.is_custom ? "#F8FFFD" : "#fff" }}>
                    <td style={{ padding: "5px 10px" }}>
                      {item.is_custom
                        ? <input value={item.description} onChange={e => setItem({ description: e.target.value })} placeholder="Item description"
                            style={{ width: "100%", padding: "5px 7px", fontSize: 12, border: "1px solid #E5E5EA", borderRadius: 5, fontFamily: "inherit", boxSizing: "border-box" }} />
                        : <span style={{ fontSize: 13, color: "#1C1C1E" }}>{item.description}</span>
                      }
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <input type="number" min="0" value={item.qty} onChange={e => setItem({ qty: e.target.value })}
                        style={{ width: 48, padding: "5px 5px", fontSize: 12, border: "1px solid #E5E5EA", borderRadius: 5, textAlign: "right", fontFamily: "inherit" }} />
                    </td>
                    <td style={{ padding: "5px 10px" }}>
                      <input value={item.unit} onChange={e => setItem({ unit: e.target.value })} placeholder="lot"
                        style={{ width: 48, padding: "5px 5px", fontSize: 12, border: "1px solid #E5E5EA", borderRadius: 5, fontFamily: "inherit" }} />
                    </td>
                    <td style={{ padding: "4px 10px" }}>
                      <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItem({ unit_price: e.target.value })}
                        style={{ width: 110, padding: "6px 8px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 6, textAlign: "right", fontFamily: "monospace", boxSizing: "border-box" }}
                        placeholder="0.00" />
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 13, fontFamily: "monospace", color: amt > 0 ? "#1C1C1E" : "#C7C7CC", fontWeight: amt > 0 ? 600 : 400 }}>
                      {amt > 0 ? fmtPeso(amt) : "—"}
                    </td>
                    <td style={{ padding: "4px 4px", textAlign: "center" }}>
                      {item.is_custom && (
                        <button onClick={() => setLineItems(li => li.filter((_, i) => i !== idx))}
                          title="Remove" style={{ background: "none", border: "none", color: "#C7C7CC", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>Ã—</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ padding: "8px 10px" }}>
                  <button onClick={() => setLineItems(li => [...li, { scope_item_id: null, description: "", qty: "1", unit: "lot", unit_price: "", is_custom: true }])}
                    style={{ fontSize: 12, color: "#3F3F3F", fontWeight: 600, background: "none", border: "1px dashed rgba(237,96,85,0.4)", borderRadius: 6, padding: "5px 14px", cursor: "pointer" }}>
                    + Add Item
                  </button>
                </td>
              </tr>
              {vatStatus === "exclusive" && (
                <tr style={{ borderTop: "2px solid #E5E5EA", background: "#FAFAFA" }}>
                  <td colSpan={4} style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "#6B6B6B", textAlign: "right" }}>Subtotal (ex-VAT)</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>₱ {fmtPeso(subtotal)}</td>
                  <td />
                </tr>
              )}
              {vatStatus === "exclusive" && (
                <tr style={{ background: "#FAFAFA" }}>
                  <td colSpan={4} style={{ padding: "4px 10px", fontSize: 12, color: "#6B6B6B", textAlign: "right" }}>VAT (12%)</td>
                  <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#6B6B6B" }}>₱ {fmtPeso(vatAmt)}</td>
                  <td />
                </tr>
              )}
              <tr style={{ borderTop: vatStatus === "exclusive" ? "none" : "2px solid #E5E5EA", background: "#FAFAFA" }}>
                <td colSpan={4} style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "#6B6B6B", textAlign: "right" }}>
                  {vatStatus === "inclusive" ? "Total (VAT Inclusive)" : vatStatus === "non_vat" ? "Total (VAT Exempt)" : "Total"}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>₱ {fmtPeso(total)}</td>
                <td />
              </tr>
              <tr style={{ background: "#FAFAFA" }}>
                <td colSpan={4} style={{ padding: "4px 10px", fontSize: 12, color: "#6B6B6B", textAlign: "right" }}>
                  EWT ({atcCode === "other" ? `${customAtcCode || "—"} — ${customEwtRate || 0}%` : `${atcCode} — ${ewtRatePct}%`})
                </td>
                <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#6B6B6B" }}>
                  ({ewtAmt > 0 ? `₱ ${fmtPeso(ewtAmt)}` : "—"})
                </td>
                <td />
              </tr>
              <tr style={{ borderTop: "2px solid #E5E5EA", background: "#F0F4FF" }}>
                <td colSpan={4} style={{ padding: "10px", fontSize: 13, fontWeight: 700, color: "#1D4ED8", textAlign: "right" }}>Net Amount Payable</td>
                <td style={{ padding: "10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#1D4ED8" }}>₱ {fmtPeso(netPayable)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {lineItems.length === 0 && (
          <div style={{ fontSize: 12, color: "#C7C7CC", fontStyle: "italic", marginTop: 12 }}>No scope items defined. Contact the project team.</div>
        )}

        {/* VAT Status */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F2F2F7" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1C1C1E", marginBottom: 10 }}>VAT Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { val: "exclusive", label: "VAT Exclusive", desc: "My quoted prices are ex-VAT — 12% VAT will be added on top" },
              { val: "inclusive", label: "VAT Inclusive", desc: "My quoted prices already include 12% VAT" },
              { val: "non_vat",   label: "Non-VAT Registered Vendor", desc: "I am not VAT-registered (BIR Certificate of Registration required)" },
            ].map(opt => (
              <label key={opt.val} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 8, border: `1px solid ${vatStatus === opt.val ? "#3F3F3F" : "#E5E5EA"}`, background: vatStatus === opt.val ? "#FDF1F0" : "#fff" }}>
                <input type="radio" name="vatStatus" value={opt.val} checked={vatStatus === opt.val} onChange={() => setVatStatus(opt.val)}
                  style={{ marginTop: 2, accentColor: "#3F3F3F", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: vatStatus === opt.val ? "#3F3F3F" : "#1C1C1E" }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {vatStatus === "non_vat" && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 8 }}>BIR Certificate of Registration (COR) — Non-VAT</div>
              {birDocUrl
                ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <a href={birDocUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#3F3F3F" }}>{birDocName || "Uploaded certificate"}</a>
                    <button onClick={() => { setBirDocUrl(""); setBirDocName(""); }}
                      style={{ fontSize: 11, color: "#C7C7CC", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: "#92400E", marginBottom: 8 }}>Please upload your BIR Certificate of Registration (COR) showing Non-VAT status as proof of exemption.</div>
                    <label style={{ display: "inline-block", padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#92400E", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, cursor: "pointer" }}>
                      {uploading ? "Uploading…" : "Choose File"}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={e => handleBirUpload(e.target.files?.[0])} disabled={uploading} />
                    </label>
                  </div>
                )
              }
            </div>
          )}
        </div>

        {/* EWT */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F2F2F7" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1C1C1E", marginBottom: 4 }}>EWT — Expanded Withholding Tax</div>
          <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 10 }}>Select your applicable Alphanumeric Tax Code (ATC). This will be withheld from your payment and remitted to BIR on your behalf.</div>
          <select value={atcCode} onChange={e => setAtcCode(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 8, fontFamily: "inherit", background: "#fff", marginBottom: 10 }}>
            {V_ATC_CODES.map(a => (
              <option key={a.code} value={a.code}>
                {a.code === "other" ? "Other (specify)" : `${a.code} — ${a.desc} (${a.rate}%)`}
              </option>
            ))}
          </select>

          {atcCode === "other" && (
            <div style={{ padding: "12px 14px", background: "#F8F8FF", border: "1px solid #C7D2FE", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#3730A3", marginBottom: 10 }}>Custom ATC Details</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6B6B", display: "block", marginBottom: 4 }}>ATC Code</label>
                  <input value={customAtcCode} onChange={e => setCustomAtcCode(e.target.value)} placeholder="e.g. WC080"
                    style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #C7D2FE", borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#6B6B6B", display: "block", marginBottom: 4 }}>EWT Rate (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={customEwtRate} onChange={e => setCustomEwtRate(e.target.value)} placeholder="e.g. 8"
                    style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #C7D2FE", borderRadius: 6, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#3730A3", marginBottom: 6 }}>Proof of Applicable ATC Rate</div>
              <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 8 }}>Upload your BIR Certificate of Registration or any relevant BIR issuance showing your applicable ATC and rate.</div>
              {ewtProofUrl
                ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <a href={ewtProofUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#4F46E5" }}>{ewtProofName || "Uploaded document"}</a>
                    <button onClick={() => { setEwtProofUrl(""); setEwtProofName(""); }}
                      style={{ fontSize: 11, color: "#C7C7CC", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                  </div>
                ) : (
                  <label style={{ display: "inline-block", padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#3730A3", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 6, cursor: "pointer" }}>
                    {uploading ? "Uploading…" : "Choose File"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={e => handleEwtProofUpload(e.target.files?.[0])} disabled={uploading} />
                  </label>
                )
              }
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ Section 2: Payment Terms â”€â”€ */}
      <div style={{ ...card }}>
        <div style={sTitle}>2. Payment Terms</div>

        {/* Required terms display */}
        {rfq.payment_term_type ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Required by Project</div>
            <div style={{ padding: "14px 16px", background: "#F8F8F8", borderRadius: 10, border: "1px solid #E5E5EA" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", marginBottom: 10 }}>
                {V_PAYMENT_TERM_TYPES.find(p => p.value === rfq.payment_term_type)?.label || rfq.payment_term_type}
              </div>
              {/* Payment structure chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {rfqHasDP && (
                  <div style={{ padding: "8px 12px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE", fontSize: 12 }}>
                    <span style={{ color: "#2563EB", fontWeight: 700 }}>Down Payment: </span>
                    <span style={{ color: "#1D4ED8" }}>{rfqPTData.dp_percent ?? 20}%</span>
                    {rfqPTData.dp_recoupable !== false && <span style={{ color: "#6B6B6B" }}> · Recoupable</span>}
                  </div>
                )}
                {rfqHasProg && (
                  <div style={{ padding: "8px 12px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0", fontSize: 12 }}>
                    <span style={{ color: "#059669", fontWeight: 700 }}>Progress Billing: </span>
                    <span style={{ color: "#047857" }}>{V_PROGRESS_FREQS.find(f => f.value === (rfqPTData.progress_freq || "monthly_poc"))?.label || "Monthly"}</span>
                  </div>
                )}
                {rfqHasRet && (
                  <div style={{ padding: "8px 12px", background: "#FFFBEB", borderRadius: 8, border: "1px solid #FDE68A", fontSize: 12 }}>
                    <span style={{ color: "#D97706", fontWeight: 700 }}>Retention: </span>
                    <span style={{ color: "#B45309" }}>{rfqPTData.retention_percent ?? 10}%</span>
                    <span style={{ color: "#6B6B6B" }}> · {(rfqPTData.retention_deduction_mode || "each_invoice") === "each_invoice" ? "Each invoice" : "Final invoice"}</span>
                  </div>
                )}
                {rfqHasComp && (
                  <div style={{ padding: "8px 12px", background: "#FDF4FF", borderRadius: 8, border: "1px solid #E9D5FF", fontSize: 12 }}>
                    <span style={{ color: "#7C3AED", fontWeight: 700 }}>Completion Payment</span>
                  </div>
                )}
              </div>

              {/* Right to Bill & Release */}
              {(rfqHasDP || rfqHasProg || rfqHasRet || rfqHasComp) && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Right to Bill & Release</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {rfqHasDP && (
                      <div style={{ padding: "6px 10px", background: "#EFF6FF", borderRadius: 6, border: "1px solid #BFDBFE", fontSize: 12 }}>
                        <span style={{ color: "#2563EB", fontWeight: 600 }}>DP Release: </span>
                        <span style={{ color: "#1D4ED8" }}>{rfqPTData.dp_release_days ?? 15} days</span>
                      </div>
                    )}
                    {rfqHasProg && (
                      <div style={{ padding: "6px 10px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0", fontSize: 12 }}>
                        <span style={{ color: "#059669", fontWeight: 600 }}>Progress Release: </span>
                        <span style={{ color: "#047857" }}>{rfqPTData.progress_release_days ?? 30} days</span>
                      </div>
                    )}
                    {rfqHasRet && (
                      <div style={{ padding: "6px 10px", background: "#FFFBEB", borderRadius: 6, border: "1px solid #FDE68A", fontSize: 12 }}>
                        <span style={{ color: "#D97706", fontWeight: 600 }}>Retention Release: </span>
                        <span style={{ color: "#B45309" }}>{rfqPTData.retention_billing_months ?? 12} months</span>
                      </div>
                    )}
                    {rfqHasComp && (
                      <div style={{ padding: "6px 10px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0", fontSize: 12 }}>
                        <span style={{ color: "#059669", fontWeight: 600 }}>Completion Release: </span>
                        <span style={{ color: "#047857" }}>{rfqPTData.completion_release_days ?? 30} days</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bond Requirements */}
              {(rfqHasDP || rfqHasProg || rfqHasRet) && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Bond Requirements</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {rfqHasDP && (
                      <div style={{ padding: "6px 10px", background: "#EFF6FF", borderRadius: 6, border: "1px solid #BFDBFE", fontSize: 12 }}>
                        <span style={{ color: "#2563EB", fontWeight: 600 }}>Surety Bond: </span>
                        <span style={{ color: "#1D4ED8" }}>{rfqPTData.dp_percent ?? 20}% of contract</span>
                      </div>
                    )}
                    {rfqHasProg && (
                      <div style={{ padding: "6px 10px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0", fontSize: 12 }}>
                        <span style={{ color: "#059669", fontWeight: 600 }}>Performance Bond: </span>
                        <span style={{ color: "#047857" }}>{rfqPTData.performance_bond_percent ?? 30}% of contract</span>
                      </div>
                    )}
                    {rfqHasRet && (
                      <div style={{ padding: "6px 10px", background: "#FFFBEB", borderRadius: 6, border: "1px solid #FDE68A", fontSize: 12 }}>
                        <span style={{ color: "#D97706", fontWeight: 600 }}>Warranty Bond: </span>
                        <span style={{ color: "#B45309" }}>{rfqPTData.retention_percent ?? 10}% of contract</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 14, fontStyle: "italic" }}>No specific payment type required — vendor may propose their preferred terms.</div>
        )}

        {/* Accept or Propose */}
        {rfq.payment_term_type && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[{ val: true, label: "Accept required terms" }, { val: false, label: "Propose different terms" }].map(opt => (
              <button key={String(opt.val)} onClick={() => setAcceptPT(opt.val)}
                style={{ flex: 1, padding: "8px 0", fontSize: 12, fontWeight: acceptPT === opt.val ? 700 : 400, border: `1px solid ${acceptPT === opt.val ? "#3F3F3F" : "#E5E5EA"}`, borderRadius: 8, background: acceptPT === opt.val ? "#FDF1F0" : "#fff", color: acceptPT === opt.val ? "#3F3F3F" : "#6B6B6B", cursor: "pointer" }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Proposed term fields — shown when proposing different OR when no required type exists */}
        {(!acceptPT || !rfq.payment_term_type) && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Payment Type</label>
              <select value={ptType} onChange={e => setPtType(e.target.value)} style={{ ...inp }}>
                <option value="">Select…</option>
                {V_PAYMENT_TERM_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {V_PT_HAS_DP.has(effPTType) && (
              <div style={{ marginBottom: 10, padding: "12px 14px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                <label style={{ ...lbl, color: "#2563EB" }}>Downpayment %</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <input type="number" min="0" max="100" value={ptData.dp_percent} onChange={e => updPt("dp_percent", e.target.value)}
                    style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 6, width: 80, textAlign: "right", fontFamily: "inherit" }} />
                  <span style={{ fontSize: 12, color: "#6B6B6B" }}>%</span>
                  {total > 0 && <span style={{ fontSize: 12, fontFamily: "monospace", color: "#2563EB", fontWeight: 700 }}>= ₱ {fmtPeso(total * parseFloat(ptData.dp_percent || 0) / 100)}</span>}
                </div>
                <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 12 }}>
                  <input type="checkbox" checked={ptData.dp_recoupable !== false} onChange={e => updPt("dp_recoupable", e.target.checked)} />
                  Recoupable per progress billing
                </label>
              </div>
            )}
            {V_PT_HAS_PROGRESS.has(effPTType) && (
              <div style={{ marginBottom: 10, padding: "12px 14px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0" }}>
                <label style={{ ...lbl, color: "#059669" }}>Progress Billing Frequency</label>
                <select value={ptData.progress_freq} onChange={e => updPt("progress_freq", e.target.value)} style={{ ...inp }}>
                  {V_PROGRESS_FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            )}
            {V_PT_HAS_RETENTION.has(effPTType) && (
              <div style={{ marginBottom: 10, padding: "12px 14px", background: "#FFFBEB", borderRadius: 8, border: "1px solid #FDE68A" }}>
                <label style={{ ...lbl, color: "#D97706" }}>Retention %</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input type="number" min="0" max="100" value={ptData.retention_percent} onChange={e => updPt("retention_percent", e.target.value)}
                    style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 6, width: 80, textAlign: "right", fontFamily: "inherit" }} />
                  <span style={{ fontSize: 12, color: "#6B6B6B" }}>%</span>
                  {total > 0 && <span style={{ fontSize: 12, fontFamily: "monospace", color: "#D97706", fontWeight: 700 }}>= ₱ {fmtPeso(total * parseFloat(ptData.retention_percent || 0) / 100)}</span>}
                </div>
                {[{ val: "each_invoice", label: "Withhold from each progress invoice" }, { val: "final_invoice", label: "Deduct on final invoice only" }].map(opt => (
                  <label key={opt.val} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, cursor: "pointer", fontSize: 12 }}>
                    <input type="radio" name="ret_deduct" value={opt.val}
                      checked={(ptData.retention_deduction_mode || "each_invoice") === opt.val}
                      onChange={() => updPt("retention_deduction_mode", opt.val)} />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* â”€â”€ Section 3: Right to Bill & Release â”€â”€ */}
      <div style={{ ...card }}>
        <div style={sTitle}>3. Right to Bill & Release</div>
        <div style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 14 }}>Standard timelines are pre-filled. Modify only if you require different terms.</div>
        {hasDP && (
          <VReleaseRow label="Downpayment Release" sublabel="Eligible after contract signing & downpayment invoice submission"
            std={15} unit="days" val={ptData.dp_release_days} onChange={v => updPt("dp_release_days", v)}
            remarks={ptData.dp_release_remarks} onRemarks={v => updPt("dp_release_remarks", v)}
            color="#2563EB" bg="#EFF6FF" border="#BFDBFE"
            conditions={rfqPTData.dp_bill_conditions || ""}
            fixed={!!rfqPTData.dp_release_fixed}
            docs={rfqPTData.dp_billing_docs || []}
            required={rfqPTData.dp_release_days} />
        )}
        {hasProg && (
          <VReleaseRow label="Progress Payment Release"
            sublabel={`Per billing frequency (${V_PROGRESS_FREQS.find(f => f.value === ptData.progress_freq)?.label || "Monthly"})`}
            std={30} unit="days" val={ptData.progress_release_days} onChange={v => updPt("progress_release_days", v)}
            remarks={ptData.progress_release_remarks} onRemarks={v => updPt("progress_release_remarks", v)}
            color="#059669" bg="#F0FDF4" border="#BBF7D0"
            conditions={rfqPTData.progress_bill_conditions || ""}
            fixed={!!rfqPTData.progress_release_fixed}
            docs={rfqPTData.progress_billing_docs || []}
            required={rfqPTData.progress_release_days}
            billingCutoffDay={rfqPTData.progress_billing_cutoff_day}
            paymentTargetDay={rfqPTData.progress_payment_target_day} />
        )}
        {hasRet && rfqPTData.retention_partial && (() => {
          const firstPct  = parseInt(rfqPTData.retention_partial_pct || 50);
          const finalPct  = 100 - firstPct;
          const triggerEntry = RETENTION_PARTIAL_TRIGGERS.find(t => t.value === (rfqPTData.retention_partial_trigger || "final_acceptance"));
          const triggerLabel = rfqPTData.retention_partial_trigger === "custom"
            ? (rfqPTData.retention_partial_trigger_custom || "custom event")
            : (triggerEntry?.label || "Final Acceptance");
          return (
            <React.Fragment>
              <VReleaseRow label={`Retention — 1st Release (${firstPct}%)`}
                sublabel={`After ${triggerLabel}`}
                std={30} unit="days" val={ptData.retention_partial_release_days || "30"} onChange={v => updPt("retention_partial_release_days", v)}
                remarks={ptData.retention_billing_remarks} onRemarks={v => updPt("retention_billing_remarks", v)}
                color="#D97706" bg="#FFFBEB" border="#FDE68A"
                conditions={rfqPTData.retention_bill_conditions || ""}
                fixed={!!rfqPTData.retention_release_fixed}
                docs={rfqPTData.retention_billing_docs || []}
                required={rfqPTData.retention_partial_release_days} />
              <VReleaseRow label={`Retention — Final Release (${finalPct}%)`}
                sublabel="After DLP / warranty period"
                std={12} unit="months" val={ptData.retention_billing_months} onChange={v => updPt("retention_billing_months", v)}
                remarks="" onRemarks={() => {}}
                color="#D97706" bg="#FFFBEB" border="#FDE68A"
                fixed={!!rfqPTData.retention_release_fixed}
                required={rfqPTData.retention_billing_months} />
            </React.Fragment>
          );
        })()}
        {hasRet && !rfqPTData.retention_partial && (
          <VReleaseRow label="Retention Release" sublabel="Eligible after warranty / defects liability period"
            std={12} unit="months" val={ptData.retention_billing_months} onChange={v => updPt("retention_billing_months", v)}
            remarks={ptData.retention_billing_remarks} onRemarks={v => updPt("retention_billing_remarks", v)}
            color="#D97706" bg="#FFFBEB" border="#FDE68A"
            conditions={rfqPTData.retention_bill_conditions || ""}
            fixed={!!rfqPTData.retention_release_fixed}
            docs={rfqPTData.retention_billing_docs || []}
            required={rfqPTData.retention_billing_months} />
        )}
        {hasComp && (
          <VReleaseRow label="Completion Payment Release" sublabel="After final acceptance of completed works"
            std={30} unit="days" val={ptData.completion_release_days} onChange={v => updPt("completion_release_days", v)}
            remarks={ptData.completion_release_remarks} onRemarks={v => updPt("completion_release_remarks", v)}
            color="#059669" bg="#F0FDF4" border="#BBF7D0"
            conditions={rfqPTData.completion_bill_conditions || ""}
            fixed={!!rfqPTData.completion_release_fixed}
            docs={rfqPTData.completion_billing_docs || []}
            required={rfqPTData.completion_release_days} />
        )}
        {!hasDP && !hasProg && !hasRet && !hasComp && (
          <div style={{ fontSize: 12, color: "#C7C7CC", fontStyle: "italic" }}>Select a payment type in Section 2 to configure release schedule.</div>
        )}
      </div>

      {/* â”€â”€ Section 4: Bond Requirements â”€â”€ */}
      <div style={{ ...card }}>
        <div style={sTitle}>4. Bond Requirements</div>
        <div style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 14 }}>Auto-computed from your payment structure. Override with justification if needed.</div>
        {hasDP && (
          <VBondRow label="Surety / Advance Payment Bond" color="#2563EB"
            auto={bonds.surety} total={total} autoLabel={`${ptData.dp_percent || 20}% (= DP%)`}
            isOverride={!!ptData.surety_bond_override} onToggleOverride={v => updPt("surety_bond_override", v)}
            overrideAmt={ptData.surety_bond_override_amount} onOverrideAmt={v => updPt("surety_bond_override_amount", v)}
            remarks={ptData.surety_bond_remarks} onRemarks={v => updPt("surety_bond_remarks", v)}
            releaseVal={ptData.surety_bond_release} onRelease={v => updPt("surety_bond_release", v)} />
        )}
        {hasProg && (
          <VBondRow label="Performance Bond" color="#059669"
            auto={bonds.performance} total={total} pctVal={ptData.performance_bond_percent} onPct={v => updPt("performance_bond_percent", v)}
            isOverride={!!ptData.performance_bond_override} onToggleOverride={v => updPt("performance_bond_override", v)}
            overrideAmt={ptData.performance_bond_override_amount} onOverrideAmt={v => updPt("performance_bond_override_amount", v)}
            remarks={ptData.performance_bond_remarks} onRemarks={v => updPt("performance_bond_remarks", v)}
            releaseVal={ptData.performance_bond_release} onRelease={v => updPt("performance_bond_release", v)} />
        )}
        {hasRet && (
          <VBondRow label="Warranty / Guarantee Bond" color="#D97706"
            auto={bonds.warranty} total={total} autoLabel={`${ptData.retention_percent || 10}% (= Retention%)`}
            isOverride={!!ptData.warranty_bond_override} onToggleOverride={v => updPt("warranty_bond_override", v)}
            overrideAmt={ptData.warranty_bond_override_amount} onOverrideAmt={v => updPt("warranty_bond_override_amount", v)}
            remarks={ptData.warranty_bond_remarks} onRemarks={v => updPt("warranty_bond_remarks", v)}
            releaseVal={ptData.warranty_bond_release} onRelease={v => updPt("warranty_bond_release", v)} />
        )}
        {!hasDP && !hasProg && !hasRet && (
          <div style={{ fontSize: 12, color: "#C7C7CC", fontStyle: "italic" }}>Select a payment type in Section 2 to see applicable bonds.</div>
        )}
      </div>

      {/* â”€â”€ Section 5: Timeline & Warranty â”€â”€ */}
      <div style={{ ...card }}>
        <div style={sTitle}>5. Timeline & Warranty</div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Commencement</label>
          {[{ val: "noa_ntp", label: "From Notice of Award / Notice to Proceed" }, { val: "receipt_dp", label: "From receipt of Downpayment" }].map(opt => (
            <label key={opt.val} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, cursor: "pointer", fontSize: 13 }}>
              <input type="radio" name="commencement_type" value={opt.val}
                checked={(ptData.commencement_type || "noa_ntp") === opt.val}
                onChange={() => updPt("commencement_type", opt.val)} />
              {opt.label}
            </label>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input type="number" min="0" value={ptData.commencement_days} onChange={e => updPt("commencement_days", e.target.value)}
              style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 6, width: 80, textAlign: "right", fontFamily: "inherit" }} />
            <span style={{ fontSize: 12, color: "#6B6B6B" }}>calendar days mobilization before work starts</span>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Work Duration</label>
          {rfq.work_duration && <div style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 6 }}>Required: {rfq.work_duration} calendar days</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" min="1" value={ptData.work_duration} onChange={e => updPt("work_duration", e.target.value)}
              style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 6, width: 80, textAlign: "right", fontFamily: "inherit" }} />
            <select value={ptData.work_duration_type || "calendar_days"} onChange={e => updPt("work_duration_type", e.target.value)}
              style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 6, fontFamily: "inherit" }}>
              <option value="calendar_days">Calendar days</option>
              <option value="working_days">Working days</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Warranty Period (months)</label>
          {rfq.contract_terms?.warranty_months && <div style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 6 }}>Required: {rfq.contract_terms.warranty_months} months</div>}
          <input type="number" min="0" value={ptData.warranty_period} onChange={e => updPt("warranty_period", e.target.value)}
            style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 6, width: 80, textAlign: "right", fontFamily: "inherit" }} />
        </div>
        <div>
          <label style={lbl}>Price Validity Date</label>
          <div style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 6 }}>This quotation is valid until:</div>
          <input type="date" value={priceValidity} onChange={e => setPriceValidity(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 13, border: "1px solid #E5E5EA", borderRadius: 6, fontFamily: "inherit" }} />
        </div>
      </div>

      {/* â”€â”€ Section 6: Notes & Attachment â”€â”€ */}
      <div style={{ ...card }}>
        <div style={sTitle}>6. Notes & Attachment</div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Notes / Remarks (optional)</label>
          <textarea value={vendorNotes} onChange={e => setVendorNotes(e.target.value)} rows={3}
            style={{ ...inp, resize: "vertical" }} />
        </div>
        <div>
          <label style={lbl}>Formal Quotation Document (optional)</label>
          {attachUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <a href={attachUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#3F3F3F" }}>{attachName || "Uploaded file"}</a>
              <button onClick={() => { setAttachUrl(""); setAttachName(""); }}
                style={{ fontSize: 11, color: "#C7C7CC", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
            </div>
          ) : (
            <div>
              <input type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" onChange={e => handleUpload(e.target.files?.[0])}
                style={{ fontSize: 13 }} />
              {uploading && <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 4 }}>Uploading…</div>}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleSaveDraft} disabled={savingDraft}
          style={{ flex: 1, padding: "13px 0", background: "#fff", color: "#3F3F3F", border: "1px solid #3F3F3F", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: savingDraft ? "not-allowed" : "pointer", opacity: savingDraft ? 0.6 : 1 }}>
          {savingDraft ? "Saving…" : "Save Draft"}
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ flex: 2, padding: "13px 0", background: "#3F3F3F", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Submitting…" : existingSubmission ? `Submit Revised Quotation (v${existingSubmission.version + 1})` : "Submit Quotation"}
        </button>
      </div>
    </div>
    </div>
  );
}

// ─── PREPARE SCREEN HELPERS ──────────────────────────────────────────────────
function PrepBadge({ type, label }) {
  const styles = {
    req:  { bg: "#FEF0ED", color: "#9B3922", border: "#FBCFBE" },
    sec:  { bg: "#FEF3E2", color: "#92580A", border: "#FDE68A" },
    pref: { bg: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" },
  };
  const s = styles[type] || styles.pref;
  return (
    <span style={{
      display: "inline-block", fontSize: 10.5, fontWeight: 700,
      padding: "2px 8px", borderRadius: 99, flexShrink: 0,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{label}</span>
  );
}

function PrepDocRow({ name, note, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.textPri, fontWeight: 500 }}>{name}</div>
        {note && <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{note}</div>}
      </div>
      {badge}
    </div>
  );
}

function PrepTierCheck({ ok, amber, text }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0" }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: ok ? C.greenBg : amber ? C.amberBg : C.grayBg,
        border: `1.5px solid ${ok ? "#86EFAC" : amber ? "#FDE68A" : C.border}`,
      }}>
        {ok    && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4L3 5.5L6.5 2" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {amber && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 2v2.2M4 5.8h.01" stroke="#92580A" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        {!ok && !amber && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M2.5 2.5L5.5 5.5M5.5 2.5L2.5 5.5" stroke={C.borderMid} strokeWidth="1.5" strokeLinecap="round"/></svg>}
      </div>
      <div style={{ fontSize: 12, color: ok ? C.greenText : amber ? C.amberText : C.textTer, lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}

function PrepTierCard({ cls, name, po, checks }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px 10px", background: C.offWhite, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.08em" }}>{cls}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri, marginTop: 2 }}>{name}</div>
        <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{po}</div>
      </div>
      <div style={{ padding: "10px 14px" }}>
        {checks.map((c, i) => <PrepTierCheck key={i} ok={c.ok} amber={c.amber} text={c.text} />)}
      </div>
    </div>
  );
}

// ─── VENDOR ACCREDITATION PAGE ───────────────────────────────────────────────
function VendorAccreditationPage({ token }) {
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);
  const [tokenRow, setTokenRow]           = useState(null);
  const [existingVendor, setExistingVendor] = useState(null);
  const [existingDocs, setExistingDocs]   = useState([]);
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [isReturned, setIsReturned]       = useState(false);
  const [returnNotes, setReturnNotes]     = useState("");
  const [sigSalesManager, setSigSalesManager] = useState(null); // drawn signature data-URL
  const [sigPresident, setSigPresident]       = useState(null);
  const [draftSavedAt, setDraftSavedAt]       = useState(null);
  const [draftSaving, setDraftSaving]         = useState(false);
  const [draftSaveError, setDraftSaveError]   = useState(false);
  const [startingApp, setStartingApp]         = useState(false);
  const draftTimer                            = useRef(null);
  const [fieldReqs, setFieldReqs]             = useState({}); // by_type field requirements from settings

  const [form, setForm] = useState({
    company_name: "", primary_activity: "", trade_categories: [], primary_activities: [],
    registered_address: "", satellite_address: "",
    location_map_url: "",
    satellite_map_url: "",
    client_list: [{ name: "", project: "", year: "", value: "" }],
    equipment_list: [{ item: "", brand: "", qty: "", condition: "" }],
    stockholder_list: [{ name: "", position: "", address: "", contact_no: "", tin_no: "" }],
    key_contacts: {
      president:          { name: "", contact: "", nationality: "" },
      accounting_manager: { name: "", contact: "", nationality: "" },
      sales_manager:      { name: "", contact: "", nationality: "" },
      delivery_incharge:  { name: "", contact: "", nationality: "" },
      technical_incharge: { name: "", contact: "", nationality: "" },
    },
    telephone: "", cell_number: "", rfq_emails: [""],
    contact_person: "", contact_position: "",
    authorized_representative: "", representative_title: "",
    vendor_type: "", // selected by vendor upfront; determines required fields
    registration_type: "", // "DTI" | "SEC"
    tin: "",
    tax_classification: "", // "VAT" | "Non-VAT"
    ewt_entries: [{ rate: "", rate_other: "", description: "" }],
    bank_name: "", bank_account_name: "", bank_account_number: "", bank_branch: "",
    // Compliance
    num_employees: "",
    is_subsidiary: "",         // "yes" | "no"
    parent_company_name: "",
    parent_company_country: "",
    has_hs_adviser: "",        // "yes" | "no"
    hs_adviser_details: "",
    has_hs_policy: "",         // "yes" | "no"
    has_qms: "",               // "yes" | "no"
    has_internal_qms: "",      // "yes" | "no"
    has_env_management: "",    // "yes" | "no"
    // Declaration
    signatory_sales_manager: "",
    signatory_president: "",
    declaration_confirmed: false,
    authorization_confirmed: false,
  });

  const [docFiles, setDocFiles]       = useState({});
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [docExpiry, setDocExpiry]     = useState({});  // { [docType]: { loading, expiry_date, source, ai_read_date, correction_date, correction_status } }
  const [docRegInfo, setDocRegInfo]   = useState({});  // { [docType]: { reg_number, reg_date } }
  const [ewtFiles, setEwtFiles]       = useState([]);  // new PDF files per ewt_entry index
  const [uploadedEwtDocs, setUploadedEwtDocs] = useState([]); // existing { url, name } per index
  const [started, setStarted]         = useState(false);
  const [showPrepare, setShowPrepare] = useState(false);
  const [bus, setBus]                 = useState(_busCache || []);
  const [busLoading, setBusLoading]   = useState(_busCache === null);
  const [tradeCats, setTradeCats]     = useState([]);
  const [customTradeInput, setCustomTradeInput] = useState("");
  const [activeTab, setActiveTab]     = useState("company");
  const [viewMode, setViewMode]       = useState("hub"); // "hub" | "detail"
  const [ph1LogoUrl, setPh1LogoUrl]   = useState(null);

  useEffect(() => {
    load();
    _busFetch.then(data => { setBus(data); setBusLoading(false); });
    supabase.from("business_units").select("logo_url").eq("name", "PH1 World Developers Inc.").maybeSingle()
      .then(({ data }) => { if (data?.logo_url) setPh1LogoUrl(data.logo_url); });
    supabase.from("trade_categories").select("name").eq("is_approved", true).order("display_order").order("name")
      .then(({ data }) => setTradeCats((data || []).map(t => t.name)));
  }, []);

  const load = async () => {
    // Load field requirements config (applies regardless of token)
    const { data: frRow } = await supabase.from("settings").select("value").eq("key", "accreditation_field_requirements").maybeSingle();
    if (frRow?.value) {
      try { setFieldReqs(JSON.parse(frRow.value)?.by_type || {}); } catch {}
    }

    if (token) {
      // Step 1: fetch just the token row (no embedded join — vendor_id is TEXT,
      // not a real FK to vendors.id, so PostgREST can't resolve the join)
      const { data: tRow, error: tErr } = await supabase
        .from("vendor_accreditation_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tErr) console.error("Token lookup error:", tErr.message);
      if (!tRow) { setNotFound(true); setLoading(false); return; }
      setTokenRow(tRow);

      // Step 2: if token already linked to a vendor, fetch it by integer id.
      // vendor_code in DB may be NULL (pre-accreditation); parse the id from
      // the VEN code stored in the token (e.g. "VEN-000001" → id 1).
      if (tRow.vendor_id) {
        const parsedId = parseInt(tRow.vendor_id.replace(/^VEN-/, ""), 10);
        const { data: vRow } = await supabase
          .from("vendors")
          .select("id, vendor_code, accreditation_status, return_notes, vendor_company_info(*)")
          .eq("id", parsedId)
          .maybeSingle();

        if (vRow) {
          // Ensure vendor_code is set in state even when null in DB (pre-accreditation)
          const v = { ...vRow, vendor_code: vRow.vendor_code || tRow.vendor_id };
          const ci = vRow.vendor_company_info;
        setExistingVendor(v);
        setIsReturned(v.accreditation_status === "Returned");
        setReturnNotes(v.return_notes || "");
        if (ci) {
          setForm({
            company_name: ci.company_name || "",
            primary_activity: ci.primary_activity || "",
            trade_categories: ci.trade_categories?.length ? ci.trade_categories : (ci.primary_activity ? [ci.primary_activity] : []),
            primary_activities: ci.primary_activities || [],
            satellite_address: ci.satellite_address || "",
            location_map_url: ci.location_map_url || "",
            satellite_map_url: ci.satellite_map_url || "",
            client_list: ci.client_list?.length ? ci.client_list : [{ name: "", project: "", year: "", value: "" }],
            equipment_list: ci.equipment_list?.length ? ci.equipment_list : [{ item: "", brand: "", qty: "", condition: "" }],
            stockholder_list: ci.stockholder_list?.length ? ci.stockholder_list : [{ name: "", position: "", address: "", contact_no: "", tin_no: "" }],
            key_contacts: (() => {
              const kc  = ci.key_contacts || {};
              const def = { name: "", contact: "", nationality: "" };
              return {
                president:          { ...def, ...(kc.president          || {}) },
                accounting_manager: { ...def, ...(kc.accounting_manager || {}) },
                sales_manager:      { ...def, ...(kc.sales_manager      || {}) },
                delivery_incharge:  { ...def, ...(kc.delivery_incharge  || {}) },
                technical_incharge: { ...def, ...(kc.technical_incharge || {}) },
              };
            })(),
            registered_address: ci.registered_address || "",
            telephone: ci.telephone || "",
            cell_number: ci.cell_number || "",
            rfq_emails: (ci.rfq_email || tRow.invited_email || "").split(",").map(e => e.trim()).filter(Boolean).concat([""]),
            contact_person: ci.contact_person || "",
            contact_position: ci.contact_position || "",
            authorized_representative: ci.authorized_representative || "",
            representative_title: ci.representative_title || "",
            vendor_type: ci.vendor_type || "",
            registration_type: ci.registration_type || "",
            tin: ci.tin || "",
            tax_classification: ci.tax_classification || "",
            ewt_entries: ci.ewt_entries?.length ? ci.ewt_entries : [{ rate: "", rate_other: "", description: "" }],
            bank_name: ci.bank_name || "",
            bank_account_name: ci.bank_account_name || "",
            bank_account_number: ci.bank_account_number || "",
            bank_branch: ci.bank_branch || "",
            num_employees: ci.num_employees != null ? String(ci.num_employees) : "",
            is_subsidiary: ci.is_subsidiary != null ? (ci.is_subsidiary ? "yes" : "no") : "",
            parent_company_name: ci.parent_company_name || "",
            parent_company_country: ci.parent_company_country || "",
            has_hs_adviser: ci.has_hs_adviser != null ? (ci.has_hs_adviser ? "yes" : "no") : "",
            hs_adviser_details: ci.hs_adviser_details || "",
            has_hs_policy: ci.has_hs_policy != null ? (ci.has_hs_policy ? "yes" : "no") : "",
            has_qms: ci.has_qms != null ? (ci.has_qms ? "yes" : "no") : "",
            has_internal_qms: ci.has_internal_qms != null ? (ci.has_internal_qms ? "yes" : "no") : "",
            has_env_management: ci.has_env_management != null ? (ci.has_env_management ? "yes" : "no") : "",
            signatory_sales_manager: ci.signatory_sales_manager || "",
            signatory_president: ci.signatory_president || "",
            // Pre-check if vendor already submitted/accredited (declaration_confirmed_at set,
            // or status indicates they submitted before this field was added).
            // Returned vendors keep their prior confirmation — they already agreed to the terms
            // and just need to correct specific flagged items before resubmitting.
            declaration_confirmed:   !!(ci.declaration_confirmed_at || ["Submitted","Under Review","Accredited","Declined","Returned"].includes(v.accreditation_status)),
            authorization_confirmed: !!(ci.declaration_confirmed_at || ["Submitted","Under Review","Accredited","Declined","Returned"].includes(v.accreditation_status)),
          });
        }
        const { data: docs } = await supabase
          .from("vendor_documents")
          .select("document_type, file_url, file_name")
          .eq("vendor_id", tRow.vendor_id);  // tRow.vendor_id is now text (VEN-000001)
        const docMap = {};
        const ewtMap = {};
        (docs || []).forEach(d => {
          const ewtMatch = d.document_type.match(/^EWT Proof (\d+)$/);
          if (ewtMatch) {
            ewtMap[parseInt(ewtMatch[1]) - 1] = { url: d.file_url, name: d.file_name };
          } else {
            docMap[d.document_type] = { url: d.file_url, name: d.file_name };
          }
        });
        setUploadedDocs(docMap);
        // Rebuild uploadedEwtDocs array from ewtMap (index-aligned)
        if (Object.keys(ewtMap).length > 0) {
          const maxIdx = Math.max(...Object.keys(ewtMap).map(Number));
          const arr = Array.from({ length: maxIdx + 1 }, (_, i) => ewtMap[i] || null);
          setUploadedEwtDocs(arr);
        }

        // Load previously saved expiry data
        const { data: expiryRows } = await supabase
          .from("vendor_doc_expiry")
          .select("*")
          .eq("vendor_id", tRow.vendor_id);
        const expiryMap = {};
        const regMap = {};
        (expiryRows || []).forEach(r => {
          expiryMap[r.doc_type] = { ...r, loading: false };
          if (r.reg_number || r.reg_date) {
            regMap[r.doc_type] = { reg_number: r.reg_number || "", reg_date: r.reg_date || "" };
          }
        });
        setDocExpiry(expiryMap);
        setDocRegInfo(regMap);
        } // end if (vRow)
      } else if (tRow.invited_email) {
        setForm(f => ({ ...f, rfq_emails: [tRow.invited_email, ""] }));
      }
    }
    setLoading(false);
  };

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleDocFile = (docType, file) => setDocFiles(p => ({ ...p, [docType]: file }));

  const handleDeleteDoc = (docType) => {
    setDocFiles(p => { const n = { ...p }; delete n[docType]; return n; });
    setUploadedDocs(p => { const n = { ...p }; delete n[docType]; return n; });
  };
  const handleRegInfoChange = (docType, field, value) => {
    setDocRegInfo(p => ({ ...p, [docType]: { ...p[docType], [field]: value } }));
  };
  const handleExpiryChange = (docType, date) => {
    setDocExpiry(p => ({ ...p, [docType]: { ...p[docType], expiry_date: date, source: "manual" } }));
  };

  // ── Auto-save draft ──────────────────────────────────────────────────────────
  const saveDraft = useCallback(async (currentForm, currentDocExpiry = {}, currentDocRegInfo = {}) => {
    const vendorId = existingVendor?.vendor_code;
    if (!vendorId) return; // new vendors: no id yet, skip
    setDraftSaving(true);
    try {
      const payload = {
        vendor_id: vendorId,
        company_name: currentForm.company_name.trim(),
        primary_activity: currentForm.trade_categories.join(", "),
        trade_categories: currentForm.trade_categories,
        primary_activities: currentForm.primary_activities,
        registered_address: currentForm.registered_address.trim(),
        satellite_address: currentForm.satellite_address.trim(),
        location_map_url: currentForm.location_map_url.trim(),
        satellite_map_url: currentForm.satellite_map_url.trim(),
        client_list: currentForm.client_list.filter(r => r.name.trim()),
        equipment_list: currentForm.equipment_list.filter(r => r.item.trim()),
        stockholder_list: currentForm.stockholder_list.filter(r => r.name.trim()),
        key_contacts: currentForm.key_contacts,
        telephone: currentForm.telephone.trim(),
        cell_number: currentForm.cell_number.trim(),
        rfq_email: currentForm.rfq_emails.filter(e => e.trim()).join(","),
        contact_person: currentForm.contact_person.trim(),
        contact_position: currentForm.contact_position.trim(),
        authorized_representative: currentForm.authorized_representative.trim(),
        representative_title: currentForm.representative_title.trim(),
        vendor_type: currentForm.vendor_type || null,
        registration_type: currentForm.registration_type || null,
        tin: currentForm.tin.trim() || null,
        tax_classification: currentForm.tax_classification || null,
        ewt_entries: currentForm.ewt_entries.filter(e => e.rate || e.description.trim()),
        bank_name: currentForm.bank_name.trim() || null,
        bank_account_name: currentForm.bank_account_name.trim() || null,
        bank_account_number: currentForm.bank_account_number.trim() || null,
        bank_branch: currentForm.bank_branch.trim() || null,
        num_employees: currentForm.num_employees ? parseInt(currentForm.num_employees) : null,
        is_subsidiary: currentForm.is_subsidiary === "yes" ? true : currentForm.is_subsidiary === "no" ? false : null,
        parent_company_name: currentForm.parent_company_name.trim() || null,
        parent_company_country: currentForm.parent_company_country.trim() || null,
        has_hs_adviser: currentForm.has_hs_adviser === "yes" ? true : currentForm.has_hs_adviser === "no" ? false : null,
        hs_adviser_details: currentForm.hs_adviser_details.trim() || null,
        has_hs_policy: currentForm.has_hs_policy === "yes" ? true : currentForm.has_hs_policy === "no" ? false : null,
        has_qms: currentForm.has_qms === "yes" ? true : currentForm.has_qms === "no" ? false : null,
        has_internal_qms: currentForm.has_internal_qms === "yes" ? true : currentForm.has_internal_qms === "no" ? false : null,
        has_env_management: currentForm.has_env_management === "yes" ? true : currentForm.has_env_management === "no" ? false : null,
        signatory_sales_manager: currentForm.signatory_sales_manager.trim() || null,
        signatory_president: currentForm.signatory_president.trim() || null,
      };
      const { data: existing } = await supabase
        .from("vendor_company_info").select("vendor_id").eq("vendor_id", vendorId).maybeSingle();
      let saveError = null;
      if (existing) {
        const { error } = await supabase.from("vendor_company_info").update(payload).eq("vendor_id", vendorId);
        saveError = error;
      } else {
        const { error } = await supabase.from("vendor_company_info").insert(payload);
        saveError = error;
      }
      if (saveError) {
        console.error("Draft save error:", saveError);
        setDraftSaveError(true);
        return;
      }
      // Also persist expiry dates and registration info so they survive between sessions
      const allTrackedDocs = [...new Set([...GOV_DOCS, ...COMPANY_ID_DOCS])];
      for (const docType of allTrackedDocs) {
        const expiry  = currentDocExpiry[docType];
        const regInfo = currentDocRegInfo[docType];
        if (!expiry?.expiry_date && !regInfo?.reg_number && !regInfo?.reg_date) continue;
        const { error: expiryErr } = await supabase.from("vendor_doc_expiry").upsert({
          vendor_id: vendorId,
          doc_type: docType,
          expiry_date: expiry?.expiry_date || null,
          source: expiry?.source || "manual",
          reg_number: regInfo?.reg_number?.trim() || null,
          reg_date: regInfo?.reg_date || null,
        }, { onConflict: "vendor_id,doc_type" });
        if (expiryErr) console.error("vendor_doc_expiry draft save failed for", docType, expiryErr.message);
      }

      setDraftSaveError(false);
      setDraftSavedAt(new Date());
    } catch (e) {
      console.error("Auto-save failed:", e);
      setDraftSaveError(true);
    } finally {
      setDraftSaving(false);
    }
  }, [existingVendor]);

  // Debounce: save 2 seconds after the last form, expiry, or reg-info change
  useEffect(() => {
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveDraft(form, docExpiry, docRegInfo), 2000);
    return () => clearTimeout(draftTimer.current);
  }, [form, docExpiry, docRegInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called when vendor clicks "Start Application" on the landing page.
  // For returning vendors: just show the form.
  // For new vendors: create a draft vendor + company_info row immediately
  // so auto-save works from the first keystroke onwards.
  //
  // Deduplication: before creating a new vendor row, check if ANY token
  // for the same invited email is already linked to a vendor. If so,
  // reuse that vendor rather than creating a duplicate VEN-XXXXXX.
  const handleStart = async () => {
    if (existingVendor) { setStarted(true); return; }
    setStartingApp(true);
    try {
      const invitedEmail = tokenRow?.invited_email;

      // 1. Check all tokens for this email — one may already be linked to a vendor
      let resolvedVendorCode = null;
      if (invitedEmail) {
        const { data: siblingTokens } = await supabase
          .from("vendor_accreditation_tokens")
          .select("vendor_id")
          .eq("invited_email", invitedEmail)
          .not("vendor_id", "is", null);
        resolvedVendorCode = resolveVendorFromTokens(siblingTokens || []);
      }

      let vendorForState;

      if (resolvedVendorCode) {
        // 2a. Existing vendor found — fetch by integer id (vendor_code may be NULL pre-accreditation)
        const parsedId = parseInt(resolvedVendorCode.replace(/^VEN-/, ""), 10);
        const { data: existingVRow } = await supabase
          .from("vendors")
          .select("id, vendor_code, accreditation_status")
          .eq("id", parsedId)
          .maybeSingle();
        // Ensure vendor_code is set in state even when null in DB
        vendorForState = existingVRow
          ? { ...existingVRow, vendor_code: existingVRow.vendor_code || resolvedVendorCode }
          : { id: parsedId, vendor_code: resolvedVendorCode, accreditation_status: "Draft" };
      } else {
        // 2b. No existing vendor — create a fresh draft
        const { data: vRow, error: vErr } = await supabase
          .from("vendors")
          .insert({ accreditation_status: "Draft", profile_id: null })
          .select("id, vendor_code")
          .single();
        if (vErr || !vRow) { console.error("Draft create failed:", vErr); setStarted(true); return; }

        // vendor_code is now NULL in DB until accreditation; compute it from integer id
        const computedCode = venCode(vRow.id);
        await supabase.from("vendor_company_info").insert({
          vendor_id: computedCode,
          company_name: "",
          rfq_email: invitedEmail || "",
        });
        vendorForState = { ...vRow, vendor_code: computedCode, accreditation_status: "Draft" };
      }

      // 3. Link this token to the resolved vendor
      if (tokenRow?.id) {
        await supabase.from("vendor_accreditation_tokens")
          .update({ vendor_id: vendorForState.vendor_code })
          .eq("id", tokenRow.id);
      }

      // 4. Set existingVendor so saveDraft can upsert from now on
      setExistingVendor(vendorForState);
    } catch (e) {
      console.error("handleStart error:", e);
    } finally {
      setStartingApp(false);
      setStarted(true);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const required = ["company_name", "registered_address", "cell_number", "contact_person", "authorized_representative"];
    const missing = required.filter(k => !form[k].trim());
    if (!form.rfq_emails.some(e => e.trim())) missing.push("email address");
    if (form.trade_categories.length === 0) missing.push("primary activity / trade");
    if (missing.length > 0) {
      alert("Please fill in all required fields:\n• " + missing.map(k => k.replace(/_/g, " ")).join("\n• "));
      return;
    }
    if (!isValidMobile(form.cell_number)) {
      alert("Please enter a valid Philippine mobile number for Cell Number (e.g. 09XXXXXXXXX).");
      return;
    }

    // Vendor-type field requirements validation
    const fieldCfg = fieldReqs[form.vendor_type] || {};
    const cfgMissing = [];
    if (fieldCfg.location_map_url && !form.location_map_url.trim()) cfgMissing.push("Location map URL");
    if (fieldCfg.telephone && !form.telephone.trim()) cfgMissing.push("Telephone");
    if (fieldCfg.contact_position && !form.contact_position.trim()) cfgMissing.push("Contact position");
    if (fieldCfg.representative_title && !form.representative_title.trim()) cfgMissing.push("Representative title");
    if (fieldCfg.satellite_address && !form.satellite_address.trim()) cfgMissing.push("Satellite / branch address");
    if (fieldCfg.num_employees && !form.num_employees) cfgMissing.push("Number of employees");
    if (fieldCfg.is_subsidiary && !form.is_subsidiary) cfgMissing.push("Subsidiary / ownership status");
    if (fieldCfg["key_contacts.president"] && !form.key_contacts.president?.name?.trim()) cfgMissing.push("President (key contacts)");
    if (fieldCfg["key_contacts.accounting_manager"] && !form.key_contacts.accounting_manager?.name?.trim()) cfgMissing.push("Accounting Manager (key contacts)");
    if (fieldCfg["key_contacts.sales_manager"] && !form.key_contacts.sales_manager?.name?.trim()) cfgMissing.push("Sales Manager (key contacts)");
    if (fieldCfg["key_contacts.delivery_incharge"] && !form.key_contacts.delivery_incharge?.name?.trim()) cfgMissing.push("Delivery In-charge (key contacts)");
    if (fieldCfg["key_contacts.technical_incharge"] && !form.key_contacts.technical_incharge?.name?.trim()) cfgMissing.push("Technical In-charge (key contacts)");
    if (fieldCfg.tin && !form.tin.trim()) cfgMissing.push("TIN (Tax Identification Number)");
    if (fieldCfg.tax_classification && !form.tax_classification) cfgMissing.push("Tax classification (VAT / Non-VAT)");
    if (fieldCfg.registration_type && !form.registration_type) cfgMissing.push("Registration type (DTI / SEC)");
    if (fieldCfg.ewt_entries && !form.ewt_entries.some(e => e.rate && e.description.trim())) cfgMissing.push("EWT entry (at least one)");
    if (fieldCfg.bank_details && !["bank_name","bank_account_name","bank_account_number","bank_branch"].every(k => form[k]?.trim())) cfgMissing.push("Bank details (all four fields)");
    if (fieldCfg["compliance.has_hs_adviser"] && !form.has_hs_adviser) cfgMissing.push("H&S adviser status");
    if (fieldCfg["compliance.has_hs_policy"] && !form.has_hs_policy) cfgMissing.push("H&S policy status");
    if (fieldCfg["compliance.has_qms"] && !form.has_qms) cfgMissing.push("QMS (quality management)");
    if (fieldCfg["compliance.has_env_management"] && !form.has_env_management) cfgMissing.push("Environmental management status");
    if (fieldCfg.signatories && (!form.signatory_sales_manager.trim() || !form.signatory_president.trim())) cfgMissing.push("Declaration signatories (Sales Manager & President)");
    if (cfgMissing.length > 0) {
      alert("Your vendor type requires the following fields to be completed:\n• " + cfgMissing.join("\n• "));
      return;
    }

    setSubmitting(true);

    try {
      let vendorId = existingVendor?.vendor_code || null;

      if (!vendorId) {
        // Brand-new vendor — first submission
        const { data: vRow, error: vErr } = await supabase
          .from("vendors")
          .insert({ accreditation_status: "Submitted", profile_id: null })
          .select("id, vendor_code")
          .single();
        if (vErr || !vRow) {
          alert("Submission failed: " + (vErr?.message || "unknown error"));
          return;
        }
        vendorId = vRow.vendor_code || venCode(vRow.id);
      } else if (isAccredited) {
        // Accredited vendor updating their profile — keep status, flag as pending update
        await supabase.from("vendors").update({
          has_pending_update: true,
          update_submitted_at: new Date().toISOString(),
        }).eq("id", existingVendor.id);          // integer PK, not vendor_code
      } else {
        // Resubmission after return
        await supabase.from("vendors").update({
          accreditation_status: "Submitted",
          return_notes: null,
        }).eq("id", existingVendor.id);           // integer PK, not vendor_code
      }

      const ciPayload = {
        vendor_id: vendorId,
        company_name: form.company_name.trim(),
        primary_activity: form.trade_categories.join(", "),
        trade_categories: form.trade_categories,
        primary_activities: form.primary_activities,
        registered_address: form.registered_address.trim(),
        satellite_address: form.satellite_address.trim(),
        location_map_url: form.location_map_url.trim(),
        satellite_map_url: form.satellite_map_url.trim(),
        client_list: form.client_list.filter(r => r.name.trim()),
        equipment_list: form.equipment_list.filter(r => r.item.trim()),
        stockholder_list: form.stockholder_list.filter(r => r.name.trim()),
        key_contacts: form.key_contacts,
        telephone: form.telephone.trim(),
        cell_number: form.cell_number.trim(),
        rfq_email: form.rfq_emails.filter(e => e.trim()).join(","),
        contact_person: form.contact_person.trim(),
        contact_position: form.contact_position.trim(),
        authorized_representative: form.authorized_representative.trim(),
        representative_title: form.representative_title.trim(),
        vendor_type: form.vendor_type || null,
        registration_type: form.registration_type || null,
        tin: form.tin.trim() || null,
        tax_classification: form.tax_classification || null,
        ewt_entries: form.ewt_entries.filter(e => e.rate || e.description.trim()),
        bank_name: form.bank_name.trim() || null,
        bank_account_name: form.bank_account_name.trim() || null,
        bank_account_number: form.bank_account_number.trim() || null,
        bank_branch: form.bank_branch.trim() || null,
        num_employees: form.num_employees ? parseInt(form.num_employees) : null,
        is_subsidiary: form.is_subsidiary === "yes" ? true : form.is_subsidiary === "no" ? false : null,
        parent_company_name: form.parent_company_name.trim() || null,
        parent_company_country: form.parent_company_country.trim() || null,
        has_hs_adviser: form.has_hs_adviser === "yes" ? true : form.has_hs_adviser === "no" ? false : null,
        hs_adviser_details: form.hs_adviser_details.trim() || null,
        has_hs_policy: form.has_hs_policy === "yes" ? true : form.has_hs_policy === "no" ? false : null,
        has_qms: form.has_qms === "yes" ? true : form.has_qms === "no" ? false : null,
        has_internal_qms: form.has_internal_qms === "yes" ? true : form.has_internal_qms === "no" ? false : null,
        has_env_management: form.has_env_management === "yes" ? true : form.has_env_management === "no" ? false : null,
        signatory_sales_manager: form.signatory_sales_manager.trim() || null,
        signatory_president: form.signatory_president.trim() || null,
        declaration_confirmed_at: new Date().toISOString(),
      };
      const { data: existingCI } = await supabase
        .from("vendor_company_info")
        .select("vendor_id")
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (existingCI) {
        await supabase.from("vendor_company_info").update(ciPayload).eq("vendor_id", vendorId);
      } else {
        await supabase.from("vendor_company_info").insert(ciPayload);
      }

      for (const docType of ACCREDITATION_DOCS) {
        const file = docFiles[docType];
        if (!file) continue;
        const ext = file.name.split(".").pop();
        const safeName = docType.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const path = `vendor-docs/${vendorId}/${safeName}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("vendor-documents").upload(path, file, { upsert: true });
        if (upErr) { console.error("Upload failed for", docType, upErr.message); continue; }
        const { data: urlData } = supabase.storage.from("vendor-documents").getPublicUrl(path);
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

      // Upload EWT proof documents
      for (let i = 0; i < form.ewt_entries.length; i++) {
        const file = ewtFiles[i];
        if (!file) continue;
        const docType = `EWT Proof ${i + 1}`;
        const path = `vendor-docs/${vendorId}/ewt_proof_${i + 1}-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage.from("vendor-documents").upload(path, file, { upsert: true });
        if (upErr) { console.error("EWT upload failed for", docType, upErr.message); continue; }
        const { data: urlData } = supabase.storage.from("vendor-documents").getPublicUrl(path);
        const { data: existingDoc } = await supabase
          .from("vendor_documents").select("id")
          .eq("vendor_id", vendorId).eq("document_type", docType).maybeSingle();
        if (existingDoc) {
          await supabase.from("vendor_documents").update({
            file_url: urlData.publicUrl, file_name: file.name, uploaded_at: new Date().toISOString(),
          }).eq("id", existingDoc.id);
        } else {
          await supabase.from("vendor_documents").insert({
            vendor_id: vendorId, document_type: docType,
            file_url: urlData.publicUrl, file_name: file.name, uploaded_at: new Date().toISOString(),
          });
        }
      }

      // Save expiry dates and registration info for gov docs
      const allTrackedDocs = [...new Set([...GOV_DOCS, ...COMPANY_ID_DOCS])];
      for (const docType of allTrackedDocs) {
        const expiry  = docExpiry[docType];
        const regInfo = docRegInfo[docType];
        if (!expiry?.expiry_date && !regInfo?.reg_number && !regInfo?.reg_date) continue;
        const { error: expiryErr } = await supabase.from("vendor_doc_expiry").upsert({
          vendor_id: vendorId,
          doc_type: docType,
          expiry_date: expiry?.expiry_date || null,
          source: expiry?.source || "manual",
          reg_number: regInfo?.reg_number?.trim() || null,
          reg_date: regInfo?.reg_date || null,
        }, { onConflict: "vendor_id,doc_type" });
        if (expiryErr) console.error("vendor_doc_expiry upsert failed for", docType, expiryErr.message);
      }

      if (token && tokenRow && !tokenRow.vendor_id) {
        await supabase.from("vendor_accreditation_tokens").update({
          vendor_id: vendorId,
          used_at: new Date().toISOString(),
        }).eq("id", tokenRow.id);
      }

      setSubmitted(true);
    } catch (err) {
      alert("An unexpected error occurred: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!started && !showPrepare) return (
    <div style={{ height: "100vh", overflow: "hidden", background: C.offWhite, display: "flex", flexDirection: "column", fontFamily: FONT }}>
      <style>{`
        @keyframes acr-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .acr-heading {
          animation: acr-fade-up 520ms cubic-bezier(0.23,1,0.32,1) both;
        }
        .acr-sub {
          animation: acr-fade-up 520ms cubic-bezier(0.23,1,0.32,1) 80ms both;
        }
        .acr-bu-label {
          animation: acr-fade-up 420ms cubic-bezier(0.23,1,0.32,1) 170ms both;
        }
        .acr-bu-card {
          animation: acr-fade-up 400ms cubic-bezier(0.23,1,0.32,1) both;
          transition: transform 180ms cubic-bezier(0.23,1,0.32,1), box-shadow 180ms ease;
        }
        .acr-cta {
          animation: acr-fade-up 400ms cubic-bezier(0.23,1,0.32,1) both;
        }
        .acr-hint {
          animation: acr-fade-up 360ms cubic-bezier(0.23,1,0.32,1) both;
        }
        .acr-btn {
          transition: transform 160ms cubic-bezier(0.23,1,0.32,1), box-shadow 160ms ease;
        }
        .acr-btn:active {
          transform: scale(0.97);
        }
        @media (hover: hover) and (pointer: fine) {
          .acr-btn:hover {
            transform: scale(1.02);
            box-shadow: 0 8px 28px rgba(0,0,0,0.24), 0 2px 6px rgba(0,0,0,0.12);
          }
          .acr-bu-card:hover {
            transform: translateY(-2px) scale(1.03);
            box-shadow: 0 6px 16px rgba(0,0,0,0.10);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .acr-heading, .acr-sub, .acr-bu-label, .acr-bu-card, .acr-cta, .acr-hint {
            animation: none;
          }
          .acr-btn, .acr-bu-card {
            transition: none;
          }
        }
      `}</style>

      {/* Header bar — fixed */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, background: "rgba(63,63,63,1)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
        <img src="/ph1-logo.png" alt="PH1 World Developers" style={{ height: 36, width: "auto", maxWidth: 80, objectFit: "contain", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>PH1 World Developers</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1 }}>D&amp;C – Procurement, Commercial &amp; Contract Management</div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div style={{ height: 64, flexShrink: 0 }} />

      {/* Centered intro content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 20px 0" }}>
        <div style={{ maxWidth: 600, width: "100%", textAlign: "center" }}>

          {/* Heading */}
          <div style={{ fontSize: 28, fontWeight: 800, color: C.textPri, lineHeight: 1.15, marginBottom: 6, animationDelay: "40ms" }} className="acr-sub">
            Vendor Accreditation
          </div>
          <div className="acr-sub" style={{ fontSize: 13, color: C.textSec, lineHeight: 1.55, maxWidth: 420, margin: "0 auto 12px" }}>
            Apply once to be considered across all PH1 business units. Complete the form and upload your supporting documents to get started.
          </div>

          {/* BU section */}
          <div style={{ marginBottom: 10, minHeight: 60 }}>
            {/* Section label */}
            <div className="acr-bu-label" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 1, background: C.border, maxWidth: 60 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.1em" }}>Our Business Units</span>
              <div style={{ flex: 1, height: 1, background: C.border, maxWidth: 60 }} />
            </div>

            {busLoading
              ? <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  <div style={{ gridColumn: "span 3", height: 88, background: C.border, borderRadius: 12, opacity: 0.4 }} />
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{ height: 110, background: C.border, borderRadius: 10, opacity: 0.3 }} />
                  ))}
                </div>
              : (() => {
                  const ph1 = bus.find(bu => bu.name.toLowerCase().includes("ph1 world developers inc"));
                  const others = bus.filter(bu => bu !== ph1);
                  const allBus = ph1 ? [ph1, ...others] : others;
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                      {allBus.map((bu, idx) => {
                        const isPh1 = bu === ph1;
                        return (
                          <div
                            key={bu.id}
                            className="acr-bu-card"
                            style={{
                              gridColumn: isPh1 ? "span 3" : undefined,
                              justifySelf: isPh1 ? "center" : undefined,
                              minWidth: isPh1 ? 220 : undefined,
                              display: "flex",
                              flexDirection: isPh1 ? "row" : "column",
                              alignItems: "center",
                              justifyContent: isPh1 ? "center" : "space-between",
                              gap: isPh1 ? 14 : 0,
                              padding: isPh1 ? "14px 32px" : "14px 10px 12px",
                              background: C.white,
                              border: `1.5px solid ${isPh1 ? C.coral + "40" : C.border}`,
                              borderRadius: 12,
                              boxShadow: isPh1 ? "0 4px 16px rgba(0,0,0,0.07)" : "0 2px 8px rgba(0,0,0,0.05)",
                              position: "relative", overflow: "hidden",
                              animationDelay: `${220 + idx * 55}ms`,
                            }}
                          >
                            {isPh1 && (
                              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${C.coral}, ${C.coralDark})` }} />
                            )}
                            {/* Logo zone */}
                            <div style={{ height: isPh1 ? "auto" : 52, display: "flex", alignItems: "center", justifyContent: "center", width: isPh1 ? "auto" : "100%" }}>
                              {bu.logo_url
                                ? <img src={bu.logo_url} alt={bu.name} style={{ maxHeight: isPh1 ? 48 : 44, width: "auto", maxWidth: isPh1 ? 130 : 100, objectFit: "contain" }} />
                                : <div style={{ width: 44, height: 44, background: C.coralLight, border: `2px solid ${C.coral}30`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ color: C.coral, fontSize: 17, fontWeight: 800 }}>{bu.name.charAt(0)}</span>
                                  </div>
                              }
                            </div>
                            <span style={{
                              fontSize: isPh1 ? 14 : 10.5,
                              fontWeight: isPh1 ? 700 : 600,
                              color: isPh1 ? C.textPri : C.textSec,
                              textAlign: "center",
                              lineHeight: 1.35,
                              marginTop: isPh1 ? 0 : 8,
                            }}>{bu.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
            }
          </div>

          <div className="acr-cta" style={{ animationDelay: `${220 + (bus.length || 1) * 55 + 40}ms` }}>
            <button
              className="acr-btn"
              onClick={() => existingVendor ? handleStart() : setShowPrepare(true)}
              disabled={startingApp}
              style={{
                padding: "12px 44px", fontSize: 15, fontWeight: 800,
                letterSpacing: "0.01em",
                background: `linear-gradient(135deg, ${C.coral}, ${C.coralDark})`,
                color: "#fff", border: "none", borderRadius: 12,
                cursor: startingApp ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                boxShadow: "0 6px 22px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.10)",
                minWidth: 240, opacity: startingApp ? 0.75 : 1,
              }}
            >
              {startingApp ? "Setting up…" : existingVendor ? "Continue Application →" : "Start Application →"}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 24px", textAlign: "center", flexShrink: 0 }}>
        <a
          href="https://ph1worlddevelopers.com/"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block", fontSize: 14, fontWeight: 700,
            color: C.textPri, textDecoration: "none", letterSpacing: "-0.01em",
            borderBottom: `2px solid ${C.coral}`, paddingBottom: 1,
            transition: "color 160ms ease, border-color 160ms ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = C.coral; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.textPri; }}
        >
          www.ph1worlddevelopers.com
        </a>
        <div style={{ fontSize: 11, color: C.textTer, marginTop: 4, lineHeight: 1.7 }}>
          22nd Floor, Primex Tower, EDSA corner Connecticut, San Juan, 1503 Metro Manila
        </div>
      </div>
    </div>
  );

  // ── PREPARE SCREEN ─────────────────────────────────────────────────────────
  if (!started && showPrepare) {
    return (
      <div style={{ minHeight: "100vh", background: C.offWhite, fontFamily: FONT, paddingTop: 58, paddingBottom: 60 }}>
        <VendorPageHeader title="Vendor Accreditation" subtitle="Before you begin" />

        <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px 0" }}>

          {/* Intro card */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPri, marginBottom: 6 }}>Prepare your documents</div>
            <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
              To complete your accreditation, you'll need to upload the documents listed below. Having them ready before you start will make the process faster. Your progress is saved automatically.
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
              {[
                { dot: "#9B3922", label: "Required" },
                { dot: C.amberText, label: "SEC only / Preferred" },
                { dot: C.borderMid, label: "Preferred" },
              ].map(({ dot, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Gov & Business docs */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              Gov &amp; Business Registration
            </div>
            <PrepDocRow name="DTI / SEC Certificate"              badge={<PrepBadge type="req" label="Required" />} />
            <PrepDocRow name="General Information Sheet"          note="SEC-registered companies only" badge={<PrepBadge type="sec" label="SEC only" />} />
            <PrepDocRow name="Articles of Incorporation"          note="SEC-registered companies only" badge={<PrepBadge type="sec" label="SEC only" />} />
            <PrepDocRow name="Secretary Certificate"              note="SEC-registered companies only" badge={<PrepBadge type="sec" label="SEC only" />} />
            <PrepDocRow name="By-laws"                            note="SEC-registered companies only" badge={<PrepBadge type="sec" label="SEC only" />} />
            <PrepDocRow name="Municipality / Mayor's Permit"      badge={<PrepBadge type="req" label="Required" />} />
            <PrepDocRow name="BIR / VAT Registration"             badge={<PrepBadge type="req" label="Required" />} />
            <PrepDocRow name="PCAB License"                       note="Required for Class B and Class A accreditation" badge={<PrepBadge type="sec" label="Preferred" />} />
            <PrepDocRow name="ISO Compliance Certificate"         badge={<PrepBadge type="pref" label="Preferred" />} />
          </div>

          {/* Company Identity */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              Company Identity
            </div>
            <PrepDocRow name="2 Valid Government IDs" note="Passport, Driver's License, UMID, PhilSys, PRC, or Voter's ID" badge={<PrepBadge type="req" label="Required" />} />
            <PrepDocRow name="Company Profile &amp; Organizational Chart" badge={<PrepBadge type="pref" label="Preferred" />} />
          </div>

          {/* Financial Documents */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              Financial Documents
            </div>
            <PrepDocRow name="OR &amp; Sales Invoice"                                badge={<PrepBadge type="req" label="Required" />} />
            <PrepDocRow name="Copy of ITR — Previous Year"                           badge={<PrepBadge type="req" label="Required" />} />
            <PrepDocRow name="Audited Financial Statement (2 years)"                 note="Required for SEC-registered companies" badge={<PrepBadge type="sec" label="SEC / Class A" />} />
            <PrepDocRow name="Certificate of Good Credit Standing"                   note="Required for SEC-registered companies" badge={<PrepBadge type="sec" label="SEC / Class A" />} />
            <PrepDocRow name="Sample Purchase Order / Job Order (5 Major Clients)"   note="Required for SEC-registered companies" badge={<PrepBadge type="sec" label="SEC / Class A" />} />
          </div>

          {/* Accreditation tier grid */}
          <div style={{ ...S.card, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 4 }}>Accreditation class</div>
            <div style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>
              Your class is assigned after review based on the documents you submit.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <PrepTierCard cls="Class C" name="Basic" po="Up to ₱500K per PO" checks={[
                { ok: true,  text: "Core gov docs (DTI/SEC, Mayor's Permit, BIR)" },
                { ok: true,  text: "Valid IDs" },
                { ok: true,  text: "OR & ITR" },
                { ok: false, text: "No PCAB License submitted" },
                { ok: false, text: "AFS not required" },
              ]} />
              <PrepTierCard cls="Class B" name="Standard" po="Up to ₱1M per PO" checks={[
                { ok: true,  text: "All Class C docs" },
                { ok: true,  text: "Complete gov set" },
                { ok: true,  text: "PCAB License" },
                { ok: true,  text: "Financial docs" },
                { amber: true, text: "AFS required for SEC" },
              ]} />
              <PrepTierCard cls="Class A" name="Full" po="Above ₱1M per PO" checks={[
                { ok: true, text: "All Class B docs" },
                { ok: true, text: "AFS (SEC-registered)" },
                { ok: true, text: "Good Credit Standing" },
                { ok: true, text: "Sample PO / JO" },
              ]} />
            </div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", paddingBottom: 8 }}>
            <button
              onClick={handleStart}
              disabled={startingApp}
              style={{
                padding: "13px 48px", fontSize: 15, fontWeight: 800,
                background: `linear-gradient(135deg, ${C.coral}, ${C.coralDark})`,
                color: "#fff", border: "none", borderRadius: 12, cursor: startingApp ? "not-allowed" : "pointer",
                fontFamily: "inherit", boxShadow: "0 6px 22px rgba(0,0,0,0.20), 0 2px 6px rgba(0,0,0,0.10)",
                opacity: startingApp ? 0.75 : 1,
              }}
            >
              {startingApp ? "Setting up…" : "I'm ready — start my application →"}
            </button>
            <div style={{ fontSize: 11, color: C.textTer, marginTop: 10 }}>
              Your progress is saved automatically. You can return to this link at any time.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.white }}>
      <style>{`@keyframes ph1-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
      {ph1LogoUrl && <img src={ph1LogoUrl} alt="PH1 World Developers Inc." style={{ width: 200, maxWidth: "60vw", objectFit: "contain", animation: "ph1-pulse 1.8s ease-in-out infinite" }} />}
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.offWhite }}>
      <div style={{ ...S.card, maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>ðŸ”—</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>Link not found</div>
        <div style={{ fontSize: 13, color: C.textSec }}>This accreditation link is invalid or has expired. Please contact the admin for a new link.</div>
      </div>
    </div>
  );

  // These must be declared before the submitted/notFound early returns that reference them
  const isAccredited     = existingVendor?.accreditation_status === "Accredited";
  const hasPendingUpdate = !!existingVendor?.has_pending_update;

  // Returns true when the given field key is required for the vendor's selected type
  const isFieldReq = key => !!(fieldReqs[form.vendor_type]?.[key]);

  if (submitted) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.offWhite, fontFamily: FONT }}>
      <div style={{ ...S.card, maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>
          {isAccredited ? "Update submitted!" : isReturned ? "Resubmission received!" : "Application submitted!"}
        </div>
        <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
          {isAccredited
            ? <>Thank you, <strong>{form.company_name}</strong>. Your profile update has been sent to our team for review. We will notify you once it has been acknowledged.</>
            : <>Thank you, <strong>{form.company_name}</strong>. Your accreditation application has been received and is under review. We will get in touch with you at <strong>{form.rfq_emails.filter(e => e.trim()).join(", ")}</strong>.</>
          }
          {token && <><br /><br />You may revisit this link at any time to check your status or make further updates.</>}
        </div>
      </div>
    </div>
  );


  return (
    <div style={{ minHeight: "100vh", background: C.offWhite, paddingTop: 58, paddingBottom: 60, fontFamily: FONT }}>
      <VendorPageHeader title="Vendor Accreditation" subtitle="Self-Service Application Form" />
      {/* Bridge: fills the gap between the fixed header and the sticky tab row so scrolled content doesn't show through */}
      <div style={{ position: "fixed", top: 59, left: 0, right: 0, height: 10, background: C.offWhite, zIndex: 45 }} />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px 0" }}>
        {isReturned && (
          <div style={{ background: C.amberBg, border: `1px solid ${C.amberText}40`, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amberText, marginBottom: 4 }}>Your application was returned for correction</div>
            <div style={{ fontSize: 13, color: C.amberText, whiteSpace: "pre-wrap" }}>{returnNotes}</div>
            <div style={{ fontSize: 12, color: C.amberText, marginTop: 8, opacity: 0.8 }}>Please update the information below and resubmit.</div>
          </div>
        )}

        {isAccredited && !isReturned && (
          <div style={{ background: C.greenBg, border: `1px solid #86EFAC`, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.greenText, marginBottom: 2 }}>✅ You are an accredited vendor</div>
            <div style={{ fontSize: 12, color: C.greenText, opacity: 0.85 }}>
              {hasPendingUpdate
                ? "Your recent update is under review. You may continue editing — changes will be included in the same review."
                : "You may update your information or documents below. Your changes will be sent to our team for review."}
            </div>
          </div>
        )}

        {viewMode === "detail" && <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 6 }}>
            {isReturned ? "Update Your Application" : isAccredited ? "Update Accreditation Profile" : "Accreditation Application"}
          </div>
          <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
            Complete all required fields and upload your supporting documents. Fields marked <span style={S.required}>*</span> are required.
          </div>
        </div>}

        {/* ── Vendor type selector ─────────────────────────────────────── */}
        {!form.vendor_type && (
          <div style={{ ...S.card, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 4 }}>What type of vendor are you?</div>
            <div style={{ fontSize: 13, color: C.textSec, marginBottom: 20 }}>
              Select the option that best describes your business. This determines which fields are required in your application.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { value: "Contractor",        icon: "🏗️", sub: "Construction & civil works" },
                { value: "Supplier / Dealer", icon: "📦", sub: "Supply of goods & materials" },
                { value: "Service Provider",  icon: "⚙️", sub: "Professional services & consulting" },
                { value: "Equipment Rental",  icon: "🚧", sub: "Equipment hire & hauling" },
              ].map(({ value, icon, sub }) => (
                <button key={value} type="button"
                  onClick={() => setField("vendor_type", value)}
                  style={{
                    padding: "18px 14px", borderRadius: 12,
                    border: `2px solid ${C.border}`, background: C.white,
                    cursor: "pointer", fontFamily: FONT, textAlign: "center",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = C.coral; e.currentTarget.style.background = C.coralLight; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>{value}</div>
                  <div style={{ fontSize: 11, color: C.textSec, marginTop: 3 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Hub / Detail navigation ────────────────────────────────────── */}
        {form.vendor_type && (() => {
          // Completion stats
          const reqFields = ["company_name", "registered_address", "cell_number", "contact_person", "authorized_representative"];
          const idUploaded      = COMPANY_ID_DOCS.filter(d => docFiles[d] || uploadedDocs[d]).length;
          const idMinDate       = new Date(Date.now() + 60 * 86400e3).toISOString().slice(0, 10);
          const idExpiryFilled  = COMPANY_ID_DOCS.filter(d => docExpiry[d]?.expiry_date && docExpiry[d].expiry_date > idMinDate).length;
          const companyFilled   = reqFields.filter(k => form[k]?.trim()).length + (form.rfq_emails.some(e => e.trim()) ? 1 : 0) + idUploaded + idExpiryFilled;
          const companyTotal    = reqFields.length + 1 + COMPANY_ID_DOCS.length + COMPANY_ID_DOCS.length;
          const tradeFilled     = (form.primary_activities.length > 0 ? 1 : 0) + (form.trade_categories.length > 0 ? 1 : 0);
          const regType         = form.registration_type;
          const govRequired     = !regType ? [] : govDocsForType(form.vendor_type).filter(d => {
            if (GOV_DOCS_OPTIONAL.has(d)) return false;
            if (GOV_DOCS_SEC_ONLY.has(d)) return regType === "SEC";
            return true;
          });
          const govRequiredWithExpiry  = govRequired.filter(d => DOCS_WITH_EXPIRY.has(d));
          const govReqUploaded         = govRequired.filter(d => docFiles[d] || uploadedDocs[d]).length;
          const govReqExpiryFilled     = govRequiredWithExpiry.filter(d => docExpiry[d]?.expiry_date).length;
          const govTotal               = 1 + (regType ? govRequired.length + govRequiredWithExpiry.length : 0);
          const govFilled              = (regType ? 1 : 0) + govReqUploaded + govReqExpiryFilled;
          const finUploaded            = FIN_DOCS.filter(d => docFiles[d] || uploadedDocs[d]).length;
          // Required: always-required + AFS for SEC vendors
          const finReqDocs             = FIN_DOCS.filter(d =>
            FIN_DOCS_ALWAYS_REQUIRED.has(d) || (regType === "SEC" && FIN_DOCS_SEC_REQUIRED.has(d))
          );
          const finReqUploaded         = finReqDocs.filter(d => docFiles[d] || uploadedDocs[d]).length;
          const ewtComplete            = form.ewt_entries.filter((e, i) => e.rate && e.description.trim() && (ewtFiles[i] || uploadedEwtDocs[i])).length;
          const taxInfoFilled          = (form.tin.trim() ? 1 : 0) + (form.tax_classification ? 1 : 0) + (ewtComplete > 0 ? 1 : 0);
          const taxInfoTotal           = 3;

          const pct = {
            company:        (companyTotal + 2) > 0 ? (companyFilled + tradeFilled) / (companyTotal + 2) * 100 : 0,
            tax_gov:        ((taxInfoFilled / taxInfoTotal) + (govTotal > 0 ? govFilled / govTotal : 0)) / 2 * 100,
            fin_compliance: finReqDocs.length > 0 ? finReqUploaded / finReqDocs.length * 100 : 100,
            declaration:    (form.declaration_confirmed && form.authorization_confirmed &&
                             !!sigSalesManager && !!sigPresident &&
                             !!form.signatory_sales_manager.trim() && !!form.signatory_president.trim()) ? 100 : 0,
          };

          // Declaration unlocks when all always-required AND admin-configured required fields are filled.
          // Progress bars (pct) remain informational but no longer gate the declaration tab.
          const _alwaysOk = ["company_name","registered_address","cell_number","contact_person","authorized_representative"]
            .every(k => form[k]?.trim()) && form.rfq_emails.some(e => e.trim()) && form.trade_categories.length > 0;
          const _cfg = fieldReqs[form.vendor_type] || {};
          const _cfgOk =
            (!_cfg.satellite_address   || !!form.satellite_address.trim()) &&
            (!_cfg.location_map_url    || !!form.location_map_url.trim()) &&
            (!_cfg.telephone           || !!form.telephone.trim()) &&
            (!_cfg.contact_position    || !!form.contact_position.trim()) &&
            (!_cfg.representative_title || !!form.representative_title.trim()) &&
            (!_cfg.num_employees       || !!form.num_employees) &&
            (!_cfg.is_subsidiary       || !!form.is_subsidiary) &&
            (!_cfg["key_contacts.president"]          || !!form.key_contacts.president?.name?.trim()) &&
            (!_cfg["key_contacts.accounting_manager"] || !!form.key_contacts.accounting_manager?.name?.trim()) &&
            (!_cfg["key_contacts.sales_manager"]      || !!form.key_contacts.sales_manager?.name?.trim()) &&
            (!_cfg["key_contacts.delivery_incharge"]  || !!form.key_contacts.delivery_incharge?.name?.trim()) &&
            (!_cfg["key_contacts.technical_incharge"] || !!form.key_contacts.technical_incharge?.name?.trim()) &&
            (!_cfg.tin                 || !!form.tin.trim()) &&
            (!_cfg.tax_classification  || !!form.tax_classification) &&
            (!_cfg.registration_type   || !!form.registration_type) &&
            (!_cfg.ewt_entries         || form.ewt_entries.some(e => e.rate && e.description.trim())) &&
            (!_cfg.bank_details        || ["bank_name","bank_account_name","bank_account_number","bank_branch"].every(k => !!form[k]?.trim())) &&
            (!_cfg["compliance.has_hs_adviser"]    || !!form.has_hs_adviser) &&
            (!_cfg["compliance.has_hs_policy"]     || !!form.has_hs_policy) &&
            (!_cfg["compliance.has_qms"]           || !!form.has_qms) &&
            (!_cfg["compliance.has_env_management"] || !!form.has_env_management) &&
            (!_cfg.signatories         || (!!form.signatory_sales_manager.trim() && !!form.signatory_president.trim()));
          const declarationLocked = !_alwaysOk || !_cfgOk;
          const sectionsComplete  = Object.values(pct).filter(p => p >= 100).length;
          const overallPct        = Math.round((pct.company + pct.tax_gov + pct.fin_compliance + pct.declaration) / 4);

          // Classification preview
          const hasUp = d => !!(docFiles[d] || uploadedDocs[d]);
          const vType = form.vendor_type;
          const isContractor = vType === "Contractor";
          const isSupplier   = vType === "Supplier / Dealer";
          const isService    = vType === "Service Provider";
          const isRental     = vType === "Equipment Rental";

          const CLASS_C_BASE = ["DTI / SEC Certificate", "Municipality / Mayor's Permit", "BIR/VAT Registration", "Valid Government ID 1", "Valid Government ID 2", "OR & Sales Invoice", "Copy of ITR Previous Year"];
          const classCBaseOk  = CLASS_C_BASE.every(hasUp);
          const classCMissing = CLASS_C_BASE.filter(d => !hasUp(d));

          // Class B gate doc varies by vendor type
          const classBDoc   = isContractor ? "PCAB License"
            : isSupplier    ? "Authorized Distributorship / Dealership Certificate"
            : isService     ? "License (PTR / PRC ID)"
            : isRental      ? "LTO Registration of Equipment"
            : null;
          const classBDocLabel = isContractor ? "PCAB License"
            : isSupplier    ? "Distributorship Cert"
            : isService     ? "License (PTR / PRC ID)"
            : isRental      ? "LTO Registration"
            : "";
          const classBDocUp = classBDoc ? hasUp(classBDoc) : false;

          const afsUp    = hasUp("Audited Financial Statement (2 years)");
          const creditUp = hasUp("Certificate of Good Credit Standing");
          const sampleUp = hasUp("Sample Purchase Order / Job Order (5 Major Clients)");

          const classBOk = classCBaseOk && classBDocUp;
          const classAOk = classBOk && afsUp && creditUp && sampleUp;


          const sectionMeta = [
            { key: "company",        num: 1, label: "Company Information",       desc: "Business details, addresses, key personnel, trade categories & ID documents.", detail: `${Math.min(companyFilled + tradeFilled, companyTotal + 2)} of ${companyTotal + 2} fields` },
            { key: "tax_gov",        num: 2, label: "Tax & Government Docs",      desc: "TIN, tax classification, EWT entries, business registrations & valid IDs.",    detail: `${taxInfoFilled + govFilled} of ${taxInfoTotal + govTotal} items` },
            { key: "fin_compliance", num: 3, label: "Financials & Compliance",    desc: "Bank details, financial documents, H&S policy, QMS & environmental management.", detail: finReqDocs.length > 0 ? `${finReqUploaded} of ${finReqDocs.length} required docs` : "Not started" },
            { key: "declaration",    num: 4, label: "Declaration",                desc: "Review, sign, and submit your completed accreditation application.",            detail: declarationLocked ? "Fill in all required fields first" : pct.declaration >= 100 ? "Ready to submit" : "Signatories & checkboxes needed" },
          ];

          const cardStatus = key => {
            if (key === "declaration" && declarationLocked) return "locked";
            if (pct[key] >= 100) return "complete";
            if (pct[key] > 0)    return "inprog";
            return "notstarted";
          };
          const statusColors = {
            complete:   { border: "#86EFAC", badgeBg: C.greenBg,  badgeText: C.greenText, stripe: "#22C55E",  numBg: C.greenBg,  numText: C.greenText },
            inprog:     { border: "#FCD34D", badgeBg: "#FEF3C7",  badgeText: "#92400E",   stripe: "#EAB308",  numBg: "#FEF3C7",  numText: "#92400E"   },
            notstarted: { border: C.border,  badgeBg: "#F3F4F6",  badgeText: C.textTer,   stripe: "transparent", numBg: "#F3F4F6", numText: C.textTer  },
            locked:     { border: C.border,  badgeBg: "#F3F4F6",  badgeText: C.textTer,   stripe: "transparent", numBg: "#F3F4F6", numText: C.textTer  },
          };
          const statusLabel = { complete: "Complete", inprog: "In Progress", notstarted: "Not Started", locked: "Locked" };

          // ── HUB VIEW ──────────────────────────────────────────────────────
          if (viewMode === "hub") return (
            <div>
              {/* Back button — top of page */}
              <button type="button" onClick={() => setField("vendor_type", "")}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.textSec, fontSize: 13, padding: "0 0 12px 0", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                ← Back
              </button>
              {/* Application banner */}
              <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.textPri, letterSpacing: "-0.3px" }}>
                      {form.company_name || "Your Company"}
                    </div>
                    <span style={{ fontSize: 13, background: C.coralLight, color: C.coral, borderRadius: 6, padding: "3px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {form.vendor_type}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textSec }}>Accreditation Application</div>
                  <div style={{ fontSize: 12, color: C.textSec, marginTop: 6 }}>
                    {sectionsComplete} of 4 sections complete
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", fontSize: 11, fontWeight: 600, color: draftSaving ? C.textTer : draftSaveError ? C.redText : draftSavedAt ? C.greenText : C.textTer }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: draftSaving ? C.amberText : draftSaveError ? C.redText : draftSavedAt ? C.greenText : C.border, transition: "background 0.3s" }} />
                    {draftSaving ? "Saving…" : draftSaveError ? "Save failed — check connection" : draftSavedAt ? `Saved ${draftSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : existingVendor ? "Not yet saved" : "Saves on submit"}
                  </div>
                  <div style={{ width: 110, height: 5, background: C.border, borderRadius: 99, overflow: "hidden", marginTop: 8, marginLeft: "auto" }}>
                    <div style={{ height: "100%", width: `${overallPct}%`, background: `linear-gradient(90deg, ${C.coral}, ${C.coralDark})`, borderRadius: 99, transition: "width 0.4s ease" }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.textTer, marginTop: 4 }}>{overallPct}% complete</div>
                </div>
              </div>

              {/* Doc renewal alert — shown only for accredited vendors with expired/expiring docs */}
              {isAccredited && (() => {
                const todayMs = new Date().setHours(0, 0, 0, 0);
                const renewalDocs = Object.entries(docExpiry)
                  .filter(([, r]) => r.expiry_date)
                  .map(([docType, r]) => {
                    const days = Math.round((new Date(r.expiry_date).setHours(0, 0, 0, 0) - todayMs) / 86400000);
                    return { docType, days, expiry_date: r.expiry_date };
                  })
                  .filter(r => r.days <= 40)
                  .sort((a, b) => a.days - b.days);
                if (!renewalDocs.length) return null;
                const hasExpired = renewalDocs.some(r => r.days < 0);
                return (
                  <div style={{ marginBottom: 16, padding: "14px 16px", background: hasExpired ? C.redBg : "#FEF3E2", border: `1px solid ${hasExpired ? "#FCA5A5" : "#FCD34D"}`, borderRadius: 12 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: hasExpired ? C.redText : C.amberText, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                          {hasExpired ? "⚠ Documents Expired — Action Required" : "⚠ Documents Expiring Soon"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                          {renewalDocs.map(r => (
                            <div key={r.docType} style={{ fontSize: 12, color: C.textPri }}>
                              <span style={{ fontWeight: 500 }}>{r.docType}</span>
                              {" — "}
                              <span style={{ color: r.days < 0 ? C.redText : C.amberText }}>
                                {r.days < 0
                                  ? `expired ${Math.abs(r.days)} day${Math.abs(r.days) === 1 ? "" : "s"} ago`
                                  : r.days === 0 ? "expires today"
                                  : `expires in ${r.days} day${r.days === 1 ? "" : "s"}`}
                              </span>
                              <span style={{ color: C.textTer, fontSize: 11 }}> ({r.expiry_date})</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.5, marginBottom: 10 }}>
                          Please upload renewed documents with updated certification numbers, registration dates, and expiry dates.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode("detail");
                            setActiveTab("company");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          style={{ fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: FONT, background: hasExpired ? C.redText : C.amberText, color: "#fff" }}
                        >
                          Upload Renewed Documents →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2×2 section grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                {sectionMeta.map(sec => {
                  const status = cardStatus(sec.key);
                  const sc = statusColors[status];
                  const isLocked   = status === "locked";
                  const isComplete = status === "complete";
                  const isInProg   = status === "inprog";
                  const goToSection = () => {
                    if (!isLocked) {
                      setActiveTab(sec.key);
                      setViewMode("detail");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  };
                  return (
                    <div key={sec.key}
                      onClick={goToSection}
                      style={{
                        background: "#fff", border: `1.5px solid ${sc.border}`, borderRadius: 14, padding: 20,
                        cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.52 : 1,
                        position: "relative", overflow: "hidden", display: "flex", flexDirection: "column",
                        transition: "box-shadow 0.15s, transform 0.1s",
                      }}>
                      {/* Top stripe */}
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: sc.stripe, borderRadius: "14px 14px 0 0" }} />
                      {/* Badge row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: sc.numBg, border: isComplete ? "none" : `1.5px solid ${sc.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: sc.numText }}>
                          {isComplete ? "✓" : sec.num}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 99, textTransform: "uppercase", background: sc.badgeBg, color: sc.badgeText }}>
                          {statusLabel[status]}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri, marginBottom: 5, lineHeight: 1.3 }}>{sec.label}</div>
                      <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.5, marginBottom: 14, flex: 1 }}>{sec.desc}</div>
                      {/* Progress bar */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ height: 4, background: C.border, borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                          <div style={{ height: "100%", width: `${isLocked ? 0 : pct[sec.key]}%`, background: isComplete ? "#22C55E" : "#EAB308", borderRadius: 99, transition: "width 0.3s" }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: isComplete ? C.greenText : isInProg ? "#92400E" : C.textTer, fontWeight: isComplete || isInProg ? 600 : 400 }}>
                          {sec.detail}
                        </div>
                      </div>
                      {/* CTA — onClick here so the button itself is the target, no bubbling required */}
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); goToSection(); }}
                          disabled={isLocked}
                          style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: "none", cursor: isLocked ? "not-allowed" : "pointer", fontFamily: FONT, background: isComplete ? C.greenBg : isInProg ? "#FEF3C7" : isLocked ? "#F3F4F6" : C.coral, color: isComplete ? C.greenText : isInProg ? "#92400E" : isLocked ? C.textTer : "#fff" }}
                        >
                          {isLocked ? "🔒 Locked" : isComplete ? "Review ✓" : isInProg ? "Continue →" : "Start →"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Classification — dynamic tier grid */}
              {(() => {
                // classBOk / classAOk already computed above from vendor-type-aware logic

                // per-tier status: "ok" | "next" | "locked"
                const cStatus = classCBaseOk ? "ok"   : "next";
                const bStatus = classBOk     ? "ok"   : classCBaseOk ? "next" : "locked";
                const aStatus = classAOk     ? "ok"   : classBOk     ? "next" : "locked";

                const TierMini = ({ cls, name, po, status, checks }) => {
                  const accentColor = status === "ok" ? C.greenText : status === "next" ? C.coral : C.borderMid;
                  const borderColor = status === "ok" ? "#86EFAC" : status === "next" ? `${C.coral}60` : C.border;
                  return (
                    <div style={{ flex: 1, minWidth: 0, border: `1.5px solid ${borderColor}`, borderRadius: 10, overflow: "hidden", opacity: status === "locked" ? 0.55 : 1 }}>
                      <div style={{ height: 3, background: accentColor }} />
                      <div style={{ padding: "8px 10px 6px", background: status === "ok" ? C.greenBg : status === "next" ? "#FEF0ED" : C.offWhite, borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: "0.07em" }}>{cls}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginTop: 1 }}>{name}</div>
                        <div style={{ fontSize: 10, color: C.textTer, marginTop: 1 }}>{po}</div>
                        {status === "ok"   && <div style={{ fontSize: 9.5, fontWeight: 700, color: C.greenText, marginTop: 3 }}>✓ Achieved</div>}
                        {status === "next" && <div style={{ fontSize: 9.5, fontWeight: 700, color: C.coral,     marginTop: 3 }}>← Next target</div>}
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        {checks.map((c, i) => <PrepTierCheck key={i} ok={c.ok} amber={c.amber} text={c.text} />)}
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
                    {/* Header */}
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.07em" }}>Vendor Classification</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.textPri, marginTop: 2 }}>
                        {classAOk ? "Class A — no maximum award limit"
                          : classBOk ? "Currently qualifying: Class B — max ₱1,000,000"
                          : classCBaseOk ? "Currently qualifying: Class C — max ₱500,000"
                          : "Upload required documents to unlock your classification"}
                      </div>
                    </div>

                    {/* Tier grid */}
                    <div style={{ display: "flex", gap: 8, padding: "12px 12px 0" }}>
                      <TierMini cls="Class C" name="Basic" po="Up to ₱500K" status={cStatus} checks={[
                        { ok: hasUp("DTI / SEC Certificate"),          text: "DTI / SEC Certificate" },
                        { ok: hasUp("Municipality / Mayor's Permit"),  text: "Mayor's Permit" },
                        { ok: hasUp("BIR/VAT Registration"),           text: "BIR/VAT Registration" },
                        { ok: hasUp("Valid Government ID 1") && hasUp("Valid Government ID 2"), text: "Valid IDs (2)" },
                        { ok: hasUp("OR & Sales Invoice"),             text: "OR & Sales Invoice" },
                        { ok: hasUp("Copy of ITR Previous Year"),      text: "Copy of ITR" },
                      ]} />
                      <TierMini cls="Class B" name="Standard" po="Up to ₱1M" status={bStatus} checks={[
                        { ok: classCBaseOk,  text: "All Class C docs" },
                        { ok: classBDocUp,   text: classBDocLabel },
                      ]} />
                      <TierMini cls="Class A" name="Full" po="No max limit" status={aStatus} checks={[
                        { ok: classBOk,   text: "All Class B docs" },
                        { ok: afsUp,      text: "AFS (2 years)" },
                        { ok: creditUp,   text: "Good Credit Standing" },
                        { ok: sampleUp,   text: "Sample PO / JO" },
                      ]} />
                    </div>

                    {classAOk && (
                      <div style={{ padding: "10px 16px 14px", fontSize: 13, color: C.greenText, fontWeight: 600 }}>
                        ✓ All classification documents submitted — excellent!
                      </div>
                    )}
                  </div>
                );
              })()}

              <p style={{ fontSize: 11, color: C.textTer, textAlign: "center", marginBottom: 20 }}>
                🔒 Your progress is saved automatically. You can close this tab and come back anytime.
              </p>
            </div>
          );

          // ── DETAIL HEADER (shown above section content) ────────────────────
          const currentSec = sectionMeta.find(s => s.key === activeTab);
          return (
            <div style={{ marginBottom: 16 }}>
              <button type="button" onClick={() => { setViewMode("hub"); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.coral, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, padding: "6px 0", marginBottom: 12 }}>
                ← Back to overview
              </button>
              {currentSec && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fff", borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.06em" }}>Section {currentSec.num} of 4</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri, marginTop: 2 }}>{currentSec.label}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: pct[activeTab] >= 100 ? C.greenText : "#D97706" }}>{Math.round(pct[activeTab])}%</div>
                    <div style={{ width: 80, height: 4, background: C.border, borderRadius: 99, overflow: "hidden", marginTop: 5, marginLeft: "auto" }}>
                      <div style={{ height: "100%", width: `${pct[activeTab]}%`, background: pct[activeTab] >= 100 ? "#22C55E" : "#EAB308", borderRadius: 99, transition: "width 0.3s" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {viewMode === "detail" && activeTab === "company" && <div style={S.card}>
          <div style={S.cardTitle}>Company Information</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>Company Name <span style={S.required}>*</span></label>
              <input value={form.company_name} onChange={e => setField("company_name", e.target.value)} style={S.input} placeholder="Registered company name" />
            </div>
            <div>
              <label style={S.label}>Registered Address <span style={S.required}>*</span></label>
              <textarea value={form.registered_address} onChange={e => setField("registered_address", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} placeholder="Full registered business address" />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <input value={form.location_map_url} onChange={e => setField("location_map_url", e.target.value)} style={{ ...S.input, margin: 0 }} placeholder={`📍 Map link${isFieldReq("location_map_url") ? "" : " — optional"} (Google Maps share link)`} />
                {isFieldReq("location_map_url") && <span style={S.required}>*</span>}
              </div>
              {form.location_map_url.trim() && (
                <a href={form.location_map_url.trim()} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.coral, fontWeight: 600, display: "inline-block", marginTop: 3 }}>View on map ↗</a>
              )}
            </div>
            <div>
              <label style={S.label}>Satellite Office / Warehouse Address {isFieldReq("satellite_address") ? <span style={S.required}>*</span> : <span style={{ fontSize: 10, color: C.textTer, fontWeight: 400 }}>(optional)</span>}</label>
              <textarea value={form.satellite_address} onChange={e => setField("satellite_address", e.target.value)} rows={2} style={{ ...S.input, resize: "vertical" }} placeholder="If applicable — branch office, warehouse, or site office address" />
              <input value={form.satellite_map_url} onChange={e => setField("satellite_map_url", e.target.value)} style={{ ...S.input, marginTop: 6 }} placeholder="📍 Map link — optional (Google Maps share link)" />
              {form.satellite_map_url.trim() && (
                <a href={form.satellite_map_url.trim()} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.coral, fontWeight: 600, display: "inline-block", marginTop: 3 }}>View on map ↗</a>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Telephone {isFieldReq("telephone") && <span style={S.required}>*</span>}</label>
                <input
                  type="tel" value={form.telephone}
                  onChange={e => setField("telephone", cleanPhone(e.target.value))}
                  style={{ ...S.input, borderColor: form.telephone ? (isValidLandline(form.telephone) ? "#22C55E" : C.redText) : undefined }}
                  placeholder="(02) 8XXX-XXXX" />
                {form.telephone && !isValidLandline(form.telephone) && (
                  <div style={{ fontSize: 11, color: C.redText, marginTop: 3 }}>Enter a valid telephone number.</div>
                )}
              </div>
              <div>
                <label style={S.label}>Cell Number <span style={S.required}>*</span></label>
                <input
                  type="tel" value={form.cell_number}
                  onChange={e => setField("cell_number", cleanPhone(e.target.value))}
                  style={{ ...S.input, borderColor: form.cell_number ? (isValidMobile(form.cell_number) ? "#22C55E" : C.redText) : undefined }}
                  placeholder="09XXXXXXXXX" maxLength={13} />
                {form.cell_number && !isValidMobile(form.cell_number) && (
                  <div style={{ fontSize: 11, color: C.redText, marginTop: 3 }}>Must be a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).</div>
                )}
              </div>
            </div>
            <div>
              <label style={S.label}>Email Address <span style={S.required}>*</span></label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.rfq_emails.map((email, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="email"
                      value={email}
                      onChange={e => {
                        const next = [...form.rfq_emails];
                        next[idx] = e.target.value;
                        setField("rfq_emails", next);
                      }}
                      style={{ ...S.input, margin: 0, flex: 1 }}
                      placeholder={idx === 0 ? "primary@company.com" : "additional@company.com"}
                    />
                    {form.rfq_emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setField("rfq_emails", form.rfq_emails.filter((_, i) => i !== idx))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 18, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setField("rfq_emails", [...form.rfq_emails, ""])}
                style={{ marginTop: 8, background: "none", border: `1px dashed ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: C.textSec, cursor: "pointer", width: "100%" }}
              >+ Add another email</button>
              <p style={S.hint}>Used for RFQ invitations and notifications.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Contact Person <span style={S.required}>*</span></label>
                <input value={form.contact_person} onChange={e => setField("contact_person", e.target.value)} style={S.input} placeholder="Day-to-day coordinator" />
              </div>
              <div>
                <label style={S.label}>Contact Position {isFieldReq("contact_position") && <span style={S.required}>*</span>}</label>
                <input value={form.contact_position} onChange={e => setField("contact_position", e.target.value)} style={S.input} placeholder="e.g. Project Coordinator" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={S.label}>Authorized Representative <span style={S.required}>*</span></label>
                <input value={form.authorized_representative} onChange={e => setField("authorized_representative", e.target.value)} style={S.input} placeholder="Signs contracts and NOA" />
              </div>
              <div>
                <label style={S.label}>Representative Title {isFieldReq("representative_title") && <span style={S.required}>*</span>}</label>
                <input value={form.representative_title} onChange={e => setField("representative_title", e.target.value)} style={S.input} placeholder="e.g. General Manager" />
              </div>
            </div>

            {/* Valid Government IDs */}
            <div>
              <label style={S.label}>Valid Government IDs <span style={S.required}>*</span></label>
              <p style={{ ...S.hint, marginBottom: 8 }}>Upload two valid government IDs (e.g. passport, driver's license, SSS, PhilHealth, Pag-IBIG, PRC, voter's ID). Each must include the expiry date.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {COMPANY_ID_DOCS.map(docType => (
                  <DocUploadRow key={docType} docType={docType} docFiles={docFiles} uploadedDocs={uploadedDocs} handleDocFile={handleDocFile} onDelete={handleDeleteDoc} expiryInfo={docExpiry[docType]} onExpiryChange={handleExpiryChange} required minDaysValid={60} />
                ))}
              </div>
            </div>

            {/* List of Clients */}
            <div>
              <label style={S.label}>List of Major Clients <span style={S.required}>*</span></label>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginTop: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.offWhite }}>
                      {["Client / Company Name", "Project / Service", "Year", "Contract Value (₱)"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSec, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                      <th style={{ width: 32, borderBottom: `1px solid ${C.border}` }} />
                    </tr>
                  </thead>
                  <tbody>
                    {form.client_list.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < form.client_list.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        {[["name","Client name"],["project","Project / service"],["year","Year"],["value","Amount"]].map(([field, ph]) => (
                          <td key={field} style={{ padding: "4px 6px" }}>
                            <input value={row[field]} onChange={e => { const l = [...form.client_list]; l[idx] = { ...l[idx], [field]: e.target.value }; setField("client_list", l); }}
                              style={{ ...S.input, margin: 0, padding: "5px 8px", fontSize: 12 }} placeholder={ph} />
                          </td>
                        ))}
                        <td style={{ padding: "4px 6px", textAlign: "center" }}>
                          {form.client_list.length > 1 && (
                            <button type="button" onClick={() => setField("client_list", form.client_list.filter((_, i) => i !== idx))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 16 }}>×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setField("client_list", [...form.client_list, { name: "", project: "", year: "", value: "" }])}
                style={{ marginTop: 8, background: "none", border: `1px dashed ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: C.textSec, cursor: "pointer", width: "100%" }}>
                + Add client
              </button>
            </div>

            {/* List of Equipment */}
            <div>
              <label style={S.label}>List of Equipment <span style={S.required}>*</span></label>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginTop: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.offWhite }}>
                      {["Equipment / Tool", "Brand / Model", "Qty", "Condition"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSec, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                      <th style={{ width: 32, borderBottom: `1px solid ${C.border}` }} />
                    </tr>
                  </thead>
                  <tbody>
                    {form.equipment_list.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < form.equipment_list.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        {[["item","Equipment name"],["brand","Brand / model"],["qty","Qty"],["condition","Good / Fair / Poor"]].map(([field, ph]) => (
                          <td key={field} style={{ padding: "4px 6px" }}>
                            <input value={row[field]} onChange={e => { const l = [...form.equipment_list]; l[idx] = { ...l[idx], [field]: e.target.value }; setField("equipment_list", l); }}
                              style={{ ...S.input, margin: 0, padding: "5px 8px", fontSize: 12 }} placeholder={ph} />
                          </td>
                        ))}
                        <td style={{ padding: "4px 6px", textAlign: "center" }}>
                          {form.equipment_list.length > 1 && (
                            <button type="button" onClick={() => setField("equipment_list", form.equipment_list.filter((_, i) => i !== idx))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 16 }}>×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setField("equipment_list", [...form.equipment_list, { item: "", brand: "", qty: "", condition: "" }])}
                style={{ marginTop: 8, background: "none", border: `1px dashed ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: C.textSec, cursor: "pointer", width: "100%" }}>
                + Add equipment
              </button>
            </div>

            {/* Owners / Stockholders */}
            <div>
              <label style={S.label}>Owners / Stockholders <span style={S.required}>*</span></label>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "auto", marginTop: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 620 }}>
                  <thead>
                    <tr style={{ background: C.offWhite }}>
                      {["Name", "Position", "Address", "Contact No.", "TIN No."].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSec, fontSize: 11, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                      <th style={{ width: 32, borderBottom: `1px solid ${C.border}` }} />
                    </tr>
                  </thead>
                  <tbody>
                    {form.stockholder_list.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < form.stockholder_list.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        {[["name","Full name"],["position","e.g. President"],["address","Home / business address"],["contact_no","09XXXXXXXXX"],["tin_no","xxx-xxx-xxx"]].map(([field, ph]) => (
                          <td key={field} style={{ padding: "4px 6px" }}>
                            <input value={row[field]}
                              onChange={e => {
                                const val = field === "contact_no" ? cleanPhone(e.target.value) : e.target.value;
                                const l = [...form.stockholder_list]; l[idx] = { ...l[idx], [field]: val }; setField("stockholder_list", l);
                              }}
                              style={{ ...S.input, margin: 0, padding: "5px 8px", fontSize: 12,
                                borderColor: field === "contact_no" && row[field] ? (isValidMobile(row[field]) ? "#22C55E" : C.redText) : undefined,
                              }} placeholder={ph} maxLength={field === "contact_no" ? 13 : undefined} />
                          </td>
                        ))}
                        <td style={{ padding: "4px 6px", textAlign: "center" }}>
                          {form.stockholder_list.length > 1 && (
                            <button type="button" onClick={() => setField("stockholder_list", form.stockholder_list.filter((_, i) => i !== idx))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 16 }}>×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setField("stockholder_list", [...form.stockholder_list, { name: "", position: "", address: "", contact_no: "", tin_no: "" }])}
                style={{ marginTop: 8, background: "none", border: `1px dashed ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: C.textSec, cursor: "pointer", width: "100%" }}>
                + Add owner / stockholder
              </button>
            </div>

            {/* Key Personnel */}
            <div>
              <label style={S.label}>Key Personnel {(isFieldReq("key_contacts.president") || isFieldReq("key_contacts.accounting_manager") || isFieldReq("key_contacts.sales_manager") || isFieldReq("key_contacts.delivery_incharge") || isFieldReq("key_contacts.technical_incharge")) && <span style={S.required}>*</span>}</label>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "auto", marginTop: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
                  <thead>
                    <tr style={{ background: C.offWhite }}>
                      {["Position", "Name", "Contact (Phone / Email)", "Nationality"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSec, fontSize: 11, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["president",          "President"],
                      ["accounting_manager", "Accounting Manager"],
                      ["sales_manager",      "Sales Manager"],
                      ["delivery_incharge",  "Delivery In-charge"],
                      ["technical_incharge", "Technical In-charge"],
                    ].map(([key, label], idx, arr) => (
                      <tr key={key} style={{ borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600, color: C.textSec, fontSize: 12, whiteSpace: "nowrap", background: C.offWhite, borderRight: `1px solid ${C.border}` }}>{label}{isFieldReq(`key_contacts.${key}`) && <span style={{ color: C.coral, marginLeft: 2 }}>*</span>}</td>
                        {["name","contact","nationality"].map(field => (
                          <td key={field} style={{ padding: "4px 6px" }}>
                            <input
                              type={field === "contact" ? "tel" : "text"}
                              value={form.key_contacts[key]?.[field] ?? ""}
                              onChange={e => {
                                const val = field === "contact" ? cleanPhone(e.target.value) : e.target.value;
                                setField("key_contacts", { ...form.key_contacts, [key]: { ...form.key_contacts[key], [field]: val } });
                              }}
                              style={{ ...S.input, margin: 0, padding: "5px 8px", fontSize: 12,
                                borderColor: field === "contact" && form.key_contacts[key][field]
                                  ? (isValidMobile(form.key_contacts[key][field]) ? "#22C55E" : C.redText)
                                  : undefined,
                              }}
                              placeholder={field === "name" ? "Full name" : field === "contact" ? "09XXXXXXXXX" : "e.g. Filipino"}
                              maxLength={field === "contact" ? 13 : undefined}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Company profile docs */}
            <div>
              <label style={S.label}>Company Profile & Organizational Chart <span style={S.required}>*</span></label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {["Company Profile", "Organizational Chart"].map(docType => (
                  <DocUploadRow key={docType} docType={docType} docFiles={docFiles} uploadedDocs={uploadedDocs} handleDocFile={handleDocFile} onDelete={handleDeleteDoc} />
                ))}
              </div>
            </div>

          </div>

          {/* ── Primary Activity / Trade (folded into company tab) ── */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri, marginBottom: 4 }}>Primary Activity / Trade <span style={{ color: C.coral }}>*</span></div>

            {/* Primary Activity type */}
            <div style={{ marginBottom: 22, marginTop: 14 }}>
              <label style={S.label}>Primary Activity <span style={S.required}>*</span></label>
              <p style={{ ...S.hint, marginBottom: 10 }}>Select all that apply.</p>
              <div style={{ display: "flex", gap: 10 }}>
                {["Dealer", "Manufacturer", "Service Provider"].map(activity => {
                  const active = form.primary_activities.includes(activity);
                  return (
                    <button key={activity} onClick={() => {
                      const next = active
                        ? form.primary_activities.filter(a => a !== activity)
                        : [...form.primary_activities, activity];
                      setField("primary_activities", next);
                    }} style={{
                      flex: 1, padding: "11px 6px", borderRadius: 10,
                      border: `2px solid ${active ? C.coral : C.border}`,
                      background: active ? C.coralLight : "#fff",
                      color: active ? C.coral : C.textSec,
                      fontWeight: active ? 700 : 500, fontSize: 13,
                      cursor: "pointer", fontFamily: FONT,
                      transition: "border-color 0.15s, background 0.15s",
                    }}>
                      {activity}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trade categories */}
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
              Trade Categories <span style={{ color: C.coral }}>*</span>
            </div>
            <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 14px", lineHeight: 1.6 }}>Select all trades that apply. Can't find yours? Type it below — we'll review it.</p>

            {form.trade_categories.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {form.trade_categories.map(cat => (
                  <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, background: "#FFF0EE", border: "1px solid #FFCCC7", color: "#C0392B", borderRadius: 99, padding: "4px 10px" }}>
                    {cat}
                    <button type="button" onClick={() => setField("trade_categories", form.trade_categories.filter(c => c !== cat))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#C0392B", fontSize: 14, lineHeight: 1, padding: 0, display: "flex" }}>×</button>
                  </span>
                ))}
              </div>
            )}

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, maxHeight: 220, overflowY: "auto", marginBottom: 10 }}>
              {tradeCats.length === 0
                ? <div style={{ padding: "10px 14px", fontSize: 12, color: C.textTer }}>Loading categories…</div>
                : tradeCats.filter(t => !form.trade_categories.includes(t)).map((t, i, arr) => (
                    <div key={t} onClick={() => setField("trade_categories", [...form.trade_categories, t])}
                      style={{ padding: "10px 14px", fontSize: 13, color: C.textPri, cursor: "pointer", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.1s" }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      {t}
                    </div>
                  ))
              }
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={customTradeInput}
                onChange={e => setCustomTradeInput(e.target.value)}
                onKeyDown={async e => {
                  if (e.key !== "Enter" || !customTradeInput.trim()) return;
                  const name = customTradeInput.trim();
                  setField("trade_categories", [...form.trade_categories, name]);
                  setCustomTradeInput("");
                  await supabase.from("trade_categories").insert({ name, is_approved: false, suggested_by_vendor_id: existingVendor?.vendor_code || null });
                }}
                style={{ ...S.input, margin: 0, flex: 1 }}
                placeholder="Type a custom trade and press Enter…"
              />
              <button type="button"
                onClick={async () => {
                  if (!customTradeInput.trim()) return;
                  const name = customTradeInput.trim();
                  setField("trade_categories", [...form.trade_categories, name]);
                  setCustomTradeInput("");
                  await supabase.from("trade_categories").insert({ name, is_approved: false, suggested_by_vendor_id: existingVendor?.vendor_code || null });
                }}
                style={{ ...S.btnSecondary, whiteSpace: "nowrap" }}>Add</button>
            </div>
          </div>
        </div>}

        {viewMode === "detail" && activeTab === "company" && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button onClick={() => setViewMode("hub")} style={{ ...S.btnSecondary, fontSize: 13 }}>← Overview</button>
          <button onClick={() => setActiveTab("tax_gov")} style={{ ...S.btnPrimary, fontSize: 13 }}>Save &amp; Continue →</button>
        </div>}

        {/* Tax & Government Docs tab */}
        {viewMode === "detail" && activeTab === "tax_gov" && <div style={S.card}>
          <div style={S.cardTitle}>Tax Information</div>

          {/* TIN */}
          <div style={{ marginBottom: 18 }}>
            <label style={S.label}>Tax Identification Number (TIN) {isFieldReq("tin") && <span style={S.required}>*</span>}</label>
            <input
              value={form.tin}
              onChange={e => setField("tin", e.target.value)}
              placeholder="000-000-000-000"
              style={{ ...S.input, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}
            />
          </div>

          {/* Tax Classification */}
          <div style={{ marginBottom: 18 }}>
            <label style={S.label}>Tax Classification {isFieldReq("tax_classification") && <span style={S.required}>*</span>}</label>
            <select
              value={form.tax_classification}
              onChange={e => setField("tax_classification", e.target.value)}
              style={{ ...S.input, appearance: "auto" }}
            >
              <option value="">— Select —</option>
              <option value="VAT">VAT-registered</option>
              <option value="Non-VAT">Non-VAT</option>
            </select>
          </div>

          {/* EWT Entries */}
          <div>
            <label style={S.label}>Expanded Withholding Tax (EWT) {isFieldReq("ewt_entries") && <span style={S.required}>*</span>}</label>
            <p style={{ ...S.hint, marginBottom: 12 }}>Add all applicable EWT rates. Upload BIR proof for each.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {form.ewt_entries.map((entry, i) => {
                const hasFile = !!(ewtFiles[i] || uploadedEwtDocs[i]);
                return (
                  <div key={i} style={{ border: `1px solid ${hasFile ? "#86EFAC" : C.border}`, borderRadius: 10, overflow: "hidden" }}>
                    {/* Row header */}
                    <div style={{ background: hasFile ? C.greenBg : C.offWhite, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.textSec }}>EWT Rate {i + 1}</span>
                      {form.ewt_entries.length > 1 && (
                        <button onClick={() => {
                          setField("ewt_entries", form.ewt_entries.filter((_, j) => j !== i));
                          setEwtFiles(prev => prev.filter((_, j) => j !== i));
                          setUploadedEwtDocs(prev => prev.filter((_, j) => j !== i));
                        }} style={{ fontSize: 11, color: C.redText, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
                          Remove
                        </button>
                      )}
                    </div>
                    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, background: "#fff" }}>
                      {/* Rate dropdown */}
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 180px" }}>
                          <label style={{ ...S.label, marginBottom: 4 }}>Rate <span style={S.required}>*</span></label>
                          <select
                            value={entry.rate}
                            onChange={e => {
                              const updated = [...form.ewt_entries];
                              updated[i] = { ...updated[i], rate: e.target.value, rate_other: "" };
                              setField("ewt_entries", updated);
                            }}
                            style={{ ...S.input, margin: 0, appearance: "auto" }}
                          >
                            <option value="">— Select rate —</option>
                            {EWT_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                        {entry.rate === "Others" && (
                          <div style={{ flex: "1 1 140px" }}>
                            <label style={{ ...S.label, marginBottom: 4 }}>Specify rate <span style={S.required}>*</span></label>
                            <input
                              value={entry.rate_other}
                              onChange={e => {
                                const updated = [...form.ewt_entries];
                                updated[i] = { ...updated[i], rate_other: e.target.value };
                                setField("ewt_entries", updated);
                              }}
                              placeholder="e.g. 7.5%"
                              style={{ ...S.input, margin: 0 }}
                            />
                          </div>
                        )}
                      </div>
                      {/* Description */}
                      <div>
                        <label style={{ ...S.label, marginBottom: 4 }}>Nature / Description <span style={S.required}>*</span></label>
                        <input
                          value={entry.description}
                          onChange={e => {
                            const updated = [...form.ewt_entries];
                            updated[i] = { ...updated[i], description: e.target.value };
                            setField("ewt_entries", updated);
                          }}
                          placeholder="e.g. Supply of construction materials"
                          style={{ ...S.input, margin: 0 }}
                        />
                      </div>
                      {/* Proof upload */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: C.textSec }}>BIR Proof (PDF) <span style={S.required}>*</span></span>
                        {ewtFiles[i] && <span style={{ fontSize: 11, color: C.greenText }}>New: {ewtFiles[i].name}</span>}
                        {!ewtFiles[i] && uploadedEwtDocs[i] && (
                          <span style={{ fontSize: 11, color: C.tealText }}>
                            {uploadedEwtDocs[i].name} &nbsp;
                            <a href={uploadedEwtDocs[i].url} target="_blank" rel="noreferrer" style={{ color: C.coral, fontWeight: 600 }}>View</a>
                          </span>
                        )}
                        {!ewtFiles[i] && !uploadedEwtDocs[i] && <span style={{ fontSize: 11, color: C.textTer }}>Not yet uploaded</span>}
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
                          {hasFile && (
                            <button onClick={() => {
                              setEwtFiles(prev => { const a = [...prev]; a[i] = null; return a; });
                              setUploadedEwtDocs(prev => { const a = [...prev]; a[i] = null; return a; });
                            }} style={{ fontSize: 11, fontWeight: 600, color: C.redText, border: `1px solid ${C.redBg}`, borderRadius: 6, padding: "4px 8px", background: C.redBg, cursor: "pointer", fontFamily: FONT }}>
                              Remove
                            </button>
                          )}
                        <label style={{ cursor: "pointer" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: hasFile ? C.greenText : C.coral, border: `1px solid ${hasFile ? "#86EFAC" : C.coral}40`, borderRadius: 6, padding: "4px 10px", background: hasFile ? C.greenBg : C.coralLight }}>
                            {hasFile ? "Replace" : "Upload"}
                          </span>
                          <input type="file" accept=".pdf" style={{ display: "none" }} onChange={e => {
                            const f = e.target.files[0] || null;
                            setEwtFiles(prev => { const a = [...prev]; a[i] = f; return a; });
                          }} />
                        </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setField("ewt_entries", [...form.ewt_entries, { rate: "", rate_other: "", description: "" }])}
              style={{ ...S.btnSecondary, marginTop: 10, fontSize: 12, width: "100%" }}
            >
              + Add Another EWT Rate
            </button>
          </div>
        </div>}
        {/* (tax_gov nav rendered after gov_docs card below) */}

        {/* Primary Activity / Trade — moved into Company Information tab */}

        {viewMode === "detail" && activeTab === "tax_gov" && <div style={S.card}>
          <div style={S.cardTitle}>Government Docs</div>

          {/* Registration type selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Company Registration Type {isFieldReq("registration_type") && <span style={S.required}>*</span>}</label>
            <p style={{ ...S.hint, marginBottom: 10 }}>Select how your company is registered. This determines which documents are required.</p>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { value: "DTI", label: "DTI Registered", sub: "Sole Proprietorship" },
                { value: "SEC", label: "SEC Registered", sub: "Corporation / Partnership" },
              ].map(({ value, label, sub }) => {
                const active = form.registration_type === value;
                return (
                  <button key={value} onClick={() => setField("registration_type", value)} style={{
                    flex: 1, padding: "12px 10px", borderRadius: 10,
                    border: `2px solid ${active ? C.coral : C.border}`,
                    background: active ? C.coralLight : "#fff",
                    color: active ? C.coral : C.textSec,
                    fontWeight: active ? 700 : 500, fontSize: 13,
                    cursor: "pointer", fontFamily: FONT, textAlign: "center",
                    transition: "border-color 0.15s, background 0.15s",
                  }}>
                    {label}
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, color: active ? C.coralDark : C.textTer }}>
                      {sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {!form.registration_type ? (
            <div style={{ textAlign: "center", padding: "28px 0 12px", color: C.textTer, fontSize: 13 }}>
              Select your registration type above to see the required documents.
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 14px", lineHeight: 1.6 }}>
                PDF files only. Max 10 MB per file.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {govDocsForType(form.vendor_type)
                  .filter(d => !(GOV_DOCS_SEC_ONLY.has(d) && form.registration_type === "DTI"))
                  .map(docType => {
                    let displayLabel = docType;
                    if (docType === "DTI / SEC Certificate") {
                      displayLabel = form.registration_type === "SEC"
                        ? "SEC Registration Certificate"
                        : "DTI Registration Certificate";
                    }
                    // Class B gate docs are required (not optional)
                    const isClassBDoc = GOV_DOCS_CONTRACTOR_ONLY.has(docType) ||
                      GOV_DOCS_SUPPLIER_ONLY.has(docType) ||
                      GOV_DOCS_SERVICE_ONLY.has(docType) ||
                      GOV_DOCS_RENTAL_ONLY.has(docType);
                    const classBNote = isClassBDoc
                      ? "Required for Class B accreditation (PO amount up to ₱1M)."
                      : undefined;
                    return (
                      <DocUploadRow
                        key={docType}
                        docType={docType}
                        label={displayLabel}
                        note={classBNote ?? (GOV_DOCS_OPTIONAL.has(docType) ? "Optional — submit if available." : undefined)}
                        docFiles={docFiles}
                        uploadedDocs={uploadedDocs}
                        handleDocFile={handleDocFile}
                        expiryInfo={docExpiry[docType]}
                        onExpiryChange={handleExpiryChange}
                        required={!GOV_DOCS_OPTIONAL.has(docType)}
                        onDelete={handleDeleteDoc}
                        showRegInfo
                        regInfo={docRegInfo[docType]}
                        onRegInfoChange={handleRegInfoChange}
                      />
                    );
                  })
                }
              </div>
            </>
          )}
        </div>}
        {viewMode === "detail" && activeTab === "tax_gov" && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button onClick={() => setViewMode("hub")} style={{ ...S.btnSecondary, fontSize: 13 }}>← Overview</button>
          <button onClick={() => setActiveTab("fin_compliance")} style={{ ...S.btnPrimary, fontSize: 13 }}>Save &amp; Continue →</button>
        </div>}

        {/* Financials & Compliance tab */}
        {viewMode === "detail" && activeTab === "fin_compliance" && <div style={S.card}>
          <div style={S.cardTitle}>Financials</div>

          {/* Bank Details */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
              Bank Details for Check Payment
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={S.label}>Bank Name {isFieldReq("bank_details") && <span style={{ color: C.coral }}>*</span>}</label>
                <input value={form.bank_name} onChange={e => setField("bank_name", e.target.value)} placeholder="e.g. BDO Unibank" style={{ ...S.input, margin: 0 }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={S.label}>Account Name {isFieldReq("bank_details") && <span style={{ color: C.coral }}>*</span>}</label>
                <input value={form.bank_account_name} onChange={e => setField("bank_account_name", e.target.value)} placeholder="Name on the bank account" style={{ ...S.input, margin: 0 }} />
              </div>
              <div>
                <label style={S.label}>Account Number {isFieldReq("bank_details") && <span style={{ color: C.coral }}>*</span>}</label>
                <input value={form.bank_account_number} onChange={e => setField("bank_account_number", e.target.value)} placeholder="Account number" style={{ ...S.input, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }} />
              </div>
              <div>
                <label style={S.label}>Branch {isFieldReq("bank_details") && <span style={{ color: C.coral }}>*</span>}</label>
                <input value={form.bank_branch} onChange={e => setField("bank_branch", e.target.value)} placeholder="Branch name / location" style={{ ...S.input, margin: 0 }} />
              </div>
            </div>
          </div>

          {/* Financial Documents */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
            Financial Documents
          </div>
          <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px", lineHeight: 1.6 }}>
            PDF files only. Max 10 MB per file. You can revisit this link to add missing documents later.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FIN_DOCS.map(docType => {
              const isAfs        = FIN_DOCS_SEC_REQUIRED.has(docType);
              const afsRequired  = isAfs && form.registration_type === "SEC";
              const isClassANote = FIN_DOCS_CLASS_A_NOTE.has(docType);
              const required     = FIN_DOCS_ALWAYS_REQUIRED.has(docType) || afsRequired;
              const note         = isAfs && !afsRequired
                ? "Required for SEC-registered companies. Optional for DTI — submitting qualifies for Class A."
                : isClassANote
                  ? "Optional — submitting this document qualifies your company for Class A Accreditation (PO amount > ₱1M)."
                  : undefined;
              return (
                <DocUploadRow
                  key={docType}
                  docType={docType}
                  docFiles={docFiles}
                  uploadedDocs={uploadedDocs}
                  handleDocFile={handleDocFile}
                  onDelete={handleDeleteDoc}
                  required={required}
                  note={note}
                />
              );
            })}
          </div>
        </div>}
        {viewMode === "detail" && activeTab === "fin_compliance" && (() => {
          const regType2 = form.registration_type;
          const govRequired2 = !regType2 ? [] : govDocsForType(form.vendor_type).filter(d => {
            if (GOV_DOCS_OPTIONAL.has(d)) return false;
            if (GOV_DOCS_SEC_ONLY.has(d)) return regType2 === "SEC";
            return true;
          });
          const govRequiredWithExpiry2 = govRequired2.filter(d => DOCS_WITH_EXPIRY.has(d));
          const govDocsOk   = !!regType2 && govRequired2.every(d => docFiles[d] || uploadedDocs[d]);
          const govExpiryOk = govRequiredWithExpiry2.every(d => docExpiry[d]?.expiry_date);
          const idDocsOk    = COMPANY_ID_DOCS.every(d => docFiles[d] || uploadedDocs[d]);
          const idMin60     = new Date(Date.now() + 60 * 86400e3).toISOString().slice(0, 10);
          const idExpiryOk  = COMPANY_ID_DOCS.every(d => docExpiry[d]?.expiry_date && docExpiry[d].expiry_date > idMin60);
          const finRequiredOk = FIN_DOCS.filter(d =>
            FIN_DOCS_ALWAYS_REQUIRED.has(d) || (regType2 === "SEC" && FIN_DOCS_SEC_REQUIRED.has(d))
          ).every(d => docFiles[d] || uploadedDocs[d]);
          const taxInfoOk     = !!form.tin.trim() && !!form.tax_classification &&
            form.ewt_entries.some((e, i) => e.rate && e.description.trim() && (ewtFiles[i] || uploadedEwtDocs[i]));
          const bankOk        = ["bank_name", "bank_account_name", "bank_account_number", "bank_branch"].every(k => form[k]?.trim());
          // Must match the hub's reqFields exactly so "12/12 COMPLETE" ↔ submit unblocked
          const companyBasicOk = ["company_name", "registered_address", "cell_number",
            "contact_person", "authorized_representative"]
            .every(k => form[k]?.trim()) && form.rfq_emails.some(e => e.trim());
          // Telephone is optional unless admin-configured as required via fieldReqs;
          // only validate format when a value is actually entered.
          const telephoneOk    = !form.telephone.trim() || isValidLandline(form.telephone);
          const clientListOk   = form.client_list.some(r => r.name.trim());
          const equipmentOk    = form.equipment_list.some(r => r.item.trim());
          const stockholderOk  = form.stockholder_list.some(r => r.name.trim());
          const keyContactsOk  = ["president","accounting_manager","sales_manager","delivery_incharge","technical_incharge"]
            .every(k => form.key_contacts[k]?.name?.trim());
          const companyDocsOk  = (docFiles["Company Profile"] || uploadedDocs["Company Profile"]) &&
            (docFiles["Organizational Chart"] || uploadedDocs["Organizational Chart"]);
          const requiredOk =
            companyBasicOk && telephoneOk &&
            clientListOk && equipmentOk && stockholderOk && keyContactsOk && companyDocsOk &&
            taxInfoOk &&
            form.primary_activities.length > 0 &&
            form.trade_categories.length > 0 &&
            idDocsOk && idExpiryOk &&
            govDocsOk && govExpiryOk &&
            finRequiredOk && bankOk;
          return null;
        })()}

        {/* ── COMPLIANCE (part of Financials & Compliance tab) ─── */}
        {viewMode === "detail" && activeTab === "fin_compliance" && <div style={S.card}>
          <div style={S.cardTitle}>Compliance</div>

          {/* Organizational Status */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
              Organizational Status
            </div>
            <div>
              <label style={S.label}>How many full-time employees does this company have? {isFieldReq("num_employees") && <span style={S.required}>*</span>}</label>
              <input
                type="number" min="0"
                value={form.num_employees}
                onChange={e => setField("num_employees", e.target.value)}
                style={{ ...S.input, maxWidth: 140 }}
                placeholder="e.g. 25"
              />
            </div>
          </div>

          {/* Ownership Structure */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
              Ownership Structure
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Is this company a division or a subsidiary of another company? {isFieldReq("is_subsidiary") && <span style={S.required}>*</span>}</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {["yes","no"].map(v => (
                  <button key={v} type="button"
                    onClick={() => setField("is_subsidiary", v)}
                    style={{ padding: "6px 20px", borderRadius: 8, border: `1.5px solid ${form.is_subsidiary === v ? C.coral : C.border}`,
                      background: form.is_subsidiary === v ? C.coralLight : C.white,
                      color: form.is_subsidiary === v ? C.coralDark : C.textSec,
                      fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
            {form.is_subsidiary === "yes" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Name of parent company <span style={S.required}>*</span></label>
                  <input value={form.parent_company_name} onChange={e => setField("parent_company_name", e.target.value)} style={{ ...S.input, margin: 0 }} placeholder="Parent company name" />
                </div>
                <div>
                  <label style={S.label}>Country of parent company <span style={S.required}>*</span></label>
                  <input value={form.parent_company_country} onChange={e => setField("parent_company_country", e.target.value)} style={{ ...S.input, margin: 0 }} placeholder="e.g. Philippines" />
                </div>
              </div>
            )}
          </div>

          {/* Health & Safety */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
              Health &amp; Safety
            </div>
            {/* H&S Adviser */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Do you employ a H&amp;S adviser or consultant? {isFieldReq("compliance.has_hs_adviser") && <span style={S.required}>*</span>}</label>
              <p style={{ ...S.hint, marginBottom: 6 }}>If yes, please provide the name, qualifications and experience of the persons.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {["yes","no"].map(v => (
                  <button key={v} type="button"
                    onClick={() => setField("has_hs_adviser", v)}
                    style={{ padding: "6px 20px", borderRadius: 8, border: `1.5px solid ${form.has_hs_adviser === v ? C.coral : C.border}`,
                      background: form.has_hs_adviser === v ? C.coralLight : C.white,
                      color: form.has_hs_adviser === v ? C.coralDark : C.textSec,
                      fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              {form.has_hs_adviser === "yes" && (
                <textarea
                  value={form.hs_adviser_details}
                  onChange={e => setField("hs_adviser_details", e.target.value)}
                  rows={3} style={{ ...S.input, resize: "vertical", margin: 0 }}
                  placeholder="Name, qualifications, and experience of H&S adviser(s)" />
              )}
            </div>
            {/* H&S Policy */}
            <div>
              <label style={S.label}>Do you have a H&amp;S policy manual? {isFieldReq("compliance.has_hs_policy") && <span style={S.required}>*</span>}</label>
              <p style={{ ...S.hint, marginBottom: 6 }}>If yes, please supply a signed and dated copy of the H&amp;S policy statement.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {["yes","no"].map(v => (
                  <button key={v} type="button"
                    onClick={() => setField("has_hs_policy", v)}
                    style={{ padding: "6px 20px", borderRadius: 8, border: `1.5px solid ${form.has_hs_policy === v ? C.coral : C.border}`,
                      background: form.has_hs_policy === v ? C.coralLight : C.white,
                      color: form.has_hs_policy === v ? C.coralDark : C.textSec,
                      fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              {form.has_hs_policy === "yes" && (
                <DocUploadRow docType="H&S Policy Statement" docFiles={docFiles} uploadedDocs={uploadedDocs} handleDocFile={handleDocFile} onDelete={handleDeleteDoc} />
              )}
            </div>
          </div>

          {/* Quality & Environmental Management */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
              Quality &amp; Environmental Management
            </div>
            {/* QMS */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Do you have a documented Quality Management System (QMS)? {isFieldReq("compliance.has_qms") && <span style={S.required}>*</span>}</label>
              <p style={{ ...S.hint, marginBottom: 6 }}>If yes, please submit a copy of the certificate.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {["yes","no"].map(v => (
                  <button key={v} type="button"
                    onClick={() => setField("has_qms", v)}
                    style={{ padding: "6px 20px", borderRadius: 8, border: `1.5px solid ${form.has_qms === v ? C.coral : C.border}`,
                      background: form.has_qms === v ? C.coralLight : C.white,
                      color: form.has_qms === v ? C.coralDark : C.textSec,
                      fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              {form.has_qms === "yes" && (
                <DocUploadRow docType="QMS Certificate" docFiles={docFiles} uploadedDocs={uploadedDocs} handleDocFile={handleDocFile} onDelete={handleDeleteDoc} />
              )}
            </div>
            {/* Internal QMS — only shown if no formal QMS */}
            {form.has_qms === "no" && (
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Do you operate your own internal QMS or Quality Assurance / Control Programs? {isFieldReq("compliance.has_qms") && <span style={S.required}>*</span>}</label>
                <p style={{ ...S.hint, marginBottom: 6 }}>If yes, please supply a copy of your in-house quality procedures / systems.</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {["yes","no"].map(v => (
                    <button key={v} type="button"
                      onClick={() => setField("has_internal_qms", v)}
                      style={{ padding: "6px 20px", borderRadius: 8, border: `1.5px solid ${form.has_internal_qms === v ? C.coral : C.border}`,
                        background: form.has_internal_qms === v ? C.coralLight : C.white,
                        color: form.has_internal_qms === v ? C.coralDark : C.textSec,
                        fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      {v === "yes" ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
                {form.has_internal_qms === "yes" && (
                  <DocUploadRow docType="Internal QMS Procedures" docFiles={docFiles} uploadedDocs={uploadedDocs} handleDocFile={handleDocFile} onDelete={handleDeleteDoc} />
                )}
              </div>
            )}
            {/* Environmental Management */}
            <div>
              <label style={S.label}>Do you have a documented Environmental Management system? {isFieldReq("compliance.has_env_management") && <span style={S.required}>*</span>}</label>
              <p style={{ ...S.hint, marginBottom: 6 }}>If yes, submit a copy of your environmental policy and sustainable procurement policy.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {["yes","no"].map(v => (
                  <button key={v} type="button"
                    onClick={() => setField("has_env_management", v)}
                    style={{ padding: "6px 20px", borderRadius: 8, border: `1.5px solid ${form.has_env_management === v ? C.coral : C.border}`,
                      background: form.has_env_management === v ? C.coralLight : C.white,
                      color: form.has_env_management === v ? C.coralDark : C.textSec,
                      fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {v === "yes" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              {form.has_env_management === "yes" && (
                <DocUploadRow docType="Environmental Management Policy" docFiles={docFiles} uploadedDocs={uploadedDocs} handleDocFile={handleDocFile} onDelete={handleDeleteDoc} />
              )}
            </div>
          </div>
        </div>}
        {viewMode === "detail" && activeTab === "fin_compliance" && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button onClick={() => setViewMode("hub")} style={{ ...S.btnSecondary, fontSize: 13 }}>← Overview</button>
            <button onClick={() => setActiveTab("declaration")} style={{ ...S.btnPrimary, fontSize: 13 }}>Save &amp; Continue →</button>
          </div>
        )}

        {/* ── DECLARATION TAB ─────────────────────────────────────── */}
        {viewMode === "detail" && activeTab === "declaration" && (() => {
          const regType2 = form.registration_type;
          const govRequired2 = !regType2 ? [] : govDocsForType(form.vendor_type).filter(d => {
            if (GOV_DOCS_OPTIONAL.has(d)) return false;
            if (GOV_DOCS_SEC_ONLY.has(d)) return regType2 === "SEC";
            return true;
          });
          const govRequiredWithExpiry2 = govRequired2.filter(d => DOCS_WITH_EXPIRY.has(d));
          const govDocsOk   = !!regType2 && govRequired2.every(d => docFiles[d] || uploadedDocs[d]);
          const govExpiryOk = govRequiredWithExpiry2.every(d => docExpiry[d]?.expiry_date);
          const idDocsOk    = COMPANY_ID_DOCS.every(d => docFiles[d] || uploadedDocs[d]);
          const idMin60     = new Date(Date.now() + 60 * 86400e3).toISOString().slice(0, 10);
          const idExpiryOk  = COMPANY_ID_DOCS.every(d => docExpiry[d]?.expiry_date && docExpiry[d].expiry_date > idMin60);
          const finRequiredOk = FIN_DOCS.filter(d =>
            FIN_DOCS_ALWAYS_REQUIRED.has(d) || (regType2 === "SEC" && FIN_DOCS_SEC_REQUIRED.has(d))
          ).every(d => docFiles[d] || uploadedDocs[d]);
          const taxInfoOk     = !!form.tin.trim() && !!form.tax_classification &&
            form.ewt_entries.some((e, i) => e.rate && e.description.trim() && (ewtFiles[i] || uploadedEwtDocs[i]));
          const bankOk        = ["bank_name", "bank_account_name", "bank_account_number", "bank_branch"].every(k => form[k]?.trim());
          // Must match the hub's reqFields exactly so "12/12 COMPLETE" ↔ submit unblocked
          const companyBasicOk = ["company_name", "registered_address", "cell_number",
            "contact_person", "authorized_representative"]
            .every(k => form[k]?.trim()) && form.rfq_emails.some(e => e.trim());
          // Vendor-type admin-configured fields (mirrors _cfgOk from the hub)
          const _decCfg = fieldReqs[form.vendor_type] || {};
          const cfgFieldsOk =
            (!_decCfg.telephone            || !!form.telephone.trim()) &&
            (!_decCfg.contact_position      || !!form.contact_position.trim()) &&
            (!_decCfg.representative_title  || !!form.representative_title.trim()) &&
            (!_decCfg.satellite_address     || !!form.satellite_address.trim()) &&
            (!_decCfg.location_map_url      || !!form.location_map_url.trim()) &&
            (!_decCfg.num_employees         || !!form.num_employees) &&
            (!_decCfg["key_contacts.president"]          || !!form.key_contacts.president?.name?.trim()) &&
            (!_decCfg["key_contacts.accounting_manager"] || !!form.key_contacts.accounting_manager?.name?.trim()) &&
            (!_decCfg["key_contacts.sales_manager"]      || !!form.key_contacts.sales_manager?.name?.trim()) &&
            (!_decCfg["key_contacts.delivery_incharge"]  || !!form.key_contacts.delivery_incharge?.name?.trim()) &&
            (!_decCfg["key_contacts.technical_incharge"] || !!form.key_contacts.technical_incharge?.name?.trim()) &&
            (!_decCfg.tin                  || !!form.tin.trim()) &&
            (!_decCfg.tax_classification   || !!form.tax_classification) &&
            (!_decCfg.registration_type    || !!form.registration_type) &&
            (!_decCfg.bank_details         || bankOk) &&
            (!_decCfg["compliance.has_hs_adviser"]      || !!form.has_hs_adviser) &&
            (!_decCfg["compliance.has_hs_policy"]       || !!form.has_hs_policy) &&
            (!_decCfg["compliance.has_qms"]             || !!form.has_qms) &&
            (!_decCfg["compliance.has_env_management"]  || !!form.has_env_management) &&
            (!_decCfg.signatories || (!!form.signatory_sales_manager.trim() && !!form.signatory_president.trim()));
          // Telephone is optional unless admin-configured as required via fieldReqs;
          // only validate format when a value is actually entered.
          const telephoneOk    = !form.telephone.trim() || isValidLandline(form.telephone);
          const clientListOk   = form.client_list.some(r => r.name.trim());
          const equipmentOk    = form.equipment_list.some(r => r.item.trim());
          const stockholderOk  = form.stockholder_list.some(r => r.name.trim());
          const keyContactsOk  = ["president","accounting_manager","sales_manager","delivery_incharge","technical_incharge"]
            .every(k => form.key_contacts[k]?.name?.trim());
          const companyDocsOk  = (docFiles["Company Profile"] || uploadedDocs["Company Profile"]) &&
            (docFiles["Organizational Chart"] || uploadedDocs["Organizational Chart"]);
          const complianceOk   = !!form.num_employees &&
            !!form.is_subsidiary &&
            (form.is_subsidiary !== "yes" || (form.parent_company_name.trim() && form.parent_company_country.trim())) &&
            !!form.has_hs_adviser && !!form.has_hs_policy && !!form.has_qms &&
            (form.has_qms !== "no" || !!form.has_internal_qms) &&
            !!form.has_env_management;
          const declarationOk  = form.declaration_confirmed && form.authorization_confirmed &&
            !!sigSalesManager && !!sigPresident &&
            !!form.signatory_sales_manager.trim() && !!form.signatory_president.trim();
          // Only enforce what the hub section cards actually track (so hub "100% / Ready to submit"
          // always matches a clickable Submit button). Non-hub items (client list, equipment,
          // key contacts, company docs, bank details, compliance answers) are optional unless
          // admin marks them required via fieldReqs → cfgFieldsOk.
          const requiredOk =
            companyBasicOk && cfgFieldsOk && telephoneOk &&
            taxInfoOk &&
            form.primary_activities.length > 0 &&
            form.trade_categories.length > 0 &&
            idDocsOk && idExpiryOk &&
            govDocsOk && govExpiryOk &&
            finRequiredOk &&
            declarationOk;
          const disabled = submitting || !requiredOk;
          return <>
            <div style={S.card}>
              <div style={S.cardTitle}>Declaration</div>

              {/* Truth & Authenticity Declaration */}
              <div style={{ background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 20, fontSize: 13, color: C.textPri, lineHeight: 1.7 }}>
                The undersigned hereby confirms that the above information is true and correct, and that we are the duly authorized to enter into this accreditation agreement and the supporting documents attached hereto are genuine and authentic. I also declare that the owners, managers, supervisors, marketing, sales &amp; accounting personnel of our company are not related to any employee of <strong>PH1 World Developers</strong>.
              </div>

              {/* Authorization */}
              <div style={{ background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 24, fontSize: 13, color: C.textPri, lineHeight: 1.7 }}>
                I hereby authorize <strong>PH1 World Developers</strong>, to obtain pertinent information from clients, banks and any other source necessary for the objective of evaluation for this application. The undersigned also authorizes the release of any information as needed by PH1 from any of the above listed source of information.
              </div>

              {/* Signatories */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                {/* Sales Manager */}
                <div>
                  <SignaturePad value={sigSalesManager} onChange={setSigSalesManager} />
                  <div style={{ borderTop: `1.5px solid ${C.textPri}`, marginTop: 8 }} />
                  <input
                    value={form.signatory_sales_manager}
                    onChange={e => setField("signatory_sales_manager", e.target.value)}
                    style={{ ...S.input, margin: "4px 0 0", textAlign: "center", border: "none", borderRadius: 0, background: "transparent", padding: "0 0 2px" }}
                    placeholder="Printed name"
                  />
                  <div style={{ fontSize: 11, color: C.textSec, marginTop: 3, fontWeight: 600, textAlign: "center" }}>Signature over Printed Name</div>
                  <div style={{ fontSize: 11, color: C.textTer, textAlign: "center" }}>Sales Manager</div>
                </div>
                {/* President / CEO */}
                <div>
                  <SignaturePad value={sigPresident} onChange={setSigPresident} />
                  <div style={{ borderTop: `1.5px solid ${C.textPri}`, marginTop: 8 }} />
                  <input
                    value={form.signatory_president}
                    onChange={e => setField("signatory_president", e.target.value)}
                    style={{ ...S.input, margin: "4px 0 0", textAlign: "center", border: "none", borderRadius: 0, background: "transparent", padding: "0 0 2px" }}
                    placeholder="Printed name"
                  />
                  <div style={{ fontSize: 11, color: C.textSec, marginTop: 3, fontWeight: 600, textAlign: "center" }}>Signature over Printed Name</div>
                  <div style={{ fontSize: 11, color: C.textTer, textAlign: "center" }}>President / Chief Executive Officer</div>
                </div>
              </div>

              {/* Agreement checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {[
                  { key: "declaration_confirmed", label: "I confirm that the above information is true and correct, and the supporting documents are genuine and authentic." },
                  { key: "authorization_confirmed", label: "I authorize PH1 World Developers to obtain pertinent information from clients, banks, and any other source necessary for evaluation." },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                    <input type="checkbox" checked={form[key]} onChange={e => setField(key, e.target.checked)}
                      style={{ marginTop: 2, width: 16, height: 16, accentColor: C.coral, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: C.textPri, lineHeight: 1.5 }}>{label}</span>
                  </label>
                ))}
              </div>

              {/* Reminders */}
              <div style={{ background: "#FEF3E2", border: "1px solid #FCD34D", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.amberText, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Reminders</div>
                <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "The application should be completed by all suppliers seeking registration as an approved service provider. This however does not guarantee business with PH1.",
                    "All the required supporting documentation must be submitted together with the Application Form.",
                    "PH1 reserves the right to reject any incomplete Application Form accompanied by insufficient information.",
                    "PH1 reserves the right to accept or reject any application without being obliged to give any reasons in this respect.",
                    "All supplier information will be treated with strict confidentiality.",
                    "The completion of Supplier Accreditation Application Form is compulsory. Failure to complete this section will result in your application not being considered.",
                    "PH1 reserves the right to validate the accuracy of information presented. Any misinterpretation of facts will lead to disqualification and potentially being restricted to do business with other spheres of government and/or other organs of state.",
                  ].map((text, i) => (
                    <li key={i} style={{ fontSize: 12, color: C.amberText, lineHeight: 1.6 }}>{text}</li>
                  ))}
                </ol>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 16 }}>
              <button onClick={() => setViewMode("hub")} style={{ ...S.btnSecondary, fontSize: 13 }}>← Overview</button>
            </div>
            <button onClick={handleSubmit} disabled={disabled} style={{
              width: "100%", padding: "14px 0", marginTop: 12,
              background: disabled ? C.border : `linear-gradient(135deg, ${C.coral}, ${C.coralDark})`,
              color: disabled ? C.textTer : "#fff", border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: disabled ? "none" : "0 4px 16px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)",
              transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
            }}>
              {submitting ? "Submitting…" : isAccredited ? "Submit Update" : isReturned ? "Resubmit Application" : "Submit Application"}
            </button>
            {!requiredOk && !submitting && (
              <p style={{ fontSize: 11, color: C.amberText, textAlign: "center", marginTop: 10 }}>
                {!companyBasicOk
                  ? "Complete all required fields in Company Information."
                  : !cfgFieldsOk ? "Complete all required fields for your vendor type before submitting."
                  : !telephoneOk ? "Enter a valid telephone number in Company Information."
                  : !idDocsOk ? "Upload both valid government IDs in Company Information."
                  : !idExpiryOk ? "Government IDs must be valid for at least 60 days. Enter valid expiry dates in Company Information."
                  : !taxInfoOk ? "Complete TIN, Tax Classification, and at least one EWT entry with proof in Tax Information."
                  : !regType2 ? "Select your registration type (DTI or SEC) in Government Docs."
                  : !govDocsOk ? "Upload all required government documents before submitting."
                  : !govExpiryOk ? "Enter expiry dates for all required government documents."
                  : !finRequiredOk ? (form.registration_type === "SEC"
                    ? "SEC-registered companies must upload AFS, Certificate of Good Credit Standing, and Sample PO/JO in addition to OR & Sales Invoice and Copy of ITR."
                    : "Upload all required financial documents before submitting.")

                  : !(form.primary_activities.length > 0) ? "Select your primary activity (Dealer / Manufacturer / Service Provider)."
                  : !(form.trade_categories.length > 0) ? "Select at least one trade category."
                  : !declarationOk ? "Complete the signatories and check both agreement boxes in Declaration."
                  : "Please review all sections before submitting."}
              </p>
            )}
            <p style={{ fontSize: 11, color: C.textTer, textAlign: "center", marginTop: 8 }}>
              Your application will be reviewed by our team. You may revisit this link to check your status.
            </p>
          </>;
        })()}
      </div>
    </div>
  );
}

// ─── ROOT VENDOR APP ──────────────────────────────────────────────────────────
export default function VendorApp() {
  const accToken = window.location.pathname.match(/\/vendor\/accreditation\/([^/]+)/)?.[1];
  if (accToken && accToken !== "apply") return <VendorAccreditationPage token={accToken} />;
  if (window.location.pathname === "/vendor/accreditation/apply") return <VendorAccreditationPage token={null} />;

  const rfqToken = window.location.pathname.match(/\/vendor\/rfq\/([^/]+)/)?.[1];
  if (rfqToken) return <VendorRFQPage token={rfqToken} />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.offWhite, fontFamily: FONT }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textPri, marginBottom: 8 }}>Nothing here</div>
        <div style={{ fontSize: 13, color: C.textSec }}>Please use the link provided to you.</div>
      </div>
    </div>
  );
}
