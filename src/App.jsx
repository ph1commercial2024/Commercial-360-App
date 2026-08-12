import React, { useState, useEffect, useContext, createContext, useRef } from "react";
import { supabase } from "./lib/supabase";
import { venCode, vendorRef } from "./lib/vendorCode";
import { generatePRNumber } from "./lib/prRef";
import { pickToken, buildInviteUrl } from "./lib/inviteTokenLogic";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";

// ─── EMAIL HELPER ─────────────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ to, subject, html }),
    });
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

// ─── SIDEBAR CONTEXT ──────────────────────────────────────────────────────────
const SidebarCtx = createContext({ toggle: () => {} });
function HamburgerBtn() {
  const { toggle } = useContext(SidebarCtx);
  return (
    <button onClick={toggle} title="Toggle menu" style={{ background: "none", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 7, cursor: "pointer", width: 32, height: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 }}>
      <span style={{ display: "block", width: 13, height: 1.8, background: "rgba(255,255,255,0.85)", borderRadius: 2 }} />
      <span style={{ display: "block", width: 13, height: 1.8, background: "rgba(255,255,255,0.85)", borderRadius: 2 }} />
      <span style={{ display: "block", width: 13, height: 1.8, background: "rgba(255,255,255,0.85)", borderRadius: 2 }} />
    </button>
  );
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  coral:      "#3F3F3F",
  coralDark:  "#2A2A2A",
  coralLight: "#EFEFEF",
  coralMid:   "#E8E8E8",
  black:      "#000000",
  brandDark:  "#1A1917",
  mahogany:   "#3A1F1A",
  white:      "#FFFFFF",
  offWhite:   "#F2F2F7",
  surface:    "#F7F7F7",
  border:     "#E0E0E6",
  borderMid:  "#C8C8CE",
  textPri:    "#1C1C1E",
  textSec:    "#8E8E93",
  textTer:    "#AEAEB2",
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

const STATUS_COLORS = {
  "Draft":                     { bg: C.grayBg,  color: C.grayText  },
  "Pending Manager Approval":  { bg: C.amberBg, color: C.amberText },
  "Pending GM Approval":       { bg: C.amberBg, color: C.amberText }, // legacy fallback
  "For Review":                { bg: C.tealBg,  color: C.tealText  },
  "Under Review":              { bg: "#EEF2FF", color: "#4338CA"   },
  "Pending Endorsement":       { bg: "#FDF4FF", color: "#7E22CE"   },
  "Approved 1":                { bg: "#FDF4FF", color: "#7E22CE"   }, // legacy fallback
  "Approved":                  { bg: C.greenBg, color: C.greenText },
  "Rejected":                  { bg: C.redBg,   color: C.redText   },
  "Rush":                      { bg: C.amberBg, color: C.amberText },
  "Budgeted":                  { bg: C.greenBg, color: C.greenText },
  "Unbudgeted":                { bg: C.redBg,   color: C.redText   },
  // RFA workflow statuses
  "Submitted":                 { bg: C.amberBg, color: C.amberText },
  "Returned":                  { bg: C.redBg,   color: C.redText   },
  "Completed":                 { bg: C.greenBg, color: C.greenText }, // legacy fallback
};

const styles = {
  appShell: {
    minHeight: "100vh",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    background: C.offWhite,
    color: C.textPri,
  },
  appHeader: {
    background: "rgba(63,63,63,1)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    height: 56, display: "flex", alignItems: "center",
    padding: "0 28px", gap: 14,
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
    boxShadow: "0 2px 12px rgba(0,0,0,0.22), 0 1px 0 rgba(0,0,0,0.12)",
  },
  sidebar: (open) => ({
    width: 230, minWidth: 230,
    background: "linear-gradient(180deg, #141414 0%, #000000 100%)",
    display: "flex", flexDirection: "column",
    position: "fixed", top: 56, left: 0,
    height: "calc(100vh - 56px)", zIndex: 150,
    borderRadius: "0 16px 16px 0",
    boxShadow: "4px 0 32px rgba(0,0,0,0.35)",
    overflow: "hidden",
    transform: open ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.28s cubic-bezier(0.23,1,0.32,1)",
  }),
  sidebarBackdrop: (open) => ({
    position: "fixed", inset: 0, top: 56, zIndex: 140,
    background: "rgba(0,0,0,0.45)",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transition: "opacity 0.28s ease",
  }),
  nav: { padding: "16px 10px", flex: 1, overflowY: "auto" },
  navSection: {
    fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)",
    letterSpacing: "0.08em", textTransform: "uppercase",
    padding: "0 12px", marginBottom: 6, marginTop: 16,
  },
  navItem: (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10,
    cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
    background: active ? "rgba(255,255,255,0.1)" : "transparent",
    border: "none",
    marginBottom: 2, transition: "background 0.15s, color 0.15s",
    width: "100%", textAlign: "left",
  }),
  sidebarUser: {
    padding: "14px 16px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex", alignItems: "center", gap: 10,
  },
  avatar: {
    width: 34, height: 34, borderRadius: "50%",
    background: `linear-gradient(135deg, ${C.coral}, ${C.coralDark})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 600, color: C.white, flexShrink: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  },
  mainContent: {
    paddingTop: 56,
    minHeight: "100vh", background: C.offWhite,
  },
  topBar: {
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    padding: "0 28px",
    height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky", top: 56, zIndex: 50,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
  },
  pageBody: { padding: "28px 56px 48px", maxWidth: 1440, margin: "0 auto" },
  card: {
    background: C.white, border: "none",
    borderRadius: 12, padding: "22px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    fontSize: 13, fontWeight: 600, color: C.textPri,
    paddingBottom: 12, borderBottom: `1px solid ${C.border}`, margin: "0 0 16px",
  },
  label:         { display: "block", fontSize: 12, fontWeight: 500, color: C.textSec, marginBottom: 5 },
  input: {
    width: "100%", boxSizing: "border-box", padding: "10px 13px", fontSize: 14,
    border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, background: "#F9F9F9",
    color: C.textPri, outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
    fontFamily: "inherit",
  },
  inputDisabled: { background: "#EFEFEF", color: C.textSec, border: "1px solid rgba(0,0,0,0.08)" },
  hint:     { fontSize: 11, color: C.textTer, marginTop: 4 },
  required: { color: C.coral, marginLeft: 2 },
  btnPrimary: {
    background: C.coral,
    color: C.white, border: "none", borderRadius: 22,
    padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer",
    transition: "opacity 0.15s, transform 0.15s, box-shadow 0.15s", fontFamily: "inherit",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)",
  },
  btnSecondary: {
    background: "transparent", color: C.coral, border: `1.5px solid ${C.coral}`,
    borderRadius: 22, padding: "9px 20px", fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s, transform 0.15s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  btnGhost: {
    background: "transparent", color: C.textSec, border: `1px solid ${C.border}`,
    borderRadius: 18, padding: "6px 14px", fontSize: 12, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s, transform 0.15s",
  },
  btnDanger: {
    background: "#FF3B30", color: C.white, border: "none",
    borderRadius: 22, padding: "10px 22px", fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s, transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 3px 10px rgba(255,59,48,0.35)",
  },
  btnSuccess: {
    background: C.greenBg, color: C.greenText, border: `1px solid #86EFAC`,
    borderRadius: 22, padding: "10px 20px", fontSize: 14, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s, transform 0.15s",
  },
  btnAmber: {
    background: C.amberBg, color: C.amberText, border: `1px solid #FCD34D`,
    borderRadius: 22, padding: "10px 20px", fontSize: 14, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s, transform 0.15s",
  },
  badge: (type) => {
    const s = STATUS_COLORS[type] || STATUS_COLORS["Draft"];
    return {
      display: "inline-flex", alignItems: "center", padding: "4px 10px",
      borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, whiteSpace: "nowrap", letterSpacing: "0.01em",
    };
  },
};

// ─── POSITIONS & PERMISSIONS ──────────────────────────────────────────────────
const POSITIONS = ["Supervisor","Manager","D&C Head","Commercial Officer","Commercial Manager","Finance Head","President"];

function can(profile, action) {
  const pos = profile?.position;
  const adm = profile?.is_admin === true;
  if (adm) return true;
  switch (action) {
    // PR
    case "pr.prepare":            return ["Supervisor","Manager","Commercial Officer","Commercial Manager","D&C Head"].includes(pos);
    case "pr.send_to_manager":    return pos === "Supervisor";
    case "pr.submit":             return ["Manager","Commercial Officer","Commercial Manager","D&C Head"].includes(pos);
    case "pr.review":             return ["Commercial Officer","Commercial Manager","D&C Head"].includes(pos);
    case "pr.approve_budgeted":   return ["Commercial Manager","D&C Head"].includes(pos);
    case "pr.endorse_unbudgeted": return pos === "Commercial Manager";
    case "pr.approve_unbudgeted": return pos === "D&C Head";
    case "pr.reject":             return ["Commercial Manager","D&C Head"].includes(pos);
    case "pr.create_rfa":         return ["Commercial Officer","Commercial Manager","D&C Head"].includes(pos);
    // RFA
    case "rfa.create":            return ["Commercial Officer","Commercial Manager"].includes(pos);
    case "rfa.submit":            return ["Commercial Officer","Commercial Manager"].includes(pos);
    case "rfa.withdraw":          return ["Commercial Officer","Commercial Manager"].includes(pos);
    case "rfa.review":            return ["Commercial Officer","Commercial Manager"].includes(pos);
    case "rfa.approve":           return ["Commercial Manager","D&C Head"].includes(pos);
    case "rfa.generate":          return ["Commercial Officer","Commercial Manager"].includes(pos);
    // Projects
    case "project.view":          return ["Commercial Officer","Commercial Manager","D&C Head"].includes(pos);
    case "project.create":        return ["Commercial Officer","Commercial Manager","D&C Head"].includes(pos);
    case "project.edit":          return ["Commercial Officer","Commercial Manager","D&C Head"].includes(pos);
    case "project.delete":        return ["Commercial Manager","D&C Head"].includes(pos);
    // Vendors
    case "vendor.view":           return ["Commercial Officer","Commercial Manager","D&C Head"].includes(pos);
    case "vendor.add":            return ["Commercial Officer","Commercial Manager"].includes(pos);
    case "vendor.edit":           return ["Commercial Officer","Commercial Manager"].includes(pos);
    case "vendor.delete":         return pos === "Commercial Manager";
    // RFP (legacy)
    case "rfp.create":            return ["Commercial Officer","Commercial Manager"].includes(pos);
    case "rfp.manage":            return ["Commercial Officer","Commercial Manager"].includes(pos);
    case "rfp.bidcom1":           return pos === "Finance Head";
    case "rfp.bidcom2":           return pos === "President";
    // Admin only
    case "settings.view":         return false;
    case "users.view":            return false;
    default:                      return false;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "—";
const fmtShort = (d) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtCurrency = (n) => n ? `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—";

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 14, color = "currentColor" }) => {
  const icons = {
    pr:           <><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></>,
    projects:     <><path d="M6 5h12v14H6V5z"/><path d="M6 5c0-1.1 2.7-2 6-2s6 .9 6 2s-2.7 2-6 2-6-.9-6-2z"/><path d="M6 19c0-1.1 2.7-2 6-2s6 .9 6 2s-2.7 2-6 2-6-.9-6-2z"/><path d="M9 10h6M9 13h6M9 16h4"/></>,
    reports:      <path d="M18 20V10M12 20V4M6 20v-6"/>,
    users:        <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>,
    settings:     <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    search:       <><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></>,
    chevronRight: <path d="M9 18l6-6-6-6"/>,
    chevronLeft:  <path d="M15 18l-6-6 6-6"/>,
    trash:        <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></>,
    upload:       <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>,
    logout:       <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    alert:        <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    check:        <polyline points="20 6 9 17 4 12"/>,
    file:         <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    send:         <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    dollar:       <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
    rfp:          <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>,
    contract:     <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    download:     <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    eye:          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    plus:         <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    warning:      <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
function LoadingScreen({ logoUrl }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.white }}>
      <style>{`
        @keyframes ph1-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1;   }
        }
      `}</style>
      {logoUrl && (
        <img
          src={logoUrl}
          alt="PH1 World Developers Inc."
          style={{ width: 200, maxWidth: "60vw", objectFit: "contain", animation: "ph1-pulse 1.8s ease-in-out infinite" }}
        />
      )}
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setError(""); setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      if (authError.message === "Invalid login credentials") setError("Incorrect email or password. Please try again.");
      else if (authError.message.includes("Email not confirmed")) setError("Please confirm your email address before signing in.");
      else setError(authError.message);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif" }}>
      <style>{`
        /* ── Mahbowal card style (standard colors) ── */
        .lf-card {
          max-width: 380px; width: 100%;
          background: linear-gradient(0deg, rgb(255,255,255) 0%, rgb(244,247,251) 100%);
          border-radius: 40px;
          padding: 28px 35px 32px;
          border: 5px solid rgb(255,255,255);
          box-shadow: rgba(0,0,0,0.10) 0px 30px 30px -20px;
        }
        .lf-card-heading {
          text-align: center; font-weight: 900; font-size: 26px; color: #1a1a1a;
        }
        .lf-form { margin-top: 18px; }
        .lf-input {
          width: 100%; background: white; border: none;
          padding: 15px 20px; border-radius: 20px; margin-top: 15px;
          box-shadow: rgba(0,0,0,0.08) 0px 10px 10px -5px;
          border-inline: 2px solid transparent;
          font-size: 14px; font-family: inherit; color: #333;
          box-sizing: border-box; outline: none;
          transition: border-color 0.2s;
        }
        .lf-input::placeholder { color: rgb(170,170,170); }
        .lf-input:focus { border-inline: 2px solid #E05C45; }
        .lf-forgot { display: block; margin-top: 10px; margin-left: 10px; }
        .lf-forgot a { font-size: 11px; color: #E05C45; text-decoration: none; }
        .lf-btn {
          display: block; width: 100%; font-weight: bold;
          background: linear-gradient(45deg, #E05C45 0%, #f07d5a 100%);
          color: white; padding-block: 15px; margin: 20px auto 0;
          border-radius: 20px;
          box-shadow: rgba(224,92,69,0.5) 0px 20px 10px -15px;
          border: none; cursor: pointer; font-family: inherit; font-size: 14px;
          transition: all 0.2s ease-in-out;
        }
        .lf-btn:hover { transform: scale(1.03); box-shadow: rgba(224,92,69,0.5) 0px 23px 10px -20px; }
        .lf-btn:active { transform: scale(0.95); box-shadow: rgba(224,92,69,0.5) 0px 15px 10px -10px; }
        .lf-btn:disabled { opacity: 0.65; cursor: default; transform: none; }
        .lf-social-wrap { margin-top: 22px; }
        .lf-social-title { display: block; text-align: center; font-size: 10px; color: rgb(170,170,170); }
        .lf-socials { width: 100%; display: flex; justify-content: center; gap: 15px; margin-top: 8px; }
        .lf-social-btn {
          background: linear-gradient(45deg, rgb(30,30,30) 0%, rgb(100,100,100) 100%);
          border: 5px solid white; padding: 5px; border-radius: 50%;
          width: 40px; aspect-ratio: 1; display: grid; place-content: center;
          box-shadow: rgba(0,0,0,0.18) 0px 12px 10px -8px;
          transition: all 0.2s ease-in-out; cursor: pointer;
        }
        .lf-social-btn:hover { transform: scale(1.2); }
        .lf-social-btn:active { transform: scale(0.9); }
        .lf-agreement { display: block; text-align: center; margin-top: 15px; }
        .lf-agreement a { text-decoration: none; color: #E05C45; font-size: 9px; }
        .lf-error {
          display: flex; align-items: center; gap: 8px;
          background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px;
          padding: 10px 12px; margin-bottom: 8px; font-size: 12px; color: #dc2626;
        }
        .lf-right-panel {
          flex: 1;
          background:
            linear-gradient(170deg, rgba(220,70,35,0.72) 0%, rgba(180,35,15,0.78) 50%, rgba(100,15,5,0.82) 100%),
            url('/city-bg.jpg') center/cover no-repeat;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 60px 48px; text-align: center; position: relative; overflow: hidden;
        }
        .lf-right-panel > * { position: relative; z-index: 1; }
      `}</style>

      {/* ── Left panel: form ── */}
      <div style={{ flex: "0 0 45%", background: "#f0f2f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px" }}>
        {/* Eyebrow + app name above card */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>WELCOME TO</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.5px" }}>Commercial 360</span>
          </div>
        </div>

        {/* Card */}
        <div className="lf-card">
          <div className="lf-card-heading">Sign In</div>
          <form className="lf-form" onSubmit={handleSubmit}>
            {error && (
              <div className="lf-error">
                <Icon name="alert" size={13} color="#dc2626" />{error}
              </div>
            )}
            <input className="lf-input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="lf-input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <span className="lf-forgot"><a href="#">Forgot Password?</a></span>
            <button className="lf-btn" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button>
          </form>

          <span className="lf-agreement"><a href="#">Having trouble? Contact your administrator for access.</a></span>
        </div>
      </div>

      {/* ── Right panel: branding ── */}
      <div className="lf-right-panel">
        <img src="/ph1-logo.png" alt="PH1 World Developers" style={{ height: 64, objectFit: "contain", marginBottom: 24, filter: "brightness(0) invert(1)" }} />
        <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", marginBottom: 16 }}>Commercial 360</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.8, maxWidth: 320 }}>
          Your end-to-end platform for purchase requests, vendor accreditation, RFQ management, and contract processing — all in one place.
        </div>
        <div style={{ marginTop: 40, fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", textTransform: "uppercase" }}>PH1 World Developers Inc.</div>
      </div>
    </div>
  );
}

// ─── APP HEADER ───────────────────────────────────────────────────────────────
function AppHeader({ profile, pageTitle }) {
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div style={styles.appHeader}>
      <HamburgerBtn />
      {/* PH1 World Developers logo — white version */}
      <img
        src="/ph1-logo.png"
        alt="PH1 World Developers"
        style={{ height: 32, width: "auto", objectFit: "contain", flexShrink: 0 }}
      />

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.3)", flexShrink: 0 }} />

      {/* System label */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.white, letterSpacing: "0.02em", lineHeight: 1.2 }}>D&amp;C – Procurement, Commercial &amp; Contract</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.2 }}>Management System</div>
      </div>

      {/* Page title */}
      {pageTitle && (
        <>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>{pageTitle}</span>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* User info */}
      {profile && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.white, lineHeight: 1.3 }}>{profile.full_name || "User"}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              {profile.position || "—"}
              {profile.is_admin && (
                <span style={{ padding: "1px 6px", borderRadius: 99, background: "rgba(0,0,0,0.25)", color: C.white, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em" }}>ADMIN</span>
              )}
            </div>
          </div>
          <div style={{ ...styles.avatar, background: C.black, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>{initials}</div>
        </div>
      )}
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, profile, onLogout, open, onClose }) {
  const isAdm       = profile?.is_admin === true;
  const showPR      = can(profile, "pr.prepare") || isAdm;
  const showProjects= can(profile, "project.view");
  const showVendors = can(profile, "vendor.view");
  const showRFPs    = can(profile, "rfp.create") || can(profile, "rfp.bidcom1") || can(profile, "rfp.bidcom2");
  const showRFA     = can(profile, "rfa.create") || can(profile, "rfa.approve");
  const navItems = [
  ...(showPR ? [
    { key: "dashboard",    label: "Purchase Requests", icon: "pr",       section: "MAIN"  },
  ] : []),
  ...(showProjects ? [
    { key: "projects",     label: "Projects",          icon: "projects", section: showPR ? null : "MAIN" },
  ] : []),
  ...(showRFPs ? [
    { key: "rfps",         label: "RFPs",              icon: "rfp",      section: null    },
  ] : []),
  ...(showVendors ? [
    { key: "vendors",      label: "Vendors",           icon: "users",    section: null    },
  ] : []),
  ...(showRFA ? [
    { key: "rfq_list",     label: "RFQ",               icon: "rfp",      section: null    },
    { key: "rfa_list",     label: "Rec. for Award",    icon: "rfp",      section: null    },
    { key: "contracts",    label: "Contracts",          icon: "contract", section: null    },
  ] : []),
  ...(isAdm ? [
    { key: "users",        label: "Users & Roles",     icon: "users",    section: "ADMIN" },
    { key: "settings",     label: "Settings",          icon: "settings", section: null    },
  ] : []),
];
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  let lastSection = null;
  return (
    <div style={styles.sidebar(open)}>
      <nav style={styles.nav}>
        {navItems.map(item => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          return (
            <div key={item.key}>
              {showSection && <div style={{ ...styles.navSection, marginTop: item.section === "MAIN" ? 0 : 16 }}>{item.section}</div>}
              <button style={styles.navItem(page === item.key)} onClick={() => setPage(item.key)}>
                <Icon name={item.icon} size={14} color={page === item.key ? "#FFFFFF" : "rgba(255,255,255,0.6)"} />
                {item.label}
              </button>
            </div>
          );
        })}
      </nav>
      <div style={styles.sidebarUser}>
        <div style={styles.avatar}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.full_name || "User"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{profile?.position || "—"}{profile?.is_admin ? " · Admin" : ""}</div>
        </div>
        <button onClick={onLogout} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
          <Icon name="logout" size={14} color="rgba(255,255,255,0.4)" />
        </button>
      </div>
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", borderTop: accent ? `3px solid ${accent}` : undefined, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6, fontWeight: 500, letterSpacing: "0.02em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: C.textPri, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

// ─── INFO ROW ─────────────────────────────────────────────────────────────────
function InfoRow({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.textPri }}>{children || "—"}</div>
    </div>
  );
}

// ─── STATUS TIMELINE ──────────────────────────────────────────────────────────
function StatusTimeline({ status, dates = {} }) {
  const steps = [
    { label: "Prepare", date: dates.prepare },
    { label: "Submit",  date: dates.submit  },
    { label: "Review",  date: dates.review  },
    { label: "Approve", date: dates.approve },
  ];
  const isRejected = status === "Rejected";

  // Map DB statuses to simplified 4-step display index
  const statusToStep = {
    "Draft":               0,
    "Pending GM Approval": 1,
    "For Review":          1,
    "Under Review":        2,
    "Approved 1":          3,
    "Approved":            4,
  };
  const currentIdx = isRejected ? 2 : (statusToStep[status] ?? 0);

  const fmtDate = d => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 8, paddingBottom: 4 }}>
      {steps.map((step, i) => {
        const done   = i < currentIdx;
        const active = !isRejected && i === currentIdx;
        const reject = isRejected && i === currentIdx;
        const bg = done ? C.greenText : active ? C.coral : reject ? C.redText : C.borderMid;
        const labelColor = active || reject ? bg : done ? C.greenText : C.textTer;
        return (
          <div key={step.label} style={{ display: "flex", alignItems: "flex-start", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: (active || reject) ? `0 0 0 4px ${bg}28` : "none" }}>
                {done ? <Icon name="check" size={14} color="white" /> : <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: labelColor, textAlign: "center", lineHeight: 1.35 }}>
                {reject ? "Rejected" : step.label}
              </span>
              <span style={{ fontSize: 10, color: done || active || reject ? C.textSec : C.textTer, textAlign: "center", lineHeight: 1.3, minHeight: 14 }}>
                {fmtDate(step.date) || (done || active ? "—" : "")}
              </span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: done ? C.greenText : C.border, margin: "0 8px", marginTop: 16, minWidth: 24 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── MULTI-SELECT FILTER COMPONENT ───────────────────────────────────────────
function MultiSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (opt) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  const label = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} selected`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
        height: 34, borderRadius: 8, whiteSpace: "nowrap", minWidth: 160,
        border: `1px solid ${open || value.length > 0 ? C.coral : C.border}`,
        background: C.white, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
        color: value.length > 0 ? C.textPri : C.textTer,
        boxShadow: open ? `0 0 0 3px rgba(63,63,63,0.08)` : "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
      }}>
        <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
        {value.length > 0 && (
          <span onClick={e => { e.stopPropagation(); onChange([]); }}
            style={{ fontSize: 10, color: C.textTer, padding: "1px 4px", borderRadius: 4, background: C.offWhite, lineHeight: 1.4 }}>✕</span>
        )}
        <span style={{ fontSize: 8, color: C.textTer }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300,
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)", minWidth: "100%", maxHeight: 220,
          overflowY: "auto", padding: "4px 0",
        }}>
          {options.length === 0
            ? <div style={{ padding: "10px 14px", fontSize: 12, color: C.textTer }}>No options</div>
            : options.map(opt => (
              <label key={opt} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
                cursor: "pointer", fontSize: 12, color: C.textPri,
                background: value.includes(opt) ? C.offWhite : "transparent",
              }}>
                <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)}
                  style={{ accentColor: C.coral, width: 13, height: 13, cursor: "pointer", flexShrink: 0 }} />
                {opt}
              </label>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
function DashboardPage({ setPage, setSelectedPRId, profile }) {
  const [prList, setPrList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buFilter, setBuFilter] = useState([]);
  const [projectFilter, setProjectFilter] = useState([]);
  const [activeCard, setActiveCard] = useState(null);

  const pos         = profile?.position;
  const isAdmin     = profile?.is_admin === true;
  const isCreator   = can(profile, "pr.prepare");
  const isReviewer  = can(profile, "pr.review");
  const isManager   = pos === "Manager";

  useEffect(() => { fetchPRs(); }, [profile]);

  // When BU filter changes, drop any project selections that no longer belong to it
  useEffect(() => {
    if (projectFilter.length > 0) {
      const valid = new Set(prList.filter(p => buFilter.length === 0 || buFilter.includes(p.projects?.business_unit)).map(p => p.projects?.name).filter(Boolean));
      const still = projectFilter.filter(p => valid.has(p));
      if (still.length !== projectFilter.length) setProjectFilter(still);
    }
  }, [buFilter]);

  const fetchPRs = async () => {
    if (!profile) return;
    setLoading(true);
    let query = supabase
      .from("purchase_requests")
      .select(`id, pr_number, description, status, is_rush, created_at, start_date, end_date, budget_status, group_manager_id, projects (name, business_unit), reviewer:profiles!purchase_requests_pr_reviewer_id_fkey (full_name)`)
      .order("created_at", { ascending: false });

    // Filter by position
    if (pos === "Supervisor") {
      query = query.eq("prepared_by", profile.id);
    } else if (isManager) {
      query = query.eq("group_manager_id", profile.id);
    }
    // Commercial Officer, Commercial Manager, D&C Head, Admin see all

    // Commercial Officer / Commercial Manager / D&C Head don't see Drafts or Pending Manager Approval
    if (can(profile, "pr.review")) {
      query = query.not("status", "in", '("Draft","Pending Manager Approval","Pending GM Approval")');
    }
    const { data, error } = await query;
    if (error) console.error(error.message);
    else setPrList(data || []);
    setLoading(false);
  };

  const openPR = (pr) => { setSelectedPRId(pr.pr_number); setPage("detail"); };

  const cardStatusMap = {
    "Pending":   ["Draft", "Pending GM Approval"],
    "In Review": ["For Review", "Under Review", "Approved 1"],
    "Approved":  ["Approved"],
  };

  const buOptions = [...new Set(prList.map(p => p.projects?.business_unit).filter(Boolean))].sort();
  const projectOptions = [...new Set(
    prList.filter(p => buFilter.length === 0 || buFilter.includes(p.projects?.business_unit)).map(p => p.projects?.name).filter(Boolean)
  )].sort();

  const prBase = prList.filter(pr =>
    (buFilter.length === 0 || buFilter.includes(pr.projects?.business_unit)) &&
    (projectFilter.length === 0 || projectFilter.includes(pr.projects?.name))
  );

  const filtered = prBase.map(pr => ({ ...pr, reviewer_name: pr.reviewer?.full_name || "Unassigned" })).filter(pr => {
    const s = search.toLowerCase();
    const matchSearch =
      (pr.pr_number || "").toLowerCase().includes(s) ||
      (pr.description || "").toLowerCase().includes(s) ||
      (pr.projects?.name || "").toLowerCase().includes(s) ||
      (pr.reviewer?.full_name || "").toLowerCase().includes(s);
    const matchStatus = !activeCard || activeCard === "Total"
      ? true
      : (cardStatusMap[activeCard] || []).includes(pr.status);
    return matchSearch && matchStatus;
  });

  const grouped = filtered.reduce((acc, pr) => {
    const key = pr.reviewer_name || "Unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(pr);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort();

  return (
    <>
      <div style={styles.topBar}>
                <div style={{ flex: 1 }} />
        {isCreator && (
          <button style={styles.btnPrimary} onClick={() => setPage("create")}
            onMouseOver={e => e.currentTarget.style.opacity = "0.9"}
            onMouseOut={e => e.currentTarget.style.opacity = "1"}>
            + Create PR
          </button>
        )}
      </div>

      <div style={styles.pageBody}>
        <div style={{ maxWidth: "80%", margin: "0 auto" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
          {[
            { label: "Total",     value: prBase.length,                                                                              color: C.textPri,  desc: "All purchase requests"                    },
            { label: "Pending",   value: prBase.filter(p => ["Draft","Pending GM Approval"].includes(p.status)).length,            color: C.amberText,desc: "Drafts and awaiting manager sign-off"       },
            { label: "In Review", value: prBase.filter(p => ["For Review","Under Review","Approved 1"].includes(p.status)).length, color: C.tealText, desc: "Under commercial or technical review"        },
            { label: "Approved",  value: prBase.filter(p => p.status === "Approved").length,                                       color: C.greenText,desc: "Fully approved and ready to procure"        },
          ].map(s => {
            const isActive = activeCard === s.label;
            return (
              <div key={s.label}
                onClick={() => setActiveCard(prev => prev === s.label ? null : s.label)}
                style={{
                  background: isActive ? C.coralLight : C.white,
                  border: `1px solid ${isActive ? C.coral : C.border}`,
                  borderRadius: 12, padding: "14px 18px",
                  boxShadow: isActive ? `0 0 0 2px ${C.coralMid}` : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
                  cursor: "pointer", userSelect: "none",
                  transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
                }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.coralDark : C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Search and filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={13} color={C.textTer} /></div>
            <input placeholder="Search by PR number, description, or project…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 30, fontSize: 12 }} />
          </div>
          <MultiSelect options={buOptions} value={buFilter} onChange={setBuFilter} placeholder="All Business Units" />
          <MultiSelect options={projectOptions} value={projectFilter} onChange={setProjectFilter} placeholder="All Projects" />
        </div>

        {can(profile, "pr.review") && !isAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textSec, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "7px 14px", marginBottom: 12 }}>
            <span style={{ color: "#3B82F6", fontSize: 13 }}>ℹ</span>
            Showing PRs at your review stage. Drafts and items pending manager approval are visible only to the owner and their manager.
          </div>
        )}

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)", overflow: "clip" }}>

          <div>
  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
              <thead>
  <tr style={{ background: C.coralMid }}>
    {["PR Number","Description","Project","Reviewer","Start Date","Status",""].map(h => (
      <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.coralDark, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.coralLight}`, whiteSpace: "nowrap" }}>{h}</th>
    ))}
  </tr>
</thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: C.textTer }}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 0", color: C.textTer }}>
                      No purchase requests found.{isCreator && <> <span style={{ color: C.coral, cursor: "pointer" }} onClick={() => setPage("create")}>Create one</span></>}
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((pr, i) => (
                  <tr key={pr.pr_number} onClick={() => openPR(pr)}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                    onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "9px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ color: C.coral, fontWeight: 600, fontSize: 12 }}>{pr.pr_number || "—"}</span>
                    </td>
                    <td style={{ padding: "9px 14px", maxWidth: 260 }}>
                      <div style={{ fontSize: 12, color: C.textPri, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.description}</div>
                      {pr.is_rush && <span style={{ ...styles.badge("Rush"), fontSize: 10, marginTop: 2 }}>Rush</span>}
                    </td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: C.textSec, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.projects?.name || "—"}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: pr.reviewer_name && pr.reviewer_name !== "Unassigned" ? C.textSec : C.textTer, fontStyle: pr.reviewer_name && pr.reviewer_name !== "Unassigned" ? "normal" : "italic", whiteSpace: "nowrap" }}>{pr.reviewer_name || "Unassigned"}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: C.textSec, whiteSpace: "nowrap" }}>{fmtShort(pr.start_date)}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                        <span style={styles.badge(pr.status)}>{pr.status}</span>
                        {pr.budget_status && <span style={{ ...styles.badge(pr.budget_status), fontSize: 10 }}>{pr.budget_status}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}><Icon name="chevronRight" size={13} color={C.textTer} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textTer }}>Showing {filtered.length} of {prList.length} records</span>
            <button onClick={fetchPRs} style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }}>Refresh</button>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}

// ─── SCOPE OF WORKS WORK TYPES ────────────────────────────────────────────────
const SCOPE_WORK_TYPES = [
  { name: "General Requirements", groups: [
    { group: "Site Management", items: ["Full-Time Safety Officer","Part-Time Safety Officer","Temporary Site Office","Temporary Bodega / Warehouse","Temporary Comfort Rooms / Sanitation Facilities","Temporary Power (Generator / Metered Connection)","Temporary Water Supply","Construction Signage and Barricades","Mobilization / Demobilization","Waste Management and Disposal","Security Personnel"] },
    { group: "Insurance & Permits", items: ["Construction Insurance (CARI)","Third-Party Liability Insurance (TPL)","Workers' Compensation / ECC Coverage","Permits and Licenses"] },
    { group: "Submittals & Documentation", items: ["Shop Drawing Preparation and Submission","Material Submittal Preparation","Method Statement Preparation","As-Built Drawing Preparation","O&M Manuals Preparation","Warranties and Guarantees Documentation"] },
  ]},
  { name: "Civil / Site Development", groups: [
    { group: null, items: ["Site Clearing and Grubbing","Demolition Works","Earthworks — Cut and Fill","Soil Compaction","Dewatering","Retaining Walls","Road and Pavement Works","Curbs and Gutters","Drainage System (Catch Basins, Culverts)","Stormwater Management","Perimeter Fence / Hoarding"] },
  ]},
  { name: "Structural Works", groups: [
    { group: null, items: ["Pile Works (Driven / Bored)","Pile Cap and Tie Beams","Footing / Foundation Works","Concrete Works — Columns","Concrete Works — Beams","Concrete Works — Slabs","Concrete Works — Walls / Shear Walls","Structural Steel Works","Rebar / Reinforcement Works","Formwork and Scaffolding","Post-Tensioning Works","Below-Grade Waterproofing","Slab Waterproofing"] },
  ]},
  { name: "Architectural Works", groups: [
    { group: null, items: ["Masonry / Blockwork","Plastering and Skimming","Ceiling Works (Framing and Board)","Flooring — Tiles","Flooring — Hardwood / Engineered Wood","Flooring — Polished Concrete","Wall Tiling (Wet Areas)","Painting — Interior","Painting — Exterior","Doors — Hollow Core","Doors — Solid Core / Fire-Rated","Windows — Aluminum Framed","Window Grilles / Security Screens","Kitchen Cabinets and Countertops","Bathroom Fixtures and Accessories","Built-in Wardrobes / Cabinets","Staircase and Railings","Wet Area Waterproofing","Roof Works — Waterproofing Membrane","Roof Works — Roofing Sheet / Tiles","Roof Gutters and Downspouts","Expansion Joints"] },
  ]},
  { name: "Mechanical Works", groups: [
    { group: null, items: ["Water Supply System (Pipes and Fittings)","Sanitary / Drainage System","Sewer Line Works","Septic Tank / STP (Sewage Treatment Plant)","Grease Trap","Fire Standpipe System","Fire Sprinkler System","Fire Suppression System (Special Hazard)","HVAC — Split Type Units","HVAC — Central / Chilled Water System","Exhaust and Ventilation System","Sanitary Fixtures and Equipment","Water Tanks (Overhead / Underground)","Booster Pump System","Sump Pump System"] },
  ]},
  { name: "Electrical Works", groups: [
    { group: null, items: ["Main Distribution Panel / MDP","Sub-Distribution Panels","Branch Circuit Wiring","Conduit and Roughing-In Works","Lighting Fixtures — Indoor","Lighting Fixtures — Outdoor / Façade","Power Outlets and Convenience Outlets","Grounding and Bonding System","Lightning Protection System","Generator Set","Automatic Transfer Switch (ATS)","UPS System","Fire Alarm System (Detection and Annunciation)","CCTV System","Access Control System","Public Address / Intercom System","Structured Cabling / Data Network","Solar PV System"] },
  ]},
  { name: "Façade Works", groups: [
    { group: null, items: ["Curtain Wall System","Glass and Aluminum Works","External Cladding (ACP / Stone / Composite)","Sealants and Expansion Joints","External Wall Insulation","Balcony Railings and Balustrades","Signage and Building Identification"] },
  ]},
  { name: "Vertical Transportation", groups: [
    { group: null, items: ["Passenger Elevators","Service / Cargo Elevator","Escalators","Elevator Lobby Finishing Works"] },
  ]},
  { name: "Landscaping", groups: [
    { group: null, items: ["Softscape — Planting and Turf","Hardscape — Pavers and Walkways","Hardscape — Retaining / Landscape Walls","Irrigation System","Landscape Lighting","Water Features (Fountain / Reflecting Pool)","Playground Equipment","Outdoor Furniture and Amenities","Swimming Pool and Pool Equipment","Amenity Area Finishing Works"] },
  ]},
  { name: "Testing & Commissioning", groups: [
    { group: null, items: ["Soil Investigation / Geotechnical Boring","Soil Compaction Testing","Concrete Cylinder / Compression Test","Rebar / Steel Material Testing","Pile Load Testing (Static / Dynamic)","Waterproofing Flood Test","Water Pressure Testing (Plumbing)","Drain / Sewage Line Testing","Fire Alarm System Testing and Commissioning","Fire Suppression System Testing","Sprinkler Hydraulic Test","Electrical Load Testing","Generator Load Bank Testing","HVAC Air Balancing and Commissioning","Elevator Load and Safety Testing","BMS Integration Testing","Third-Party / Independent Inspection"] },
  ]},
  { name: "Design & Consultancy", groups: [
    { group: "Architectural Design", items: ["Concept Design / Concept Development","Schematic Design (SD)","Design Development (DD)","Contract Documents / Working Drawings","Interior Design","Landscape Architecture","As-Built Drawings","Façade / Curtain Wall Design"] },
    { group: "Structural Engineering", items: ["Structural Analysis and Design","Geotechnical / Soil Investigation","Foundation Design","Post-Tensioning Design","Independent Structural Peer Review"] },
    { group: "Civil / Site Development Design", items: ["Site Development Plan","Road and Drainage Design","Topographic Survey","Traffic Impact Assessment (TIA)","Environmental Impact Assessment (EIA)"] },
    { group: "MEP Design", items: ["Mechanical / HVAC Design","Electrical Design","Plumbing and Sanitary Design","Fire Protection Design","Vertical Transportation / Elevator Design","Acoustic Design","BMS / Smart Building System Design"] },
    { group: "Permits & Government Liaison", items: ["Building Permit Facilitation","LGU / DPWH / DHSUD Liaison","Fire Safety Inspection Certificate (FSIC)","LLDA / Environmental Permit","Condominium Certificate of Registration (CCR)"] },
    { group: "Construction Phase / Site Visits", items: ["Architect's Site Visit (Periodic)","Structural Engineer's Site Visit (Periodic)","Mechanical Engineer's Site Visit (Periodic)","Electrical Engineer's Site Visit (Periodic)","Plumbing / Sanitary Engineer's Site Visit (Periodic)","Fire Protection Engineer's Site Visit (Periodic)","Geotechnical Engineer's Site Visit (Periodic)","Interior Designer's Site Visit (Periodic)","Landscape Architect's Site Visit (Periodic)","Façade Consultant's Site Visit (Periodic)","Elevator / Vertical Transport Consultant's Site Visit (Periodic)","Acoustic Consultant's Site Visit (Periodic)"] },
    { group: "Shop Drawing & Submittal Review", items: ["Architectural Shop Drawing Review","Structural Shop Drawing Review","Mechanical / HVAC Shop Drawing Review","Electrical Shop Drawing Review","Plumbing / Sanitary Shop Drawing Review","Fire Protection Shop Drawing Review","Façade / Curtain Wall Shop Drawing Review","Elevator / Vertical Transport Shop Drawing Review","Material Submittal Review","Mock-Up Review and Approval","Method Statement Review"] },
    { group: "Construction Management", items: ["Full-Time Construction Supervision","Regular Site Visits / Progress Inspections","Full-Time Construction Management","Quantity Surveying / Cost Estimating","Requests for Information (RFI) Response","Site Instruction Issuance","Design Clarification and Variation Support","Punch List / Defects Inspection","Certificate of Completion Sign-Off"] },
    { group: "Deliverables", items: ["Bill of Quantities (BOQ)","Technical Specifications","BIM Modeling","Progress / Completion Reports","Final Inspection Report"] },
  ]},
];

// ─── CREATE PR PAGE ────────────────────────────────────────────────────────────
function CreatePRPage({ setPage, profile }) {
  const [projects, setProjects] = useState([]);
  const [groupManagers, setGroupManagers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedGMId, setSelectedGMId] = useState("");
  const isReviewerCreating = can(profile, "pr.review");
  const [isRush, setIsRush] = useState(false);
  const [scopeWorkTypes, setScopeWorkTypes] = useState([]);
  const [showWTDropdown, setShowWTDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState("");
  const [budgetCodeId, setBudgetCodeId] = useState("");
  const [budgetCodes, setBudgetCodes] = useState([]);
  const [formData, setFormData] = useState({ description: "", justification: "", rushJustification: "", startDate: "", endDate: "" });
  const [minDaysStandard, setMinDaysStandard] = useState(45);
  const [minDaysRush, setMinDaysRush] = useState(30);
  const [plansFile, setPlansFile] = useState(null);
  const [torFile, setTorFile] = useState(null);
  const [specsFile, setSpecsFile] = useState(null);
  const [docModes, setDocModes] = useState({ plans: "file", tor: "file", specs: "file" });
  const [docLinks, setDocLinks] = useState({ plans: "", tor: "", specs: "" });
  const [remarks, setRemarks] = useState("");
  const [maxFileMB, setMaxFileMB] = useState(10);

  useEffect(() => { fetchProjects(); fetchGroupManagers(); fetchLeadTimes(); }, []);
  useEffect(() => {
    if (!selectedProjectId || !isReviewerCreating) { setBudgetCodes([]); setBudgetCodeId(""); return; }
    supabase.from("budget_codes").select("id, code, type, description")
      .eq("project_id", parseInt(selectedProjectId)).eq("is_active", true)
      .order("type").order("code")
      .then(({ data }) => setBudgetCodes(data || []));
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name, business_unit, project_code, short_name").eq("status", "active").order("name");
    if (data) setProjects(data);
  };

  const fetchGroupManagers = async () => {
    const { data } = await supabase
      .from("group_managers")
      .select("id, profile_id, profiles (id, full_name)")
      .order("id");
    if (data) setGroupManagers(data);
  };

  const fetchLeadTimes = async () => {
    const { data } = await supabase.from("settings").select("key, value").in("key", ["lead_time_standard", "lead_time_rush"]);
    if (data) {
      const std = data.find(s => s.key === "lead_time_standard");
      const rush = data.find(s => s.key === "lead_time_rush");
      if (std) setMinDaysStandard(parseInt(std.value) || 45);
      if (rush) setMinDaysRush(parseInt(rush.value) || 30);
    }
  };

  const selectedProject = projects.find(p => p.id === parseInt(selectedProjectId));
  const MIN_DAYS = isRush ? minDaysRush : minDaysStandard;
  const minDateObj = new Date();
  minDateObj.setDate(minDateObj.getDate() + MIN_DAYS);
  const minDate = minDateObj.toISOString().split("T")[0];

  const scopeGenId = () => Math.random().toString(36).slice(2, 9);
  const addWorkType = (name) => {
    const def = SCOPE_WORK_TYPES.find(wt => wt.name === name);
    if (!def) return;
    const items = def.groups.flatMap(g => g.items.map(label => ({ id: scopeGenId(), label, status: null, remarks: "", isCustom: false, group: g.group || null })));
    setScopeWorkTypes(prev => [...prev, { workType: name, items }]);
    setShowWTDropdown(false);
  };
  const removeWorkType = (name) => setScopeWorkTypes(prev => prev.filter(wt => wt.workType !== name));
  const setScopeItemStatus = (wtName, itemId, status) => setScopeWorkTypes(prev => prev.map(wt => wt.workType !== wtName ? wt : { ...wt, items: wt.items.map(i => i.id !== itemId ? i : { ...i, status, remarks: status === "required" ? "" : i.remarks }) }));
  const setScopeItemRemarks = (wtName, itemId, remarks) => setScopeWorkTypes(prev => prev.map(wt => wt.workType !== wtName ? wt : { ...wt, items: wt.items.map(i => i.id !== itemId ? i : { ...i, remarks }) }));
  const addCustomScopeItem = (wtName) => setScopeWorkTypes(prev => prev.map(wt => wt.workType !== wtName ? wt : { ...wt, items: [...wt.items, { id: scopeGenId(), label: "", status: null, remarks: "", isCustom: true, group: null }] }));
  const removeCustomScopeItem = (wtName, itemId) => setScopeWorkTypes(prev => prev.map(wt => wt.workType !== wtName ? wt : { ...wt, items: wt.items.filter(i => i.id !== itemId) }));
  const updateCustomScopeLabel = (wtName, itemId, label) => setScopeWorkTypes(prev => prev.map(wt => wt.workType !== wtName ? wt : { ...wt, items: wt.items.map(i => i.id !== itemId ? i : { ...i, label }) }));

  const fetchPRNumber = async () => {
    const year = new Date().getFullYear();
    const { count } = await supabase.from("purchase_requests").select("*", { count: "exact", head: true });
    return generatePRNumber((count || 0) + 1, year);
  };

  const savePR = async (sendToGM = false) => {
    if (!selectedProjectId) { alert("Please select a project."); return; }
    if (!formData.description) { alert("Please enter a description."); return; }
    if (!formData.startDate) { alert("Please select a start date."); return; }
    if (!formData.endDate) { alert("Please select an end date."); return; }
    if (scopeWorkTypes.length === 0) { alert("Please add at least one work type in the Scope of Works."); return; }
    const unansweredScope = scopeWorkTypes.flatMap(wt => wt.items.filter(i => i.isCustom ? (i.label.trim() && !i.status) : !i.status));
    if (unansweredScope.length > 0) { alert(`Please mark all scope items as Required or Not Required.\n${unansweredScope.length} item(s) still unanswered.`); return; }
    const missingRemarksScope = scopeWorkTypes.flatMap(wt => wt.items.filter(i => i.status === "not_required" && !i.remarks.trim()));
    if (missingRemarksScope.length > 0) { alert(`Please provide remarks for all "Not Required" items.\n${missingRemarksScope.length} item(s) missing remarks.`); return; }
    if (!isReviewerCreating && sendToGM && !selectedGMId) { alert("Please select a Manager to send to."); return; }
    if (isReviewerCreating) {
      if (!budgetStatus) { alert("Please tag this PR as Budgeted or Unbudgeted before submitting."); return; }
      if (budgetStatus === "Budgeted" && !budgetCodeId) { alert("Please select a budget code."); return; }
    }

    // Required documents — only enforced on actual submission (not draft save)
    const isSubmitting = sendToGM || isReviewerCreating;
    if (isSubmitting) {
      const missing = [];
      if (docModes.plans === "file"  && !plansFile)            missing.push("Plans (upload a file)");
      if (docModes.plans === "link"  && !docLinks.plans.trim()) missing.push("Plans (provide a link)");
      if (docModes.tor   === "file"  && !torFile)              missing.push("Terms of Reference (upload a file)");
      if (docModes.tor   === "link"  && !docLinks.tor.trim())  missing.push("Terms of Reference (provide a link)");
      if (docModes.specs === "file"  && !specsFile)            missing.push("Specifications (upload a file)");
      if (docModes.specs === "link"  && !docLinks.specs.trim()) missing.push("Specifications (provide a link)");
      if (missing.length > 0) {
        alert("Please provide all required documents before submitting:\n• " + missing.join("\n• "));
        return;
      }
    }

    setSaving(true);
    const prNumber = await fetchPRNumber();
    const gmProfile = groupManagers.find(gm => gm.id === parseInt(selectedGMId));
    // Determine initial status based on who is creating
    const isAutoApprover = can(profile, "pr.approve_budgeted"); // CM or D&C Head
    const isFinalApprover = can(profile, "pr.approve_unbudgeted"); // D&C Head only
    const autoStatus = !isReviewerCreating
      ? (sendToGM ? "Pending Manager Approval" : "Draft")
      : isAutoApprover && budgetStatus === "Budgeted" ? "Approved"
      : isFinalApprover && budgetStatus === "Unbudgeted" ? "Approved"
      : isAutoApprover && budgetStatus === "Unbudgeted" ? "Pending Endorsement"
      : "Under Review";
    const { data: pr, error } = await supabase
      .from("purchase_requests")
      .insert({
        pr_number: prNumber,
        project_id: parseInt(selectedProjectId),
        prepared_by: profile.id,
        group_manager_id: gmProfile?.profiles?.id || null,
        description: formData.description,
        justification: formData.justification,
        is_rush: isRush,
        rush_justification: isRush ? formData.rushJustification : null,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        status: autoStatus,
        current_step: autoStatus,
        pr_reviewer_id: isReviewerCreating ? profile.id : null,
        remarks: remarks.trim() || null,
        scope_of_works: scopeWorkTypes.length > 0 ? scopeWorkTypes : null,
      })
      .select().single();

    if (error) { alert("Error saving PR: " + error.message); setSaving(false); return; }

    // Derive scope_items from Required checklist items (for RFA proposal pre-population)
    const requiredScopeItems = scopeWorkTypes.flatMap(wt => wt.items.filter(i => i.status === "required" && i.label.trim()));
    if (requiredScopeItems.length > 0) {
      await supabase.from("scope_items").insert(
        requiredScopeItems.map((item, idx) => ({ pr_id: pr.pr_number, description: item.label, quantity: null, unit_of_measure: "lot", sort_order: idx }))
      );
    }

    // Upload required documents (or use provided links)
    const uploadDoc = async (file, folder, mode, linkUrl) => {
      if (mode === "link") return { url: linkUrl.trim(), name: linkUrl.trim() };
      if (!file) return { url: null, name: null };
      const ext = file.name.split(".").pop();
      const path = `pr-docs/${pr.pr_number}/${folder}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pr-documents").upload(path, file);
      if (upErr) {
        alert(`Failed to upload ${folder}: ${upErr.message}`);
        setSaving(false);
        return { url: null, name: file.name };
      }
      const { data: urlData } = supabase.storage.from("pr-documents").getPublicUrl(path);
      return { url: urlData.publicUrl, name: file.name };
    };

    const plansRes = await uploadDoc(plansFile, "plans", docModes.plans, docLinks.plans);
    const torRes   = await uploadDoc(torFile,   "tor",   docModes.tor,   docLinks.tor);
    const specsRes = await uploadDoc(specsFile,  "specs", docModes.specs, docLinks.specs);

    const { error: docUpdateErr } = await supabase.from("purchase_requests").update({
      plans_file_url: plansRes.url,  plans_file_name: plansRes.name,
      tor_file_url:   torRes.url,    tor_file_name:   torRes.name,
      specs_file_url: specsRes.url,  specs_file_name: specsRes.name,
    }).eq("pr_number", pr.pr_number);

    if (docUpdateErr) {
      alert("Documents uploaded but failed to save references: " + docUpdateErr.message);
    }

    // Apply budget review + auto-approval fields for CO/CM/D&C Head creating their own PRs
    if (isReviewerCreating) {
      const now = new Date().toISOString();
      const selectedCode = budgetCodes.find(c => c.id === parseInt(budgetCodeId));
      let finalBudgetCode = budgetStatus === "Budgeted" ? (selectedCode?.code || null) : null;

      if (budgetStatus === "Unbudgeted") {
        const proj = projects.find(p => p.id === parseInt(selectedProjectId));
        const projectCode = proj?.short_name || proj?.project_code || "PRJ";
        const year = new Date().getFullYear();
        const { data: existing } = await supabase.from("budget_codes").select("counter")
          .eq("project_id", parseInt(selectedProjectId)).eq("type", "UB").eq("year", year)
          .order("counter", { ascending: false }).limit(1);
        const nextCounter = existing?.length > 0 ? existing[0].counter + 1 : 1;
        finalBudgetCode = `${projectCode}-UB-${year}-${String(nextCounter).padStart(3, "0")}`;
        await supabase.from("budget_codes").insert({
          project_id: parseInt(selectedProjectId), code: finalBudgetCode, type: "UB",
          year, counter: nextCounter, description: `Auto-generated for PR ${prNumber}`, is_active: true,
        });
      }

      let budgetUpdate = {
        reviewer_budget_status: budgetStatus,
        reviewer_budget_code: finalBudgetCode,
        reviewed_at: now,
      };
      if (isAutoApprover && budgetStatus === "Budgeted") {
        budgetUpdate = { ...budgetUpdate, status: "Approved", current_step: "Approved",
          budget_status: budgetStatus, budget_code: finalBudgetCode,
          approved1_by: profile.id, approved1_at: now };
      } else if (isFinalApprover && budgetStatus === "Unbudgeted") {
        budgetUpdate = { ...budgetUpdate, status: "Approved", current_step: "Approved",
          budget_status: "Unbudgeted", budget_code: finalBudgetCode,
          approved1_by: profile.id, approved1_at: now, approved2_by: profile.id, approved2_at: now };
      } else if (isAutoApprover && budgetStatus === "Unbudgeted") {
        budgetUpdate = { ...budgetUpdate, status: "Pending Endorsement", current_step: "Pending Endorsement",
          budget_status: "Unbudgeted", budget_code: finalBudgetCode,
          approved1_by: profile.id, approved1_at: now };
      }
      await supabase.from("purchase_requests").update(budgetUpdate).eq("pr_number", pr.pr_number);
    }

    setSaving(false);
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setPage("dashboard"); }, 1800);
  };

  if (submitted) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 56, height: 56, background: C.greenBg, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.greenText} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textPri, marginBottom: 4 }}>PR saved successfully</div>
        <div style={{ fontSize: 13, color: C.textSec }}>Redirecting to dashboard…</div>
      </div>
    </div>
  );

  return (
    <>
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <button onClick={() => setPage("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSec, padding: 0, fontFamily: "inherit", fontSize: 13 }}>
              Purchase Requests
            </button>
            <Icon name="chevronRight" size={12} color={C.textTer} />
            <span style={{ color: C.textPri, fontWeight: 500 }}>New Purchase Request</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!isReviewerCreating && (
            <button style={styles.btnSecondary} onClick={() => savePR(false)} disabled={saving}>{saving ? "Saving…" : "Save draft"}</button>
          )}
          {isReviewerCreating ? (
            <button style={styles.btnPrimary} onClick={() => savePR(false)} disabled={saving}
              onMouseOver={e => e.currentTarget.style.opacity = "0.9"}
              onMouseOut={e => e.currentTarget.style.opacity = "1"}>
              {saving ? "Submitting…" : "Submit for review"}
            </button>
          ) : (
            <button style={styles.btnAmber} onClick={() => savePR(true)} disabled={saving}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="send" size={13} color={C.amberText} />
                Send to Manager
              </span>
            </button>
          )}
        </div>
      </div>

      <div style={{ ...styles.pageBody, maxWidth: 900 }}>
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: C.textPri, letterSpacing: "-0.02em" }}>Create purchase request</h2>
          <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>Save as draft or send directly to your Manager for submission.</p>
        </div>

        {/* Section 1 — Project & GM */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={styles.cardTitle}>Project details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={styles.label}>Project <span style={styles.required}>*</span></label>
              <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} style={styles.input}>
                <option value="">Select a project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <p style={styles.hint}>Only active projects are shown</p>
            </div>
            <div>
              <label style={styles.label}>Business unit</label>
              <input value={selectedProject?.business_unit || ""} disabled style={{ ...styles.input, ...styles.inputDisabled }} placeholder="Auto-filled from project" />
              <p style={styles.hint}>Automatically populated from selected project</p>
            </div>
          </div>
          {!isReviewerCreating && (
            <div>
              <label style={styles.label}>Manager <span style={styles.required}>*</span></label>
              <select value={selectedGMId} onChange={e => setSelectedGMId(e.target.value)} style={styles.input}>
                <option value="">Select a Manager…</option>
                {groupManagers.map(gm => (
                  <option key={gm.id} value={gm.id}>{gm.profiles?.full_name}</option>
                ))}
              </select>
              <p style={styles.hint}>The Manager will review and officially submit this PR for review</p>
            </div>
          )}
        </div>

        {/* Section 2 — Work Request */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={styles.cardTitle}>Work request details</h3>
          <div style={{ marginBottom: 14 }}>
            <label style={styles.label}>Description <span style={styles.required}>*</span></label>
            <textarea rows={2} placeholder="Briefly describe the work being requested…" value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              style={{ ...styles.input, resize: "vertical", lineHeight: 1.5 }} />
          </div>
          <div>
            <label style={styles.label}>Justification <span style={styles.required}>*</span></label>
            <textarea rows={2} placeholder="Explain why this purchase is necessary…" value={formData.justification}
              onChange={e => setFormData(p => ({ ...p, justification: e.target.value }))}
              style={{ ...styles.input, resize: "vertical", lineHeight: 1.5 }} />
          </div>
          <div>
            <label style={styles.label}>Remarks</label>
            <textarea rows={2} placeholder="Any additional notes or remarks…" value={remarks}
              onChange={e => setRemarks(e.target.value)}
              style={{ ...styles.input, resize: "vertical", lineHeight: 1.5 }} />
          </div>
        </div>

        {/* Section 3 — Work Schedule */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={styles.cardTitle}>Work Schedule</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>Requested date range <span style={styles.required}>*</span></label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <DatePicker
                selected={formData.startDate ? new Date(formData.startDate) : null}
                onChange={date => setFormData(p => ({ ...p, startDate: date ? date.toISOString().split("T")[0] : "" }))}
                minDate={new Date(minDate)} placeholderText="Select start date *" dateFormat="MMM d, yyyy"
                wrapperClassName="date-picker-wrapper"
                customInput={<input style={{ ...styles.input, cursor: "pointer" }} />} />
              <span style={{ color: C.textTer, fontSize: 13, flexShrink: 0 }}>to</span>
              <DatePicker
                selected={formData.endDate ? new Date(formData.endDate) : null}
                onChange={date => setFormData(p => ({ ...p, endDate: date ? date.toISOString().split("T")[0] : "" }))}
                minDate={formData.startDate ? new Date(formData.startDate) : new Date(minDate)}
                placeholderText="Select end date *" dateFormat="MMM d, yyyy"
                wrapperClassName="date-picker-wrapper"
                customInput={<input style={{ ...styles.input, cursor: "pointer" }} />} />
            </div>
            <p style={styles.hint}>Minimum <strong>{MIN_DAYS}-day lead time</strong> from today ({minDate}).{isRush ? " Rush rate applied." : ""}</p>
          </div>

          {/* Rush request — below dates */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isRush ? 12 : 0 }}>
              <input type="checkbox" id="rush-flag" checked={isRush} onChange={e => setIsRush(e.target.checked)}
                style={{ cursor: "pointer", accentColor: C.amberText, width: 14, height: 14 }} />
              <label htmlFor="rush-flag" style={{ fontSize: 12, fontWeight: 500, color: C.textSec, cursor: "pointer", userSelect: "none" }}>
                Flag as rush request
              </label>
              {isRush && (
                <span style={{ fontSize: 11, fontWeight: 500, color: C.amberText, background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 4, padding: "1px 7px" }}>
                  Rush
                </span>
              )}
            </div>
            {isRush && (
              <>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: C.amberText, lineHeight: 1.5 }}>
                  This request is flagged as rush. The requestor acknowledges that their <strong>PMS will be affected</strong>. Lead time reduced to <strong>{minDaysRush} days</strong>.
                </p>
                <label style={styles.label}>Reason for late request <span style={styles.required}>*</span></label>
                <textarea rows={2} placeholder="Explain why this was not prepared ahead of time and describe the specific impact on your PMS…"
                  value={formData.rushJustification} onChange={e => setFormData(p => ({ ...p, rushJustification: e.target.value }))}
                  style={{ ...styles.input, resize: "vertical", lineHeight: 1.5 }} />
              </>
            )}
          </div>
        </div>

        {/* Section 4 — Scope of Works */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textPri }}>Scope of Works <span style={styles.required}>*</span></h3>
              <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>Select work types and mark each item as Required or Not Required.</div>
            </div>
            <div style={{ position: "relative" }}>
              <button style={styles.btnSecondary} onClick={() => setShowWTDropdown(p => !p)}>+ Add Work Type</button>
              {showWTDropdown && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 220, padding: "6px 0" }}>
                  {SCOPE_WORK_TYPES.filter(wt => !scopeWorkTypes.find(s => s.workType === wt.name)).map(wt => (
                    <button key={wt.name} onClick={() => addWorkType(wt.name)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: C.textPri }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "none"}>
                      {wt.name}
                    </button>
                  ))}
                  {SCOPE_WORK_TYPES.every(wt => scopeWorkTypes.find(s => s.workType === wt.name)) && (
                    <div style={{ padding: "8px 16px", fontSize: 12, color: C.textTer }}>All work types added</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {scopeWorkTypes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.textTer }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 13 }}>No work types added yet. Click <strong>+ Add Work Type</strong> to begin.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {scopeWorkTypes.map(wt => {
                const def = SCOPE_WORK_TYPES.find(d => d.name === wt.workType);
                const totalItems = wt.items.filter(i => !i.isCustom || i.label.trim()).length;
                const answeredItems = wt.items.filter(i => (!i.isCustom || i.label.trim()) && i.status).length;
                const allAnswered = totalItems > 0 && answeredItems === totalItems;
                return (
                  <div key={wt.workType} style={{ border: `1px solid ${allAnswered ? C.greenText : C.border}`, borderRadius: 10, overflow: "hidden" }}>
                    {/* Work type header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: allAnswered ? C.greenBg : C.offWhite, borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: allAnswered ? C.greenText : C.textPri }}>{wt.workType}</span>
                        <span style={{ fontSize: 11, color: C.textTer }}>{answeredItems}/{totalItems} answered</span>
                      </div>
                      <button onClick={() => removeWorkType(wt.workType)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.textTer, padding: "2px 6px" }}
                        onMouseOver={e => e.currentTarget.style.color = C.redText} onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                        Remove
                      </button>
                    </div>

                    {/* Items */}
                    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
                      {(() => {
                        const groups = def?.groups || [];
                        const customItems = wt.items.filter(i => i.isCustom);
                        return (
                          <>
                            {groups.map(g => (
                              <div key={g.group || "default"}>
                                {g.group && (
                                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 0 6px", borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>{g.group}</div>
                                )}
                                {g.items.map(label => {
                                  const item = wt.items.find(i => i.label === label && !i.isCustom);
                                  if (!item) return null;
                                  const isNotReq = item.status === "not_required";
                                  const missingRemark = isNotReq && !item.remarks.trim();
                                  return (
                                    <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ flex: 1, fontSize: 12, color: C.textPri }}>{label}</span>
                                        <button onClick={() => setScopeItemStatus(wt.workType, item.id, "required")}
                                          style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${item.status === "required" ? C.greenText : C.border}`, background: item.status === "required" ? C.greenBg : "transparent", color: item.status === "required" ? C.greenText : C.textTer, cursor: "pointer" }}>
                                          Required
                                        </button>
                                        <button onClick={() => setScopeItemStatus(wt.workType, item.id, "not_required")}
                                          style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${isNotReq ? C.redText : C.border}`, background: isNotReq ? C.redBg : "transparent", color: isNotReq ? C.redText : C.textTer, cursor: "pointer" }}>
                                          Not Required
                                        </button>
                                      </div>
                                      {isNotReq && (
                                        <input value={item.remarks} onChange={e => setScopeItemRemarks(wt.workType, item.id, e.target.value)}
                                          placeholder="Specify: who will provide, or why not applicable *"
                                          style={{ ...styles.input, margin: 0, fontSize: 11, borderColor: missingRemark ? C.redText : C.border, marginLeft: 0 }} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                            {/* Custom items */}
                            {customItems.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 0 6px", borderBottom: `1px solid ${C.border}` }}>Custom Items</div>
                                {customItems.map(item => {
                                  const isNotReq = item.status === "not_required";
                                  return (
                                    <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <input value={item.label} onChange={e => updateCustomScopeLabel(wt.workType, item.id, e.target.value)}
                                          placeholder="Describe the work item…"
                                          style={{ ...styles.input, margin: 0, fontSize: 12, flex: 1 }} />
                                        <button onClick={() => setScopeItemStatus(wt.workType, item.id, "required")}
                                          style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${item.status === "required" ? C.greenText : C.border}`, background: item.status === "required" ? C.greenBg : "transparent", color: item.status === "required" ? C.greenText : C.textTer, cursor: "pointer", flexShrink: 0 }}>
                                          Required
                                        </button>
                                        <button onClick={() => setScopeItemStatus(wt.workType, item.id, "not_required")}
                                          style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${isNotReq ? C.redText : C.border}`, background: isNotReq ? C.redBg : "transparent", color: isNotReq ? C.redText : C.textTer, cursor: "pointer", flexShrink: 0 }}>
                                          Not Required
                                        </button>
                                        <button onClick={() => removeCustomScopeItem(wt.workType, item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, padding: 4, flexShrink: 0 }}
                                          onMouseOver={e => e.currentTarget.style.color = C.redText} onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                                          <Icon name="trash" size={13} />
                                        </button>
                                      </div>
                                      {isNotReq && (
                                        <input value={item.remarks} onChange={e => setScopeItemRemarks(wt.workType, item.id, e.target.value)}
                                          placeholder="Specify: who will provide, or why not applicable *"
                                          style={{ ...styles.input, margin: 0, fontSize: 11, borderColor: !item.remarks.trim() ? C.redText : C.border }} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <button onClick={() => addCustomScopeItem(wt.workType)}
                              style={{ ...styles.btnGhost, marginTop: 10, fontSize: 11, alignSelf: "flex-start" }}>
                              + Add custom item
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 4b — Budget Review (CO/CM/D&C Head creating their own PR) */}
        {isReviewerCreating && (
          <div style={{ ...styles.card, marginBottom: 16, borderColor: budgetStatus ? C.border : "#FCD34D" }}>
            <h3 style={{ ...styles.cardTitle, borderBottomColor: C.coral, color: C.coral }}>Budget Assessment <span style={styles.required}>*</span></h3>
            <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 14px" }}>As the reviewer, tag this PR's budget status before submitting.</p>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              {["Budgeted", "Unbudgeted"].map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px",
                  borderRadius: 8, border: `1px solid ${budgetStatus === opt ? (opt === "Budgeted" ? "#86EFAC" : "#FCA5A5") : C.border}`,
                  background: budgetStatus === opt ? (opt === "Budgeted" ? C.greenBg : C.redBg) : C.white, flex: 1 }}>
                  <input type="radio" name="budgetStatus" value={opt} checked={budgetStatus === opt}
                    onChange={() => { setBudgetStatus(opt); setBudgetCodeId(""); }} style={{ accentColor: C.coral }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: budgetStatus === opt ? (opt === "Budgeted" ? C.greenText : C.redText) : C.textPri }}>{opt}</span>
                </label>
              ))}
            </div>
            {budgetStatus === "Budgeted" && (
              <div>
                <label style={styles.label}>Budget Code <span style={styles.required}>*</span></label>
                <select value={budgetCodeId} onChange={e => setBudgetCodeId(e.target.value)} style={styles.input}>
                  <option value="">Select budget code…</option>
                  {budgetCodes.length === 0 ? (
                    <option disabled>No active budget codes for this project</option>
                  ) : budgetCodes.map(c => (
                    <option key={c.id} value={c.id}>{c.code}{c.description ? ` — ${c.description}` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            {budgetStatus === "Unbudgeted" && (
              <div style={{ fontSize: 12, color: C.amberText, background: C.amberBg, borderRadius: 6, padding: "8px 12px" }}>
                A UB budget code will be auto-generated when this PR is submitted.
              </div>
            )}
          </div>
        )}

        {/* Section 5 — Documents */}
        <div style={{ ...styles.card, marginBottom: 32 }}>
          <h3 style={styles.cardTitle}>Required documents</h3>
          <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>
            All three documents are required before submission. Max file size per document: <strong>{maxFileMB} MB</strong>. If a file exceeds the limit, you will be prompted to provide a link.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { key: "plans", label: "Plans",              hint: "PDF, DWG, PNG", accept: ".pdf,.dwg,.png,.jpg,.jpeg", file: plansFile, setFile: setPlansFile },
              { key: "tor",   label: "Terms of Reference", hint: "PDF, DOCX",     accept: ".pdf,.doc,.docx",           file: torFile,   setFile: setTorFile   },
              { key: "specs", label: "Specifications",     hint: "PDF, DOCX, XLSX", accept: ".pdf,.doc,.docx,.xls,.xlsx", file: specsFile, setFile: setSpecsFile },
            ].map(doc => {
              const showLink = docModes[doc.key] === "link";
              const link = docLinks[doc.key];
              const isDone = doc.file || link.trim();
              return (
                <div key={doc.key} style={{ border: `1px solid ${isDone ? C.greenText : C.border}`, borderRadius: 10, padding: "14px 16px", background: isDone ? C.greenBg : C.surface }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textPri, marginBottom: 8 }}>
                    {doc.label} <span style={{ color: C.redText }}>*</span>
                  </div>

                  {/* Upload area — hidden when in link mode */}
                  {!showLink && (
                    <>
                      <input type="file" id={`doc-${doc.key}`} accept={doc.accept} style={{ display: "none" }}
                        onChange={e => {
                          const f = e.target.files[0];
                          if (!f) return;
                          if (f.size > maxFileMB * 1024 * 1024) {
                            e.target.value = "";
                            doc.setFile(null);
                            setDocModes(p => ({ ...p, [doc.key]: "link" }));
                            return;
                          }
                          doc.setFile(f);
                        }} />
                      <label htmlFor={`doc-${doc.key}`} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                        border: `1.5px dashed ${doc.file ? C.greenText : C.borderMid}`,
                        borderRadius: 7, cursor: "pointer", background: doc.file ? C.greenBg : "white" }}>
                        <div style={{ flexShrink: 0 }}>
                          {doc.file
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.greenText} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            : <Icon name="upload" size={14} color={C.textTer} />}
                        </div>
                        <span style={{ fontSize: 11, color: doc.file ? C.greenText : C.textTer, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.file ? doc.file.name : `${doc.hint} · max ${maxFileMB} MB`}
                        </span>
                      </label>
                      {doc.file && (
                        <button onClick={() => doc.setFile(null)}
                          style={{ marginTop: 5, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.textTer, padding: 0, fontFamily: "inherit" }}
                          onMouseOver={e => e.currentTarget.style.color = C.redText}
                          onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                          ✕ Remove
                        </button>
                      )}
                    </>
                  )}

                  {/* Link input — shown only when file exceeded size limit */}
                  {showLink && (
                    <div style={{ background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 7, padding: "10px 12px" }}>
                      <p style={{ margin: "0 0 8px", fontSize: 11, color: C.amberText, fontWeight: 500 }}>
                        ⚠ File exceeds {maxFileMB} MB limit. Please provide a shareable link instead.
                      </p>
                      <input type="url" value={link} onChange={e => setDocLinks(p => ({ ...p, [doc.key]: e.target.value }))}
                        placeholder="https://drive.google.com/…"
                        style={{ ...styles.input, fontSize: 11, borderColor: link.trim() ? C.greenText : C.border, marginBottom: 6 }} />
                      <p style={{ ...styles.hint, margin: 0 }}>Google Drive, SharePoint, Dropbox, etc. — ensure the link is set to view-only.</p>
                      <button onClick={() => { setDocModes(p => ({ ...p, [doc.key]: "file" })); setDocLinks(p => ({ ...p, [doc.key]: "" })); }}
                        style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.textTer, padding: 0, fontFamily: "inherit", textDecoration: "underline" }}>
                        ← Try uploading a smaller file
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button style={styles.btnSecondary} onClick={() => setPage("dashboard")}>Cancel</button>
          {!isReviewerCreating && (
            <button style={styles.btnSecondary} onClick={() => savePR(false)} disabled={saving}>Save as draft</button>
          )}
          {isReviewerCreating ? (
            <button style={styles.btnPrimary} onClick={() => savePR(false)} disabled={saving}>
              {saving ? "Submitting…" : "Submit for review"}
            </button>
          ) : (
            <button style={styles.btnAmber} onClick={() => savePR(true)} disabled={saving}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="send" size={13} color={C.amberText} /> Send to Manager
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── PR DETAIL PAGE ───────────────────────────────────────────────────────────
function PRDetailPage({ prId, setPage, profile, setSelectedRFAId, setRfaPRId, setSelectedRFQId }) {
  const [pr, setPR] = useState(null);
  const [scopeItems, setScopeItems] = useState([]);
  const [scopeOfWorks, setScopeOfWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  // Reviewer panel state
  const [rvBudgetStatus, setRvBudgetStatus] = useState("");
  const [rvBudgetCodeId, setRvBudgetCodeId] = useState("");
  const [projectBudgetCodes, setProjectBudgetCodes] = useState([]);
  const [rvRemainingBudget, setRvRemainingBudget] = useState("");
  const [rvProjectedCost, setRvProjectedCost] = useState("");
  const [rvRefFile, setRvRefFile] = useState(null);
  const [rvUploading, setRvUploading] = useState(false);

  // Approver 1 panel state
  const [a1BudgetStatus, setA1BudgetStatus] = useState("");
  const [a1BudgetCode, setA1BudgetCode] = useState("");
  const [a1RemainingBudget, setA1RemainingBudget] = useState("");
  const [a1ProjectedCost, setA1ProjectedCost] = useState("");
  const [a1RefFile, setA1RefFile] = useState(null);
  const [a1Uploading, setA1Uploading] = useState(false);

  const [linkedRFQ, setLinkedRFQ] = useState(null);

  useEffect(() => { fetchPR(); }, [prId]);

  const fetchPR = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("purchase_requests")
      .select(`
        id, pr_number, project_id, description, justification, status, current_step,
        is_rush, rush_justification, start_date, end_date, created_at,
        budget_status, budget_code, reviewed_at, approved1_at, approved2_at, rejected_at, rejection_reason,
        reviewer_budget_status, reviewer_budget_code,
        plans_file_url, plans_file_name,
        tor_file_url, tor_file_name,
        specs_file_url, specs_file_name,
        remarks, scope_of_works,
        projects (name, business_unit, project_code, short_name),
        profiles!purchase_requests_prepared_by_fkey (full_name, position)
      `)
      .eq("pr_number", prId)
      .single();
    if (data) {
      setPR(data);
      if (data.scope_of_works) setScopeOfWorks(data.scope_of_works);
      setA1BudgetStatus(data.budget_status || "");
      // Fetch active budget codes for this PR's project
      if (data.project_id) {
        const { data: codes } = await supabase.from("budget_codes")
          .select("id, code, type, description")
          .eq("project_id", data.project_id)
          .eq("is_active", true)
          .order("type").order("code");
        if (codes) setProjectBudgetCodes(codes);
      }
    }
    const { data: items } = await supabase.from("scope_items").select("*").eq("pr_id", prId).order("sort_order");
    if (items) setScopeItems(items);
    const { data: rfqRow } = await supabase
      .from("rfqs").select("id, rfq_number, status")
      .eq("pr_id", prId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (rfqRow) setLinkedRFQ(rfqRow);
    setLoading(false);
  };

  const isAdmin    = profile?.is_admin === true;
  const isPreparer = can(profile, "pr.prepare");
  const isManager  = profile?.position === "Manager" || isAdmin;

  const canSendToManager   = can(profile, "pr.send_to_manager") && pr?.status === "Draft";
  const canSubmitForReview = (can(profile, "pr.submit") && (pr?.status === "Pending Manager Approval" || pr?.status === "Pending GM Approval")) ;
  const canReview          = can(profile, "pr.review") && pr?.status === "For Review";
  const canApproveBudgeted = can(profile, "pr.approve_budgeted") && pr?.status === "Under Review" && pr?.reviewer_budget_status === "Budgeted";
  const canEndorseUnbudgeted = can(profile, "pr.endorse_unbudgeted") && pr?.status === "Under Review" && pr?.reviewer_budget_status === "Unbudgeted";
  const canApproveUnbudgeted = can(profile, "pr.approve_unbudgeted") && (pr?.status === "Pending Endorsement" || pr?.status === "Approved 1");
  const canApprove1        = (isAdmin) && pr?.status === "Under Review"; // admin fallback
  const canReject          = can(profile, "pr.reject")
                             && ["Under Review","Pending Endorsement","Approved 1"].includes(pr?.status);
  const canRevise          = isPreparer && pr?.status === "Rejected";
  const canResubmit        = isManager && pr?.status === "Rejected";
  const canCreateRFA       = can(profile, "pr.create_rfa") && pr?.status === "Approved";
  const canCreateRFQ       = can(profile, "pr.review") && pr?.status === "Approved" && !linkedRFQ;

  const handleCreateRFQ = async () => {
    await autoCreateRFQ(pr);
    const { data: rfqRow } = await supabase
      .from("rfqs").select("id, rfq_number, status")
      .eq("pr_id", prId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (rfqRow) setLinkedRFQ(rfqRow);
  };

  const handleCreateRFA = async () => {
    const { data: existing } = await supabase.from("rfas").select("id, rfa_number").eq("pr_id", prId).order("created_at");
    if (existing && existing.length > 0) {
      const nums = existing.map(r => r.rfa_number).join(", ");
      const proceed = window.confirm(
        `This PR already has ${existing.length} RFA${existing.length > 1 ? "s" : ""} (${nums}).\n\nProceeding will create RFA #${existing.length + 1} for this PR.\n\nDo you want to continue?`
      );
      if (!proceed) return;
    }
    setSelectedRFAId(null);
    setRfaPRId(prId);
    setPage("rfa_form");
  };

  const uploadRefFile = async (file, folder) => {
    const path = `${folder}/${prId}_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from("pr-documents").upload(path, file);
    if (error) { alert("Upload error: " + error.message); return null; }
    const { data: urlData } = supabase.storage.from("pr-documents").getPublicUrl(path);
    return { url: urlData.publicUrl, name: file.name };
  };

  const handleSendToManager = async () => {
    setUpdating(true);
    await supabase.from("purchase_requests").update({ status: "Pending Manager Approval", current_step: "Pending Manager Approval" }).eq("pr_number", prId);
    await fetchPR(); setUpdating(false);
  };

  const handleManagerSubmit = async () => {
    setUpdating(true);
    await supabase.from("purchase_requests").update({ status: "For Review", current_step: "For Review" }).eq("pr_number", prId);
    await fetchPR(); setUpdating(false);
  };

  const handleReviewComplete = async () => {
    if (!rvBudgetStatus) { alert("Please tag this PR as Budgeted or Unbudgeted."); return; }
    if (rvBudgetStatus === "Budgeted" && !rvBudgetCodeId) { alert("Please select a budget code."); return; }
    setRvUploading(true);

    let finalBudgetCode = null;

    if (rvBudgetStatus === "Budgeted") {
      // Use selected budget code
      const selected = projectBudgetCodes.find(c => c.id === parseInt(rvBudgetCodeId));
      finalBudgetCode = selected?.code || null;
    } else {
      // Auto-generate UB code: [PROJECT_CODE]-UB-[YEAR]-[COUNTER]
      const project = pr.projects;
      const projectCode = project?.short_name || project?.project_code || "PRJ";
      const year = new Date().getFullYear();
      const { data: existing } = await supabase.from("budget_codes").select("counter")
        .eq("project_id", pr.project_id).eq("type", "UB").eq("year", year)
        .order("counter", { ascending: false }).limit(1);
      const nextCounter = existing && existing.length > 0 ? existing[0].counter + 1 : 1;
      finalBudgetCode = `${projectCode}-UB-${year}-${String(nextCounter).padStart(3, "0")}`;
      // Insert the auto-generated UB code into budget_codes for traceability
      await supabase.from("budget_codes").insert({
        project_id: pr.project_id, code: finalBudgetCode, type: "UB",
        year, counter: nextCounter, description: `Auto-generated for PR ${pr.pr_number}`, is_active: true,
      });
    }

    await supabase.from("purchase_requests").update({
      status: "Under Review", current_step: "Under Review",
      reviewer_budget_status: rvBudgetStatus,
      reviewer_budget_code: finalBudgetCode,
      reviewed_at: new Date().toISOString(),
    }).eq("pr_number", prId);
    setRvUploading(false); await fetchPR();
  };

  const autoCreateRFQ = async (prData) => {
    const year = new Date().getFullYear();
    const { count } = await supabase.from("rfqs").select("id", { count: "exact", head: true });
    const rfqNumber = `RFQ-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
    let workDuration = null;
    if (prData?.start_date && prData?.end_date) {
      const diff = new Date(prData.end_date) - new Date(prData.start_date);
      workDuration = Math.round(diff / (1000 * 60 * 60 * 24));
    }
    const { error } = await supabase.from("rfqs").insert({
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
      vendor_description: prData?.description || null,
      vendor_justification: prData?.justification || null,
      created_by: profile?.id || null,
    });
    if (error) alert(`PR approved but RFQ could not be created: ${error.message}`);
  };

  // Approve budgeted PR (Commercial Manager or D&C Head)
  const handleApproveBudgeted = async () => {
    setA1Uploading(true);
    let refUrl = pr.projected_cost_reference_url;
    let refName = pr.projected_cost_reference_name;
    if (a1RefFile) {
      const result = await uploadRefFile(a1RefFile, "approver1-refs");
      if (result) { refUrl = result.url; refName = result.name; }
    }
    await supabase.from("purchase_requests").update({
      status: "Approved", current_step: "Approved",
      budget_status: pr.reviewer_budget_status,
      budget_code: pr.reviewer_budget_code || null,
      remaining_budget: pr.reviewer_remaining_budget || null,
      projected_cost: a1ProjectedCost ? parseFloat(a1ProjectedCost) : pr.reviewer_projected_cost || null,
      projected_cost_reference_url: refUrl,
      projected_cost_reference_name: refName,
      approved1_by: profile.id, approved1_at: new Date().toISOString(),
    }).eq("pr_number", prId);
    await autoCreateRFQ(pr);
    setA1Uploading(false); await fetchPR();
  };

  // Endorse unbudgeted PR (Commercial Manager) → forwards to D&C Head
  const handleEndorseUnbudgeted = async () => {
    setA1Uploading(true);
    let refUrl = pr.projected_cost_reference_url;
    let refName = pr.projected_cost_reference_name;
    if (a1RefFile) {
      const result = await uploadRefFile(a1RefFile, "approver1-refs");
      if (result) { refUrl = result.url; refName = result.name; }
    }
    await supabase.from("purchase_requests").update({
      status: "Pending Endorsement", current_step: "Pending Endorsement",
      budget_status: pr.reviewer_budget_status,
      budget_code: pr.reviewer_budget_code || null,
      projected_cost: a1ProjectedCost ? parseFloat(a1ProjectedCost) : pr.reviewer_projected_cost || null,
      projected_cost_reference_url: refUrl,
      projected_cost_reference_name: refName,
      approved1_by: profile.id, approved1_at: new Date().toISOString(),
    }).eq("pr_number", prId);
    setA1Uploading(false); await fetchPR();
  };

  // Approve unbudgeted PR (D&C Head)
  const handleApproveUnbudgeted = async () => {
    setUpdating(true);
    await supabase.from("purchase_requests").update({ status: "Approved", current_step: "Approved", approved2_by: profile.id, approved2_at: new Date().toISOString() }).eq("pr_number", prId);
    await autoCreateRFQ(pr);
    await fetchPR(); setUpdating(false);
  };

  // Admin fallback (legacy)
  const handleApprove1 = handleApproveBudgeted;
  const handleApprove2 = handleApproveUnbudgeted;

  const handleReject = async () => {
    if (!rejectNote.trim()) { alert("Please enter a rejection reason."); return; }
    setUpdating(true);
    await supabase.from("purchase_requests").update({ status: "Rejected", current_step: "Rejected", rejected_by: profile.id, rejected_at: new Date().toISOString(), rejection_reason: rejectNote }).eq("pr_number", prId);
    setShowRejectBox(false); setRejectNote(""); await fetchPR(); setUpdating(false);
  };

  const handleRevise = async () => {
    setUpdating(true);
    await supabase.from("purchase_requests").update({ status: "Draft", current_step: "Draft", rejection_reason: null }).eq("pr_number", prId);
    await fetchPR(); setUpdating(false);
  };

  const handleResubmit = async () => {
    setUpdating(true);
    await supabase.from("purchase_requests").update({ status: "For Review", current_step: "For Review" }).eq("pr_number", prId);
    await fetchPR(); setUpdating(false);
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}><div style={{ fontSize: 13, color: C.textTer }}>Loading PR details…</div></div>;
  if (!pr) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}><div style={{ fontSize: 13, color: C.redText }}>Purchase request not found.</div></div>;

  return (
    <>
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexWrap: "wrap" }}>
            <button onClick={() => setPage("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSec, padding: 0, fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="chevronLeft" size={14} color={C.textTer} /> Purchase Requests
            </button>
            <Icon name="chevronRight" size={12} color={C.textTer} />
            <span style={{ color: C.textPri, fontWeight: 500 }}>{pr.pr_number}</span>
            <span style={styles.badge(pr.status)}>{pr.status}</span>
            {pr.is_rush && <span style={styles.badge("Rush")}>Rush</span>}
            {pr.budget_status && <span style={styles.badge(pr.budget_status)}>{pr.budget_status}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {linkedRFQ ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.textSec }}>RFQ:</span>
              <button
                onClick={() => { setSelectedRFQId(linkedRFQ.id); setPage("rfq_detail"); }}
                style={{ background: C.tealBg, border: `1px solid ${C.tealText}40`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, color: C.tealText, cursor: "pointer" }}>
                {linkedRFQ.rfq_number} · {linkedRFQ.status}
              </button>
            </div>
          ) : canCreateRFQ ? (
            <button style={styles.btnPrimary} onClick={handleCreateRFQ}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="file" size={13} color="white" /> Create RFQ
              </span>
            </button>
          ) : canCreateRFA ? (
            <button style={styles.btnPrimary} onClick={handleCreateRFA}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="file" size={13} color="white" /> Create RFA
              </span>
            </button>
          ) : null}
          {canSendToManager && (
            <button style={styles.btnAmber} disabled={updating} onClick={handleSendToManager}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="send" size={13} color={C.amberText} /> Send to Manager</span>
            </button>
          )}
          {canSubmitForReview && (
            <button style={styles.btnPrimary} disabled={updating} onClick={handleManagerSubmit}>Submit for review</button>
          )}
          {canRevise && !canResubmit && (
            <button style={styles.btnSecondary} disabled={updating} onClick={handleRevise}>Revise draft</button>
          )}
          {canResubmit && (
            <>
              <button style={styles.btnSecondary} disabled={updating} onClick={handleRevise}>Revise draft</button>
              <button style={styles.btnPrimary} disabled={updating} onClick={handleResubmit}>Resubmit for review</button>
            </>
          )}
          {canReview && (
            <button style={styles.btnSuccess} disabled={rvUploading} onClick={handleReviewComplete}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="check" size={13} color={C.greenText} />
                {rvUploading ? "Uploading…" : "Complete Review"}
              </span>
            </button>
          )}
          {canApproveBudgeted && (
            <button style={styles.btnSuccess} disabled={a1Uploading} onClick={handleApproveBudgeted}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="check" size={13} color={C.greenText} />
                {a1Uploading ? "Processing…" : "Approve"}
              </span>
            </button>
          )}
          {canEndorseUnbudgeted && (
            <button style={styles.btnAmber} disabled={a1Uploading} onClick={handleEndorseUnbudgeted}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="send" size={13} color={C.amberText} />
                {a1Uploading ? "Processing…" : "Endorse — forward to D&C Head"}
              </span>
            </button>
          )}
          {canApproveUnbudgeted && (
            <button style={styles.btnSuccess} disabled={updating} onClick={handleApproveUnbudgeted}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="check" size={13} color={C.greenText} />
                Approve
              </span>
            </button>
          )}
          {canReject && !showRejectBox && (
            <button style={styles.btnDanger} disabled={updating || a1Uploading || rvUploading} onClick={() => setShowRejectBox(true)}>Reject</button>
          )}
        </div>
      </div>

      <div style={{ ...styles.pageBody, maxWidth: 980 }}>

        {/* Rejection reason banner */}
        {pr.status === "Rejected" && pr.rejection_reason && (
          <div style={{ background: C.redBg, border: `1px solid #FCA5A5`, borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.redText, marginBottom: 4 }}>Rejection reason</div>
            <div style={{ fontSize: 13, color: C.textPri }}>{pr.rejection_reason}</div>
          </div>
        )}

        {/* Reject input */}
        {showRejectBox && (
          <div style={{ background: C.redBg, border: `1px solid #FCA5A5`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.redText, marginBottom: 8 }}>Rejection reason</div>
            <textarea rows={2} placeholder="Briefly explain why this PR is being rejected…" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              style={{ ...styles.input, borderColor: "#FCA5A5", resize: "vertical", lineHeight: 1.5, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.btnDanger} disabled={updating} onClick={handleReject}>Confirm rejection</button>
              <button style={styles.btnSecondary} onClick={() => setShowRejectBox(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* PR Reviewer panel */}
        {canReview && (
          <div style={{ ...styles.card, marginBottom: 16, border: `1px solid ${C.tealText}`, background: C.tealBg }}>
            <h3 style={{ ...styles.cardTitle, borderBottomColor: C.tealText, color: C.tealText }}>PR Reviewer — Evaluation</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={styles.label}>Budget status <span style={styles.required}>*</span></label>
                <select value={rvBudgetStatus} onChange={e => { setRvBudgetStatus(e.target.value); setRvBudgetCodeId(""); }} style={styles.input}>
                  <option value="">Select…</option>
                  <option value="Budgeted">Budgeted</option>
                  <option value="Unbudgeted">Unbudgeted</option>
                </select>
              </div>
              {rvBudgetStatus === "Budgeted" && (
                <div>
                  <label style={styles.label}>Budget code <span style={styles.required}>*</span></label>
                  {projectBudgetCodes.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.amberText, background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 7, padding: "8px 10px" }}>
                      No active budget codes for this project. Please add codes in Settings first.
                    </div>
                  ) : (
                    <select value={rvBudgetCodeId} onChange={e => setRvBudgetCodeId(e.target.value)} style={styles.input}>
                      <option value="">Select budget code…</option>
                      {projectBudgetCodes.map(c => (
                        <option key={c.id} value={c.id}>{c.code}{c.description ? ` — ${c.description}` : ""}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {rvBudgetStatus === "Unbudgeted" && (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 7, padding: "8px 12px", fontSize: 12, color: C.amberText }}>
                    A <strong>UB code</strong> will be auto-generated for this project upon endorsement.
                  </div>
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, color: C.textTer, margin: 0 }}>
              Complete your evaluation above then use the buttons in the top right to endorse or reject.
            </p>
          </div>
        )}

        {/* Approver 1 panel */}
        {canApprove1 && (
          <div style={{ ...styles.card, marginBottom: 16, border: `1px solid ${C.coral}`, background: C.coralLight }}>
            <h3 style={{ ...styles.cardTitle, borderBottomColor: C.coral, color: C.coral }}>Budget Assessment</h3>

            {/* Reviewer assessment - read only */}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                <span style={styles.badge(pr.reviewer_budget_status || "Draft")}>{pr.reviewer_budget_status || "Not tagged"}</span>
                {pr.reviewer_budget_code && (
                  <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: C.coral, background: C.coralLight, padding: "2px 8px", borderRadius: 4 }}>
                    {pr.reviewer_budget_code}
                  </span>
                )}
              </div>
            </div>

            {pr.reviewer_budget_status === "Unbudgeted" && (
              <p style={{ fontSize: 11, color: C.textTer, margin: 0 }}>Approving will forward this PR to Approver 2 for final sign-off.</p>
            )}
          </div>
        )}

        {/* Approver 2 panel */}
        {canApproveUnbudgeted && (
          <div style={{ ...styles.card, marginBottom: 16, border: `1px solid ${C.amberText}`, background: C.amberBg }}>
            <h3 style={{ ...styles.cardTitle, borderBottomColor: C.amberText, color: C.amberText }}>Approver 2 — Final Approval</h3>
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.textSec }}>
              This is an <strong>unbudgeted</strong> PR. Budget code: <strong style={{ fontFamily: "monospace", color: C.coral }}>{pr.reviewer_budget_code || "—"}</strong>
            </div>
            <p style={{ fontSize: 11, color: C.textTer, margin: 0 }}>
  Review the details above then use the buttons in the top right to approve or reject.
</p>
          </div>
        )}

        {/* Status timeline */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={styles.cardTitle}>Status &amp; progress</h3>
          <StatusTimeline
            status={pr.status}
            dates={{
              prepare: pr.created_at,
              submit:  null,
              review:  pr.reviewed_at,
              approve: pr.approved2_at || pr.approved1_at,
            }}
          />
        </div>

        {/* Two column info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Project details</h3>
            <InfoRow label="Project">{pr.projects?.name || "—"}</InfoRow>
            <InfoRow label="Business unit">{pr.projects?.business_unit || "—"}</InfoRow>
            <InfoRow label="PR Number">{pr.pr_number}</InfoRow>
            <InfoRow label="Prepared by">{pr.profiles?.full_name || "—"}</InfoRow>
            <InfoRow label="Manager">—</InfoRow>
          </div>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Work Schedule</h3>
            <InfoRow label="Start date">{fmtShort(pr.start_date)}</InfoRow>
            <InfoRow label="End date">{fmtShort(pr.end_date)}</InfoRow>
            <InfoRow label="Request type">
              {pr.is_rush ? <span style={styles.badge("Rush")}>Rush Request</span> : <span style={{ fontSize: 13, color: C.textSec }}>Standard</span>}
            </InfoRow>
          </div>
        </div>

        {/* Budget — only shown after reviewer evaluation */}
        {pr.reviewer_budget_status && (
          <div style={{ ...styles.card, marginBottom: 16 }}>
            <h3 style={styles.cardTitle}>Budget</h3>
            <InfoRow label="Budget status">
              <span style={styles.badge(pr.reviewer_budget_status)}>{pr.reviewer_budget_status}</span>
            </InfoRow>
            <InfoRow label="Budget code">
              <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: C.coral }}>{pr.reviewer_budget_code || "—"}</span>
            </InfoRow>
          </div>
        )}

        {/* Work request details */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={styles.cardTitle}>Work request details</h3>
          <InfoRow label="Description"><p style={{ margin: 0, fontSize: 13, color: C.textPri, lineHeight: 1.6 }}>{pr.description || "—"}</p></InfoRow>
          <InfoRow label="Justification"><p style={{ margin: 0, fontSize: 13, color: C.textPri, lineHeight: 1.6 }}>{pr.justification || "—"}</p></InfoRow>
          {pr.remarks && <InfoRow label="Remarks"><p style={{ margin: 0, fontSize: 13, color: C.textPri, lineHeight: 1.6 }}>{pr.remarks}</p></InfoRow>}
          {pr.is_rush && pr.rush_justification && (
            <div style={{ background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.amberText, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Rush justification — PMS impact</div>
              <p style={{ margin: 0, fontSize: 13, color: C.textPri, lineHeight: 1.6 }}>{pr.rush_justification}</p>
            </div>
          )}
        </div>

        {/* Scope of Works */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={styles.cardTitle}>Scope of Works</h3>
          {scopeOfWorks.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textTer, margin: 0 }}>No scope of works recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {scopeOfWorks.map(wt => {
                const reqItems = wt.items.filter(i => i.status === "required");
                const notReqItems = wt.items.filter(i => i.status === "not_required");
                return (
                  <div key={wt.workType} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "9px 16px", background: C.offWhite, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>{wt.workType}</span>
                      <span style={{ fontSize: 11, color: C.textTer }}>{reqItems.length} required · {notReqItems.length} not required</span>
                    </div>
                    <div style={{ padding: "8px 16px" }}>
                      {reqItems.map(item => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.greenText, background: C.greenBg, border: `1px solid ${C.greenText}`, borderRadius: 4, padding: "1px 7px", flexShrink: 0 }}>Required</span>
                          <span style={{ fontSize: 12, color: C.textPri }}>{item.label}</span>
                        </div>
                      ))}
                      {notReqItems.map(item => (
                        <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.textTer, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 7px", flexShrink: 0, marginTop: 1 }}>Not Req.</span>
                          <div>
                            <div style={{ fontSize: 12, color: C.textSec }}>{item.label}</div>
                            {item.remarks && <div style={{ fontSize: 11, color: C.textTer, fontStyle: "italic", marginTop: 2 }}>{item.remarks}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Documents */}
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={styles.cardTitle}>Required documents</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Plans",              url: pr?.plans_file_url, name: pr?.plans_file_name },
              { label: "Terms of Reference", url: pr?.tor_file_url,   name: pr?.tor_file_name   },
              { label: "Specifications",     url: pr?.specs_file_url, name: pr?.specs_file_name  },
            ].map(doc => (
              <div key={doc.label} style={{ border: `1px solid ${doc.url ? C.greenText : C.border}`, background: doc.url ? C.greenBg : "transparent", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, background: doc.url ? C.greenBg : C.surface, border: doc.url ? `1px solid ${C.greenText}` : "none", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="file" size={15} color={doc.url ? C.greenText : C.textTer} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textPri, width: 160, flexShrink: 0 }}>{doc.label}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: C.coral, textDecoration: "underline", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.name || "Download file"}
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: C.textTer }}>No file uploaded</span>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {doc.url
                    ? <span style={{ fontSize: 11, fontWeight: 600, color: C.greenText, background: C.greenBg, border: `1px solid ${C.greenText}`, borderRadius: 6, padding: "2px 8px" }}>Uploaded</span>
                    : <span style={{ fontSize: 11, fontWeight: 600, color: C.textTer, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px" }}>Missing</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

// ─── PROJECTS PAGE ────────────────────────────────────────────────────────────
function ProjectsPage({ profile }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [buFilter, setBuFilter] = useState([]);
  const [activeCard, setActiveCard] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [form, setForm] = useState({ name: "", short_name: "", business_unit: "", description: "", address: "", start_date: "", end_date: "", status: "active", pr_reviewer_id: "" });
  const [allReviewers, setAllReviewers] = useState([]);
  const [importPreview, setImportPreview] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState([]);
  const [showImportResults, setShowImportResults] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const canManage = can(profile, "project.create");

  useEffect(() => { fetchProjects(); fetchBusinessUnits(); fetchReviewers(); }, []);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*, reviewer:profiles!projects_pr_reviewer_id_fkey (id, full_name)").order("created_at", { ascending: false });
    if (data) setProjects(data);
    setLoading(false);
  };

  const fetchReviewers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").eq("position", "Commercial Officer").eq("is_active", true).order("full_name");
    if (data) setAllReviewers(data);
  };

  const fetchBusinessUnits = async () => {
    const { data } = await supabase.from("business_units").select("*").order("name");
    if (data) setBusinessUnits(data);
  };

  const openCreate = () => { setEditingProject(null); setForm({ name: "", short_name: "", business_unit: "", description: "", address: "", start_date: "", end_date: "", status: "active", pr_reviewer_id: "" }); setShowModal(true); };
  const openEdit = (p) => { setEditingProject(p); setForm({ name: p.name || "", short_name: p.short_name || p.project_code || "", business_unit: p.business_unit || "", description: p.description || "", address: p.address || "", start_date: p.start_date || "", end_date: p.end_date || "", status: p.status || "active", pr_reviewer_id: p.pr_reviewer_id || "" }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingProject(null); };

  const handleSave = async () => {
    if (!form.name) { alert("Project name is required."); return; }
    if (!form.business_unit) { alert("Business unit is required."); return; }
    setSaving(true);
    if (editingProject) {
      await supabase.from("projects").update(form).eq("id", editingProject.id);
    } else {
      // Auto-generate project_code as the unique identifier (PRJ-000001)
      const { count } = await supabase.from("projects").select("*", { count: "exact", head: true });
      const projectCode = `PRJ-${String((count || 0) + 1).padStart(6, "0")}`;
      await supabase.from("projects").insert({ ...form, project_code: projectCode });
    }
    setSaving(false); closeModal(); fetchProjects();
  };

  const toggleStatus = async (p) => {
    await supabase.from("projects").update({ status: p.status === "active" ? "inactive" : "active" }).eq("id", p.id);
    fetchProjects();
  };

  const excelDateToISO = (value) => {
    if (typeof value === "number") { const d = XLSX.SSF.parse_date_code(value); return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`; }
    const d = new Date(value); if (!isNaN(d)) return d.toISOString().split("T")[0]; return "";
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const normalized = rows.map(row => {
        const c = {}; Object.keys(row).forEach(k => { c[k.trim()] = row[k]; });
        const rawStatus = (c["Status"] || "").toString().trim().toLowerCase();
        const status = rawStatus === "inactive" ? "inactive" : "active";
        return { name: c["Project Name"] || c["Name"] || "", short_name: c["Short Name"] || c["Project Short Name"] || c["Code"] || "", business_unit: c["Business Unit"] || "", start_date: c["Start Date"] ? excelDateToISO(c["Start Date"]) : "", end_date: c["End Date"] ? excelDateToISO(c["End Date"]) : "", description: c["Description"] || "", address: c["Address"] || "", status };
      }).filter(r => r.name);
      const names = normalized.map(r => r.name).filter(Boolean);
      const { data: existing } = await supabase.from("projects").select("name").in("name", names);
      const existingNames = new Set((existing || []).map(e => e.name));
      setImportPreview(normalized.map(row => ({ ...row, isDuplicate: existingNames.has(row.name), action: existingNames.has(row.name) ? "ask" : "insert" })));
      setShowImportModal(true);
    };
    reader.readAsBinaryString(file); e.target.value = "";
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    const results = [];
    for (const row of importPreview) {
      if (row.action === "skip") { results.push({ name: row.name, status: "skipped" }); continue; }
      if (row.action === "insert") {
        const { count: cnt } = await supabase.from("projects").select("*", { count: "exact", head: true });
        const projectCode = `PRJ-${String((cnt || 0) + 1).padStart(6, "0")}`;
        const { error } = await supabase.from("projects").insert({ name: row.name, short_name: row.short_name, project_code: projectCode, business_unit: row.business_unit, start_date: row.start_date || null, end_date: row.end_date || null, description: row.description, address: row.address || null, status: row.status || "active" });
        results.push({ name: row.name, status: error ? "error" : "imported" });
      }
      if (row.action === "overwrite") { const { error } = await supabase.from("projects").update({ name: row.name, short_name: row.short_name, business_unit: row.business_unit, start_date: row.start_date || null, end_date: row.end_date || null, description: row.description, address: row.address || null, status: row.status || "active" }).eq("name", row.name); results.push({ name: row.name, status: error ? "error" : "updated" }); }
    }
    setImporting(false); setShowImportModal(false); setImportPreview([]); setImportResults(results); setShowImportResults(true); fetchProjects();
  };

  const projectCardStatusMap = {
    "Active":   ["active"],
    "Inactive": ["inactive"],
  };

  const filtered = projects.filter(p => {
    const s = search.toLowerCase();
    const matchSearch = (p.name||"").toLowerCase().includes(s) || (p.project_code||"").toLowerCase().includes(s) || (p.short_name||"").toLowerCase().includes(s) || (p.business_unit||"").toLowerCase().includes(s);
    const matchBu = buFilter.length === 0 || buFilter.includes(p.business_unit);
    let matchStatus;
    if (activeCard && activeCard !== "Total") {
      matchStatus = (projectCardStatusMap[activeCard] || []).includes(p.status);
    } else if (activeCard === "Total") {
      matchStatus = true;
    } else {
      matchStatus = statusFilter === "All" || p.status === statusFilter;
    }
    return matchSearch && matchBu && matchStatus;
  });

  const downloadProjectTemplate = () => {
    const headers = [["Project Name", "Short Name", "Business Unit", "Start Date", "End Date", "Description", "Address", "Status"]];
    const example = [
      ["Southscapes Trece Martires", "STM", "PH1L", "01/01/2026", "12/31/2027", "Main construction", "Trece Martires, Cavite", "active"],
      ["My Enso Loft",               "MEL", "PH1",  "03/01/2026", "06/30/2027", "",                   "Pasig City",           "active"],
    ];
    const wsData = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    wsData["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 32 }, { wch: 10 }];
    const wsInstr = XLSX.utils.aoa_to_sheet([
      ["INSTRUCTIONS"],
      ["Fill in the 'Projects' sheet only. Do NOT modify column headers."],
      [""],
      ["Project Name — required. Full name of the project."],
      ["Short Name — optional but recommended. Short abbreviation used as prefix in budget codes (e.g. STM → STM-UB-2026-001). Keep it 3–6 characters."],
      ["Business Unit — must match an existing business unit in the system."],
      ["Start Date / End Date — format MM/DD/YYYY, or leave blank."],
      ["Description — optional. Brief description of the project scope."],
      ["Address — physical site location, used in NOA/NTP, Term Sheet, and Contract Agreement."],
      ["Status — active or inactive. Defaults to active if blank."],
      [""],
      ["NOTE: Project Code is auto-generated by the system on import. Do not add a Project Code column."],
      ["NOTE: Commercial Officer is assigned manually after import via the project edit screen."],
    ]);
    wsInstr["!cols"] = [{ wch: 100 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData,  "Projects");
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions");
    XLSX.writeFile(wb, "projects-import-template.xlsx");
  };

  return (
    <>
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.textTer }}>Manage all active and inactive projects</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btnGhost} onClick={downloadProjectTemplate}>⬇ Download Template</button>
          {canManage && (
            <>
              <input id="excel-upload" type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleExcelUpload} />
              <button style={styles.btnSecondary} onClick={() => document.getElementById("excel-upload").click()}>↑ Import Excel</button>
              <button style={styles.btnPrimary} onClick={openCreate}>+ New Project</button>
            </>
          )}
        </div>
      </div>

      <div style={styles.pageBody}>
        <div style={{ maxWidth: "80%", margin: "0 auto" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          {[
            { label: "Total",    value: projects.length,                                      color: C.textPri,  desc: "All projects"             },
            { label: "Active",   value: projects.filter(p => p.status === "active").length,   color: C.greenText,desc: "Currently in progress"     },
            { label: "Inactive", value: projects.filter(p => p.status === "inactive").length, color: C.grayText, desc: "Closed or on hold"         },
          ].map(s => {
            const isActive = activeCard === s.label;
            return (
              <div key={s.label}
                onClick={() => setActiveCard(prev => prev === s.label ? null : s.label)}
                style={{
                  background: isActive ? C.coralLight : C.white,
                  border: `1px solid ${isActive ? C.coral : C.border}`,
                  borderRadius: 12, padding: "14px 18px",
                  boxShadow: isActive ? `0 0 0 2px ${C.coralMid}` : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
                  cursor: "pointer", userSelect: "none",
                  transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
                }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.coralDark : C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Search and filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={13} color={C.textTer} /></div>
            <input placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 30, fontSize: 12 }} />
          </div>
          <MultiSelect options={businessUnits.map(bu => bu.name)} value={buFilter} onChange={setBuFilter} placeholder="All Business Units" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...styles.input, width: "auto", fontSize: 12 }}>
            {["All","active","inactive"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* ── Table card ── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)" }}>
          <div style={{ overflowX: "auto" }} onClick={() => openMenuId && setOpenMenuId(null)}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.coralMid }}>
                  {["Project Code","Project Name","Commercial Officer","Start","End","Status",""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.coralDark, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.coralLight}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: C.textTer, fontSize: 13 }}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: C.textTer, fontSize: 13 }}>No projects found.{canManage && <> <span style={{ color: C.coral, cursor: "pointer" }} onClick={openCreate}>Create one</span>.</>}</td></tr>}
                {!loading && filtered.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.12s" }}
                    onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                    onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                    {/* Project Code — auto-generated unique identifier */}
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, background: C.surface, padding: "2px 6px", borderRadius: 4, color: C.textSec, whiteSpace: "nowrap" }}>{p.project_code || "—"}</span>
                    </td>
                    {/* Project Name + Short Name + Business Unit combined */}
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ fontWeight: 500, color: C.textPri, fontSize: 13 }}>{p.name}</div>
                      {(p.short_name || p.business_unit) && (
                        <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>
                          {[p.short_name, p.business_unit].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    {/* Commercial Officer inline dropdown */}
                    <td style={{ padding: "6px 14px" }}>
                      <select value={p.pr_reviewer_id || ""} onChange={async e => { await supabase.from("projects").update({ pr_reviewer_id: e.target.value || null }).eq("id", p.id); fetchProjects(); }}
                        style={{ fontSize: 12, color: C.textSec, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", background: C.white, cursor: "pointer", fontFamily: "inherit" }}>
                        <option value="">— Unassigned —</option>
                        {allReviewers.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "9px 14px", color: C.textTer, fontSize: 12, whiteSpace: "nowrap" }}>{fmtShort(p.start_date) || "—"}</td>
                    <td style={{ padding: "9px 14px", color: C.textTer, fontSize: 12, whiteSpace: "nowrap" }}>{fmtShort(p.end_date) || "—"}</td>
                    {/* Status inline dropdown */}
                    <td style={{ padding: "6px 14px" }}>
                      <select value={p.status || "active"} onChange={async e => { await supabase.from("projects").update({ status: e.target.value }).eq("id", p.id); fetchProjects(); }}
                        style={{ fontSize: 12, color: p.status === "active" ? C.greenText : C.grayText, border: `1px solid ${p.status === "active" ? "#86EFAC" : C.border}`, borderRadius: 6, padding: "3px 6px", background: p.status === "active" ? C.greenBg : C.grayBg, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                    {/* Actions — single ⋯ menu */}
                    <td style={{ padding: "9px 14px", textAlign: "right", position: "relative" }}>
                      {canManage && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id); }}
                            style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: "3px 8px", fontSize: 15, color: C.textSec, lineHeight: 1 }}>
                            ⋯
                          </button>
                          {openMenuId === p.id && (
                            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 14, top: "100%", zIndex: 99, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", minWidth: 140, overflow: "hidden" }}>
                              <button onClick={() => { openEdit(p); setOpenMenuId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, background: "none", border: "none", cursor: "pointer", color: C.textPri }}>✏️ Edit</button>
                              <div style={{ height: 1, background: C.border }} />
                              <button onClick={() => { toggleStatus(p); setOpenMenuId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, background: "none", border: "none", cursor: "pointer", color: p.status === "active" ? C.redText : C.greenText }}>
                                {p.status === "active" ? "⏸ Deactivate" : "▶ Activate"}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textTer }}>Showing {filtered.length} of {projects.length} projects</span>
            <button onClick={fetchProjects} style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }}>↻ Refresh</button>
          </div>
        </div>
        </div>
      </div>

      {/* Project modal */}
      {showModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>{editingProject ? "Edit project" : "New project"}</div>
                <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{editingProject ? "Update project information" : "Fill in the details to create a new project"}</div>
              </div>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 18, padding: 4 }}>✕</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>Project name <span style={styles.required}>*</span></label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Metro Rail Extension Phase 2" style={styles.input}
                    onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div>
                  <label style={styles.label}>Project Short Name</label>
                  <input value={form.short_name} onChange={e => setForm(p => ({ ...p, short_name: e.target.value }))} placeholder="e.g. MRE, METRO-P2" style={styles.input}
                    onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div>
                  <label style={styles.label}>Project Code</label>
                  <div style={{ ...styles.input, background: C.surface, color: C.textSec, fontFamily: "monospace", fontSize: 13, cursor: "default", display: "flex", alignItems: "center" }}>
                    {editingProject?.project_code || <span style={{ color: C.textTer, fontFamily: "inherit", fontSize: 12 }}>Auto-generated on save</span>}
                  </div>
                </div>
                <div>
                  <label style={styles.label}>Business unit <span style={styles.required}>*</span></label>
                  <select value={form.business_unit} onChange={e => setForm(p => ({ ...p, business_unit: e.target.value }))} style={styles.input}>
                    <option value="">Select business unit…</option>
                    {businessUnits.map(bu => <option key={bu.id} value={bu.name}>{bu.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Start date</label>
                  <DatePicker selected={form.start_date ? new Date(form.start_date) : null} onChange={d => setForm(p => ({ ...p, start_date: d ? d.toISOString().split("T")[0] : "" }))} placeholderText="Select start date" dateFormat="MMM d, yyyy" wrapperClassName="date-picker-wrapper" customInput={<input style={{ ...styles.input, cursor: "pointer" }} />} />
                </div>
                <div>
                  <label style={styles.label}>End date</label>
                  <DatePicker selected={form.end_date ? new Date(form.end_date) : null} onChange={d => setForm(p => ({ ...p, end_date: d ? d.toISOString().split("T")[0] : "" }))} minDate={form.start_date ? new Date(form.start_date) : null} placeholderText="Select end date" dateFormat="MMM d, yyyy" wrapperClassName="date-picker-wrapper" customInput={<input style={{ ...styles.input, cursor: "pointer" }} />} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the project scope…" style={{ ...styles.input, resize: "vertical", lineHeight: 1.5 }} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>Project Address / Site Location</label>
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="e.g. Northville, Caloocan City" style={styles.input}
                    onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>Commercial Officer</label>
                  <select value={form.pr_reviewer_id} onChange={e => setForm(p => ({ ...p, pr_reviewer_id: e.target.value }))} style={styles.input}>
                    <option value="">— Unassigned —</option>
                    {allReviewers.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                  </select>
                </div>
                {editingProject && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={styles.label}>Status</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={styles.input}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8, background: C.offWhite }}>
              <button style={styles.btnSecondary} onClick={closeModal}>Cancel</button>
              <button style={{ ...styles.btnPrimary, opacity: saving ? 0.75 : 1 }} disabled={saving} onClick={handleSave}>
                {saving ? "Saving…" : editingProject ? "Save changes" : "Create project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import preview modal */}
      {showImportModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 680, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>Import projects from Excel</div>
                <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{importPreview.length} row(s) detected</div>
              </div>
              <button onClick={() => setShowImportModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 18, padding: 4 }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.offWhite, position: "sticky", top: 0 }}>
                    {["Project Name","Code","Business Unit","Address","Start","End","Action"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: C.textTer, fontSize: 11, letterSpacing: "0.03em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: row.isDuplicate ? "#FFFBEB" : "transparent" }}>
                      <td style={{ padding: "10px 14px", color: C.textPri, fontWeight: 500 }}>{row.name}</td>
                      <td style={{ padding: "10px 14px", color: C.textSec, fontFamily: "monospace" }}>{row.project_code || "—"}</td>
                      <td style={{ padding: "10px 14px", color: C.textSec }}>{row.business_unit}</td>
                      <td style={{ padding: "10px 14px", color: C.textSec }}>{row.address || "—"}</td>
                      <td style={{ padding: "10px 14px", color: C.textSec }}>{row.start_date || "—"}</td>
                      <td style={{ padding: "10px 14px", color: C.textSec }}>{row.end_date || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {row.isDuplicate ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button style={{ ...styles.btnGhost, padding: "4px 10px", fontSize: 11, color: C.greenText, borderColor: "#86EFAC", background: row.action === "overwrite" ? C.greenBg : "transparent" }}
                              onClick={() => setImportPreview(prev => prev.map((r, idx) => idx === i ? { ...r, action: "overwrite" } : r))}>Overwrite</button>
                            <button style={{ ...styles.btnGhost, padding: "4px 10px", fontSize: 11, background: row.action === "skip" ? C.surface : "transparent" }}
                              onClick={() => setImportPreview(prev => prev.map((r, idx) => idx === i ? { ...r, action: "skip" } : r))}>Skip</button>
                          </div>
                        ) : <span style={{ ...styles.badge("Approved"), fontSize: 10 }}>New</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.offWhite }}>
              <span style={{ fontSize: 12, color: C.textTer }}>Duplicates highlighted in yellow</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.btnSecondary} onClick={() => setShowImportModal(false)}>Cancel</button>
                <button style={{ ...styles.btnPrimary, opacity: importing ? 0.75 : 1 }} disabled={importing} onClick={handleImportConfirm}>
                  {importing ? "Importing…" : "Confirm import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import results modal */}
      {showImportResults && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>Import complete</div>
              <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>Summary of processed records</div>
            </div>
            <div style={{ padding: "16px 24px", maxHeight: 300, overflowY: "auto" }}>
              {importResults.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < importResults.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize: 13, color: C.textPri }}>{r.name}</span>
                  <span style={{ ...styles.badge(r.status === "imported" ? "Approved" : r.status === "updated" ? "For Review" : r.status === "skipped" ? "Draft" : "Rejected"), fontSize: 10, textTransform: "capitalize" }}>{r.status}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", background: C.offWhite }}>
              <button style={styles.btnPrimary} onClick={() => { setShowImportResults(false); setImportResults([]); }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── BUDGET CODES PAGE ────────────────────────────────────────────────────────
function BudgetCodesPage({ profile }) {
  const [bcProjects, setBcProjects] = useState([]);
  const [bcCodes, setBcCodes]       = useState([]);
  const [bcFilterProject, setBcFilterProject] = useState("");
  const [bcFormProject, setBcFormProject]     = useState("");
  const [bcFormType, setBcFormType]           = useState("");
  const [bcFormYear, setBcFormYear]           = useState(String(new Date().getFullYear()));
  const [bcFormDesc, setBcFormDesc]           = useState("");
  const [bcSaving, setBcSaving]               = useState(false);
  const [bcLoading, setBcLoading]             = useState(true);
  const [bcImportPreview, setBcImportPreview] = useState([]);
  const [bcShowImport, setBcShowImport]       = useState(false);
  const [bcImporting, setBcImporting]         = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setBcLoading(true);
    const { data: projects } = await supabase.from("projects").select("id, name, project_code").eq("status", "active").order("name");
    if (projects) setBcProjects(projects);
    const { data: codes } = await supabase.from("budget_codes").select("*, projects(name, project_code)").order("created_at", { ascending: false });
    if (codes) setBcCodes(codes);
    setBcLoading(false);
  };

  const addBudgetCode = async () => {
    if (!bcFormProject) { alert("Please select a project."); return; }
    if (!bcFormType)    { alert("Please select a budget type."); return; }
    const project = bcProjects.find(p => p.id === parseInt(bcFormProject));
    const year = parseInt(bcFormYear) || new Date().getFullYear();
    const { data: existing } = await supabase.from("budget_codes").select("counter")
      .eq("project_id", parseInt(bcFormProject)).eq("type", bcFormType).eq("year", year)
      .order("counter", { ascending: false }).limit(1);
    const nextCounter = existing && existing.length > 0 ? existing[0].counter + 1 : 1;
    const code = `${project.project_code}-${bcFormType}-${year}-${String(nextCounter).padStart(3, "0")}`;
    setBcSaving(true);
    const { error } = await supabase.from("budget_codes").insert({
      project_id: parseInt(bcFormProject), code, type: bcFormType, year, counter: nextCounter,
      description: bcFormDesc.trim() || null, is_active: true,
    });
    if (error) { alert("Error: " + error.message); setBcSaving(false); return; }
    setBcFormProject(""); setBcFormType(""); setBcFormYear(String(new Date().getFullYear())); setBcFormDesc("");
    setBcSaving(false);
    fetchData();
  };

  const deactivateBudgetCode  = async (id) => { await supabase.from("budget_codes").update({ is_active: false }).eq("id", id); fetchData(); };
  const reactivateBudgetCode  = async (id) => { await supabase.from("budget_codes").update({ is_active: true  }).eq("id", id); fetchData(); };

  // Export current codes to Excel
  const exportCodes = () => {
    const rows = bcCodes.map(bc => ({
      "Code":         bc.code,
      "Project Name": bc.projects?.name || "",
      "Project Code": bc.projects?.project_code || "",
      "Type":         bc.type,
      "Year":         bc.year,
      "Description":  bc.description || "",
      "Status":       bc.is_active ? "Active" : "Inactive",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 28 },{ wch: 30 },{ wch: 14 },{ wch: 10 },{ wch: 8 },{ wch: 32 },{ wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Budget Codes");
    XLSX.writeFile(wb, `budget-codes-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Download blank import template
  const downloadTemplate = () => {
    const instructions = [
      ["INSTRUCTIONS"],
      ["Fill in the 'Budget Codes' sheet. Do NOT modify column headers."],
      ["Project Code must exactly match an existing active project code."],
      ["Type must be one of: CAPEX, OPEX, MAINT"],
      ["Year must be a 4-digit year e.g. 2026"],
      ["Description is optional."],
      ["The system will auto-generate the full code and counter on import."],
    ];
    const example = [
      ["Project Code", "Type", "Year", "Description"],
      ["CON", "CAPEX", 2026, "Main construction budget"],
      ["CON", "OPEX",  2026, "Operating expenses"],
      ["ELE", "MAINT", 2026, ""],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
    const wsData  = XLSX.utils.aoa_to_sheet(example);
    wsData["!cols"] = [{ wch: 16 },{ wch: 10 },{ wch: 8 },{ wch: 32 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData,  "Budget Codes");
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions");
    XLSX.writeFile(wb, "budget-codes-template.xlsx");
  };

  // Parse uploaded Excel file into preview rows
  const handleImportFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const ws = wb.Sheets["Budget Codes"] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const VALID_TYPES = ["CAPEX", "OPEX", "MAINT"];
      const preview = rows.map((r, i) => {
        const projectCode = String(r["Project Code"] || "").trim().toUpperCase();
        const type        = String(r["Type"] || "").trim().toUpperCase();
        const year        = parseInt(r["Year"]) || 0;
        const description = String(r["Description"] || "").trim();
        const project     = bcProjects.find(p => p.project_code?.toUpperCase() === projectCode);
        const errors = [];
        if (!projectCode)              errors.push("Missing project code");
        else if (!project)             errors.push(`Project code "${projectCode}" not found`);
        if (!VALID_TYPES.includes(type)) errors.push(`Type must be CAPEX, OPEX, or MAINT`);
        if (!year || year < 2020)      errors.push("Invalid year");
        return { row: i + 2, projectCode, type, year, description, project, errors, valid: errors.length === 0 };
      }).filter(r => r.projectCode || r.type); // skip blank rows
      setBcImportPreview(preview);
      setBcShowImport(true);
    };
    reader.readAsArrayBuffer(file);
  };

  // Execute the import
  const confirmImport = async () => {
    const validRows = bcImportPreview.filter(r => r.valid);
    if (validRows.length === 0) { alert("No valid rows to import."); return; }
    setBcImporting(true);
    let inserted = 0, failed = 0;
    for (const row of validRows) {
      const year = row.year;
      const { data: existing } = await supabase.from("budget_codes").select("counter")
        .eq("project_id", row.project.id).eq("type", row.type).eq("year", year)
        .order("counter", { ascending: false }).limit(1);
      const nextCounter = existing && existing.length > 0 ? existing[0].counter + 1 : 1;
      const code = `${row.project.project_code}-${row.type}-${year}-${String(nextCounter).padStart(3, "0")}`;
      const { error } = await supabase.from("budget_codes").insert({
        project_id: row.project.id, code, type: row.type, year, counter: nextCounter,
        description: row.description || null, is_active: true,
      });
      if (error) failed++; else inserted++;
    }
    setBcImporting(false);
    setBcShowImport(false);
    setBcImportPreview([]);
    fetchData();
    alert(`Import complete: ${inserted} added${failed > 0 ? `, ${failed} failed` : ""}.`);
  };

  const filtered = bcCodes.filter(c => !bcFilterProject || String(c.project_id) === bcFilterProject);
  const previewProject = bcProjects.find(p => p.id === parseInt(bcFormProject));

  return (
    <>
      <div style={styles.topBar}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.textPri }}>Budget Codes</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btnGhost} onClick={downloadTemplate}>⬇ Download Template</button>
          <label style={{ ...styles.btnSecondary, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            ⬆ Import Excel
            <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => { handleImportFile(e.target.files[0]); e.target.value = ""; }} />
          </label>
          <button style={styles.btnGhost} onClick={exportCodes} disabled={bcCodes.length === 0}>⬇ Export Codes</button>
        </div>
      </div>
      <div style={{ ...styles.pageBody, maxWidth: 1100 }}>
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: C.textPri, letterSpacing: "-0.02em" }}>Budget Codes</h2>
          <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>
            Pre-establish budget codes per project. Format: <strong>[PROJECT CODE]-[TYPE]-[YEAR]-[COUNTER]</strong>
          </p>
        </div>

        {/* Add form */}
        <div style={{ ...styles.card, marginBottom: 20 }}>
          <h3 style={styles.cardTitle}>Add new budget code</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={styles.label}>Project <span style={styles.required}>*</span></label>
              <select value={bcFormProject} onChange={e => setBcFormProject(e.target.value)} style={styles.input}>
                <option value="">Select project…</option>
                {bcProjects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.project_code})</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Type <span style={styles.required}>*</span></label>
              <select value={bcFormType} onChange={e => setBcFormType(e.target.value)} style={styles.input}>
                <option value="">Select type…</option>
                <option value="CAPEX">CAPEX — Capital Expenditure</option>
                <option value="OPEX">OPEX — Operating Expenditure</option>
                <option value="MAINT">MAINT — Maintenance</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Year</label>
              <input type="number" value={bcFormYear} onChange={e => setBcFormYear(e.target.value)}
                style={styles.input} min="2020" max="2099" />
            </div>
            <div>
              <label style={styles.label}>Description</label>
              <input value={bcFormDesc} onChange={e => setBcFormDesc(e.target.value)}
                placeholder="Optional label…" style={styles.input} />
            </div>
          </div>
          {bcFormProject && bcFormType && previewProject && (
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.textSec }}>Preview:</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.coral, fontFamily: "monospace", background: C.coralLight, padding: "2px 10px", borderRadius: 5 }}>
                {`${previewProject.project_code}-${bcFormType}-${bcFormYear}-XXX`}
              </span>
              <span style={{ fontSize: 11, color: C.textTer }}>Counter auto-assigned on save</span>
            </div>
          )}
          <button style={styles.btnPrimary} onClick={addBudgetCode} disabled={bcSaving}>
            {bcSaving ? "Adding…" : "+ Add budget code"}
          </button>
        </div>

        {/* Filter + list */}
        <div style={{ ...styles.card }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textPri }}>All budget codes</h3>
            <select value={bcFilterProject} onChange={e => setBcFilterProject(e.target.value)} style={{ ...styles.input, width: 240 }}>
              <option value="">All projects</option>
              {bcProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {bcLoading ? (
            <div style={{ fontSize: 13, color: C.textTer }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textTer }}>No budget codes found.</div>
          ) : (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.offWhite }}>
                    {["Code", "Project", "Type", "Year", "Description", "Status", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.textTer, fontSize: 11, letterSpacing: "0.03em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bc, i) => (
                    <tr key={bc.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", opacity: bc.is_active ? 1 : 0.55 }}>
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", fontWeight: 700, color: bc.is_active ? C.coral : C.textTer }}>{bc.code}</td>
                      <td style={{ padding: "11px 14px", color: C.textSec }}>{bc.projects?.name}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: C.coralLight, color: C.coral }}>{bc.type}</span>
                      </td>
                      <td style={{ padding: "11px 14px", color: C.textSec }}>{bc.year}</td>
                      <td style={{ padding: "11px 14px", color: C.textSec }}>{bc.description || "—"}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: bc.is_active ? C.greenBg : C.grayBg, color: bc.is_active ? C.greenText : C.textTer }}>
                          {bc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        {bc.is_active ? (
                          <button onClick={() => deactivateBudgetCode(bc.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.textTer, fontFamily: "inherit", textDecoration: "underline" }}
                            onMouseOver={e => e.currentTarget.style.color = C.redText}
                            onMouseOut={e => e.currentTarget.style.color = C.textTer}>Deactivate</button>
                        ) : (
                          <button onClick={() => reactivateBudgetCode(bc.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.textTer, fontFamily: "inherit", textDecoration: "underline" }}
                            onMouseOver={e => e.currentTarget.style.color = C.greenText}
                            onMouseOut={e => e.currentTarget.style.color = C.textTer}>Reactivate</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Import Preview Modal */}
      {bcShowImport && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 700, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>Import Preview</div>
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                {bcImportPreview.filter(r => r.valid).length} valid · {bcImportPreview.filter(r => !r.valid).length} with errors (errors will be skipped)
              </div>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.offWhite, position: "sticky", top: 0 }}>
                    {["Row", "Project Code", "Type", "Year", "Description", "Status"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.textTer, fontSize: 11, letterSpacing: "0.03em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bcImportPreview.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: r.valid ? "transparent" : "#FFF5F5" }}>
                      <td style={{ padding: "9px 14px", color: C.textTer }}>{r.row}</td>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", color: C.textPri }}>{r.projectCode}</td>
                      <td style={{ padding: "9px 14px", color: C.textPri }}>{r.type}</td>
                      <td style={{ padding: "9px 14px", color: C.textSec }}>{r.year}</td>
                      <td style={{ padding: "9px 14px", color: C.textSec }}>{r.description || "—"}</td>
                      <td style={{ padding: "9px 14px" }}>
                        {r.valid
                          ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: C.greenBg, color: C.greenText }}>✓ Valid</span>
                          : <span style={{ fontSize: 10, color: C.redText }}>{r.errors.join("; ")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8, background: C.offWhite }}>
              <button style={styles.btnSecondary} onClick={() => { setBcShowImport(false); setBcImportPreview([]); }}>Cancel</button>
              <button style={styles.btnPrimary} onClick={confirmImport} disabled={bcImporting || bcImportPreview.filter(r => r.valid).length === 0}>
                {bcImporting ? "Importing…" : `Import ${bcImportPreview.filter(r => r.valid).length} codes`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({ profile }) {
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loadingBU, setLoadingBU] = useState(true);
  const [newBU, setNewBU] = useState("");
  const [savingBU, setSavingBU] = useState(false);
  const [leadTimeStandard, setLeadTimeStandard] = useState("45");
  const [leadTimeRush, setLeadTimeRush] = useState("30");
  const [savingLT, setSavingLT] = useState(false);
  const [ltSaved, setLtSaved] = useState(false);
  const [groupManagers, setGroupManagers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [savingGM, setSavingGM] = useState(false);

  const canManage = profile?.is_admin === true;
  const isSuperAdmin = profile?.is_admin === true;
  const canManageBudgetCodes = profile?.is_admin === true;

  // Budget codes state
  const [bcProjects, setBcProjects] = useState([]);
  const [bcCodes, setBcCodes]       = useState([]);
  const [bcFilterProject, setBcFilterProject] = useState("");
  const [bcFormProject, setBcFormProject]     = useState("");
  const [bcFormType, setBcFormType]           = useState("");
  const [bcFormYear, setBcFormYear]           = useState(String(new Date().getFullYear()));
  const [bcFormDesc, setBcFormDesc]           = useState("");
  const [bcSaving, setBcSaving]               = useState(false);
  const [bcLoading, setBcLoading]             = useState(false);

  const [classRules, setClassRulesState] = useState(DEFAULT_CLASS_RULES);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  // Field requirements config state
  const DEFAULT_VENDOR_TYPES = ["Contractor", "Supplier / Dealer", "Service Provider", "Equipment Rental"];
  const [fieldReqTypes, setFieldReqTypes]   = useState(DEFAULT_VENDOR_TYPES);
  const [fieldReqByType, setFieldReqByType] = useState({});
  const [fieldReqActiveType, setFieldReqActiveType] = useState(DEFAULT_VENDOR_TYPES[0]);
  const [savingFieldReqs, setSavingFieldReqs] = useState(false);
  const [fieldReqsSaved, setFieldReqsSaved]   = useState(false);
  const [newVendorTypeInput, setNewVendorTypeInput] = useState("");

  // Trade categories state
  const [tradeCategories, setTradeCategories] = useState([]);
  const [loadingTC, setLoadingTC] = useState(false);
  const [newTC, setNewTC] = useState("");
  const [savingTC, setSavingTC] = useState(false);

  useEffect(() => { fetchBusinessUnits(); fetchLeadTimes(); fetchGroupManagers(); fetchAllUsers(); fetchClassRulesSettings(); fetchFieldReqsSettings(); fetchBudgetCodeData(); fetchTradeCategories(); }, []);

  const fetchBudgetCodeData = async () => {
    setBcLoading(true);
    const { data: projects } = await supabase.from("projects").select("id, name, project_code").eq("status", "active").order("name");
    if (projects) setBcProjects(projects);
    const { data: codes } = await supabase.from("budget_codes").select("*, projects(name, project_code)").order("created_at", { ascending: false });
    if (codes) setBcCodes(codes);
    setBcLoading(false);
  };

  const addBudgetCode = async () => {
    if (!bcFormProject) { alert("Please select a project."); return; }
    if (!bcFormType)    { alert("Please select a budget type."); return; }
    const project = bcProjects.find(p => p.id === parseInt(bcFormProject));
    const year = parseInt(bcFormYear) || new Date().getFullYear();
    const { data: existing } = await supabase.from("budget_codes").select("counter")
      .eq("project_id", parseInt(bcFormProject)).eq("type", bcFormType).eq("year", year)
      .order("counter", { ascending: false }).limit(1);
    const nextCounter = existing && existing.length > 0 ? existing[0].counter + 1 : 1;
    const code = `${project.project_code}-${bcFormType}-${year}-${String(nextCounter).padStart(3, "0")}`;
    setBcSaving(true);
    const { error } = await supabase.from("budget_codes").insert({
      project_id: parseInt(bcFormProject), code, type: bcFormType, year, counter: nextCounter,
      description: bcFormDesc.trim() || null, is_active: true,
    });
    if (error) { alert("Error: " + error.message); setBcSaving(false); return; }
    setBcFormProject(""); setBcFormType(""); setBcFormYear(String(new Date().getFullYear())); setBcFormDesc("");
    setBcSaving(false);
    fetchBudgetCodeData();
  };

  const deactivateBudgetCode = async (id) => {
    await supabase.from("budget_codes").update({ is_active: false }).eq("id", id);
    fetchBudgetCodeData();
  };

  const reactivateBudgetCode = async (id) => {
    await supabase.from("budget_codes").update({ is_active: true }).eq("id", id);
    fetchBudgetCodeData();
  };

  const fetchClassRulesSettings = async () => {
    const { data } = await supabase.from("settings").select("value").eq("key", "classification_rules").maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        setClassRulesState({ ...DEFAULT_CLASS_RULES, ...parsed, classC: parsed.classC || DEFAULT_CLASS_RULES.classC });
      } catch { setClassRulesState(DEFAULT_CLASS_RULES); }
    }
  };

  const saveClassRules = async () => {
    setSavingRules(true);
    const json = JSON.stringify(classRules);
    const { data: existing } = await supabase.from("settings").select("key").eq("key", "classification_rules").maybeSingle();
    if (existing) {
      await supabase.from("settings").update({ value: json }).eq("key", "classification_rules");
    } else {
      await supabase.from("settings").insert({ key: "classification_rules", value: json });
    }
    setSavingRules(false); setRulesSaved(true); setTimeout(() => setRulesSaved(false), 2500);
  };

  const toggleDoc = (tier, docName) => {
    setClassRulesState(prev => {
      if (tier === "return") {
        const has = prev.returnTriggerDocs.includes(docName);
        return { ...prev, returnTriggerDocs: has ? prev.returnTriggerDocs.filter(d => d !== docName) : [...prev.returnTriggerDocs, docName] };
      }
      const key = tier === "A" ? "classA" : tier === "B" ? "classB" : "classC";
      const has = prev[key].requiredDocs.includes(docName);
      return { ...prev, [key]: { ...prev[key], requiredDocs: has ? prev[key].requiredDocs.filter(d => d !== docName) : [...prev[key].requiredDocs, docName] } };
    });
  };

  const fetchFieldReqsSettings = async () => {
    const { data } = await supabase.from("settings").select("value").eq("key", "accreditation_field_requirements").maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (parsed.types?.length) { setFieldReqTypes(parsed.types); setFieldReqActiveType(parsed.types[0]); }
        setFieldReqByType(parsed.by_type || {});
      } catch {}
    }
  };

  const saveFieldReqs = async () => {
    setSavingFieldReqs(true);
    const payload = JSON.stringify({ types: fieldReqTypes, by_type: fieldReqByType });
    const { data: existing } = await supabase.from("settings").select("key").eq("key", "accreditation_field_requirements").maybeSingle();
    if (existing) {
      await supabase.from("settings").update({ value: payload }).eq("key", "accreditation_field_requirements");
    } else {
      await supabase.from("settings").insert({ key: "accreditation_field_requirements", value: payload });
    }
    setSavingFieldReqs(false); setFieldReqsSaved(true); setTimeout(() => setFieldReqsSaved(false), 2500);
  };

  const toggleFieldReq = (type, fieldKey) => {
    setFieldReqByType(prev => ({
      ...prev,
      [type]: { ...(prev[type] || {}), [fieldKey]: !(prev[type]?.[fieldKey]) },
    }));
  };

  const addVendorType = () => {
    const name = newVendorTypeInput.trim();
    if (!name || fieldReqTypes.includes(name)) return;
    setFieldReqTypes(prev => [...prev, name]);
    setNewVendorTypeInput("");
  };

  const removeVendorType = (name) => {
    setFieldReqTypes(prev => prev.filter(t => t !== name));
    setFieldReqByType(prev => { const next = { ...prev }; delete next[name]; return next; });
    if (fieldReqActiveType === name) setFieldReqActiveType(fieldReqTypes.find(t => t !== name) || "");
  };

  const fetchReviewers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").eq("position", "Commercial Officer").eq("is_active", true).order("full_name");
    if (data) setAllReviewers(data);
  };

  const fetchBusinessUnits = async () => {
    setLoadingBU(true);
    const { data } = await supabase.from("business_units").select("*").order("name");
    if (data) setBusinessUnits(data);
    setLoadingBU(false);
  };

  const fetchLeadTimes = async () => {
    const { data } = await supabase.from("settings").select("*");
    if (data) {
      const std = data.find(s => s.key === "lead_time_standard");
      const rush = data.find(s => s.key === "lead_time_rush");
      if (std) setLeadTimeStandard(std.value);
      if (rush) setLeadTimeRush(rush.value);
    }
  };

  const fetchGroupManagers = async () => {
    const { data } = await supabase.from("group_managers").select("id, profile_id, profiles (id, full_name, position)").order("id");
    if (data) setGroupManagers(data);
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, position, is_admin").order("full_name");
    if (data) setAllUsers(data);
  };

  const addBusinessUnit = async () => {
    if (!newBU.trim()) return;
    setSavingBU(true);
    await supabase.from("business_units").insert({ name: newBU.trim() });
    setNewBU(""); await fetchBusinessUnits(); setSavingBU(false);
  };

  const deleteBusinessUnit = async (id) => {
    if (!confirm("Remove this business unit?")) return;
    await supabase.from("business_units").delete().eq("id", id);
    fetchBusinessUnits();
  };

  const saveLeadTimes = async () => {
    setSavingLT(true);
    const errors = [];
    for (const [key, value] of [
      ["lead_time_standard", String(leadTimeStandard)],
      ["lead_time_rush",     String(leadTimeRush)],
    ]) {
      const { data: existing, error: fetchErr } = await supabase.from("settings").select("key").eq("key", key).maybeSingle();
      if (fetchErr) { errors.push(`Fetch ${key}: ${fetchErr.message}`); continue; }
      if (existing) {
        const { error: updErr } = await supabase.from("settings").update({ value }).eq("key", key);
        if (updErr) errors.push(`Update ${key}: ${updErr.message}`);
      } else {
        const { error: insErr } = await supabase.from("settings").insert({ key, value });
        if (insErr) errors.push(`Insert ${key}: ${insErr.message}`);
      }
    }
    setSavingLT(false);
    if (errors.length > 0) { alert("Save failed:\n" + errors.join("\n")); return; }
    setLtSaved(true); setTimeout(() => setLtSaved(false), 2500);
  };

  const addGroupManager = async () => {
    if (!selectedUserId) { alert("Please select a user."); return; }
    const already = groupManagers.find(gm => gm.profiles?.id === selectedUserId);
    if (already) { alert("This user is already in the Managers list."); return; }
    setSavingGM(true);
    await supabase.from("group_managers").insert({ profile_id: selectedUserId });
    setSelectedUserId(""); await fetchGroupManagers(); setSavingGM(false);
  };

  const removeGroupManager = async (id) => {
    if (!confirm("Remove this Manager from the list?")) return;
    await supabase.from("group_managers").delete().eq("id", id);
    fetchGroupManagers();
  };

  const availableUsers = allUsers.filter(u => !groupManagers.find(gm => gm.profiles?.id === u.id));

  // Settings left-nav section state
  const [settingsSection, setSettingsSection] = useState("business_units");

  // Business unit inline-edit state
  const [editingBUId, setEditingBUId] = useState(null);
  const [editingBUName, setEditingBUName] = useState("");

  // Logo upload / remove / rename functions
  const uploadBULogo = async (id, file) => {
    const path = `business-unit-logos/${id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("pr-documents").upload(path, file, { upsert: true });
    if (upErr) { alert("Upload failed: " + upErr.message); return; }
    const { data: urlData } = supabase.storage.from("pr-documents").getPublicUrl(path);
    const publicUrl = urlData?.publicUrl;
    await supabase.from("business_units").update({ logo_url: publicUrl }).eq("id", id);
    fetchBusinessUnits();
  };

  const removeBULogo = async (id) => {
    await supabase.from("business_units").update({ logo_url: null }).eq("id", id);
    fetchBusinessUnits();
  };

  const renameBU = async (id, name) => {
    if (!name.trim()) return;
    await supabase.from("business_units").update({ name: name.trim() }).eq("id", id);
    setEditingBUId(null);
    setEditingBUName("");
    fetchBusinessUnits();
  };

  // Trade category functions
  const fetchTradeCategories = async () => {
    setLoadingTC(true);
    const { data } = await supabase.from("trade_categories").select("*").order("is_approved", { ascending: false }).order("display_order").order("name");
    setTradeCategories(data || []);
    setLoadingTC(false);
  };

  const addTradeCategory = async () => {
    if (!newTC.trim()) return;
    setSavingTC(true);
    await supabase.from("trade_categories").insert({ name: newTC.trim(), is_approved: true });
    setNewTC("");
    await fetchTradeCategories();
    setSavingTC(false);
  };

  const approveTradeCategory = async (id) => {
    await supabase.from("trade_categories").update({ is_approved: true, suggested_by_vendor_id: null }).eq("id", id);
    fetchTradeCategories();
  };

  const deleteTradeCategory = async (id) => {
    await supabase.from("trade_categories").delete().eq("id", id);
    fetchTradeCategories();
  };

  // Nav items for left pane
  const settingsNavItems = [
    { key: "general",          label: "General" },
    { key: "group_managers",   label: "Managers" },
    { key: "business_units",   label: "Business Units" },
    { key: "trade_categories", label: "Trade Categories" },
    ...(isSuperAdmin ? [{ key: "class_rules", label: "Classification Rules" }] : []),
    ...(isSuperAdmin ? [{ key: "field_requirements", label: "Field Requirements" }] : []),
  ];

  return (
    <>
      <div style={styles.topBar}>
                <div style={{ flex: 1 }} />
      </div>

      <div style={{ ...styles.pageBody, display: "flex", gap: 0, alignItems: "flex-start", maxWidth: "none", padding: 0 }}>

        {/* Left nav pane */}
        <div style={{ width: 200, flexShrink: 0, padding: "16px 0", borderRight: `1px solid ${C.border}`, minHeight: "calc(100vh - 60px)", position: "sticky", top: 0, background: "white" }}>
          {settingsNavItems.map(item => {
            const active = settingsSection === item.key;
            return (
              <button key={item.key} onClick={() => setSettingsSection(item.key)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 20px", background: active ? C.coralLight : "none", border: "none", borderLeft: active ? `3px solid ${C.coral}` : "3px solid transparent", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.coral : C.textPri, transition: "background 0.12s" }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = C.offWhite; }}
                onMouseOut={e => { if (!active) e.currentTarget.style.background = "none"; }}>
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, padding: "20px 28px", maxWidth: 720 }}>

          {/* General — Lead time configuration */}
          {settingsSection === "general" && (
            <div style={{ ...styles.card, marginBottom: 16 }}>
              <h3 style={styles.cardTitle}>Lead time configuration</h3>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>Controls the minimum number of days required from PR submission to the requested start date.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={styles.label}>Standard lead time (days)</label>
                  <input type="number" min="1" value={leadTimeStandard} onChange={e => setLeadTimeStandard(e.target.value)} disabled={!canManage}
                    style={{ ...styles.input, ...(canManage ? {} : styles.inputDisabled) }}
                    onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                  <p style={styles.hint}>Minimum days from PR submission to requested start date.</p>
                </div>
                <div>
                  <label style={styles.label}>Rush lead time (days)</label>
                  <input type="number" min="1" value={leadTimeRush} onChange={e => setLeadTimeRush(e.target.value)} disabled={!canManage}
                    style={{ ...styles.input, ...(canManage ? {} : styles.inputDisabled) }}
                    onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                  <p style={styles.hint}>Applied when a PR is flagged as rush.</p>
                </div>
              </div>
              {canManage && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button style={styles.btnPrimary} onClick={saveLeadTimes} disabled={savingLT}>{savingLT ? "Saving…" : "Save lead times"}</button>
                  {ltSaved && <span style={{ fontSize: 12, color: C.greenText, fontWeight: 500 }}>✓ Saved successfully</span>}
                </div>
              )}
            </div>
          )}

          {/* Group Managers */}
          {settingsSection === "group_managers" && (
            <div style={{ ...styles.card, marginBottom: 16 }}>
              <h3 style={styles.cardTitle}>Managers</h3>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>These users appear in the Manager dropdown when creating a PR.</p>
              {canManage && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} style={{ ...styles.input, flex: 1 }}>
                    <option value="">Select a Manager…</option>
                    {availableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.position || "—"})</option>)}
                  </select>
                  <button style={styles.btnPrimary} onClick={addGroupManager} disabled={savingGM}>{savingGM ? "Adding…" : "Add"}</button>
                </div>
              )}
              {groupManagers.length === 0 ? (
                <div style={{ fontSize: 13, color: C.textTer, padding: "12px 0" }}>No Managers added yet.</div>
              ) : (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                  {groupManagers.map((gm, i) => (
                    <div key={gm.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < groupManagers.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.15s" }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.coralMid, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: C.coral }}>
                          {gm.profiles?.full_name?.split(" ").map(w => w[0]).slice(0,2).join("") || "?"}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: C.textPri, fontWeight: 500 }}>{gm.profiles?.full_name || "Unknown"}</div>
                          <div style={{ fontSize: 11, color: C.textTer }}>{gm.profiles?.position || "—"}</div>
                        </div>
                      </div>
                      {canManage && (
                        <button onClick={() => removeGroupManager(gm.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, padding: 4, display: "flex", alignItems: "center" }}
                          onMouseOver={e => e.currentTarget.style.color = C.redText}
                          onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Business Units */}
          {settingsSection === "business_units" && (
            <div style={{ ...styles.card, marginBottom: 16 }}>
              <h3 style={styles.cardTitle}>Business units</h3>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>These appear as options when creating or editing projects. Upload a logo for each unit to display it across the app.</p>
              {canManage && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input value={newBU} onChange={e => setNewBU(e.target.value)} placeholder="New business unit name…" style={{ ...styles.input, flex: 1 }}
                    onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border}
                    onKeyDown={e => e.key === "Enter" && addBusinessUnit()} />
                  <button style={styles.btnPrimary} onClick={addBusinessUnit} disabled={savingBU}>{savingBU ? "Adding…" : "Add"}</button>
                </div>
              )}
              {loadingBU ? (
                <div style={{ fontSize: 13, color: C.textTer }}>Loading…</div>
              ) : businessUnits.length === 0 ? (
                <div style={{ fontSize: 13, color: C.textTer }}>No business units yet.</div>
              ) : (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                  {businessUnits.map((bu, i) => (
                    <div key={bu.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i < businessUnits.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.15s" }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      {/* Logo thumbnail */}
                      {bu.logo_url ? (
                        <img src={bu.logo_url} alt={bu.name} style={{ width: 40, height: 24, objectFit: "contain", borderRadius: 4, flexShrink: 0, border: `1px solid ${C.border}` }} />
                      ) : (
                        <div style={{ width: 40, height: 24, background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 8, color: C.textTer, whiteSpace: "nowrap" }}>No logo</span>
                        </div>
                      )}
                      {/* BU name — inline editable */}
                      {editingBUId === bu.id ? (
                        <input
                          autoFocus
                          value={editingBUName}
                          onChange={e => setEditingBUName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") renameBU(bu.id, editingBUName); if (e.key === "Escape") { setEditingBUId(null); setEditingBUName(""); } }}
                          onBlur={() => renameBU(bu.id, editingBUName)}
                          style={{ ...styles.input, flex: 1, padding: "4px 8px", fontSize: 13 }} />
                      ) : (
                        <span
                          title="Click to rename"
                          onClick={() => { setEditingBUId(bu.id); setEditingBUName(bu.name); }}
                          style={{ flex: 1, fontSize: 13, color: C.textPri, cursor: "text", userSelect: "none" }}>
                          {bu.name}
                        </span>
                      )}
                      {/* Action buttons */}
                      {canManage && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {/* Upload logo */}
                          <label title="Upload logo" style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
                              onChange={e => { if (e.target.files?.[0]) uploadBULogo(bu.id, e.target.files[0]); e.target.value = ""; }} />
                            <span style={{ fontSize: 11, color: C.coral, fontWeight: 500, padding: "3px 8px", border: `1px solid ${C.coral}`, borderRadius: 6, background: C.coralLight, whiteSpace: "nowrap" }}>
                              Upload logo
                            </span>
                          </label>
                          {/* Remove logo */}
                          {bu.logo_url && (
                            <button title="Remove logo" onClick={() => removeBULogo(bu.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, padding: 4, display: "flex", alignItems: "center", fontSize: 13 }}
                              onMouseOver={e => e.currentTarget.style.color = C.redText}
                              onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                              ×
                            </button>
                          )}
                          {/* Delete BU */}
                          <button onClick={() => deleteBusinessUnit(bu.id)} title="Delete business unit"
                            style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, padding: 4, display: "flex", alignItems: "center" }}
                            onMouseOver={e => e.currentTarget.style.color = C.redText}
                            onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trade Categories */}
          {settingsSection === "trade_categories" && (
            <div style={{ ...styles.card, marginBottom: 16 }}>
              <h3 style={styles.cardTitle}>Trade categories</h3>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>Vendors select their trade(s) from this list when applying for accreditation. Vendor-suggested trades appear below for review.</p>
              {canManage && (
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  <input value={newTC} onChange={e => setNewTC(e.target.value)} placeholder="New trade category…" style={{ ...styles.input, flex: 1 }}
                    onKeyDown={e => e.key === "Enter" && addTradeCategory()} />
                  <button style={styles.btnPrimary} onClick={addTradeCategory} disabled={savingTC}>{savingTC ? "Adding…" : "Add"}</button>
                </div>
              )}

              {/* Approved list */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Primary list</div>
              {loadingTC ? (
                <div style={{ fontSize: 13, color: C.textTer }}>Loading…</div>
              ) : tradeCategories.filter(t => t.is_approved).length === 0 ? (
                <div style={{ fontSize: 13, color: C.textTer, marginBottom: 16 }}>No categories yet.</div>
              ) : (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
                  {tradeCategories.filter(t => t.is_approved).map((tc, i, arr) => (
                    <div key={tc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ flex: 1, fontSize: 13, color: C.textPri }}>{tc.name}</span>
                      {canManage && (
                        <button onClick={() => deleteTradeCategory(tc.id)} title="Delete"
                          style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, padding: 4, display: "flex", alignItems: "center" }}
                          onMouseOver={e => e.currentTarget.style.color = C.redText}
                          onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Vendor-suggested (unapproved) */}
              {tradeCategories.filter(t => !t.is_approved).length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.amberText, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Suggested by vendors</div>
                  <div style={{ border: `1px solid ${C.amberText}40`, borderRadius: 10, overflow: "hidden", background: C.amberBg }}>
                    {tradeCategories.filter(t => !t.is_approved).map((tc, i, arr) => (
                      <div key={tc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${C.amberText}30` : "none" }}>
                        <span style={{ flex: 1, fontSize: 13, color: C.textPri }}>{tc.name}</span>
                        {tc.suggested_by_vendor_id && <span style={{ fontSize: 11, color: C.textTer }}>by {tc.suggested_by_vendor_id}</span>}
                        {canManage && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => approveTradeCategory(tc.id)}
                              style={{ fontSize: 11, fontWeight: 600, color: "#15803D", background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                              Add to primary list
                            </button>
                            <button onClick={() => deleteTradeCategory(tc.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, padding: 4, display: "flex", alignItems: "center" }}
                              onMouseOver={e => e.currentTarget.style.color = C.redText}
                              onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Classification Rules — Super Admin only */}
          {settingsSection === "class_rules" && isSuperAdmin && (
            <div style={{ ...styles.card, marginBottom: 16 }}>
              <h3 style={styles.cardTitle}>Vendor classification rules</h3>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>
                Define which documents are required for each vendor class and the minimum number of total documents. The system uses these rules to auto-suggest a classification when reviewing a vendor.
              </p>

              {[
                { tier: "A", label: "Class A", sublabel: "Premium tier — highest requirements", color: C.greenText, bg: C.greenBg, key: "classA" },
                { tier: "B", label: "Class B", sublabel: "Standard tier", color: C.tealText, bg: C.tealBg, key: "classB" },
                { tier: "C", label: "Class C", sublabel: "Entry tier — minimum requirements", color: "#7C3AED", bg: "#EDE9FE", key: "classC" },
              ].map(({ tier, label, sublabel, color, bg, key }) => (
                <div key={tier} style={{ border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ background: bg, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
                      <span style={{ fontSize: 11, color: C.textSec, marginLeft: 8 }}>{sublabel}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: C.textSec }}>Min. total docs:</span>
                      <input type="number" min="1" max="21" value={classRules[key].minDocCount}
                        onChange={e => setClassRulesState(prev => ({ ...prev, [key]: { ...prev[key], minDocCount: parseInt(e.target.value) || 1 } }))}
                        style={{ ...styles.input, width: 64, padding: "4px 8px", fontSize: 12 }} />
                      <span style={{ fontSize: 11, color: C.textTer }}>/ 21</span>
                    </div>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 8 }}>Required documents (all must be uploaded):</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {REQUIRED_DOCS.map(doc => (
                        <label key={doc} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12, color: C.textPri }}>
                          <input type="checkbox" checked={classRules[key].requiredDocs.includes(doc)}
                            onChange={() => toggleDoc(tier, doc)} />
                          {doc}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ background: C.amberBg, padding: "10px 16px" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.amberText }}>Return to Vendor trigger</span>
                  <span style={{ fontSize: 11, color: C.textSec, marginLeft: 8 }}>If any of these are missing, system will recommend returning the application</span>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {REQUIRED_DOCS.map(doc => (
                      <label key={doc} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12, color: C.textPri }}>
                        <input type="checkbox" checked={classRules.returnTriggerDocs.includes(doc)}
                          onChange={() => toggleDoc("return", doc)} />
                        {doc}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button style={styles.btnPrimary} onClick={saveClassRules} disabled={savingRules}>{savingRules ? "Saving…" : "Save classification rules"}</button>
                {rulesSaved && <span style={{ fontSize: 12, color: C.greenText, fontWeight: 500 }}>✓ Saved successfully</span>}
              </div>
            </div>
          )}

          {/* Accreditation Field Requirements — Super Admin only */}
          {settingsSection === "field_requirements" && isSuperAdmin && (() => {
            const FIELD_GROUPS = [
              { group: "Company Info", fields: [
                { key: "satellite_address",  label: "Satellite / Branch Address" },
                { key: "telephone",          label: "Telephone" },
                { key: "contact_position",   label: "Contact Position" },
                { key: "representative_title", label: "Representative Title" },
                { key: "location_map_url",   label: "Location Map URL" },
              ]},
              { group: "Key Contacts", fields: [
                { key: "key_contacts.president",          label: "President" },
                { key: "key_contacts.accounting_manager", label: "Accounting Manager" },
                { key: "key_contacts.sales_manager",      label: "Sales Manager" },
                { key: "key_contacts.delivery_incharge",  label: "Delivery In-charge" },
                { key: "key_contacts.technical_incharge", label: "Technical In-charge" },
              ]},
              { group: "Tax Information", fields: [
                { key: "tin",               label: "TIN (Tax Identification Number)" },
                { key: "tax_classification", label: "Tax Classification (VAT / Non-VAT)" },
                { key: "registration_type", label: "Registration Type (DTI / SEC)" },
                { key: "ewt_entries",       label: "EWT Entries" },
              ]},
              { group: "Bank Details", fields: [
                { key: "bank_details", label: "Bank Details (all four fields as a group)" },
              ]},
              { group: "Company Structure", fields: [
                { key: "num_employees", label: "Number of Employees" },
                { key: "is_subsidiary", label: "Subsidiary / Ownership Status" },
              ]},
              { group: "Compliance", fields: [
                { key: "compliance.has_hs_adviser",    label: "H&S Adviser Status" },
                { key: "compliance.has_hs_policy",     label: "H&S Policy Manual" },
                { key: "compliance.has_qms",           label: "Quality Management System (QMS)" },
                { key: "compliance.has_env_management", label: "Environmental Management" },
              ]},
              { group: "Declaration", fields: [
                { key: "signatories", label: "Signatories (Sales Manager & President)" },
              ]},
            ];

            const activeReqs = fieldReqByType[fieldReqActiveType] || {};

            return (
              <div style={{ ...styles.card, marginBottom: 16 }}>
                <h3 style={styles.cardTitle}>Accreditation field requirements</h3>
                <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>
                  Configure which fields are required for each vendor type. Vendors select their type at the start of the form and are validated accordingly. Always-required fields (company name, address, mobile, contact person, authorized representative, email, trade) are not listed here.
                </p>

                {/* Vendor types tab row */}
                <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
                  {fieldReqTypes.map(t => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      <button
                        onClick={() => setFieldReqActiveType(t)}
                        style={{
                          padding: "6px 14px", borderRadius: fieldReqTypes.indexOf(t) === fieldReqTypes.length - 1 || true ? "8px 0 0 8px" : "8px 0 0 8px",
                          border: `1.5px solid ${fieldReqActiveType === t ? C.coral : C.border}`,
                          borderRight: "none",
                          background: fieldReqActiveType === t ? C.coralLight : C.white,
                          color: fieldReqActiveType === t ? C.coral : C.textSec,
                          fontWeight: 600, fontSize: 12, cursor: "pointer",
                        }}>
                        {t}
                      </button>
                      <button
                        onClick={() => removeVendorType(t)}
                        title={`Remove ${t}`}
                        style={{
                          padding: "6px 8px", borderRadius: "0 8px 8px 0",
                          border: `1.5px solid ${fieldReqActiveType === t ? C.coral : C.border}`,
                          background: fieldReqActiveType === t ? C.coralLight : C.white,
                          color: C.textTer, fontSize: 11, cursor: "pointer",
                        }}>
                        ×
                      </button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
                    <input
                      value={newVendorTypeInput}
                      onChange={e => setNewVendorTypeInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addVendorType()}
                      placeholder="New type…"
                      style={{ ...styles.input, width: 120, padding: "5px 10px", fontSize: 12 }}
                    />
                    <button onClick={addVendorType} style={{ ...styles.btnSecondary, fontSize: 12, padding: "5px 12px" }}>+ Add</button>
                  </div>
                </div>

                {/* Field toggles for active type */}
                {fieldReqActiveType && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {FIELD_GROUPS.map(({ group, fields }) => (
                      <div key={group}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{group}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {fields.map(({ key, label }) => (
                            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.textPri, padding: "6px 10px", borderRadius: 8, border: `1px solid ${activeReqs[key] ? C.coral : C.border}`, background: activeReqs[key] ? C.coralLight : C.white }}>
                              <input type="checkbox" checked={!!activeReqs[key]} onChange={() => toggleFieldReq(fieldReqActiveType, key)} />
                              <span>{label}</span>
                              {activeReqs[key] && <span style={{ marginLeft: "auto", fontSize: 11, color: C.coral, fontWeight: 700 }}>Required</span>}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
                  <button style={styles.btnPrimary} onClick={saveFieldReqs} disabled={savingFieldReqs}>
                    {savingFieldReqs ? "Saving…" : "Save field requirements"}
                  </button>
                  {fieldReqsSaved && <span style={{ fontSize: 12, color: C.greenText, fontWeight: 500 }}>✓ Saved successfully</span>}
                </div>
              </div>
            );
          })()}

          {/* Budget Codes */}
          {settingsSection === "budget_codes" && (
            <div style={{ ...styles.card, marginBottom: 16 }}>
              <h3 style={styles.cardTitle}>Budget codes</h3>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>Generate and manage budget codes for projects. Codes are auto-sequenced per project, type, and year.</p>

              {canManageBudgetCodes && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20, background: C.offWhite }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 12 }}>Add new budget code</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={styles.label}>Project</label>
                      <select value={bcFormProject} onChange={e => setBcFormProject(e.target.value)} style={{ ...styles.input }}>
                        <option value="">Select project…</option>
                        {bcProjects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.project_code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={styles.label}>Budget type</label>
                      <select value={bcFormType} onChange={e => setBcFormType(e.target.value)} style={{ ...styles.input }}>
                        <option value="">Select type…</option>
                        {["OPEX", "CAPEX", "GRANT", "OTHER"].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={styles.label}>Year</label>
                      <input type="number" value={bcFormYear} onChange={e => setBcFormYear(e.target.value)} style={{ ...styles.input }}
                        onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={styles.label}>Description (optional)</label>
                    <input value={bcFormDesc} onChange={e => setBcFormDesc(e.target.value)} placeholder="Brief description…" style={{ ...styles.input }}
                      onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                  </div>
                  <button style={styles.btnPrimary} onClick={addBudgetCode} disabled={bcSaving}>{bcSaving ? "Creating…" : "Create budget code"}</button>
                </div>
              )}

              {/* Filter */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                <label style={{ ...styles.label, margin: 0, whiteSpace: "nowrap" }}>Filter by project:</label>
                <select value={bcFilterProject} onChange={e => setBcFilterProject(e.target.value)} style={{ ...styles.input, flex: 1 }}>
                  <option value="">All projects</option>
                  {bcProjects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              </div>

              {bcLoading ? (
                <div style={{ fontSize: 13, color: C.textTer }}>Loading…</div>
              ) : bcCodes.filter(c => !bcFilterProject || String(c.project_id) === bcFilterProject).length === 0 ? (
                <div style={{ fontSize: 13, color: C.textTer }}>No budget codes found.</div>
              ) : (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 1fr 80px", gap: 8, padding: "8px 14px", background: C.offWhite, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textSec }}>
                    <span>Code</span>
                    <span>Type</span>
                    <span>Year</span>
                    <span>Description</span>
                    <span>Status</span>
                  </div>
                  {bcCodes
                    .filter(c => !bcFilterProject || String(c.project_id) === bcFilterProject)
                    .map((c, i, arr) => (
                      <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 1fr 80px", gap: 8, padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "center", transition: "background 0.15s" }}
                        onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.textPri, fontFamily: "monospace" }}>{c.code}</span>
                        <span style={{ fontSize: 12, color: C.textSec }}>{c.type}</span>
                        <span style={{ fontSize: 12, color: C.textSec }}>{c.year}</span>
                        <span style={{ fontSize: 12, color: C.textTer }}>{c.description || "—"}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: c.is_active ? C.greenBg : C.grayBg, color: c.is_active ? C.greenText : C.textTer }}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                          {canManageBudgetCodes && (
                            c.is_active
                              ? <button onClick={() => deactivateBudgetCode(c.id)} title="Deactivate" style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 11, padding: 2 }}
                                  onMouseOver={e => e.currentTarget.style.color = C.redText}
                                  onMouseOut={e => e.currentTarget.style.color = C.textTer}>Off</button>
                              : <button onClick={() => reactivateBudgetCode(c.id)} title="Reactivate" style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 11, padding: 2 }}
                                  onMouseOver={e => e.currentTarget.style.color = C.greenText}
                                  onMouseOut={e => e.currentTarget.style.color = C.textTer}>On</button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ─── PLACEHOLDER PAGE ──────────────────────────────────────────────────────────
// ─── RFP HELPERS ──────────────────────────────────────────────────────────────
const RFP_STATUSES = ["Draft", "Open", "Closed"];
const RFP_STATUS_STYLE = {
  Draft:  { bg: C.grayBg,   color: C.grayText  },
  Open:   { bg: C.greenBg,  color: C.greenText  },
  Closed: { bg: C.redBg,    color: C.redText    },
};
function rfpBadge(status) {
  const s = RFP_STATUS_STYLE[status] || RFP_STATUS_STYLE.Draft;
  return { display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:600, background:s.bg, color:s.color };
}

// ─── RFPS PAGE ────────────────────────────────────────────────────────────────
function RFPsPage({ profile, setPage, setSelectedRFPId }) {
  const [rfps, setRfps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buFilter, setBuFilter] = useState([]);
  const [projectFilter, setProjectFilter] = useState([]);
  const [activeCard, setActiveCard] = useState(null);

  const rfpCardStatusMap = {
    "Draft":  ["Draft"],
    "Open":   ["Open"],
    "Closed": ["Closed"],
  };

  const canCreate = can(profile, "rfp.create");

  useEffect(() => { fetchRFPs(); }, []);

  const fetchRFPs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("rfps")
      .select("id, title, description, deadline, status, created_at, created_by, profiles!rfps_created_by_fkey(full_name)")
      .order("created_at", { ascending: false });
    if (!data) { setLoading(false); return; }

    const rfpIds = data.map(r => r.id);
    const [prLinks, vendorLinks] = await Promise.all([
      supabase.from("rfp_prs").select("rfp_id, purchase_requests(projects(name, business_unit))").in("rfp_id", rfpIds),
      supabase.from("rfp_vendors").select("rfp_id").in("rfp_id", rfpIds),
    ]);
    const prCount = {};
    const vendorCount = {};
    const rfpBUs = {};
    const rfpProjects = {};
    (prLinks.data || []).forEach(r => {
      prCount[r.rfp_id] = (prCount[r.rfp_id] || 0) + 1;
      const bu = r.purchase_requests?.projects?.business_unit;
      const proj = r.purchase_requests?.projects?.name;
      if (bu) { if (!rfpBUs[r.rfp_id]) rfpBUs[r.rfp_id] = new Set(); rfpBUs[r.rfp_id].add(bu); }
      if (proj) { if (!rfpProjects[r.rfp_id]) rfpProjects[r.rfp_id] = new Set(); rfpProjects[r.rfp_id].add(proj); }
    });
    (vendorLinks.data || []).forEach(r => { vendorCount[r.rfp_id] = (vendorCount[r.rfp_id] || 0) + 1; });

    setRfps(data.map(r => ({
      ...r,
      pr_count: prCount[r.id] || 0,
      vendor_count: vendorCount[r.id] || 0,
      linked_bus: rfpBUs[r.id] ? [...rfpBUs[r.id]] : [],
      linked_projects: rfpProjects[r.id] ? [...rfpProjects[r.id]] : [],
    })));
    setLoading(false);
  };

  const rfpBuOptions = [...new Set(rfps.flatMap(r => r.linked_bus || []))].sort();
  const rfpProjectOptions = [...new Set(
    rfps
      .filter(r => buFilter.length === 0 || buFilter.some(bu => (r.linked_bus || []).includes(bu)))
      .flatMap(r => r.linked_projects || [])
  )].sort();

  useEffect(() => {
    if (buFilter.length > 0) {
      setProjectFilter(prev => prev.filter(p => rfpProjectOptions.includes(p)));
    }
  }, [buFilter]);

  const rfpBase = rfps.filter(r =>
    (buFilter.length === 0 || buFilter.some(bu => (r.linked_bus || []).includes(bu))) &&
    (projectFilter.length === 0 || projectFilter.some(p => (r.linked_projects || []).includes(p)))
  );

  const filtered = rfpBase.filter(r => {
    const s = search.toLowerCase();
    const matchSearch = (r.title || "").toLowerCase().includes(s) || (r.description || "").toLowerCase().includes(s);
    const matchStatus = !activeCard || activeCard === "Total"
      ? true
      : (rfpCardStatusMap[activeCard] || []).includes(r.status);
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div style={styles.topBar}>
                <div style={{ flex: 1 }} />
        {canCreate && (
          <button style={styles.btnPrimary} onClick={() => setPage("rfp_create")}>+ Create RFP</button>
        )}
      </div>

      <div style={styles.pageBody}>
        <div style={{ maxWidth: "80%", margin: "0 auto" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
          {[
            { label: "Total",  value: rfpBase.length,                                          color: C.textPri,  desc: "All proposal requests"       },
            { label: "Draft",  value: rfpBase.filter(r => r.status === "Draft").length,  color: C.grayText, desc: "Not yet published"             },
            { label: "Open",   value: rfpBase.filter(r => r.status === "Open").length,   color: C.greenText,desc: "Accepting vendor proposals"    },
            { label: "Closed", value: rfpBase.filter(r => r.status === "Closed").length, color: C.redText,  desc: "Bidding period ended"          },
          ].map(s => {
            const isActive = activeCard === s.label;
            return (
              <div key={s.label}
                onClick={() => setActiveCard(prev => prev === s.label ? null : s.label)}
                style={{
                  background: isActive ? C.coralLight : C.white,
                  border: `1px solid ${isActive ? C.coral : C.border}`,
                  borderRadius: 12, padding: "14px 18px",
                  boxShadow: isActive ? `0 0 0 2px ${C.coralMid}` : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
                  cursor: "pointer", userSelect: "none",
                  transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
                }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.coralDark : C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Search and filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={13} color={C.textTer} /></div>
            <input placeholder="Search by title or description…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 30, fontSize: 12 }} />
          </div>
          <MultiSelect options={rfpBuOptions} value={buFilter} onChange={setBuFilter} placeholder="All Business Units" />
          <MultiSelect options={rfpProjectOptions} value={projectFilter} onChange={setProjectFilter} placeholder="All Projects" />
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)", overflow: "clip" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.coralMid }}>
                {["Title", "Status", "PRs Linked", "Vendors Invited", "Deadline", "Created By", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.coralDark, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.coralLight}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: C.textTer }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "48px 0", color: C.textTer }}>
                  No RFPs found.{canCreate && <> <span style={{ color: C.coral, cursor: "pointer" }} onClick={() => setPage("rfp_create")}>Create one</span>.</>}
                </td></tr>
              )}
              {!loading && filtered.map((r, i) => (
                <tr key={r.id} onClick={() => { setSelectedRFPId(r.id); setPage("rfp_detail"); }}
                  style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "9px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>{r.title}</div>
                    {r.description && <div style={{ fontSize: 11, color: C.textTer, marginTop: 2, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>}
                  </td>
                  <td style={{ padding: "9px 14px" }}><span style={rfpBadge(r.status)}>{r.status}</span></td>
                  <td style={{ padding: "9px 14px", color: C.textSec }}>{r.pr_count}</td>
                  <td style={{ padding: "9px 14px", color: C.textSec }}>{r.vendor_count}</td>
                  <td style={{ padding: "9px 14px", color: C.textSec, whiteSpace: "nowrap" }}>{r.deadline ? fmtShort(r.deadline) : "—"}</td>
                  <td style={{ padding: "9px 14px", color: C.textSec }}>{r.profiles?.full_name || "—"}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}><Icon name="chevronRight" size={13} color={C.textTer} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textTer }}>Showing {filtered.length} of {rfps.length} RFPs</span>
            <button onClick={fetchRFPs} style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }}>Refresh</button>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}

// ─── RFP CREATE PAGE ──────────────────────────────────────────────────────────
function RFPCreatePage({ profile, setPage }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");

  // PR selection
  const [approvedPRs, setApprovedPRs] = useState([]);
  const [selectedPRIds, setSelectedPRIds] = useState([]);
  const [previewPR, setPreviewPR] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [prWarnings, setPrWarnings] = useState({});   // prId → rfp title if already used

  // BOQ
  const [boqItems, setBoqItems] = useState([{ id: Date.now(), item_no: "1", description: "", qty: "", unit: "" }]);

  // Vendors
  const [vendors, setVendors] = useState([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [vendorSearch, setVendorSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("prs");
  const [titleDirty, setTitleDirty] = useState(false);
  const [descDirty, setDescDirty] = useState(false);

  useEffect(() => { fetchApprovedPRs(); fetchVendors(); }, []);

  const fetchApprovedPRs = async () => {
    const { data } = await supabase
      .from("purchase_requests")
      .select("id, pr_number, description, start_date, projects(name), profiles!purchase_requests_prepared_by_fkey(full_name)")
      .eq("status", "Approved")
      .order("created_at", { ascending: false });
    if (!data) return;

    // Check which PRs are already linked to an RFP
    const { data: existingLinks } = await supabase
      .from("rfp_prs")
      .select("pr_id, rfps(title)")
      .in("pr_id", data.map(p => p.pr_number));
    const warningMap = {};
    (existingLinks || []).forEach(l => { warningMap[l.pr_id] = l.rfps?.title || "another RFP"; });
    setPrWarnings(warningMap);
    setApprovedPRs(data);
  };

  const fetchVendors = async () => {
    const { data: vList } = await supabase
      .from("vendors")
      .select("id, vendor_code, accreditation_status, subcontractor_class, profile_id")
      .not("accreditation_status", "eq", "Draft")
      .order("created_at", { ascending: false });
    if (!vList) return;

    const profileIds = vList.map(v => v.profile_id);
    const { data: ciList } = await supabase
      .from("vendor_company_info")
      .select("vendor_id, company_name, primary_activity")
      .in("vendor_id", vList.map(v => vendorRef(v)));
    const ciMap = {};
    (ciList || []).forEach(c => { ciMap[c.vendor_id] = c; });
    setVendors(vList.map(v => ({ ...v, vendor_company_info: ciMap[vendorRef(v)] || null })));
  };

  const buildAutoFill = (ids) => {
    const selected = approvedPRs.filter(p => ids.includes(p.pr_number));
    if (selected.length === 0) return { title: "", description: "" };
    if (selected.length === 1) {
      return { title: selected[0].description || "", description: selected[0].description || "" };
    }
    return {
      title: selected.map(p => `${p.pr_number}: ${p.description || "No description"}`).join(" / "),
      description: selected.map(p => `${p.pr_number}: ${p.description || "No description"}`).join("\n"),
    };
  };

  useEffect(() => {
    if (selectedPRIds.length === 0) return;
    const { title: autoTitle, description: autoDesc } = buildAutoFill(selectedPRIds);
    if (!titleDirty) setTitle(autoTitle);
    if (!descDirty) setDescription(autoDesc);
  }, [selectedPRIds, approvedPRs]);

  const resetToAutoFill = () => {
    const { title: autoTitle, description: autoDesc } = buildAutoFill(selectedPRIds);
    setTitle(autoTitle);
    setDescription(autoDesc);
    setTitleDirty(false);
    setDescDirty(false);
  };

  const loadPRPreview = async (pr) => {
    setPreviewLoading(true);
    const { data: items } = await supabase.from("scope_items").select("*").eq("pr_id", pr.pr_number).order("sort_order");
    const { data: full } = await supabase
      .from("purchase_requests")
      .select("id, pr_number, description, justification, is_rush, rush_justification, start_date, end_date, projects(name, business_unit), profiles!purchase_requests_prepared_by_fkey(full_name)")
      .eq("pr_number", pr.pr_number).single();
    setPreviewPR({ ...full, scope_items: items || [] });
    setPreviewLoading(false);
  };

  const togglePR = (pr) => {
    const isSelected = selectedPRIds.includes(pr.pr_number);
    if (isSelected) {
      setSelectedPRIds(prev => prev.filter(id => id !== pr.pr_number));
      if (previewPR?.pr_number === pr.pr_number) setPreviewPR(null);
    } else {
      setSelectedPRIds(prev => [...prev, pr.pr_number]);
      loadPRPreview(pr);
    }
  };

  const addBoqRow = () => setBoqItems(prev => [...prev, { id: Date.now(), item_no: String(prev.length + 1), description: "", qty: "", unit: "" }]);
  const removeBoqRow = (id) => setBoqItems(prev => prev.filter(i => i.id !== id));
  const updateBoq = (id, field, val) => setBoqItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));

  const toggleVendor = (id) => setSelectedVendorIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  const toggleAllVendors = () => {
    const visible = filteredVendors.map(v => v.id);
    const allSelected = visible.every(id => selectedVendorIds.includes(id));
    setSelectedVendorIds(allSelected ? selectedVendorIds.filter(id => !visible.includes(id)) : [...new Set([...selectedVendorIds, ...visible])]);
  };

  const filteredVendors = vendors.filter(v => {
    const name = (v.vendor_company_info?.company_name || "").toLowerCase();
    return name.includes(vendorSearch.toLowerCase());
  });

  const saveRFP = async (publish = false) => {
    if (!title.trim()) { alert("Please enter a title for this RFP."); return; }
    if (selectedPRIds.length === 0) { alert("Please link at least one approved PR."); return; }
    setSaving(true);

    const { data: rfp, error } = await supabase.from("rfps").insert({
      title: title.trim(),
      description: description.trim() || null,
      deadline: deadline || null,
      status: publish ? "Open" : "Draft",
      created_by: profile.id,
    }).select().single();

    if (error) { alert("Error creating RFP: " + error.message); setSaving(false); return; }

    // Link PRs
    if (selectedPRIds.length > 0) {
      await supabase.from("rfp_prs").insert(selectedPRIds.map(pr_id => ({ rfp_id: rfp.id, pr_id })));
    }

    // Save BOQ items
    const validBoq = boqItems.filter(i => i.description.trim());
    if (validBoq.length > 0) {
      await supabase.from("rfp_boq_items").insert(validBoq.map((item, idx) => ({
        rfp_id: rfp.id,
        item_no: item.item_no || String(idx + 1),
        description: item.description,
        qty: item.qty ? parseFloat(item.qty) : null,
        unit: item.unit || null,
        sort_order: idx,
      })));
    }

    // Invite vendors and send notifications
    if (selectedVendorIds.length > 0) {
      await supabase.from("rfp_vendors").insert(selectedVendorIds.map(vendor_id => ({
        rfp_id: rfp.id, vendor_id, notified_at: new Date().toISOString(),
      })));

      // Create notifications for each invited vendor's profile
      const { data: vendorProfiles } = await supabase
        .from("vendors").select("id, profile_id").in("id", selectedVendorIds);
      if (vendorProfiles?.length) {
        await supabase.from("notifications").insert(vendorProfiles.map(v => ({
          user_id: v.profile_id,
          type: "rfp_invite",
          message: `You have been invited to submit a proposal for: ${rfp.title}`,
          reference_id: rfp.id,
          reference_type: "rfp",
        })));
      }
    }

    setSaving(false);
    setPage("rfps");
  };

  const SECTIONS = [
    { key: "prs",      label: "1. Link PRs"         },
    { key: "details",  label: "2. RFP Details"      },
    { key: "boq",      label: "3. BOQ Guide"        },
    { key: "vendors",  label: "4. Invite Vendors"   },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.offWhite, fontFamily: "'DM Sans', Arial, sans-serif" }}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setPage("rfps")} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSec, fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="chevronLeft" size={14} color={C.textTer} /> RFPs
          </button>
          <span style={{ color: C.textTer }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.textPri }}>Create RFP</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btnSecondary} onClick={() => saveRFP(false)} disabled={saving}>{saving ? "Saving…" : "Save as Draft"}</button>
          <button style={styles.btnPrimary}    onClick={() => saveRFP(true)}  disabled={saving}>{saving ? "Publishing…" : "Publish RFP"}</button>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        {/* Step sidebar */}
        <div style={{ width: 200, minWidth: 200, padding: "24px 12px", position: "sticky", top: 60, height: "calc(100vh - 60px)", background: C.white, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              style={{ textAlign: "left", background: activeSection === s.key ? C.coralLight : "transparent", border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: activeSection === s.key ? 600 : 400, color: activeSection === s.key ? C.coral : C.textSec, cursor: "pointer", fontFamily: "inherit" }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: "28px 32px 60px", maxWidth: 900 }}>

          {/* ── Section 2: RFP Details ─────────────────────────────────── */}
          {activeSection === "details" && (
            <div style={styles.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ ...styles.cardTitle, margin: 0 }}>RFP Details</h3>
                {(titleDirty || descDirty) && (
                  <button onClick={resetToAutoFill}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.coral, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                    ↺ Reset to PR data
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ ...styles.label, margin: 0 }}>Title <span style={styles.required}>*</span></label>
                    {titleDirty && (
                      <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>Manually edited</span>
                    )}
                  </div>
                  <input value={title}
                    onChange={e => { setTitle(e.target.value); setTitleDirty(true); }}
                    placeholder="Auto-filled from PR — edit as needed"
                    style={styles.input}
                    onFocus={e => e.target.style.borderColor = C.coral}
                    onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ ...styles.label, margin: 0 }}>Description / Scope summary</label>
                    {descDirty && (
                      <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>Manually edited</span>
                    )}
                  </div>
                  <textarea rows={4} value={description}
                    onChange={e => { setDescription(e.target.value); setDescDirty(true); }}
                    placeholder="Auto-filled from PR work description — edit as needed"
                    style={{ ...styles.input, resize: "vertical" }} />
                </div>
                <div style={{ maxWidth: 280 }}>
                  <label style={styles.label}>Submission deadline</label>
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={styles.input} />
                  <p style={styles.hint}>Informational only — RFP stays open until you close it manually.</p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <button style={styles.btnSecondary} onClick={() => setActiveSection("prs")}>← Back</button>
                <button style={styles.btnPrimary}   onClick={() => setActiveSection("boq")}>Next →</button>
              </div>
            </div>
          )}

          {/* ── Section 1: Link PRs ────────────────────────────────────── */}
          {activeSection === "prs" && (
            <div>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Link Approved Purchase Requests</h3>
                <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>
                  Select one or more approved PRs to include in this RFP. The work description and attachments will be used as the basis for the RFP. Click <strong>Details</strong> on any PR to view the full information.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {approvedPRs.length === 0 && <div style={{ fontSize: 13, color: C.textTer, padding: "12px 0" }}>No approved PRs found.</div>}
                  {approvedPRs.map(pr => {
                    const selected = selectedPRIds.includes(pr.pr_number);
                    const warned = prWarnings[pr.pr_number];
                    return (
                      <div key={pr.pr_number}
                        onClick={() => togglePR(pr)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", border: `1.5px solid ${selected ? C.coral : C.border}`, borderRadius: 10, cursor: "pointer", background: selected ? C.coralLight : C.white, transition: "all 0.15s" }}>
                        <input type="checkbox" checked={selected} onChange={() => togglePR(pr)} onClick={e => e.stopPropagation()} style={{ marginTop: 2, accentColor: C.coral }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.coral }}>{pr.pr_number}</span>
                            <span style={{ fontSize: 12, color: C.textPri }}>{pr.description}</span>
                            {warned && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: C.amberText, background: C.amberBg, padding: "2px 8px", borderRadius: 99 }}>
                                <Icon name="warning" size={10} color={C.amberText} /> Also in: {warned}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: C.textTer, marginTop: 3 }}>
                            {pr.projects?.name || "—"} · {pr.start_date ? fmtShort(pr.start_date) : "No date"}
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); loadPRPreview(pr); setPreviewPR(prev => prev?.pr_number === pr.pr_number ? null : prev); }}
                          style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px", flexShrink: 0 }}>
                          <Icon name="eye" size={12} color={C.textSec} /> Details
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                  <button style={styles.btnSecondary} onClick={() => setPage("rfps")}>← Cancel</button>
                  <button style={styles.btnPrimary}   onClick={() => {
                    if (selectedPRIds.length === 0) { alert("Please select at least one approved PR before continuing."); return; }
                    setActiveSection("details");
                  }}>Next →</button>
                </div>
              </div>

              {/* PR Preview Panel */}
              {previewPR && (
                <div style={{ ...styles.card, marginTop: 16, borderLeft: `4px solid ${C.coral}` }}>
                  {previewLoading ? (
                    <div style={{ fontSize: 13, color: C.textTer, padding: "12px 0" }}>Loading PR details…</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.coral }}>{previewPR.pr_number}</span>
                          <span style={{ fontSize: 13, color: C.textPri, marginLeft: 10 }}>{previewPR.description}</span>
                        </div>
                        <button onClick={() => setPreviewPR(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 18 }}>✕</button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", marginBottom: 14 }}>
                        <Row label="Project"      value={previewPR.projects?.name} />
                        <Row label="Business unit" value={previewPR.projects?.business_unit} />
                        <Row label="Prepared by"  value={previewPR.profiles?.full_name} />
                        <Row label="Start date"   value={fmtShort(previewPR.start_date)} />
                        <Row label="End date"     value={fmtShort(previewPR.end_date)} />
                        {previewPR.is_rush && <Row label="Rush" value="Yes" />}
                      </div>
                      <Row label="Justification" value={previewPR.justification} />
                      {previewPR.rush_justification && <Row label="Rush justification" value={previewPR.rush_justification} />}

                      {previewPR.scope_items?.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 8 }}>Scope of Work</div>
                          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: C.offWhite }}>
                                  {["Description", "Qty", "UOM"].map(h => (
                                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: C.textTer, fontSize: 11 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {previewPR.scope_items.map((item, i) => (
                                  <tr key={item.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                                    <td style={{ padding: "8px 12px", color: C.textPri }}>{item.desc}</td>
                                    <td style={{ padding: "8px 12px", color: C.textSec }}>{item.qty}</td>
                                    <td style={{ padding: "8px 12px", color: C.textSec }}>{item.uom}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Section 3: BOQ Guide ───────────────────────────────────── */}
          {activeSection === "boq" && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>BOQ Guide</h3>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>
                Fill in Item No., Description, Qty and Unit. Vendors will complete the Material Unit Rate, Labor Unit Rate and Total columns when they submit their proposal.
              </p>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.offWhite }}>
                      {["Item No.", "Description", "Qty", "Unit", "Material Unit Rate", "Labor Unit Rate", "Total Unit Rate Amt", ""].map((h, i) => (
                        <th key={h} style={{ padding: "9px 10px", textAlign: "left", fontWeight: 600, color: i >= 4 ? C.textTer : C.textSec, fontSize: 11, border: `1px solid ${C.border}`, background: i >= 4 ? "#F8F7F5" : C.white, fontStyle: i >= 4 ? "italic" : "normal" }}>
                          {h}{i >= 4 && i < 7 ? " (vendor)" : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boqItems.map((item, i) => (
                      <tr key={item.id}>
                        <td style={{ padding: "6px 6px", border: `1px solid ${C.border}`, width: 70 }}>
                          <input value={item.item_no} onChange={e => updateBoq(item.id, "item_no", e.target.value)}
                            style={{ ...styles.input, padding: "5px 8px", fontSize: 12 }} />
                        </td>
                        <td style={{ padding: "6px 6px", border: `1px solid ${C.border}` }}>
                          <input value={item.description} onChange={e => updateBoq(item.id, "description", e.target.value)} placeholder="Item description…"
                            style={{ ...styles.input, padding: "5px 8px", fontSize: 12 }} />
                        </td>
                        <td style={{ padding: "6px 6px", border: `1px solid ${C.border}`, width: 80 }}>
                          <input type="number" value={item.qty} onChange={e => updateBoq(item.id, "qty", e.target.value)}
                            style={{ ...styles.input, padding: "5px 8px", fontSize: 12 }} />
                        </td>
                        <td style={{ padding: "6px 6px", border: `1px solid ${C.border}`, width: 90 }}>
                          <input value={item.unit} onChange={e => updateBoq(item.id, "unit", e.target.value)} placeholder="e.g. pcs"
                            style={{ ...styles.input, padding: "5px 8px", fontSize: 12 }} />
                        </td>
                        {[4, 5, 6].map(col => (
                          <td key={col} style={{ padding: "6px 8px", border: `1px solid ${C.border}`, background: C.surface, textAlign: "center", color: C.textTer, fontSize: 11 }}>—</td>
                        ))}
                        <td style={{ padding: "6px 6px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                          {boqItems.length > 1 && (
                            <button onClick={() => removeBoqRow(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, padding: 4 }}
                              onMouseOver={e => e.currentTarget.style.color = C.redText}
                              onMouseOut={e => e.currentTarget.style.color = C.textTer}>
                              <Icon name="trash" size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button style={{ ...styles.btnGhost, marginTop: 12, fontSize: 12 }} onClick={addBoqRow}>
                <Icon name="plus" size={12} color={C.textSec} /> Add row
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <button style={styles.btnSecondary} onClick={() => setActiveSection("details")}>← Back</button>
                <button style={styles.btnPrimary}   onClick={() => setActiveSection("vendors")}>Next →</button>
              </div>
            </div>
          )}

          {/* ── Section 4: Invite Vendors ──────────────────────────────── */}
          {activeSection === "vendors" && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Invite Vendors</h3>
              <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 16px" }}>
                Select vendors to invite. Only vendors who have submitted an accreditation form are listed. Selected vendors will receive an in-app notification.
              </p>

              <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <Icon name="search" size={13} color={C.textTer} />
                  </div>
                  <input placeholder="Search by company name…" value={vendorSearch} onChange={e => setVendorSearch(e.target.value)}
                    style={{ ...styles.input, paddingLeft: 32, fontSize: 12 }} />
                </div>
                <button style={{ ...styles.btnGhost, fontSize: 12, whiteSpace: "nowrap" }} onClick={toggleAllVendors}>
                  {filteredVendors.every(v => selectedVendorIds.includes(v.id)) ? "Deselect all" : "Select all"}
                </button>
                <span style={{ fontSize: 12, color: C.textSec, whiteSpace: "nowrap" }}>{selectedVendorIds.length} selected</span>
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                {filteredVendors.length === 0 && (
                  <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: C.textTer }}>No vendors found.</div>
                )}
                {filteredVendors.map((v, i) => {
                  const selected = selectedVendorIds.includes(v.id);
                  return (
                    <div key={v.id} onClick={() => toggleVendor(v.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: i < filteredVendors.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", background: selected ? C.coralLight : "transparent", transition: "background 0.15s" }}>
                      <input type="checkbox" checked={selected} onChange={() => toggleVendor(v.id)} onClick={e => e.stopPropagation()} style={{ accentColor: C.coral }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.textPri }}>{v.vendor_company_info?.company_name || "Unnamed vendor"}</div>
                        <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>{v.vendor_company_info?.primary_activity || "—"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {v.subcontractor_class && (
                          <span style={{ fontSize: 11, fontWeight: 600, background: C.coralMid, color: C.coralDark, padding: "2px 8px", borderRadius: 99 }}>{v.subcontractor_class}</span>
                        )}
                        <span style={{ ...rfpBadge(v.accreditation_status === "Accredited" ? "Open" : "Draft"), fontSize: 10 }}>{v.accreditation_status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <button style={styles.btnSecondary} onClick={() => setActiveSection("boq")}>← Back</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.btnSecondary} onClick={() => saveRFP(false)} disabled={saving}>{saving ? "Saving…" : "Save as Draft"}</button>
                  <button style={styles.btnPrimary}   onClick={() => saveRFP(true)}  disabled={saving}>{saving ? "Publishing…" : "Publish RFP"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RFP DETAIL PAGE ──────────────────────────────────────────────────────────
function RFPDetailPage({ rfpId, profile, setPage, setSelectedRFAId, setRfaPRId }) {
  const [rfp, setRfp] = useState(null);
  const [linkedPRs, setLinkedPRs] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [invitedVendors, setInvitedVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [closing, setClosing] = useState(false);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [vendorProposals, setVendorProposals] = useState([]);
  const [proposalBoq, setProposalBoq] = useState({});
  const [compareIds, setCompareIds] = useState([]);
  const [compareData, setCompareData] = useState({});
  const [compareLoading, setCompareLoading] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [evalApprovals, setEvalApprovals] = useState([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalForm, setEvalForm] = useState({ recommendedVendorIds: [], reason: "", awardAmount: "" });
  const [evalSaving, setEvalSaving] = useState(false);
  const [evalActionNotes, setEvalActionNotes] = useState("");
  const [showActionModal, setShowActionModal] = useState(null);
  const [linkedRFA, setLinkedRFA] = useState(null);

  const canManage = can(profile, "rfp.manage");

  useEffect(() => { fetchAll(); fetchEvaluation(); }, [rfpId]);

  const fetchAll = async () => {
    setLoading(true);
    const [rfpRes, prRes, boqRes, vendorRes] = await Promise.all([
      supabase.from("rfps").select("*, profiles!rfps_created_by_fkey(full_name)").eq("id", rfpId).single(),
      supabase.from("rfp_prs").select("pr_id, purchase_requests(id, pr_number, description, start_date, projects(name), profiles!purchase_requests_prepared_by_fkey(full_name))").eq("rfp_id", rfpId),
      supabase.from("rfp_boq_items").select("*").eq("rfp_id", rfpId).order("sort_order"),
      supabase.from("rfp_vendors").select("*, vendors(id, accreditation_status, subcontractor_class, vendor_company_info(company_name, primary_activity))").eq("rfp_id", rfpId),
    ]);
    setRfp(rfpRes.data);
    setLinkedPRs((prRes.data || []).map(l => l.purchase_requests).filter(Boolean));
    setBoqItems(boqRes.data || []);

    const invites = vendorRes.data || [];
    if (invites.length) {
      const vendorIds = invites.map(vi => vi.vendor_id);
      const { data: proposals } = await supabase
        .from("rfp_proposals").select("id, vendor_id, version, total_amount, boq_file_name, boq_file_url, notes, submitted_at")
        .eq("rfp_id", rfpId).in("vendor_id", vendorIds).order("version", { ascending: false });
      const latestMap = {};
      (proposals || []).forEach(p => { if (!latestMap[p.vendor_id]) latestMap[p.vendor_id] = p; });
      setInvitedVendors(invites.map(vi => ({ ...vi, vendor: vi.vendors, latest: latestMap[vi.vendor_id] || null })));
    } else {
      setInvitedVendors([]);
    }

    const prIds = (prRes.data || []).map(l => l.pr_id).filter(Boolean);
    if (prIds.length) {
      const { data: rfaData } = await supabase
        .from("rfas").select("id, rfa_number, status, awarded_slot")
        .in("pr_id", prIds).order("created_at", { ascending: false }).limit(1);
      setLinkedRFA(rfaData?.[0] || null);
    }

    setLoading(false);
  };

  const closeRFP = async () => {
    if (!window.confirm("Close this RFP? Vendors will no longer be able to submit new proposals.")) return;
    setClosing(true);
    await supabase.from("rfps").update({ status: "Closed" }).eq("id", rfpId);
    setRfp(prev => ({ ...prev, status: "Closed" }));
    setClosing(false);
  };

  const reopenRFP = async () => {
    setClosing(true);
    await supabase.from("rfps").update({ status: "Open" }).eq("id", rfpId);
    setRfp(prev => ({ ...prev, status: "Open" }));
    setClosing(false);
  };

  const openVendorProposals = async (vi) => {
    setViewingVendor(vi);
    const { data } = await supabase
      .from("rfp_proposals").select("*").eq("rfp_id", rfpId).eq("vendor_id", vi.vendor_id)
      .order("version", { ascending: false });
    setVendorProposals(data || []);
    if (data?.[0]) {
      const { data: lines } = await supabase
        .from("rfp_proposal_boq").select("*, rfp_boq_items(item_no, description, qty, unit)")
        .eq("proposal_id", data[0].id);
      setProposalBoq({ [data[0].id]: lines || [] });
    }
    setActiveTab("proposals");
  };

  const loadProposalBoq = async (proposalId) => {
    if (proposalBoq[proposalId]) return;
    const { data } = await supabase
      .from("rfp_proposal_boq").select("*, rfp_boq_items(item_no, description, qty, unit)")
      .eq("proposal_id", proposalId);
    setProposalBoq(prev => ({ ...prev, [proposalId]: data || [] }));
  };

  const toggleCompare = (vendorId) => {
    setCompareIds(prev => prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]);
  };

  const runComparison = async () => {
    if (compareIds.length === 0) return;
    setCompareLoading(true);
    const newData = { ...compareData };
    for (const vid of compareIds) {
      if (newData[vid]) continue;
      const { data: props } = await supabase
        .from("rfp_proposals").select("*").eq("rfp_id", rfpId).eq("vendor_id", vid)
        .order("version", { ascending: false }).limit(1);
      const latest = props?.[0];
      if (latest) {
        const { data: lines } = await supabase
          .from("rfp_proposal_boq").select("*, rfp_boq_items(item_no, description, qty, unit)")
          .eq("proposal_id", latest.id);
        newData[vid] = { proposal: latest, lines: lines || [] };
      } else {
        newData[vid] = null;
      }
    }
    setCompareData(newData);
    setCompareLoading(false);
    setActiveTab("compare");
  };

  const fetchEvaluation = async () => {
    setEvalLoading(true);
    const { data: evals } = await supabase
      .from("rfp_evaluations")
      .select("*, profiles!rfp_evaluations_prepared_by_fkey(full_name)")
      .eq("rfp_id", rfpId).order("created_at", { ascending: false }).limit(1);
    if (evals?.[0]) {
      setEvaluation(evals[0]);
      const { data: approvals } = await supabase
        .from("rfp_evaluation_approvals")
        .select("*, profiles!rfp_evaluation_approvals_approver_id_fkey(full_name)")
        .eq("evaluation_id", evals[0].id).order("step_order");
      setEvalApprovals(approvals || []);
    } else {
      setEvaluation(null);
      setEvalApprovals([]);
    }
    setEvalLoading(false);
  };

  const submitEvaluation = async () => {
    if (evalForm.recommendedVendorIds.length === 0) { alert("Please select at least one recommended vendor."); return; }
    if (!evalForm.reason.trim()) { alert("Please provide a justification/basis for the recommendation."); return; }
    if (!evalForm.awardAmount || isNaN(parseFloat(evalForm.awardAmount))) { alert("Please enter a valid award amount."); return; }
    setEvalSaving(true);
    const amount = parseFloat(evalForm.awardAmount);
    const { data: ev, error } = await supabase.from("rfp_evaluations").insert({
      rfp_id: rfpId,
      recommended_vendor_ids: evalForm.recommendedVendorIds,
      reason: evalForm.reason.trim(),
      award_amount: amount,
      status: "Pending Bidcom 1",
      prepared_by: profile.id,
    }).select("*, profiles!rfp_evaluations_prepared_by_fkey(full_name)").single();
    if (error) { alert("Error creating evaluation: " + error.message); setEvalSaving(false); return; }
    const { data: bidcom1 } = await supabase.from("profiles").select("id").eq("position", "Finance Head");
    if (bidcom1?.length) {
      await supabase.from("notifications").insert(bidcom1.map(p => ({
        user_id: p.id, type: "eval_review",
        message: `Commercial Evaluation Report for "${rfp?.title}" is pending your approval.`,
        reference_id: ev.id, reference_type: "rfp_evaluation",
      })));
    }
    await fetchEvaluation();
    setEvalSaving(false);
  };

  const handleApproval = async (action) => {
    if (!evaluation) return;
    setEvalSaving(true);
    const stepOrder = evaluation.status === "Pending Bidcom 1" ? 1 : 2;
    const roleLabel = evaluation.status === "Pending Bidcom 1" ? "Bidcom 1" : "Bidcom 2";
    await supabase.from("rfp_evaluation_approvals").insert({
      evaluation_id: evaluation.id,
      approver_id: profile.id,
      role_label: roleLabel,
      action_type: action,
      notes: evalActionNotes.trim() || null,
      actioned_at: new Date().toISOString(),
      step_order: stepOrder,
    });
    let newStatus;
    if (action === "Returned") {
      newStatus = "Returned";
      await supabase.from("notifications").insert({
        user_id: evaluation.prepared_by, type: "eval_returned",
        message: `Your Commercial Evaluation Report for "${rfp?.title}" was returned by ${profile.full_name}.`,
        reference_id: evaluation.id, reference_type: "rfp_evaluation",
      });
    } else if (roleLabel === "Bidcom 1") {
      if (evaluation.award_amount > 500000) {
        newStatus = "Pending Bidcom 2";
        const { data: bidcom2 } = await supabase.from("profiles").select("id").eq("position", "President");
        if (bidcom2?.length) {
          await supabase.from("notifications").insert(bidcom2.map(p => ({
            user_id: p.id, type: "eval_review",
            message: `Commercial Evaluation Report for "${rfp?.title}" requires your final approval.`,
            reference_id: evaluation.id, reference_type: "rfp_evaluation",
          })));
        }
      } else {
        newStatus = "Approved";
      }
    } else {
      newStatus = "Approved";
    }
    await supabase.from("rfp_evaluations").update({ status: newStatus }).eq("id", evaluation.id);
    setShowActionModal(null);
    setEvalActionNotes("");
    await fetchEvaluation();
    setEvalSaving(false);
  };

  const printReport = () => {
    if (!evaluation) return;
    const fmtPHP = (v) => v ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(v) : "—";
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—";
    const recommended = invitedVendors.filter(vi => (evaluation.recommended_vendor_ids || []).includes(vi.vendor_id));
    const withProposals = invitedVendors.filter(vi => vi.latest);
    const chain = [
      { step: 0, role: "PR Reviewer", name: evaluation.profiles?.full_name || "—", action: "Prepared", date: evaluation.created_at, notes: "" },
      ...evalApprovals.map(a => ({ step: a.step_order, role: `${a.role_label}`, name: a.profiles?.full_name || "—", action: a.action_type, date: a.actioned_at, notes: a.notes || "" })),
    ];
    if (!evalApprovals.find(a => a.role_label === "Bidcom 1")) chain.push({ step: 1, role: "Bidcom 1 — Finance Head", name: "", action: "Pending", date: null, notes: "" });
    if (evaluation.award_amount > 500000 && !evalApprovals.find(a => a.role_label === "Bidcom 2")) chain.push({ step: 2, role: "Bidcom 2 — President", name: "", action: "Pending", date: null, notes: "" });
    const b1Approver = evalApprovals.find(a => a.role_label === "Bidcom 1" && a.action_type === "Approved");
    const b2Approver = evalApprovals.find(a => a.role_label === "Bidcom 2" && a.action_type === "Approved");
    const html = `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:4px;">Commercial &amp; Contract Management System</div>
        <div style="font-size:20px;font-weight:700;margin:0 0 4px;">COMMERCIAL EVALUATION REPORT</div>
        <div style="font-size:12px;color:#444;">Date: ${fmtDate(new Date())}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <tr><td style="padding:5px 0;color:#666;width:28%">RFP Reference</td><td style="padding:5px 0;font-weight:600;">${rfp?.title || "—"}</td><td style="padding:5px 0;color:#666;width:20%">Prepared by</td><td style="padding:5px 0;font-weight:600;">${evaluation.profiles?.full_name || "—"}</td></tr>
        <tr><td style="padding:5px 0;color:#666">Deadline</td><td style="padding:5px 0;">${fmtDate(rfp?.deadline)}</td><td style="padding:5px 0;color:#666">Status</td><td style="padding:5px 0;">${evaluation.status}</td></tr>
      </table>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1.5px solid #333;padding-bottom:4px;margin:20px 0 10px;">Participating Vendors</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <thead><tr style="background:#f5f5f5"><th style="border:1px solid #ddd;padding:6px 8px;text-align:left;">Vendor</th><th style="border:1px solid #ddd;padding:6px 8px;text-align:left;">Class</th><th style="border:1px solid #ddd;padding:6px 8px;text-align:right;">Proposal Amount</th><th style="border:1px solid #ddd;padding:6px 8px;text-align:center;">Recommended</th></tr></thead>
        <tbody>${withProposals.map(vi => `<tr><td style="border:1px solid #ddd;padding:6px 8px;">${vi.vendor?.vendor_company_info?.company_name || "—"}</td><td style="border:1px solid #ddd;padding:6px 8px;">${vi.vendor?.subcontractor_class || "—"}</td><td style="border:1px solid #ddd;padding:6px 8px;text-align:right;">${fmtPHP(vi.latest?.total_amount)}</td><td style="border:1px solid #ddd;padding:6px 8px;text-align:center;">${(evaluation.recommended_vendor_ids || []).includes(vi.vendor_id) ? "✓" : ""}</td></tr>`).join("")}</tbody>
      </table>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1.5px solid #333;padding-bottom:4px;margin:20px 0 10px;">Recommendation</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <tr><td style="padding:6px 0;width:28%;color:#666;vertical-align:top">Recommended Vendor(s)</td><td style="padding:6px 0;font-weight:600;">${recommended.map(vi => vi.vendor?.vendor_company_info?.company_name || "—").join(", ")}</td></tr>
        <tr><td style="padding:6px 0;color:#666;vertical-align:top">Award Amount</td><td style="padding:6px 0;font-size:16px;font-weight:700;">${fmtPHP(evaluation.award_amount)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;vertical-align:top">Justification / Basis</td><td style="padding:6px 0;">${evaluation.reason || "—"}</td></tr>
      </table>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1.5px solid #333;padding-bottom:4px;margin:20px 0 10px;">Approval Chain</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:32px;">
        <thead><tr style="background:#f5f5f5"><th style="border:1px solid #ddd;padding:6px 8px">Step</th><th style="border:1px solid #ddd;padding:6px 8px">Role</th><th style="border:1px solid #ddd;padding:6px 8px">Action</th><th style="border:1px solid #ddd;padding:6px 8px">By</th><th style="border:1px solid #ddd;padding:6px 8px">Date</th><th style="border:1px solid #ddd;padding:6px 8px">Notes</th></tr></thead>
        <tbody>${chain.map(c => `<tr><td style="border:1px solid #ddd;padding:6px 8px;text-align:center;">${c.step}</td><td style="border:1px solid #ddd;padding:6px 8px;">${c.role}</td><td style="border:1px solid #ddd;padding:6px 8px;color:${c.action==="Approved"?"#059669":c.action==="Returned"?"#DC2626":c.action==="Pending"?"#D97706":"#333"};font-weight:${c.action==="Approved"||c.action==="Returned"?"700":"400"}">${c.action}</td><td style="border:1px solid #ddd;padding:6px 8px;">${c.name}</td><td style="border:1px solid #ddd;padding:6px 8px;">${fmtDate(c.date)}</td><td style="border:1px solid #ddd;padding:6px 8px;">${c.notes}</td></tr>`).join("")}</tbody>
      </table>
      <div style="margin-top:48px;page-break-inside:avoid;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#666;margin-bottom:20px;">Signatures</div>
        <div style="display:flex;gap:48px;">
          <div style="flex:1"><div style="border-bottom:1px solid #333;height:52px;margin-bottom:6px;"></div><div style="font-size:12px;font-weight:600;">${evaluation.profiles?.full_name || "________________________"}</div><div style="font-size:11px;color:#666;">Prepared by · PR Reviewer</div></div>
          <div style="flex:1"><div style="border-bottom:1px solid #333;height:52px;margin-bottom:6px;"></div><div style="font-size:12px;font-weight:600;">${b1Approver?.profiles?.full_name || "________________________"}</div><div style="font-size:11px;color:#666;">Noted by · Finance Head (Bidcom 1)</div></div>
          ${evaluation.award_amount > 500000 ? `<div style="flex:1"><div style="border-bottom:1px solid #333;height:52px;margin-bottom:6px;"></div><div style="font-size:12px;font-weight:600;">${b2Approver?.profiles?.full_name || "________________________"}</div><div style="font-size:11px;color:#666;">Approved by · President (Bidcom 2)</div></div>` : ""}
        </div>
      </div>`;
    const win = window.open("", "_blank", "width=860,height=1100");
    win.document.write(`<!DOCTYPE html><html><head><title>CER — ${rfp?.title || "Report"}</title><style>@media print{@page{size:A4 portrait;margin:20mm}}</style></head><body style="font-family:Arial,sans-serif;font-size:13px;color:#111;padding:40px;max-width:800px;margin:0 auto;">${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const fmt = (v) => v ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(v) : "—";

  if (loading) return (
    <>
      <div style={{ ...styles.pageBody, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <span style={{ color: C.textTer, fontSize: 13 }}>Loading…</span>
      </div>
    </>
  );
  if (!rfp) return null;

  const TABS = [
    { key: "overview",    label: "Overview" },
    { key: "proposals",   label: `Proposals (${invitedVendors.filter(vi => vi.latest).length})` },
    { key: "compare",     label: "Side-by-Side Comparison" },
    { key: "evaluation",  label: evaluation ? `Evaluation · ${evaluation.status}` : "Evaluation" },
  ];

  const canActOnEval = evaluation && (
    (can(profile, "rfp.bidcom1") && evaluation.status === "Pending Bidcom 1") ||
    (can(profile, "rfp.bidcom2") && evaluation.status === "Pending Bidcom 2") ||
    (profile?.is_admin === true  && evaluation.status?.startsWith("Pending"))
  );
  const submittedCount = invitedVendors.filter(vi => vi.latest).length;
  const canCreateEval = !evaluation && can(profile, "rfp.manage") && submittedCount > 0;

  return (
    <>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => { setViewingVendor(null); setPage("rfps"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.textSec, fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="chevronLeft" size={14} color={C.textTer} /> RFPs
          </button>
          <span style={{ color: C.textTer }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.textPri, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rfp.title}</span>
          <span style={rfpBadge(rfp.status)}>{rfp.status}</span>
          {linkedRFA && (
            <button
              onClick={() => { if (setSelectedRFAId && setRfaPRId) { setSelectedRFAId(linkedRFA.id); setRfaPRId(null); setPage("rfa_form"); } }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: C.coralLight, border: `1px solid ${C.coral}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11, color: C.coral, fontWeight: 600, fontFamily: "inherit" }}>
              RFA {linkedRFA.rfa_number} <span style={{ color: C.textTer, fontWeight: 400 }}>→</span>
            </button>
          )}
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8 }}>
            {rfp.status === "Open" && (
              <button style={{ ...styles.btnSecondary, color: C.redText, borderColor: "#FCA5A5" }}
                onClick={closeRFP} disabled={closing}>{closing ? "Closing…" : "Close RFP"}</button>
            )}
            {rfp.status === "Closed" && (
              <button style={{ ...styles.btnSecondary, color: C.greenText, borderColor: "#86EFAC" }}
                onClick={reopenRFP} disabled={closing}>{closing ? "Reopening…" : "Re-open RFP"}</button>
            )}
            {rfp.status !== "Draft" && submittedCount >= 2 && (
              <button style={styles.btnPrimary} onClick={() => { setActiveTab("compare"); }}>
                Compare Proposals
              </button>
            )}
          </div>
        )}
      </div>

      <div style={styles.pageBody}>
        {/* Summary strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard label="Linked PRs"    value={linkedPRs.length} />
          <StatCard label="BOQ Items"     value={boqItems.length} />
          <StatCard label="Vendors Invited" value={invitedVendors.length} />
          <StatCard label="Proposals In"  value={submittedCount} accent={submittedCount > 0 ? C.greenText : C.textTer} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, background: C.white, borderRadius: 10, padding: 4, border: `1px solid ${C.border}`, width: "fit-content" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { if (t.key !== "compare") setViewingVendor(null); setActiveTab(t.key); }}
              style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: activeTab === t.key ? 600 : 400, background: activeTab === t.key ? C.coral : "transparent", color: activeTab === t.key ? C.white : C.textSec, fontFamily: "inherit", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* RFP Info */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>RFP Information</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                {[
                  ["Title", rfp.title],
                  ["Status", rfp.status],
                  ["Created by", rfp.profiles?.full_name || "—"],
                  ["Deadline", rfp.deadline ? fmtShort(rfp.deadline) : "—"],
                  ["Created", fmtShort(rfp.created_at)],
                  ["Description", rfp.description || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, color: C.textPri }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked PRs */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Linked Purchase Requests</h3>
              {linkedPRs.length === 0
                ? <div style={{ color: C.textTer, fontSize: 13, fontStyle: "italic" }}>No PRs linked.</div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {linkedPRs.map(pr => (
                    <div key={pr.pr_number} style={{ background: C.offWhite, borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.coral, marginRight: 8 }}>{pr.pr_number}</span>
                          <span style={{ fontSize: 13, color: C.textPri }}>{pr.description || "—"}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: C.textTer, marginTop: 4 }}>
                        {[pr.projects?.name, pr.profiles?.full_name, pr.start_date ? fmtShort(pr.start_date) : null].filter(Boolean).join("  ·  ")}
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>

            {/* BOQ Items */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Bill of Quantities Guide</h3>
              {boqItems.length === 0
                ? <div style={{ color: C.textTer, fontSize: 13, fontStyle: "italic" }}>No BOQ items defined.</div>
                : <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.offWhite }}>
                        {["#", "Description", "Qty", "Unit"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: C.textTer, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {boqItems.map((item, i) => (
                        <tr key={item.id} style={{ borderBottom: i < boqItems.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <td style={{ padding: "8px 12px", color: C.textTer }}>{item.item_no}</td>
                          <td style={{ padding: "8px 12px", color: C.textPri }}>{item.description}</td>
                          <td style={{ padding: "8px 12px", color: C.textSec }}>{item.qty ?? "—"}</td>
                          <td style={{ padding: "8px 12px", color: C.textSec }}>{item.unit || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        )}

        {/* ── TAB: PROPOSALS ─────────────────────────────────────────── */}
        {activeTab === "proposals" && (
          <div>
            {viewingVendor ? (
              /* Individual Proposal View */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setViewingVendor(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.textSec, fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="chevronLeft" size={14} color={C.textTer} /> All Proposals
                  </button>
                  <span style={{ color: C.textTer }}>/</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.textPri }}>{viewingVendor.vendor?.vendor_company_info?.company_name || "Vendor"}</span>
                </div>

                {vendorProposals.length === 0
                  ? <div style={{ ...styles.card, color: C.textTer, fontSize: 13, fontStyle: "italic" }}>No proposals submitted yet.</div>
                  : vendorProposals.map((p, idx) => {
                    const isLatest = idx === 0;
                    const lines = proposalBoq[p.id];
                    return (
                      <div key={p.id} style={{ ...styles.card, outline: isLatest ? `2px solid ${C.coral}` : "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>Version {p.version}</span>
                            {isLatest && <span style={{ marginLeft: 8, fontSize: 11, background: C.coralLight, color: C.coral, borderRadius: 99, padding: "2px 8px", fontWeight: 600 }}>Latest</span>}
                            <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>Submitted {fmtShort(p.submitted_at)}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            {p.total_amount && <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>{fmt(p.total_amount)}</div>}
                            {p.boq_file_url && (
                              <a href={p.boq_file_url} target="_blank" rel="noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.coral, marginTop: 4, textDecoration: "none", fontWeight: 500 }}>
                                <Icon name="download" size={12} color={C.coral} /> {p.boq_file_name || "Download BOQ"}
                              </a>
                            )}
                          </div>
                        </div>
                        {p.notes && (
                          <div style={{ background: C.offWhite, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.textSec, marginBottom: 12 }}>
                            <span style={{ fontWeight: 600, color: C.textTer }}>Notes: </span>{p.notes}
                          </div>
                        )}
                        {/* BOQ breakdown for this proposal */}
                        {isLatest && (
                          <div>
                            {!lines && (
                              <button onClick={() => loadProposalBoq(p.id)}
                                style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }}>
                                Show BOQ breakdown
                              </button>
                            )}
                            {lines && lines.length > 0 && (
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
                                  <thead>
                                    <tr style={{ background: C.offWhite }}>
                                      {["#", "Description", "Qty", "Unit", "Material Rate", "Labor Rate", "Total Rate", "Line Total"].map(h => (
                                        <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600, color: C.textTer, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines.map((line, li) => {
                                      const item = line.rfp_boq_items;
                                      const qty = item?.qty || 0;
                                      const total = line.total_unit_rate_amount;
                                      const lineTotal = total && qty ? total * qty : null;
                                      return (
                                        <tr key={line.id} style={{ borderBottom: li < lines.length - 1 ? `1px solid ${C.border}` : "none" }}>
                                          <td style={{ padding: "7px 10px", color: C.textTer }}>{item?.item_no}</td>
                                          <td style={{ padding: "7px 10px", color: C.textPri }}>{item?.description}</td>
                                          <td style={{ padding: "7px 10px", color: C.textSec }}>{item?.qty ?? "—"}</td>
                                          <td style={{ padding: "7px 10px", color: C.textSec }}>{item?.unit || "—"}</td>
                                          <td style={{ padding: "7px 10px", color: C.textSec }}>{line.material_unit_rate ? fmt(line.material_unit_rate) : "—"}</td>
                                          <td style={{ padding: "7px 10px", color: C.textSec }}>{line.labor_unit_rate ? fmt(line.labor_unit_rate) : "—"}</td>
                                          <td style={{ padding: "7px 10px", color: C.textPri, fontWeight: 500 }}>{total ? fmt(total) : "—"}</td>
                                          <td style={{ padding: "7px 10px", color: C.textPri, fontWeight: 600 }}>{lineTotal ? fmt(lineTotal) : "—"}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {lines && lines.length === 0 && (
                              <div style={{ fontSize: 12, color: C.textTer, fontStyle: "italic" }}>No itemized BOQ submitted (file-only proposal).</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            ) : (
              /* Proposal List (all vendors) */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {compareIds.length > 0 && (
                  <div style={{ background: C.coralLight, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: C.coral, fontWeight: 500 }}>{compareIds.length} vendor{compareIds.length > 1 ? "s" : ""} selected for comparison</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setCompareIds([])} style={{ ...styles.btnGhost, padding: "4px 10px", fontSize: 11 }}>Clear</button>
                      <button onClick={runComparison} style={{ ...styles.btnPrimary, padding: "5px 14px", fontSize: 11 }} disabled={compareLoading}>
                        {compareLoading ? "Loading…" : "Compare →"}
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "clip" }}>
                  <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>Invited Vendors</span>
                    {submittedCount >= 2 && (
                      <span style={{ fontSize: 11, color: C.textTer }}>Check vendors to compare side-by-side</span>
                    )}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.offWhite }}>
                        {submittedCount >= 2 && <th style={{ width: 36, padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}></th>}
                        {["Vendor", "Class", "Proposal Status", "Version", "Total Amount", "Submitted", ""].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: C.textTer, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invitedVendors.length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: C.textTer }}>No vendors invited.</td></tr>
                      )}
                      {invitedVendors.map((vi, i) => {
                        const p = vi.latest;
                        const hasProposal = !!p;
                        const isChecked = compareIds.includes(vi.vendor_id);
                        return (
                          <tr key={vi.vendor_id}
                            style={{ borderBottom: i < invitedVendors.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.15s" }}
                            onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                            {submittedCount >= 2 && (
                              <td style={{ padding: "10px 12px" }}>
                                {hasProposal && (
                                  <input type="checkbox" checked={isChecked} onChange={() => toggleCompare(vi.vendor_id)}
                                    style={{ cursor: "pointer", accentColor: C.coral }} />
                                )}
                              </td>
                            )}
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ fontWeight: 500, color: C.textPri }}>{vi.vendor?.vendor_company_info?.company_name || "—"}</div>
                              <div style={{ fontSize: 11, color: C.textTer }}>{vi.vendor?.vendor_company_info?.primary_activity || ""}</div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {vi.vendor?.subcontractor_class
                                ? <span style={{ fontSize: 11, fontWeight: 600, background: C.coralMid, color: C.coralDark, padding: "2px 8px", borderRadius: 99 }}>{vi.vendor.subcontractor_class}</span>
                                : <span style={{ color: C.textTer }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {hasProposal
                                ? <span style={{ ...styles.badge("Approved"), fontSize: 11 }}>Submitted</span>
                                : <span style={{ ...styles.badge("Draft"), fontSize: 11 }}>Pending</span>}
                            </td>
                            <td style={{ padding: "10px 12px", color: C.textSec }}>
                              {p ? `v${p.version}` : "—"}
                            </td>
                            <td style={{ padding: "10px 12px", color: C.textPri, fontWeight: p?.total_amount ? 600 : 400 }}>
                              {p?.total_amount ? fmt(p.total_amount) : "—"}
                            </td>
                            <td style={{ padding: "10px 12px", color: C.textTer, whiteSpace: "nowrap" }}>
                              {p ? fmtShort(p.submitted_at) : "—"}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              {hasProposal && (
                                <button onClick={() => openVendorProposals(vi)}
                                  style={{ ...styles.btnGhost, padding: "4px 10px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                  <Icon name="eye" size={12} color={C.textTer} /> View
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: COMPARISON ─────────────────────────────────────────── */}
        {activeTab === "compare" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Vendor selector */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Select Vendors to Compare</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {invitedVendors.filter(vi => vi.latest).map(vi => {
                  const checked = compareIds.includes(vi.vendor_id);
                  return (
                    <label key={vi.vendor_id}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${checked ? C.coral : C.border}`, background: checked ? C.coralLight : C.white, cursor: "pointer", fontSize: 12, fontWeight: checked ? 600 : 400, color: checked ? C.coral : C.textPri, transition: "all 0.15s" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCompare(vi.vendor_id)} style={{ accentColor: C.coral }} />
                      {vi.vendor?.vendor_company_info?.company_name || `Vendor ${vi.vendor_id}`}
                    </label>
                  );
                })}
              </div>
              {invitedVendors.filter(vi => vi.latest).length === 0 && (
                <div style={{ color: C.textTer, fontSize: 13, fontStyle: "italic" }}>No proposals submitted yet.</div>
              )}
              {compareIds.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={runComparison} style={styles.btnPrimary} disabled={compareLoading}>
                    {compareLoading ? "Loading…" : "Refresh Comparison"}
                  </button>
                </div>
              )}
            </div>

            {/* Comparison table */}
            {compareIds.length > 0 && Object.keys(compareData).length > 0 && (
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>BOQ Comparison</h3>
                <div style={{ overflowX: "auto" }}>
                  {/* Header: show vendor names for selected vendors that have data */}
                  {(() => {
                    const vendorsInTable = compareIds.filter(vid => compareData[vid]);
                    const vendorNames = vendorsInTable.map(vid => {
                      const vi = invitedVendors.find(v => v.vendor_id === vid);
                      return vi?.vendor?.vendor_company_info?.company_name || `Vendor ${vid}`;
                    });
                    return (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: C.offWhite }}>
                            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: C.textTer, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>#</th>
                            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: C.textTer, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: `1px solid ${C.border}`, minWidth: 200 }}>Description</th>
                            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: C.textTer, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Qty / Unit</th>
                            {vendorsInTable.map((vid, ci) => (
                              <th key={vid} colSpan={3}
                                style={{ textAlign: "center", padding: "8px 12px", fontWeight: 600, color: C.coral, fontSize: 11, borderBottom: `1px solid ${C.border}`, background: ci % 2 === 0 ? "#FFF5F4" : "#FFF9F8", borderLeft: `2px solid ${C.border}`, whiteSpace: "nowrap" }}>
                                {vendorNames[ci]}
                                <div style={{ fontWeight: 400, color: C.textTer }}>Mat · Lab · Total</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {boqItems.map((item, bi) => (
                            <tr key={item.id} style={{ borderBottom: bi < boqItems.length - 1 ? `1px solid ${C.border}` : "none" }}>
                              <td style={{ padding: "8px 12px", color: C.textTer }}>{item.item_no}</td>
                              <td style={{ padding: "8px 12px", color: C.textPri }}>{item.description}</td>
                              <td style={{ padding: "8px 12px", color: C.textSec, whiteSpace: "nowrap" }}>{item.qty ?? "—"} {item.unit || ""}</td>
                              {vendorsInTable.map((vid, ci) => {
                                const vData = compareData[vid];
                                const line = vData?.lines?.find(l => l.boq_item_id === item.id);
                                return (
                                  <React.Fragment key={vid}>
                                    <td style={{ padding: "8px 8px", color: C.textSec, textAlign: "right", background: ci % 2 === 0 ? "#FFF5F4" : "#FFF9F8", borderLeft: `2px solid ${C.border}` }}>
                                      {line?.material_unit_rate ? fmt(line.material_unit_rate) : "—"}
                                    </td>
                                    <td style={{ padding: "8px 8px", color: C.textSec, textAlign: "right", background: ci % 2 === 0 ? "#FFF5F4" : "#FFF9F8" }}>
                                      {line?.labor_unit_rate ? fmt(line.labor_unit_rate) : "—"}
                                    </td>
                                    <td style={{ padding: "8px 8px", color: C.textPri, fontWeight: 600, textAlign: "right", background: ci % 2 === 0 ? "#FFF5F4" : "#FFF9F8" }}>
                                      {line?.total_unit_rate_amount ? fmt(line.total_unit_rate_amount) : "—"}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                            </tr>
                          ))}
                          {/* Totals row */}
                          <tr style={{ borderTop: `2px solid ${C.border}`, background: C.offWhite }}>
                            <td colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, color: C.textPri, fontSize: 13 }}>Total Amount</td>
                            {vendorsInTable.map((vid, ci) => {
                              const vData = compareData[vid];
                              const total = vData?.proposal?.total_amount;
                              const allOthers = vendorsInTable.filter(ov => ov !== vid);
                              const isLowest = total && allOthers.every(ov => {
                                const ot = compareData[ov]?.proposal?.total_amount;
                                return !ot || total <= ot;
                              });
                              return (
                                <React.Fragment key={vid}>
                                  <td colSpan={3}
                                    style={{ padding: "10px 8px", fontWeight: 700, fontSize: 13, textAlign: "right", background: isLowest ? "#ECFDF5" : (ci % 2 === 0 ? "#FFF5F4" : "#FFF9F8"), color: isLowest ? C.greenText : C.textPri, borderLeft: `2px solid ${C.border}` }}>
                                    {total ? fmt(total) : "—"}
                                    {isLowest && total && <span style={{ fontSize: 10, marginLeft: 6, background: "#D1FAE5", color: C.greenText, borderRadius: 99, padding: "1px 6px", fontWeight: 600 }}>Lowest</span>}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
                {compareIds.some(vid => compareData[vid] === null) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: C.textTer, fontStyle: "italic" }}>
                    Some selected vendors have no proposals submitted yet and are excluded from the table.
                  </div>
                )}
              </div>
            )}

            {compareIds.length > 0 && Object.keys(compareData).length === 0 && !compareLoading && (
              <div style={{ textAlign: "center", color: C.textTer, fontSize: 13, padding: "40px 0" }}>
                Click "Refresh Comparison" to load comparison data.
              </div>
            )}

            {compareIds.length === 0 && (
              <div style={{ textAlign: "center", color: C.textTer, fontSize: 13, padding: "40px 0" }}>
                Select at least two vendors above to compare their proposals.
              </div>
            )}
          </div>
        )}

        {/* ── TAB: EVALUATION ─────────────────────────────────────────── */}
        {activeTab === "evaluation" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {evalLoading && <div style={{ color: C.textTer, fontSize: 13, padding: "24px 0" }}>Loading evaluation…</div>}

            {/* Create form */}
            {!evalLoading && canCreateEval && !evaluation && (
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Create Commercial Evaluation Report</h3>
                <p style={{ fontSize: 12, color: C.textTer, marginTop: -8, marginBottom: 16 }}>
                  Summarise the evaluation, select the recommended vendor(s), and submit for Bidcom review.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={styles.label}>Recommended Vendor(s) <span style={styles.required}>*</span></label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                      {invitedVendors.filter(vi => vi.latest).map(vi => {
                        const checked = evalForm.recommendedVendorIds.includes(vi.vendor_id);
                        const name = vi.vendor?.vendor_company_info?.company_name || `Vendor ${vi.vendor_id}`;
                        return (
                          <label key={vi.vendor_id}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${checked ? C.coral : C.border}`, background: checked ? C.coralLight : C.white, cursor: "pointer", fontSize: 12, fontWeight: checked ? 600 : 400, color: checked ? C.coral : C.textPri, transition: "all 0.15s" }}>
                            <input type="checkbox" checked={checked}
                              onChange={() => setEvalForm(prev => ({
                                ...prev,
                                recommendedVendorIds: checked ? prev.recommendedVendorIds.filter(id => id !== vi.vendor_id) : [...prev.recommendedVendorIds, vi.vendor_id]
                              }))}
                              style={{ accentColor: C.coral }} />
                            <span>{name}</span>
                            {vi.latest?.total_amount && <span style={{ marginLeft: "auto", fontSize: 11, color: C.textTer }}>{fmt(vi.latest.total_amount)}</span>}
                          </label>
                        );
                      })}
                    </div>
                    {invitedVendors.filter(vi => vi.latest).length === 0 && (
                      <div style={{ fontSize: 12, color: C.textTer, fontStyle: "italic", marginTop: 4 }}>No proposals submitted yet. Wait for vendor submissions before creating a CER.</div>
                    )}
                  </div>
                  <div>
                    <label style={styles.label}>Award Amount (₱) <span style={styles.required}>*</span></label>
                    <input type="number" min="0" step="0.01" value={evalForm.awardAmount}
                      onChange={e => setEvalForm(prev => ({ ...prev, awardAmount: e.target.value }))}
                      placeholder="e.g. 350000.00" style={{ ...styles.input, maxWidth: 280 }}
                      onFocus={e => e.target.style.borderColor = C.coral}
                      onBlur={e => e.target.style.borderColor = C.border} />
                    {evalForm.awardAmount && !isNaN(parseFloat(evalForm.awardAmount)) && (
                      <p style={{ ...styles.hint, color: parseFloat(evalForm.awardAmount) > 500000 ? C.amberText : C.greenText }}>
                        {parseFloat(evalForm.awardAmount) > 500000
                          ? "Amount exceeds ₱500,000 — requires Bidcom 1 + Bidcom 2 approval."
                          : "Amount ≤ ₱500,000 — requires Bidcom 1 approval only."}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={styles.label}>Justification / Basis for Recommendation <span style={styles.required}>*</span></label>
                    <textarea rows={5} value={evalForm.reason}
                      onChange={e => setEvalForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Explain why this vendor was selected — price, qualifications, delivery timeline, track record, etc."
                      style={{ ...styles.input, resize: "vertical" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button style={{ ...styles.btnPrimary, opacity: evalSaving ? 0.75 : 1 }} disabled={evalSaving} onClick={submitEvaluation}>
                      {evalSaving ? "Submitting…" : "Submit for Bidcom Review"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!evalLoading && !canCreateEval && !evaluation && (
              <div style={{ textAlign: "center", color: C.textTer, fontSize: 13, padding: "48px 0" }}>
                {submittedCount === 0
                  ? "No proposals have been submitted yet. The evaluation report will be available once vendors submit proposals."
                  : "The evaluation report will be created by the PR Reviewer."}
              </div>
            )}

            {/* Evaluation detail */}
            {!evalLoading && evaluation && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Header card */}
                <div style={{ ...styles.card, background: evaluation.status === "Approved" ? "#F0FDF4" : evaluation.status === "Returned" ? "#FEF2F2" : C.white }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>Commercial Evaluation Report</span>
                        <span style={{
                          ...styles.badge(evaluation.status === "Approved" ? "Approved" : evaluation.status === "Returned" ? "Returned" : "Pending"),
                          fontSize: 11,
                        }}>{evaluation.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.textTer }}>
                        Prepared by {evaluation.profiles?.full_name || "—"} · {fmtShort(evaluation.created_at)}
                      </div>
                    </div>
                    <button onClick={printReport}
                      style={{ ...styles.btnGhost, padding: "6px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name="download" size={13} color={C.textTer} /> Print / Export
                    </button>
                  </div>
                </div>

                {/* Recommended vendors + amounts */}
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Recommendation</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Recommended Vendor(s)</div>
                      {invitedVendors.filter(vi => (evaluation.recommended_vendor_ids || []).includes(vi.vendor_id)).map(vi => (
                        <div key={vi.vendor_id} style={{ fontSize: 13, fontWeight: 600, color: C.textPri, marginBottom: 2 }}>
                          {vi.vendor?.vendor_company_info?.company_name || "—"}
                          {vi.vendor?.subcontractor_class && <span style={{ marginLeft: 6, fontSize: 11, background: C.coralMid, color: C.coralDark, borderRadius: 99, padding: "1px 7px", fontWeight: 600 }}>{vi.vendor.subcontractor_class}</span>}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Award Amount</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.textPri }}>{fmt(evaluation.award_amount)}</div>
                      {evaluation.award_amount > 500000
                        ? <div style={{ fontSize: 11, color: C.amberText, marginTop: 2 }}>Requires Bidcom 1 + Bidcom 2 approval</div>
                        : <div style={{ fontSize: 11, color: C.greenText, marginTop: 2 }}>Requires Bidcom 1 approval only</div>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Justification / Basis</div>
                    <div style={{ fontSize: 13, color: C.textPri, background: C.offWhite, borderRadius: 8, padding: "12px 14px", lineHeight: 1.6 }}>{evaluation.reason}</div>
                  </div>
                </div>

                {/* Vendor comparison snapshot */}
                {invitedVendors.filter(vi => vi.latest).length > 0 && (
                  <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Participating Vendors</h3>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.offWhite }}>
                          {["Vendor", "Class", "Proposal Amount", ""].map(h => (
                            <th key={h} style={{ textAlign: h === "Proposal Amount" ? "right" : "left", padding: "7px 12px", fontWeight: 600, color: C.textTer, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {invitedVendors.filter(vi => vi.latest).map((vi, i) => {
                          const isRec = (evaluation.recommended_vendor_ids || []).includes(vi.vendor_id);
                          return (
                            <tr key={vi.vendor_id} style={{ borderBottom: i < invitedVendors.filter(v => v.latest).length - 1 ? `1px solid ${C.border}` : "none", background: isRec ? "#F0FDF4" : "transparent" }}>
                              <td style={{ padding: "8px 12px", fontWeight: isRec ? 600 : 400, color: C.textPri }}>
                                {vi.vendor?.vendor_company_info?.company_name || "—"}
                              </td>
                              <td style={{ padding: "8px 12px", color: C.textSec }}>{vi.vendor?.subcontractor_class || "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: isRec ? 700 : 400, color: isRec ? C.greenText : C.textPri }}>
                                {vi.latest?.total_amount ? fmt(vi.latest.total_amount) : "—"}
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "right" }}>
                                {isRec && <span style={{ fontSize: 11, background: "#D1FAE5", color: C.greenText, borderRadius: 99, padding: "2px 8px", fontWeight: 600 }}>Recommended</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Approval chain */}
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Approval Chain</h3>
                  {(() => {
                    const steps = [
                      { label: "PR Reviewer", sublabel: "Preparer", done: true, action: "Prepared", name: evaluation.profiles?.full_name, date: evaluation.created_at, notes: null },
                      { label: "Bidcom 1", sublabel: "Finance Head", done: !!evalApprovals.find(a => a.role_label === "Bidcom 1"), action: evalApprovals.find(a => a.role_label === "Bidcom 1")?.action_type, name: evalApprovals.find(a => a.role_label === "Bidcom 1")?.profiles?.full_name, date: evalApprovals.find(a => a.role_label === "Bidcom 1")?.actioned_at, notes: evalApprovals.find(a => a.role_label === "Bidcom 1")?.notes },
                      ...(evaluation.award_amount > 500000 ? [{ label: "Bidcom 2", sublabel: "President", done: !!evalApprovals.find(a => a.role_label === "Bidcom 2"), action: evalApprovals.find(a => a.role_label === "Bidcom 2")?.action_type, name: evalApprovals.find(a => a.role_label === "Bidcom 2")?.profiles?.full_name, date: evalApprovals.find(a => a.role_label === "Bidcom 2")?.actioned_at, notes: evalApprovals.find(a => a.role_label === "Bidcom 2")?.notes }] : []),
                    ];
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {steps.map((step, si) => {
                          const isPending = !step.done;
                          const isActive = evaluation.status === `Pending ${step.label}`;
                          const isReturned = step.action === "Returned";
                          const dotColor = isReturned ? C.redText : step.done ? C.greenText : isActive ? C.coral : C.textTer;
                          const dotBg = isReturned ? "#FEE2E2" : step.done ? "#D1FAE5" : isActive ? C.coralLight : C.offWhite;
                          return (
                            <div key={step.label} style={{ display: "flex", gap: 14 }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: dotBg, border: `2px solid ${dotColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                  {step.done && !isReturned && <Icon name="check" size={14} color={dotColor} />}
                                  {isReturned && <Icon name="warning" size={14} color={dotColor} />}
                                  {!step.done && <span style={{ fontSize: 11, fontWeight: 600, color: dotColor }}>{si + 1}</span>}
                                </div>
                                {si < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 20, background: step.done ? C.greenText : C.border, opacity: step.done ? 0.4 : 1, margin: "4px 0" }}></div>}
                              </div>
                              <div style={{ paddingBottom: si < steps.length - 1 ? 20 : 0, flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>{step.label}</span>
                                  <span style={{ fontSize: 11, color: C.textTer }}>· {step.sublabel}</span>
                                  {step.done && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: isReturned ? C.redText : C.greenText, background: isReturned ? "#FEE2E2" : "#D1FAE5", borderRadius: 99, padding: "1px 8px" }}>{step.action}</span>
                                  )}
                                  {isActive && <span style={{ fontSize: 11, color: C.coral, fontWeight: 600 }}>· Awaiting action</span>}
                                  {isPending && !isActive && <span style={{ fontSize: 11, color: C.textTer }}>· Pending</span>}
                                </div>
                                {step.name && <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{step.name}{step.date ? ` · ${fmtShort(step.date)}` : ""}</div>}
                                {step.notes && <div style={{ fontSize: 12, color: C.textSec, background: C.offWhite, borderRadius: 6, padding: "6px 10px", marginTop: 6, fontStyle: "italic" }}>"{step.notes}"</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Action buttons for current approver */}
                {canActOnEval && (
                  <div style={{ background: C.coralLight, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.coral }}>Your action is required</div>
                      <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>Review the Commercial Evaluation Report and approve or return it.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setShowActionModal("return")}
                        style={{ ...styles.btnSecondary, color: C.redText, borderColor: "#FCA5A5", fontWeight: 600 }}>Return</button>
                      <button onClick={() => setShowActionModal("approve")}
                        style={{ ...styles.btnPrimary, background: C.greenText, borderColor: C.greenText }}>Approve</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval action modal */}
      {showActionModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowActionModal(null); setEvalActionNotes(""); } }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>{showActionModal === "approve" ? "Approve Evaluation Report" : "Return Evaluation Report"}</div>
              <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>
                {showActionModal === "approve"
                  ? evaluation?.award_amount > 500000 && evaluation?.status === "Pending Bidcom 1"
                    ? "This will forward the report to Bidcom 2 for final approval (amount > ₱500,000)."
                    : "This will mark the evaluation as fully approved."
                  : "The report will be returned to the PR Reviewer for revision."}
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <label style={styles.label}>{showActionModal === "return" ? "Reason for returning " : "Notes"} {showActionModal === "return" && <span style={styles.required}>*</span>}</label>
              <textarea rows={4} value={evalActionNotes} onChange={e => setEvalActionNotes(e.target.value)}
                placeholder={showActionModal === "return" ? "Explain what needs to be revised…" : "Optional remarks…"}
                style={{ ...styles.input, resize: "vertical" }} />
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8, background: C.offWhite }}>
              <button style={styles.btnSecondary} onClick={() => { setShowActionModal(null); setEvalActionNotes(""); }}>Cancel</button>
              <button
                disabled={evalSaving || (showActionModal === "return" && !evalActionNotes.trim())}
                onClick={() => handleApproval(showActionModal === "approve" ? "Approved" : "Returned")}
                style={{ ...(showActionModal === "approve" ? { ...styles.btnPrimary, background: C.greenText } : { ...styles.btnSecondary, color: C.redText, borderColor: "#FCA5A5", fontWeight: 600 }), opacity: evalSaving ? 0.75 : 1 }}>
                {evalSaving ? "Saving…" : showActionModal === "approve" ? "Confirm Approval" : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── VENDORS PAGE ─────────────────────────────────────────────────────────────
function VendorsPage({ profile }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorFormPage, setVendorFormPage] = useState(false);
  const [formActiveTab, setFormActiveTab] = useState("hub");
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tradeFilter, setTradeFilter] = useState("All");
  const [tradeCatOptions, setTradeCatOptions] = useState([]);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(false);
  const [activeCard, setActiveCard] = useState(null);

  const vendorCardStatusMap = {
    "Submitted":    ["Submitted"],
    "Under Review": ["Under Review"],
    "Returned":     ["Returned"],
    "Accredited":   ["Accredited"],
  };

  const canManage = can(profile, "vendor.add");
  const [classRules, setClassRules] = useState(null);


  // ── Import ──
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail]         = useState("");
  const [inviteLink, setInviteLink]           = useState("");
  const [inviteLoading, setInviteLoading]     = useState(false);
  const [inviteCount, setInviteCount]         = useState(0);

  useEffect(() => {
    fetchVendors();
    fetchClassRules();
    supabase.from("vendor_accreditation_tokens").select("*", { count: "exact", head: true })
      .then(({ count }) => setInviteCount(count || 0));
    supabase.from("trade_categories").select("name").eq("is_approved", true).order("display_order").order("name")
      .then(({ data }) => setTradeCatOptions((data || []).map(t => t.name)));
  }, []);

  const fetchClassRules = async () => {
    const { data } = await supabase.from("settings").select("value").eq("key", "classification_rules").maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        setClassRules({ ...DEFAULT_CLASS_RULES, ...parsed, classC: parsed.classC || DEFAULT_CLASS_RULES.classC });
      } catch { setClassRules(DEFAULT_CLASS_RULES); }
    } else {
      setClassRules(DEFAULT_CLASS_RULES);
    }
  };

  const fetchVendors = async () => {
  setLoading(true);
  const { data, error } = await supabase
    .from("vendors")
    .select("id, vendor_code, accreditation_status, subcontractor_class, return_notes, reviewed_at, accredited_at, created_at, profile_id")
    .order("created_at", { ascending: false });

  if (error) { console.error("Vendors error:", error); setLoading(false); return; }

  if (data && data.length > 0) {
    const vendorCodes = data.map(v => vendorRef(v));
    const profileIds = data.map(v => v.profile_id).filter(Boolean);
    const [ciRes, profRes, expRes] = await Promise.all([
      supabase.from("vendor_company_info").select("vendor_id, company_name, rfq_email, cell_number, primary_activity, trade_categories, registered_address, telephone, contact_person, contact_position, authorized_representative, representative_title").in("vendor_id", vendorCodes),
      profileIds.length > 0 ? supabase.from("profiles").select("id, full_name, position").in("id", profileIds) : Promise.resolve({ data: [] }),
      supabase.from("vendor_doc_expiry").select("vendor_id, doc_type, expiry_date").in("vendor_id", vendorCodes).not("expiry_date", "is", null),
    ]);
    const ciMap = {};
    (ciRes.data || []).forEach(ci => { ciMap[ci.vendor_id] = ci; });
    const profMap = {};
    (profRes.data || []).forEach(p => { profMap[p.id] = p; });
    const expMap = {};
    (expRes.data || []).forEach(r => { if (!expMap[r.vendor_id]) expMap[r.vendor_id] = []; expMap[r.vendor_id].push(r); });
    const enriched = data.map(v => ({
      ...v,
      vendor_company_info: ciMap[vendorRef(v)] || null,
      profiles: profMap[v.profile_id] || null,
      vendor_doc_expiry: expMap[vendorRef(v)] || [],
    }));
    setVendors(enriched);
  } else {
    setVendors([]);
  }
  setLoading(false);
};

  const openDetail = async (v) => {
  const vid = v.id;
  const vcode = vendorRef(v);
  const [base, ci, ow, pj, cl, co, af, hq, rg, docs, prof, expRows] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", vid).single(),
    supabase.from("vendor_company_info").select("*").eq("vendor_id", vcode).maybeSingle(),
    supabase.from("vendor_owners").select("*").eq("vendor_id", vcode).order("id"),
    supabase.from("vendor_projects").select("*").eq("vendor_id", vcode).order("sort_order"),
    supabase.from("vendor_clients").select("*").eq("vendor_id", vcode).order("sort_order"),
    supabase.from("vendor_contacts").select("*").eq("vendor_id", vcode).order("sort_order"),
    supabase.from("vendor_affiliates").select("*").eq("vendor_id", vcode),
    supabase.from("vendor_hseq").select("*").eq("vendor_id", vcode).maybeSingle(),
    supabase.from("vendor_registration").select("*").eq("vendor_id", vcode).maybeSingle(),
    supabase.from("vendor_documents").select("*").eq("vendor_id", vcode),
    v.profile_id ? supabase.from("profiles").select("id, full_name, position").eq("id", v.profile_id).single() : Promise.resolve({ data: null }),
    supabase.from("vendor_doc_expiry").select("*").eq("vendor_id", vcode),
  ]);
  const enriched = {
    ...base.data,
    vendor_company_info: ci.data || null,
    vendor_owners:       ow.data || [],
    vendor_projects:     pj.data || [],
    vendor_clients:      cl.data || [],
    vendor_contacts:     co.data || [],
    vendor_affiliates:   af.data || [],
    vendor_hseq:         hq.data || null,
    vendor_registration: rg.data || null,
    vendor_documents:    docs.data || [],
    profiles:            prof.data || null,
    vendor_doc_expiry:   expRows.data || [],
  };
  setSelectedVendor(enriched);
  setVendorFormPage(true);
  setFormActiveTab("hub");
};

  const updateStatus = async (vendorId, status, extra = {}) => {
    setUpdating(true);
    await supabase.from("vendors").update({
      accreditation_status: status,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      accredited_at: status === "Accredited" ? new Date().toISOString() : null,
      // Write the vendor_code to DB for the first time when accrediting
      ...(status === "Accredited" ? { vendor_code: venCode(vendorId) } : {}),
      ...extra,
    }).eq("id", vendorId);
    fetchVendors();
    if (selectedVendor?.id === vendorId) {
      const { data } = await supabase.from("vendors").select("*").eq("id", vendorId).single();
      setSelectedVendor(prev => ({ ...prev, ...data }));
    }
    const vendorEmail = selectedVendor?.vendor_company_info?.rfq_email;
    const companyName = selectedVendor?.vendor_company_info?.company_name || "Vendor";
    if (vendorEmail && ["Accredited", "Returned", "Declined"].includes(status)) {
      // For returned vendors, look up their unique accreditation link.
      // vendor_accreditation_tokens.vendor_id stores the VEN code string (e.g. "VEN-000001"),
      // not the integer id — so query by that code. Pre-accreditation, vendor_code in DB may
      // be null, so fall back to computing it from the integer id.
      let accreditationUrl = null;
      if (status === "Returned") {
        const vendorCode = selectedVendor?.vendor_code || venCode(vendorId);
        const { data: tokenRows } = await supabase
          .from("vendor_accreditation_tokens")
          .select("token")
          .eq("vendor_id", vendorCode)
          .order("created_at", { ascending: false })
          .limit(1);
        const tok = tokenRows?.[0]?.token;
        if (tok) {
          accreditationUrl = `${window.location.origin}/vendor/accreditation/${tok}`;
        }
      }
      const messages = {
        Accredited: {
          subject: "Congratulations! Your Accreditation Has Been Approved",
          body: `<p>Dear <strong>${companyName}</strong>,</p>
            <p>We are pleased to inform you that your vendor accreditation has been <strong style="color:#3B6D11;">approved</strong>.</p>
            <p>You are now an accredited vendor in our Commercial & Contract Management System and may receive invitations to submit proposals.</p>`,
        },
        Returned: {
          subject: "Action Required: Accreditation Application Returned",
          body: `<p>Dear <strong>${companyName}</strong>,</p>
            <p>Your vendor accreditation application has been <strong style="color:#92580A;">returned</strong> for corrections.</p>
            <p><strong>Notes from our team:</strong></p>
            <blockquote style="border-left:3px solid #3F3F3F;padding-left:12px;color:#555;">${extra.return_notes || ""}</blockquote>
            ${accreditationUrl
              ? `<p>Please use the link below to update your application and resubmit:</p>
                 <p style="margin:24px 0;">
                   <a href="${accreditationUrl}" style="background:#D85C2A;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">Update My Application</a>
                 </p>
                 <p style="font-size:12px;color:#999;">Or copy this link into your browser:<br/>
                   <a href="${accreditationUrl}" style="color:#D85C2A;word-break:break-all;">${accreditationUrl}</a>
                 </p>`
              : `<p>Please contact our procurement team to retrieve your application link and resubmit.</p>`
            }`,
        },
        Declined: {
          subject: "Accreditation Application Update",
          body: `<p>Dear <strong>${companyName}</strong>,</p>
            <p>After careful review, we regret to inform you that your vendor accreditation application has been <strong style="color:#B91C1C;">declined</strong> at this time.</p>
            <p>For questions, please contact our procurement team.</p>`,
        },
      };
      const { subject, body } = messages[status];
      await sendEmail(vendorEmail, subject,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#3F3F3F;">Vendor Accreditation Update</h2>
          ${body}
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="font-size:11px;color:#aaa;">Commercial & Contract Management System</p>
        </div>`
      );
    }
    setUpdating(false);
    setShowReturnModal(false);
    setReturnNotes("");
  };

  const handleReturn = async () => {
    if (!returnNotes.trim()) { alert("Please enter return notes explaining what needs to be corrected."); return; }
    await updateStatus(selectedVendor.id, "Returned", { return_notes: returnNotes });
  };


  const downloadVendorTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Company Name", "Primary Activity / Trade", "Address", "Telephone", "Cell Number", "Email", "Contact Person", "Contact Position", "Authorized Representative", "Representative Title", "Status"],
      ["ABC Construction Corp.", "General Construction", "123 Main St., Quezon City", "(02) 8123-4567", "09171234567", "abc@example.com", "Juan Santos", "Project Coordinator", "Maria Reyes", "General Manager", "Accredited"],
      ["XYZ Electrical Services", "Electrical Works",    "456 Rizal Ave., Manila",    "",               "09281234567", "xyz@example.com", "Pedro Cruz",  "Site Engineer",       "Roberto Cruz",  "President",        "Accredited"],
    ]);
    ws["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 14 }];
    const wsI = XLSX.utils.aoa_to_sheet([
      ["INSTRUCTIONS"],
      ["Fill in the 'Vendors' sheet only. Do NOT modify column headers."],
      ["Company Name — required."],
      ["Primary Activity / Trade — e.g. General Construction, Electrical Works, Plumbing."],
      ["Address — registered business address."],
      ["Telephone — landline number, optional."],
      ["Cell Number — mobile number."],
      ["Email — used for RFQ notifications."],
      ["Contact Person — day-to-day coordinator (calls, site queries)."],
      ["Contact Position — job title of Contact Person."],
      ["Authorized Representative — person who signs contracts, NOA, and Term Sheet. Required for document generation."],
      ["Representative Title — e.g. General Manager, President, VP Operations."],
      ["Status — Accredited, Under Review, Draft. Defaults to Accredited if blank."],
    ]);
    wsI["!cols"] = [{ wch: 80 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws,  "Vendors");
    XLSX.utils.book_append_sheet(wb, wsI, "Instructions");
    XLSX.writeFile(wb, "vendors-import-template.xlsx");
  };

  const handleVendorImport = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "binary" });
      const ws = wb.Sheets["Vendors"] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const VALID_STATUSES = ["Accredited", "Under Review", "Draft", "Submitted", "Returned", "Declined"];
      const parsed = rows.map(r => {
        const name = (r["Company Name"] || "").trim();
        const status = VALID_STATUSES.includes(r["Status"]) ? r["Status"] : "Accredited";
        return { company_name: name, primary_activity: (r["Primary Activity / Trade"] || "").trim(), address: (r["Address"] || "").trim(), telephone: (r["Telephone"] || "").trim(), cell_number: (r["Cell Number"] || "").trim(), rfq_email: (r["Email"] || "").trim(), contact_person: (r["Contact Person"] || "").trim(), contact_position: (r["Contact Position"] || "").trim(), authorized_representative: (r["Authorized Representative"] || "").trim(), representative_title: (r["Representative Title"] || "").trim(), accreditation_status: status, error: !name ? "Company Name is required" : null };
      }).filter(r => r.company_name || r.error);
      setImportRows(parsed);
      setShowImportPreview(true);
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    setImporting(true);
    for (const row of importRows.filter(r => !r.error)) {
      const { data: vRow } = await supabase.from("vendors").insert({ accreditation_status: row.accreditation_status, profile_id: null }).select("id, vendor_code").single();
      if (vRow) await supabase.from("vendor_company_info").insert({ vendor_id: vendorRef(vRow), company_name: row.company_name, primary_activity: row.primary_activity, registered_address: row.address, telephone: row.telephone, cell_number: row.cell_number, rfq_email: row.rfq_email, contact_person: row.contact_person, contact_position: row.contact_position, authorized_representative: row.authorized_representative, representative_title: row.representative_title });
    }
    setImporting(false);
    setShowImportPreview(false);
    setImportRows([]);
    fetchVendors();
  };

  const handleGenerateInvite = async () => {
    if (!inviteEmail.trim()) { alert("Please enter the vendor's email address."); return; }
    setInviteLoading(true);

    // Reuse existing token if one already exists for this email
    const { data: existing } = await supabase
      .from("vendor_accreditation_tokens")
      .select("token")
      .eq("invited_email", inviteEmail.trim())
      .maybeSingle();

    let createdToken = null;
    if (!existing?.token) {
      const { data, error } = await supabase
        .from("vendor_accreditation_tokens")
        .insert({ invited_email: inviteEmail.trim(), created_by: profile.id })
        .select("token")
        .single();
      if (error || !data) { setInviteLoading(false); alert("Failed to generate link: " + (error?.message || "unknown error")); return; }
      createdToken = data.token;
    }
    const token = pickToken(existing?.token, createdToken);
    const url = buildInviteUrl(window.location.origin, token);
    setInviteLink(url);
    await sendEmail(
      inviteEmail.trim(),
      "Vendor Accreditation Invitation – Commercial & Contract Management System",
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#3F3F3F;">Vendor Accreditation Invitation</h2>
        <p>You have been invited to submit your accreditation to our Commercial & Contract Management System.</p>
        <p>Please click the link below to fill in your company details and upload the required documents:</p>
        <p style="margin:24px 0;">
          <a href="${url}" style="background:#3F3F3F;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            Start Accreditation
          </a>
        </p>
        <p style="font-size:12px;color:#888;">Or copy this link: ${url}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:11px;color:#aaa;">This invitation was sent by ${profile?.full_name || "the procurement team"}.</p>
      </div>`
    );
    setInviteLoading(false);
  };

  const filtered = vendors.filter(v => {
    const name = v.vendor_company_info?.company_name || v.profiles?.full_name || "";
    const matchSearch = name.toLowerCase().includes(search.toLowerCase());
    let matchStatus;
    if (activeCard && activeCard !== "Total") {
      matchStatus = (vendorCardStatusMap[activeCard] || []).includes(v.accreditation_status);
    } else if (activeCard === "Total") {
      matchStatus = true;
    } else {
      matchStatus = statusFilter === "All" || v.accreditation_status === statusFilter;
    }
    let matchTrade = true;
    if (tradeFilter !== "All") {
      const cats = v.vendor_company_info?.trade_categories || [];
      const legacy = v.vendor_company_info?.primary_activity || "";
      matchTrade = cats.includes(tradeFilter) || legacy === tradeFilter;
    }
    return matchSearch && matchStatus && matchTrade;
  });

  const fmtCurrency = (n) => n ? `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—";
  const fmt = (d) => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const STATUSES = ["All", "Draft", "Submitted", "Under Review", "Returned", "Accredited", "Declined"];
  const STATUS_COLORS = {
    "Draft":        { bg: "#F1F0EE", color: "#5F5E5A" },
    "Submitted":    { bg: "#E6F4EF", color: "#0F6E56" },
    "Under Review": { bg: "#EEF2FF", color: "#4338CA" },
    "Returned":     { bg: "#FEF3E2", color: "#92580A" },
    "Accredited":   { bg: "#EAF3DE", color: "#3B6D11" },
    "Declined":     { bg: "#FDEDED", color: "#B91C1C" },
  };

  const badge = (status) => {
    const s = STATUS_COLORS[status] || STATUS_COLORS["Draft"];
    return { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: "nowrap" };
  };

  return (
    <>
      <div style={styles.topBar}>
                <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btnGhost} onClick={downloadVendorTemplate}>⬇ Download Template</button>
          {canManage && (
            <>
              <label style={{ ...styles.btnSecondary, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                ↑ Import Excel
                <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => { handleVendorImport(e.target.files[0]); e.target.value = ""; }} />
              </label>
              <button style={styles.btnSecondary} onClick={() => { setShowInviteModal(true); setInviteEmail(""); setInviteLink(""); }}>
                Invite Vendor for Accreditation
              </button>
            </>
          )}
        </div>
      </div>


      {/* ── Import Preview Modal ── */}
      {showImportPreview && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 640, maxHeight: "80vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 6 }}>Import Preview</div>
            <div style={{ fontSize: 12, color: C.textSec, marginBottom: 16 }}>{importRows.filter(r => !r.error).length} vendor(s) ready to import{importRows.some(r => r.error) ? `, ${importRows.filter(r => r.error).length} with errors (will be skipped)` : ""}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {["Company Name", "Trade", "Auth. Representative", "Contact Person", "Status", ""].map(h => <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {importRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: r.error ? "#FEF2F2" : "transparent" }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600 }}>{r.company_name}</td>
                    <td style={{ padding: "6px 10px", color: C.textSec }}>{r.primary_activity || "—"}</td>
                    <td style={{ padding: "6px 10px", color: C.textSec }}>{r.authorized_representative ? `${r.authorized_representative}${r.representative_title ? ` · ${r.representative_title}` : ""}` : "—"}</td>
                    <td style={{ padding: "6px 10px", color: C.textSec }}>{r.contact_person || "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{r.accreditation_status}</td>
                    <td style={{ padding: "6px 10px", color: r.error ? C.redText : "#15803D", fontWeight: 600 }}>{r.error || "✓"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button style={styles.btnGhost} onClick={() => { setShowImportPreview(false); setImportRows([]); }}>Cancel</button>
              <button style={styles.btnPrimary} onClick={confirmImport} disabled={importing || !importRows.some(r => !r.error)}>{importing ? "Importing…" : `Import ${importRows.filter(r => !r.error).length} Vendor(s)`}</button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.pageBody}>
  <div style={{ maxWidth: "80%", margin: "0 auto" }}>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
          {[
            { label: "Total",        value: inviteCount,                                                                       color: C.textPri,  desc: "Total invited vendors"    },
            { label: "Submitted",    value: vendors.filter(v => v.accreditation_status === "Submitted").length,    color: "#0F6E56",  desc: "Applications received"    },
            { label: "Under Review", value: vendors.filter(v => v.accreditation_status === "Under Review").length, color: "#4338CA",  desc: "Being evaluated"           },
            { label: "Returned",     value: vendors.filter(v => v.accreditation_status === "Returned").length,     color: C.amberText,desc: "Returned for corrections"   },
            { label: "Accredited",   value: vendors.filter(v => v.accreditation_status === "Accredited").length,   color: C.greenText,desc: "Fully approved vendors"     },
          ].map(s => {
            const isActive = activeCard === s.label;
            return (
              <div key={s.label}
                onClick={() => setActiveCard(prev => prev === s.label ? null : s.label)}
                style={{
                  background: isActive ? C.coralLight : C.white,
                  border: `1px solid ${isActive ? C.coral : C.border}`,
                  borderRadius: 12, padding: "14px 18px",
                  boxShadow: isActive ? `0 0 0 2px ${C.coralMid}` : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
                  cursor: "pointer", userSelect: "none",
                  transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
                }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.coralDark : C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Search and filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={13} color={C.textTer} /></div>
            <input placeholder="Search by company name…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 30, fontSize: 12 }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...styles.input, width: "auto", fontSize: 12 }}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)} style={{ ...styles.input, width: "auto", fontSize: 12 }}>
            <option value="All">All Trades</option>
            {tradeCatOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)", overflow: "clip" }}>

          <div>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.coralMid }}>
                  {["Company", "Contact Person", "Primary Activity", "Class", "Status", "Date", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.coralDark, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.coralLight}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: C.textTer }}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "48px 0", color: C.textTer }}>No vendors found.</td></tr>}
                {!loading && filtered.map((v, i) => (
                  <tr key={v.id} onClick={() => openDetail(v)}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                    onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.textPri }}>{v.vendor_company_info?.company_name || v.profiles?.full_name || "—"}</div>
                      {v.vendor_code && <div style={{ fontSize: 11, fontWeight: 600, color: C.coral, marginTop: 1 }}>{v.vendor_code}</div>}
                      {v.vendor_company_info?.registered_address && (
                        <div style={{ fontSize: 11, color: C.textTer, marginTop: 1 }}>📍 {v.vendor_company_info.registered_address}</div>
                      )}
                      <div style={{ fontSize: 11, color: C.textTer, marginTop: 1 }}>{v.vendor_company_info?.rfq_email || "—"}</div>
                    </td>
                    <td style={{ padding: "9px 14px", color: C.textSec }}>{v.profiles?.full_name || "—"}</td>
                    <td style={{ padding: "9px 14px" }}>
                      {(() => {
                        const cats = v.vendor_company_info?.trade_categories || [];
                        const legacy = v.vendor_company_info?.primary_activity;
                        if (cats.length > 0) return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {cats.map(c => <span key={c} style={{ fontSize: 10, fontWeight: 500, background: C.coralMid, color: C.coralDark, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" }}>{c}</span>)}
                          </div>
                        );
                        return <span style={{ fontSize: 12, color: C.textSec }}>{legacy || "—"}</span>;
                      })()}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      {v.subcontractor_class
                        ? <span style={{ background: C.coralMid, color: C.coralDark, padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{v.subcontractor_class}</span>
                        : <span style={{ color: C.textTer, fontSize: 11 }}>Unassigned</span>}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      {(() => {
                        const expRows = v.vendor_doc_expiry || [];
                        const todayMs = new Date().setHours(0, 0, 0, 0);
                        let hasExpired = false, hasExpiring = false;
                        for (const r of expRows) {
                          if (!r.expiry_date) continue;
                          const days = Math.round((new Date(r.expiry_date).setHours(0,0,0,0) - todayMs) / 86400000);
                          if (days < 0) { hasExpired = true; break; }
                          if (days <= 40) hasExpiring = true;
                        }
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={badge(v.accreditation_status)}>{v.accreditation_status}</span>
                            {hasExpired
                              ? <span title="Document expired" style={{ fontSize: 10, color: C.redText, lineHeight: 1 }}>●</span>
                              : hasExpiring
                                ? <span title="Document expiring soon" style={{ fontSize: 12, color: C.amberText, lineHeight: 1 }}>⚠</span>
                                : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "9px 14px", color: C.textSec, whiteSpace: "nowrap" }}>{fmt(v.created_at)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}><Icon name="chevronRight" size={14} color={C.textTer} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textTer }}>Showing {filtered.length} of {vendors.length} vendors</span>
            <button onClick={fetchVendors} style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }}>Refresh</button>
          </div>
        </div>
        </div>
        </div>

      {/* Vendor Full-Page Form View */}
      {vendorFormPage && selectedVendor && (() => {
        const ci   = selectedVendor.vendor_company_info || {};
        const docs = selectedVendor.vendor_documents || [];
        // Map doc_type → vendor_doc_expiry row (expiry date, reg number, reg date)
        const docExpMap = Object.fromEntries(
          (selectedVendor.vendor_doc_expiry || []).map(r => [r.doc_type, r])
        );

        // Read-only style shortcuts
        const roCard  = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px 20px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
        const roCT    = { fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 20 };
        const roLbl   = { fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 4, display: "block" };
        const roIn    = { border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, background: C.offWhite, color: C.textPri, width: "100%", boxSizing: "border-box", cursor: "default", outline: "none", fontFamily: "inherit" };
        const gap14   = { display: "flex", flexDirection: "column", gap: 14 };

        const DocRowV = ({ docType, label: lbl2 }) => {
          const doc = docs.find(d => d.document_type === docType);
          const exp = docExpMap[docType];
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: doc ? C.greenBg : C.offWhite, border: `1px solid ${doc ? "#86EFAC" : C.border}`, borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: doc ? C.greenText : C.borderMid, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.textPri }}>{lbl2 || docType}</div>
                  {doc  && <div style={{ fontSize: 11, color: C.greenText, marginTop: 1 }}>{doc.file_name}</div>}
                  {!doc && <div style={{ fontSize: 11, color: C.textTer,  marginTop: 1 }}>Not uploaded</div>}
                  {exp?.reg_number && <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>Cert. No. {exp.reg_number}{exp.reg_date ? ` · Reg. ${exp.reg_date}` : ""}</div>}
                  {exp?.expiry_date && <div style={{ fontSize: 11, color: C.textSec, marginTop: 1 }}>Expires {exp.expiry_date}</div>}
                </div>
              </div>
              {doc && <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.coral, textDecoration: "none", fontWeight: 500 }}>View ↗</a>}
            </div>
          );
        };

        const YesNoV = ({ value }) => {
          const bVal = value === true || value === "yes" ? "yes" : (value === false || value === "no" ? "no" : null);
          return (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {["yes", "no"].map(v => (
                <div key={v} style={{ padding: "6px 20px", borderRadius: 8, border: `1.5px solid ${bVal === v ? C.coral : C.border}`, background: bVal === v ? C.coralLight : C.offWhite, color: bVal === v ? C.coralDark : C.textTer, fontWeight: 600, fontSize: 13, opacity: bVal === v ? 1 : 0.4, userSelect: "none" }}>
                  {v === "yes" ? "Yes" : "No"}
                </div>
              ))}
            </div>
          );
        };

        const TableV = ({ headers, rows }) => {
          const filled = (rows || []).filter(r => Object.values(r).some(v => v?.toString().trim()));
          if (!filled.length) return <div style={{ fontSize: 13, color: C.textTer, padding: "8px 0" }}>No entries</div>;
          return (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: headers.length > 3 ? 420 : undefined }}>
                <thead>
                  <tr style={{ background: C.offWhite }}>
                    {headers.map((h, i) => <th key={i} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSec, fontSize: 11, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filled.map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: ri < filled.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      {Object.values(row).map((v, ci2) => (
                        <td key={ci2} style={{ padding: "8px 10px", color: v?.toString().trim() ? C.textPri : C.textTer, verticalAlign: "top" }}>{v?.toString().trim() || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        };

        const TABS = [
          { key: "hub",            label: "Overview"    },
          { key: "company",        label: "Company Info" },
          { key: "tax_gov",        label: "Tax & Gov't" },
          { key: "fin_compliance", label: "Financials"  },
          { key: "declaration",    label: "Declaration" },
        ];

        return (
        <div style={{ position: "fixed", inset: 0, top: 56, background: C.offWhite, zIndex: 150, overflowY: "auto" }}>

          {/* ── Sticky admin bar ───────────────────────────────────────── */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.white, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => { setVendorFormPage(false); setFormActiveTab("hub"); }} style={{ ...styles.btnGhost, fontSize: 12, padding: "5px 12px", whiteSpace: "nowrap" }}>← Vendor List</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, overflow: "hidden" }}>
              {selectedVendor.vendor_code && <span style={{ fontSize: 11, fontWeight: 700, color: C.coral, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{selectedVendor.vendor_code}</span>}
              <span style={{ fontSize: 14, fontWeight: 600, color: C.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ci.company_name || selectedVendor.profiles?.full_name || "Vendor"}</span>
              <span style={badge(selectedVendor.accreditation_status)}>{selectedVendor.accreditation_status}</span>
            </div>
            {canManage && (<>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>Class:</span>
                <select value={selectedVendor.subcontractor_class || ""}
                  onChange={async e => {
                    await supabase.from("vendors").update({ subcontractor_class: e.target.value || null }).eq("id", selectedVendor.id);
                    setSelectedVendor(prev => ({ ...prev, subcontractor_class: e.target.value }));
                    fetchVendors();
                  }}
                  style={{ ...styles.input, width: "auto", fontSize: 12, padding: "5px 10px" }}>
                  <option value="">Unassigned</option>
                  <option value="Class A">Class A</option>
                  <option value="Class B">Class B</option>
                  <option value="Class C">Class C</option>
                </select>
              </div>
              {selectedVendor.accreditation_status === "Submitted" && (
                <button style={{ ...styles.btnGhost, fontSize: 12 }} disabled={updating} onClick={() => updateStatus(selectedVendor.id, "Under Review")}>Mark as Under Review</button>
              )}
              {["Submitted", "Under Review", "Returned"].includes(selectedVendor.accreditation_status) && (
                <button style={{ ...styles.btnDanger, padding: "7px 14px", fontSize: 12 }} disabled={updating}
                  onClick={() => { setReturnNotes(selectedVendor.return_notes || ""); setShowReturnModal(true); }}>
                  {selectedVendor.accreditation_status === "Returned" ? "✉ Resend return email" : "Return to vendor"}
                </button>
              )}
              {["Submitted", "Under Review"].includes(selectedVendor.accreditation_status) && (
                <button style={{ ...styles.btnSuccess, padding: "7px 14px", fontSize: 12 }} disabled={updating} onClick={() => updateStatus(selectedVendor.id, "Accredited")}>✓ Accredit vendor</button>
              )}
              {["Submitted", "Under Review"].includes(selectedVendor.accreditation_status) && (
                <button style={{ background: C.redBg, color: C.redText, border: `1px solid #FCA5A5`, borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }} disabled={updating} onClick={() => { if (confirm("Decline this vendor's accreditation?")) updateStatus(selectedVendor.id, "Declined"); }}>Decline</button>
              )}
            </>)}
          </div>

          {/* ── Content area ────────────────────────────────────────────── */}
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 60px" }}>

            {/* Return notes */}
            {selectedVendor.accreditation_status === "Returned" && selectedVendor.return_notes && (
              <div style={{ marginBottom: 16, padding: "12px 14px", background: "#FEF3E2", border: "1px solid #FCD34D", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.amberText, marginBottom: 4, textTransform: "uppercase" }}>Return Notes</div>
                <p style={{ margin: 0, fontSize: 13, color: C.textPri }}>{selectedVendor.return_notes}</p>
              </div>
            )}

            {/* Doc expiry notification banner */}
            {selectedVendor.accreditation_status === "Accredited" && (() => {
              const todayMs = new Date().setHours(0, 0, 0, 0);
              const flagged = (selectedVendor.vendor_doc_expiry || [])
                .filter(r => r.expiry_date)
                .map(r => {
                  const days = Math.round((new Date(r.expiry_date).setHours(0,0,0,0) - todayMs) / 86400000);
                  return { ...r, days };
                })
                .filter(r => r.days <= 40)
                .sort((a, b) => a.days - b.days);
              if (!flagged.length) return null;
              const hasExpired = flagged.some(r => r.days < 0);
              const vendorEmail = ci.rfq_email;
              return (
                <div style={{ marginBottom: 16, padding: "14px 16px", background: hasExpired ? C.redBg : "#FEF3E2", border: `1px solid ${hasExpired ? "#FCA5A5" : "#FCD34D"}`, borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: hasExpired ? C.redText : C.amberText, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        {hasExpired ? "Document(s) Expired" : "Document(s) Expiring Soon"}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {flagged.map(r => (
                          <div key={r.doc_type} style={{ fontSize: 12, color: C.textPri }}>
                            <span style={{ fontWeight: 500 }}>{r.doc_type}</span>
                            {" — "}
                            <span style={{ color: r.days < 0 ? C.redText : C.amberText }}>
                              {r.days < 0
                                ? `expired ${Math.abs(r.days)} day${Math.abs(r.days) === 1 ? "" : "s"} ago`
                                : r.days === 0 ? "expires today"
                                : `expires in ${r.days} day${r.days === 1 ? "" : "s"}`}
                            </span>
                            {" "}
                            <span style={{ color: C.textTer, fontSize: 11 }}>({r.expiry_date})</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: C.textSec, marginTop: 8 }}>
                        Auto-email notices are sent to the vendor at 40, 30, 7 days before and after expiry. Use Resend to send a manual reminder now.
                      </div>
                    </div>
                    {vendorEmail && (
                      <button
                        style={{ ...styles.btnSecondary, fontSize: 12, padding: "7px 14px", flexShrink: 0, whiteSpace: "nowrap" }}
                        onClick={async () => {
                          const companyName = ci.company_name || "Vendor";
                          const subject = `Action Required: Document Renewal — ${companyName}`;
                          const docRowsHtml = flagged.map(r =>
                            `<tr><td style="padding:8px 12px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#1A1917;">${r.doc_type}</td>` +
                            `<td style="padding:8px 12px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#92580A;">${r.days < 0 ? `Expired ${Math.abs(r.days)}d ago` : r.days === 0 ? "Expires today" : `Expires in ${r.days}d`}</td>` +
                            `<td style="padding:8px 12px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#6B6860;">${r.expiry_date}</td></tr>`
                          ).join("");
                          const html = `<!DOCTYPE html><html><body style="font-family:Calibri,Arial,sans-serif;background:#F8F7F5;margin:0;padding:0;">` +
                            `<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #E5E3DF;border-radius:12px;overflow:hidden;">` +
                            `<div style="background:#3F3F3F;padding:20px 24px;"><div style="font-size:16px;font-weight:700;color:#fff;">Document Renewal Required</div>` +
                            `<div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:3px;">PH1 World Developers Inc. — Vendor Accreditation</div></div>` +
                            `<div style="padding:20px 24px;"><p style="font-size:14px;color:#1A1917;margin:0 0 16px;">Dear <strong>${companyName}</strong>,</p>` +
                            `<p style="font-size:13px;color:#6B6860;line-height:1.6;margin:0 0 16px;">Your accreditation is active. However, the following documents require renewal. Please upload renewed copies through your accreditation portal link.</p>` +
                            `<table style="width:100%;border-collapse:collapse;border:1px solid #E5E3DF;border-radius:8px;overflow:hidden;margin-bottom:20px;">` +
                            `<thead><tr style="background:#F8F7F5;"><th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#A09D97;text-transform:uppercase;">Document</th>` +
                            `<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#A09D97;text-transform:uppercase;">Status</th>` +
                            `<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#A09D97;text-transform:uppercase;">Expiry Date</th></tr></thead>` +
                            `<tbody>${docRowsHtml}</tbody></table>` +
                            `<p style="font-size:12px;color:#A09D97;line-height:1.6;margin:0;">Please use the accreditation link sent to your email to upload the renewed documents. If you need assistance, contact us at procurement@ph1worlddevelopers.com.</p>` +
                            `</div></div></body></html>`;
                          await sendEmail(vendorEmail, subject, html);
                          // Log manual resend to vendor_doc_notifications
                          const vcode = vendorRef(selectedVendor);
                          await Promise.all(flagged.map(r =>
                            supabase.from("vendor_doc_notifications").upsert({
                              vendor_id: vcode,
                              doc_type:  r.doc_type,
                              trigger_day: r.days,
                              expiry_date_ref: r.expiry_date,
                              email_to: vendorEmail,
                            }, { onConflict: "vendor_id,doc_type,trigger_day,expiry_date_ref" })
                          ));
                          alert(`Reminder email sent to ${vendorEmail}`);
                        }}
                      >
                        ↺ Resend Email
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Classification recommendation */}
            {(() => {
              const rec = computeRecommendation(selectedVendor.vendor_documents, classRules);
              if (!rec) return null;
              return (
                <div style={{ background: rec.bg, border: `1px solid ${rec.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: rec.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>System Recommendation</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: rec.color }}>{rec.label}</div>
                      <div style={{ fontSize: 12, color: C.textSec, marginTop: 4, maxWidth: 480 }}>{rec.reason}</div>
                      {rec.missingDocs?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 4 }}>
                            {rec.action === "return" ? "Missing documents:" : rec.classification === "Class C" ? "Submit to qualify for Class B:" : rec.classification === "Class B" ? "Submit to qualify for Class A:" : "Documents needed:"}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {rec.missingDocs.map(d => <span key={d} style={{ fontSize: 11, background: "rgba(0,0,0,0.06)", color: C.textPri, padding: "2px 8px", borderRadius: 99 }}>{d}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                    {canManage && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        {rec.action === "classify" && (
                          <button style={{ ...styles.btnSuccess, fontSize: 12, padding: "7px 14px" }}
                            onClick={async () => {
                              await supabase.from("vendors").update({ subcontractor_class: rec.classification }).eq("id", selectedVendor.id);
                              setSelectedVendor(prev => ({ ...prev, subcontractor_class: rec.classification }));
                              fetchVendors();
                            }}>Accept — Assign {rec.classification}</button>
                        )}
                        {rec.action === "return" && (
                          <button style={{ ...styles.btnDanger, fontSize: 12, padding: "7px 14px" }}
                            onClick={() => { setReturnNotes(rec.returnNote || ""); setShowReturnModal(true); }}>Accept — Return to Vendor</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Tab strip ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
              {TABS.map((t, i) => (
                <button key={t.key} onClick={() => setFormActiveTab(t.key)}
                  style={{ flex: 1, padding: "10px 4px", border: "none", background: formActiveTab === t.key ? C.coral : "transparent", color: formActiveTab === t.key ? C.white : C.textSec, fontWeight: 600, fontSize: 11, cursor: "pointer", borderRight: i < TABS.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.15s", fontFamily: "inherit" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── HUB ─────────────────────────────────────────────────────── */}
            {formActiveTab === "hub" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { key: "company",        num: 1, label: "Company Information",     desc: "Business details, addresses, key personnel, trade categories & ID documents." },
                  { key: "tax_gov",        num: 2, label: "Tax & Government Docs",   desc: "TIN, tax classification, EWT entries, business registrations & valid IDs." },
                  { key: "fin_compliance", num: 3, label: "Financials & Compliance", desc: "Bank details, financial documents, H&S policy, QMS & environmental management." },
                  { key: "declaration",    num: 4, label: "Declaration",             desc: "Signatories and submission confirmation." },
                ].map(s => (
                  <div key={s.key} style={{ ...roCard, marginBottom: 0, display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.coralLight, color: C.coral, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{s.num}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{s.desc}</div>
                    </div>
                    <button onClick={() => setFormActiveTab(s.key)} style={{ ...styles.btnGhost, fontSize: 12, padding: "6px 14px", whiteSpace: "nowrap" }}>View →</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── COMPANY INFO ────────────────────────────────────────────── */}
            {formActiveTab === "company" && (<>

              <div style={roCard}>
                <div style={roCT}>Company Information</div>
                <div style={gap14}>
                  <div>
                    <label style={roLbl}>Company Name</label>
                    <input value={ci.company_name || ""} readOnly style={roIn} />
                  </div>
                  <div>
                    <label style={roLbl}>Registered / Main Office Address</label>
                    <textarea value={ci.registered_address || ""} readOnly rows={2} style={{ ...roIn, resize: "none" }} />
                    {ci.location_map_url && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                        <input value={ci.location_map_url} readOnly style={{ ...roIn, margin: 0, flex: 1 }} />
                        <a href={ci.location_map_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.coral, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>View map ↗</a>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={roLbl}>Satellite Office / Warehouse Address</label>
                    <textarea value={ci.satellite_address || ""} readOnly rows={2} style={{ ...roIn, resize: "none" }} />
                    {ci.satellite_map_url && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                        <input value={ci.satellite_map_url} readOnly style={{ ...roIn, margin: 0, flex: 1 }} />
                        <a href={ci.satellite_map_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.coral, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>View map ↗</a>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={roLbl}>Telephone Number</label>
                      <input value={ci.telephone || ""} readOnly style={roIn} />
                    </div>
                    <div>
                      <label style={roLbl}>Cell Number</label>
                      <input value={ci.cell_number || ""} readOnly style={roIn} />
                    </div>
                  </div>
                  <div>
                    <label style={roLbl}>Email Address(es)</label>
                    <input value={ci.rfq_email || ""} readOnly style={roIn} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={roLbl}>Contact Person</label>
                      <input value={ci.contact_person || ""} readOnly style={roIn} />
                    </div>
                    <div>
                      <label style={roLbl}>Position</label>
                      <input value={ci.contact_position || ""} readOnly style={roIn} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={roLbl}>Authorized Representative</label>
                      <input value={ci.authorized_representative || ""} readOnly style={roIn} />
                    </div>
                    <div>
                      <label style={roLbl}>Title</label>
                      <input value={ci.representative_title || ""} readOnly style={roIn} />
                    </div>
                  </div>
                  <div>
                    <label style={roLbl}>Valid Government IDs</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <DocRowV docType="Valid Government ID 1" label="Government ID — 1st" />
                      <DocRowV docType="Valid Government ID 2" label="Government ID — 2nd" />
                    </div>
                  </div>
                  <div>
                    <label style={roLbl}>List of Major Clients</label>
                    <TableV headers={["Client Name", "Location", "Projects / Products"]}
                      rows={(ci.client_list || []).map(r => ({ name: r.name || r.client_name, location: r.location, projects: r.projects || r.products_supplied }))} />
                  </div>
                  <div>
                    <label style={roLbl}>List of Equipment / Vehicles</label>
                    <TableV headers={["Equipment / Vehicle", "Qty", "Condition", "Owned / Leased"]}
                      rows={(ci.equipment_list || []).map(r => ({ equipment: r.equipment || r.name, qty: r.qty, condition: r.condition, ownership: r.ownership || r.owned_leased }))} />
                  </div>
                  <div>
                    <label style={roLbl}>Owners / Stockholders</label>
                    <TableV headers={["Name", "Nationality", "% Share"]}
                      rows={(ci.stockholder_list || []).map(r => ({ name: r.name, nationality: r.nationality, share: r.share_percent ?? r.percentage ?? r.share }))} />
                  </div>
                  <div>
                    <label style={roLbl}>Key Personnel</label>
                    {(() => {
                      const kc = ci.key_contacts || {};
                      const roles = [
                        { key: "president",          label: "President / Owner"     },
                        { key: "accounting_manager",  label: "Accounting Manager"    },
                        { key: "sales_manager",        label: "Sales Manager"         },
                        { key: "delivery_incharge",    label: "Delivery In-charge"    },
                        { key: "technical_incharge",   label: "Technical In-charge"   },
                      ];
                      return (
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 440 }}>
                            <thead>
                              <tr style={{ background: C.offWhite }}>
                                {["Position", "Name", "Contact", "Nationality"].map(h => (
                                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSec, fontSize: 11, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {roles.map((r, i) => (
                                <tr key={r.key} style={{ borderBottom: i < roles.length - 1 ? `1px solid ${C.border}` : "none" }}>
                                  <td style={{ padding: "8px 10px", background: C.offWhite, fontWeight: 600, fontSize: 11, color: C.textSec, whiteSpace: "nowrap" }}>{r.label}</td>
                                  <td style={{ padding: "8px 10px", color: kc[r.key]?.name ? C.textPri : C.textTer }}>{kc[r.key]?.name || "—"}</td>
                                  <td style={{ padding: "8px 10px", color: kc[r.key]?.contact ? C.textPri : C.textTer }}>{kc[r.key]?.contact || "—"}</td>
                                  <td style={{ padding: "8px 10px", color: kc[r.key]?.nationality ? C.textPri : C.textTer }}>{kc[r.key]?.nationality || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label style={roLbl}>Company Profile & Organizational Chart</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <DocRowV docType="Company Profile" />
                      <DocRowV docType="Organizational Chart" />
                    </div>
                  </div>
                </div>
              </div>

              <div style={roCard}>
                <div style={roCT}>Primary Activity / Trade</div>
                <div style={gap14}>
                  <div>
                    <label style={roLbl}>Primary Activity</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {["Dealer", "Manufacturer", "Service Provider"].map(act => {
                        const active = (ci.primary_activities || []).includes(act);
                        return (
                          <div key={act} style={{ flex: 1, padding: "11px 6px", borderRadius: 10, border: `2px solid ${active ? C.coral : C.border}`, background: active ? C.coralLight : C.offWhite, color: active ? C.coral : C.textTer, fontWeight: active ? 700 : 500, fontSize: 13, textAlign: "center", opacity: active ? 1 : 0.45 }}>
                            {act}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={roLbl}>Trade Categories</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(Array.isArray(ci.trade_categories) ? ci.trade_categories : ci.primary_activity ? [ci.primary_activity] : []).map(cat => (
                        <span key={cat} style={{ padding: "5px 14px", borderRadius: 99, background: C.coralLight, color: C.coral, fontSize: 12, fontWeight: 600, border: `1px solid ${C.coral}40` }}>{cat}</span>
                      ))}
                      {!(Array.isArray(ci.trade_categories) ? ci.trade_categories.length : ci.primary_activity) && <span style={{ color: C.textTer, fontSize: 13 }}>No categories selected</span>}
                    </div>
                  </div>
                </div>
              </div>

            </>)}

            {/* ── TAX & GOV'T ─────────────────────────────────────────────── */}
            {formActiveTab === "tax_gov" && (<>

              <div style={roCard}>
                <div style={roCT}>Tax Information</div>
                <div style={gap14}>
                  <div>
                    <label style={roLbl}>Tax Identification Number (TIN)</label>
                    <input value={ci.tin || ""} readOnly style={roIn} />
                  </div>
                  <div>
                    <label style={roLbl}>Tax Classification</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {["VAT", "Non-VAT"].map(t => {
                        const active = ci.tax_classification === t || (t === "VAT" && ci.tax_classification === "VAT-registered");
                        return (
                          <div key={t} style={{ flex: 1, padding: "11px 6px", borderRadius: 10, border: `2px solid ${active ? C.coral : C.border}`, background: active ? C.coralLight : C.offWhite, color: active ? C.coral : C.textTer, fontWeight: active ? 700 : 500, fontSize: 13, textAlign: "center", opacity: active ? 1 : 0.45 }}>
                            {t}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={roLbl}>EWT / Withholding Tax Entries</label>
                    {(() => {
                      const ewt = Array.isArray(ci.ewt_entries) ? ci.ewt_entries : [];
                      if (!ewt.length) return <div style={{ fontSize: 13, color: C.textTer }}>No EWT entries</div>;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {ewt.map((e, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "12px 14px", background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 3 }}>ATC / Income Payment Type</div>
                                <div style={{ fontSize: 13, color: C.textPri }}>{e.atc || e.income_payment || "—"}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 3 }}>Rate</div>
                                <div style={{ fontSize: 13, color: C.textPri }}>{e.rate || "—"}</div>
                              </div>
                              <div style={{ gridColumn: "1/-1" }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 3 }}>Nature / Description</div>
                                <div style={{ fontSize: 13, color: C.textPri }}>{e.description || e.nature || "—"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div style={roCard}>
                <div style={roCT}>Government Documents</div>
                <div style={gap14}>
                  <div>
                    <label style={roLbl}>Company Registration Type</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[{ value: "DTI", label: "DTI Registered", sub: "Sole Proprietorship" }, { value: "SEC", label: "SEC Registered", sub: "Corporation / Partnership" }].map(({ value, label: lbl2, sub }) => {
                        const active = ci.registration_type === value;
                        return (
                          <div key={value} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `2px solid ${active ? C.coral : C.border}`, background: active ? C.coralLight : C.offWhite, opacity: active ? 1 : 0.45, textAlign: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.coral : C.textSec }}>{lbl2}</div>
                            <div style={{ fontSize: 11, color: active ? C.coralDark : C.textTer, marginTop: 2 }}>{sub}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={roLbl}>Government Documents</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {["DTI / SEC Certificate", "General Information Sheet", "Articles of Incorporation", "Secretary Certificate", "By-laws (SEC-registered companies only)", "Municipality / Mayor's Permit", "BIR/VAT Registration", "PCAB License", "ISO Compliance Certificate (if available)"].map(d => <DocRowV key={d} docType={d} />)}
                    </div>
                  </div>
                </div>
              </div>

            </>)}

            {/* ── FINANCIALS & COMPLIANCE ─────────────────────────────────── */}
            {formActiveTab === "fin_compliance" && (<>

              <div style={roCard}>
                <div style={roCT}>Bank Details</div>
                <div style={gap14}>
                  <div>
                    <label style={roLbl}>Bank Name</label>
                    <input value={ci.bank_name || ""} readOnly style={roIn} />
                  </div>
                  <div>
                    <label style={roLbl}>Account Name</label>
                    <input value={ci.bank_account_name || ""} readOnly style={roIn} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={roLbl}>Account Number</label>
                      <input value={ci.bank_account_number || ""} readOnly style={roIn} />
                    </div>
                    <div>
                      <label style={roLbl}>Branch</label>
                      <input value={ci.bank_branch || ""} readOnly style={roIn} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={roCard}>
                <div style={roCT}>Financial Documents</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <DocRowV docType="Audited Financial Statement (2 years)" label="Audited Financial Statement — 2 years" />
                  <DocRowV docType="Copy of ITR Previous Year" label="Copy of ITR (Previous Year)" />
                  <DocRowV docType="Certificate of Good Credit Standing" />
                  <DocRowV docType="Sample Purchase Order / Job Order (5 Major Clients)" label="Sample PO / Job Order — 5 Major Clients" />
                  <DocRowV docType="OR & Sales Invoice" label="Official Receipt & Sales Invoice" />
                </div>
              </div>

              <div style={roCard}>
                <div style={roCT}>Compliance</div>
                <div style={gap14}>
                  <div style={{ padding: "14px 16px", background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Organization Status</div>
                    <label style={roLbl}>Number of Employees (Full-time)</label>
                    <input value={ci.num_employees ?? ci.num_full_time_employees ?? ""} readOnly style={roIn} />
                  </div>
                  <div style={{ padding: "14px 16px", background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ownership Structure</div>
                    <div>
                      <label style={roLbl}>Is this a subsidiary or affiliated company?</label>
                      <YesNoV value={ci.is_subsidiary} />
                      {(ci.is_subsidiary === true || ci.is_subsidiary === "yes") && (
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                          <div>
                            <label style={roLbl}>Parent Company Name</label>
                            <input value={ci.parent_company_name || ""} readOnly style={roIn} />
                          </div>
                          <div>
                            <label style={roLbl}>Country</label>
                            <input value={ci.parent_company_country || ""} readOnly style={roIn} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px", background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Health & Safety</div>
                    <div style={gap14}>
                      <div>
                        <label style={roLbl}>Do you have a dedicated H&S Adviser?</label>
                        <YesNoV value={ci.has_hs_adviser ?? selectedVendor.vendor_hseq?.has_hs_adviser} />
                      </div>
                      {(ci.has_hs_adviser === true || ci.has_hs_adviser === "yes" || selectedVendor.vendor_hseq?.has_hs_adviser === "yes") && (
                        <div>
                          <label style={roLbl}>H&S Adviser Details</label>
                          <textarea value={ci.hs_adviser_details || selectedVendor.vendor_hseq?.hs_adviser_details || ""} readOnly rows={2} style={{ ...roIn, resize: "none" }} />
                        </div>
                      )}
                      <div>
                        <label style={roLbl}>Do you have an H&S Policy?</label>
                        <YesNoV value={ci.has_hs_policy ?? selectedVendor.vendor_hseq?.has_hs_policy} />
                      </div>
                      <DocRowV docType="H&S Policy Document" label="H&S Policy Document" />
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px", background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quality Management System</div>
                    <div style={gap14}>
                      <div>
                        <label style={roLbl}>Do you have a formal QMS (e.g. ISO 9001)?</label>
                        <YesNoV value={ci.has_qms ?? selectedVendor.vendor_hseq?.has_qms} />
                      </div>
                      <DocRowV docType="QMS Certificate" label="QMS / ISO Certificate" />
                      <div>
                        <label style={roLbl}>Do you have an internal QMS / quality procedures?</label>
                        <YesNoV value={ci.has_internal_qms ?? selectedVendor.vendor_hseq?.has_internal_qms} />
                      </div>
                      <DocRowV docType="Internal QMS Document" label="Internal QMS Document" />
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px", background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Environmental Management</div>
                    <div style={gap14}>
                      <div>
                        <label style={roLbl}>Do you have an environmental management system / procedures?</label>
                        <YesNoV value={ci.has_environmental_mgmt ?? selectedVendor.vendor_hseq?.has_environmental_mgmt} />
                      </div>
                      <DocRowV docType="Environmental Management Document" label="Environmental Management Document" />
                    </div>
                  </div>
                </div>
              </div>

            </>)}

            {/* ── DECLARATION ──────────────────────────────────────────────── */}
            {formActiveTab === "declaration" && (
              <div style={roCard}>
                <div style={roCT}>Declaration</div>
                <div style={gap14}>
                  <div>
                    <label style={roLbl}>Sales Manager (Signatory)</label>
                    <input value={ci.signatory_sales_manager || ""} readOnly style={roIn} />
                  </div>
                  <div>
                    <label style={roLbl}>President / Owner (Signatory)</label>
                    <input value={ci.signatory_president || ""} readOnly style={roIn} />
                  </div>
                  <div style={{ padding: "14px 16px", background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Declaration Statement</div>
                    <p style={{ margin: 0, fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>
                      I/We hereby certify that all information and documents provided in this accreditation application are true, correct, and complete to the best of my/our knowledge. I/We authorize PH1 World Developers, Inc. and its affiliates to verify any information provided herein and to conduct background checks as necessary.
                    </p>
                  </div>
                  {(() => {
                    // declaration_confirmed_at was added retroactively — fall back to accreditation_status
                    const confirmedAt = ci.declaration_confirmed_at;
                    const isSubmitted = !!confirmedAt ||
                      ["Submitted", "Under Review", "Accredited", "Declined", "Returned"].includes(selectedVendor.accreditation_status);
                    return (
                      <div>
                        <label style={roLbl}>Submission Status</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isSubmitted ? C.greenBg : C.offWhite, border: `1px solid ${isSubmitted ? "#86EFAC" : C.border}`, borderRadius: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isSubmitted ? C.greenText : C.borderMid }} />
                          {isSubmitted ? (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.greenText }}>Declaration confirmed & submitted</div>
                              {confirmedAt
                                ? <div style={{ fontSize: 11, color: C.textSec, marginTop: 1 }}>{new Date(confirmedAt).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" })}</div>
                                : <div style={{ fontSize: 11, color: C.textSec, marginTop: 1 }}>Submitted — exact time not recorded</div>
                              }
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: C.textTer }}>Not yet submitted</div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>
        </div>
        );
      })()}

      {/* [REMOVED: old slide-in modal start placeholder] */}
      {false && selectedVendor && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
          <div style={{ background: C.white, width: "100%", maxWidth: 680, height: "100vh", overflowY: "auto", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>

            {/* Modal header */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: C.white, zIndex: 10 }}>
              <div>
                {selectedVendor.vendor_code && <div style={{ fontSize: 11, fontWeight: 700, color: C.coral, letterSpacing: "0.05em", marginBottom: 2 }}>{selectedVendor.vendor_code}</div>}
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>
                  {selectedVendor.vendor_company_info?.company_name || selectedVendor.profiles?.full_name || "Vendor"}
                </div>
                <span style={badge(selectedVendor.accreditation_status)}>{selectedVendor.accreditation_status}</span>
              </div>
              <button onClick={() => setShowDetail(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 20, padding: 4 }}>✕</button>
            </div>

            {/* Action bar */}
            {canManage && (
              <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, background: C.offWhite, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {/* Class assignment */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>Class:</span>
                  <select value={selectedVendor.subcontractor_class || ""}
                    onChange={async e => {
                      await supabase.from("vendors").update({ subcontractor_class: e.target.value || null }).eq("id", selectedVendor.id);
                      setSelectedVendor(prev => ({ ...prev, subcontractor_class: e.target.value }));
                      fetchVendors();
                    }}
                    style={{ ...styles.input, width: "auto", fontSize: 12, padding: "5px 10px" }}>
                    <option value="">Unassigned</option>
                    <option value="Class A">Class A</option>
                    <option value="Class B">Class B</option>
                    <option value="Class C">Class C</option>
                  </select>
                </div>

                <div style={{ flex: 1 }} />

                {/* Status actions */}
                {selectedVendor.accreditation_status === "Submitted" && (
                  <button style={{ ...styles.btnGhost, fontSize: 12 }} disabled={updating}
                    onClick={() => updateStatus(selectedVendor.id, "Under Review")}>
                    Mark as Under Review
                  </button>
                )}
                {["Submitted", "Under Review", "Returned"].includes(selectedVendor.accreditation_status) && (
                  <button style={{ ...styles.btnDanger, padding: "7px 14px", fontSize: 12 }} disabled={updating}
                    onClick={() => { setReturnNotes(selectedVendor.return_notes || ""); setShowReturnModal(true); }}>
                    {selectedVendor.accreditation_status === "Returned" ? "✉ Resend return email" : "Return to vendor"}
                  </button>
                )}
                {["Submitted", "Under Review"].includes(selectedVendor.accreditation_status) && (
                  <button style={{ ...styles.btnSuccess, padding: "7px 14px", fontSize: 12 }} disabled={updating}
                    onClick={() => updateStatus(selectedVendor.id, "Accredited")}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name="check" size={12} color={C.greenText} /> Accredit vendor
                    </span>
                  </button>
                )}
                {["Submitted", "Under Review"].includes(selectedVendor.accreditation_status) && (
                  <button style={{ ...styles.btnDanger, padding: "7px 14px", fontSize: 12, background: C.redBg }} disabled={updating}
                    onClick={() => { if (confirm("Decline this vendor's accreditation?")) updateStatus(selectedVendor.id, "Declined"); }}>
                    Decline
                  </button>
                )}
              </div>
            )}

            {/* Return notes if returned */}
            {selectedVendor.accreditation_status === "Returned" && selectedVendor.return_notes && (
              <div style={{ margin: "16px 24px 0", padding: "12px 14px", background: "#FEF3E2", border: "1px solid #FCD34D", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.amberText, marginBottom: 4, textTransform: "uppercase" }}>Return Notes</div>
                <p style={{ margin: 0, fontSize: 13, color: C.textPri }}>{selectedVendor.return_notes}</p>
              </div>
            )}

            {/* Vendor details */}
            <div style={{ padding: "20px 24px", flex: 1 }}>

              {/* ── Classification Summary Card ─────────────────────────────── */}
              {(() => {
                const rec = computeRecommendation(selectedVendor.vendor_documents, classRules);
                if (!rec) return null;
                return (
                  <div style={{ background: rec.bg, border: `1px solid ${rec.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: rec.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                          System Recommendation
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: rec.color }}>{rec.label}</div>
                        <div style={{ fontSize: 12, color: C.textSec, marginTop: 4, maxWidth: 480 }}>{rec.reason}</div>
                        {rec.missingDocs?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 4 }}>
                              {rec.action === "return"
                                ? "Missing documents:"
                                : rec.classification === "Class C"
                                  ? "Submit these to qualify for Class B:"
                                  : rec.classification === "Class B"
                                    ? "Submit these to qualify for Class A:"
                                    : "Documents needed:"
                              }
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {rec.missingDocs.map(d => (
                                <span key={d} style={{ fontSize: 11, background: "rgba(0,0,0,0.06)", color: C.textPri, padding: "2px 8px", borderRadius: 99 }}>{d}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {canManage && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                          {rec.action === "classify" && (
                            <button style={{ ...styles.btnSuccess, fontSize: 12, padding: "7px 14px" }}
                              onClick={async () => {
                                await supabase.from("vendors").update({ subcontractor_class: rec.classification }).eq("id", selectedVendor.id);
                                setSelectedVendor(prev => ({ ...prev, subcontractor_class: rec.classification }));
                                fetchVendors();
                              }}>
                              Accept — Assign {rec.classification}
                            </button>
                          )}
                          {rec.action === "return" && (
                            <button style={{ ...styles.btnDanger, fontSize: 12, padding: "7px 14px" }}
                              onClick={() => { setReturnNotes(rec.returnNote || ""); setShowReturnModal(true); }}>
                              Accept — Return to Vendor
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── helpers ──────────────────────────────────────────────────── */}
              {(() => {
                const ci   = selectedVendor.vendor_company_info;
                const docs = selectedVendor.vendor_documents || [];
                // Map doc_type → vendor_doc_expiry row (expiry date, reg number, reg date)
                const docExpMap = Object.fromEntries(
                  (selectedVendor.vendor_doc_expiry || []).map(r => [r.doc_type, r])
                );

                const DocRow = ({ docType, label }) => {
                  const doc = docs.find(d => d.document_type === docType);
                  const exp = docExpMap[docType];
                  return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: doc ? C.greenBg : C.offWhite, border: `1px solid ${doc ? "#86EFAC" : C.border}`, borderRadius: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: doc ? C.greenText : C.borderMid, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: C.textPri }}>{label || docType}</div>
                          {doc  && <div style={{ fontSize: 11, color: C.greenText, marginTop: 1 }}>{doc.file_name}</div>}
                          {!doc && <div style={{ fontSize: 11, color: C.textTer,  marginTop: 1 }}>Not uploaded</div>}
                          {exp?.reg_number && <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>Cert. No. {exp.reg_number}{exp.reg_date ? ` · Reg. ${exp.reg_date}` : ""}</div>}
                          {exp?.expiry_date && <div style={{ fontSize: 11, color: C.textSec, marginTop: 1 }}>Expires {exp.expiry_date}</div>}
                        </div>
                      </div>
                      {doc && <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.coral, textDecoration: "none", fontWeight: 500 }}>View ↗</a>}
                    </div>
                  );
                };

                const YesNo = ({ value }) => {
                  if (value === null || value === undefined) return <span style={{ color: C.textTer }}>—</span>;
                  const yes = value === true || value === "yes";
                  return (
                    <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: yes ? C.greenBg : C.offWhite, color: yes ? C.greenText : C.textSec, border: `1px solid ${yes ? "#86EFAC" : C.border}` }}>
                      {yes ? "Yes" : "No"}
                    </span>
                  );
                };

                const VendorTable = ({ headers, rows, emptyMsg }) => {
                  const filled = (rows || []).filter(r => Object.values(r).some(v => v?.toString().trim()));
                  if (!filled.length) return <EmptyNote note={emptyMsg} />;
                  return (
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: headers.length > 3 ? 480 : undefined }}>
                        <thead>
                          <tr style={{ background: C.offWhite }}>
                            {headers.map((h, i) => (
                              <th key={i} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSec, fontSize: 11, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filled.map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: ri < filled.length - 1 ? `1px solid ${C.border}` : "none" }}>
                              {Object.values(row).map((v, ci2) => (
                                <td key={ci2} style={{ padding: "8px 10px", color: v?.toString().trim() ? C.textPri : C.textTer, verticalAlign: "top" }}>{v?.toString().trim() || "—"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                };

                return (<>

                  {/* ── 1. Company Information ──────────────────────────────── */}
                  <Section title="Company Information">
                    {!ci ? <EmptyNote /> : (<>
                      {ci.vendor_type && (
                        <div style={{ padding: "4px 0 8px" }}>
                          <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: C.coralLight, color: C.coral, border: `1px solid ${C.coral}40` }}>{ci.vendor_type}</span>
                        </div>
                      )}
                      <Row label="Company name" value={ci.company_name} />
                      <div style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 12, color: C.textSec, marginBottom: 2 }}>Registered address</div>
                        <div style={{ fontSize: 13, color: C.textPri, lineHeight: 1.5 }}>{ci.registered_address || "—"}</div>
                        {ci.location_map_url && <a href={ci.location_map_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.coral, fontWeight: 600, display: "inline-block", marginTop: 3 }}>View on map ↗</a>}
                      </div>
                      {(ci.satellite_address || ci.satellite_map_url) && (
                        <div style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 12, color: C.textSec, marginBottom: 2 }}>Satellite / branch address</div>
                          <div style={{ fontSize: 13, color: C.textPri, lineHeight: 1.5 }}>{ci.satellite_address || "—"}</div>
                          {ci.satellite_map_url && <a href={ci.satellite_map_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.coral, fontWeight: 600, display: "inline-block", marginTop: 3 }}>View on map ↗</a>}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                        <Row label="Telephone"   value={ci.telephone} />
                        <Row label="Cell number" value={ci.cell_number} />
                      </div>
                      <Row label="Website"              value={ci.website} />
                      <Row label="Email"                value={ci.rfq_email} />
                      <Row label="Contact person"       value={[ci.contact_person, ci.contact_position].filter(Boolean).join(" — ")} />
                      <Row label="Authorized representative" value={[ci.authorized_representative, ci.representative_title].filter(Boolean).join(" — ")} />
                    </>)}
                  </Section>

                  {/* ── 2. Primary Activity / Trade ─────────────────────────── */}
                  <Section title="Primary Activity / Trade">
                    {!ci ? <EmptyNote /> : (() => {
                      const acts = ci.primary_activities || [];
                      const cats = Array.isArray(ci.trade_categories) ? ci.trade_categories : ci.primary_activity ? [ci.primary_activity] : [];
                      if (!acts.length && !cats.length) return <EmptyNote />;
                      return (<>
                        {acts.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Primary Activity</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {acts.map(a => (
                                <span key={a} style={{ padding: "7px 18px", borderRadius: 10, border: `2px solid ${C.coral}`, background: C.coralLight, color: C.coral, fontWeight: 700, fontSize: 13 }}>{a}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {cats.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Trade Categories</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {cats.map(cat => (
                                <span key={cat} style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 500, background: "#FFF0EE", border: "1px solid #FFCCC7", color: "#C0392B", borderRadius: 99, padding: "4px 10px" }}>{cat}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>);
                    })()}
                  </Section>

                  {/* ── 3. Major Clients ────────────────────────────────────── */}
                  <Section title="Major Clients">
                    <VendorTable
                      headers={["Client / Company Name", "Project / Service", "Year", "Contract Value (₱)"]}
                      rows={(ci?.client_list || []).map(r => ({ name: r.name, project: r.project, year: r.year, value: r.value }))}
                    />
                  </Section>

                  {/* ── 4. Equipment ────────────────────────────────────────── */}
                  <Section title="Equipment">
                    <VendorTable
                      headers={["Equipment / Tool", "Brand / Model", "Qty", "Condition"]}
                      rows={(ci?.equipment_list || []).map(r => ({ item: r.item, brand: r.brand, qty: r.qty, condition: r.condition }))}
                    />
                  </Section>

                  {/* ── 5. Owners / Stockholders ────────────────────────────── */}
                  <Section title="Owners / Stockholders">
                    <VendorTable
                      headers={["Name", "Position", "Address", "Contact No.", "TIN No."]}
                      rows={(ci?.stockholder_list || []).map(r => ({ name: r.name, position: r.position, address: r.address, contact: r.contact_no, tin: r.tin_no }))}
                    />
                  </Section>

                  {/* ── 6. Key Personnel ────────────────────────────────────── */}
                  <Section title="Key Personnel">
                    {(() => {
                      const kc = ci?.key_contacts || {};
                      const roles = [
                        { key: "president",          label: "President" },
                        { key: "accounting_manager", label: "Accounting Manager" },
                        { key: "sales_manager",      label: "Sales Manager" },
                        { key: "delivery_incharge",  label: "Delivery In-charge" },
                        { key: "technical_incharge", label: "Technical In-charge" },
                      ];
                      const hasAny = roles.some(r => kc[r.key]?.name?.trim());
                      if (!hasAny) return <EmptyNote />;
                      return (
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 460 }}>
                            <thead>
                              <tr style={{ background: C.offWhite }}>
                                {["Position", "Name", "Contact", "Nationality"].map(h => (
                                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.textSec, fontSize: 11, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {roles.map(({ key, label }, idx) => (
                                <tr key={key} style={{ borderBottom: idx < roles.length - 1 ? `1px solid ${C.border}` : "none" }}>
                                  <td style={{ padding: "8px 10px", fontWeight: 600, color: C.textSec, background: C.offWhite, borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{label}</td>
                                  <td style={{ padding: "8px 10px", color: kc[key]?.name ? C.textPri : C.textTer }}>{kc[key]?.name || "—"}</td>
                                  <td style={{ padding: "8px 10px", color: kc[key]?.contact ? C.textPri : C.textTer }}>{kc[key]?.contact || "—"}</td>
                                  <td style={{ padding: "8px 10px", color: kc[key]?.nationality ? C.textPri : C.textTer }}>{kc[key]?.nationality || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </Section>

                  {/* ── 7. Company Documents ────────────────────────────────── */}
                  <Section title="Company Documents">
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {["Company Profile", "Organizational Chart", "Valid Government ID 1", "Valid Government ID 2"].map(d => <DocRow key={d} docType={d} />)}
                    </div>
                  </Section>

                  {/* ── 8. Tax Information ──────────────────────────────────── */}
                  <Section title="Tax Information">
                    {!ci ? <EmptyNote /> : (() => {
                      const hasAny = ci.tin || ci.tax_classification || (Array.isArray(ci.ewt_entries) && ci.ewt_entries.some(e => e.rate));
                      if (!hasAny) return <EmptyNote />;
                      return (<>
                        {ci.tin && <Row label="Tax Identification Number (TIN)" value={ci.tin} />}
                        {ci.tax_classification && <Row label="Tax classification" value={ci.tax_classification === "VAT" ? "VAT-registered" : ci.tax_classification} />}
                        {Array.isArray(ci.ewt_entries) && ci.ewt_entries.filter(e => e.rate).length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>Expanded Withholding Tax (EWT)</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {ci.ewt_entries.filter(e => e.rate).map((e, i) => (
                                <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                                  <div style={{ background: C.offWhite, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textSec }}>EWT Rate {i + 1}</span>
                                  </div>
                                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                                    <Row label="Rate" value={e.rate} />
                                    <Row label="Nature / Description" value={e.description} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>);
                    })()}
                  </Section>

                  {/* ── 9. Government Documents ─────────────────────────────── */}
                  <Section title="Government Documents">
                    {ci?.registration_type && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Company Registration Type</div>
                        <div style={{ display: "flex", gap: 10 }}>
                          {[{ value: "DTI", label: "DTI Registered", sub: "Sole Proprietorship" }, { value: "SEC", label: "SEC Registered", sub: "Corporation / Partnership" }].map(({ value, label, sub }) => {
                            const active = ci.registration_type === value;
                            return (
                              <div key={value} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `2px solid ${active ? C.coral : C.border}`, background: active ? C.coralLight : C.offWhite, opacity: active ? 1 : 0.5, textAlign: "center" }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.coral : C.textSec }}>{label}</div>
                                <div style={{ fontSize: 11, color: active ? C.coralDark : C.textTer, marginTop: 2 }}>{sub}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {["DTI / SEC Certificate", "General Information Sheet", "Articles of Incorporation", "Secretary Certificate", "By-laws (SEC-registered companies only)", "Municipality / Mayor's Permit", "BIR/VAT Registration", "PCAB License", "ISO Compliance Certificate (if available)"].map(d => <DocRow key={d} docType={d} />)}
                    </div>
                  </Section>

                  {/* ── 10. Bank Details ────────────────────────────────────── */}
                  <Section title="Bank Details">
                    {!ci ? <EmptyNote /> : (() => {
                      const hasAny = ci.bank_name || ci.bank_account_name || ci.bank_account_number || ci.bank_branch;
                      if (!hasAny) return <EmptyNote />;
                      return (<>
                        <Row label="Bank name"      value={ci.bank_name} />
                        <Row label="Account name"   value={ci.bank_account_name} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                          <Row label="Account number" value={ci.bank_account_number} />
                          <Row label="Branch"          value={ci.bank_branch} />
                        </div>
                      </>);
                    })()}
                  </Section>

                  {/* ── 11. Financial Documents ─────────────────────────────── */}
                  <Section title="Financial Documents">
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {["OR & Sales Invoice", "Audited Financial Statement (2 years)", "Certificate of Good Credit Standing", "Copy of ITR Previous Year", "Sample Purchase Order / Job Order (5 Major Clients)"].map(d => <DocRow key={d} docType={d} />)}
                    </div>
                  </Section>

                  {/* ── 12. Compliance ──────────────────────────────────────── */}
                  <Section title="Compliance">
                    {!ci ? <EmptyNote /> : (<>

                      {/* Organizational Status */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>Organizational Status</div>
                        <Row label="Full-time employees" value={ci.num_employees ?? ci.num_full_time_employees} />
                      </div>

                      {/* Ownership Structure */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>Ownership Structure</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 12, color: C.textSec }}>Subsidiary / division of another company</span>
                          <YesNo value={ci.is_subsidiary} />
                        </div>
                        {(ci.is_subsidiary === true || ci.is_subsidiary === "yes") && (
                          <>
                            <Row label="Parent company"         value={ci.parent_company_name} />
                            <Row label="Parent company country" value={ci.parent_company_country} />
                          </>
                        )}
                      </div>

                      {/* Health & Safety */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>Health &amp; Safety</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 12, color: C.textSec }}>Employs a H&amp;S adviser or consultant</span>
                          <YesNo value={ci.has_hs_adviser} />
                        </div>
                        {(ci.has_hs_adviser === true || ci.has_hs_adviser === "yes") && ci.hs_adviser_details && (
                          <Row label="H&S adviser details" value={ci.hs_adviser_details} />
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 12, color: C.textSec }}>Has H&amp;S policy manual</span>
                          <YesNo value={ci.has_hs_policy} />
                        </div>
                        <DocRow docType="H&S Policy Statement" />
                      </div>

                      {/* Quality & Environmental Management */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>Quality &amp; Environmental Management</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 12, color: C.textSec }}>Documented Quality Management System (QMS)</span>
                          <YesNo value={ci.has_qms} />
                        </div>
                        <DocRow docType="QMS Certificate" />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}`, marginTop: 6 }}>
                          <span style={{ fontSize: 12, color: C.textSec }}>Internal QMS procedures</span>
                          <YesNo value={ci.has_internal_qms} />
                        </div>
                        <DocRow docType="Internal QMS Procedures" />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}`, marginTop: 6 }}>
                          <span style={{ fontSize: 12, color: C.textSec }}>Environmental management policy</span>
                          <YesNo value={ci.has_env_management} />
                        </div>
                        <DocRow docType="Environmental Management Policy" />
                      </div>

                    </>)}
                  </Section>

                  {/* ── 13. Declaration ─────────────────────────────────────── */}
                  <Section title="Declaration">
                    {!ci || (!ci.signatory_sales_manager && !ci.signatory_president && !ci.declaration_confirmed_at)
                      ? <EmptyNote />
                      : (<>
                          {ci.signatory_sales_manager && <Row label="Sales Manager (signatory)" value={ci.signatory_sales_manager} />}
                          {ci.signatory_president      && <Row label="President (signatory)"     value={ci.signatory_president} />}
                          {ci.declaration_confirmed_at && <Row label="Confirmed at"              value={new Date(ci.declaration_confirmed_at).toLocaleString()} />}
                        </>)
                    }
                  </Section>

                </>);
              })()}

            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>
                {selectedVendor?.accreditation_status === "Returned" ? "Resend return email" : "Return to vendor"}
              </div>
              <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>
                {selectedVendor?.accreditation_status === "Returned"
                  ? "Update the notes if needed, then resend the email with the vendor's accreditation link."
                  : "Explain what needs to be corrected or completed"}
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <label style={styles.label}>Return notes <span style={styles.required}>*</span></label>
              <textarea rows={4} value={returnNotes} onChange={e => setReturnNotes(e.target.value)}
                placeholder="e.g. Please upload a clearer copy of your Mayor's Permit. Your Audited Financial Statement is missing..."
                style={{ ...styles.input, resize: "vertical", lineHeight: 1.5 }} />
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8, background: C.offWhite }}>
              <button style={styles.btnSecondary} onClick={() => { setShowReturnModal(false); setReturnNotes(""); }}>Cancel</button>
              <button style={styles.btnDanger} disabled={updating} onClick={handleReturn}>
                {updating
                  ? (selectedVendor?.accreditation_status === "Returned" ? "Resending…" : "Returning…")
                  : (selectedVendor?.accreditation_status === "Returned" ? "✉ Update & Resend" : "Return to vendor")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 440, maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: 16 }}>Invite Vendor for Accreditation</h3>
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
                <p style={styles.hint}>An invitation email with a unique accreditation link will be sent directly to the vendor.</p>
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button onClick={handleGenerateInvite} disabled={inviteLoading} style={{ ...styles.btnPrimary, flex: 1 }}>
                    {inviteLoading ? "Sending…" : "Send Invite via Email"}
                  </button>
                  <button onClick={() => setShowInviteModal(false)} style={styles.btnSecondary}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: C.textSec, marginBottom: 12, lineHeight: 1.5 }}>
                  Invitation sent to <strong>{inviteEmail}</strong>. You may also copy the link below to share it directly.
                </p>
                <div style={{ background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.textPri, wordBreak: "break-all", marginBottom: 14 }}>
                  {inviteLink}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ ...styles.btnPrimary, flex: 1 }}>
                    Copy Link
                  </button>
                  <button onClick={() => { setShowInviteModal(false); setInviteLink(""); setInviteEmail(""); }} style={styles.btnSecondary}>Close</button>
                </div>
                <p style={{ fontSize: 11, color: C.textTer, marginTop: 10 }}>
                  Open application (no invite needed): <strong>{window.location.origin}/vendor/accreditation/apply</strong>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── HELPER COMPONENTS FOR VENDOR DETAIL ─────────────────────────────────────
const REQUIRED_DOCS = [
  "Company Profile", "Organizational Chart", "PCAB License",
  "OR & Sales Invoice", "List of Clients", "List of Equipment",
  "DTI / SEC Certificate", "General Information Sheet",
  "Articles of Incorporation", "Secretary Certificate",
  "By-laws", "Municipality / Mayor's Permit", "BIR/VAT Registration",
  "Two (2) Valid Government IDs", "Location Sketch (Office/Store/Warehouse)",
  "Letter of Intent", "ISO Compliance Certificate (if available)",
  "Audited Financial Statement (2 years)",
  "Certificate of Good Credit Standing", "Copy of ITR Previous Year",
  "Sample Purchase Order / Job Order (5 Major Clients)",
];

// Classification tiers (document-presence driven):
//   Class C  — Max ₱500K   : core docs, excluding PCAB + the 3 financial extras
//   Class B  — Max ₱1M     : core docs + PCAB; still excluding the 3 financial extras
//   Class A  — No limit    : all docs, including PCAB + AFS + Certificate of Good Credit + Sample PO/JO
const DEFAULT_CLASS_RULES = {
  classA: {
    // All documents are required
    requiredDocs: [
      "DTI / SEC Certificate",
      "Municipality / Mayor's Permit", "BIR/VAT Registration",
      "PCAB License",
      "Valid Government ID 1", "Valid Government ID 2",
      "OR & Sales Invoice", "Copy of ITR Previous Year",
      "Audited Financial Statement (2 years)",
      "Certificate of Good Credit Standing",
      "Sample Purchase Order / Job Order (5 Major Clients)",
    ],
    minDocCount: 11,
    maxAward: "No limit",
  },
  classB: {
    // All except the 3 financial extras (AFS, Good Credit, Sample PO)
    requiredDocs: [
      "DTI / SEC Certificate",
      "Municipality / Mayor's Permit", "BIR/VAT Registration",
      "PCAB License",
      "Valid Government ID 1", "Valid Government ID 2",
      "OR & Sales Invoice", "Copy of ITR Previous Year",
    ],
    minDocCount: 8,
    maxAward: "₱1,000,000",
  },
  classC: {
    // All except PCAB + the 3 financial extras
    requiredDocs: [
      "DTI / SEC Certificate",
      "Municipality / Mayor's Permit", "BIR/VAT Registration",
      "Valid Government ID 1", "Valid Government ID 2",
      "OR & Sales Invoice", "Copy of ITR Previous Year",
    ],
    minDocCount: 7,
    maxAward: "₱500,000",
  },
  returnTriggerDocs: [
    "DTI / SEC Certificate",
    "Municipality / Mayor's Permit", "BIR/VAT Registration",
    "Valid Government ID 1", "Valid Government ID 2",
  ],
};

// Classification logic:
//   Class A  — all classA.requiredDocs present (includes PCAB + AFS + Good Credit + Sample PO)
//   Class B  — all classB.requiredDocs present (includes PCAB, but NOT the 3 financial extras) → max ₱1M
//   Class C  — all classC.requiredDocs present (excludes PCAB and the 3 financial extras)     → max ₱500K
//   Return   — missing one or more returnTriggerDocs (critical baseline docs)
function computeRecommendation(uploadedDocs, rules) {
  const r = rules || DEFAULT_CLASS_RULES;
  const uploaded = new Set((uploadedDocs || []).map(d => d.document_type));

  // 1. Missing critical docs → must return to vendor before classifying
  const missingReturn = (r.returnTriggerDocs || []).filter(d => !uploaded.has(d));
  if (missingReturn.length > 0) {
    return {
      action: "return",
      label: "Return to Vendor",
      color: C.amberText, bg: C.amberBg, border: "#FCD34D",
      reason: `Missing ${missingReturn.length} critical document${missingReturn.length > 1 ? "s" : ""} required before classification can be assigned.`,
      missingDocs: missingReturn,
      returnNote: `Please upload the following required documents:\n${missingReturn.map(d => `• ${d}`).join("\n")}`,
    };
  }

  // 2. Class A — all required docs including PCAB + AFS + Certificate of Good Credit + Sample PO/JO
  const missingA = (r.classA?.requiredDocs || []).filter(d => !uploaded.has(d));
  if (missingA.length === 0) {
    return {
      action: "classify",
      classification: "Class A",
      label: "Suggest: Class A — No Maximum PO Amount",
      color: C.greenText, bg: C.greenBg, border: "#86EFAC",
      reason: "All required documents are complete. Eligible for Class A accreditation with no maximum award amount.",
      missingDocs: [],
    };
  }

  // 3. Class B — core docs + PCAB present, but missing AFS / Good Credit / Sample PO
  const missingB = (r.classB?.requiredDocs || []).filter(d => !uploaded.has(d));
  if (missingB.length === 0) {
    return {
      action: "classify",
      classification: "Class B",
      label: "Suggest: Class B — Max ₱1,000,000",
      color: C.tealText, bg: C.tealBg, border: "#6EE7B7",
      reason: "PCAB License and core documents are complete. Eligible for Class B (max ₱1M). Submit the documents below to qualify for Class A.",
      missingDocs: missingA,   // shows what's needed for Class A upgrade
    };
  }

  // 4. Class C — core docs present but PCAB is missing; AFS/Good Credit/Sample PO also missing
  const missingC = (r.classC?.requiredDocs || []).filter(d => !uploaded.has(d));
  if (missingC.length === 0) {
    return {
      action: "classify",
      classification: "Class C",
      label: "Suggest: Class C — Max ₱500,000",
      color: "#7C3AED", bg: "#EDE9FE", border: "#C4B5FD",
      reason: "Core documents are complete but PCAB License is missing. Eligible for Class C (max ₱500K). Submit the documents below to qualify for Class B.",
      missingDocs: missingB,   // shows what's needed for Class B upgrade
    };
  }

  // 5. Not even Class C — return to vendor
  return {
    action: "return",
    label: "Return to Vendor",
    color: C.amberText, bg: C.amberBg, border: "#FCD34D",
    reason: `Missing ${missingC.length} core document${missingC.length > 1 ? "s" : ""} required for minimum Class C classification.`,
    missingDocs: missingC,
    returnNote: `Please complete your submission. Missing documents:\n${missingC.map(d => `• ${d}`).join("\n")}`,
  };
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: C.textTer, minWidth: 140, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 12, color: value ? C.textPri : C.textTer }}>{value || "—"}</div>
    </div>
  );
}

function EmptyNote() {
  return <div style={{ fontSize: 12, color: C.textTer, fontStyle: "italic", padding: "4px 0 8px" }}>No information provided</div>;
}
// ─── USERS PAGE ───────────────────────────────────────────────────────────────
function UsersPage({ profile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", password: "", position: "Supervisor", is_admin: false });

  const canManage = profile?.is_admin === true;

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    // Try with email column first
    const { data, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, position, is_admin, is_active, created_at")
      .order("full_name");
    if (fetchErr) {
      console.warn("profiles fetch (with email) failed:", fetchErr.message, "— retrying without email column");
      // email column doesn't exist yet — fall back
      const { data: fallback, error: fallbackErr } = await supabase
        .from("profiles")
        .select("id, full_name, position, is_admin, is_active, created_at")
        .order("full_name");
      if (fallbackErr) console.error("profiles fallback fetch also failed:", fallbackErr.message);
      setUsers(fallback ?? []);
    } else {
      setUsers(data ?? []);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ full_name: "", email: "", password: "", position: "Supervisor", is_admin: false });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ full_name: user.full_name || "", email: "", password: "", position: user.position || "Supervisor", is_admin: user.is_admin || false });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingUser(null); };

  const handleSave = async () => {
    if (!form.full_name) { alert("Full name is required."); return; }
    if (!editingUser && !form.email) { alert("Email is required."); return; }
    if (!editingUser && !form.password) { alert("Password is required."); return; }
    if (!editingUser && form.password.length < 6) { alert("Password must be at least 6 characters."); return; }
    setSaving(true);

    if (editingUser) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: form.full_name, position: form.position, is_admin: form.is_admin })
        .eq("id", editingUser.id)
        .select();
      if (updateError) { alert("Error updating user: " + updateError.message); setSaving(false); return; }
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/create-user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
          body: JSON.stringify({ email: form.email, password: form.password, full_name: form.full_name, position: form.position, is_admin: form.is_admin }),
        }
      );
      const result = await response.json();
      if (!response.ok) { alert("Error creating user: " + result.error); setSaving(false); return; }
    }

    setSaving(false);
    closeModal();
    fetchUsers();
  };

  const toggleActive = async (user) => {
    const newStatus = user.is_active === false ? true : false;
    await supabase.from("profiles").update({ is_active: newStatus }).eq("id", user.id);
    fetchUsers();
  };

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const filtered = users.filter(u =>
    (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.position || "").toLowerCase().includes(search.toLowerCase())
  );

  const positionColor = (position, isAdm) => {
    if (isAdm) return { bg: "#EDE9FE", color: "#5B21B6" };
    const map = {
      "Commercial Manager": { bg: C.amberBg,  color: C.amberText },
      "D&C Head":           { bg: C.amberBg,  color: C.amberText },
      "Commercial Officer": { bg: C.tealBg,   color: C.tealText  },
      "Manager":            { bg: C.coralMid, color: C.coralDark },
      "Finance Head":       { bg: "#DBEAFE",  color: "#1D4ED8"   },
      "President":          { bg: "#FDF4FF",  color: "#7E22CE"   },
      "Supervisor":         { bg: C.grayBg,   color: C.grayText  },
    };
    return map[position] || { bg: C.grayBg, color: C.grayText };
  };

  return (
    <>
      {/* ── Top bar ── */}
      <div style={styles.topBar}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, lineHeight: 1.2 }}>Users &amp; Roles</div>
          <div style={{ fontSize: 11, color: C.textTer, marginTop: 1 }}>Manage system accounts and access levels</div>
        </div>
        <div style={{ flex: 1 }} />
        {canManage && (
          <button style={styles.btnPrimary} onClick={openCreate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "middle" }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New User
          </button>
        )}
      </div>

      <div style={styles.pageBody}>

        {/* ── KPI stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Total Users",  value: users.length,                                    icon: "users",  color: C.textPri,  bg: C.offWhite,   iconColor: C.textSec },
            { label: "Active",       value: users.filter(u => u.is_active !== false).length,  icon: "check",  color: C.greenText, bg: C.greenBg,   iconColor: C.greenText },
            { label: "Inactive",     value: users.filter(u => u.is_active === false).length,  icon: "clock",  color: C.grayText,  bg: C.grayBg,    iconColor: C.grayText },
            { label: "Admins",       value: users.filter(u => u.is_admin === true).length,    icon: "shield", color: "#5B21B6",   bg: "#EDE9FE",   iconColor: "#7C3AED" },
          ].map(s => (
            <div key={s.label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={s.icon} size={16} color={s.iconColor} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textTer, marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={13} color={C.textTer} /></div>
            <input placeholder="Search by name or position…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 30, fontSize: 12 }} />
          </div>
          <button onClick={fetchUsers} style={{ ...styles.btnGhost, fontSize: 11, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
        </div>

        {/* ── Table ── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.coralMid }}>
                  {["User", "Email", "Position", "Access", "Status", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.coralDark, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.coralLight}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Loading state */}
                {loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "48px 0" }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.coral} strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        <span style={{ fontSize: 12, color: C.textTer }}>Loading users…</span>
                      </div>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </td>
                  </tr>
                )}
                {/* Empty state */}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "52px 0", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: C.offWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon name="users" size={22} color={C.textTer} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.textSec }}>No users found</div>
                        <div style={{ fontSize: 12, color: C.textTer }}>{search ? "Try a different search term" : "Add the first user to get started"}</div>
                        {!search && canManage && <button style={{ ...styles.btnPrimary, marginTop: 4, fontSize: 12 }} onClick={openCreate}>+ New User</button>}
                      </div>
                    </td>
                  </tr>
                )}
                {/* Rows */}
                {!loading && filtered.map((user, i) => {
                  const pc = positionColor(user.position, user.is_admin);
                  const isActive = user.is_active !== false;
                  const initials = (user.full_name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <tr key={user.id}
                      style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", transition: "background 0.15s" }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      {/* User */}
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${C.coral}, ${C.coralDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.white, flexShrink: 0, letterSpacing: "0.02em" }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>{user.full_name || "—"}</div>
                            <div style={{ fontSize: 11, color: C.textTer, marginTop: 1 }}>Joined {fmtShort(user.created_at)}</div>
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec, whiteSpace: "nowrap" }}>
                        {user.email || <span style={{ color: C.textTer }}>—</span>}
                      </td>
                      {/* Position */}
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.color }}>
                          {user.position || "—"}
                        </span>
                      </td>
                      {/* Access / Admin */}
                      <td style={{ padding: "10px 14px" }}>
                        {user.is_admin ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#EDE9FE", color: "#5B21B6" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Admin
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: C.textTer }}>Standard</span>
                        )}
                      </td>
                      {/* Status */}
                      <td style={{ padding: "10px 14px" }}>
                        <span style={styles.badge(isActive ? "Approved" : "Draft")}>{isActive ? "Active" : "Inactive"}</span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        {canManage && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (openMenuId === user.id) { setOpenMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenMenuId(user.id);
                            }}
                            style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: "5px 8px", color: C.textSec, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            title="More options">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textTer }}>Showing {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* ── Fixed-position action dropdown (escapes table overflow) ── */}
      {openMenuId && (() => {
        const user = filtered.find(u => u.id === openMenuId);
        if (!user) return null;
        const isActive = user.is_active !== false;
        return (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 149 }} onClick={() => setOpenMenuId(null)} />
            <div style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 150, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.14)", minWidth: 160, overflow: "hidden" }}>
              <button onClick={() => { openEdit(user); setOpenMenuId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, background: "none", border: "none", cursor: "pointer", color: C.textPri }}
                onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                onMouseOut={e => e.currentTarget.style.background = "none"}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit user
              </button>
              <div style={{ height: 1, background: C.border }} />
              <button onClick={() => { toggleActive(user); setOpenMenuId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, background: "none", border: "none", cursor: "pointer", color: isActive ? C.redText : C.greenText }}
                onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                onMouseOut={e => e.currentTarget.style.background = "none"}>
                {isActive
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                }
                {isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </>
        );
      })()}

      {showModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>{editingUser ? "Edit user" : "New user"}</div>
                <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{editingUser ? "Update name, position and access" : "Create a new account with a temporary password"}</div>
              </div>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, padding: 6, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }} title="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={styles.label}>Full name <span style={styles.required}>*</span></label>
                <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Juan Dela Cruz" style={styles.input}
                  onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              {!editingUser && (
                <>
                  <div>
                    <label style={styles.label}>Email address <span style={styles.required}>*</span></label>
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="user@organization.com" style={styles.input}
                      onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                  </div>
                  <div>
                    <label style={styles.label}>Temporary password <span style={styles.required}>*</span></label>
                    <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="Min. 6 characters" style={styles.input}
                      onFocus={e => e.target.style.borderColor = C.coral} onBlur={e => e.target.style.borderColor = C.border} />
                    <p style={styles.hint}>The user should change this after their first login</p>
                  </div>
                </>
              )}
              <div>
                <label style={styles.label}>Position <span style={styles.required}>*</span></label>
                <select value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} style={styles.input}>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, border: `1px solid ${form.is_admin ? "#C4B5FD" : C.border}`, background: form.is_admin ? "#F5F3FF" : C.white, transition: "background 0.2s, border-color 0.2s" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: form.is_admin ? "#EDE9FE" : C.offWhite, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={form.is_admin ? "#7C3AED" : C.textTer} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textPri }}>System Admin</div>
                    <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>Full access to settings, users, and all data</div>
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 8 }}>
                  <input type="checkbox" checked={form.is_admin} onChange={e => setForm(p => ({ ...p, is_admin: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: C.coral, cursor: "pointer" }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: form.is_admin ? "#5B21B6" : C.textTer }}>
                    {form.is_admin ? "Admin" : "Not admin"}
                  </span>
                </label>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8, background: C.offWhite }}>
              <button style={styles.btnSecondary} onClick={closeModal}>Cancel</button>
              <button style={{ ...styles.btnPrimary, opacity: saving ? 0.75 : 1 }} disabled={saving} onClick={handleSave}>
                {saving ? "Saving…" : editingUser ? "Save changes" : "Create user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── RFA HELPERS ──────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 11);
const fmtPeso = n => (n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Payment term types
const PAYMENT_TERM_TYPES = [
  { value: "dp_progress_retention", label: "DP + Progress + Retention" },
  { value: "progress_retention",    label: "Progress with Retention" },
  { value: "progress_only",         label: "Progress without Retention" },
  { value: "milestone",             label: "Milestone Billing" },
  { value: "full_turnkey_retention",label: "Full Turnkey with Retention" },
  { value: "full_turnkey",          label: "Full Turnkey" },
];
// Feature flags per type
const PT_HAS_DP         = new Set(["dp_progress_retention"]);
const PT_HAS_PROGRESS   = new Set(["dp_progress_retention","progress_retention","progress_only"]);
const PT_HAS_RETENTION  = new Set(["dp_progress_retention","progress_retention","full_turnkey_retention"]);
const PT_IS_MILESTONE   = new Set(["milestone"]);
const PT_HAS_COMPLETION = new Set(["full_turnkey", "full_turnkey_retention"]);

const PROGRESS_FREQUENCIES = [
  { value: "monthly_poc", label: "Monthly (POC)" },
  { value: "weekly_poc",  label: "Weekly (POC)"  },
];
const COMMENCEMENT_TYPES = [
  { value: "noa_ntp",     label: "Upon NOA / NTP Issuance" },
  { value: "receipt_dp",  label: "Upon Receipt of Downpayment" },
  { value: "exact_date",  label: "Exact Date" },
];
const DEFAULT_LD = "1/10 of 1% per calendar day of delay on the contract amount";

const RTB_RECOMMENDED = {
  dp:        "• Signed contract executed by authorized signatories\n• Performance bond submitted and accepted\n• All-risk / contractor's all-risk insurance (CARI) submitted\n• Advance payment bond submitted (if applicable)\n• Approved work program and S-curve submitted",
  progress:  "• Monthly accomplishment report signed by site engineer\n• % completion validated by PH1 project manager\n• Supporting documents submitted (photos, delivery receipts, inspection reports)\n• Previous deficiencies / punch items from prior billing cleared",
  retention: "• Certificate of Project Completion issued by PH1\n• All punch list items fully resolved and accepted\n• Defects Liability Period (DLP) fully elapsed\n• Final as-built drawings submitted\n• Government permits / occupancy certificate (if applicable) secured",
  completion: "• Certificate of Final Acceptance signed by authorized PH1 representative\n• All remaining punch list items cleared\n• O&M manuals and equipment warranties submitted\n• Project turnover documents complete and acknowledged",
};

const RETENTION_PARTIAL_TRIGGERS = [
  { value: "final_acceptance",       label: "Final Acceptance" },
  { value: "substantial_completion", label: "Substantial Completion" },
  { value: "completion_cert",        label: "Certificate of Completion" },
  { value: "custom",                 label: "Custom (specify below)" },
];

function RTBDocList({ docs = [], onChange, disabled }) {
  const [draft, setDraft] = React.useState("");
  const addDoc = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...docs, v]);
    setDraft("");
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ ...styles.label, marginBottom: 5 }}>Required Billing Documents</label>
      {docs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {docs.map((doc, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(255,255,255,0.8)", border: "0.5px solid rgba(0,0,0,0.10)", borderRadius: 100, fontSize: 11, color: "#374151", boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 0.5px 0 rgba(255,255,255,0.9)" }}>
              {doc}
              {!disabled && (
                <button type="button" onClick={() => onChange(docs.filter((_, j) => j !== i))}
                  style={{ background: "rgba(0,0,0,0.08)", border: "none", cursor: "pointer", color: "#6B7280", padding: 0, width: 15, height: 15, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1, flexShrink: 0 }}>×</button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <div style={{ display: "flex", gap: 6 }}>
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDoc(); } }}
            placeholder="e.g. Signed accomplishment report…"
            style={{ ...styles.input, margin: 0, flex: 1, fontSize: 11, borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} />
          <button type="button" onClick={addDoc}
            style={{ padding: "6px 13px", fontSize: 11, background: "rgba(255,255,255,0.8)", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", color: C.textSec, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            Add
          </button>
        </div>
      )}
      {disabled && docs.length === 0 && (
        <div style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>No required documents specified</div>
      )}
    </div>
  );
}

// Default payment_term_data object — all sub-fields
function defaultPtData() {
  return {
    dp_percent: "20",   dp_override: false, dp_override_amount: "", dp_override_remarks: "", dp_recoupable: true,
    progress_freq: "monthly_poc",
    retention_percent: "10",
    milestones: [],
    milestone_has_retention: false, milestone_retention_mode: "each",
    // Right to bill & release
    dp_bill_conditions: "",
    progress_bill_conditions: "",
    retention_bill_conditions: "",
    completion_bill_conditions: "",
    dp_billing_docs: [],
    progress_billing_docs: [],
    retention_billing_docs: [],
    completion_billing_docs: [],
    dp_release_days: "15",          dp_release_fixed: false, dp_release_override: false, dp_release_remarks: "",
    progress_release_days: "30",    progress_release_fixed: false, progress_release_override: false, progress_release_remarks: "",
    progress_billing_cutoff_day: "",
    progress_payment_target_day: "",
    retention_billing_months: "12", retention_release_fixed: false, retention_billing_override: false, retention_billing_remarks: "",
    retention_release_days: "30",   retention_release_override: false, retention_release_remarks: "",
    retention_partial: false,
    retention_partial_pct: "50",
    retention_partial_trigger: "final_acceptance",
    retention_partial_trigger_custom: "",
    retention_partial_release_days: "30",
    completion_release_days: "30",  completion_release_fixed: false, completion_release_override: false, completion_release_remarks: "",
    milestone_release_days: "30",   milestone_release_override: false, milestone_release_remarks: "",
    // Retention deduction timing (for progress types)
    retention_deduction_mode: "each_invoice",
    // Bonds
    surety_bond_override: false,    surety_bond_override_amount: "",    surety_bond_remarks: "",    surety_bond_release: "",
    performance_bond_percent: "30",
    performance_bond_override: false, performance_bond_override_amount: "", performance_bond_remarks: "", performance_bond_release: "",
    warranty_bond_override: false,  warranty_bond_override_amount: "",  warranty_bond_remarks: "",  warranty_bond_release: "",
    // Milestone bonds
    milestone_surety_required: false,    milestone_surety_amount: "",    milestone_surety_remarks: "",
    milestone_performance_required: false, milestone_performance_amount: "", milestone_performance_remarks: "",
    milestone_warranty_required: false,  milestone_warranty_amount: "",  milestone_warranty_remarks: "",
    // Timeline
    commencement_type: "noa_ntp",   commencement_days: "",  dp_processing_days: "14",
    completion_mode: "end_date",  work_duration: "",  work_duration_type: "calendar_days",
    completion_delay_justification: "",
    // Warranty
    warranty_period: "12",
    // Tax
    vat_applicable: false, withholding_tax_percent: "2",
  };
}

function defaultProposal(scopeItems = []) {
  const items = scopeItems.length
    ? scopeItems.map(si => ({ id: uid(), description: si.description || "", qty: String(si.quantity || "1"), unit: si.unit_of_measure || "", unit_price: "" }))
    : [{ id: uid(), description: "", qty: "1", unit: "", unit_price: "" }];
  return { id: uid(), date: "", items, taxes: [{ id: uid(), name: "VAT", rate: "12" }], notes: "", attachment_url: "", attachment_name: "" };
}

function defaultVendorSlot(slot, scopeItems = []) {
  return {
    slot, vendor_id: "",
    participation_status: "Submitted",
    payment_term_type: "",
    payment_term_data: defaultPtData(),
    commencement_date: "", completion_date: "",
    price_validity: "", liquidated_damages: DEFAULT_LD, remarks: "",
    proposals: scopeItems.length ? [defaultProposal(scopeItems)] : [],
  };
}

function computeProposalTotals(proposal) {
  const subtotal = proposal.items.reduce((sum, i) => sum + (parseFloat(i.unit_price || 0) * parseFloat(i.qty || 0)), 0);
  // Ensure at least a default VAT entry exists (guard for old saved data)
  const rawTaxes = proposal.taxes?.length ? proposal.taxes : [{ id: "vat", name: "VAT", rate: "12" }];
  const taxes = rawTaxes.map(t => ({
    ...t, computed: t.rate ? parseFloat(t.rate) / 100 * subtotal : 0,
    isDeduction: t.name.toLowerCase().includes("withholding"),
  }));
  // WT is a payment deduction (not part of contract price); only non-deduction taxes (e.g. VAT) are added to the total
  return { subtotal, taxes, total: subtotal + taxes.reduce((s, t) => s + (t.isDeduction ? 0 : t.computed), 0) };
}

function computePaymentBreakdown(ptType, ptData, T) {
  if (!ptType || !T || T <= 0) return [];
  const dp  = parseFloat(ptData.dp_percent  || 0) / 100;
  const ret = parseFloat(ptData.retention_percent || 0) / 100;
  const progLabel = PROGRESS_FREQUENCIES.find(f => f.value === ptData.progress_freq)?.label || "Monthly";
  if (ptType === "dp_progress_retention") {
    const dpA = T*dp, retA = T*ret;
    return [
      { label:`Downpayment (${ptData.dp_percent||0}%)`, amount:dpA,   color:"#2563EB" },
      { label:`Progress (${progLabel})`,                 amount:T-dpA-retA, color:"#059669" },
      { label:`Retention (${ptData.retention_percent||0}%)`, amount:retA, color:"#D97706" },
    ];
  }
  if (ptType === "progress_retention") {
    const retA = T*ret;
    return [
      { label:`Progress (${progLabel})`,                 amount:T-retA, color:"#059669" },
      { label:`Retention (${ptData.retention_percent||0}%)`, amount:retA, color:"#D97706" },
    ];
  }
  if (ptType === "progress_only")
    return [{ label:`Progress Billing (${progLabel})`, amount:T, color:"#059669" }];
  if (ptType === "milestone") {
    const ms     = ptData.milestones || [];
    const hasRet = ptData.milestone_has_retention;
    const retPct = hasRet ? parseFloat(ptData.retention_percent || 10) / 100 : 0;
    const mode   = ptData.milestone_retention_mode || "each";
    const rows   = ms.map((m, i) => {
      const gross  = parseFloat(m.percent || 0) / 100 * T;
      const isLast = i === ms.length - 1;
      const deduct = hasRet && (mode === "each" || isLast) ? gross * retPct : 0;
      return { label: (m.label || `Milestone ${i + 1}`) + (deduct > 0 ? " (net)" : ""), amount: gross - deduct, color: "#7C3AED" };
    });
    if (hasRet) rows.push({ label: `Retention (${ptData.retention_percent || 10}%)`, amount: T * retPct, color: "#D97706" });
    return rows;
  }
  if (ptType === "full_turnkey_retention") {
    const retA = T*ret;
    return [
      { label:"Full Payment upon Completion", amount:T-retA, color:"#059669" },
      { label:`Retention (${ptData.retention_percent||0}%)`, amount:retA, color:"#D97706" },
    ];
  }
  if (ptType === "full_turnkey")
    return [{ label:"Full Payment upon Completion", amount:T, color:"#059669" }];
  return [];
}

// Auto bond amounts: surety = DP%, performance = performance_bond_percent (default 30%), warranty = retention%
function autoBondAmounts(ptType, ptData, T) {
  return {
    surety:      PT_HAS_DP.has(ptType)        ? T * parseFloat(ptData.dp_percent||0)/100                     : 0,
    performance: PT_HAS_PROGRESS.has(ptType)  ? T * parseFloat(ptData.performance_bond_percent||30)/100      : 0,
    warranty:    PT_HAS_RETENTION.has(ptType) ? T * parseFloat(ptData.retention_percent||0)/100
               : (ptType === "milestone" && ptData.milestone_has_retention) ? T * parseFloat(ptData.retention_percent||10)/100 : 0,
  };
}

function computeChecklist(vendors, vendorList, awardedSlot, awardReason) {
  const items = [];
  vendors.forEach((v, vi) => {
    const label = vendorList.find(vl => String(vl.id) === String(v.vendor_id))?.full_name || `Vendor ${vi + 1}`;
    if (!v.vendor_id) { items.push({ vendor: label, field: "Vendor company not assigned — select a vendor in Detailed Proposal" }); return; }
    // Non-submitted vendors only need a vendor selected — skip all other checks
    if (v.participation_status && v.participation_status !== "Submitted") return;
    if (!v.proposals.length)  items.push({ vendor: label, field: "No cost proposal added" });
    else if (!v.proposals.some(p => p.items.some(i => parseFloat(i.unit_price||0) > 0)))
                              items.push({ vendor: label, field: "No unit prices entered" });
    if (!v.payment_term_type) items.push({ vendor: label, field: "Payment terms not set" });
    const ptd = v.payment_term_data || {};
    if ((ptd.commencement_type === "noa_ntp" || ptd.commencement_type === "receipt_dp") && !ptd.commencement_days)
                              items.push({ vendor: label, field: "Commencement days not set" });
    const completionMode = ptd.completion_mode || "end_date";
    if (completionMode === "work_duration" && !ptd.work_duration) items.push({ vendor: label, field: "Work duration not set" });
    if (completionMode === "end_date" && !v.completion_date)      items.push({ vendor: label, field: "Completion date missing" });
    if (!ptd.warranty_period) items.push({ vendor: label, field: "Warranty period missing" });
    if (!v.price_validity)    items.push({ vendor: label, field: "Price validity date missing" });
  });
  if (!awardedSlot)          items.push({ vendor: "Award", field: "Recommended vendor not selected" });
  if (!awardReason?.trim())  items.push({ vendor: "Award", field: "Justification / reason missing" });
  return items;
}

/**
 * computeTimelineFeasibility — shared helper used in both Detailed Proposal
 * and Summary & Recommendation.
 * Returns { ok, total, avail, breakdown, msg } or null if not applicable.
 */
function computeTimelineFeasibility(v, pr) {
  const ptd  = v.payment_term_data || {};
  const mode = ptd.completion_mode || "end_date";
  if (mode !== "work_duration") return null;
  const durDays = parseInt(ptd.work_duration || 0);
  if (!durDays || !pr?.end_date) return null;
  const commType = ptd.commencement_type;
  if (commType !== "noa_ntp" && commType !== "receipt_dp") return null;
  const procDays  = commType === "receipt_dp" ? parseInt(ptd.dp_processing_days || 14) : 0;
  const mobilDays = parseInt(ptd.commencement_days || 0);
  const total     = procDays + mobilDays + durDays;
  const avail     = Math.floor((new Date(pr.end_date) - new Date()) / 86400000);
  const ok        = total <= avail;
  const shortBy   = ok ? 0 : total - avail;
  const durLabel  = `${durDays} ${ptd.work_duration_type === "working_days" ? "WD" : "CD"}`;
  // components for structured display
  const components = [
    procDays  > 0 ? { label: "DP Processing",  days: procDays  } : null,
    mobilDays > 0 ? { label: "Mobilization",    days: mobilDays } : null,
    { label: ptd.work_duration_type === "working_days" ? "Work Duration (WD)" : "Work Duration (CD)", days: durDays },
  ].filter(Boolean);
  const breakdown = components.map(c => `${c.days}d ${c.label}`).join(" + ");
  return { ok, total, avail, shortBy, breakdown, components, durLabel };
}

// ─── RFQ LIST PAGE ────────────────────────────────────────────────────────────
function RFQListPage({ profile, setPage, setSelectedRFQId }) {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buFilter, setBuFilter] = useState([]);
  const [projectFilter, setProjectFilter] = useState([]);
  const [activeCard, setActiveCard] = useState(null);

  const rfqCardStatusMap = {
    "Draft":   ["Draft"],
    "Open":    ["Open"],
    "Closed":  ["Closed"],
    "Awarded": ["Awarded"],
  };

  const fetchRFQs = () => {
    setLoading(true);
    supabase.from("rfqs")
      .select("id, rfq_number, status, deadline, created_at, purchase_requests(pr_number, projects(name, business_unit))")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRfqs(data || []); setLoading(false); });
  };

  useEffect(() => { fetchRFQs(); }, []);

  useEffect(() => {
    if (projectFilter.length > 0) {
      const valid = new Set(rfqs.filter(r => buFilter.length === 0 || buFilter.includes(r.purchase_requests?.projects?.business_unit)).map(r => r.purchase_requests?.projects?.name).filter(Boolean));
      const still = projectFilter.filter(p => valid.has(p));
      if (still.length !== projectFilter.length) setProjectFilter(still);
    }
  }, [buFilter]);

  const rfqStatusColor = (s) => ({
    Draft:   { bg: C.grayBg,  color: C.grayText  },
    Open:    { bg: C.tealBg,  color: C.tealText   },
    Closed:  { bg: C.amberBg, color: C.amberText  },
    Awarded: { bg: C.greenBg, color: C.greenText  },
  }[s] || { bg: C.grayBg, color: C.grayText });

  const rfqBuOptions = [...new Set(rfqs.map(r => r.purchase_requests?.projects?.business_unit).filter(Boolean))].sort();
  const rfqProjectOptions = [...new Set(
    rfqs.filter(r => buFilter.length === 0 || buFilter.includes(r.purchase_requests?.projects?.business_unit)).map(r => r.purchase_requests?.projects?.name).filter(Boolean)
  )].sort();

  const rfqBase = rfqs.filter(r =>
    (buFilter.length === 0 || buFilter.includes(r.purchase_requests?.projects?.business_unit)) &&
    (projectFilter.length === 0 || projectFilter.includes(r.purchase_requests?.projects?.name))
  );

  const filtered = rfqBase.filter(r => {
    const s = search.toLowerCase();
    const matchSearch =
      (r.rfq_number || "").toLowerCase().includes(s) ||
      (r.purchase_requests?.pr_number || "").toLowerCase().includes(s) ||
      (r.purchase_requests?.projects?.name || "").toLowerCase().includes(s);
    const matchStatus = !activeCard || activeCard === "Total"
      ? true
      : (rfqCardStatusMap[activeCard] || []).includes(r.status);
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div style={styles.topBar}>
        <div style={{ flex: 1 }} />
      </div>
      <div style={styles.pageBody}>
        <div style={{ maxWidth: "80%", margin: "0 auto" }}>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
            {[
              { label: "Total",   value: rfqBase.length,                                        color: C.textPri,   desc: "All quotation requests"  },
              { label: "Draft",   value: rfqBase.filter(r => r.status === "Draft").length,   color: C.grayText,  desc: "Not yet published"        },
              { label: "Open",    value: rfqBase.filter(r => r.status === "Open").length,    color: C.tealText,  desc: "Accepting vendor quotes"  },
              { label: "Closed",  value: rfqBase.filter(r => r.status === "Closed").length,  color: C.amberText, desc: "Bidding period ended"     },
              { label: "Awarded", value: rfqBase.filter(r => r.status === "Awarded").length, color: C.greenText, desc: "Vendor selected"          },
            ].map(s => {
              const isActive = activeCard === s.label;
              return (
                <div key={s.label}
                  onClick={() => setActiveCard(prev => prev === s.label ? null : s.label)}
                  style={{
                    background: isActive ? C.coralLight : C.white,
                    border: `1px solid ${isActive ? C.coral : C.border}`,
                    borderRadius: 12, padding: "14px 18px",
                    boxShadow: isActive ? `0 0 0 2px ${C.coralMid}` : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
                    cursor: "pointer", userSelect: "none",
                    transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
                  }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.coralDark : C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.4 }}>{s.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Search and filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={13} color={C.textTer} /></div>
              <input placeholder="Search RFQ, PR number, or project…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 30, fontSize: 12 }} />
            </div>
            <MultiSelect options={rfqBuOptions} value={buFilter} onChange={setBuFilter} placeholder="All Business Units" />
            <MultiSelect options={rfqProjectOptions} value={projectFilter} onChange={setProjectFilter} placeholder="All Projects" />
          </div>

          {/* Table */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)", overflow: "clip" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.coralMid }}>
                  {["RFQ #","PR #","Project","Status","Deadline",""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.coralDark, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.coralLight}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px 0", color: C.textTer }}>Loading…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "48px 0", color: C.textTer }}>No RFQs found.</td></tr>}
                {!loading && filtered.map((r, i) => {
                  const sc = rfqStatusColor(r.status);
                  return (
                    <tr key={r.id}
                      onClick={() => { setSelectedRFQId(r.id); setPage("rfq_detail"); }}
                      style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "9px 14px", fontWeight: 600, color: C.coral, fontFamily: "monospace" }}>{r.rfq_number}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: C.textSec, fontFamily: "monospace" }}>{r.purchase_requests?.pr_number || "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: C.textPri }}>{r.purchase_requests?.projects?.name || "—"}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ background: sc.bg, color: sc.color, borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{r.status}</span>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: r.deadline ? C.textPri : C.textTer }}>{r.deadline ? fmtShort(r.deadline) : "Not set"}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right" }}><Icon name="chevronRight" size={13} color={C.textTer} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.textTer }}>Showing {filtered.length} of {rfqs.length} records</span>
              <button onClick={fetchRFQs} style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }}>Refresh</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SubmissionsTab({ rfqId, rfq, rfqVendors }) {
  const [submissions, setSubmissions] = useState([]);
  useEffect(() => {
    supabase.from("rfq_submissions")
      .select("*, rfq_vendors(vendor_name, is_adhoc)")
      .eq("rfq_id", rfqId)
      .eq("status", "submitted")
      .order("version", { ascending: false })
      .then(({ data }) => {
        // Keep only the latest submitted version per vendor
        const seen = new Set();
        const latest = (data || []).filter(s => {
          if (seen.has(s.rfq_vendor_id)) return false;
          seen.add(s.rfq_vendor_id);
          return true;
        });
        setSubmissions(latest);
      });
  }, [rfqId]);

  if (submissions.length === 0) {
    return <div style={{ ...styles.card, textAlign: "center", padding: 32, color: C.textTer }}>No submissions yet.</div>;
  }

  const ct = rfq?.contract_terms || {};

  const devCell = (required, proposed, vi) => {
    const isDeviation = proposed !== null && proposed !== undefined && String(proposed) !== String(required);
    return (
      <td key={vi} style={{ padding: "8px 12px", fontSize: 12, background: isDeviation ? C.amberBg : "transparent", color: isDeviation ? C.amberText : C.textPri, fontWeight: isDeviation ? 700 : 400 }}>
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

  const rows = [
    { label: "Quoted Amount", req: "—", vals: submissions.map(s => s.quoted_amount ? `₱${Number(s.quoted_amount).toLocaleString()}` : "—"), isAmount: true },
    { label: "Work Duration", req: rfq?.work_duration ? `${rfq.work_duration} days` : "—", vals: submissions.map(s => s.proposed_work_duration ? `${s.proposed_work_duration} days` : null) },
    { label: "Payment Type", req: rfq?.payment_term_type || "—", vals: submissions.map(s => s.proposed_payment_term_type || null) },
    { label: "Warranty (mo.)", req: ct.warranty_months ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.warranty_months ?? null) },
    { label: "Perf. Bond %", req: ct.perf_bond_pct ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.perf_bond_pct ?? null) },
    { label: "Defects Liab. (mo.)", req: ct.defects_liability_months ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.defects_liability_months ?? null) },
    { label: "Retention %", req: ct.retention_pct ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.retention_pct ?? null) },
    { label: "LD Rate", req: ct.ld_rate ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.ld_rate ?? null) },
    { label: "Currency", req: ct.payment_currency ?? "—", vals: submissions.map(s => s.proposed_contract_terms?.payment_currency ?? null) },
  ];

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
                {s.version > 1 && <span style={{ display: "block", fontSize: 10, color: C.coral, fontWeight: 600 }}>v{s.version}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : C.offWhite }}>
              <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.textSec }}>{row.label}</td>
              <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: C.tealText, background: C.tealBg }}>{String(row.req)}</td>
              {row.vals.map((v, vi) =>
                row.isAmount
                  ? <td key={vi} style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700, color: C.textPri }}>{v}</td>
                  : devCell(row.req, v, vi)
              )}
            </tr>
          ))}
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

// ─── RFQ DETAIL PAGE ──────────────────────────────────────────────────────────
function RFQDetailPage({ profile, rfqId, setPage }) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [rfq, setRfq]           = useState(null);
  const [pr, setPr]             = useState(null);
  const [rfqVendors, setRfqVendors] = useState([]);

  const [workDuration, setWorkDuration]   = useState("");
  const [ptType, setPtType]               = useState("");
  const [ptData, setPtData]               = useState(defaultPtData());
  const [contractTerms, setContractTerms] = useState({
    warranty_months: 12, perf_bond_pct: 10,
    defects_liability_months: 12, ld_rate: DEFAULT_LD,
    retention_pct: 10, payment_currency: "PHP",
  });
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes]       = useState("");
  const [vendorDescription, setVendorDescription] = useState("");
  const [vendorJustification, setVendorJustification] = useState("");
  const [scopeItems, setScopeItems] = useState([]);
  const [newScopeItem, setNewScopeItem] = useState("");
  const [newScopeQty, setNewScopeQty]   = useState("1");
  const [newScopeUnit, setNewScopeUnit] = useState("lot");
  const [activeTab, setActiveTab] = useState("details");
  const [sentVendorIds, setSentVendorIds] = useState(new Set());

  const [showAddVendor, setShowAddVendor] = useState(false);
  const [accreditedVendors, setAccreditedVendors] = useState([]);
  const [vendorMode, setVendorMode]   = useState("accredited");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [adhocName, setAdhocName]     = useState("");
  const [adhocEmail, setAdhocEmail]   = useState("");

  const canEdit = can(profile, "pr.review");

  useEffect(() => { fetchRFQ(); }, [rfqId]);

  const fetchRFQ = async () => {
    setLoading(true);
    const { data } = await supabase.from("rfqs")
      .select("*, purchase_requests(pr_number, description, justification, start_date, end_date, plans_file_url, plans_file_name, tor_file_url, tor_file_name, specs_file_url, specs_file_name, projects(name, business_unit, project_code))")
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
      setVendorDescription(data.vendor_description ?? data.purchase_requests?.description ?? "");
      setVendorJustification(data.vendor_justification ?? data.purchase_requests?.justification ?? "");
    }
    const { data: vs } = await supabase.from("rfq_vendors").select("*").eq("rfq_id", rfqId).order("created_at");
    setRfqVendors(vs || []);
    setSentVendorIds(prev => {
      const next = new Set(prev);
      (vs || []).filter(v => v.opened_at || v.submitted_at).forEach(v => next.add(v.id));
      return next;
    });
    const { data: av } = await supabase.from("vendors")
      .select("id, vendor_code, accreditation_status, vendor_company_info(company_name, rfq_email)")
      .eq("accreditation_status", "Accredited");
    setAccreditedVendors(av || []);
    if (data?.pr_id) {
      const { data: si } = await supabase.from("scope_items").select("*").eq("pr_id", data.pr_id).order("sort_order");
      setScopeItems(si || []);
    }
    setLoading(false);
  };

  const saveRFQ = async () => {
    setSaving(true);
    const { error } = await supabase.from("rfqs").update({
      work_duration: workDuration ? parseInt(workDuration) : null,
      payment_term_type: ptType,
      payment_term_data: ptData,
      contract_terms: contractTerms,
      deadline: deadline || null,
      notes,
      vendor_description: vendorDescription,
      vendor_justification: vendorJustification,
      updated_at: new Date().toISOString(),
    }).eq("id", rfqId);
    setSaving(false);
    if (error) alert(`Save failed: ${error.message}`);
    await fetchRFQ();
  };

  const addScopeItem = async () => {
    if (!newScopeItem.trim()) return;
    const { count } = await supabase.from("scope_items").select("id", { count: "exact", head: true }).eq("pr_id", rfq.pr_id);
    await supabase.from("scope_items").insert({ pr_id: rfq.pr_id, description: newScopeItem.trim(), quantity: parseFloat(newScopeQty) || 1, unit_of_measure: newScopeUnit.trim() || "lot", sort_order: count || 0 });
    setNewScopeItem(""); setNewScopeQty("1"); setNewScopeUnit("lot");
    await fetchRFQ();
  };

  const updateScopeItem = async (itemId, field, value) => {
    setScopeItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
    const dbField = field === "qty" ? "quantity" : field === "unit" ? "unit_of_measure" : field;
    const dbValue = field === "qty" ? (parseFloat(value) || 1) : value;
    await supabase.from("scope_items").update({ [dbField]: dbValue }).eq("id", itemId);
  };

  const removeScopeItem = async (itemId) => {
    await supabase.from("scope_items").delete().eq("id", itemId);
    await fetchRFQ();
  };

  const addVendor = async () => {
    const isAdhoc = vendorMode === "adhoc";
    let name = adhocName, email = adhocEmail, vendorId = null;
    if (!isAdhoc) {
      const av = accreditedVendors.find(v => String(v.id) === String(selectedVendorId));
      const avCI = Array.isArray(av?.vendor_company_info) ? av.vendor_company_info[0] : av?.vendor_company_info;
      name  = avCI?.company_name || "";
      email = avCI?.rfq_email || "";
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

  const saveDeadline = async (val) => {
    setDeadline(val);
    await supabase.from("rfqs").update({ deadline: val || null, updated_at: new Date().toISOString() }).eq("id", rfqId);
  };

  const rfqEmailHtml = (v, submitUrl, fmtDeadline) =>
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#3F3F3F;">Request for Quotation</h2>
      <p>Dear <strong>${v.vendor_name}</strong>,</p>
      <p>You are invited to submit a quotation for the following:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
        <tr><td style="padding:6px 0;color:#888;width:140px;">RFQ Number</td><td style="padding:6px 0;font-weight:600;">${rfq?.rfq_number}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Project</td><td style="padding:6px 0;">${pr?.projects?.name || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Description</td><td style="padding:6px 0;">${vendorDescription || pr?.description || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Deadline</td><td style="padding:6px 0;font-weight:600;color:#3F3F3F;">${fmtDeadline}</td></tr>
      </table>
      <p>Click the link below to view the full details and submit your quotation — no account needed:</p>
      <p style="margin:24px 0;">
        <a href="${submitUrl}" style="background:#3F3F3F;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Submit Quotation</a>
      </p>
      <p style="font-size:12px;color:#888;">Or copy this link: ${submitUrl}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:11px;color:#aaa;">Commercial &amp; Contract Management System</p>
    </div>`;

  const sendRFQ = async () => {
    const activeVendors = rfqVendors.filter(v => v.is_active);
    if (activeVendors.length === 0) { alert("Add at least one vendor before sending."); return; }
    if (!deadline) { alert("Please set a submission deadline before sending."); return; }
    if (!window.confirm(`Send RFQ ${rfq?.rfq_number} to ${activeVendors.length} vendor(s)?`)) return;
    setSaving(true);
    await supabase.from("rfqs").update({ status: "Open", updated_at: new Date().toISOString() }).eq("id", rfqId);
    const fmtDeadline = deadline ? new Date(deadline).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "TBD";
    for (const v of activeVendors) {
      if (!v.vendor_email) continue;
      const submitUrl = `${window.location.origin}/vendor/rfq/${v.token}`;
      await sendEmail(v.vendor_email, `Request for Quotation – ${rfq?.rfq_number}`, rfqEmailHtml(v, submitUrl, fmtDeadline));
    }
    setSentVendorIds(prev => { const next = new Set(prev); activeVendors.forEach(v => next.add(v.id)); return next; });
    setSaving(false);
    await fetchRFQ();
    alert(`RFQ sent to ${activeVendors.filter(v => v.vendor_email).length} vendor(s).`);
  };

  const sendToVendor = async (v) => {
    if (!deadline) { alert("Please set a submission deadline before sending."); return; }
    if (!window.confirm(`Send RFQ ${rfq?.rfq_number} to ${v.vendor_name}?`)) return;
    setSaving(true);
    if (rfq?.status === "Draft") {
      await supabase.from("rfqs").update({ status: "Open", updated_at: new Date().toISOString() }).eq("id", rfqId);
    }
    if (v.vendor_email) {
      const fmtDeadline = deadline ? new Date(deadline).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "TBD";
      const submitUrl = `${window.location.origin}/vendor/rfq/${v.token}`;
      await sendEmail(v.vendor_email, `Request for Quotation – ${rfq?.rfq_number}`, rfqEmailHtml(v, submitUrl, fmtDeadline));
    }
    setSentVendorIds(prev => new Set([...prev, v.id]));
    setSaving(false);
    await fetchRFQ();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.textSec }}>Loading…</div>;

  const tabs = ["details", "vendors", "submissions", "preview"];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setPage("rfq_list")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.coral }}>← RFQ List</button>
          <span style={{ color: C.textTer }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.textPri, fontFamily: "monospace" }}>{rfq?.rfq_number}</span>
          <span style={styles.badge(rfq?.status || "Draft")}>{rfq?.status}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canEdit && (rfq?.status === "Draft" || rfq?.status === "Open") && (
            <button onClick={saveRFQ} disabled={saving} style={styles.btnSecondary}>{saving ? "Saving…" : "Save"}</button>
          )}
        </div>
      </div>

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

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "9px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: activeTab === t ? 700 : 400, color: activeTab === t ? C.coral : C.textSec, borderBottom: activeTab === t ? `2px solid ${C.coral}` : "2px solid transparent", textTransform: "capitalize" }}>
            {t === "details" ? "RFQ Details" : t === "vendors" ? `Vendors (${rfqVendors.length})` : t === "submissions" ? "Submissions" : "Vendor Preview"}
          </button>
        ))}
      </div>

      {activeTab === "details" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 1. Description */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Description</h3>
            <textarea
              value={vendorDescription}
              onChange={e => setVendorDescription(e.target.value)}
              rows={3}
              disabled={!canEdit}
              style={{ ...styles.input, resize: "vertical" }}
              placeholder="Describe the work to be done…"
            />
            <p style={styles.hint}>Pre-filled from the PR. Edit here to tailor the message for vendors.</p>
          </div>

          {/* 2. Justification */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Justification</h3>
            <textarea
              value={vendorJustification}
              onChange={e => setVendorJustification(e.target.value)}
              rows={3}
              disabled={!canEdit}
              style={{ ...styles.input, resize: "vertical" }}
              placeholder="Why this work is needed…"
            />
          </div>

          {/* 3. Scope of Work */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Scope of Work <span style={{ fontSize: 12, fontWeight: 400, color: C.textSec }}>(required items vendors must price)</span></h3>
            {scopeItems.length === 0 ? (
              <p style={{ fontSize: 13, color: C.textTer, margin: "0 0 12px" }}>No scope items yet. Add items below.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", width: 28 }}>#</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase" }}>Description</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", width: 70 }}>Qty</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", width: 80 }}>Unit</th>
                    {canEdit && <th style={{ width: 32 }} />}
                  </tr>
                </thead>
                <tbody>
                  {scopeItems.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.textTer }}>{i + 1}</td>
                      <td style={{ padding: "4px 6px" }}>
                        {canEdit
                          ? <input value={item.description} onChange={e => updateScopeItem(item.id, "description", e.target.value)}
                              style={{ ...styles.input, marginBottom: 0, fontSize: 13 }} />
                          : <span style={{ fontSize: 13, color: C.textPri }}>{item.description}</span>
                        }
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        {canEdit
                          ? <input type="number" min="0" step="any" value={item.quantity ?? 1} onChange={e => updateScopeItem(item.id, "qty", e.target.value)}
                              style={{ ...styles.input, marginBottom: 0, fontSize: 13, textAlign: "right", width: 64 }} />
                          : <span style={{ fontSize: 12, color: C.textSec, display: "block", textAlign: "right" }}>{item.quantity ?? 1}</span>
                        }
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        {canEdit
                          ? <input value={item.unit_of_measure || "lot"} onChange={e => updateScopeItem(item.id, "unit", e.target.value)}
                              style={{ ...styles.input, marginBottom: 0, fontSize: 13, width: 72 }} />
                          : <span style={{ fontSize: 12, color: C.textSec }}>{item.unit_of_measure || "lot"}</span>
                        }
                      </td>
                      {canEdit && (
                        <td style={{ padding: "8px 6px", textAlign: "center" }}>
                          <button onClick={() => removeScopeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 16, lineHeight: 1 }}>×</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {canEdit && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={newScopeItem} onChange={e => setNewScopeItem(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addScopeItem()}
                  placeholder="Description…"
                  style={{ ...styles.input, flex: 1, marginBottom: 0 }} />
                <input type="number" min="0" step="any" value={newScopeQty} onChange={e => setNewScopeQty(e.target.value)}
                  style={{ ...styles.input, marginBottom: 0, width: 64, textAlign: "right" }} placeholder="Qty" />
                <input value={newScopeUnit} onChange={e => setNewScopeUnit(e.target.value)}
                  style={{ ...styles.input, marginBottom: 0, width: 72 }} placeholder="Unit" />
                <button onClick={addScopeItem} style={{ ...styles.btnSecondary, whiteSpace: "nowrap" }}>+ Add</button>
              </div>
            )}
          </div>

          {/* 4. Supporting Documents */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Supporting Documents</h3>
            {[
              { label: "Plans", url: pr?.plans_file_url, name: pr?.plans_file_name },
              { label: "Terms of Reference", url: pr?.tor_file_url, name: pr?.tor_file_name },
              { label: "Specifications", url: pr?.specs_file_url, name: pr?.specs_file_name },
            ].filter(d => d.url).length === 0 ? (
              <p style={{ fontSize: 13, color: C.textTer, margin: 0 }}>No documents attached to this PR.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Plans", url: pr?.plans_file_url, name: pr?.plans_file_name },
                  { label: "Terms of Reference", url: pr?.tor_file_url, name: pr?.tor_file_name },
                  { label: "Specifications", url: pr?.specs_file_url, name: pr?.specs_file_name },
                ].filter(d => d.url).map(doc => (
                  <div key={doc.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.offWhite, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.05em" }}>{doc.label}</div>
                      <div style={{ fontSize: 12, color: C.textPri }}>{doc.name || doc.url}</div>
                    </div>
                    <a href={doc.url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: C.coral, fontWeight: 600, textDecoration: "none", border: `1px solid ${C.coral}40`, borderRadius: 6, padding: "4px 10px" }}>
                      View / Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Schedule */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Schedule</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textSec, marginBottom: 4 }}>PR Start Date</div>
                <div style={{ fontSize: 13, color: C.textPri }}>{pr?.start_date ? new Date(pr.start_date).toLocaleDateString() : "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textSec, marginBottom: 4 }}>PR End Date</div>
                <div style={{ fontSize: 13, color: C.textPri }}>{pr?.end_date ? new Date(pr.end_date).toLocaleDateString() : "—"}</div>
              </div>
              <div />
            </div>
            <div style={{ maxWidth: 280 }}>
              <label style={styles.label}>Work Duration (calendar days) <span style={{ color: C.coral }}>*</span></label>
              <input type="number" min="1" value={workDuration} onChange={e => setWorkDuration(e.target.value)} disabled={!canEdit} style={styles.input} />
              <p style={styles.hint}>Editable — vendors may propose a different duration.</p>
            </div>
          </div>

          {/* 6. Payment Terms */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Payment Terms <span style={{ fontSize: 12, fontWeight: 400, color: C.textSec }}>(suggested — vendors may propose their own)</span></h3>
            <div>
              <label style={styles.label}>Payment Term Type</label>
              <select value={ptType} onChange={e => setPtType(e.target.value)} disabled={!canEdit} style={styles.input}>
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
                      <input type="number" min="0" max="100" value={ptData.dp_percent || ""} onChange={e => setPtData(p => ({ ...p, dp_percent: e.target.value }))} style={styles.input} disabled={!canEdit} />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
                      <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 12, color: C.textSec }}>
                        <input type="checkbox" checked={ptData.dp_recoupable !== false} onChange={e => setPtData(p => ({ ...p, dp_recoupable: e.target.checked }))} disabled={!canEdit} />
                        Recoupable per progress billing
                      </label>
                    </div>
                  </div>
                )}
                {PT_HAS_PROGRESS.has(ptType) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={styles.label}>Progress Billing Frequency</label>
                      <select value={ptData.progress_freq || "monthly_poc"} onChange={e => setPtData(p => ({ ...p, progress_freq: e.target.value }))} style={styles.input} disabled={!canEdit}>
                        {PROGRESS_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={styles.label}>Performance Bond %</label>
                      <input type="number" value={ptData.performance_bond_percent || ""} onChange={e => setPtData(p => ({ ...p, performance_bond_percent: e.target.value }))} style={styles.input} disabled={!canEdit} />
                    </div>
                  </div>
                )}
                {PT_HAS_RETENTION.has(ptType) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={styles.label}>Retention %</label>
                      <input type="number" value={ptData.retention_percent || ""} onChange={e => setPtData(p => ({ ...p, retention_percent: e.target.value }))} style={styles.input} disabled={!canEdit} />
                    </div>
                    <div>
                      <label style={styles.label}>Retention Deduction Mode</label>
                      <select value={ptData.retention_deduction_mode || "each_invoice"} onChange={e => setPtData(p => ({ ...p, retention_deduction_mode: e.target.value }))} style={styles.input} disabled={!canEdit}>
                        <option value="each_invoice">Withhold from each progress invoice</option>
                        <option value="final_invoice">Deduct on final invoice only</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Right to Bill & Release */}
            {ptType && (PT_HAS_DP.has(ptType) || PT_HAS_PROGRESS.has(ptType) || PT_HAS_RETENTION.has(ptType) || PT_HAS_COMPLETION.has(ptType)) && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Right to Bill & Release</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    PT_HAS_DP.has(ptType)        && { key: "dp",        label: "Downpayment", condField: "dp_bill_conditions",        docsField: "dp_billing_docs",        relField: "dp_release_days",         fixField: "dp_release_fixed",         relDef: "15", relUnit: "days",   rec: RTB_RECOMMENDED.dp,         accentColor: "#3B82F6", headerBg: "rgba(59,130,246,0.07)"  },
                    PT_HAS_PROGRESS.has(ptType)  && { key: "progress",  label: "Progress",    condField: "progress_bill_conditions",  docsField: "progress_billing_docs",  relField: "progress_release_days",   fixField: "progress_release_fixed",   relDef: "30", relUnit: "days",   rec: RTB_RECOMMENDED.progress,   accentColor: "#10B981", headerBg: "rgba(16,185,129,0.07)"  },
                    PT_HAS_RETENTION.has(ptType) && { key: "retention", label: "Retention",   condField: "retention_bill_conditions", docsField: "retention_billing_docs", relField: "retention_billing_months", fixField: "retention_release_fixed",  relDef: "12", relUnit: "months", rec: RTB_RECOMMENDED.retention,  accentColor: "#D97706", headerBg: "rgba(245,158,11,0.07)"   },
                    PT_HAS_COMPLETION.has(ptType)&& { key: "completion",label: "Completion",  condField: "completion_bill_conditions",docsField: "completion_billing_docs",relField: "completion_release_days",  fixField: "completion_release_fixed", relDef: "30", relUnit: "days",   rec: RTB_RECOMMENDED.completion, accentColor: "#0D9488", headerBg: "rgba(13,148,136,0.07)"  },
                  ].filter(Boolean).map(m => (
                    <div key={m.key} style={{ borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.05)" }}>
                      {/* Colored header with accent strip */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: m.headerBg, borderBottom: `0.5px solid ${m.accentColor}28` }}>
                        <div style={{ width: 3, height: 28, borderRadius: 2, background: m.accentColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: m.accentColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</span>
                      </div>
                      {/* Card body */}
                      <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.92)" }}>
                        {/* Right to Bill conditions */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                            <label style={{ ...styles.label, margin: 0 }}>Right to Bill — Conditions Before Invoice</label>
                            {canEdit && (
                              <button type="button" onClick={() => setPtData(p => ({ ...p, [m.condField]: m.rec }))}
                                style={{ fontSize: 10, padding: "3px 10px", background: `${m.accentColor}12`, border: `0.5px solid ${m.accentColor}40`, borderRadius: 100, color: m.accentColor, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                                ✦ Use recommended
                              </button>
                            )}
                          </div>
                          <textarea rows={3} value={ptData[m.condField] || ""} onChange={e => setPtData(p => ({ ...p, [m.condField]: e.target.value }))}
                            placeholder="Enter conditions vendor must meet before submitting invoice…"
                            style={{ ...styles.input, resize: "vertical", fontFamily: "inherit", fontSize: 12, lineHeight: 1.5, borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.12)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" }} disabled={!canEdit} />
                        </div>
                        {/* Billing documents */}
                        <RTBDocList docs={ptData[m.docsField] || []} onChange={v => setPtData(p => ({ ...p, [m.docsField]: v }))} disabled={!canEdit} />
                        {/* Progress billing rhythm (optional) */}
                        {m.key === "progress" && (
                          <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(16,185,129,0.07)", borderRadius: 10, border: "0.5px solid rgba(16,185,129,0.2)" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>📅 Billing Rhythm (optional)</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, color: C.textSec }}>Cutoff:</span>
                              <input type="number" min="1" max="31" value={ptData.progress_billing_cutoff_day || ""}
                                onChange={e => setPtData(p => ({ ...p, progress_billing_cutoff_day: e.target.value }))}
                                placeholder="day" style={{ ...styles.input, margin: 0, width: 58, textAlign: "right", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} disabled={!canEdit} />
                              <span style={{ fontSize: 11, color: C.textSec }}>of each month · Payment target:</span>
                              <input type="number" min="1" max="31" value={ptData.progress_payment_target_day || ""}
                                onChange={e => setPtData(p => ({ ...p, progress_payment_target_day: e.target.value }))}
                                placeholder="day" style={{ ...styles.input, margin: 0, width: 58, textAlign: "right", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} disabled={!canEdit} />
                              <span style={{ fontSize: 11, color: C.textSec }}>of the following month</span>
                            </div>
                          </div>
                        )}
                        {/* Payment release — Retention has optional partial release split */}
                        {m.key === "retention" ? (
                          <div style={{ marginBottom: 6 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: canEdit ? "pointer" : "default", userSelect: "none", marginBottom: 8 }}>
                              <input type="checkbox" checked={!!ptData.retention_partial} onChange={e => setPtData(p => ({ ...p, retention_partial: e.target.checked }))} disabled={!canEdit} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: C.textPri }}>Split into partial releases</span>
                            </label>
                            {ptData.retention_partial && (
                              <div style={{ padding: "10px 12px", background: "rgba(59,130,246,0.07)", borderRadius: 10, border: "0.5px solid rgba(59,130,246,0.2)", marginBottom: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>1st Release</div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                                  <input type="number" min="1" max="99" value={ptData.retention_partial_pct || "50"}
                                    onChange={e => setPtData(p => ({ ...p, retention_partial_pct: e.target.value }))}
                                    style={{ ...styles.input, margin: 0, width: 60, textAlign: "right", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} disabled={!canEdit} />
                                  <span style={{ fontSize: 11, color: C.textSec }}>% of retention at:</span>
                                  <select value={ptData.retention_partial_trigger || "final_acceptance"}
                                    onChange={e => setPtData(p => ({ ...p, retention_partial_trigger: e.target.value }))}
                                    style={{ ...styles.input, margin: 0, flex: 1, borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} disabled={!canEdit}>
                                    {RETENTION_PARTIAL_TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                  </select>
                                </div>
                                {(ptData.retention_partial_trigger || "final_acceptance") === "custom" && (
                                  <input value={ptData.retention_partial_trigger_custom || ""} onChange={e => setPtData(p => ({ ...p, retention_partial_trigger_custom: e.target.value }))}
                                    placeholder="Describe the trigger event…"
                                    style={{ ...styles.input, margin: 0, marginBottom: 6, borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} disabled={!canEdit} />
                                )}
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 11, color: C.textSec }}>Release within</span>
                                  <input type="number" min="1" value={ptData.retention_partial_release_days || "30"}
                                    onChange={e => setPtData(p => ({ ...p, retention_partial_release_days: e.target.value }))}
                                    style={{ ...styles.input, margin: 0, width: 60, textAlign: "right", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} disabled={!canEdit} />
                                  <span style={{ fontSize: 11, color: C.textSec }}>days of trigger event</span>
                                </div>
                              </div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>
                                {ptData.retention_partial
                                  ? `Final Release (${100 - parseInt(ptData.retention_partial_pct || 50)}% of retention):`
                                  : "Payment Release (after complete billing):"}
                              </span>
                              <input type="number" min="1" value={ptData.retention_billing_months || "12"}
                                onChange={e => setPtData(p => ({ ...p, retention_billing_months: e.target.value }))}
                                style={{ ...styles.input, margin: 0, width: 70, textAlign: "right", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} disabled={!canEdit} />
                              <span style={{ fontSize: 12, color: C.textSec }}>months after warranty / DLP</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>Payment Release (after complete billing):</span>
                            <input type="number" min="1" value={ptData[m.relField] || m.relDef} onChange={e => setPtData(p => ({ ...p, [m.relField]: e.target.value }))}
                              style={{ ...styles.input, margin: 0, width: 70, textAlign: "right", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.12)" }} disabled={!canEdit} />
                            <span style={{ fontSize: 12, color: C.textSec }}>{m.relUnit}</span>
                          </div>
                        )}
                        {/* Non-negotiable — iOS-style toggle */}
                        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: canEdit ? "pointer" : "default", userSelect: "none" }}>
                          <input type="checkbox" checked={!!ptData[m.fixField]} onChange={e => setPtData(p => ({ ...p, [m.fixField]: e.target.checked }))} disabled={!canEdit} style={{ display: "none" }} />
                          <div style={{ width: 40, height: 24, borderRadius: 12, background: ptData[m.fixField] ? "#DC2626" : "#E5E5EA", position: "relative", transition: "background 0.22s cubic-bezier(0.23,1,0.32,1)", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.08)", flexShrink: 0 }}>
                            <div style={{ position: "absolute", width: 20, height: 20, borderRadius: "50%", background: "white", top: 2, left: 2, transform: ptData[m.fixField] ? "translateX(16px)" : "translateX(0px)", transition: "transform 0.22s cubic-bezier(0.23,1,0.32,1)", boxShadow: "0 2px 4px rgba(0,0,0,0.22)" }} />
                          </div>
                          <span style={{ fontSize: 11, color: ptData[m.fixField] ? "#DC2626" : C.textTer }}>
                            {ptData[m.fixField] ? "Non-negotiable — vendors cannot modify this timeline" : "Negotiable (vendors may propose different terms)"}
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 7. Contract Terms */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Contract Terms <span style={{ fontSize: 12, fontWeight: 400, color: C.textSec }}>(suggested — vendors may propose their own)</span></h3>
            <p style={styles.hint}>Retention % and Performance Bond % are set in Payment Terms above and apply here automatically.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={styles.label}>Warranty (months)</label>
                <input type="number" min="0" value={contractTerms.warranty_months} onChange={e => setContractTerms(p => ({ ...p, warranty_months: e.target.value }))} style={styles.input} disabled={!canEdit} />
              </div>
              <div>
                <label style={styles.label}>Defects Liability (months)</label>
                <input type="number" min="0" value={contractTerms.defects_liability_months} onChange={e => setContractTerms(p => ({ ...p, defects_liability_months: e.target.value }))} style={styles.input} disabled={!canEdit} />
              </div>
              <div>
                <label style={styles.label}>Payment Currency</label>
                <input type="text" value={contractTerms.payment_currency} onChange={e => setContractTerms(p => ({ ...p, payment_currency: e.target.value }))} style={styles.input} disabled={!canEdit} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Liquidated Damages Rate</label>
                <input type="text" value={contractTerms.ld_rate} onChange={e => setContractTerms(p => ({ ...p, ld_rate: e.target.value }))} style={styles.input} disabled={!canEdit} />
              </div>
            </div>
          </div>

          {/* 8. Notes to Vendors */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Notes / Instructions to Vendors</h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} style={{ ...styles.input, resize: "vertical" }} disabled={!canEdit} placeholder="Additional instructions for vendors…" />
          </div>

        </div>
      )}

      {activeTab === "vendors" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Submission Deadline */}
          <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 20, padding: "14px 20px" }}>
            <label style={{ ...styles.label, margin: 0, whiteSpace: "nowrap" }}>
              Submission Deadline <span style={{ color: C.coral }}>*</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="date" value={deadline} onChange={e => saveDeadline(e.target.value)}
                disabled={!canEdit} style={{ ...styles.input, margin: 0, width: 180 }} />
              {!deadline && (
                <span style={{ fontSize: 11, color: C.amberText }}>Required before sending</span>
              )}
            </div>
          </div>

          {/* Action row: Add Vendor (left) + Send to All (right) */}
          {canEdit && (rfq?.status === "Draft" || rfq?.status === "Open") && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => setShowAddVendor(true)} style={styles.btnSecondary}>+ Add Vendor</button>
              {rfqVendors.filter(v => v.is_active).length > 0 && (
                <button onClick={sendRFQ} disabled={saving} style={styles.btnPrimary}>
                  {saving ? "Sending…" : `Send to All (${rfqVendors.filter(v => v.is_active).length})`}
                </button>
              )}
            </div>
          )}

          {rfqVendors.length === 0 && (
            <div style={{ ...styles.card, textAlign: "center", padding: 32, color: C.textTer }}>No vendors added yet.</div>
          )}

          {rfqVendors.map(v => {
            const link = `${window.location.origin}/vendor/rfq/${v.token}`;
            const isSent = sentVendorIds.has(v.id);
            return (
              <div key={v.id} style={{ ...styles.card, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: v.is_active ? C.textPri : C.textTer, display: "flex", alignItems: "center", gap: 6 }}>
                    {v.vendor_name}
                    {v.is_adhoc && <span style={{ fontSize: 10, color: C.amberText, background: C.amberBg, borderRadius: 4, padding: "1px 6px" }}>Ad-hoc</span>}
                    {!isSent && <span style={{ fontSize: 10, color: C.tealText, background: C.tealBg, borderRadius: 4, padding: "1px 6px" }}>Not sent yet</span>}
                  </div>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => sendToVendor(v)} disabled={saving}
                      style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, cursor: "pointer", border: "none",
                        background: isSent ? C.offWhite : C.coralLight, color: isSent ? C.textSec : C.coral,
                        border: isSent ? `1px solid ${C.border}` : `1px solid ${C.coral}50` }}>
                      {isSent ? "Resend" : "Send"}
                    </button>
                    <button onClick={() => toggleVendorActive(v.id, v.is_active)}
                      style={{ fontSize: 11, color: v.is_active ? C.redText : C.greenText, background: v.is_active ? C.redBg : C.greenBg, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontWeight: 600 }}>
                      {v.is_active ? "Deactivate" : "Re-open"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {showAddVendor && (
            <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                        <option key={v.id} value={v.id}>{(() => { const ci = Array.isArray(v.vendor_company_info) ? v.vendor_company_info[0] : v.vendor_company_info; const code = v.vendor_code || venCode(v.id); return ci?.company_name ? `${code}: ${ci.company_name}` : `${code}: No company name`; })()}</option>
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

      {activeTab === "submissions" && (
        <SubmissionsTab rfqId={rfqId} rfq={rfq} rfqVendors={rfqVendors} />
      )}

      {activeTab === "preview" && (
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ ...styles.card, marginBottom: 8, background: C.amberBg, border: `1px solid ${C.amberText}30` }}>
            <p style={{ fontSize: 12, color: C.amberText, margin: 0 }}>Read-only preview of what vendors will see. No data is submitted here.</p>
          </div>

          {/* Header */}
          <div style={{ padding: "20px 0 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.coral, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{rfq?.rfq_number}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPri, marginBottom: 6 }}>Request for Quotation</div>
            <div style={{ fontSize: 13, color: C.textSec }}>{pr?.projects?.name} · {pr?.projects?.project_code}</div>
            {rfq?.deadline && <div style={{ fontSize: 12, color: "#FF3B30", marginTop: 4, fontWeight: 600 }}>Submission deadline: {new Date(rfq.deadline).toLocaleDateString()}</div>}
          </div>

          {/* Description */}
          {vendorDescription && (
            <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13, color: C.textPri, whiteSpace: "pre-wrap" }}>{vendorDescription}</div>
            </div>
          )}

          {/* Justification */}
          {vendorJustification && (
            <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", marginBottom: 6 }}>Justification</div>
              <div style={{ fontSize: 13, color: C.textPri, whiteSpace: "pre-wrap" }}>{vendorJustification}</div>
            </div>
          )}

          {/* Scope of Work */}
          {scopeItems.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", marginBottom: 10 }}>Scope of Work</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textSec, width: 32 }}>#</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textSec }}>Description</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textSec }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {scopeItems.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.textTer }}>{i + 1}</td>
                      <td style={{ padding: "8px 10px", fontSize: 13, color: C.textPri }}>{item.description}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.textSec }}>{item.unit_of_measure || "lot"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Documents */}
          {[pr?.plans_file_url, pr?.tor_file_url, pr?.specs_file_url].some(Boolean) && (
            <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", marginBottom: 10 }}>Supporting Documents</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Plans", url: pr?.plans_file_url, name: pr?.plans_file_name },
                  { label: "Terms of Reference", url: pr?.tor_file_url, name: pr?.tor_file_name },
                  { label: "Specifications", url: pr?.specs_file_url, name: pr?.specs_file_name },
                ].filter(d => d.url).map(doc => (
                  <div key={doc.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: C.offWhite, borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec }}>{doc.label}</div>
                      <div style={{ fontSize: 12, color: C.textPri }}>{doc.name || "View file"}</div>
                    </div>
                    <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.coral, fontWeight: 600, textDecoration: "none" }}>View / Download</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Required Terms */}
          <div style={{ background: C.offWhite, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 14 }}>Required Terms</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 11, color: C.textSec }}>Work Duration</div><div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>{rfq?.work_duration ? `${rfq.work_duration} calendar days` : "—"}</div></div>
              <div><div style={{ fontSize: 11, color: C.textSec }}>Payment Type</div><div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>{rfq?.payment_term_type || "—"}</div></div>
              {[
                ["Warranty", rfq?.contract_terms?.warranty_months ? `${rfq.contract_terms.warranty_months} months` : "—"],
                ["Performance Bond", rfq?.contract_terms?.perf_bond_pct ? `${rfq.contract_terms.perf_bond_pct}%` : "—"],
                ["Defects Liability", rfq?.contract_terms?.defects_liability_months ? `${rfq.contract_terms.defects_liability_months} months` : "—"],
                ["Retention", rfq?.contract_terms?.retention_pct ? `${rfq.contract_terms.retention_pct}%` : "—"],
                ["Payment Currency", rfq?.contract_terms?.payment_currency || "—"],
              ].map(([label, val]) => (
                <div key={label}><div style={{ fontSize: 11, color: C.textSec }}>{label}</div><div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>{val}</div></div>
              ))}
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, color: C.textSec }}>Liquidated Damages</div>
                <div style={{ fontSize: 12, color: C.textPri }}>{rfq?.contract_terms?.ld_rate || "—"}</div>
              </div>
            </div>
          </div>

          {rfq?.notes && (
            <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.coral}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", marginBottom: 6 }}>Instructions to Vendors</div>
              <div style={{ fontSize: 13, color: C.textPri, whiteSpace: "pre-wrap" }}>{rfq.notes}</div>
            </div>
          )}

          {/* Form preview sections */}
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>Your Quoted Amount (PHP) <span style={{ color: C.coral }}>*</span></div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Vendor enters their total price.</div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>Work Duration</div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Vendor accepts the required duration or proposes their own.</div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>Contract Terms</div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Vendor accepts or proposes alternatives for each term above.</div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>Notes / Remarks</div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Optional notes from the vendor.</div>
          </div>
          <div style={{ padding: "14px 0", background: C.coral, borderRadius: 12, textAlign: "center", color: "#fff", fontSize: 15, fontWeight: 700 }}>
            Submit Proposal
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RFA LIST PAGE ────────────────────────────────────────────────────────────
function RFAListPage({ profile, setPage, setSelectedRFAId, setRfaPRId }) {
  const [rfas, setRfas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buFilter, setBuFilter] = useState([]);
  const [projectFilter, setProjectFilter] = useState([]);
  const [activeCard, setActiveCard] = useState(null);

  const rfaCardStatusMap = {
    "Draft":     ["Draft"],
    "Submitted": ["Submitted"],
    "Returned":  ["Returned"],
    "Approved":  ["Approved", "Completed"],
  };

  useEffect(() => { fetchRFAs(); }, []);

  useEffect(() => {
    if (projectFilter.length > 0) {
      const valid = new Set(rfas.filter(r => buFilter.length === 0 || buFilter.includes(r.purchase_requests?.projects?.business_unit)).map(r => r.purchase_requests?.projects?.name).filter(Boolean));
      const still = projectFilter.filter(p => valid.has(p));
      if (still.length !== projectFilter.length) setProjectFilter(still);
    }
  }, [buFilter]);

  const fetchRFAs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("rfas")
      .select(`id, rfa_number, status, awarded_slot, created_at, purchase_requests (id, pr_number, projects (name, business_unit)), creator:profiles!rfas_created_by_fkey (full_name)`)
      .order("created_at", { ascending: false });
    if (data) {
      const prIds = data.map(r => r.purchase_requests?.pr_number).filter(Boolean);
      let prsWithDocs = new Set();
      if (prIds.length) {
        const { data: docRows } = await supabase.from("rfa_documents").select("pr_id").in("pr_id", prIds);
        (docRows || []).forEach(d => prsWithDocs.add(d.pr_id));
      }
      setRfas(data.map(r => ({ ...r, hasDocuments: prsWithDocs.has(r.purchase_requests?.pr_number) })));
    }
    setLoading(false);
  };

  const rfaBuOptions = [...new Set(rfas.map(r => r.purchase_requests?.projects?.business_unit).filter(Boolean))].sort();
  const rfaProjectOptions = [...new Set(
    rfas.filter(r => buFilter.length === 0 || buFilter.includes(r.purchase_requests?.projects?.business_unit)).map(r => r.purchase_requests?.projects?.name).filter(Boolean)
  )].sort();

  const rfaBase = rfas.filter(r =>
    (buFilter.length === 0 || buFilter.includes(r.purchase_requests?.projects?.business_unit)) &&
    (projectFilter.length === 0 || projectFilter.includes(r.purchase_requests?.projects?.name))
  );

  const filtered = rfaBase.filter(r => {
    const s = search.toLowerCase();
    const matchSearch =
      (r.rfa_number || "").toLowerCase().includes(s) ||
      (r.purchase_requests?.pr_number || "").toLowerCase().includes(s) ||
      (r.purchase_requests?.projects?.name || "").toLowerCase().includes(s) ||
      (r.creator?.full_name || "").toLowerCase().includes(s);
    const matchStatus = !activeCard || activeCard === "Total"
      ? true
      : (rfaCardStatusMap[activeCard] || []).includes(r.status);
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div style={styles.topBar}>
        <div style={{ flex: 1 }} />
      </div>
      <div style={styles.pageBody}>
        <div style={{ maxWidth: "80%", margin: "0 auto" }}>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
            {[
              { label: "Total",     value: rfaBase.length,                                                                       color: C.textPri,  desc: "All recommendations for award" },
              { label: "Draft",     value: rfaBase.filter(r => r.status === "Draft").length,                                 color: C.grayText, desc: "In preparation"                 },
              { label: "Submitted", value: rfaBase.filter(r => r.status === "Submitted").length,                             color: C.amberText,desc: "Under review"                    },
              { label: "Returned",  value: rfaBase.filter(r => r.status === "Returned").length,                              color: C.redText,  desc: "Sent back for revision"          },
              { label: "Approved",  value: rfaBase.filter(r => r.status === "Approved" || r.status === "Completed").length,  color: C.greenText,desc: "Award confirmed"                 },
            ].map(s => {
              const isActive = activeCard === s.label;
              return (
                <div key={s.label}
                  onClick={() => setActiveCard(prev => prev === s.label ? null : s.label)}
                  style={{
                    background: isActive ? C.coralLight : C.white,
                    border: `1px solid ${isActive ? C.coral : C.border}`,
                    borderRadius: 12, padding: "14px 18px",
                    boxShadow: isActive ? `0 0 0 2px ${C.coralMid}` : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
                    cursor: "pointer", userSelect: "none",
                    transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
                  }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.coralDark : C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.4 }}>{s.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Search and filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={13} color={C.textTer} /></div>
              <input placeholder="Search RFA, PR, or project…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 30, fontSize: 12 }} />
            </div>
            <MultiSelect options={rfaBuOptions} value={buFilter} onChange={setBuFilter} placeholder="All Business Units" />
            <MultiSelect options={rfaProjectOptions} value={projectFilter} onChange={setProjectFilter} placeholder="All Projects" />
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: "center", color: C.textTer, padding: 48 }}>Loading…</div>
          ) : rfas.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: C.textTer, background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.textSec }}>No Recommendations for Award yet</div>
              <div style={{ fontSize: 12, color: C.textTer, marginTop: 4 }}>RFAs are created from approved Purchase Requests.</div>
            </div>
          ) : (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)", overflow: "clip" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.coralMid }}>
                    {["RFA #","PR #","Project","Status","Recommended Vendor","Created by","Date"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: C.coralDark, textTransform: "uppercase", letterSpacing: "0.06em", padding: "9px 14px", borderBottom: `1px solid ${C.coralLight}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "48px 0", color: C.textTer }}>No RFAs found.</td></tr>}
                  {filtered.map((rfa, i) => (
                    <tr key={rfa.id}
                      onClick={() => { setSelectedRFAId(rfa.id); setRfaPRId(null); setPage("rfa_form"); }}
                      style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, color: C.coral, fontFamily: "monospace" }}>{rfa.rfa_number}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: C.textPri }}>{rfa.purchase_requests?.pr_number || "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: C.textSec }}>{rfa.purchase_requests?.projects?.name || "—"}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                          <span style={styles.badge(rfa.status)}>{rfa.status}</span>
                          {rfa.awarded_slot && (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20,
                              background: rfa.hasDocuments ? C.greenBg : C.amberBg,
                              color: rfa.hasDocuments ? C.greenText : C.amberText }}>
                              {rfa.hasDocuments ? "Docs Issued" : "Docs Pending"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: C.textSec }}>{rfa.awarded_slot ? `Vendor ${rfa.awarded_slot}` : "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: C.textSec }}>{rfa.creator?.full_name || "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: C.textSec }}>{fmt(rfa.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.textTer }}>Showing {filtered.length} of {rfas.length} records</span>
                <button onClick={fetchRFAs} style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }}>Refresh</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── RFA SECTION COMPONENTS (defined outside RFAFormPage for stable references) ─
function SummaryTag({ text, color }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      background: color + "20", color, border: `1px solid ${color}40`, marginRight: 4, whiteSpace: "nowrap" }}>{text}</span>
  );
}
function SummaryEmpty() {
  return <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>Not set</span>;
}
function VCell({ isLast, vi = 0, children }) {
  return (
    <div style={{ padding: "16px 20px", borderRight: !isLast ? "2px solid #E5E7EB" : "none", background: vi % 2 === 1 ? "#F9FAFB" : "white" }}>
      {children}
    </div>
  );
}
function SectionRow({ num, sKey, icon, title, subtitle, summaryFn, children, collapsed, toggleSection, vendors, colGrid }) {
  const isCollapsed = collapsed[sKey];
  return (
    <div style={{ ...styles.card, marginBottom: 0, padding: 0, overflow: "hidden" }}>
      <div onClick={() => toggleSection(sKey)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: isCollapsed ? "none" : `1px solid ${C.border}`, background: "#F9FAFB", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {num != null
            ? <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.coral, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{num}</div>
            : icon ? <span style={{ fontSize: 14 }}>{icon}</span> : null
          }
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.textPri, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
            {subtitle && !isCollapsed && <div style={{ fontSize: 11, color: C.textTer, marginTop: 2, fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>{subtitle}</div>}
          </div>
        </div>
        <span style={{ fontSize: 9, color: C.textTer, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{isCollapsed ? "Expand ▾" : "Collapse ▴"}</span>
      </div>
      {isCollapsed ? (
        <div style={{ display: "grid", gridTemplateColumns: colGrid }}>
          {vendors.map((v, vi) => (
            <div key={v.slot} style={{ padding: "10px 20px", borderRight: vi < vendors.length - 1 ? "2px solid #E5E7EB" : "none", background: vi % 2 === 1 ? "#F9FAFB" : "white" }}>
              {summaryFn(v, vi)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: colGrid, gap: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── RFA FORM PAGE ────────────────────────────────────────────────────────────
function RFAFormPage({ profile, setPage, rfaId: initialRfaId, prId: initialPrId, setSelectedPRId, setSelectedContractId }) {
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [pr, setPr]                 = useState(null);
  const [scopeItems, setScopeItems] = useState([]);
  const [vendorList, setVendorList] = useState([]);
  const [rfaNumber, setRfaNumber]   = useState(null);
  const [rfaId, setRfaId]           = useState(initialRfaId || null);
  const [status, setStatus]         = useState("Draft");
  const [prRfaSequence, setPrRfaSequence] = useState(null);
  const [vendors, setVendors]       = useState([defaultVendorSlot(1)]);
  const [overridingSlots, setOverridingSlots] = useState(new Set());
  const [awardedSlot, setAwardedSlot]   = useState(null);
  const [awardReason, setAwardReason]   = useState("");
  const [alignment, setAlignment] = useState({ scopeWith: "", scopeDate: "", scopeNotes: "", timelineWith: "", timelineDate: "", timelineNotes: "" });
  const [alignDocUrl, setAlignDocUrl]   = useState("");
  const [alignDocName, setAlignDocName] = useState("");
  const [alignUploading, setAlignUploading] = useState(false);
  const [autoGenNotice, setAutoGenNotice] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showPRModal, setShowPRModal]   = useState(false);
  const [showGenModal, setShowGenModal]           = useState(false);
  const [showPreviewModal, setShowPreviewModal]   = useState(false);
  const [previewTab, setPreviewTab]               = useState("page2");
  const [revisionComment, setRevisionComment]     = useState("");
  const [issuedDocs, setIssuedDocs]               = useState([]);
  const [buLogoUrl, setBuLogoUrl]                 = useState(null);
  const [rfaCreatedBy, setRfaCreatedBy]           = useState(null);
  const [rfaReturnComment, setRfaReturnComment]   = useState("");
  const [editLog, setEditLog]                     = useState([]);
  const [returnModal, setReturnModal]             = useState(false);
  const [returnCommentInput, setReturnCommentInput] = useState("");
  const [actionSaving, setActionSaving]           = useState(false);
  const [linkedContract, setLinkedContract]       = useState(null);
  const [previewBodies, setPreviewBodies]         = useState(null);
  const [diffDoc, setDiffDoc]                     = useState(null);
  const page2EditRef = useRef(null);
  const page3EditRef = useRef(null);
  const page4EditRef = useRef(null);
  const [genForm, setGenForm] = useState(() => {
    try { const s = localStorage.getItem("rfaGenForm"); if (s) return { docType: "NOA+NTP", ...JSON.parse(s) }; } catch {}
    return {
      docType: "NOA+NTP",
      noaNumber: "",
      clientCompany: "Plushomes Communities, Inc.",
      projectAddress: "",
      docDate: "",
      salutTitle: "",
      preparedByName: "", preparedByTitle: "Commercial Officer",
      reviewedByName: "", reviewedByTitle: "Commercial Lead",
      endorsedByName: "", endorsedByTitle: "AVP, Design and Construction Head",
      approvedBy1Name: "", approvedBy1Title: "Head of Finance & Accounting",
      approvedBy2Name: "", approvedBy2Title: "President",
    };
  });
  const [procurementStrategy, setProcurementStrategy] = useState("Competitive Bid");
  const [procurementJustification, setProcurementJustification] = useState("");
  const [repeatOrderRef, setRepeatOrderRef] = useState("");
  const [bulkProjects, setBulkProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [activeTab, setActiveTab]       = useState("detail");
  const [collapsed, setCollapsed] = useState({ cost: false, payment: false, rtb: false, bonds: false, timeline: false });
  const toggleSection = key => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  useEffect(() => { fetchData(); }, []);

  // CM opens a Submitted RFA → land on Summary tab for clean review experience
  useEffect(() => {
    if (status === "Submitted" && can(profile, "rfa.approve")) {
      setActiveTab("summary");
    }
  }, [status]);

  // Auto-populate signatory names from system profiles on first load
  useEffect(() => {
    const fetchSignatories = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, position")
        .in("position", ["Commercial Manager", "D&C Head", "Finance Head", "President"]);
      if (!data) return;
      const findFirst = pos => data.find(p => p.position === pos)?.full_name || "";
      setGenForm(prev => ({
        ...prev,
        reviewedByName:  prev.reviewedByName  || findFirst("Commercial Manager"),
        endorsedByName:  prev.endorsedByName  || findFirst("D&C Head"),
        approvedBy1Name: prev.approvedBy1Name || findFirst("Finance Head"),
        approvedBy2Name: prev.approvedBy2Name || findFirst("President"),
      }));
    };
    fetchSignatories();
  }, []);

  // Fetch BU logo with flexible name matching + base64 encode for reliable print embedding
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
    if (!bu?.logo_url) return;
    try {
      const res = await fetch(bu.logo_url);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setBuLogoUrl(dataUrl);
    } catch { setBuLogoUrl(bu.logo_url); }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: vl } = await supabase.from("vendors")
      .select("id, vendor_code, accreditation_status")
      .order("created_at", { ascending: false });
    if (vl && vl.length > 0) {
      const vendorCodes = vl.map(v => vendorRef(v));
      const { data: ciList } = await supabase.from("vendor_company_info")
        .select("vendor_id, company_name, primary_activity, registered_address, contact_person, contact_position, cell_number, rfq_email, telephone, authorized_representative, representative_title")
        .in("vendor_id", vendorCodes);
      const ciMap = {};
      if (ciList) ciList.forEach(ci => { ciMap[ci.vendor_id] = ci; });
      setVendorList(vl.map(v => {
        const ci = ciMap[vendorRef(v)] || {};
        return {
          id:                        v.id,
          full_name:                 ci.company_name || "Unknown Vendor",
          primary_activity:          ci.primary_activity || "",
          address:                   ci.registered_address || "",
          contact_person:            ci.contact_person || "",
          contact_position:          ci.contact_position || "",
          cell_number:               ci.cell_number || "",
          rfq_email:                 ci.rfq_email || "",
          telephone:                 ci.telephone || "",
          authorized_representative: ci.authorized_representative || "",
          representative_title:      ci.representative_title || "",
          status:                    v.accreditation_status || "",
        };
      }));
    }

    const PR_SELECT = `id, pr_number, description, justification, status, is_rush, rush_justification,
      start_date, end_date, created_at, remarks,
      budget_status, budget_code,
      reviewer_budget_status, reviewer_budget_code,
      plans_file_url, plans_file_name, tor_file_url, tor_file_name, specs_file_url, specs_file_name,
      projects (name, business_unit, project_code, address),
      prepared:profiles!purchase_requests_prepared_by_fkey (full_name)`;

    const { data: projList } = await supabase.from("projects").select("id, name, project_code").order("name");
    setAllProjects(projList || []);

    if (initialRfaId) {
      const { data: rfa } = await supabase.from("rfas")
        .select(`*, purchase_requests (${PR_SELECT})`)
        .eq("id", initialRfaId).single();
      if (rfa) {
        setRfaNumber(rfa.rfa_number); setStatus(rfa.status);
        setRfaCreatedBy(rfa.created_by);
        if (rfa.noa_number) setGenForm(prev => ({ ...prev, noaNumber: rfa.noa_number }));
        setAwardedSlot(rfa.awarded_slot); setAwardReason(rfa.award_reason || "");
        if (rfa.alignment_data) {
          const ad = rfa.alignment_data;
          setAlignment({ scopeWith: ad.scopeWith||"", scopeDate: ad.scopeDate||"", scopeNotes: ad.scopeNotes||"", timelineWith: ad.timelineWith||"", timelineDate: ad.timelineDate||"", timelineNotes: ad.timelineNotes||"" });
          setAlignDocUrl(ad.docUrl||""); setAlignDocName(ad.docName||"");
        }
        setProcurementStrategy(rfa.procurement_strategy || "Competitive Bid");
        setProcurementJustification(rfa.procurement_justification || "");
        setRepeatOrderRef(rfa.repeat_order_ref || "");
        setBulkProjects(rfa.bulk_project_ids || []);
        setPr(rfa.purchase_requests);
        const buName = rfa.purchase_requests?.projects?.business_unit;
        if (buName) { await fetchBuLogo(buName); }
        const prId = rfa.purchase_requests?.id;
        let docsArr = [];
        if (prId) {
          const { data: si } = await supabase.from("scope_items").select("*").eq("pr_id", prId).order("sort_order");
          if (si) setScopeItems(si);
          const { data: docs } = await supabase.from("rfa_documents").select("*").eq("pr_id", prId).order("revision_no", { ascending: false });
          docsArr = docs || [];
          setIssuedDocs(docsArr);
          if (docsArr.length > 0) fetchBuLogo(docsArr[0].gen_form_snapshot?.clientCompany);
        }
        let { data: contract } = await supabase.from("contracts").select("id, contract_number, status").eq("rfa_id", initialRfaId).maybeSingle();
        if (!contract && docsArr.length > 0) {
          // Backfill: docs exist but contract was never created (table was missing at time of issuance)
          const year = new Date().getFullYear();
          const { count: caCount } = await supabase.from("contracts").select("id", { count: "exact", head: true });
          const contractNumber = `CA-${year}-${String((caCount || 0) + 1).padStart(4, "0")}`;
          const firstDoc = docsArr[docsArr.length - 1];
          const { data: newContract } = await supabase.from("contracts").insert({
            contract_number: contractNumber,
            rfa_id: initialRfaId,
            pr_id: prId || null,
            status: "Draft",
            created_by: rfa.created_by || null,
          }).select("id, contract_number, status").single();
          contract = newContract;
        }
        if (contract) setLinkedContract(contract);
        const { data: vs } = await supabase.from("rfa_vendors").select("*").eq("rfa_id", initialRfaId).order("slot");
        if (vs?.length) {
          // Auto-merge duplicate slots for the same vendor (caused by re-submissions creating new slots)
          const seenVids = new Map(); // __vendor_id -> index in mergedRows
          const mergedRows = [];
          const extraIds = [];
          const updatedIds = new Set();
          for (const row of vs) {
            const vid = String(row.payment_term_data?.__vendor_id || "");
            if (vid && seenVids.has(vid)) {
              const idx = seenVids.get(vid);
              mergedRows[idx] = {
                ...mergedRows[idx],
                proposals: [...(mergedRows[idx].proposals || []), ...(row.proposals || [])],
              };
              extraIds.push(row.id);
              updatedIds.add(mergedRows[idx].id);
            } else {
              if (vid) seenVids.set(vid, mergedRows.length);
              mergedRows.push({ ...row });
            }
          }
          if (extraIds.length > 0) {
            await Promise.all([
              ...mergedRows
                .filter(r => updatedIds.has(r.id))
                .map(r => supabase.from("rfa_vendors").update({ proposals: r.proposals }).eq("id", r.id)),
              supabase.from("rfa_vendors").delete().in("id", extraIds),
            ]);
            await Promise.all(
              mergedRows.map((r, i) => supabase.from("rfa_vendors").update({ slot: i + 1 }).eq("id", r.id))
            );
            mergedRows.forEach((r, i) => { r.slot = i + 1; });
          }
          // Fetch RFQ submission metadata for each vendor slot (version, VAT status, price validity, attachment)
          if (prId) {
            const vendorIds = mergedRows.map(r => r.payment_term_data?.__vendor_id).filter(Boolean);
            if (vendorIds.length > 0) {
              const { data: rfqRows } = await supabase.from("rfqs").select("id").eq("pr_id", prId);
              const rfqIds = (rfqRows || []).map(r => r.id);
              if (rfqIds.length > 0) {
                const { data: rvRows } = await supabase.from("rfq_vendors")
                  .select("id, vendor_id").in("rfq_id", rfqIds).in("vendor_id", vendorIds);
                if (rvRows?.length) {
                  const rvIdMap = {};
                  rvRows.forEach(rv => { if (!rvIdMap[String(rv.vendor_id)]) rvIdMap[String(rv.vendor_id)] = rv.id; });
                  const { data: subRows } = await supabase.from("rfq_submissions")
                    .select("rfq_vendor_id, version, vat_status, price_validity, attachment_url, attachment_name, submitted_at")
                    .in("rfq_vendor_id", Object.values(rvIdMap))
                    .eq("status", "submitted")
                    .order("version", { ascending: false });
                  const subMap = {};
                  (subRows || []).forEach(s => { if (!subMap[s.rfq_vendor_id]) subMap[s.rfq_vendor_id] = s; });
                  mergedRows.forEach(r => {
                    const rvId = rvIdMap[String(r.payment_term_data?.__vendor_id || "")];
                    r._rfqSub = rvId ? (subMap[rvId] || null) : null;
                  });
                }
              }
            }
          }
          setVendors(mergedRows.map(v => {
            const rawPtd = v.payment_term_data || {};
            const { __vendor_id, ...cleanPtd } = rawPtd;
            const resolvedVendorId = __vendor_id || v.vendor_id || "";
            return {
              slot: v.slot, vendor_id: String(resolvedVendorId),
              participation_status: v.participation_status || "Submitted",
              payment_term_type: v.payment_term_type || "",
              payment_term_data: { ...defaultPtData(), ...cleanPtd },
              commencement_date: v.commencement_date || "", completion_date: v.completion_date || rfa.purchase_requests?.end_date || "",
              price_validity: v.price_validity || v._rfqSub?.price_validity || "", liquidated_damages: v.liquidated_damages || DEFAULT_LD,
              remarks: v.remarks || "", proposals: v.proposals || [],
              rfqSubmission: v._rfqSub || null,
            };
          }));
        }
      }
    } else if (initialPrId) {
      const { data: prData } = await supabase.from("purchase_requests")
        .select(PR_SELECT).eq("id", initialPrId).single();
      if (prData) {
        setPr(prData);
        const buName = prData.projects?.business_unit;
        if (buName) { await fetchBuLogo(buName); }
      }
      const { data: si } = await supabase.from("scope_items").select("*").eq("pr_id", initialPrId).order("sort_order");
      const items = si || [];
      setScopeItems(items);
      const { count } = await supabase.from("rfas").select("id", { count: "exact", head: true }).eq("pr_id", initialPrId);
      setPrRfaSequence((count || 0) + 1);
      setVendors([defaultVendorSlot(1, items)]);
    }
    setLoading(false);
  };

  // ── vendor state helpers ──
  const updateVendor = (slot, field, value) =>
    setVendors(prev => prev.map(v => v.slot === slot ? { ...v, [field]: value } : v));
  const updatePtData = (slot, field, value) =>
    setVendors(prev => prev.map(v => v.slot === slot ? { ...v, payment_term_data: { ...v.payment_term_data, [field]: value } } : v));

  const addVendor = () => {
    setVendors(prev => {
      if (prev.length >= 3) return prev;
      const newSlot = defaultVendorSlot(Math.max(...prev.map(v => v.slot)) + 1, scopeItems);
      if (pr?.end_date) newSlot.completion_date = pr.end_date;
      return [...prev, newSlot];
    });
  };
  const removeVendor = (slot) => {
    setVendors(prev => prev.length <= 1 ? prev : prev.filter(v => v.slot !== slot));
    if (awardedSlot === slot) setAwardedSlot(null);
  };

  const copyItemsTo = (toSlot, fromSlot) => {
    setVendors(prev => {
      const fromV = prev.find(v => v.slot === fromSlot);
      if (!fromV?.proposals.length) return prev;
      const sourceItems = fromV.proposals[0].items.map(i => ({ ...i, id: uid(), unit_price: "" }));
      return prev.map(v => {
        if (v.slot !== toSlot) return v;
        if (!v.proposals.length) return { ...v, proposals: [{ ...defaultProposal(), items: sourceItems }] };
        return { ...v, proposals: v.proposals.map((p, pi) => pi === 0 ? { ...p, items: sourceItems } : p) };
      });
    });
  };

  // ── proposal helpers ──
  const addProposal = slot => setVendors(prev => prev.map(v => v.slot === slot ? { ...v, proposals: [...v.proposals, defaultProposal()] } : v));
  const removeProposal = (slot, pid) => setVendors(prev => prev.map(v => v.slot === slot ? { ...v, proposals: v.proposals.filter(p => p.id !== pid) } : v));
  const updateProposal = (slot, pid, field, value) => setVendors(prev => prev.map(v => v.slot !== slot ? v : { ...v, proposals: v.proposals.map(p => p.id !== pid ? p : { ...p, [field]: value }) }));
  const uploadProposalAttachment = async (slot, pid, file) => {
    if (!file) return;
    const allowed = ["pdf","xlsx","xls","jpg","jpeg","png","docx","doc"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) { alert("Unsupported file type. Allowed: PDF, Excel, Word, JPG, PNG"); return; }
    const currentRfaId = rfaId || "draft";
    const path = `rfa-proposals/${currentRfaId}/${slot}/${pid}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("pr-documents").upload(path, file, { upsert: true });
    if (error) { alert("Upload failed: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("pr-documents").getPublicUrl(path);
    updateProposal(slot, pid, "attachment_url", urlData.publicUrl);
    updateProposal(slot, pid, "attachment_name", file.name);
  };
  const uploadAlignDoc = async (file) => {
    if (!file) return;
    setAlignUploading(true);
    try {
      const path = `alignment/${rfaId||"draft"}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("pr-documents").upload(path, file, { upsert: true });
      if (error) { alert("Upload failed: " + error.message); return; }
      const { data: urlData } = supabase.storage.from("pr-documents").getPublicUrl(path);
      setAlignDocUrl(urlData.publicUrl); setAlignDocName(file.name);
    } finally { setAlignUploading(false); }
  };
  const removeProposalAttachment = (slot, pid) => {
    const v = vendors.find(v => v.slot === slot);
    const p = v?.proposals.find(p => p.id === pid);
    if (p?.attachment_url) {
      const match = p.attachment_url.match(/rfa-proposals\/[^?]+/);
      if (match) supabase.storage.from("pr-documents").remove([match[0]]).catch(() => {});
    }
    updateProposal(slot, pid, "attachment_url", "");
    updateProposal(slot, pid, "attachment_name", "");
  };

  // ── Auto-Recommendation ─────────────────────────────────────────────────────
  const autoRecommend = () => {
    // Guard: if justification already has text, confirm before overwriting
    if (awardReason.trim()) {
      if (!window.confirm("A justification has already been entered. Overwrite it with the auto-generated text?")) return;
    }

    const isNegotiatedOrRepeat = procurementStrategy === "Negotiated" || procurementStrategy === "Repeat Order";

    // Build a candidate list from vendors — skip non-responsive / declined / disqualified / no proposals / zero totals
    const candidates = vendors.map((v, vi) => {
      const vc   = vComputed[vi];
      const stat = v.participation_status;
      const excluded = stat === "Non-Responsive" || stat === "Declined" || stat === "Disqualified";
      const hasProposals = v.proposals.length > 0 && vc.tot > 0;
      return { v, vi, vc, excluded, hasProposals };
    }).filter(c => !c.excluded && c.hasProposals);

    if (candidates.length === 0) {
      alert("No eligible vendors found. Make sure at least one vendor has a submitted proposal with a non-zero total.");
      return;
    }

    // Pick winner
    let winner;
    if (isNegotiatedOrRepeat) {
      // For single-source strategies: pick the first (and likely only) eligible vendor
      winner = candidates[0];
    } else {
      // Competitive Bid: pick lowest total
      winner = candidates.reduce((best, c) => c.vc.tot < best.vc.tot ? c : best, candidates[0]);
    }

    const { v: wV, vi: wVi, vc: wVc } = winner;
    const wVInfo = vendorList.find(vl => String(vl.id) === String(wV.vendor_id));
    const wName  = wVInfo?.full_name || `Vendor ${wVi + 1}`;
    const wTotal = wVc.tot;

    // Build justification text
    const lines = [];

    // 1. Core reason
    if (isNegotiatedOrRepeat) {
      lines.push(`${wName} is the sole qualified vendor for this ${procurementStrategy} procurement, with a total contract amount of ₱${wTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`);
    } else {
      // Competitive: note spread vs. next-lowest
      const otherTots = candidates.filter(c => c.v.slot !== wV.slot).map(c => c.vc.tot);
      const nextLowest = otherTots.length > 0 ? Math.min(...otherTots) : null;
      const spreadPct  = nextLowest && nextLowest > 0 ? ((nextLowest - wTotal) / nextLowest * 100).toFixed(1) : null;
      const spreadNote = spreadPct ? ` (${spreadPct}% below the next lowest bid of ₱${nextLowest.toLocaleString("en-PH", { minimumFractionDigits: 2 })})` : "";
      lines.push(`${wName} submitted the lowest compliant bid at ₱${wTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}${spreadNote}.`);
    }

    // 2. Accreditation status
    const accredStatus = wVInfo?.status;
    if (accredStatus) {
      lines.push(`Vendor is accredited with status: ${accredStatus}.`);
    }

    // 3. Price validity
    if (wV.price_validity) {
      lines.push(`Quoted price is valid until ${new Date(wV.price_validity).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}.`);
    }

    // 4. Timeline compliance
    const tFeas = computeTimelineFeasibility(wV, pr);
    if (tFeas) {
      if (tFeas.ok) {
        lines.push(`Timeline is feasible — ${tFeas.total} days to completion within ${tFeas.avail} days available.`);
      } else {
        const justNote = (wV.payment_term_data?.completion_delay_justification || "").trim();
        const justSnip = justNote ? ` Justification: "${justNote}"` : "";
        lines.push(`Note: Timeline concern — ${tFeas.total} days to completion vs. ${tFeas.avail} days available (short by ${tFeas.shortBy} day${tFeas.shortBy !== 1 ? "s" : ""}).${justSnip}`);
      }
    }

    // Set state
    setAwardedSlot(wV.slot);
    setAwardReason(lines.join("\n"));
    setAutoGenNotice(true);
  };

  // ── Document Generation ──────────────────────────────────────────────────────
  const buildPageBodies = (gf, vComp) => {
    const awarV    = vendors.find(v => v.slot === awardedSlot);
    const awarVi   = awarV ? vendors.indexOf(awarV) : -1;
    const awarVc   = awarVi >= 0 ? vComp[awarVi] : null;
    const awarVInfo = awarV ? vendorList.find(vl => String(vl.id) === String(awarV.vendor_id)) : null;
    const awarPtd  = awarV?.payment_term_data || {};
    const awarPtt  = awarVc?.ptt || "";
    const today = gf.docDate
      ? new Date(gf.docDate + "T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
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
      return ptdV.commencement_days ? `${ct.label} — within ${ptdV.commencement_days} ${ptdV.commencement_days == 1 ? "day" : "days"}` : ct.label;
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
      const isNTP    = docType!=="NOA";
      const docTitle = docType==="NTP"?"NOTICE TO PROCEED":docType==="NOA"?"NOTICE OF AWARD":"NOTICE OF AWARD / NOTICE TO PROCEED";

      // Number to words (Philippine peso format)
      const numToWords = (n) => {
        const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
                      "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
                      "Seventeen","Eighteen","Nineteen"];
        const tns  = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
        const toW  = (x) => {
          if (x===0) return "";
          if (x<20)  return ones[x];
          if (x<100) return tns[Math.floor(x/10)]+(x%10?"-"+ones[x%10]:"");
          if (x<1000) return ones[Math.floor(x/100)]+" Hundred"+(x%100?" "+toW(x%100):"");
          if (x<1000000) return toW(Math.floor(x/1000))+" Thousand"+(x%1000?" "+toW(x%1000):"");
          if (x<1000000000) return toW(Math.floor(x/1000000))+" Million"+(x%1000000?" "+toW(x%1000000):"");
          return toW(Math.floor(x/1000000000))+" Billion"+(x%1000000000?" "+toW(x%1000000000):"");
        };
        const whole = Math.floor(n);
        const cents = Math.round((n - whole) * 100);
        return (toW(whole)||"Zero")+` and ${String(cents).padStart(2,"0")}/100`;
      };

      // Salutation — extract honorific + last name
      const repName  = awarVInfo?.authorized_representative||awarVInfo?.contact_person||"";
      const namePts  = repName.trim().split(/\s+/);
      const fw       = (namePts[0]||"").toLowerCase().replace(/\./g,"");
      const hasHonor = ["mr","mrs","ms","miss","engr","atty","dr","arch"].includes(fw);
      const lastName = namePts[namePts.length-1]||"";
      const salut    = gf.salutTitle && lastName
        ? `${gf.salutTitle} ${lastName}`
        : hasHonor && lastName ? `${namePts[0]} ${lastName}` : (repName||"Sir/Ma'am");

      const tot = awarVc?.tot||0;

      return `
      <div style="margin-bottom:24px">
        <div style="text-align:center;font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${docTitle}</div>
        ${pr?.projects?.name ? `<div style="text-align:center;font-size:9px;color:#777">${pr.projects.name}</div>` : ""}
      </div>
      <div style="margin-bottom:16px;font-size:9.5px">${today}</div>
      ${awarVInfo ? `
      <div style="margin-bottom:20px;line-height:1.8;font-size:9.5px">
        <div style="font-weight:700;text-transform:uppercase">${repName}</div>
        ${awarVInfo.representative_title ? `<div>${awarVInfo.representative_title}</div>` : ""}
        <div style="font-weight:700;text-transform:uppercase">${awarVInfo.full_name || ""}</div>
        ${awarVInfo.address ? `<div>${awarVInfo.address}</div>` : ""}
      </div>` : ""}
      <div style="margin-bottom:14px">Dear ${salut},</div>
      ${isNOA?`
      <div style="text-align:justify;margin-bottom:12px;line-height:1.7">
        We are pleased to inform you, <strong>${awarVInfo?.full_name||"[Contractor]"}</strong> (herein referred to as the &ldquo;Contractor&rdquo;) that the proposal for <strong>${pr?.projects?.name||"[Project]"}</strong>${pr?.description?` (herein referred to as the &ldquo;Project&rdquo;) of ${pr.description}`:""}${pr?.projects?.address?` located in ${pr.projects.address}`:""}, amounting to <strong>${numToWords(tot)} Philippine Pesos Only [Php${fmtN(tot)}]</strong> (herein referred to as the &ldquo;Contract Price&rdquo;) is hereby accepted by <strong>${gf.clientCompany}</strong>.
      </div>
      ${(gf.scopeItems||[]).filter(s=>s.description).length>0?`
      <table class="ntbl" style="margin-bottom:12px">
        <thead><tr><th>No.</th><th>Item</th></tr></thead>
        <tbody>
          ${(gf.scopeItems||[]).filter(s=>s.description).map((si,i)=>`<tr><td>${i+1}</td><td>${si.description}</td></tr>`).join("")}
          ${tot>0?`<tr><td></td><td style="font-weight:700;text-align:right">TOTAL &nbsp; Php ${fmtN(tot)}</td></tr>`:""}
        </tbody>
      </table>`:""}
      <div style="text-align:justify;margin-bottom:12px;line-height:1.7">
        The Contract Price shall be in fixed lump sum amount with all quantities and unit rates guaranteed by you and shall be in compliance to the technical requirements, terms and conditions provided in the documents, drawings/plans, specifications, clarifications, and other pertinent documents issued during the bidding exercise. In addition, it shall be inclusive of twelve percent (12%) value-added tax (VAT), preliminaries, overtime, all other allowances, and of anything to faithfully complete the Work.
      </div>`:`
      <div style="text-align:justify;margin-bottom:12px;line-height:1.7">
        You are hereby directed to commence the Works for <strong>${pr?.projects?.name||"[Project]"}</strong> amounting to <strong>Php ${fmtN(tot)}</strong> in accordance with the agreed terms and conditions.
      </div>
      ${(gf.scopeItems||[]).filter(s=>s.description).length>0?`
      <table class="ntbl" style="margin-bottom:12px">
        <thead><tr><th>No.</th><th>Item</th></tr></thead>
        <tbody>
          ${(gf.scopeItems||[]).filter(s=>s.description).map((si,i)=>`<tr><td>${i+1}</td><td>${si.description}</td></tr>`).join("")}
          ${tot>0?`<tr><td></td><td style="font-weight:700;text-align:right">TOTAL &nbsp; Php ${fmtN(tot)}</td></tr>`:""}
        </tbody>
      </table>`:""}`}
      ${isNTP?`
      <div style="text-align:justify;margin-bottom:6px;line-height:1.7">
        This also serves as Notice to Proceed for Contractor to commence the Works for the project in accordance but not limited to the following:
      </div>
      <ol type="a" style="margin-bottom:14px;padding-left:24px;line-height:1.7;text-align:justify">
        <li style="margin-bottom:6px">All works shall be in conformance to plans, standard technical specification and construction practice, including safety standards necessary to complete the scope of works.</li>
        <li style="margin-bottom:6px">Commence Work with diligence, professionalism, and commitment to quality, as is consistent with our shared values and expectations.</li>
      </ol>`:`
      <div style="text-align:justify;margin-bottom:12px;line-height:1.7">A separate Notice to Proceed will be issued upon fulfillment of pre-commencement requirements.</div>`}
      <div style="text-align:justify;margin-bottom:36px;line-height:1.7">Requisite project obligations can be found in the attached Term Sheet.</div>
      <div style="margin-bottom:36px;line-height:1.7">Very truly yours,</div>
      <table style="width:100%;border-collapse:collapse;margin-top:20px">
        <tr>
          ${sigBlock("Prepared by", gf.preparedByName||"________________________", gf.preparedByTitle||"Commercial Officer", gf.clientCompany)}
          ${sigBlock("Reviewed by", gf.reviewedByName||"________________________", gf.reviewedByTitle, gf.clientCompany)}
          ${sigBlock("Endorsed for Approval By", gf.endorsedByName||"________________________", gf.endorsedByTitle, gf.clientCompany)}
        </tr>
        <tr>
          ${sigBlock("Approved By", gf.approvedBy1Name||"________________________", gf.approvedBy1Title, gf.clientCompany)}
          ${sigBlock("Approved By", gf.approvedBy2Name||"________________________", gf.approvedBy2Title, gf.clientCompany)}
          ${sigBlock("Accepted and Confirmed By", awarVInfo?.authorized_representative||awarVInfo?.contact_person||"________________________", awarVInfo?.representative_title||"General Manager", awarVInfo?.full_name||"")}
        </tr>
      </table>`;
    })();

    // ── Page 3 body ───────────────────────────────────────────────────────────
    const page3 = `
      <h2 class="dt" style="margin-bottom:4px">Contract Agreement</h2>
      ${gf.noaNumber ? `<div style="text-align:center;font-size:9px;color:#555;margin-bottom:14px;letter-spacing:0.03em">Pursuant to Notice of Award No. <strong>${gf.noaNumber}</strong></div>` : `<div style="margin-bottom:14px"></div>`}
      <div style="line-height:1.7;margin-bottom:12px">
        THIS AGREEMENT made the <strong>${today}</strong>, pursuant to Notice of Award No. <strong>${gf.noaNumber||"—"}</strong>, between
        <strong>${gf.clientCompany}</strong> (hereinafter &ldquo;Client&rdquo;), of the one part, and
        <strong>${awarVInfo?.full_name||"[Contractor]"}</strong> (hereinafter &ldquo;Contractor&rdquo;), of the other part:
      </div>
      <div style="line-height:1.7;margin-bottom:12px">
        WHEREAS the Client desires that the Works listed in the table below be executed by the Contractor,
        and has accepted a proposal by the Contractor for the execution and completion of these Works and
        the remedying of any defects therein.
      </div>
      <table class="ntbl" style="margin-bottom:14px">
        <thead><tr><th>#</th><th>Description</th><th style="text-align:right">Amount [Php]</th></tr></thead>
        <tbody>
          ${scopeItems.length>0
            ? scopeItems.map((si,i)=>`<tr><td>${i+1}</td><td>${si.description||"—"}</td><td></td></tr>`).join("")
            : `<tr><td>1</td><td>${pr?.description||"Works as per scope"}</td><td></td></tr>`}
          ${awarVc?.tot>0?`<tr><td colspan="2" style="font-weight:700;text-align:right;padding-right:10px">TOTAL CONTRACT PRICE</td><td style="text-align:right;font-weight:700">${fmtN(awarVc.tot)}</td></tr>`:""}
        </tbody>
      </table>
      <div style="font-weight:700;margin-bottom:6px">The Employer and the Contractor agree as follows:</div>
      <ol>
        <li>In this Agreement, words and expressions shall have the same meanings as are respectively assigned to them in the Term Sheet and other contract documents referred to.</li>
        <li>The following documents shall be deemed to form and be read and construed as part of this Agreement:
          <ol type="a"><li>The Term Sheet,</li><li>Notice of Award${gf.noaNumber ? ` No. ${gf.noaNumber}` : ""},</li><li>Annex A (Contractor&rsquo;s Evaluated Proposal)</li></ol>
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
      <h2 class="dt" style="font-weight:600;font-size:10.5px;margin-bottom:2px">${pr?.projects?.name||"[Project]"}</h2>
      <h2 class="dt" style="font-weight:400;font-size:10px;margin-bottom:2px">${gf.clientCompany} &bull; ${awarVInfo?.full_name||"[Contractor]"}</h2>
      ${gf.noaNumber ? `<div style="text-align:center;font-size:9px;color:#555;margin-bottom:14px;letter-spacing:0.03em">Pursuant to Notice of Award No. <strong>${gf.noaNumber}</strong></div>` : `<div style="margin-bottom:14px"></div>`}
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
            ${pr?.description?`The Works shall consist of <strong>${pr.description}</strong> for <strong>${pr?.projects?.name||"[Project]"}</strong>. `:""}Contractor shall supply labor, materials, and equipment, including supervision of all associated scope, in conformance with the approved plans, technical specifications, clarifications, and other contract documents issued during the bidding exercise.
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
        <thead><tr><th colspan="2" style="text-align:left">6. GENERAL CONDITIONS AND PROVISIONS</th></tr></thead>
      </table>
      <table class="ptbl" style="margin-top:0">
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
        <thead><tr><th colspan="2" style="text-align:left">7. COMPLETION</th></tr></thead>
        <tbody>
          ${tsRow("Issuance of Certificate of Completion and Acceptance (&ldquo;COCA&rdquo;)","Client to issue the COCA to Contractor within 7 days from the completion of the final inspection")}
          ${tsRow(`Defects Liability Period (&ldquo;DLP&rdquo;)`,`${awarPtd.warranty_period||12} month(s) commencing from the date of the issuance of COCA`)}
          ${tsRow("Certificate of Final Acceptance (&ldquo;COFA&rdquo;) and release of Contractor&rsquo;s DLP","Client to issue COFA within 7 days from the expiration of the Defects Liability Period.")}
        </tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:36px">
        <tr>
          ${sigBlock((awarVInfo?.full_name||"[Contractor]")+" &mdash; By", awarVInfo?.authorized_representative||awarVInfo?.contact_person||"________________________", awarVInfo?.representative_title||"General Manager","")}
          ${sigBlock(gf.clientCompany+" &mdash; By", gf.endorsedByName||"________________________", gf.endorsedByTitle,"")}
        </tr>
      </table>`;

    return { page2, page3, page4 };
  };

  const printDocument = (gf, bodies) => {
    localStorage.setItem("rfaGenForm", JSON.stringify(gf));

    const awarV    = vendors.find(v => v.slot === awardedSlot);
    const awarVi   = awarV ? vendors.indexOf(awarV) : -1;
    const awarVc   = awarVi >= 0 ? vComputed[awarVi] : null;
    const awarVInfo = awarV ? vendorList.find(vl => String(vl.id) === String(awarV.vendor_id)) : null;
    const awarPtd  = awarV?.payment_term_data || {};
    const awarPtt  = awarVc?.ptt || "";

    const today = gf.docDate
      ? new Date(gf.docDate + "T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
    const fmtN  = n => Number(n||0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

    // per-vendor column data
    const cols = vendors.map((v, vi) => {
      const vc    = vComputed[vi];
      const vInfo = vendorList.find(vl => String(vl.id) === String(v.vendor_id));
      const ptdV  = v.payment_term_data || {};
      const props = v.proposals || [];
      const firstTot = props[0]               ? computeProposalTotals(props[0]).total : 0;
      const lastTot  = props[props.length - 1] ? computeProposalTotals(props[props.length - 1]).total : 0;
      const isAwd = v.slot === awardedSlot;
      return { v, vc, vInfo, ptdV, firstTot, lastTot, isAwd };
    });
    const nc = cols.length;
    const awd = col => col.isAwd ? ' class="awd"' : '';

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
      return ptdV.commencement_days ? `${ct.label} — within ${ptdV.commencement_days} ${ptdV.commencement_days == 1 ? "day" : "days"}` : ct.label;
    };

    const durText = v => {
      const ptdV = v.payment_term_data || {};
      if (ptdV.completion_mode === "work_duration" && ptdV.work_duration)
        return `${ptdV.work_duration} ${ptdV.work_duration_type === "working_days" ? "working days" : "calendar days"}`;
      if (v.completion_date) return fmtShort(v.completion_date);
      return "—";
    };

    const hasBafo = cols.some(c => c.v.proposals.length > 1 && c.v.participation_status !== "Non-Responsive" && c.v.participation_status !== "Declined" && c.v.participation_status !== "Disqualified");
    const invitedCount  = cols.filter(c => c.v.vendor_id).length;
    const submittedCols = cols.filter(c => !c.v.participation_status || c.v.participation_status === "Submitted");
    const isCompetitiveShortfall = gf.procurementStrategy === "Competitive Bid" && invitedCount < 2;
    const nonSubmittedLabel = c => c.v.participation_status && c.v.participation_status !== "Submitted" ? c.v.participation_status : null;

    // recommendation — auto-generate main numbered sentence + sub-items from textarea lines
    const reasonHtml = (() => {
      const mainSentence = `To award to <strong>${awarVInfo?.full_name || "[Vendor]"}</strong> amounting to <strong>Php ${awarVc?.tot > 0 ? fmtN(awarVc.tot) : "—"}</strong> VAT Inclusive.`;
      const lines = awardReason.trim().split("\n").filter(l => l.trim());
      const hasSubs = lines.length > 0;
      const subItems = hasSubs
        ? `<div style="margin-left:12px;margin-top:3px">This recommendation was also due to the following:</div>` +
          lines.map((l, i) => `<div style="margin-left:26px">${String.fromCharCode(97+i)}. ${l.trim()}</div>`).join("")
        : "";
      return `<div style="margin-bottom:4px">1. ${mainSentence}</div>${subItems}`;
    })();

    const sigBlock = (role, name, title, company) =>
      `<td style="text-align:center;padding:5px 10px;vertical-align:top">
        <div style="font-size:8.5px;color:#555;margin-bottom:2px">${role}:</div>
        <div style="border-top:1px solid #333;margin:34px 10px 4px"></div>
        <div style="font-weight:700;font-size:9.5px">${name || "________________________"}</div>
        <div style="font-size:8.5px;color:#444">${title || ""}</div>
        ${company ? `<div style="font-size:8.5px;color:#444">${company}</div>` : ""}
      </td>`;

    // ── CSS ─────────────────────────────────────────────────────────────────
    const css = `
      *{box-sizing:border-box;font-family:Arial,sans-serif}
      html{background:#7a7a7a;margin:0;padding:0}
      body{margin:0;padding:28px 0;background:#7a7a7a;min-height:100vh}
      .pg{width:210mm;min-height:297mm;padding:16mm 14mm;background:#fff;margin:0 auto 28px;
          box-shadow:0 4px 24px rgba(0,0,0,0.35);font-size:9.5px;color:#111;
          position:relative;overflow:hidden}
      h1.dt{font-size:11px;font-weight:700;text-transform:uppercase;text-align:center;margin:0 0 7px;letter-spacing:.04em}
      h2.dt{font-size:10.5px;font-weight:700;text-transform:uppercase;text-align:center;margin:0 0 4px}
      .htbl{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.5px}
      .htbl td{padding:2px 4px;vertical-align:top}
      .htbl .lb{font-weight:700;white-space:nowrap;width:100px}
      .vt{width:100%;border-collapse:collapse;font-size:9.5px;margin:8px 0}
      .vt th,.vt td{border:1px solid #ccc;padding:3px 5px;vertical-align:top}
      .vt thead th{background:${C.coralLight};font-weight:700;text-align:center;font-size:9.5px}
      .rl{background:#f6f6f6;font-weight:600;width:140px}
      .awd{background:#FEF3C7;font-weight:700}
      .vt thead th.awd{background:#FDE68A;color:#78350F}
      .sh td{background:${C.coralLight};color:${C.coral};font-weight:700;text-align:center;font-size:8px;text-transform:uppercase;letter-spacing:.04em}
      .rec{margin:10px 0}
      .sec-hdr{font-weight:700;font-size:9.5px;text-transform:uppercase;border-bottom:1.5px solid ${C.coral};padding-bottom:3px;margin:11px 0 7px}
      .apptbl{width:100%;border-collapse:collapse;margin-top:14px}
      .attbl{border-collapse:collapse;font-size:9.5px}
      .attbl td,.attbl th{border:1px solid #ccc;padding:3px 7px}
      .ntbl{border-collapse:collapse;width:100%;margin:8px 0}
      .pg-num{position:absolute;bottom:12px;right:14px;font-size:8px;color:#888}
      .ntbl th,.ntbl td{border:1px solid #888;padding:4px 8px;font-size:9px}
      .ptbl{width:100%;border-collapse:collapse;font-size:9px;margin:5px 0}
      .ptbl th,.ptbl td{border:1px solid #ccc;padding:3px 6px;vertical-align:top}
      .ptbl th{background:${C.coralLight};font-weight:700}
      ol{margin:5px 0;padding-left:20px;line-height:1.65}
      .tri-footer{position:absolute;bottom:0;left:0;right:0;height:60px;display:flex;align-items:center;justify-content:center}
      .tri-footer img{width:100%;height:auto;display:block}
      @media print{
        html,body{background:none;margin:0;padding:0}
        .pg{margin:0;box-shadow:none;padding:15mm 13mm;width:100%;min-height:auto}
        .pb{page-break-before:always;break-before:page}
        @page{size:A4 portrait;margin:0}
      }`;

    // ── Letterhead (pages 2-4) ───────────────────────────────────────────────
    const letterhead = () =>
      `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid ${C.coral}">
        <div style="display:flex;align-items:center;gap:10px">
          ${buLogoUrl
            ? `<img src="${buLogoUrl}" style="height:42px;width:auto;object-fit:contain;max-width:120px" />`
            : `<div style="width:88px;height:38px;border:1.5px dashed #bbb;display:flex;align-items:center;justify-content:center;font-size:7px;color:#bbb;letter-spacing:.07em;text-transform:uppercase">Logo</div>`
          }
          <div style="font-weight:700;color:#111;font-size:9px">${gf.clientCompany}</div>
        </div>
        <div style="text-align:right;font-size:8.5px;color:#555;line-height:1.6">
          ${gf.noaNumber ? `<div style="font-size:8px">${gf.noaNumber}</div>` : ""}
          ${rfaNumber ? `<div style="font-size:8px">Reference: ${rfaNumber}</div>` : ""}
        </div>
      </div>`;

    // ── PAGE 1: Recommendation for Award ────────────────────────────────────
    const page1 = `
    <div class="pg">
      ${isCompetitiveShortfall ? `<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:8px 14px;margin-bottom:14px;font-size:10px;color:#92400E;font-weight:700">⚠ DRAFT — Non-Compliant: Competitive Bid requires minimum 2 vendors invited (${invitedCount} invited). This document is for review purposes only and cannot be used for official award.</div>` : ""}
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
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.5px">
        <colgroup><col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup>
        <tr><td colspan="4" style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#9CA3AF;padding:2px 3px 3px">Project</td></tr>
        <tr>
          <td style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">Project Name</span><br>${pr?.projects?.name || "—"}</td>
          <td style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">Business Unit</span><br>${gf.projectAddress || pr?.projects?.business_unit || "—"}</td>
          <td style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">Project Code</span><br><span style="font-family:monospace">${pr?.projects?.project_code || "—"}</span></td>
          <td></td>
        </tr>
        <tr><td colspan="4" style="padding:5px 3px 3px"><hr style="border:none;border-top:1px solid #E5E7EB;margin:0"></td></tr>
        <tr><td colspan="4" style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#9CA3AF;padding:0 3px 3px">Purchase Request</td></tr>
        <tr>
          <td colspan="2" style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">Work Description</span><br>${pr?.description || "—"}</td>
          <td colspan="2" style="padding:1px 3px;vertical-align:top">${pr?.justification ? `<span style="font-weight:700;color:#555">Justification</span><br>${pr.justification}` : ""}</td>
        </tr>
        <tr>
          <td style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">Start Date</span><br>${pr?.start_date ? fmtShort(pr.start_date) : "—"}</td>
          <td style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">End Date</span><br>${pr?.end_date ? fmtShort(pr.end_date) : "—"}</td>
          ${(pr?.budget_status || pr?.reviewer_budget_status) ? `<td style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">Budget Status</span><br>${pr?.budget_status || pr?.reviewer_budget_status}</td>` : "<td></td>"}
          ${(pr?.budget_code || pr?.reviewer_budget_code) ? `<td style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">Budget Code</span><br><span style="font-family:monospace;font-weight:700">${pr?.budget_code || pr?.reviewer_budget_code}</span></td>` : "<td></td>"}
        </tr>
        ${pr?.pr_number ? `<tr>
          <td style="padding:1px 3px;vertical-align:top"><span style="font-weight:700;color:#555">PR No.</span><br><span style="font-family:monospace">${pr.pr_number}</span></td>
          <td colspan="3"></td>
        </tr>` : ""}
      </table>

      <table class="vt">
        <thead><tr><th colspan="2" style="text-align:left">REQUEST DETAILS</th></tr></thead>
        <tbody>
          <tr><td class="rl">Procurement Strategy</td><td>${gf.procurementStrategy || "—"}</td></tr>
          ${awarVInfo ? `<tr><td class="rl">Recommended Vendor</td><td><strong>${awarVInfo.full_name || "—"}</strong></td></tr>` : ""}
          ${gf.procurementStrategy !== "Competitive Bid" || gf.procurementJustification ? `<tr><td class="rl">Justification</td><td>${gf.procurementJustification || "—"}</td></tr>` : ""}
          ${gf.procurementStrategy === "Repeat Order" && gf.repeatOrderRef ? `<tr><td class="rl">Previous PO / Contract Ref.</td><td>${gf.repeatOrderRef}</td></tr>` : ""}
          ${gf.procurementStrategy === "Bulk Order" && gf.bulkProjects?.length > 0 ? `<tr><td class="rl">Also Covers Projects</td><td>${(gf.allProjects||[]).filter(p=>gf.bulkProjects.includes(p.id)).map(p=>p.name+(p.project_code?` (${p.project_code})`:"")).join(", ")}</td></tr>` : ""}
        </tbody>
      </table>

      <table class="vt">
        <thead>
          <tr>
            <th>VENDOR DETAILS</th>
            ${cols.map((c,i)=>`<th${awd(c)}>Vendor ${i+1}${c.isAwd?" &#9733;":""}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr><td class="rl">Vendor Name</td>${cols.map(c=>`<td${awd(c)}>${c.vInfo?.full_name||"—"}</td>`).join("")}</tr>
          <tr><td class="rl">Contact Person</td>${cols.map(c=>`<td${awd(c)}>${c.vInfo?.contact_person||"—"}</td>`).join("")}</tr>
          <tr><td class="rl">Authorized Representative</td>${cols.map(c=>`<td${awd(c)}>${c.vInfo?.authorized_representative?`${c.vInfo.authorized_representative}${c.vInfo.representative_title?` &bull; ${c.vInfo.representative_title}`:""}`:c.vInfo?.contact_person||"—"}</td>`).join("")}</tr>
          <tr><td class="rl">Contact No. / Email</td>${cols.map(c=>`<td${awd(c)}>${[c.vInfo?.cell_number,c.vInfo?.rfq_email].filter(Boolean).join(" / ")||"—"}</td>`).join("")}</tr>
          <tr><td class="rl">Accreditation Status</td>${cols.map(c=>`<td${awd(c)}>${c.vInfo?.status||"—"}</td>`).join("")}</tr>
          <tr class="sh"><td colspan="${nc+1}">PROPOSAL</td></tr>
          <tr><td class="rl">Initial Proposal Amount</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="text-align:center;color:#888;font-style:italic">${nonSubmittedLabel(c)}</td>`:`<td${awd(c)} style="text-align:right">${c.firstTot>0?fmtN(c.firstTot):"—"}</td>`).join("")}</tr>
          ${(()=>{const submitted=cols.filter(c=>!nonSubmittedLabel(c)&&c.firstTot>0);if(submitted.length<2)return"";const lowestTot=Math.min(...submitted.map(c=>c.firstTot));return`<tr><td class="rl">Variance vs. Lowest</td>${cols.map(c=>{if(nonSubmittedLabel(c)||c.firstTot<=0)return`<td${awd(c)} style="color:#888">—</td>`;if(c.firstTot===lowestTot)return`<td${awd(c)} style="color:#059669;font-weight:700">— (lowest)</td>`;const pct=((c.firstTot-lowestTot)/lowestTot*100).toFixed(1);return`<td${awd(c)} style="color:#DC2626">+${pct}%</td>`;}).join("")}</tr>`;})()}
          <tr><td class="rl">VAT Inclusive</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="color:#888;font-style:italic">—</td>`:`<td${awd(c)}>Confirmed</td>`).join("")}</tr>
          <tr><td class="rl">Down Payment</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="color:#888;font-style:italic">—</td>`:`<td${awd(c)}>${PT_HAS_DP.has(c.v.payment_term_type)?`${c.ptdV.dp_percent||20}% of the Contract Amount${c.ptdV.dp_recoupable===false?" — <strong>Non-recoupable</strong>":" — Recoupable at "+( c.ptdV.dp_percent||20)+"% per progress billing"}`:"—"}</td>`).join("")}</tr>
          <tr><td class="rl">Payment Terms</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="color:#888;font-style:italic">—</td>`:`<td${awd(c)}>${payText(c.v,c.vc)}</td>`).join("")}</tr>
          <tr><td class="rl">Retention</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="color:#888;font-style:italic">—</td>`:`<td${awd(c)}>${PT_HAS_RETENTION.has(c.v.payment_term_type)?`${c.ptdV.retention_percent||10}% of the contract amount`:"—"}</td>`).join("")}</tr>
          <tr><td class="rl">Release of Payment</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="color:#888;font-style:italic">—</td>`:`<td${awd(c)}>${c.ptdV.completion_release_days||30} calendar days upon submission of complete billing requirements</td>`).join("")}</tr>
          <tr class="sh"><td colspan="${nc+1}">BONDS</td></tr>
          <tr><td class="rl">Surety Bond</td>${cols.map(c=>{if(nonSubmittedLabel(c))return`<td${awd(c)} style="color:#888;font-style:italic">—</td>`;const a=c.ptdV.surety_bond_override?parseFloat(c.ptdV.surety_bond_override_amount||0):c.vc.autoAmts.surety;return`<td${awd(c)}>${PT_HAS_DP.has(c.v.payment_term_type)&&a>0?`${c.ptdV.dp_percent||20}% of Contract Amount (${fmtN(a)})`:"n/a"}</td>`;}).join("")}</tr>
          <tr><td class="rl">Performance Bond</td>${cols.map(c=>{if(nonSubmittedLabel(c))return`<td${awd(c)} style="color:#888;font-style:italic">—</td>`;const a=c.ptdV.performance_bond_override?parseFloat(c.ptdV.performance_bond_override_amount||0):c.vc.autoAmts.performance;const pct=c.ptdV.performance_bond_percent||30;return`<td${awd(c)}>${PT_HAS_PROGRESS.has(c.v.payment_term_type)&&a>0?`${pct}% of Contract Amount (${fmtN(a)})`:"NOT APPLICABLE"}</td>`;}).join("")}</tr>
          <tr><td class="rl">Retention Bond</td>${cols.map(c=>{if(nonSubmittedLabel(c))return`<td${awd(c)} style="color:#888;font-style:italic">—</td>`;const a=c.ptdV.warranty_bond_override?parseFloat(c.ptdV.warranty_bond_override_amount||0):c.vc.autoAmts.warranty;return`<td${awd(c)}>${PT_HAS_RETENTION.has(c.v.payment_term_type)&&a>0?`${c.ptdV.retention_percent||10}% of Contract Amount (${fmtN(a)})`:"NOT APPLICABLE"}</td>`;}).join("")}</tr>
          <tr class="sh"><td colspan="${nc+1}">TIMELINE</td></tr>
          <tr><td class="rl">Commencement Date</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="color:#888;font-style:italic">—</td>`:`<td${awd(c)}>${commText(c.v)}</td>`).join("")}</tr>
          <tr><td class="rl">Warranty / DLP</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="color:#888;font-style:italic">—</td>`:`<td${awd(c)}>${c.ptdV.warranty_period?`${c.ptdV.warranty_period} months from date of COCA`:"—"}</td>`).join("")}</tr>
          <tr><td class="rl">Work Duration</td>${cols.map(c=>nonSubmittedLabel(c)?`<td${awd(c)} style="color:#888;font-style:italic">—</td>`:`<td${awd(c)}>${durText(c.v)}</td>`).join("")}</tr>
          <tr style="border-top:2px solid #F59E0B">
            <td style="background:#f6f6f6;font-weight:700;font-size:9px;color:#92400E;padding:6px 5px;text-transform:uppercase;letter-spacing:.04em">Best and Final Offer</td>
            ${(()=>{
              const subFinals = cols.filter(c=>!nonSubmittedLabel(c)&&c.lastTot>0).map(c=>c.lastTot);
              const lowestFinal = subFinals.length>0 ? Math.min(...subFinals) : 0;
              return cols.map(c=>{
                const notSub = nonSubmittedLabel(c);
                const tot = c.lastTot;
                const aw = c.isAwd;
                if (notSub) return `<td style="color:#888;font-style:italic;text-align:center;font-size:8.5px;border-left:1px solid #ccc">${notSub}</td>`;
                const isLowest = tot>0 && tot===lowestFinal && subFinals.length>1;
                const pct = lowestFinal>0 && tot>0 && tot!==lowestFinal ? ((tot-lowestFinal)/lowestFinal*100).toFixed(1) : null;
                return `<td style="background:${aw?"#FDE68A":"white"};text-align:right;padding:6px 5px;border-left:1px solid #ccc">
                  ${tot>0
                    ?`<div style="font-size:11px;font-weight:700;font-family:monospace;color:${aw?"#78350F":"#111"}">Php ${fmtN(tot)}</div>
                      <div style="font-size:7.5px;color:#9CA3AF;margin-top:1px">VAT Inclusive</div>
                      ${subFinals.length>1?(isLowest
                        ?`<div style="font-size:8px;font-weight:700;color:#059669;margin-top:2px">&#8212; (lowest)</div>`
                        :pct?`<div style="font-size:8px;font-weight:700;color:#DC2626;margin-top:2px">+${pct}% vs. lowest</div>`:""
                      ):""}`
                    :`<span style="color:#9CA3AF">&#8212;</span>`
                  }
                </td>`;
              }).join("");
            })()}
          </tr>
        </tbody>
      </table>

      <div class="rec">
        <div class="sec-hdr">RECOMMENDATION</div>
        ${awarVInfo&&awarVc?reasonHtml:`<div style="color:#999;font-style:italic">No vendor recommended yet.</div>`}
      </div>

      <div class="sec-hdr">APPROVALS</div>
      <table class="apptbl">
        <tr>
          ${sigBlock("Prepared by",   profile?.full_name,   profile?.position || "Commercial Officer", "")}
          ${sigBlock("Reviewed by",   gf.reviewedByName,   gf.reviewedByTitle, "")}
          ${sigBlock("Endorsed for Approval by", gf.endorsedByName, gf.endorsedByTitle, gf.clientCompany)}
          ${sigBlock("Approved by",   gf.approvedBy1Name,  gf.approvedBy1Title, gf.clientCompany)}
        </tr>
        ${gf.approvedBy2Name?`<tr>${sigBlock("Approved by", gf.approvedBy2Name, gf.approvedBy2Title, gf.clientCompany)}<td colspan="3"></td></tr>`:""}
      </table>

      <div style="margin-top:14px">
        <div style="font-weight:700;margin-bottom:4px">Reference Documents:</div>
        ${(()=>{
          const prDocs = [
            pr?.plans_file_url                  ? { label:"Plans / Drawings",          url:pr.plans_file_url,                  name:pr.plans_file_name||"Plans" }           : null,
            pr?.tor_file_url                    ? { label:"Terms of Reference (TOR)",  url:pr.tor_file_url,                    name:pr.tor_file_name||"TOR" }               : null,
            pr?.specs_file_url                  ? { label:"Specifications",            url:pr.specs_file_url,                  name:pr.specs_file_name||"Specifications" }  : null,
            pr?.projected_cost_reference_url    ? { label:"Projected Cost Reference",  url:pr.projected_cost_reference_url,    name:pr.projected_cost_reference_name||"Reference" } : null,
          ].filter(Boolean);
          const propDocs = cols.filter(c=>c.v.proposals.length>0).map(c=>{
            const last = c.v.proposals[c.v.proposals.length-1];
            return { label:`Vendor&rsquo;s Evaluated Proposal &mdash; ${c.vInfo?.full_name||"Vendor"}`, url:last.attachment_url||null, name:last.attachment_name||null };
          });
          const all = [...prDocs, ...propDocs];
          if(!all.length) return `<div style="font-size:9px;color:#888;font-style:italic">No reference documents.</div>`;
          return `<table class="attbl">
            <tr><th style="width:28px">#</th><th>Document</th><th>File</th></tr>
            ${all.map((d,i)=>`<tr>
              <td style="text-align:center">${i+1}</td>
              <td>${d.label}</td>
              <td>${d.url ? `<a href="${d.url}" target="_blank" style="color:#E05C4B;text-decoration:none;font-weight:600">${d.name}</a>` : `<span style="color:#aaa">—</span>`}</td>
            </tr>`).join("")}
          </table>`;
        })()}
      </div>
      <div class="pg-num">Page 1 of 4</div>
    </div>`;

    // ── PAGES 2–4: use pre-built bodies ─────────────────────────────────────
    const page2 = `<div class="pg pb">${letterhead()}${bodies.page2}<div class="pg-num">Page 2 of 4</div><div class="tri-footer"><img src="PH1%20Footer.png" alt="" /></div></div>`;
    const page3 = `<div class="pg pb">${letterhead()}${bodies.page3}<div class="pg-num">Page 3 of 4</div><div class="tri-footer"><img src="PH1%20Footer.png" alt="" /></div></div>`;
    const page4 = `<div class="pg pb">${letterhead()}${bodies.page4}<div class="pg-num">Page 4 of 4</div><div class="tri-footer"><img src="PH1%20Footer.png" alt="" /></div></div>`;

    const win = window.open("", "_blank", "width=900,height=1060,scrollbars=yes,resizable=yes");
    if (!win) { alert("Pop-up blocked — please allow pop-ups for this site and try again."); return; }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <base href="${window.location.origin}/">
  <title>Procurement Package — ${rfaNumber||"RFA"}</title>
  <style>${css}</style>
</head>
<body>
  ${page1}${page2}${page3}${page4}
</body>
</html>`);
    win.document.close();
    win.focus();
  };
  const issueDocument = async () => {
    if (status !== "Approved") {
      alert("Documents can only be issued for approved RFAs. The RFA must be approved by the Commercial Manager first.");
      return;
    }
    const nextRevNo = (issuedDocs[0]?.revision_no || 0) + 1;

    // Auto-assign NOA control number on first issuance
    let resolvedNoaNumber = genForm.noaNumber || "";
    if (!resolvedNoaNumber && rfaId) {
      const year = new Date().getFullYear();
      const { count } = await supabase.from("rfas").select("id", { count: "exact", head: true }).not("noa_number", "is", null);
      resolvedNoaNumber = `NOA-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
      await supabase.from("rfas").update({ noa_number: resolvedNoaNumber }).eq("id", rfaId);
      setGenForm(prev => ({ ...prev, noaNumber: resolvedNoaNumber }));
    }

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
      gen_form_snapshot: { ...genForm, noaNumber: resolvedNoaNumber, __terms_version: "Standard v1.0" },
      issued_at: new Date().toISOString(),
    });
    if (error) { alert("Failed to save: " + error.message); return; }

    // Auto-create contract record on first issuance
    if (nextRevNo === 1 && rfaId && !linkedContract) {
      const year = new Date().getFullYear();
      const { count: caCount } = await supabase.from("contracts").select("id", { count: "exact", head: true });
      const contractNumber = `CA-${year}-${String((caCount || 0) + 1).padStart(4, "0")}`;
      const { data: newContract } = await supabase.from("contracts").insert({
        contract_number: contractNumber,
        rfa_id: rfaId,
        pr_id: pr?.id || null,
        status: "Draft",
        created_by: profile?.id || null,
      }).select("id, contract_number, status").single();
      if (newContract) setLinkedContract(newContract);
    }

    const { data: docs } = await supabase.from("rfa_documents").select("*").eq("pr_id", pr?.id).order("revision_no", { ascending: false });
    setIssuedDocs(docs || []);
    setRevisionComment("");
    setShowPreviewModal(false);
    setShowGenModal(false);
    printDocument({ ...genForm, noaNumber: resolvedNoaNumber }, bodies);
  };

  const printIssuedDoc = (record) => {
    const snapshot = record.gen_form_snapshot || {};
    printDocument(snapshot, {
      page2: record.page2_html || "",
      page3: record.page3_html || "",
      page4: record.page4_html || "",
    });
  };

  const addItem = (slot, pid) => setVendors(prev => prev.map(v => v.slot !== slot ? v : { ...v, proposals: v.proposals.map(p => p.id !== pid ? p : { ...p, items: [...p.items, { id: uid(), description: "", qty: "1", unit: "", unit_price: "" }] }) }));
  const removeItem = (slot, pid, iid) => setVendors(prev => prev.map(v => v.slot !== slot ? v : { ...v, proposals: v.proposals.map(p => p.id !== pid ? p : { ...p, items: p.items.filter(i => i.id !== iid) }) }));
  const updateItem = (slot, pid, iid, field, value) => setVendors(prev => prev.map(v => v.slot !== slot ? v : { ...v, proposals: v.proposals.map(p => p.id !== pid ? p : { ...p, items: p.items.map(i => i.id !== iid ? i : { ...i, [field]: value }) }) }));
  const addTax = (slot, pid) => setVendors(prev => prev.map(v => v.slot !== slot ? v : { ...v, proposals: v.proposals.map(p => p.id !== pid ? p : { ...p, taxes: [...p.taxes, { id: uid(), name: "", rate: "" }] }) }));
  const removeTax = (slot, pid, tid) => setVendors(prev => prev.map(v => v.slot !== slot ? v : { ...v, proposals: v.proposals.map(p => p.id !== pid ? p : { ...p, taxes: p.taxes.filter(t => t.id !== tid) }) }));
  const updateTax = (slot, pid, tid, field, value) => setVendors(prev => prev.map(v => v.slot !== slot ? v : { ...v, proposals: v.proposals.map(p => p.id !== pid ? p : { ...p, taxes: p.taxes.map(t => t.id !== tid ? t : { ...t, [field]: value }) }) }));

  // ── milestone helpers ──
  const addMilestone = (slot) => updatePtData(slot, "milestones", [...(vendors.find(v=>v.slot===slot)?.payment_term_data?.milestones||[]), { id:uid(), label:"", percent:"" }]);
  const removeMilestone = (slot, mid) => updatePtData(slot, "milestones", (vendors.find(v=>v.slot===slot)?.payment_term_data?.milestones||[]).filter(m=>m.id!==mid));
  const updateMilestone = (slot, mid, field, value) => updatePtData(slot, "milestones", (vendors.find(v=>v.slot===slot)?.payment_term_data?.milestones||[]).map(m=>m.id===mid?{...m,[field]:value}:m));

  // ── date compliance check ──
  const completionWarning = (v) => {
    if (!v.completion_date || !pr?.end_date) return null;
    if (v.completion_date > pr.end_date) return { level: "red", msg: `Exceeds PR end date (${fmtShort(pr.end_date)})` };
    return null;
  };

  const saveRFA = async () => {
    // ── Strategy validation ──
    const invitedCount = vendors.filter(v => v.vendor_id).length;
    if (procurementStrategy === "Competitive Bid" && invitedCount < 2) {
      alert("Competitive Bid requires at least 2 vendors to be invited.\nPlease add another vendor or change the procurement strategy.");
      return;
    }
    if ((procurementStrategy === "Negotiated" || procurementStrategy === "Repeat Order") && !procurementJustification.trim()) {
      alert(`${procurementStrategy} requires a justification.\nPlease fill in the Justification field in the Procurement Strategy section.`);
      return;
    }
    if (procurementStrategy === "Repeat Order" && !repeatOrderRef.trim()) {
      alert("Repeat Order requires a reference to the previous PO or Contract.\nPlease fill in the Reference field in the Procurement Strategy section.");
      return;
    }

    // ── Milestone % validation ──
    for (const v of vendors) {
      if (v.payment_term_type === "milestone" && v.participation_status !== "Did Not Submit") {
        const ms = (v.payment_term_data?.milestones || []);
        if (ms.length === 0) { alert(`Vendor ${v.slot}: Please add at least one milestone.`); return; }
        const total = ms.reduce((s, m) => s + parseFloat(m.percent || 0), 0);
        if (Math.abs(total - 100) > 0.01) {
          alert(`Vendor ${v.slot}: Milestone percentages must total 100% (currently ${total.toFixed(1)}%).`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const prId = pr?.id || initialPrId;
      if (!prId) { alert("Could not determine the linked PR."); return; }
      // Keep current status — only action functions (submitRFA, approveRFA, returnRFA, withdrawRFA) change status
      const newStatus = status === "Draft" || !rfaId ? "Draft" : status;
      const strategyFields = {
        procurement_strategy: procurementStrategy,
        procurement_justification: procurementJustification || null,
        repeat_order_ref: repeatOrderRef || null,
        bulk_project_ids: bulkProjects || [],
      };
      let currentRfaId = rfaId;
      if (!currentRfaId) {
        const { data: newRfa, error } = await supabase.from("rfas").insert({
          pr_id: prId, status: "Draft", awarded_slot: awardedSlot||null, award_reason: awardReason||null, created_by: profile.id,
          alignment_data: { ...alignment, docUrl: alignDocUrl, docName: alignDocName },
          ...strategyFields,
        }).select().single();
        if (error) { alert("Error creating RFA: " + error.message); return; }
        currentRfaId = newRfa.id; setRfaId(currentRfaId); setRfaNumber(newRfa.rfa_number);
        setRfaCreatedBy(profile.id);
      } else {
        const { error } = await supabase.from("rfas").update({ status: newStatus, awarded_slot: awardedSlot||null, award_reason: awardReason||null, alignment_data: { ...alignment, docUrl: alignDocUrl, docName: alignDocName }, updated_at: new Date().toISOString(), ...strategyFields }).eq("id", currentRfaId);
        if (error) { alert("Error updating RFA: " + error.message); return; }
      }
      const { error: delError } = await supabase.from("rfa_vendors").delete().eq("rfa_id", currentRfaId);
      if (delError) { alert("Error clearing vendor slots: " + delError.message); return; }
      for (const v of vendors) {
        // vendor_id column is UUID type but vendors table uses integer IDs;
        // embed vendor_id inside payment_term_data JSONB to avoid type mismatch
        const ptdToSave = { ...(v.payment_term_data || {}), __vendor_id: v.vendor_id || null };
        const { error: insError } = await supabase.from("rfa_vendors").insert({
          rfa_id: currentRfaId, slot: v.slot, vendor_id: null,
          participation_status: v.participation_status || "Submitted",
          payment_term_type: v.payment_term_type||null, payment_term_data: ptdToSave,
          commencement_date: v.commencement_date||null, completion_date: v.completion_date||null,
          price_validity: v.price_validity||null, liquidated_damages: v.liquidated_damages||null,
          remarks: v.remarks||null, proposals: v.proposals,
        });
        if (insError) { alert(`Error saving Vendor ${v.slot}: ${insError.message}`); return; }
      }
      // CM editing while RFA is under review — notify CO
      if (can(profile, "rfa.approve") && status === "Submitted" && currentRfaId) {
        if (rfaCreatedBy && rfaCreatedBy !== profile.id) {
          await supabase.from("notifications").insert({
            user_id: rfaCreatedBy, type: "rfa_cm_edit",
            message: `RFA ${rfaNumber} was edited by ${profile.full_name} during review.`,
            reference_id: currentRfaId, reference_type: "rfa",
          });
        }
        alert("Changes saved. The requesting officer has been notified.");
      } else {
        alert("Draft saved.");
      }
    } catch (err) { alert("Unexpected error: " + err.message); }
    finally { setSaving(false); }
  };

  const submitRFA = async () => {
    if (!rfaId) { alert("Save the RFA as draft first before submitting."); return; }
    if (!awardedSlot) { alert("Please select a recommended vendor before submitting for review."); return; }
    if (!alignment.scopeWith?.trim() || !alignment.scopeDate || !alignment.timelineWith?.trim() || !alignment.timelineDate) {
      alert("Please complete the Scope & Timeline Alignment section before submitting.\n\nBoth 'Confirmed with' and 'Date confirmed' are required for Scope of Works and Timeline."); return;
    }
    setActionSaving(true);
    try {
      const { error } = await supabase.from("rfas").update({ status: "Submitted" }).eq("id", rfaId);
      if (error) { alert("Error: " + error.message); return; }
      setStatus("Submitted");
      const { data: cms } = await supabase.from("profiles").select("id").in("position", ["Commercial Manager", "D&C Head"]);
      if (cms?.length) {
        await supabase.from("notifications").insert(cms.map(p => ({
          user_id: p.id, type: "rfa_submitted",
          message: `RFA ${rfaNumber} has been submitted for your review.`,
          reference_id: rfaId, reference_type: "rfa",
        })));
      }
      alert("RFA submitted for review. The Commercial Manager has been notified.");
    } catch (err) { alert("Unexpected error: " + err.message); }
    finally { setActionSaving(false); }
  };

  const withdrawRFA = async () => {
    if (!rfaId) return;
    if (!window.confirm("Withdraw this RFA from review? It will return to Draft and you can make revisions.")) return;
    setActionSaving(true);
    try {
      const { error } = await supabase.from("rfas").update({ status: "Draft" }).eq("id", rfaId);
      if (error) { alert("Error: " + error.message); return; }
      setStatus("Draft");
      const { data: cms } = await supabase.from("profiles").select("id").in("position", ["Commercial Manager", "D&C Head"]);
      if (cms?.length) {
        await supabase.from("notifications").insert(
          cms.filter(p => p.id !== profile.id).map(p => ({
            user_id: p.id, type: "rfa_withdrawn",
            message: `RFA ${rfaNumber} was withdrawn from review by ${profile.full_name}.`,
            reference_id: rfaId, reference_type: "rfa",
          }))
        );
      }
    } catch (err) { alert("Unexpected error: " + err.message); }
    finally { setActionSaving(false); }
  };

  const approveRFA = async () => {
    if (!rfaId) return;
    setActionSaving(true);
    try {
      const { error } = await supabase.from("rfas").update({ status: "Approved" }).eq("id", rfaId);
      if (error) { alert("Error: " + error.message); return; }
      setStatus("Approved");
      if (rfaCreatedBy && rfaCreatedBy !== profile.id) {
        await supabase.from("notifications").insert({
          user_id: rfaCreatedBy, type: "rfa_approved",
          message: `RFA ${rfaNumber} has been approved. You may now generate documents.`,
          reference_id: rfaId, reference_type: "rfa",
        });
      }
      alert("RFA approved. The requesting officer can now generate documents.");
    } catch (err) { alert("Unexpected error: " + err.message); }
    finally { setActionSaving(false); }
  };

  const returnRFA = async () => {
    if (!returnCommentInput.trim()) { alert("Please enter a return comment."); return; }
    setActionSaving(true);
    try {
      const { error } = await supabase.from("rfas").update({ status: "Returned" }).eq("id", rfaId);
      if (error) { alert("Error: " + error.message); return; }
      setStatus("Returned");
      setRfaReturnComment(returnCommentInput.trim());
      setReturnModal(false);
      setReturnCommentInput("");
      if (rfaCreatedBy && rfaCreatedBy !== profile.id) {
        await supabase.from("notifications").insert({
          user_id: rfaCreatedBy, type: "rfa_returned",
          message: `RFA ${rfaNumber} was returned for revision: "${returnCommentInput.trim().slice(0, 80)}"`,
          reference_id: rfaId, reference_type: "rfa",
        });
      }
    } catch (err) { alert("Unexpected error: " + err.message); }
    finally { setActionSaving(false); }
  };

  useEffect(() => {
    if (!showPreviewModal || !previewBodies) return;
    if (page2EditRef.current) page2EditRef.current.innerHTML = previewBodies.page2;
    if (page3EditRef.current) page3EditRef.current.innerHTML = previewBodies.page3;
    if (page4EditRef.current) page4EditRef.current.innerHTML = previewBodies.page4;
    setPreviewTab("page2");
    setRevisionComment("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreviewModal, previewBodies]);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}><div style={{ fontSize: 13, color: C.textTer }}>Loading…</div></div>;

  const checklist = computeChecklist(vendors, vendorList, awardedSlot, awardReason);
  const colGrid = `repeat(${vendors.length}, 1fr)`;
  const lbl = { fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 };

  // Per-vendor computed data for scorecard + summaries
  const vComputed = vendors.map(v => {
    const ptd  = v.payment_term_data || {};
    const ptt  = v.payment_term_type;
    const lp   = v.proposals[v.proposals.length - 1];
    const tot  = lp ? computeProposalTotals(lp).total : 0;
    const ptLabel = PAYMENT_TERM_TYPES.find(t => t.value === ptt)?.label || null;
    const autoAmts = autoBondAmounts(ptt, ptd, tot);
    const isNonSubmitted = v.participation_status && v.participation_status !== "Submitted";
    const sectionDone = isNonSubmitted ? { cost: true, payment: true, rtb: true, bonds: true, timeline: true } : {
      cost:     v.proposals.length > 0 && v.proposals.some(p => p.items.some(i => parseFloat(i.unit_price||0) > 0)),
      payment:  !!ptt,
      rtb:      !!ptt,
      bonds:    !!ptt,
      timeline: !!(ptd.work_duration && v.completion_date),
    };
    return { tot, ptLabel, sectionDone, autoAmts, ptd, ptt };
  });

  return (
    <>
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <button onClick={() => setPage("rfa_list")} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSec, padding: 0, fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="chevronLeft" size={14} color={C.textTer} /> Recommendations for Award
            </button>
            <Icon name="chevronRight" size={12} color={C.textTer} />
            <span style={{ color: C.textPri, fontWeight: 500 }}>{rfaNumber || "New RFA"}</span>
            {rfaNumber && <span style={styles.badge(status)}>{status}</span>}
            {linkedContract && (
              <button onClick={() => { if (setSelectedContractId) setSelectedContractId(linkedContract.id); setPage("contract_detail"); }}
                style={{ background: C.greenBg, border: `1px solid ${C.greenText}40`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, color: C.greenText, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                📋 {linkedContract.contract_number}
              </button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {(() => {
            if (!awardedSlot || !pr?.remaining_budget) return null;
            const awarVI = vendors.findIndex(v => v.slot === awardedSlot);
            if (awarVI < 0) return null;
            const tot = vComputed[awarVI]?.tot || 0;
            const rem = parseFloat(pr.remaining_budget) || 0;
            if (!tot || tot <= rem) return null;
            return (
              <div style={{ fontSize: 11, color: C.amberText, background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 6, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                ⚠ Award exceeds budget by {fmtCurrency(tot - rem)}
              </div>
            );
          })()}
          <button onClick={() => setShowChecklist(p => !p)}
            style={{ ...styles.btnSecondary, padding: "6px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
              borderColor: checklist.length > 0 ? "#FCD34D" : C.greenText,
              color: checklist.length > 0 ? C.amberText : C.greenText }}>
            {checklist.length > 0 ? `⚠ ${checklist.length} item${checklist.length > 1 ? "s" : ""} missing` : "✓ Complete"}
          </button>
          {/* Generate — only enabled when Approved */}
          {can(profile, "rfa.generate") && (() => {
            const genDisabled = checklist.length > 0 || status !== "Approved";
            const genTitle = status !== "Approved" ? "RFA must be approved by the Commercial Manager before generating documents" : checklist.length > 0 ? `${checklist.length} item${checklist.length !== 1 ? "s" : ""} must be completed before generating` : undefined;
            return (
              <button
                title={genTitle}
                disabled={genDisabled}
                style={{ ...styles.btnSecondary, display: "flex", alignItems: "center", gap: 5, opacity: genDisabled ? 0.45 : 1, cursor: genDisabled ? "not-allowed" : "pointer" }}
                onClick={() => { if (genDisabled) return; setGenForm(f => ({ ...f, projectAddress: pr?.projects?.address || f.projectAddress || "", preparedByName: f.preparedByName || profile?.full_name || "", preparedByTitle: f.preparedByTitle || profile?.position || "Commercial Officer", docDate: f.docDate || new Date().toISOString().slice(0,10), scopeItems: f.scopeItems?.length ? f.scopeItems : scopeItems.map(si => ({ id: uid(), description: si.description || "" })) })); setShowGenModal(true); fetchBuLogo(genForm.clientCompany); }}>
                📄 Generate / Revise
              </button>
            );
          })()}
          {/* Draft / Returned → CO saves + submits */}
          {(status === "Draft" || status === "Returned" || status === "Completed" || !rfaId) && (<>
            <button style={styles.btnSecondary} onClick={() => saveRFA()} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</button>
            <button style={styles.btnPrimary} onClick={submitRFA} disabled={saving || actionSaving || !rfaId}
              title={!rfaId ? "Save as draft first" : undefined}>
              {actionSaving ? "Submitting…" : "Submit for Review"}
            </button>
          </>)}
          {/* Submitted → CM can save/return/approve; CO can only withdraw */}
          {status === "Submitted" && (can(profile, "rfa.approve") ? (<>
            <button style={styles.btnSecondary} onClick={() => saveRFA()} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
            <button style={styles.btnDanger} onClick={() => setReturnModal(true)} disabled={actionSaving}>Return</button>
            <button style={styles.btnSuccess} onClick={approveRFA} disabled={actionSaving}>{actionSaving ? "Approving…" : "Approve"}</button>
          </>) : (
            <button style={styles.btnAmber} onClick={withdrawRFA} disabled={actionSaving}>{actionSaving ? "Withdrawing…" : "Withdraw"}</button>
          ))}
          {/* Approved → CM can return for revision */}
          {status === "Approved" && can(profile, "rfa.approve") && (
            <button style={styles.btnSecondary} onClick={() => setReturnModal(true)} disabled={actionSaving}>Return for Revision</button>
          )}
        </div>
      </div>

      {/* ── Return Comment Banner ── */}
      {status === "Returned" && rfaReturnComment && (
        <div style={{ margin:"0 0 16px", padding:"14px 18px", background:C.redBg, border:`1px solid #FCA5A5`, borderRadius:10, display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ fontSize:18, lineHeight:1 }}>↩</span>
          <div>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:C.redText, marginBottom:4 }}>Returned for Revision</div>
            <div style={{ fontSize:13, color:C.redText }}>{rfaReturnComment}</div>
          </div>
        </div>
      )}

      {/* ── Submitted Banner (CO view) ── */}
      {status === "Submitted" && !can(profile, "rfa.approve") && (
        <div style={{ margin:"0 0 16px", padding:"14px 18px", background:"#EEF2FF", border:`1px solid #C7D2FE`, borderRadius:10, display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ fontSize:18, lineHeight:1 }}>⏳</span>
          <div>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"#4338CA", marginBottom:4 }}>Under Review</div>
            <div style={{ fontSize:13, color:"#4338CA" }}>This RFA has been submitted and is awaiting Commercial Manager approval. You can withdraw it if you need to make changes.</div>
          </div>
        </div>
      )}

      {/* ── Approved Lock Banner ── */}
      {status === "Approved" && (
        <div style={{ margin:"0 0 16px", padding:"14px 18px", background:C.greenBg, border:`1px solid ${C.greenText}40`, borderRadius:10, display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ fontSize:18, lineHeight:1 }}>🔒</span>
          <div>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:C.greenText, marginBottom:4 }}>Approved & Locked</div>
            <div style={{ fontSize:13, color:C.greenText }}>
              This RFA has been approved and is locked for editing.{" "}
              {can(profile, "rfa.approve")
                ? <>Use <strong>Return for Revision</strong> to send it back to the CO if changes are needed.</>
                : "Contact the Commercial Manager if revisions are required."}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Log (show when there are CM edits) ── */}
      {editLog.length > 0 && (
        <div style={{ ...styles.card, marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", color:C.textSec, padding:"10px 18px", background:"#F9FAFB", borderBottom:`1px solid #F3F4F6` }}>Review Activity</div>
          <div style={{ padding:"0 18px" }}>
            {editLog.map((log, li) => (
              <div key={log.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom: li < editLog.length - 1 ? `1px solid #F3F4F6` : "none", fontSize:12 }}>
                <span style={{ color:C.textTer, fontSize:11, whiteSpace:"nowrap" }}>
                  {new Date(log.edited_at).toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" })} {new Date(log.edited_at).toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit" })}
                </span>
                <span style={{ color:C.textSec }}>{log.summary || `Edited by ${log.editor?.full_name || "reviewer"}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Issued Documents Section ── */}
      {(pr?.id) && (
        <div style={{ ...styles.card, marginBottom: 16, padding: 0, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", background:"#F9FAFB", borderBottom: issuedDocs.length > 0 ? `1px solid #F3F4F6` : "none" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background: issuedDocs.length > 0 ? "#10B981" : "#D1D5DB", flexShrink:0 }} />
            <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", color:C.textSec }}>Issued Documents</div>
            {issuedDocs.length > 0 && (
              <span style={{ fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:10, background:"#D1FAE5", color:"#065F46" }}>
                {issuedDocs.length} version{issuedDocs.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {/* Body */}
          {issuedDocs.length === 0 ? (
            <div style={{ padding:"12px 18px", fontSize:11, color:C.textTer, fontStyle:"italic" }}>
              No documents issued yet — click <strong style={{ fontStyle:"normal", color:C.textSec }}>Generate / Revise</strong> to create the first issuance.
            </div>
          ) : (
            <div>
              {issuedDocs.map((doc, idx) => {
                const isCurrent = idx === 0;
                const fmtDate = d => d ? new Date(d).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—";
                return (
                  <div key={doc.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 18px", borderBottom: idx < issuedDocs.length - 1 ? `1px solid #F3F4F6` : "none", background: isCurrent ? "#FAFAFA" : "white" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                        <span style={{ background: isCurrent ? C.coral : "#E5E7EB", color: isCurrent ? "#fff" : "#9CA3AF", fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:10 }}>
                          v{doc.revision_no} · {isCurrent ? "Current" : "Superseded"}
                        </span>
                        <span style={{ fontSize:11, color: isCurrent ? C.textPri : C.textTer, fontWeight: isCurrent ? 600 : 400 }}>
                          {doc.doc_type === "NOA+NTP" ? "NOA + NTP" : doc.doc_type} · Contract Agreement · Term Sheet
                        </span>
                      </div>
                      <div style={{ fontSize:10, color:C.textTer }}>
                        {fmtDate(doc.issued_at)}{doc.revision_comment ? ` · ${doc.revision_comment}` : " · Initial issuance"}
                        {doc.gen_form_snapshot?.__terms_version && <span style={{ marginLeft:6, background:"#F3F4F6", borderRadius:4, padding:"1px 5px" }}>{doc.gen_form_snapshot.__terms_version}</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexShrink:0, marginLeft:12 }}>
                      {!isCurrent && issuedDocs[idx - 1] && (
                        <button style={{ ...styles.btnSecondary, fontSize:10, padding:"4px 10px" }}
                          onClick={() => setDiffDoc({ prev: doc, curr: issuedDocs[idx - 1], tab: "page2" })}>
                          🔍 Compare
                        </button>
                      )}
                      <button style={{ ...styles.btnSecondary, fontSize:10, padding:"4px 10px" }}
                        onClick={() => printIssuedDoc(doc)}>
                        → Print
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Return RFA Modal ── */}
      {returnModal && (
        <div style={{ position:"fixed", inset:0, zIndex:1100, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:C.white, borderRadius:14, padding:28, width:"100%", maxWidth:460, boxShadow:"0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize:15, fontWeight:600, color:C.textPri, marginBottom:6 }}>Return RFA for Revision</div>
            <div style={{ fontSize:13, color:C.textSec, marginBottom:16 }}>Please describe what needs to be revised. This message will be shown to the requesting officer.</div>
            <textarea
              value={returnCommentInput}
              onChange={e => setReturnCommentInput(e.target.value)}
              rows={4}
              placeholder="e.g. Please update the proposed payment terms for Vendor 2 and re-check the timeline feasibility."
              style={{ ...styles.input, resize:"vertical", lineHeight:1.5 }}
            />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:16 }}>
              <button style={styles.btnSecondary} onClick={() => { setReturnModal(false); setReturnCommentInput(""); }} disabled={actionSaving}>Cancel</button>
              <button style={styles.btnDanger} onClick={returnRFA} disabled={!returnCommentInput.trim() || actionSaving}>
                {actionSaving ? "Returning…" : "Return RFA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Version Compare Modal ── */}
      {diffDoc && (() => {
        const tabs = [
          { key: "page2", label: "NOA/NTP Letter" },
          { key: "page3", label: "Contract Agreement" },
          { key: "page4", label: "Term Sheet" },
        ];
        const prevHtml = diffDoc.prev[diffDoc.tab + "_html"] || "";
        const currHtml = diffDoc.curr[diffDoc.tab + "_html"] || "";
        const fmtDate  = d => d ? new Date(d).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—";
        const panelStyle = {
          flex:1, background:"#fff", overflow:"auto", maxHeight:"calc(100vh - 220px)",
          border:`1px solid ${C.border}`, borderRadius:6,
        };
        const docStyle = {
          padding:"20px 28px", fontSize:9, lineHeight:1.65,
        };
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:1100, maxHeight:"95vh", display:"flex", flexDirection:"column", boxShadow:"0 12px 48px rgba(0,0,0,0.3)" }}>

              {/* Header */}
              <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.textPri }}>🔍 Version Comparison</div>
                  <div style={{ fontSize:10, color:C.textTer, marginTop:2 }}>
                    v{diffDoc.prev.revision_no} ({fmtDate(diffDoc.prev.issued_at)}) vs v{diffDoc.curr.revision_no} ({fmtDate(diffDoc.curr.issued_at)})
                  </div>
                </div>
                <button onClick={() => setDiffDoc(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textTer, fontSize:20, padding:4 }}>✕</button>
              </div>

              {/* Tab bar */}
              <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, padding:"0 20px", flexShrink:0 }}>
                {tabs.map(t => (
                  <button key={t.key} type="button"
                    onClick={() => setDiffDoc(d => ({ ...d, tab: t.key }))}
                    style={{ padding:"8px 14px", border:"none", borderBottom: diffDoc.tab===t.key ? `2px solid ${C.coral}` : "2px solid transparent",
                      marginBottom:-1, background:"transparent", cursor:"pointer", fontSize:11, fontWeight:600,
                      color: diffDoc.tab===t.key ? C.coral : C.textSec }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Side-by-side panels */}
              <div style={{ display:"flex", gap:12, padding:16, flex:1, overflow:"hidden" }}>
                <div style={{ ...panelStyle }}>
                  <div style={{ padding:"6px 14px", background:C.offWhite, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:600, color:"#888" }}>
                    v{diffDoc.prev.revision_no} — {fmtDate(diffDoc.prev.issued_at)} · {diffDoc.prev.revision_comment || "Initial issuance"}
                  </div>
                  <style dangerouslySetInnerHTML={{ __html: `.ntbl{border-collapse:collapse;width:100%;margin:8px 0}.ntbl th,.ntbl td{border:1px solid #888;padding:4px 8px;font-size:9px}.ptbl{width:100%;border-collapse:collapse;font-size:9px;margin:5px 0}.ptbl th,.ptbl td{border:1px solid #ccc;padding:3px 6px;vertical-align:top}.ptbl thead th{background:${C.coralLight};font-weight:700}.dt{font-size:11px;text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px}ol{margin:6px 0;padding-left:22px;line-height:1.7}` }} />
                  <div style={docStyle} dangerouslySetInnerHTML={{ __html: prevHtml }} />
                </div>
                <div style={{ ...panelStyle }}>
                  <div style={{ padding:"6px 14px", background:"#EFF6FF", borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:600, color:"#1D4ED8" }}>
                    v{diffDoc.curr.revision_no} — {fmtDate(diffDoc.curr.issued_at)} · {diffDoc.curr.revision_comment || "Initial issuance"}
                  </div>
                  <style dangerouslySetInnerHTML={{ __html: `.ntbl{border-collapse:collapse;width:100%;margin:8px 0}.ntbl th,.ntbl td{border:1px solid #888;padding:4px 8px;font-size:9px}.ptbl{width:100%;border-collapse:collapse;font-size:9px;margin:5px 0}.ptbl th,.ptbl td{border:1px solid #ccc;padding:3px 6px;vertical-align:top}.ptbl thead th{background:${C.coralLight};font-weight:700}.dt{font-size:11px;text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px}ol{margin:6px 0;padding-left:22px;line-height:1.7}` }} />
                  <div style={docStyle} dangerouslySetInnerHTML={{ __html: currHtml }} />
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Generate Package Modal ── */}
      {showGenModal && (() => {
        const gfLbl = { fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", marginBottom: 3 };
        const gfInput = { ...styles.input, margin: 0, fontSize: 11 };
        const GRow = ({ label, field, placeholder, wide }) => (
          <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
            <div style={gfLbl}>{label}</div>
            <input value={genForm[field]||""} onChange={e => setGenForm(f=>({...f,[field]:e.target.value}))}
              placeholder={placeholder||""} style={gfInput} />
          </div>
        );
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:680, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 12px 48px rgba(0,0,0,0.22)" }}>

              {/* Header */}
              <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:"#fff", zIndex:1 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.textPri }}>📄 Generate Procurement Package</div>
                  <div style={{ fontSize:11, color:C.textTer, marginTop:2 }}>Recommendation for Award · NOA/NTP · Contract Agreement · Term Sheet</div>
                </div>
                <button onClick={()=>setShowGenModal(false)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textTer, fontSize:20, padding:4 }}>✕</button>
              </div>

              <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:20 }}>

                {/* Client & Project */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.textPri, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.04em" }}>Client & Project</div>
                  {/* Document type selector */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:C.textTer, textTransform:"uppercase", marginBottom:6 }}>Document Type (Page 2)</div>
                    <div style={{ display:"flex", gap:0, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                      {[["NOA+NTP","NOA + NTP (Combined)"],["NOA","Notice of Award Only"],["NTP","Notice to Proceed Only"]].map(([val, lbl], idx, arr) => (
                        <button type="button" key={val}
                          onClick={() => setGenForm(f => ({...f, docType: val}))}
                          style={{ flex:1, padding:"7px 10px", fontSize:10, fontWeight:600, border:"none", borderRight: idx < arr.length-1 ? `1px solid ${C.border}` : "none", cursor:"pointer", background: genForm.docType===val ? C.coral : C.offWhite, color: genForm.docType===val ? "#fff" : C.textSec, transition:"background 0.15s" }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <GRow label="Client Company Name" field="clientCompany" placeholder="e.g. Plushomes Communities, Inc." wide />
                    <div>
                      <div style={gfLbl}>Document Date</div>
                      <input type="date" value={genForm.docDate||""} onChange={e=>setGenForm(f=>({...f,docDate:e.target.value}))} style={gfInput} />
                    </div>
                    <div>
                      <div style={gfLbl}>NOA / Control No. <span style={{ color:C.textTer, fontWeight:400, textTransform:"none" }}>(auto-generated on first issuance)</span></div>
                      <input value={genForm.noaNumber||""} onChange={e=>setGenForm(f=>({...f,noaNumber:e.target.value}))}
                        placeholder="e.g. NOA-2025-0001" style={gfInput} />
                    </div>
                    <div>
                      <div style={gfLbl}>Addressee Title</div>
                      <select value={genForm.salutTitle||""} onChange={e=>setGenForm(f=>({...f,salutTitle:e.target.value}))} style={gfInput}>
                        <option value="">— auto-detect —</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Dr.">Dr.</option>
                        <option value="Engr.">Engr.</option>
                        <option value="Atty.">Atty.</option>
                        <option value="Arch.">Arch.</option>
                      </select>
                    </div>
                    <GRow label="Project Address / Location" field="projectAddress" placeholder="e.g. Northville, Caloocan City" />
                    <div>
                      <div style={gfLbl}>Procurement Strategy</div>
                      <div style={{ ...gfInput, background: C.offWhite, color: C.textPri, cursor: "default" }}>{procurementStrategy}</div>
                    </div>
                    <div>
                      <div style={gfLbl}>Justification</div>
                      <div style={{ ...gfInput, background: C.offWhite, color: procurementJustification ? C.textPri : C.textTer, cursor: "default", minHeight: 30 }}>{procurementJustification || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Scope of Works */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.textPri, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.04em" }}>Scope of Works (NOA Table)</div>
                  <div style={{ fontSize:10, color:C.textTer, marginBottom:10 }}>These rows appear in the NOA/NTP letter. Edit or add items as needed.</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, marginBottom:8 }}>
                    <thead>
                      <tr style={{ background:C.offWhite }}>
                        <th style={{ padding:"5px 8px", textAlign:"left", fontWeight:600, color:C.textTer, fontSize:10, width:36, borderBottom:`1px solid ${C.border}` }}>No.</th>
                        <th style={{ padding:"5px 8px", textAlign:"left", fontWeight:600, color:C.textTer, fontSize:10, borderBottom:`1px solid ${C.border}` }}>Item Description</th>
                        <th style={{ width:28, borderBottom:`1px solid ${C.border}` }} />
                      </tr>
                    </thead>
                    <tbody>
                      {(genForm.scopeItems||[]).map((item, i) => (
                        <tr key={item.id||i} style={{ borderBottom:`1px solid ${C.border}` }}>
                          <td style={{ padding:"4px 8px", color:C.textTer, fontSize:11, textAlign:"center" }}>{i+1}</td>
                          <td style={{ padding:"4px 6px" }}>
                            <input value={item.description} onChange={e => setGenForm(f => ({ ...f, scopeItems: f.scopeItems.map((s,j) => j===i ? {...s, description:e.target.value} : s) }))}
                              placeholder="Enter item description…"
                              style={{ ...gfInput, width:"100%", boxSizing:"border-box" }} />
                          </td>
                          <td style={{ padding:"4px 6px", textAlign:"center" }}>
                            <button onClick={() => setGenForm(f => ({ ...f, scopeItems: f.scopeItems.filter((_,j) => j!==i) }))}
                              style={{ background:"none", border:"none", cursor:"pointer", color:C.textTer, fontSize:14, lineHeight:1, padding:"2px 4px" }} title="Remove row">✕</button>
                          </td>
                        </tr>
                      ))}
                      {(genForm.scopeItems||[]).length === 0 && (
                        <tr><td colSpan={3} style={{ padding:"10px 8px", color:C.textTer, fontStyle:"italic", fontSize:11 }}>No scope items — add a row below.</td></tr>
                      )}
                    </tbody>
                  </table>
                  <button onClick={() => setGenForm(f => ({ ...f, scopeItems: [...(f.scopeItems||[]), { id: uid(), description:"" }] }))}
                    style={{ ...styles.btnGhost, fontSize:11, padding:"5px 12px" }}>+ Add Row</button>
                </div>

                {/* Approval Chain */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.textPri, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.04em" }}>Approval Chain</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div style={{ gridColumn:"1/-1", fontWeight:600, fontSize:10, color:C.textTer, textTransform:"uppercase" }}>① Prepared by</div>
                    <GRow label="Name" field="preparedByName" placeholder="Full name" />
                    <GRow label="Title / Position" field="preparedByTitle" placeholder="e.g. Commercial Officer" />
                    <div style={{ gridColumn:"1/-1", fontWeight:600, fontSize:10, color:C.textTer, textTransform:"uppercase", marginTop:4 }}>② Reviewed by</div>
                    <GRow label="Name" field="reviewedByName" placeholder="Full name" />
                    <GRow label="Title / Position" field="reviewedByTitle" placeholder="e.g. Commercial Lead" />
                    <div style={{ gridColumn:"1/-1", fontWeight:600, fontSize:10, color:C.textTer, textTransform:"uppercase", marginTop:4 }}>③ Endorsed for Approval by</div>
                    <GRow label="Name" field="endorsedByName" placeholder="Full name" />
                    <GRow label="Title / Position" field="endorsedByTitle" placeholder="e.g. AVP, Design and Construction Head" />
                    <div style={{ gridColumn:"1/-1", fontWeight:600, fontSize:10, color:C.textTer, textTransform:"uppercase", marginTop:4 }}>④ Approved by (Finance / Operations)</div>
                    <GRow label="Name" field="approvedBy1Name" placeholder="Full name" />
                    <GRow label="Title / Position" field="approvedBy1Title" placeholder="e.g. Head of Finance & Accounting" />
                    <div style={{ gridColumn:"1/-1", fontWeight:600, fontSize:10, color:C.textTer, textTransform:"uppercase", marginTop:4 }}>⑤ Approved by (President) — optional</div>
                    <GRow label="Name" field="approvedBy2Name" placeholder="Full name" />
                    <GRow label="Title / Position" field="approvedBy2Title" placeholder="e.g. President" />
                  </div>
                </div>

                {/* Warning if no vendor awarded */}
                {!awardedSlot && (
                  <div style={{ background:C.amberBg, border:`1px solid #FCD34D`, borderRadius:8, padding:"10px 14px", fontSize:11, color:C.amberText, fontWeight:600 }}>
                    ⚠ No vendor recommended yet — NOA/NTP and Term Sheet will have blank vendor fields.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end", gap:10, position:"sticky", bottom:0, background:"#fff" }}>
                <button style={styles.btnGhost} onClick={()=>setShowGenModal(false)}>Cancel</button>
                <button style={styles.btnPrimary} onClick={() => {
                    setPreviewBodies(buildPageBodies(genForm, vComputed));
                    setShowGenModal(false);
                    setShowPreviewModal(true);
                  }}>
                  👁 Preview &amp; Edit
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

        const execCmd = (cmd) => { document.execCommand(cmd, false, null); };
        const today = genForm.docDate
          ? new Date(genForm.docDate + "T00:00:00").toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" })
          : new Date().toLocaleDateString("en-PH", { year:"numeric", month:"long", day:"numeric" });
        const fmtDate = d => d ? new Date(d).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) : "—";

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

              {/* Content area — A4 page preview */}
              <div style={{ flex:1, overflowY:"auto", background:"#b0b0b0", padding:"28px 20px" }}>
                <div style={{ background:"#fff", width:794, minHeight:1123, margin:"0 auto", boxShadow:"0 4px 20px rgba(0,0,0,0.35)", overflow:"hidden", position:"relative" }}>
                  <style dangerouslySetInnerHTML={{ __html: `
                    .ntbl{border-collapse:collapse;width:100%;margin:8px 0}
                    .ntbl th,.ntbl td{border:1px solid #888;padding:5px 9px;font-size:9.5px}
                    .ntbl thead tr{background:${C.coralLight}}
                    .ptbl{width:100%;border-collapse:collapse;font-size:9.5px;margin:5px 0}
                    .ptbl th,.ptbl td{border:1px solid #ccc;padding:4px 8px;vertical-align:top}
                    .ptbl thead th{background:${C.coralLight};font-weight:700;text-align:left}
                    .dt{font-size:11px;text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px}
                    ol{margin:6px 0;padding-left:22px;line-height:1.7}
                    ol li{margin-bottom:4px}
                  `}} />

                  {/* Locked letterhead */}
                  <div style={{ background:"#f8f8f8", padding:"12px 20px", borderBottom:`1px solid ${C.border}`, position:"relative" }}
                    contentEditable={false}>
                    <div style={{ position:"absolute", top:6, right:8, fontSize:8, background:"#e8e8e8", color:"#999", padding:"1px 6px", borderRadius:10 }}>🔒 locked</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:10, borderBottom:`2px solid ${C.coral}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {buLogoUrl
                          ? <img src={buLogoUrl} style={{ height:42, width:"auto", objectFit:"contain", maxWidth:120 }} alt="logo" />
                          : <div style={{ width:88, height:38, border:"1.5px dashed #bbb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:"#bbb", letterSpacing:"0.07em", textTransform:"uppercase" }}>Logo</div>
                        }
                        <div style={{ fontWeight:700, color:"#111", fontSize:9 }}>{genForm.clientCompany}</div>
                      </div>
                      <div style={{ textAlign:"right", fontSize:8.5, color:"#555", lineHeight:1.6 }}>
                        {genForm.noaNumber && <div style={{ fontSize:8 }}>{genForm.noaNumber}</div>}
                        {rfaNumber && <div style={{ fontSize:8 }}>Reference: {rfaNumber}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Editable body */}
                  {tabs.map(t => (
                    <div key={t.key}
                      ref={t.ref}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      style={{ padding:"28px 38px", minHeight:900, outline:"none", fontSize:9.5, lineHeight:1.65, display: previewTab===t.key ? "block" : "none",
                        border: previewTab===t.key ? `2px dashed ${C.coralLight}` : "none" }}
                    />
                  ))}
                  {/* Triangle footer strip */}
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, height:60, display:"flex", alignItems:"center" }}>
                    <img src="/PH1%20Footer.png" alt="" style={{ width:"100%", height:"auto", display:"block" }} />
                  </div>
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

      <div style={{ ...styles.pageBody, ...(status === "Approved" ? { pointerEvents: "none", userSelect: "none", opacity: 0.6 } : {}) }}>

        {/* ── Checklist panel ── */}
        {showChecklist && (
          <div style={{ ...styles.card, marginBottom: 16, border: checklist.length === 0 ? `1px solid ${C.greenText}` : `1px solid #FCD34D` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: checklist.length === 0 ? C.greenText : C.amberText }}>
                {checklist.length === 0 ? "✓ All fields complete — ready to submit" : `⚠ Completion Checklist (${checklist.length} missing)`}
              </span>
              <button onClick={() => setShowChecklist(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 18, padding: 0 }}>×</button>
            </div>
            {checklist.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {checklist.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 10px", background: C.amberBg, borderRadius: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.amberText, minWidth: 64 }}>{item.vendor}</span>
                    <span style={{ fontSize: 12, color: C.textSec }}>— {item.field}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab switcher ── */}
        <div style={{ display: "flex", marginBottom: 2, pointerEvents: "auto", opacity: 1 }}>
          <div style={{ display: "flex", gap: 0, background: "white", borderRadius: 10, border: `1px solid ${C.border}`, padding: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            {[
              { key: "detail",  label: "📋  Detailed Proposal" },
              { key: "summary", label: "⭐  Summary & Recommendation" },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{ padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", transition: "all 0.12s",
                  background: activeTab === tab.key ? C.coral : "transparent",
                  color: activeTab === tab.key ? "white" : C.textTer }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── PR Details card (Detail tab only) ── */}
        {activeTab === "detail" && (() => {
          const F = ({ label, value, mono, color }) => (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: color || (mono ? C.coral : C.textPri), fontFamily: mono ? "monospace" : "inherit", lineHeight: 1.5 }}>{value || "—"}</div>
            </div>
          );
          const effectiveBudgetStatus = pr?.budget_status || pr?.reviewer_budget_status;
          const effectiveBudgetCode   = pr?.budget_code   || pr?.reviewer_budget_code;
          const effectiveCost         = pr?.projected_cost ?? pr?.reviewer_projected_cost;
          const effectiveRemaining    = pr?.remaining_budget ?? pr?.reviewer_remaining_budget;
          const hasBudget = effectiveBudgetStatus || effectiveBudgetCode || effectiveCost != null;
          return (
            <div style={{ ...styles.card, marginBottom: 16, padding: 0, overflow: "hidden" }}>

              {/* ── Card header bar ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: "#F9FAFB", borderBottom: `1px solid #F3F4F6` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: C.textSec }}>Purchase Request Details</div>
                  {pr?.is_rush && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#FEE2E2", color: C.redText, border: "1px solid #FECACA" }}>🚨 Rush</span>}
                  {prRfaSequence > 1 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: C.amberBg, color: C.amberText, border: "1px solid #FCD34D" }}>⚠ RFA #{prRfaSequence} for this PR</span>}
                </div>
                <button onClick={() => setShowPRModal(true)}
                  style={{ ...styles.btnSecondary, padding: "4px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                  View Full PR
                </button>
              </div>

              {/* ── Main body: categories stacked vertically, sub-fields in a row ── */}
              <div style={{ padding: "0 18px" }}>

                {/* PROJECT */}
                <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D1D5DB", marginBottom: 10 }}>Project</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    <F label="Project"       value={pr?.projects?.name} />
                    <F label="Business Unit" value={pr?.projects?.business_unit} />
                    {pr?.projects?.project_code && <F label="Project Code" value={pr.projects.project_code} mono />}
                    <F label="Status" value={pr?.status} color={pr?.status === "Approved" ? C.greenText : pr?.status?.includes("Reject") ? C.redText : C.textPri} />
                  </div>
                </div>

                {/* BUDGET */}
                <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D1D5DB", marginBottom: 10 }}>Budget</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    <F label="Budget Status" value={effectiveBudgetStatus || "—"} color={effectiveBudgetStatus === "Budgeted" ? C.greenText : effectiveBudgetStatus ? C.amberText : C.textTer} />
                    <F label="Budget Code"   value={effectiveBudgetCode || "—"} mono />
                    {effectiveCost != null      && <F label="Projected Cost"   value={`₱ ${fmtPeso(effectiveCost)}`} mono />}
                    {effectiveRemaining != null && <F label="Remaining Budget" value={`₱ ${fmtPeso(effectiveRemaining)}`} mono />}
                  </div>
                </div>

                {/* PURCHASE REQUEST */}
                <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D1D5DB", marginBottom: 10 }}>Purchase Request</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    <F label="PR Number"  value={pr?.pr_number} mono />
                    <F label="Start Date" value={fmtShort(pr?.start_date)} />
                    <F label="End Date"   value={fmtShort(pr?.end_date)} />
                    <F label="Created"    value={fmt(pr?.created_at)} />
                  </div>
                </div>

                {/* DESCRIPTION */}
                <div style={{ padding: "14px 0" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D1D5DB", marginBottom: 10 }}>Description</div>
                  <div style={{ display: "grid", gridTemplateColumns: pr?.remarks ? "1fr 1fr 1fr" : "1fr 1fr", gap: 14 }}>
                    {[
                      { label: "Work Description", value: pr?.description },
                      { label: "Justification",    value: pr?.justification },
                      ...(pr?.remarks ? [{ label: "Remarks", value: pr.remarks, amber: true }] : []),
                    ].map(({ label, value, amber }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>{label}</div>
                        <div style={{ fontSize: 12, color: value ? C.textPri : C.textTer, lineHeight: 1.7, padding: "10px 12px", background: amber ? "#FFFBEB" : C.offWhite, borderRadius: 8, border: `1px solid ${amber ? "#FDE68A" : C.border}`, minHeight: 52, fontStyle: value ? "normal" : "italic" }}>
                          {value || "Not provided"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ── PR Full Details Modal ── */}
        {showPRModal && (
          <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", background: "rgba(0,0,0,0.45)", padding: "32px 16px", overflowY: "auto" }}>
            <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 860, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", marginBottom: 32 }}>
              {/* Modal header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.textPri }}>Purchase Request — <span style={{ fontFamily: "monospace", color: C.coral }}>{pr?.pr_number}</span></div>
                  <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{pr?.projects?.name}{pr?.projects?.business_unit ? ` · ${pr.projects.business_unit}` : ""}</div>
                </div>
                <button onClick={() => setShowPRModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.textTer, lineHeight: 1, padding: 4 }}>×</button>
              </div>

              <div style={{ padding: "20px 24px" }}>
                {/* Section A: PR Header */}
                {(() => {
                  const MF = ({ label, value, mono, color }) => (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: color || (mono ? C.coral : C.textPri), fontFamily: mono ? "monospace" : "inherit" }}>{value || "—"}</div>
                    </div>
                  );
                  const effectiveBudgetStatus = pr?.budget_status || pr?.reviewer_budget_status;
                  const effectiveBudgetCode   = pr?.budget_code   || pr?.reviewer_budget_code;
                  const effectiveCost         = pr?.projected_cost ?? pr?.reviewer_projected_cost;
                  const effectiveRemaining    = pr?.remaining_budget ?? pr?.reviewer_remaining_budget;
                  return (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>PR Information</div>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
                        <MF label="PR Number"    value={pr?.pr_number} mono />
                        <MF label="Status"       value={pr?.status} color={pr?.status === "Approved" ? C.greenText : pr?.status?.includes("Reject") ? C.redText : C.textPri} />
                        {pr?.is_rush && <MF label="Priority" value="🚨 Rush" color={C.redText} />}
                        <MF label="Project"      value={pr?.projects?.name} />
                        <MF label="Business Unit" value={pr?.projects?.business_unit} />
                        {pr?.projects?.project_code && <MF label="Project Code" value={pr.projects.project_code} mono />}
                        <MF label="Prepared By"  value={pr?.prepared?.full_name} />
                        <MF label="Manager" value={null} />
                        <MF label="Created"      value={fmt(pr?.created_at)} />
                        <MF label="Start Date"   value={fmtShort(pr?.start_date)} />
                        <MF label="End Date"     value={fmtShort(pr?.end_date)} />
                      </div>
                      {pr?.description && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Description</div>
                          <div style={{ fontSize: 12, color: C.textPri, lineHeight: 1.6, padding: "8px 12px", background: C.offWhite, borderRadius: 7 }}>{pr.description}</div>
                        </div>
                      )}
                      {pr?.justification && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Justification</div>
                          <div style={{ fontSize: 12, color: C.textPri, lineHeight: 1.6, padding: "8px 12px", background: C.offWhite, borderRadius: 7 }}>{pr.justification}</div>
                        </div>
                      )}
                      {pr?.rush_justification && (
                        <div style={{ marginBottom: 10, padding: "8px 12px", background: "#FEF2F2", borderRadius: 7, border: "1px solid #FECACA" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.redText, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Rush Justification</div>
                          <div style={{ fontSize: 12, color: C.textPri, lineHeight: 1.6 }}>{pr.rush_justification}</div>
                        </div>
                      )}
                      {(effectiveBudgetStatus || effectiveCost != null) && (
                        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10, padding: "10px 12px", background: C.offWhite, borderRadius: 8 }}>
                          {effectiveBudgetStatus && <MF label="Budget Status"    value={effectiveBudgetStatus} color={effectiveBudgetStatus === "Budgeted" ? C.greenText : C.amberText} />}
                          {effectiveBudgetCode   && <MF label="Budget Code"      value={effectiveBudgetCode} mono />}
                          {effectiveCost != null  && <MF label="Projected Cost"  value={`₱ ${fmtPeso(effectiveCost)}`} mono />}
                          {effectiveRemaining != null && <MF label="Remaining Budget" value={`₱ ${fmtPeso(effectiveRemaining)}`} mono />}
                        </div>
                      )}
                      {pr?.remarks && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Remarks</div>
                          <div style={{ fontSize: 12, color: C.textPri, lineHeight: 1.6, padding: "8px 12px", background: C.offWhite, borderRadius: 7 }}>{pr.remarks}</div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Section B: Scope of Works / BOQ */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Scope of Works / BOQ</div>
                  {scopeItems.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.textTer, fontStyle: "italic" }}>No scope items on record.</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.offWhite, borderBottom: `2px solid ${C.border}` }}>
                          {["#","Description","Qty","Unit"].map(h => (
                            <th key={h} style={{ padding: "7px 10px", textAlign: h === "Qty" ? "right" : "left", fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scopeItems.map((si, idx) => (
                          <tr key={si.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: "7px 10px", color: C.textTer, width: 32 }}>{idx + 1}</td>
                            <td style={{ padding: "7px 10px", color: C.textPri }}>{si.description}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", color: C.textSec }}>{si.quantity}</td>
                            <td style={{ padding: "7px 10px", color: C.textSec }}>{si.unit_of_measure}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Section C: Reference Documents */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Reference Documents</div>
                  {[
                    { label: "Reference / Plans", url: pr?.plans_file_url, name: pr?.plans_file_name },
                    { label: "Terms of Reference", url: pr?.tor_file_url,   name: pr?.tor_file_name  },
                    { label: "Specifications",      url: pr?.specs_file_url, name: pr?.specs_file_name },
                    { label: "Cost Reference",      url: pr?.projected_cost_reference_url, name: pr?.projected_cost_reference_name },
                  ].filter(d => d.url || d.name).length === 0 ? (
                    <div style={{ fontSize: 12, color: C.textTer, fontStyle: "italic" }}>No documents attached.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { label: "Reference / Plans", url: pr?.plans_file_url, name: pr?.plans_file_name },
                        { label: "Terms of Reference", url: pr?.tor_file_url,   name: pr?.tor_file_name  },
                        { label: "Specifications",      url: pr?.specs_file_url, name: pr?.specs_file_name },
                        { label: "Cost Reference",      url: pr?.projected_cost_reference_url, name: pr?.projected_cost_reference_name },
                      ].filter(d => d.url || d.name).map(doc => (
                        <div key={doc.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.offWhite, borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 16 }}>📎</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 2 }}>{doc.label}</div>
                            <div style={{ fontSize: 12, color: C.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name || doc.url}</div>
                          </div>
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 11, fontWeight: 600, color: C.coral, textDecoration: "none", whiteSpace: "nowrap", padding: "4px 10px", border: `1px solid ${C.coral}`, borderRadius: 6 }}>
                              Open ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: `1px solid ${C.border}`, background: C.offWhite, borderRadius: "0 0 14px 14px" }}>
                <button onClick={() => setShowPRModal(false)}
                  style={{ ...styles.btnSecondary, padding: "7px 18px", fontSize: 12 }}>Close</button>
                <button onClick={() => { setShowPRModal(false); if (setSelectedPRId) { setSelectedPRId(pr?.id); setPage("detail"); } }}
                  style={{ ...styles.btnPrimary, padding: "7px 18px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  Go to PR →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Procurement Strategy card (Detail tab only) ── */}
        {activeTab === "detail" && (() => {
          const psLbl = { fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 };
          const psInput = { ...styles.input, margin: 0, fontSize: 12 };
          const STRATEGIES = ["Competitive Bid", "Negotiated", "Repeat Order", "Bulk Order"];
          const needsJust = procurementStrategy === "Negotiated" || procurementStrategy === "Repeat Order";
          const currentPrProjectId = pr?.projects?.id || null;
          const otherProjects = allProjects.filter(p => p.id !== currentPrProjectId);
          return (
            <div style={{ ...styles.card, marginBottom: 16, padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: "#F9FAFB", borderBottom: `1px solid #F3F4F6` }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: C.textSec }}>Procurement Strategy</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                  background: procurementStrategy === "Competitive Bid" ? "#DBEAFE" : procurementStrategy === "Negotiated" ? "#FEF3C7" : procurementStrategy === "Repeat Order" ? "#D1FAE5" : "#EDE9FE",
                  color: procurementStrategy === "Competitive Bid" ? "#1D4ED8" : procurementStrategy === "Negotiated" ? "#92400E" : procurementStrategy === "Repeat Order" ? "#065F46" : "#5B21B6" }}>
                  {procurementStrategy}
                </span>
              </div>
              <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "200px 1fr", gap: 14, alignItems: "start" }}>
                {/* Strategy selector */}
                <div>
                  <div style={psLbl}>Strategy</div>
                  <select value={procurementStrategy} onChange={e => setProcurementStrategy(e.target.value)} style={psInput}>
                    {STRATEGIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  {procurementStrategy === "Competitive Bid" && (
                    <div style={{ fontSize: 10, color: vendors.filter(v=>v.vendor_id).length >= 2 ? C.greenText : C.amberText, marginTop: 4, fontWeight: 600 }}>
                      {vendors.filter(v=>v.vendor_id).length >= 2 ? `✓ ${vendors.filter(v=>v.vendor_id).length} vendors invited` : `⚠ Minimum 2 vendors required (${vendors.filter(v=>v.vendor_id).length} invited)`}
                    </div>
                  )}
                </div>
                {/* Right side: justification + extra fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={psLbl}>{needsJust ? "Justification *" : "Justification"}</div>
                    <textarea value={procurementJustification} onChange={e => setProcurementJustification(e.target.value)}
                      placeholder={procurementStrategy === "Negotiated" ? "Explain why negotiated procurement is appropriate…" : procurementStrategy === "Repeat Order" ? "Confirm same scope, same unit rate as previous order…" : "Optional notes on procurement approach…"}
                      rows={2} style={{ ...psInput, resize: "vertical", lineHeight: 1.5 }} />
                  </div>
                  {procurementStrategy === "Repeat Order" && (
                    <div>
                      <div style={psLbl}>Previous PO / Contract Reference *</div>
                      <input value={repeatOrderRef} onChange={e => setRepeatOrderRef(e.target.value)}
                        placeholder="e.g. PO-2024-0123 or Contract No. CA-2024-005"
                        style={psInput} />
                    </div>
                  )}
                  {procurementStrategy === "Bulk Order" && (
                    <div>
                      <div style={psLbl}>Also covers these projects</div>
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 120, overflowY: "auto", padding: "6px 8px", background: "white" }}>
                        {otherProjects.length === 0
                          ? <div style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>No other projects found.</div>
                          : otherProjects.map(p => (
                            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0", cursor: "pointer" }}>
                              <input type="checkbox" checked={bulkProjects.includes(p.id)}
                                onChange={e => setBulkProjects(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                                style={{ cursor: "pointer" }} />
                              <span style={{ fontSize: 11, color: C.textPri }}>{p.name}{p.project_code ? ` · ${p.project_code}` : ""}</span>
                            </label>
                          ))
                        }
                      </div>
                      {bulkProjects.length > 0 && (
                        <div style={{ fontSize: 10, color: C.textSec, marginTop: 4 }}>
                          {bulkProjects.length} project{bulkProjects.length > 1 ? "s" : ""} selected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ════════════════════════════════════════════════════════
            SECTION-FIRST LAYOUT — each row spans all vendors
            ════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>

          {/* ── 0. Vendor Header ── sticky comparison scorecard (Tab 1 only) ── */}
          {activeTab === "detail" && <div style={{ ...styles.card, padding: 0, overflow: "hidden", position: "sticky", top: 108, zIndex: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "grid", gridTemplateColumns: colGrid }}>
              {vendors.map((v, vi) => {
                const vc = vComputed[vi];
                const isLast = vi === vendors.length - 1;
                const sKeys = ["cost","payment","rtb","bonds","timeline"];
                const sLabels = { cost:"Cost", payment:"Terms", rtb:"RTB", bonds:"Bonds", timeline:"Timeline" };
                return (
                  <div key={v.slot} style={{ background: vi % 2 === 1 ? "#F9FAFB" : "white", borderTop: `3px solid ${C.coral}`, padding: "10px 16px", borderRight: !isLast ? "2px solid #E5E7EB" : "none" }}>
                    {/* Row 1: slot label + actions */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.coral, textTransform: "uppercase", letterSpacing: "0.07em" }}>Vendor {vi + 1}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {vendors.length < 3 && isLast && (
                          <button onClick={addVendor} title="Add vendor"
                            style={{ background: C.coralLight, border: "none", borderRadius: 5, color: C.coral, cursor: "pointer", fontSize: 11, lineHeight: 1, padding: "2px 8px", fontFamily: "inherit", fontWeight: 700 }}>+ Add</button>
                        )}
                        {vendors.length > 1 && (
                          <button onClick={() => removeVendor(v.slot)} title="Remove vendor"
                            style={{ background: "#F3F4F6", border: "none", borderRadius: 5, color: C.textSec, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "2px 7px", fontFamily: "inherit" }}>×</button>
                        )}
                      </div>
                    </div>
                    {/* Row 2: vendor identity — locked for submitted vendors, editable dropdown otherwise */}
                    {(() => {
                      const isSubmitted = !v.participation_status || v.participation_status === "Submitted";
                      const vInfo = v.vendor_id ? vendorList.find(vl => String(vl.id) === String(v.vendor_id)) : null;
                      const isOverriding = overridingSlots.has(v.slot);
                      const enterOverride = () => setOverridingSlots(prev => new Set([...prev, v.slot]));
                      const exitOverride  = () => setOverridingSlots(prev => { const s = new Set(prev); s.delete(v.slot); return s; });
                      if (isSubmitted && vInfo && !isOverriding) {
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.offWhite, marginBottom: 5, minHeight: 31 }}>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vInfo.full_name}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: C.coral, background: C.coralLight, borderRadius: 4, padding: "1px 6px", flexShrink: 0, whiteSpace: "nowrap" }}>From RFQ</span>
                            <button onClick={enterOverride} title="Change vendor assignment"
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 10, padding: 0, flexShrink: 0, fontFamily: "inherit", lineHeight: 1 }}>✎</button>
                          </div>
                        );
                      }
                      return (
                        <div style={{ position: "relative", marginBottom: 5 }}>
                          <select value={v.vendor_id} onChange={e => { updateVendor(v.slot, "vendor_id", e.target.value); exitOverride(); }}
                            style={{ width: "100%", padding: "5px 9px", borderRadius: 7, border: `1px solid ${isOverriding ? C.coral : C.border}`, background: "white", color: v.vendor_id ? C.textPri : C.textTer, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                            <option value="">Select vendor…</option>
                            {vendorList
                              .filter(vl => !vendors.some(ov => ov.slot !== v.slot && String(ov.vendor_id) === String(vl.id)))
                              .map(vl => <option key={vl.id} value={vl.id}>{vl.full_name}{vl.status && vl.status !== "Accredited" ? ` (${vl.status})` : ""}</option>)}
                          </select>
                          {isOverriding && (
                            <button onClick={exitOverride} title="Cancel change"
                              style={{ position: "absolute", right: 26, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 13, padding: 0, fontFamily: "inherit", lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                      );
                    })()}
                    {/* Row 2b: participation status */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                      <span style={{ fontSize: 9, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>Status:</span>
                      <select value={v.participation_status || "Submitted"} onChange={e => updateVendor(v.slot, "participation_status", e.target.value)}
                        style={{ flex: 1, padding: "2px 6px", borderRadius: 5, border: `1px solid ${C.border}`,
                          background: v.participation_status && v.participation_status !== "Submitted" ? "#FEF3C7" : "white",
                          color: v.participation_status && v.participation_status !== "Submitted" ? "#92400E" : C.textPri,
                          fontSize: 10, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                        {["Submitted","Non-Responsive","Declined","Disqualified"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    {/* Row 2c: vendor info (contact, status) */}
                    {v.vendor_id && (() => {
                      const vInfo = vendorList.find(vl => String(vl.id) === String(v.vendor_id));
                      if (!vInfo) return null;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 5, padding: "5px 8px", borderRadius: 6, background: "#F9FAFB", border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, color: C.textSec, display: "flex", alignItems: "center", gap: 3 }}>
                              <span>👤</span>
                              <span>{vInfo.contact_person || "—"}{vInfo.contact_position ? ` · ${vInfo.contact_position}` : ""}</span>
                            </span>
                            <span style={{ fontSize: 10, color: C.textSec, display: "flex", alignItems: "center", gap: 3 }}>
                              <span>📞</span>
                              <span>{vInfo.cell_number || "—"}</span>
                            </span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                              background: vInfo.status === "Accredited" ? C.greenBg : "#F3F4F6",
                              color: vInfo.status === "Accredited" ? C.greenText : C.textSec,
                            }}>{vInfo.status || "—"}</span>
                          </div>
                          {vInfo.address && (
                            <div style={{ fontSize: 10, color: C.textTer, display: "flex", alignItems: "flex-start", gap: 3 }}>
                              <span style={{ flexShrink: 0 }}>📍</span>
                              <span>{vInfo.address}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Row 2d: RFQ submission strip */}
                    {v.rfqSubmission && (() => {
                      const sub = v.rfqSubmission;
                      const fmtDate = d => d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : null;
                      const isNonVat = sub.vat_status === "Non-VAT";
                      return (
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, marginBottom: 5, padding: "5px 8px", borderRadius: 6, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                          <span style={{ fontSize: 10, color: "#1E40AF", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                            <span>📄</span>
                            <span>v{sub.version}{sub.submitted_at ? ` · ${fmtDate(sub.submitted_at)}` : ""}</span>
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: isNonVat ? "#FEF3C7" : "#DCFCE7", color: isNonVat ? "#92400E" : "#166534" }}>
                            {sub.vat_status || "VAT"}
                          </span>
                          {sub.price_validity && (
                            <span style={{ fontSize: 10, color: "#1E40AF" }}>Valid until {fmtDate(sub.price_validity)}</span>
                          )}
                          {sub.attachment_url && (
                            <a href={sub.attachment_url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 10, color: "#1E40AF", textDecoration: "none", display: "flex", alignItems: "center", gap: 2, fontWeight: 600, marginLeft: "auto" }}>
                              <span>📎</span><span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.attachment_name || "Quotation"}</span>
                            </a>
                          )}
                        </div>
                      );
                    })()}
                    {/* Row 3: scorecard chips (Submitted only) / status badge (non-submitted) */}
                    {v.participation_status && v.participation_status !== "Submitted" ? (
                      <div style={{ marginTop: 4, padding: "5px 10px", borderRadius: 6, background: "#FEF3C7", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#92400E", letterSpacing: "0.04em" }}>
                        {v.participation_status === "Non-Responsive" ? "⚠ Non-Responsive" : v.participation_status === "Declined" ? "✕ Declined" : "✕ Disqualified"}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                          {vc.tot > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.textPri, fontFamily: "monospace" }}>₱ {fmtPeso(vc.tot)}</span>
                          )}
                          {vc.ptLabel && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: C.coralLight, color: C.coral, whiteSpace: "nowrap" }}>{vc.ptLabel}</span>
                          )}
                          {v.completion_date && (
                            <span style={{ fontSize: 9, color: C.textTer, whiteSpace: "nowrap" }}>📅 {fmtShort(v.completion_date)}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                          {sKeys.map(sk => (
                            <span key={sk} title={`${sLabels[sk]}: ${vc.sectionDone[sk] ? "done" : "incomplete"}`}
                              style={{ width: 14, height: 14, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8,
                                background: vc.sectionDone[sk] ? C.coral : "#E5E7EB",
                                color: vc.sectionDone[sk] ? "white" : C.textTer, fontWeight: 700, flexShrink: 0 }}>
                              {vc.sectionDone[sk] ? "✓" : "·"}
                            </span>
                          ))}
                          <span style={{ fontSize: 9, color: C.textTer, marginLeft: 3 }}>
                            {sKeys.filter(sk => vc.sectionDone[sk]).length}/{sKeys.length} done
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>}

          {/* ══ TAB 1: DETAILED PROPOSAL ══ */}
          {activeTab === "detail" && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* ── 1. Cost Proposals ── */}
          {(() => {
            // Shared renderer for a single proposal card (used in both layouts)
            const renderProposalCard = (v, prop, pi) => {
              const { subtotal, taxes, total } = computeProposalTotals(prop);
              return (
                <div key={prop.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
                  <div style={{ background: C.offWhite, padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec }}>Proposal {pi + 1}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="date" value={prop.date} onChange={e => updateProposal(v.slot, prop.id, "date", e.target.value)}
                        style={{ ...styles.input, margin: 0, padding: "3px 8px", fontSize: 11, width: 136 }} />
                      <button onClick={() => removeProposal(v.slot, prop.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 52px 80px 20px", gap: 4, marginBottom: 5 }}>
                      {["Description","Qty","Unit","Unit Price",""].map(h => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase" }}>{h}</div>
                      ))}
                    </div>
                    {prop.items.map(item => (
                      <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 44px 52px 80px 20px", gap: 4, marginBottom: 4, alignItems: "center" }}>
                        <input placeholder="Description" value={item.description} onChange={e => updateItem(v.slot, prop.id, item.id, "description", e.target.value)}
                          style={{ ...styles.input, margin: 0, padding: "4px 7px", fontSize: 11 }} />
                        <input placeholder="Qty" type="number" value={item.qty} onChange={e => updateItem(v.slot, prop.id, item.id, "qty", e.target.value)}
                          style={{ ...styles.input, margin: 0, padding: "4px 5px", fontSize: 11, textAlign: "right" }} />
                        <input placeholder="Unit" value={item.unit} onChange={e => updateItem(v.slot, prop.id, item.id, "unit", e.target.value)}
                          style={{ ...styles.input, margin: 0, padding: "4px 5px", fontSize: 11 }} />
                        <input placeholder="0.00" type="number" value={item.unit_price} onChange={e => updateItem(v.slot, prop.id, item.id, "unit_price", e.target.value)}
                          style={{ ...styles.input, margin: 0, padding: "4px 6px", fontSize: 11, textAlign: "right" }} />
                        <button onClick={() => removeItem(v.slot, prop.id, item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 14, padding: 0 }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => addItem(v.slot, prop.id)} style={{ fontSize: 11, color: C.coral, background: "none", border: "none", cursor: "pointer", padding: "2px 0", marginTop: 2 }}>+ Add item</button>
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSec, marginBottom: 8 }}>
                        <span>Subtotal</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>₱ {fmtPeso(subtotal)}</span>
                      </div>
                      {(() => {
                        const vatTax = taxes[0];
                        if (!vatTax) return null;
                        const isNonVat = !vatTax.rate || parseFloat(vatTax.rate) === 0;
                        return (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: C.textSec, marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontWeight: 600 }}>VAT</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 2, border: `1px solid ${C.border}`, borderRadius: 5, background: C.offWhite, padding: "2px 6px" }}>
                                <input type="number" min="0" max="100" value={vatTax.rate}
                                  onChange={e => updateTax(v.slot, prop.id, vatTax.id, "rate", e.target.value)}
                                  style={{ border: "none", background: "none", width: 28, fontSize: 11, textAlign: "right", outline: "none", color: C.textPri }} />
                                <span style={{ fontSize: 10, color: C.textTer }}>%</span>
                              </div>
                            </div>
                            {isNonVat
                              ? <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>Non-VAT</span>
                              : <span style={{ fontFamily: "monospace", fontWeight: 600, color: C.greenText }}>+ ₱ {fmtPeso(vatTax.computed)}</span>
                            }
                          </div>
                        );
                      })()}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                        <span style={{ color: C.textPri }}>Total</span>
                        <span style={{ fontFamily: "monospace", color: C.coral }}>₱ {fmtPeso(total)}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", marginBottom: 3 }}>Notes</div>
                      <textarea value={prop.notes} onChange={e => updateProposal(v.slot, prop.id, "notes", e.target.value)}
                        rows={2} placeholder="Optional notes…" style={{ ...styles.input, margin: 0, resize: "vertical", fontSize: 11 }} />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", marginBottom: 5 }}>Vendor Proposal Attachment</div>
                      {prop.attachment_url ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: C.offWhite, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 16 }}>📎</span>
                          <a href={prop.attachment_url} target="_blank" rel="noreferrer"
                            style={{ fontSize: 11, color: C.coral, fontWeight: 600, textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={prop.attachment_name}>{prop.attachment_name}</a>
                          <button onClick={() => removeProposalAttachment(v.slot, prop.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}
                            title="Remove attachment">×</button>
                        </div>
                      ) : (
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px dashed ${C.border}`, background: C.offWhite, cursor: "pointer", fontSize: 11, color: C.textSec, fontWeight: 600 }}>
                          <span>📎</span> Attach Vendor Proposal
                          <input type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.doc,.docx" style={{ display: "none" }}
                            onChange={e => { const f = e.target.files[0]; if (f) uploadProposalAttachment(v.slot, prop.id, f); e.target.value = ""; }} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            const vendorToolbar = (v) => (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 10 }}>
                {vendors.filter(ov => ov.slot !== v.slot && ov.proposals.some(p => p.items.length > 0)).map(ov => (
                  <button key={ov.slot} onClick={() => copyItemsTo(v.slot, ov.slot)}
                    style={{ background: C.offWhite, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 10, color: C.textSec, cursor: "pointer", fontWeight: 600 }}>
                    Copy V{vendors.indexOf(ov) + 1} items
                  </button>
                ))}
                <button onClick={() => addProposal(v.slot)} style={{ background: C.coral, color: "white", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ Add proposal</button>
              </div>
            );

            const anyMulti = vendors.some(v => v.proposals.length > 1);

            return (
              <SectionRow num={1} sKey="cost" icon="📋" title="Cost Proposals" subtitle="Bill of Quantities with unit prices and applicable taxes"
                summaryFn={(v, vi) => {
                  const vc = vComputed[vi];
                  if (!vc.sectionDone.cost) return <SummaryEmpty />;
                  return <><SummaryTag text={`₱ ${fmtPeso(vc.tot)}`} color={C.coral} /><SummaryTag text={`${v.proposals.length} proposal${v.proposals.length !== 1 ? "s" : ""}`} color="#6B7280" /></>;
                }} collapsed={collapsed} toggleSection={toggleSection} vendors={vendors} colGrid={colGrid}>
                {anyMulti ? (
                  <>
                    {/* Row 1: previous proposals summary (totals only) per vendor */}
                    {vendors.map((v, vi) => {
                      const prevProps = v.proposals.slice(0, -1);
                      return (
                        <VCell key={`prev-${v.slot}`} isLast={vi === vendors.length - 1} vi={vi}>
                          {v.participation_status && v.participation_status !== "Submitted" ? null : prevProps.length > 0 ? (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Previous Proposals</div>
                              {prevProps.map((prop, pi) => {
                                const { total } = computeProposalTotals(prop);
                                return (
                                  <div key={prop.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 5, background: C.offWhite }}>
                                    <span style={{ fontSize: 11, color: C.textSec }}>Proposal {pi + 1}{prop.date ? ` · ${prop.date}` : ""}</span>
                                    <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textTer, textDecoration: "line-through" }}>₱ {fmtPeso(total)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </VCell>
                      );
                    })}
                    {/* Full-width divider */}
                    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, padding: "6px 20px", background: C.offWhite, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.coral, textTransform: "uppercase", letterSpacing: "0.07em" }}>Latest Proposal</span>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                      <span style={{ fontSize: 10, color: C.textTer }}>used for payment terms &amp; bonds</span>
                    </div>
                    {/* Row 2: latest proposal per vendor, aligned */}
                    {vendors.map((v, vi) => {
                      const latestProp = v.proposals.at(-1);
                      const latestIdx = v.proposals.length - 1;
                      return (
                        <VCell key={`latest-${v.slot}`} isLast={vi === vendors.length - 1} vi={vi}>
                          {v.participation_status && v.participation_status !== "Submitted" ? (
                            <div style={{ textAlign: "center", padding: "32px 0", color: C.textTer, fontSize: 12, fontStyle: "italic" }}>— {v.participation_status} —</div>
                          ) : <>
                            {vendorToolbar(v)}
                            {!latestProp
                              ? <div style={{ textAlign: "center", padding: "24px 0", color: C.textTer, fontSize: 12, fontStyle: "italic" }}>No proposals yet.</div>
                              : renderProposalCard(v, latestProp, latestIdx)
                            }
                          </>}
                        </VCell>
                      );
                    })}
                  </>
                ) : (
                  // Single-proposal layout — unchanged
                  vendors.map((v, vi) => (
                    <VCell key={v.slot} isLast={vi === vendors.length - 1} vi={vi}>
                      {v.participation_status && v.participation_status !== "Submitted" ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: C.textTer, fontSize: 12, fontStyle: "italic" }}>— {v.participation_status} —</div>
                      ) : <>
                        {vendorToolbar(v)}
                        {v.proposals.length === 0 && (
                          <div style={{ textAlign: "center", padding: "24px 0", color: C.textTer, fontSize: 12, fontStyle: "italic" }}>No proposals yet.</div>
                        )}
                        {v.proposals.map((prop, pi) => renderProposalCard(v, prop, pi))}
                      </>}
                    </VCell>
                  ))
                )}
              </SectionRow>
            );
          })()}

          {/* ── 2. Payment Terms ── */}
          <SectionRow num={2} sKey="payment" icon="💳" title="Payment Terms" subtitle="Payment type drives the structure — amounts auto-calculate from the latest proposal total"
            summaryFn={(v, vi) => {
              const vc = vComputed[vi];
              if (!vc.ptLabel) return <SummaryEmpty />;
              return <>
                <SummaryTag text={vc.ptLabel} color="#2563EB" />
                {PT_HAS_DP.has(vc.ptt) && <SummaryTag text={`DP ${vc.ptd.dp_percent||20}%`} color={parseFloat(vc.ptd.dp_percent||20) > 30 ? C.amberText : "#7C3AED"} />}
                {PT_HAS_RETENTION.has(vc.ptt) && <SummaryTag text={`Ret ${vc.ptd.retention_percent||10}%`} color="#D97706" />}
              </>;
            }} collapsed={collapsed} toggleSection={toggleSection} vendors={vendors} colGrid={colGrid}>
            {vendors.map((v, vi) => {
              const ptd = v.payment_term_data || {};
              const ptt = v.payment_term_type;
              const hasDP  = PT_HAS_DP.has(ptt);
              const hasProg = PT_HAS_PROGRESS.has(ptt);
              const hasRet = PT_HAS_RETENTION.has(ptt);
              const isMilestone = PT_IS_MILESTONE.has(ptt);
              const latestProp = v.proposals[v.proposals.length - 1];
              const latestTotal = latestProp ? computeProposalTotals(latestProp).total : 0;
              const ptBreakdown = computePaymentBreakdown(ptt, ptd, latestTotal);

              // tiny label style
              const lbl = { fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 };
              // override row style
              const overridePill = { fontSize: 10, padding: "2px 8px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.offWhite, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: C.textSec, fontWeight: 600 };

              return (
                <VCell key={v.slot} isLast={vi === vendors.length - 1} vi={vi}>
                  {v.participation_status && v.participation_status !== "Submitted" ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: C.textTer, fontSize: 12, fontStyle: "italic" }}>— {v.participation_status} —</div>
                  ) : <>

                  {/* ── Payment Type ── */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={lbl}>Payment Type</div>
                    <select value={ptt} onChange={e => updateVendor(v.slot, "payment_term_type", e.target.value)}
                      style={{ ...styles.input, margin: 0, fontSize: 12 }}>
                      <option value="">Select type…</option>
                      {PAYMENT_TERM_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                    </select>
                  </div>

                  {!ptt && <div style={{ fontSize: 12, color: C.textTer, fontStyle: "italic" }}>Select a payment type to configure the structure.</div>}

                  {ptt && (<>

                    {/* ── Payment Structure ── */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textSec, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>Payment Structure</div>

                    {/* Downpayment */}
                    {hasDP && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ marginBottom: 3 }}>
                          <div style={lbl}>Downpayment % <span style={{ color: C.textTer, fontWeight: 400, textTransform: "none" }}>(standard max: 30%)</span></div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                          <input type="number" min="0" max="100" placeholder="20" value={ptd.dp_percent}
                            onChange={e => updatePtData(v.slot, "dp_percent", e.target.value)}
                            style={{ ...styles.input, margin: 0, fontSize: 12, width: 72, borderColor: parseFloat(ptd.dp_percent||0) > 30 ? C.amberText : undefined }} />
                          <span style={{ fontSize: 11, color: C.textTer }}>%</span>
                          {latestTotal > 0 && <span style={{ fontSize: 11, fontFamily: "monospace", color: "#2563EB", fontWeight: 700 }}>= ₱ {fmtPeso(latestTotal * parseFloat(ptd.dp_percent||0)/100)}</span>}
                        </div>
                        {parseFloat(ptd.dp_percent || 0) > 30 && (
                          <div style={{ padding: "6px 10px", background: C.amberBg, borderRadius: 6, border: `1px solid ${C.amberText}40`, marginBottom: 4 }}>
                            <div style={{ fontSize: 11, color: C.amberText, fontWeight: 700, marginBottom: 4 }}>⚠ Exceeds 30% standard maximum — justification required</div>
                            <input placeholder="Reason for non-standard downpayment…" value={ptd.dp_override_remarks} onChange={e => updatePtData(v.slot, "dp_override_remarks", e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                          </div>
                        )}
                        {/* Recoupable clause */}
                        <div style={{ marginTop: 8, padding: "8px 10px", background: C.surface, borderRadius: 7, border: `1px solid ${C.border}` }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                            <input type="checkbox" checked={ptd.dp_recoupable !== false}
                              onChange={e => updatePtData(v.slot, "dp_recoupable", e.target.checked)}
                              style={{ cursor: "pointer", accentColor: C.coral, width: 13, height: 13 }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.textPri }}>Recoupable per progress billing</span>
                          </label>
                          {ptd.dp_recoupable !== false && (
                            <div style={{ fontSize: 11, color: C.tealText, marginTop: 5, padding: "4px 8px", background: C.tealBg, borderRadius: 5 }}>
                              Deduct {ptd.dp_percent || 20}% from each progress billing until fully recouped
                            </div>
                          )}
                          {ptd.dp_recoupable === false && (
                            <div style={{ fontSize: 11, color: C.amberText, marginTop: 5, padding: "4px 8px", background: C.amberBg, borderRadius: 5 }}>
                              Non-recoupable — downpayment will not be deducted from progress billings
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Progress Billing */}
                    {hasProg && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={lbl}>Progress Billing</div>
                        <select value={ptd.progress_freq} onChange={e => updatePtData(v.slot, "progress_freq", e.target.value)}
                          style={{ ...styles.input, margin: 0, fontSize: 12, marginBottom: 6 }}>
                          {PROGRESS_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        {/* Estimated invoice count + alignment warning */}
                        {ptd.work_duration && (() => {
                          const days = parseFloat(ptd.work_duration || 0);
                          const isWorking = ptd.work_duration_type === "working_days";
                          const calDays = isWorking ? days * (7 / 5) : days;
                          const daysPerInvoice = ptd.progress_freq === "weekly_poc" ? 7 : 30;
                          const estimated = calDays / daysPerInvoice;
                          const count = Math.floor(estimated);
                          const tooFew = count < 1;
                          return (
                            <div style={{ padding: "6px 10px", borderRadius: 6, background: tooFew ? C.amberBg : C.tealBg, border: `1px solid ${tooFew ? C.amberText + "40" : C.tealText + "40"}` }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: tooFew ? C.amberText : C.tealText }}>
                                {tooFew
                                  ? `⚠ Work duration (${days} ${isWorking ? "WD" : "CD"}) is shorter than one ${ptd.progress_freq === "weekly_poc" ? "week" : "month"} — consider a different billing frequency`
                                  : `~${count} progress invoice${count !== 1 ? "s" : ""} expected over ${days} ${isWorking ? "working" : "calendar"} days`}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Retention */}
                    {hasRet && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={lbl}>Retention %</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                          <input type="number" min="0" max="100" placeholder="10" value={ptd.retention_percent}
                            onChange={e => updatePtData(v.slot, "retention_percent", e.target.value)}
                            style={{ ...styles.input, margin: 0, fontSize: 12, width: 72 }} />
                          <span style={{ fontSize: 11, color: C.textTer }}>%</span>
                          {latestTotal > 0 && <span style={{ fontSize: 11, fontFamily: "monospace", color: "#D97706", fontWeight: 700 }}>= ₱ {fmtPeso(latestTotal * parseFloat(ptd.retention_percent||0)/100)}</span>}
                        </div>
                        {/* Deduction timing — only meaningful for progress types */}
                        {hasProg && (
                          <div style={{ padding: "8px 10px", background: C.offWhite, borderRadius: 7, border: `1px solid ${C.border}` }}>
                            <div style={{ ...lbl, marginBottom: 6 }}>Retention Deduction Timing</div>
                            {[
                              { val: "each_invoice", label: "Withhold from each progress invoice" },
                              { val: "final_invoice", label: "Deduct on final invoice only" },
                            ].map(opt => (
                              <label key={opt.val} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, cursor: "pointer" }}>
                                <input type="radio" name={`ret_deduct_${v.slot}`} value={opt.val}
                                  checked={(ptd.retention_deduction_mode || "each_invoice") === opt.val}
                                  onChange={() => updatePtData(v.slot, "retention_deduction_mode", opt.val)}
                                  style={{ accentColor: C.coral }} />
                                <span style={{ fontSize: 11, color: C.textSec }}>{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Milestones */}
                    {isMilestone && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={lbl}>Milestones</div>
                          <button onClick={() => addMilestone(v.slot)} style={{ fontSize: 11, color: C.coral, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
                        </div>
                        {(ptd.milestones || []).map((m, mi) => (
                          <div key={m.id} style={{ display: "flex", gap: 5, marginBottom: 5, alignItems: "center" }}>
                            <input placeholder={`Milestone ${mi + 1}`} value={m.label} onChange={e => updateMilestone(v.slot, m.id, "label", e.target.value)}
                              style={{ ...styles.input, margin: 0, flex: 1, fontSize: 11, padding: "4px 7px" }} />
                            <input type="number" placeholder="%" min="0" max="100" value={m.percent} onChange={e => updateMilestone(v.slot, m.id, "percent", e.target.value)}
                              style={{ ...styles.input, margin: 0, width: 48, fontSize: 11, padding: "4px 5px", textAlign: "right" }} />
                            <span style={{ fontSize: 11, color: C.textTer }}>%</span>
                            <button onClick={() => removeMilestone(v.slot, m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textTer, fontSize: 14, padding: 0 }}>×</button>
                          </div>
                        ))}

                        {/* Retention toggle */}
                        <div style={{ marginTop: 8, padding: "10px 12px", background: ptd.milestone_has_retention ? "#FEF3C7" : C.offWhite, borderRadius: 8, border: `1px solid ${ptd.milestone_has_retention ? "#FCD34D" : C.border}` }}>
                          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", marginBottom: ptd.milestone_has_retention ? 10 : 0 }}>
                            <input type="checkbox" checked={!!ptd.milestone_has_retention} onChange={e => updatePtData(v.slot, "milestone_has_retention", e.target.checked)} style={{ accentColor: C.coral }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.textPri }}>Apply Retention</span>
                          </label>
                          {ptd.milestone_has_retention && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {/* Retention % */}
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input type="number" min="0" max="100" placeholder="10" value={ptd.retention_percent}
                                  onChange={e => updatePtData(v.slot, "retention_percent", e.target.value)}
                                  style={{ ...styles.input, margin: 0, width: 60, fontSize: 12 }} />
                                <span style={{ fontSize: 11, color: C.textTer }}>% retention</span>
                                {latestTotal > 0 && <span style={{ fontSize: 11, fontFamily: "monospace", color: "#D97706", fontWeight: 700 }}>= ₱ {fmtPeso(latestTotal * parseFloat(ptd.retention_percent||10)/100)}</span>}
                              </div>
                              {/* Retention mode */}
                              <div>
                                <div style={lbl}>Deduction timing</div>
                                {[{ val: "each", label: "Deduct from each milestone" }, { val: "final", label: "Deduct on final milestone only" }].map(opt => (
                                  <label key={opt.val} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, cursor: "pointer" }}>
                                    <input type="radio" name={`ret_mode_${v.slot}`} value={opt.val}
                                      checked={(ptd.milestone_retention_mode || "each") === opt.val}
                                      onChange={() => updatePtData(v.slot, "milestone_retention_mode", opt.val)}
                                      style={{ accentColor: C.coral }} />
                                    <span style={{ fontSize: 11, color: C.textSec }}>{opt.label}</span>
                                  </label>
                                ))}
                              </div>
                              {/* Warranty period */}
                              <div>
                                <div style={lbl}>Warranty / DLP Period</div>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <input type="number" min="1" placeholder="12" value={ptd.warranty_period}
                                    onChange={e => updatePtData(v.slot, "warranty_period", e.target.value)}
                                    style={{ ...styles.input, margin: 0, width: 60, fontSize: 12 }} />
                                  <span style={{ fontSize: 11, color: C.textTer }}>months — retention released after warranty ends</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Payment Breakdown */}
                    {ptBreakdown.length > 0 && (
                      <div style={{ background: C.offWhite, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 8 }}>Breakdown</div>
                        {ptBreakdown.map((row, ri) => (
                          <div key={ri} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 3, background: row.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: C.textSec }}>{row.label}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: C.textPri }}>
                              {latestTotal > 0 ? `₱ ${fmtPeso(row.amount)}` : `—`}
                            </span>
                          </div>
                        ))}
                        {latestTotal > 0 && (() => {
                          const sum = ptBreakdown.reduce((s, r) => s + r.amount, 0);
                          const ok = Math.abs(sum - latestTotal) <= 1;
                          return <div style={{ marginTop: 6, padding: "4px 8px", background: ok?"#D1FAE5":"#FEF3C7", borderRadius: 6, fontSize: 10, color: ok?C.greenText:C.amberText, fontWeight: 700 }}>{ok?"✓ Totals match":`⚠ ₱${fmtPeso(sum)} ≠ ₱${fmtPeso(latestTotal)}`}</div>;
                        })()}
                        {latestTotal === 0 && <div style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>Enter unit prices to see ₱ amounts.</div>}

                        {/* Tax */}
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 8 }}>Tax</div>
                          {/* VAT — auto from proposal */}
                          {(() => {
                            const proposalTotals = latestProp ? computeProposalTotals(latestProp) : null;
                            const vatTax = proposalTotals?.taxes.find(t => !t.isDeduction);
                            if (!vatTax) return null;
                            const isNonVat = !vatTax.rate || parseFloat(vatTax.rate) === 0;
                            return (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "5px 8px", background: C.offWhite, borderRadius: 6 }}>
                                <span style={{ fontSize: 11, color: C.textPri }}>
                                  <span style={{ fontWeight: 600 }}>VAT ({vatTax.rate || 0}%)</span>
                                  <span style={{ fontSize: 10, color: C.textTer }}> — from proposal</span>
                                </span>
                                <span style={{ fontSize: 11, fontFamily: "monospace", color: isNonVat ? C.textTer : C.greenText, fontStyle: isNonVat ? "italic" : "normal" }}>
                                  {isNonVat ? "Non-VAT" : latestTotal > 0 ? `+ ₱ ${fmtPeso(vatTax.computed)}` : "—"}
                                </span>
                              </div>
                            );
                          })()}
                          {/* Withholding Tax (EWT) — payment deduction, not part of contract price */}
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: C.textPri, fontWeight: 600 }}>Withholding Tax (EWT)</span>
                            <input type="number" min="0" max="100" placeholder="2" value={ptd.withholding_tax_percent}
                              onChange={e => updatePtData(v.slot, "withholding_tax_percent", e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 11, width: 50, padding: "2px 6px" }} />
                            <span style={{ fontSize: 11, color: C.textTer }}>%</span>
                            {latestTotal > 0 && parseFloat(ptd.withholding_tax_percent || 0) > 0 && (
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: C.redText, marginLeft: "auto" }}>
                                − ₱ {fmtPeso(latestTotal * parseFloat(ptd.withholding_tax_percent || 0) / 100)}
                              </span>
                            )}
                          </div>
                          {latestTotal > 0 && parseFloat(ptd.withholding_tax_percent || 0) > 0 && (
                            <div style={{ padding: "6px 8px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: C.greenText }}>
                                <span>Net Cash Received by Vendor</span>
                                <span style={{ fontFamily: "monospace" }}>₱ {fmtPeso(latestTotal - latestTotal * parseFloat(ptd.withholding_tax_percent || 0) / 100)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </>)}
                  </>}
                </VCell>
              );
            })}
          </SectionRow>

          {/* ── 3. Right to Bill & Release ── */}
          <SectionRow num={3} sKey="rtb" icon="🕐" title="Right to Bill & Release" subtitle="Controls when the vendor can submit each invoice and when PH1 must pay — deviations need justification"
            summaryFn={(v, vi) => {
              const vc = vComputed[vi];
              if (!vc.ptt) return <SummaryEmpty />;
              const ptd = v.payment_term_data || {};
              const parts = [];
              if (PT_HAS_DP.has(vc.ptt))          parts.push(`DP: ${ptd.dp_release_days||15}d`);
              if (PT_HAS_PROGRESS.has(vc.ptt))     parts.push(`Prog: ${ptd.progress_release_days||30}d`);
              if (PT_HAS_RETENTION.has(vc.ptt))    parts.push(`Ret: ${ptd.retention_billing_months||12}mo+${ptd.retention_release_days||30}d`);
              if (PT_HAS_COMPLETION.has(vc.ptt))   parts.push(`Completion: ${ptd.completion_release_days||30}d`);
              if (PT_IS_MILESTONE.has(vc.ptt))     parts.push(`Milestone: ${ptd.milestone_release_days||30}d`);
              const hasNonStd = (PT_HAS_DP.has(vc.ptt) && parseInt(ptd.dp_release_days||15) !== 15) ||
                                (PT_HAS_PROGRESS.has(vc.ptt) && parseInt(ptd.progress_release_days||30) !== 30) ||
                                (PT_HAS_RETENTION.has(vc.ptt) && (parseInt(ptd.retention_billing_months||12) !== 12 || parseInt(ptd.retention_release_days||30) !== 30)) ||
                                (PT_HAS_COMPLETION.has(vc.ptt) && parseInt(ptd.completion_release_days||30) !== 30) ||
                                (PT_IS_MILESTONE.has(vc.ptt) && parseInt(ptd.milestone_release_days||30) !== 30);
              return <>
                {parts.map((p, i) => <SummaryTag key={i} text={p} color="#6B7280" />)}
                {hasNonStd && <SummaryTag text="⚠ Non-standard" color={C.amberText} />}
              </>;
            }} collapsed={collapsed} toggleSection={toggleSection} vendors={vendors} colGrid={colGrid}>
            {vendors.map((v, vi) => {
              const ptd = v.payment_term_data || {};
              const ptt = v.payment_term_type;
              const hasDP   = PT_HAS_DP.has(ptt);
              const hasProg = PT_HAS_PROGRESS.has(ptt);
              const hasRet  = PT_HAS_RETENTION.has(ptt);
              const lbl = { fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 };

              return (
                <VCell key={v.slot} isLast={vi === vendors.length - 1} vi={vi}>
                  {v.participation_status && v.participation_status !== "Submitted" ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: C.textTer, fontSize: 12, fontStyle: "italic" }}>— {v.participation_status} —</div>
                  ) : <>
                  {!ptt && <div style={{ fontSize: 12, color: C.textTer, fontStyle: "italic" }}>Set payment terms first.</div>}
                  {ptt && (<>

                    {/* Release day helper — shows amber note + remarks when value differs from standard */}
                    {hasDP && (() => {
                      const val = parseInt(ptd.dp_release_days || 15);
                      const nonStd = val !== 15;
                      return (
                        <div style={{ marginBottom: 10, padding: "10px 12px", background: "#EFF6FF", borderRadius: 8, border: `1px solid ${nonStd ? C.amberText+"60" : "#BFDBFE"}` }}>
                          <div style={{ ...lbl, color: "#2563EB", marginBottom: 4 }}>Downpayment Release <span style={{ color: C.textTer, fontWeight: 400, textTransform: "none" }}>(standard: 15 days)</span></div>
                          <div style={{ fontSize: 11, color: C.textTer, fontStyle: "italic", marginBottom: 8 }}>Vendor eligible to submit after contract signing</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                            <input type="number" min="1" value={ptd.dp_release_days} onChange={e => updatePtData(v.slot, "dp_release_days", e.target.value)}
                              style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0, borderColor: nonStd ? C.amberText : undefined }} />
                            <span style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>days from complete submission of billing requirements and reconciled amount</span>
                          </div>
                          {nonStd && <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: C.amberText, fontWeight: 700, marginBottom: 4 }}>⚠ Non-standard ({val} days vs default 15) — justification required</div>
                            <input placeholder="Reason for deviation…" value={ptd.dp_release_remarks} onChange={e => updatePtData(v.slot, "dp_release_remarks", e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                          </div>}
                        </div>
                      );
                    })()}

                    {hasProg && (() => {
                      const val = parseInt(ptd.progress_release_days || 30);
                      const nonStd = val !== 30;
                      return (
                        <div style={{ marginBottom: 10, padding: "10px 12px", background: "#F0FDF4", borderRadius: 8, border: `1px solid ${nonStd ? C.amberText+"60" : "#BBF7D0"}` }}>
                          <div style={{ ...lbl, color: "#059669", marginBottom: 4 }}>Progress Payment Release <span style={{ color: C.textTer, fontWeight: 400, textTransform: "none" }}>(standard: 30 days)</span></div>
                          <div style={{ fontSize: 11, color: C.textTer, fontStyle: "italic", marginBottom: 8 }}>
                            Vendor submits per billing frequency ({PROGRESS_FREQUENCIES.find(f => f.value === ptd.progress_freq)?.label || "Monthly (POC)"})
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                            <input type="number" min="1" value={ptd.progress_release_days} onChange={e => updatePtData(v.slot, "progress_release_days", e.target.value)}
                              style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0, borderColor: nonStd ? C.amberText : undefined }} />
                            <span style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>days from complete submission of billing requirements and reconciled amount</span>
                          </div>
                          {nonStd && <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: C.amberText, fontWeight: 700, marginBottom: 4 }}>⚠ Non-standard ({val} days vs default 30) — justification required</div>
                            <input placeholder="Reason for deviation…" value={ptd.progress_release_remarks} onChange={e => updatePtData(v.slot, "progress_release_remarks", e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                          </div>}
                        </div>
                      );
                    })()}

                    {hasRet && (() => {
                      const billingVal = parseInt(ptd.retention_billing_months || 12);
                      const releaseVal = parseInt(ptd.retention_release_days || 30);
                      const billingNonStd = billingVal !== 12;
                      const releaseNonStd = releaseVal !== 30;
                      const earlyBilling = ptd.warranty_period && billingVal < parseInt(ptd.warranty_period);
                      return (
                        <div style={{ marginBottom: 10, padding: "10px 12px", background: "#FFFBEB", borderRadius: 8, border: `1px solid ${billingNonStd || releaseNonStd ? C.amberText+"60" : "#FDE68A"}` }}>
                          <div style={{ ...lbl, color: "#D97706", marginBottom: 4 }}>Retention Release <span style={{ color: C.textTer, fontWeight: 400, textTransform: "none" }}>(standard: 12 mo + 30 days)</span></div>
                          <div style={{ fontSize: 11, color: C.textTer, fontStyle: "italic", marginBottom: 8 }}>Vendor eligible to submit after warranty / DLP period</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                            <input type="number" min="0" value={ptd.retention_billing_months} onChange={e => updatePtData(v.slot, "retention_billing_months", e.target.value)}
                              style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0,
                                borderColor: earlyBilling || billingNonStd ? C.amberText : undefined }} />
                            <span style={{ fontSize: 11, color: C.textSec }}>calendar month(s) post-completion before vendor may submit</span>
                          </div>
                          {earlyBilling && (
                            <div style={{ fontSize: 11, color: C.amberText, fontWeight: 600, padding: "5px 9px", background: C.amberBg, borderRadius: 6, border: `1px solid ${C.amberText}40`, marginBottom: 6 }}>
                              ⚠ Right to Bill ({billingVal} mo) is earlier than warranty period ({ptd.warranty_period} mo) — vendor claims retention before warranty expires.
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 6 }}>
                            <input type="number" min="1" value={ptd.retention_release_days} onChange={e => updatePtData(v.slot, "retention_release_days", e.target.value)}
                              style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0, borderColor: releaseNonStd ? C.amberText : undefined }} />
                            <span style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>days from complete submission of billing requirements and reconciled amount</span>
                          </div>
                          {(billingNonStd || releaseNonStd) && <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: C.amberText, fontWeight: 700, marginBottom: 4 }}>⚠ Non-standard — justification required</div>
                            <input placeholder="Reason for deviation…" value={ptd.retention_billing_remarks} onChange={e => updatePtData(v.slot, "retention_billing_remarks", e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                          </div>}
                        </div>
                      );
                    })()}

                    {PT_HAS_COMPLETION.has(ptt) && (() => {
                      const val = parseInt(ptd.completion_release_days || 30);
                      const nonStd = val !== 30;
                      return (
                        <div style={{ marginBottom: 10, padding: "10px 12px", background: "#F0FDF4", borderRadius: 8, border: `1px solid ${nonStd ? C.amberText+"60" : "#BBF7D0"}` }}>
                          <div style={{ ...lbl, color: "#059669", marginBottom: 4 }}>Completion Payment Release <span style={{ color: C.textTer, fontWeight: 400, textTransform: "none" }}>(standard: 30 days)</span></div>
                          <div style={{ fontSize: 11, color: C.textTer, fontStyle: "italic", marginBottom: 8 }}>Vendor eligible to submit after final acceptance of completed works</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                            <input type="number" min="1" value={ptd.completion_release_days} onChange={e => updatePtData(v.slot, "completion_release_days", e.target.value)}
                              style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0, borderColor: nonStd ? C.amberText : undefined }} />
                            <span style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>days from complete submission of billing requirements and reconciled amount</span>
                          </div>
                          {nonStd && <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: C.amberText, fontWeight: 700, marginBottom: 4 }}>⚠ Non-standard ({val} days vs default 30) — justification required</div>
                            <input placeholder="Reason for deviation…" value={ptd.completion_release_remarks} onChange={e => updatePtData(v.slot, "completion_release_remarks", e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                          </div>}
                        </div>
                      );
                    })()}

                    {PT_IS_MILESTONE.has(ptt) && (() => {
                      const val = parseInt(ptd.milestone_release_days || 30);
                      const nonStd = val !== 30;
                      return (
                        <div style={{ marginBottom: 10, padding: "10px 12px", background: "#F5F3FF", borderRadius: 8, border: `1px solid ${nonStd ? C.amberText+"60" : "#DDD6FE"}` }}>
                          <div style={{ ...lbl, color: "#7C3AED", marginBottom: 4 }}>Milestone Payment Release <span style={{ color: C.textTer, fontWeight: 400, textTransform: "none" }}>(standard: 30 days)</span></div>
                          <div style={{ fontSize: 11, color: C.textTer, fontStyle: "italic", marginBottom: 8 }}>Vendor eligible to submit after each milestone is approved and signed off</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                            <input type="number" min="1" value={ptd.milestone_release_days} onChange={e => updatePtData(v.slot, "milestone_release_days", e.target.value)}
                              style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0, borderColor: nonStd ? C.amberText : undefined }} />
                            <span style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>days from complete submission of billing requirements and reconciled amount</span>
                          </div>
                          {nonStd && <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: C.amberText, fontWeight: 700, marginBottom: 4 }}>⚠ Non-standard ({val} days vs default 30) — justification required</div>
                            <input placeholder="Reason for deviation…" value={ptd.milestone_release_remarks} onChange={e => updatePtData(v.slot, "milestone_release_remarks", e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                          </div>}
                        </div>
                      );
                    })()}

                    {!hasDP && !hasProg && !hasRet && !PT_HAS_COMPLETION.has(ptt) && !PT_IS_MILESTONE.has(ptt) && (
                      <div style={{ fontSize: 12, color: C.textTer, fontStyle: "italic" }}>No release schedule applicable for this payment type.</div>
                    )}

                  </>)}
                  </>}
                </VCell>
              );
            })}
          </SectionRow>

          {/* ── 4. Bond Requirements ── */}
          <SectionRow num={4} sKey="bonds" icon="🔒" title="Bond Requirements" subtitle="Auto-triggered by payment structure — override amounts with documented justification"
            summaryFn={(v, vi) => {
              const vc = vComputed[vi];
              if (!vc.ptt) return <SummaryEmpty />;
              const ptd = v.payment_term_data || {};
              if (vc.ptt === "full_turnkey") return <SummaryTag text="No bonds required" color="#6B7280" />;
              const bonds = [];
              if (PT_HAS_DP.has(vc.ptt))        bonds.push({ label: "Surety", override: ptd.surety_bond_override, color: "#2563EB" });
              if (PT_HAS_PROGRESS.has(vc.ptt))   bonds.push({ label: "Perf", override: ptd.performance_bond_override, color: "#059669" });
              if (PT_HAS_RETENTION.has(vc.ptt))  bonds.push({ label: "Warranty", override: ptd.warranty_bond_override, color: "#D97706" });
              return bonds.length === 0
                ? <SummaryEmpty />
                : <>{bonds.map(b => <SummaryTag key={b.label} text={`${b.label}${b.override ? " ⚠" : ""}`} color={b.color} />)}</>;
            }} collapsed={collapsed} toggleSection={toggleSection} vendors={vendors} colGrid={colGrid}>

            {/* Single full-width child — cross-vendor bond rows aligned to colGrid */}
            {(() => {
              const BOND_RELEASE_OPTIONS = ["Upon project handover", "Upon final payment", "Upon warranty expiry", "Upon mutual agreement"];
              const rowBorder = `1px solid ${C.border}`;
              const colDivider = "2px solid #E5E7EB";
              const colTint = (vi) => vi % 2 === 1 ? "#F9FAFB" : "white";

              const standardBondDefs = [
                { key: "surety",      label: "Surety / Advance Payment",  color: "#2563EB",
                  triggered: (ptt)         => PT_HAS_DP.has(ptt),
                  rate:      (ptt, ptd)    => `${ptd.dp_percent||20}% (= DP%)`,
                  autoAmt:   (ptt, ptd, T) => autoBondAmounts(ptt, ptd, T).surety,
                  overrideKey: "surety_bond_override", overrideAmtKey: "surety_bond_override_amount", remarksKey: "surety_bond_remarks", releaseKey: "surety_bond_release" },
                { key: "performance", label: "Performance Bond",          color: "#059669",
                  triggered: (ptt)         => PT_HAS_PROGRESS.has(ptt),
                  pctKey: "performance_bond_percent", pctDefault: "30",
                  autoAmt:   (ptt, ptd, T) => autoBondAmounts(ptt, ptd, T).performance,
                  overrideKey: "performance_bond_override", overrideAmtKey: "performance_bond_override_amount", remarksKey: "performance_bond_remarks", releaseKey: "performance_bond_release" },
                { key: "warranty",    label: "Warranty / Guarantee Bond", color: "#D97706",
                  triggered: (ptt)         => PT_HAS_RETENTION.has(ptt),
                  rate:      (ptt, ptd)    => `${ptd.retention_percent||10}% (= Retention%)`,
                  autoAmt:   (ptt, ptd, T) => autoBondAmounts(ptt, ptd, T).warranty,
                  overrideKey: "warranty_bond_override", overrideAmtKey: "warranty_bond_override_amount", remarksKey: "warranty_bond_remarks", releaseKey: "warranty_bond_release" },
              ];

              const milestoneBondDefs = [
                { key: "ms_surety",      label: "Surety Bond",              color: "#2563EB", reqKey: "milestone_surety_required",     amtKey: "milestone_surety_amount",     remKey: "milestone_surety_remarks" },
                { key: "ms_performance", label: "Performance Bond",         color: "#059669", reqKey: "milestone_performance_required", amtKey: "milestone_performance_amount", remKey: "milestone_performance_remarks" },
                { key: "ms_warranty",    label: "Warranty / Guarantee Bond",color: "#D97706", reqKey: "milestone_warranty_required",    amtKey: "milestone_warranty_amount",    remKey: "milestone_warranty_remarks",
                  autoTriggered: (ptd) => ptd.milestone_has_retention,
                  autoAmt: (ptd, T) => autoBondAmounts("milestone", ptd, T).warranty },
              ];

              const hasStandard  = vendors.some(v => { const p = v.payment_term_type; return p && p !== "full_turnkey" && !PT_IS_MILESTONE.has(p); });
              const hasMilestone = vendors.some(v => PT_IS_MILESTONE.has(v.payment_term_type));

              /* Plain function — NOT a React component, so no unmount/remount on re-render */
              const renderBondVendorRow = (b, isMil) => (
                <div style={{ display: "grid", gridTemplateColumns: colGrid, borderBottom: rowBorder }}>
                  {vendors.map((v, vi) => {
                    const ptd = v.payment_term_data || {};
                    const ptt = v.payment_term_type;
                    const latestProp  = v.proposals[v.proposals.length - 1];
                    const latestTotal = latestProp ? computeProposalTotals(latestProp).total : 0;

                    if (isMil) {
                      const isMS       = PT_IS_MILESTONE.has(ptt);
                      const isAutoTrig = b.autoTriggered && b.autoTriggered(ptd);
                      const noWarranty = b.key === "ms_warranty" && !isAutoTrig && !ptd[b.reqKey] && (ptd.milestones || []).length > 0;
                      return (
                        <div key={v.slot} style={{ padding: "12px 16px", borderLeft: vi > 0 ? colDivider : "none", background: colTint(vi) }}>
                          {!isMS ? <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>—</span>
                          : isAutoTrig ? (
                            <div>
                              <div style={{ fontSize: 10, color: C.textTer, marginBottom: 4 }}>{ptd.retention_percent || 10}% of Contract — auto from retention</div>
                              <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: C.textPri, marginBottom: 6 }}>
                                {latestTotal > 0 ? `₱ ${fmtPeso(b.autoAmt(ptd, latestTotal))}` : "—"}
                              </div>
                              <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                                <input type="checkbox" checked={!!ptd.warranty_bond_override} onChange={e => updatePtData(v.slot, "warranty_bond_override", e.target.checked)} style={{ accentColor: C.coral }} />
                                <span style={{ fontSize: 10, color: C.textSec }}>Override amount</span>
                              </label>
                              {ptd.warranty_bond_override && (
                                <div style={{ marginTop: 6, padding: "6px 8px", background: "#FEF3C7", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                  <input type="number" placeholder="Override amount" value={ptd.warranty_bond_override_amount} onChange={e => updatePtData(v.slot, "warranty_bond_override_amount", e.target.value)} style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                                  <input placeholder="Justification…" value={ptd.warranty_bond_remarks} onChange={e => updatePtData(v.slot, "warranty_bond_remarks", e.target.value)} style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              {noWarranty && <div style={{ marginBottom: 6, padding: "5px 8px", background: C.amberBg, borderRadius: 6, fontSize: 10, color: C.amberText, fontWeight: 600 }}>⚠ No warranty coverage</div>}
                              <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer", marginBottom: ptd[b.reqKey] ? 6 : 0 }}>
                                <input type="checkbox" checked={!!ptd[b.reqKey]} onChange={e => updatePtData(v.slot, b.reqKey, e.target.checked)} style={{ accentColor: b.color }} />
                                <span style={{ fontSize: 11, color: C.textPri }}>Require</span>
                              </label>
                              {ptd[b.reqKey] && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <input type="number" placeholder="Amount" value={ptd[b.amtKey]} onChange={e => updatePtData(v.slot, b.amtKey, e.target.value)} style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                                  <input placeholder="Remarks…" value={ptd[b.remKey]} onChange={e => updatePtData(v.slot, b.remKey, e.target.value)} style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    /* Standard bond cell */
                    const triggered  = b.triggered(ptt);
                    const autoAmt    = triggered ? b.autoAmt(ptt, ptd, latestTotal) : 0;
                    const displayAmt = ptd[b.overrideKey] && ptd[b.overrideAmtKey] ? parseFloat(ptd[b.overrideAmtKey]) : autoAmt;
                    return (
                      <div key={v.slot} style={{ padding: "12px 16px", borderLeft: vi > 0 ? colDivider : "none", background: colTint(vi) }}>
                        {!ptt ? (
                          <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>—</span>
                        ) : v.participation_status && v.participation_status !== "Submitted" ? (
                          <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>{v.participation_status}</span>
                        ) : !triggered || ptt === "full_turnkey" ? (
                          <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>Not applicable</span>
                        ) : (
                          <>
                            {b.pctKey ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                                <input type="number" min="0" max="100" value={ptd[b.pctKey] ?? b.pctDefault}
                                  onChange={e => updatePtData(v.slot, b.pctKey, e.target.value)}
                                  style={{ ...styles.input, margin: 0, fontSize: 10, width: 46, padding: "2px 6px" }} />
                                <span style={{ fontSize: 10, color: C.textTer }}>% of contract</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 10, color: C.textTer, marginBottom: 6 }}>{b.rate(ptt, ptd)}</div>
                            )}
                            <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: ptd[b.overrideKey] ? C.amberText : C.textPri, marginBottom: 6 }}>
                              {latestTotal > 0 ? `₱ ${fmtPeso(displayAmt)}` : "—"}
                              {ptd[b.overrideKey] && <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4, color: C.amberText }}>⚠ override</span>}
                            </div>
                            <select value={ptd[b.releaseKey] || ""} onChange={e => updatePtData(v.slot, b.releaseKey, e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 10, padding: "3px 6px", marginBottom: 6, width: "100%" }}>
                              <option value="">Release trigger…</option>
                              {BOND_RELEASE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                              <input type="checkbox" checked={!!ptd[b.overrideKey]} onChange={e => updatePtData(v.slot, b.overrideKey, e.target.checked)} style={{ accentColor: C.coral }} />
                              <span style={{ fontSize: 10, color: C.textSec }}>Override amount</span>
                            </label>
                            {ptd[b.overrideKey] && (
                              <div style={{ marginTop: 6, padding: "6px 8px", background: "#FEF3C7", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                <input type="number" placeholder="Override amount" value={ptd[b.overrideAmtKey]} onChange={e => updatePtData(v.slot, b.overrideAmtKey, e.target.value)} style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                                <input placeholder="Justification…" value={ptd[b.remarksKey]} onChange={e => updatePtData(v.slot, b.remarksKey, e.target.value)} style={{ ...styles.input, margin: 0, fontSize: 11 }} />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );

              return (
                <div style={{ gridColumn: "1 / -1" }}>

                  {/* ── Standard bonds ── */}
                  {hasStandard && standardBondDefs.map((b, bi) => (
                    <div key={b.key}>
                      <div style={{ padding: "6px 16px", background: "#F8F9FA", borderBottom: rowBorder, borderTop: bi > 0 ? `2px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.textPri }}>{b.label}</span>
                      </div>
                      {renderBondVendorRow(b, false)}
                    </div>
                  ))}

                  {/* ── Milestone bonds ── */}
                  {hasMilestone && (
                    <div style={{ borderTop: hasStandard ? `2px solid ${C.border}` : "none" }}>
                      <div style={{ padding: "6px 16px", background: "#F5F3FF", borderBottom: rowBorder }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.04em" }}>Milestone Bonds (optional)</span>
                      </div>
                      {milestoneBondDefs.map((b, bi) => (
                        <div key={b.key}>
                          <div style={{ padding: "6px 16px", background: "#FAFAF9", borderBottom: rowBorder, borderTop: bi > 0 ? rowBorder : "none", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0, display: "inline-block" }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.textPri }}>{b.label}</span>
                          </div>
                          {renderBondVendorRow(b, true)}
                        </div>
                      ))}
                    </div>
                  )}

                  {!hasStandard && !hasMilestone && (
                    <div style={{ padding: "24px", textAlign: "center", color: C.textTer, fontSize: 12, fontStyle: "italic" }}>
                      Set payment terms to see bond requirements.
                    </div>
                  )}
                </div>
              );
            })()}
          </SectionRow>

          {/* ── 5. Timeline & Warranty ── */}
          <SectionRow num={5} sKey="timeline" icon="📅" title="Timeline & Warranty" subtitle="Commencement type and work duration determine the schedule — completion is checked against PR end date"
            summaryFn={(v, vi) => {
              const vc = vComputed[vi];
              const ptd = v.payment_term_data || {};
              if (!vc.sectionDone.timeline) return <SummaryEmpty />;
              const durType = ptd.work_duration_type === "working_days" ? "WD" : "CD";
              return <>
                <SummaryTag text={`${ptd.work_duration} ${durType}`} color="#059669" />
                {v.completion_date && <SummaryTag text={fmtShort(v.completion_date)} color="#6B7280" />}
                {ptd.warranty_period && <SummaryTag text={`${ptd.warranty_period}mo warranty`} color={parseInt(ptd.retention_billing_months || 12) < parseInt(ptd.warranty_period) ? C.amberText : "#7C3AED"} />}
              </>;
            }} collapsed={collapsed} toggleSection={toggleSection} vendors={vendors} colGrid={colGrid}>
            {vendors.map((v, vi) => {
              const ptd = v.payment_term_data || {};
              const cWarn = completionWarning(v);
              const lbl = { fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 };
              return (
                <VCell key={v.slot} isLast={vi === vendors.length - 1} vi={vi}>
                  {v.participation_status && v.participation_status !== "Submitted" ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: C.textTer, fontSize: 12, fontStyle: "italic" }}>— {v.participation_status} —</div>
                  ) : <>
                  {/* Commencement */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={lbl}>Commencement</div>
                    <select value={ptd.commencement_type} onChange={e => updatePtData(v.slot, "commencement_type", e.target.value)}
                      style={{ ...styles.input, margin: 0, fontSize: 12, marginBottom: 5 }}>
                      {COMMENCEMENT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                    </select>
                    {ptd.commencement_type === "exact_date" && (
                      <input type="date" value={v.commencement_date} onChange={e => updateVendor(v.slot, "commencement_date", e.target.value)}
                        style={{ ...styles.input, margin: 0, fontSize: 12 }} />
                    )}
                    {(ptd.commencement_type === "noa_ntp" || ptd.commencement_type === "receipt_dp") && (
                      <div style={{ marginTop: 6 }}>
                        {ptd.commencement_type === "receipt_dp" && (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: C.textSec }}>DP billing processing</span>
                            <input type="number" min="1" value={ptd.dp_processing_days}
                              onChange={e => updatePtData(v.slot, "dp_processing_days", e.target.value)}
                              style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: C.textSec }}>days</span>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: C.textSec }}>Commence within</span>
                          <input type="number" min="1" placeholder="—" value={ptd.commencement_days}
                            onChange={e => updatePtData(v.slot, "commencement_days", e.target.value)}
                            style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0,
                              borderColor: !ptd.commencement_days ? C.redText : undefined }} />
                          <span style={{ fontSize: 11, color: C.textSec }}>days</span>
                        </div>
                        {!ptd.commencement_days && (
                          <div style={{ fontSize: 10, color: C.redText, fontWeight: 600, marginTop: 4 }}>
                            ⚠ Required for contract — specify mobilization period
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Target / Schedule — toggled */}
                  {(() => {
                    const commReady = ptd.commencement_type === "exact_date"
                      ? !!v.commencement_date
                      : !!(ptd.commencement_days);
                    const mode = ptd.completion_mode || "end_date";
                    const durDays = parseInt(ptd.work_duration || 0);
                    const durLabel = `${durDays} ${ptd.work_duration_type === "working_days" ? "WD" : "CD"}`;

                    // feasibility — use shared helper; exact_date mode keeps its own inline check
                    const feasCheck = (mode === "work_duration" && pr?.end_date && ptd.work_duration) ? (() => {
                      if (ptd.commencement_type === "exact_date" && v.commencement_date) {
                        const calcEnd = new Date(v.commencement_date);
                        calcEnd.setDate(calcEnd.getDate() + durDays);
                        const calcEndStr = calcEnd.toISOString().slice(0, 10);
                        const ok = calcEndStr <= pr.end_date;
                        return { ok, msg: ok
                          ? `✓ Calculated completion: ${fmtShort(calcEndStr)} (${durLabel})`
                          : `⚠ Calculated completion: ${fmtShort(calcEndStr)} (${durLabel}) — exceeds PR work end date` };
                      }
                      // noa_ntp / receipt_dp — delegate to shared helper
                      const shared = computeTimelineFeasibility(v, pr);
                      if (shared) {
                        const txt = shared.ok
                          ? `✓ Days to Completion: ${shared.total} days (${shared.breakdown}) · Available: ${shared.avail} days`
                          : `⚠ Days to Completion: ${shared.total} days (${shared.breakdown}) · Available: ${shared.avail} days — may not be doable before PR end date`;
                        return { ok: shared.ok, msg: txt };
                      }
                      return null;
                    })() : null;

                    return (
                      <div style={{ marginBottom: 10, opacity: commReady ? 1 : 0.35, pointerEvents: commReady ? "auto" : "none", transition: "opacity 0.2s" }}>
                        {/* Toggle */}
                        <div style={{ display: "flex", gap: 0, marginBottom: 10, borderRadius: 7, overflow: "hidden", border: `1px solid ${C.border}`, width: "fit-content" }}>
                          {[{ val: "end_date", label: "End Date" }, { val: "work_duration", label: "Work Duration" }].map(opt => (
                            <button key={opt.val} onClick={() => updatePtData(v.slot, "completion_mode", opt.val)}
                              style={{ padding: "5px 14px", fontSize: 11, fontWeight: mode === opt.val ? 700 : 400, cursor: "pointer", border: "none",
                                background: mode === opt.val ? C.coral : C.offWhite, color: mode === opt.val ? "#fff" : C.textSec,
                                borderRight: opt.val === "end_date" ? `1px solid ${C.border}` : "none", transition: "all 0.15s" }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* End Date mode */}
                        {mode === "end_date" && (
                          <div>
                            <input type="date" value={v.completion_date} onChange={e => updateVendor(v.slot, "completion_date", e.target.value)}
                              style={{ ...styles.input, margin: 0, fontSize: 12, borderColor: cWarn ? C.redText : undefined }} />
                            {pr?.end_date && v.completion_date && (() => {
                              const vsD = Math.floor((new Date(pr.end_date) - new Date(v.completion_date)) / 86400000);
                              const ok  = vsD >= 0;
                              const col  = ok ? C.greenText : C.redText;
                              const bg   = ok ? "#D1FAE5"   : "#FEE2E2";
                              const bord = ok ? "#86EFAC"   : "#FCA5A5";
                              const lbl  = ok ? `✓ ${vsD}d before PR deadline` : `⚠ ${Math.abs(vsD)}d over PR deadline`;
                              return <div style={{ marginTop: 5 }}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: bg, color: col, border: `1px solid ${bord}` }}>{lbl}</span></div>;
                            })()}
                            {pr?.end_date && (
                              <div style={{ fontSize: 10, color: C.textTer, marginTop: 4 }}>
                                PR work end date: <span style={{ fontWeight: 600, color: C.textSec }}>{fmtShort(pr.end_date)}</span>
                                {v.completion_date && v.completion_date !== pr.end_date && (
                                  <span> · <span style={{ color: C.coral, cursor: "pointer", fontWeight: 600 }}
                                    onClick={() => updateVendor(v.slot, "completion_date", pr.end_date)}>Reset to PR date</span></span>
                                )}
                              </div>
                            )}
                            {cWarn && <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: C.redText }}>🔴 {cWarn.msg}</div>}
                            {cWarn && (
                              <div style={{ marginTop: 6 }}>
                                <div style={lbl}>Delay Justification <span style={{ color: C.redText }}>*</span></div>
                                <textarea value={ptd.completion_delay_justification} onChange={e => updatePtData(v.slot, "completion_delay_justification", e.target.value)}
                                  rows={2} placeholder="Explain why completion exceeds the PR required date…"
                                  style={{ ...styles.input, margin: 0, resize: "vertical", fontSize: 11 }} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Work Duration mode */}
                        {mode === "work_duration" && (
                          <div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                              <input type="number" min="1" placeholder="e.g. 30" value={ptd.work_duration} onChange={e => updatePtData(v.slot, "work_duration", e.target.value)}
                                style={{ ...styles.input, margin: 0, width: 80, fontSize: 12 }} />
                              <select value={ptd.work_duration_type} onChange={e => updatePtData(v.slot, "work_duration_type", e.target.value)}
                                style={{ ...styles.input, margin: 0, flex: 1, fontSize: 12 }}>
                                <option value="calendar_days">Calendar Days</option>
                                <option value="working_days">Working Days</option>
                              </select>
                            </div>
                            {feasCheck && (() => {
                              const shared = computeTimelineFeasibility(v, pr);
                              const vsD  = shared ? pr?.end_date ? shared.avail - shared.total : null : null;
                              const prBadge = vsD !== null ? (() => {
                                const ok   = vsD >= 0;
                                const col  = ok ? C.greenText : C.redText;
                                const bg   = ok ? "#D1FAE5"   : "#FEE2E2";
                                const bord = ok ? "#86EFAC"   : "#FCA5A5";
                                const lbl  = ok ? `✓ ${vsD}d before PR deadline` : `⚠ ${Math.abs(vsD)}d over PR deadline`;
                                return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: bg, color: col, border: `1px solid ${bord}` }}>{lbl}</span>;
                              })() : null;
                              return (
                              <div style={{ padding: "6px 10px", borderRadius: 6, fontSize: 11,
                                background: feasCheck.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${feasCheck.ok ? "#BBF7D0" : "#FECACA"}`,
                                color: feasCheck.ok ? "#15803D" : C.redText, fontWeight: 600 }}>
                                {shared && (() => {
                                  const estDate = new Date(Date.now() + shared.total * 86400000).toISOString().slice(0, 10);
                                  return <div style={{ fontSize: 10, marginBottom: 5, color: feasCheck.ok ? "#15803D" : C.redText }}>Est. completion: <strong>~{fmtShort(estDate)}</strong></div>;
                                })()}
                                {prBadge && <div style={{ marginBottom: 5 }}>{prBadge}</div>}
                                {feasCheck.msg}
                                {!feasCheck.ok && (
                                  <div style={{ marginTop: 6 }}>
                                    <div style={{ ...lbl, color: C.redText }}>Justification <span style={{ color: C.redText }}>*</span></div>
                                    <textarea value={ptd.completion_delay_justification} onChange={e => updatePtData(v.slot, "completion_delay_justification", e.target.value)}
                                      rows={2} placeholder="Explain why this schedule may exceed the PR work end date…"
                                      style={{ ...styles.input, margin: 0, resize: "vertical", fontSize: 11 }} />
                                  </div>
                                )}
                              </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 12 }} />

                  {/* Warranty */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={lbl}>Warranty / DLP Period</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <input type="number" min="1" placeholder="12" value={ptd.warranty_period}
                        onChange={e => {
                          updatePtData(v.slot, "warranty_period", e.target.value);
                          updatePtData(v.slot, "retention_billing_months", e.target.value);
                        }}
                        style={{ ...styles.input, margin: 0, width: 60, fontSize: 12, textAlign: "right", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.textSec }}>calendar month(s) post-completion</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textTer }}>Sets the default Right to Bill retention period · adjust retention separately if vendor requests early release.</div>
                  </div>

                  <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 12 }} />

                  {/* Price Validity, LD, Remarks */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={lbl}>Price Validity</div>
                    <input type="date" value={v.price_validity} onChange={e => updateVendor(v.slot, "price_validity", e.target.value)}
                      style={{ ...styles.input, margin: 0, fontSize: 12 }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={lbl}>Liquidated Damages</div>
                    <input value={v.liquidated_damages} onChange={e => updateVendor(v.slot, "liquidated_damages", e.target.value)}
                      style={{ ...styles.input, margin: 0, fontSize: 12 }} />
                  </div>
                  <div>
                    <div style={lbl}>Remarks</div>
                    <textarea value={v.remarks} onChange={e => updateVendor(v.slot, "remarks", e.target.value)}
                      rows={3} style={{ ...styles.input, margin: 0, resize: "vertical", fontSize: 12 }} />
                  </div>
                  </>}
                </VCell>
              );
            })}
          </SectionRow>

          </div>}{/* ══ END TAB 1 ══ */}

          {/* ══ TAB 2: SUMMARY & RECOMMENDATION ══ */}
          {activeTab === "summary" && (() => {
            const awarV  = vendors.find(v => v.slot === awardedSlot);
            const awarVi = awarV ? vendors.indexOf(awarV) : -1;
            const awarVc = awarVi >= 0 ? vComputed[awarVi] : null;
            const awarVInfo = awarV ? vendorList.find(vl => String(vl.id) === String(awarV.vendor_id)) : null;
            const awarBreakdown = (awarV && awarVc) ? computePaymentBreakdown(awarVc.ptt, awarVc.ptd, awarVc.tot) : [];
            const awarAutoAmts  = awarVc ? awarVc.autoAmts : { surety: 0, performance: 0, warranty: 0 };

            // Risk flags
            const riskFlags = [];
            if (prRfaSequence > 1) riskFlags.push({ level: "warn", msg: `This is RFA #${prRfaSequence} for this PR — a previous RFA already exists.` });
            if (awarV) {
              const cWarn = completionWarning(awarV);
              if (cWarn) riskFlags.push({ level: "error", msg: `Recommended vendor: completion date ${cWarn.msg}` });
              const ptd = awarV.payment_term_data || {};
              const dpPct = parseFloat(ptd.dp_percent || 20);
              if (PT_HAS_DP.has(awarV.payment_term_type) && dpPct > 30)
                riskFlags.push({ level: "warn", msg: `Downpayment ${dpPct}% exceeds the 30% standard maximum.` });
              if (ptd.dp_override)               riskFlags.push({ level: "warn", msg: "Downpayment % overridden — justification on file." });
              if (ptd.dp_release_override)        riskFlags.push({ level: "warn", msg: "DP release timeline overridden." });
              if (ptd.progress_release_override)  riskFlags.push({ level: "warn", msg: "Progress payment release timeline overridden." });
              if (ptd.retention_billing_override) riskFlags.push({ level: "warn", msg: "Retention release timeline overridden." });
              if (ptd.surety_bond_override || ptd.performance_bond_override || ptd.warranty_bond_override)
                riskFlags.push({ level: "warn", msg: "One or more bond amounts have been overridden." });
              if (!awarV.price_validity)          riskFlags.push({ level: "info", msg: "Price validity date not set for recommended vendor." });
              // Timeline feasibility — shared logic with Detailed Proposal section
              const tFeas = computeTimelineFeasibility(awarV, pr);
              if (tFeas && !tFeas.ok)
                riskFlags.push({ level: "error", type: "timeline", feas: tFeas });
              // DP commencement justification on file
              const ptdJust = ptd.completion_delay_justification?.trim();
              if (ptdJust)
                riskFlags.push({ level: "info", msg: `Commencement justification on file: "${ptdJust}"` });
            }

            // lowest submitted total — for price spread row
            const submittedTots = vComputed.map(vc => vc.tot).filter(t => t > 0);
            const lowestTot = submittedTots.length > 0 ? Math.min(...submittedTots) : 0;

            // Estimated days to completion from today — unified across work_duration and end_date vendors
            const vendorEstDays = vendors.map(v => {
              const s = v.participation_status;
              if (s && s !== "Submitted") return null;
              const ptd  = v.payment_term_data || {};
              const mode = ptd.completion_mode || "end_date";
              if (mode === "work_duration") {
                const feas = computeTimelineFeasibility(v, pr);
                return feas ? feas.total : null;
              } else {
                if (!v.completion_date) return null;
                return Math.floor((new Date(v.completion_date) - new Date()) / 86400000);
              }
            });

            // section divider helper
            const sec = (label) => ({ isSection: true, label });

            const compactRows = [
              // ── VENDOR QUALIFICATIONS ──────────────────────────────────────
              sec("VENDOR QUALIFICATIONS"),
              { label: "Accreditation Status", render: (v) => {
                const vInfo = vendorList.find(vl => String(vl.id) === String(v.vendor_id));
                const status = vInfo?.status;
                if (!status) return <span style={{ color: C.textTer }}>—</span>;
                const isA = /class\s*a/i.test(status) || status === "A";
                const isB = /class\s*b/i.test(status) || status === "B";
                const col = isA ? C.greenText : isB ? "#2563EB" : C.amberText;
                const bg  = isA ? "#D1FAE5"  : isB ? "#EFF6FF"  : C.amberBg;
                return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: bg, color: col, border: `1px solid ${col}30` }}>{status}</span>;
              }},

              // ── FINANCIAL ──────────────────────────────────────────────────
              sec("FINANCIAL"),
              { label: "Total Contract Amount", render: (v, vi) => {
                const vc = vComputed[vi];
                return vc.tot > 0 ? <strong style={{ fontFamily: "monospace", color: C.coral }}>₱ {fmtPeso(vc.tot)}</strong> : <span style={{ color: C.textTer }}>—</span>;
              }},
              { label: "Initial / BAFO Price", render: (v) => {
                const props = v.proposals || [];
                if (props.length === 0) return <span style={{ color: C.textTer }}>—</span>;
                const firstTot = computeProposalTotals(props[0]).total;
                const lastProp = props.length > 1 ? props[props.length - 1] : null;
                const lastTot  = lastProp ? computeProposalTotals(lastProp).total : null;
                if (!lastTot) return <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textSec }}>₱ {fmtPeso(firstTot)} <span style={{ color: C.textTer, fontFamily: "inherit", fontWeight: 400 }}>(Initial)</span></span>;
                const diff = lastTot - firstTot;
                const pct  = firstTot > 0 ? Math.abs((diff / firstTot) * 100).toFixed(1) : null;
                return (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ color: C.textTer }}>Initial: <span style={{ fontFamily: "monospace", color: C.textSec }}>₱ {fmtPeso(firstTot)}</span></div>
                    <div style={{ color: C.textTer }}>BAFO: <span style={{ fontFamily: "monospace", fontWeight: 700, color: diff < 0 ? C.greenText : C.amberText }}>₱ {fmtPeso(lastTot)}</span>
                      {pct !== null && <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: diff < 0 ? C.greenText : C.amberText }}>{diff < 0 ? "▼" : "▲"} {pct}%</span>}
                    </div>
                  </div>
                );
              }},
              { label: "vs. Lowest Bid", render: (v, vi) => {
                const vc = vComputed[vi];
                if (!vc.tot || vc.tot <= 0 || lowestTot <= 0) return <span style={{ color: C.textTer }}>—</span>;
                if (vc.tot === lowestTot) return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#D1FAE5", color: C.greenText, border: `1px solid #86EFAC` }}>✓ Lowest Bid</span>;
                const diff = vc.tot - lowestTot;
                const pct  = ((diff / lowestTot) * 100).toFixed(1);
                return <span style={{ fontSize: 11, color: C.amberText, fontWeight: 600 }}>▲ {pct}% above lowest <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 400 }}>(+₱ {fmtPeso(diff)})</span></span>;
              }},

              // ── PAYMENT TERMS ──────────────────────────────────────────────
              sec("PAYMENT TERMS"),
              { label: "Payment Type", render: (v, vi) => {
                const vc = vComputed[vi];
                if (!vc.ptLabel) return <span style={{ color: C.textTer }}>—</span>;
                const ptd = vc.ptd || {};
                const dpPct = parseFloat(ptd.dp_percent || 20);
                const dpHigh = PT_HAS_DP.has(vc.ptt) && dpPct > 30;
                const dpOvr  = PT_HAS_DP.has(vc.ptt) && ptd.dp_override;
                const rtbEarly = PT_HAS_RETENTION.has(vc.ptt) && ptd.warranty_period && parseInt(ptd.retention_billing_months || 12) < parseInt(ptd.warranty_period);
                return (
                  <div>
                    <span style={{ fontWeight: 600, color: "#2563EB" }}>{vc.ptLabel}</span>
                    {dpHigh  && <div style={{ fontSize: 11, fontWeight: 700, color: C.amberText }}>⚠ DP {dpPct}%</div>}
                    {dpOvr   && <div style={{ fontSize: 11, fontWeight: 600, color: C.amberText }}>⚠ DP % overridden{ptd.dp_override_remarks ? <span style={{ fontWeight: 400, fontStyle: "italic" }}> — {ptd.dp_override_remarks}</span> : ""}</div>}
                    {rtbEarly && <div style={{ fontSize: 11, fontWeight: 600, color: C.amberText }}>⚠ RTB retention earlier than warranty</div>}
                  </div>
                );
              }},
              { label: "Milestone Schedule", show: () => vComputed.some(vc => vc.ptt === "milestone"), render: (v, vi) => {
                const vc  = vComputed[vi];
                if (vc.ptt !== "milestone") return <span style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>N/A</span>;
                const ptd  = vc.ptd || {};
                const ms   = ptd.milestones || [];
                if (ms.length === 0) return <span style={{ fontSize: 11, color: C.textTer, fontStyle: "italic" }}>No milestones set</span>;
                const total = ms.reduce((s, m) => s + parseFloat(m.percent || 0), 0);
                const ok    = Math.abs(total - 100) < 0.01;
                return (
                  <div style={{ fontSize: 11 }}>
                    {ms.map((m, i) => {
                      const pct = parseFloat(m.percent || 0);
                      const amt = vc.tot > 0 ? vc.tot * pct / 100 : null;
                      return (
                        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3, gap: 6 }}>
                          <span style={{ color: C.textSec }}><span style={{ color: "#7C3AED", fontWeight: 700 }}>{i + 1}.</span> {m.label || `Milestone ${i + 1}`}</span>
                          <span style={{ fontFamily: "monospace", color: C.textPri, flexShrink: 0 }}>
                            {pct}%{amt !== null ? ` · ₱ ${fmtPeso(amt)}` : ""}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: C.textTer }}>Total</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: ok ? C.greenText : C.redText }}>{ok ? "✓ " : "⚠ "}{total.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              }},
              { label: "Downpayment", show: () => vComputed.some(vc => PT_HAS_DP.has(vc.ptt)), render: (v, vi) => {
                const vc = vComputed[vi];
                if (!PT_HAS_DP.has(vc.ptt)) return <span style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>N/A</span>;
                const ptd   = vc.ptd || {};
                const dpPct = parseFloat(ptd.dp_percent || 20);
                const dpAmt = vc.tot > 0 ? vc.tot * dpPct / 100 : null;
                const isHigh = dpPct > 30;
                const isMid  = dpPct > 20 && dpPct <= 30;
                const col    = isHigh ? C.redText   : isMid ? C.amberText : C.greenText;
                const bg     = isHigh ? "#FEE2E2"   : isMid ? C.amberBg   : "#D1FAE5";
                const bord   = isHigh ? "#FCA5A5"   : isMid ? "#FCD34D"   : "#86EFAC";
                const badge  = isHigh ? "⚠ Exceeds 30% max" : isMid ? "At limit" : "✓ Standard";
                return (
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontFamily: "monospace", color: col }}>{dpPct}%</span>
                      {dpAmt !== null && <span style={{ color: C.textTer, fontSize: 11 }}> · <span style={{ fontFamily: "monospace", color: C.textSec }}>₱ {fmtPeso(dpAmt)}</span></span>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: bg, color: col, border: `1px solid ${bord}` }}>{badge}</span>
                  </div>
                );
              }},
              { label: "DP Recoupable", show: () => vComputed.some(vc => PT_HAS_DP.has(vc.ptt)), render: (v, vi) => {
                const vc = vComputed[vi];
                if (!PT_HAS_DP.has(vc.ptt)) return <span style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>N/A</span>;
                const ptd = vc.ptd || {};
                const isRecoupable = ptd.dp_recoupable !== false;
                return isRecoupable
                  ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#D1FAE5", color: C.greenText, border: `1px solid #86EFAC` }}>Recoupable at {ptd.dp_percent || 20}% per billing</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#FEE2E2", color: C.redText, border: `1px solid #FCA5A5` }}>Non-recoupable</span>;
              }},
              { label: "Progress Billing", show: () => vComputed.some(vc => PT_HAS_PROGRESS.has(vc.ptt)), render: (v, vi) => {
                const vc = vComputed[vi];
                if (!PT_HAS_PROGRESS.has(vc.ptt)) return <span style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>N/A</span>;
                const ptd = vc.ptd || {};
                const freqLabel = PROGRESS_FREQUENCIES.find(f => f.value === ptd.progress_freq)?.label || "Monthly (POC)";
                return <span>{freqLabel}</span>;
              }},
              { label: "Retention", show: () => vComputed.some(vc => PT_HAS_RETENTION.has(vc.ptt) || (vc.ptt === "milestone" && (vc.ptd||{}).milestone_has_retention)), render: (v, vi) => {
                const vc  = vComputed[vi];
                const ptd = vc.ptd || {};
                if (PT_HAS_RETENTION.has(vc.ptt)) {
                  const retPct = parseFloat(ptd.retention_percent || 0);
                  const retAmt = vc.tot > 0 && retPct > 0 ? vc.tot * retPct / 100 : null;
                  const rtbMo  = ptd.retention_billing_months || "—";
                  return (
                    <div>
                      <span style={{ color: C.textPri }}>{retPct > 0 ? `${retPct}%` : "—"}</span>
                      {retAmt !== null && <span style={{ color: C.textTer, fontSize: 11 }}> · <span style={{ fontFamily: "monospace", color: C.textSec }}>₱ {fmtPeso(retAmt)}</span></span>}
                      <div style={{ fontSize: 11, color: C.textTer }}>RTB after {rtbMo} mo</div>
                    </div>
                  );
                }
                if (vc.ptt === "milestone" && ptd.milestone_has_retention) {
                  const retPct = parseFloat(ptd.retention_percent || 10);
                  const retAmt = vc.tot > 0 ? vc.tot * retPct / 100 : null;
                  const mode   = ptd.milestone_retention_mode === "final" ? "Final milestone only" : "Per milestone";
                  const wp     = ptd.warranty_period ? `Released after ${ptd.warranty_period} mo warranty` : null;
                  return (
                    <div>
                      <span style={{ color: C.textPri }}>{retPct}%</span>
                      {retAmt !== null && <span style={{ color: C.textTer, fontSize: 11 }}> · <span style={{ fontFamily: "monospace", color: C.textSec }}>₱ {fmtPeso(retAmt)}</span></span>}
                      <div style={{ fontSize: 11, color: C.textTer }}>{mode}</div>
                      {wp && <div style={{ fontSize: 11, color: C.textTer }}>{wp}</div>}
                    </div>
                  );
                }
                return <span style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>N/A</span>;
              }},
              { label: "Release of Payment", render: (v, vi) => {
                const ptd = vComputed[vi]?.ptd || {};
                const days = ptd.completion_release_days || 30;
                return <span style={{ fontSize: 11, color: C.textSec }}>{days} calendar days upon complete billing requirements</span>;
              }},

              // ── TIMELINE ───────────────────────────────────────────────────
              sec("TIMELINE"),
              { label: "Commencement", render: (v) => {
                const ptd = v.payment_term_data || {};
                const label = COMMENCEMENT_TYPES.find(c => c.value === ptd.commencement_type)?.label;
                if (!label) return <span style={{ color: C.textTer }}>—</span>;
                const needsDays = ptd.commencement_type === "noa_ntp" || ptd.commencement_type === "receipt_dp";
                const missingDays = needsDays && !ptd.commencement_days;
                return (
                  <div>
                    <span>{label}</span>
                    {needsDays && ptd.commencement_days && (
                      <div style={{ fontSize: 11, color: C.textSec }}>within {ptd.commencement_days} days</div>
                    )}
                    {missingDays && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.redText }}>⚠ Mobilization days not set</div>
                    )}
                  </div>
                );
              }},
              { label: "Work Duration / Completion", render: (v, vi) => {
                const ptd      = v.payment_term_data || {};
                const mode     = ptd.completion_mode || "end_date";
                const excluded = v.participation_status && v.participation_status !== "Submitted";
                const estDays  = excluded ? null : vendorEstDays[vi];

                // ── PR deadline badge ─────────────────────────────────────────
                let prNode = null;
                if (!excluded && estDays !== null && pr?.end_date) {
                  const prDays     = Math.floor((new Date(pr.end_date) - new Date()) / 86400000);
                  const vsDeadline = prDays - estDays;
                  const prCol  = vsDeadline >= 0 ? C.greenText : C.redText;
                  const prBg   = vsDeadline >= 0 ? "#D1FAE5"   : "#FEE2E2";
                  const prBord = vsDeadline >= 0 ? "#86EFAC"   : "#FCA5A5";
                  const prLabel = vsDeadline >= 0
                    ? `✓ ${vsDeadline}d before PR deadline`
                    : `⚠ ${Math.abs(vsDeadline)}d over PR deadline`;
                  prNode = <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: prBg, color: prCol, border: `1px solid ${prBord}` }}>{prLabel}</span>;
                }

                // ── Work-duration branch ──────────────────────────────────────
                if (mode === "work_duration") {
                  if (!ptd.work_duration) return <span style={{ color: C.textTer }}>—</span>;
                  const durType = ptd.work_duration_type === "working_days" ? "Working Days" : "Calendar Days";
                  const estDate = estDays !== null ? new Date(Date.now() + estDays * 86400000).toISOString().slice(0, 10) : null;
                  const feas    = computeTimelineFeasibility(v, pr);
                  return (
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{ptd.work_duration}</span>
                        <span style={{ color: C.textSec }}> {durType}</span>
                        <span style={{ fontSize: 10, color: C.textTer }}> from commencement</span>
                      </div>
                      {estDate && <div style={{ fontSize: 10, color: C.textTer, marginBottom: 4 }}>~{fmtShort(estDate)} est. completion</div>}
                      {prNode && <div style={{ marginBottom: feas ? 4 : 0 }}>{prNode}</div>}
                      {feas && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: feas.ok ? C.greenText : C.redText }}>
                          {feas.ok ? "✓" : "⚠"} {feas.total}d to completion · {feas.avail}d avail
                          {!feas.ok && <span style={{ fontWeight: 700 }}> · Short by {feas.shortBy}d</span>}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Fixed end-date branch ─────────────────────────────────────
                if (!v.completion_date) return <span style={{ color: C.textTer }}>—</span>;
                const warn = completionWarning(v);
                return (
                  <div>
                    <div style={{ fontWeight: warn ? 700 : 400, color: warn ? C.redText : C.textPri, marginBottom: 4 }}>
                      {warn ? "⚠ " : ""}{fmtShort(v.completion_date)}
                    </div>
                    {prNode}
                  </div>
                );
              }},

              // ── COMMERCIAL TERMS ───────────────────────────────────────────
              sec("COMMERCIAL TERMS"),
              { label: "Warranty / DLP", render: (v, vi) => {
                const vc = vComputed[vi];
                const ptd = vc.ptd || {};
                if (!ptd.warranty_period) return <span style={{ color: C.textTer }}>—</span>;
                const rtbEarly = PT_HAS_RETENTION.has(vc.ptt) && parseInt(ptd.retention_billing_months || 12) < parseInt(ptd.warranty_period);
                return (
                  <div>
                    <span style={{ color: C.textPri }}>{ptd.warranty_period} months</span>
                    {rtbEarly && <div style={{ fontSize: 11, fontWeight: 600, color: C.amberText }}>⚠ RTB earlier than warranty</div>}
                  </div>
                );
              }},
              { label: "Liquidated Damages", render: (v) => {
                if (!v.liquidated_damages) return <span style={{ color: C.textTer }}>—</span>;
                return <span style={{ fontSize: 11, color: C.textSec }}>{v.liquidated_damages}</span>;
              }},
              { label: "Price Validity", render: (v) => {
                if (!v.price_validity) return <span style={{ color: C.textTer }}>—</span>;
                const daysLeft = Math.floor((new Date(v.price_validity) - new Date()) / 86400000);
                const expired = daysLeft < 0;
                const urgent  = !expired && daysLeft < 14;
                const warn    = !expired && !urgent && daysLeft < 30;
                const col  = expired || urgent ? C.redText   : warn ? C.amberText : C.greenText;
                const bg   = expired || urgent ? "#FEE2E2"   : warn ? C.amberBg   : "#D1FAE5";
                const bord = expired || urgent ? "#FCA5A5"   : warn ? "#FCD34D"   : "#86EFAC";
                const badge = expired ? "🔴 Expired"
                  : urgent  ? `⚠ ${daysLeft}d left — Expiring soon`
                  : warn    ? `⚠ ${daysLeft}d left`
                  : `✓ ${daysLeft}d remaining`;
                return (
                  <div>
                    <div style={{ fontSize: 11, color: C.textSec, marginBottom: 4 }}>{fmtShort(v.price_validity)}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: bg, color: col, border: `1px solid ${bord}` }}>{badge}</span>
                  </div>
                );
              }},

              // ── BONDS ──────────────────────────────────────────────────────
              sec("BONDS"),
              { label: "Surety Bond", show: () => vComputed.some(vc => PT_HAS_DP.has(vc.ptt) && vc.autoAmts.surety > 0), render: (v, vi) => {
                const vc = vComputed[vi];
                if (!PT_HAS_DP.has(vc.ptt) || vc.autoAmts.surety <= 0) return <span style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>N/A</span>;
                const ptd = vc.ptd || {};
                const amt = ptd.surety_bond_override ? parseFloat(ptd.surety_bond_override_amount || 0) : vc.autoAmts.surety;
                return (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ color: C.textTer }}>{ptd.dp_percent || 20}% of Contract Amount</div>
                    <div style={{ fontFamily: "monospace", fontWeight: 600, color: ptd.surety_bond_override ? C.amberText : C.textPri }}>{ptd.surety_bond_override ? "⚠ " : ""}₱ {fmtPeso(amt)}</div>
                    {ptd.surety_bond_override && ptd.surety_bond_remarks && <div style={{ fontSize: 10, color: C.amberText, fontStyle: "italic" }}>{ptd.surety_bond_remarks}</div>}
                  </div>
                );
              }},
              { label: "Performance Bond", show: () => vComputed.some(vc => PT_HAS_PROGRESS.has(vc.ptt) && vc.autoAmts.performance > 0), render: (v, vi) => {
                const vc = vComputed[vi];
                if (!PT_HAS_PROGRESS.has(vc.ptt) || vc.autoAmts.performance <= 0) return <span style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>N/A</span>;
                const ptd = vc.ptd || {};
                const pct = ptd.performance_bond_percent || 30;
                const amt = ptd.performance_bond_override ? parseFloat(ptd.performance_bond_override_amount || 0) : vc.autoAmts.performance;
                return (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ color: C.textTer }}>{pct}% of Contract Amount</div>
                    <div style={{ fontFamily: "monospace", fontWeight: 600, color: ptd.performance_bond_override ? C.amberText : C.textPri }}>{ptd.performance_bond_override ? "⚠ " : ""}₱ {fmtPeso(amt)}</div>
                    {ptd.performance_bond_override && ptd.performance_bond_remarks && <div style={{ fontSize: 10, color: C.amberText, fontStyle: "italic" }}>{ptd.performance_bond_remarks}</div>}
                  </div>
                );
              }},
              { label: "Warranty Bond", show: () => vComputed.some(vc => { const ptd = vc.ptd||{}; return (PT_HAS_RETENTION.has(vc.ptt) || (vc.ptt==="milestone" && ptd.milestone_has_retention)) && vc.autoAmts.warranty > 0; }), render: (v, vi) => {
                const vc  = vComputed[vi];
                const ptd = vc.ptd || {};
                const hasWarrantyBond = PT_HAS_RETENTION.has(vc.ptt) || (vc.ptt === "milestone" && ptd.milestone_has_retention);
                if (!hasWarrantyBond || vc.autoAmts.warranty <= 0) return <span style={{ fontSize: 10, color: C.textTer, fontStyle: "italic" }}>N/A</span>;
                const retPct = ptd.retention_percent || 10;
                const amt    = ptd.warranty_bond_override ? parseFloat(ptd.warranty_bond_override_amount || 0) : vc.autoAmts.warranty;
                return (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ color: C.textTer }}>{retPct}% of Contract Amount</div>
                    <div style={{ fontFamily: "monospace", fontWeight: 600, color: ptd.warranty_bond_override ? C.amberText : C.textPri }}>{ptd.warranty_bond_override ? "⚠ " : ""}₱ {fmtPeso(amt)}</div>
                    {ptd.warranty_bond_override && ptd.warranty_bond_remarks && <div style={{ fontSize: 10, color: C.amberText, fontStyle: "italic" }}>{ptd.warranty_bond_remarks}</div>}
                  </div>
                );
              }},
            ];

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* ── CM Review Banner ── */}
                {status === "Submitted" && can(profile, "rfa.approve") && (
                  <div style={{ padding: "12px 18px", background: "#EEF2FF", border: `1px solid #C7D2FE`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📋</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#3730A3" }}>Reviewing RFA for Approval</div>
                        <div style={{ fontSize: 11, color: "#4338CA" }}>This is the summary prepared by the CO. Review vendor comparison and recommendation below, then approve or return.</div>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab("detail")}
                      style={{ ...styles.btnSecondary, fontSize: 11, whiteSpace: "nowrap", flexShrink: 0, borderColor: "#C7D2FE", color: "#4338CA" }}>
                      View Full Details →
                    </button>
                  </div>
                )}

                {/* ══ FORMAL DOCUMENT ══ */}
                <div style={{ background: "#fff", border: `1px solid #E5E7EB`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>

                {/* Letterhead */}
                <div style={{ padding: "24px 32px 20px", borderBottom: `2px solid ${C.coral}`, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center" }}>
                  {buLogoUrl
                    ? <img src={buLogoUrl} alt="logo" style={{ height: 52, objectFit: "contain", borderRadius: 8 }} />
                    : <div style={{ width: 52, height: 52, borderRadius: 10, background: C.coral, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.1 }}>PH<br/>WORLD</div>
                  }
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#111" }}>Recommendation for Award</div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>Commercial &amp; Contract Management &nbsp;·&nbsp; Internal Approval Document</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 11, color: "#374151", lineHeight: 1.9 }}>
                    <div style={{ fontFamily: "monospace", fontWeight: 700, color: C.coral, fontSize: 13 }}>{rfaNumber}</div>
                    <div>Date: {fmtShort(new Date().toISOString())}</div>
                    {pr?.pr_number && <div>PR Ref: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{pr.pr_number}</span></div>}
                  </div>
                </div>

                {/* ① Project Background */}
                <div style={{ padding: "18px 32px", borderBottom: `1px solid #F3F4F6` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.coral, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF" }}>Project Background</div>
                    <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
                  </div>

                  {/* Project sub-group */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D1D5DB", marginBottom: 10 }}>Project</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                      {[
                        { label: "Name",          value: pr?.projects?.name,          wide: true },
                        { label: "Business Unit", value: pr?.projects?.business_unit },
                        { label: "Project Code",  value: pr?.projects?.project_code,  mono: true },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label} style={{ gridColumn: f.wide ? "span 2" : "span 1" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "#111", fontFamily: f.mono ? "monospace" : "inherit" }}>{f.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: 1, background: "#F3F4F6", marginBottom: 14 }} />

                  {/* Purchase Request sub-group */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D1D5DB", marginBottom: 10 }}>Purchase Request</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                      {pr?.pr_number && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", marginBottom: 3 }}>PR Number</div>
                          <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: C.coral }}>{pr.pr_number}</div>
                        </div>
                      )}
                      {[
                        { label: "Work Description", value: pr?.description,  wide: true },
                        { label: "Justification",    value: pr?.justification, wide: true },
                        { label: "Start Date",       value: fmtShort(pr?.start_date) },
                        { label: "End Date",         value: fmtShort(pr?.end_date) },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label} style={{ gridColumn: f.wide ? "span 2" : "span 1" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", marginBottom: 3 }}>{f.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "#111" }}>{f.value}</div>
                        </div>
                      ))}
                      {(pr?.budget_status || pr?.reviewer_budget_status) && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", marginBottom: 3 }}>Budget Status</div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 12,
                            background: (pr.budget_status || pr.reviewer_budget_status) === "Budgeted" ? "#D1FAE5" : "#FEF3C7",
                            color:      (pr.budget_status || pr.reviewer_budget_status) === "Budgeted" ? "#065F46" : "#92400E" }}>
                            {pr.budget_status || pr.reviewer_budget_status}
                          </span>
                        </div>
                      )}
                      {(pr?.budget_code || pr?.reviewer_budget_code) && (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", marginBottom: 3 }}>Budget Code</div>
                          <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: C.coral }}>{pr?.budget_code || pr?.reviewer_budget_code}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ height: 1, background: "#F3F4F6", marginBottom: 14 }} />

                  {/* Procurement Strategy sub-group */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D1D5DB", marginBottom: 10 }}>Procurement Strategy</div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0,
                        background: procurementStrategy === "Competitive Bid" ? "#DBEAFE" : procurementStrategy === "Negotiated" ? "#FEF3C7" : procurementStrategy === "Repeat Order" ? "#D1FAE5" : "#EDE9FE",
                        color:      procurementStrategy === "Competitive Bid" ? "#1D4ED8" : procurementStrategy === "Negotiated" ? "#92400E" : procurementStrategy === "Repeat Order" ? "#065F46" : "#5B21B6" }}>
                        {procurementStrategy}
                      </span>
                      {procurementJustification && (
                        <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.7, background: "#F9FAFB", padding: "8px 12px", borderRadius: 8, borderLeft: `3px solid ${C.coral}`, flex: 1 }}>
                          {procurementJustification}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ② Vendor Comparison */}
                <div style={{ padding: "18px 32px 0", borderBottom: `1px solid #F3F4F6` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.coral, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF" }}>Vendor Comparison</div>
                    <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
                    <span style={{ fontSize: 10, color: "#9CA3AF" }}>Click a vendor column to recommend</span>
                  </div>
                  <div style={{ overflowX: "auto", marginBottom: 18, border: `1px solid #E5E7EB`, borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: 170 }} />
                      {vendors.map(v => <col key={v.slot} />)}
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                        <th style={{ position: "sticky", top: 0, zIndex: 2, padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", background: C.offWhite, boxShadow: `0 1px 0 ${C.border}` }}>Criteria</th>
                        {vendors.map((v, vi) => {
                          const isSelected = awardedSlot === v.slot;
                          const vInfo = vendorList.find(vl => String(vl.id) === String(v.vendor_id));
                          return (
                            <th key={v.slot} onClick={() => { setAwardedSlot(isSelected ? null : v.slot); if (autoGenNotice) { setAutoGenNotice(false); setAwardReason(""); } }}
                              style={{ position: "sticky", top: 0, zIndex: 2, padding: "10px 16px", textAlign: "left", cursor: "pointer", borderLeft: `1px solid ${C.border}`,
                                background: isSelected ? C.coralLight : "white",
                                boxShadow: isSelected ? `0 3px 0 ${C.coral}` : `0 2px 0 ${C.border}` }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: isSelected ? C.coral : C.textTer, textTransform: "uppercase", marginBottom: 2 }}>Vendor {vi + 1}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? C.coral : C.textSec }}>
                                {vInfo?.full_name || <span style={{ fontStyle: "italic", fontWeight: 400, color: C.textTer }}>Not selected</span>}
                              </div>
                              {isSelected && <div style={{ fontSize: 9, color: C.coral, fontWeight: 700, marginTop: 2 }}>★ Recommended</div>}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const visible = compactRows.filter(r => !r.show || r.show());
                        const filtered = visible.filter((r, i) => {
                          if (!r.isSection) return true;
                          const next = visible[i + 1];
                          return next && !next.isSection;
                        });
                        return filtered;
                      })().map((row, ri) => {
                        if (row.isSection) return (
                          <tr key={ri}>
                            <td colSpan={vendors.length + 1} style={{ padding: "5px 16px 4px", fontSize: 9, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.08em", background: "#F3F4F6", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>{row.label}</td>
                          </tr>
                        );
                        return (
                          <tr key={ri} style={{ borderBottom: `1px solid ${C.border}`, background: ri % 2 === 0 ? "white" : C.offWhite + "60" }}>
                            <td style={{ padding: "9px 16px", fontSize: 11, fontWeight: 600, color: C.textSec, background: C.offWhite }}>{row.label}</td>
                            {vendors.map((v, vi) => {
                              const isSelected = awardedSlot === v.slot;
                              return (
                                <td key={v.slot} onClick={() => { setAwardedSlot(isSelected ? null : v.slot); if (autoGenNotice) { setAutoGenNotice(false); setAwardReason(""); } }}
                                  style={{ padding: "9px 16px", borderLeft: `1px solid ${C.border}`, background: isSelected ? C.coralLight : "transparent", cursor: "pointer", verticalAlign: "middle" }}>
                                  {row.render(v, vi)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>{/* ── end section 3 ── */}

                {/* ③ Award Recommendation */}
                <div style={{ padding: "18px 32px", borderBottom: `1px solid #F3F4F6` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.coral, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>3</div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF" }}>Award Recommendation</div>
                    <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
                    <button onClick={autoRecommend}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 7, border: `1px solid ${C.coral}40`, background: "#FFF5F4", color: C.coralDark, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      ⚡ Auto-recommend
                    </button>
                  </div>

                {/* ── Risk banner ── */}
                {awarV && riskFlags.length === 0 && (
                  <div style={{ padding: "7px 20px", background: C.tealBg, borderBottom: `1px solid ${C.tealText}30`, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.tealText }}>✓ No risk flags — all criteria met</span>
                  </div>
                )}
                {riskFlags.length > 0 && (
                  <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}` }}>
                    {riskFlags.map((f, i) => {
                      const bg    = f.level === "error" ? C.redBg  : f.level === "warn" ? C.amberBg : "#EFF6FF";
                      const color = f.level === "error" ? C.redText : f.level === "warn" ? C.amberText : "#2563EB";
                      const icon  = f.level === "error" ? "🔴" : f.level === "warn" ? "⚠" : "ℹ";

                      if (f.type === "timeline") {
                        const { feas } = f;
                        return (
                          <div key={i} style={{ background: bg, borderRadius: 8, padding: "10px 12px", border: `1px solid ${color}30`, marginBottom: i < riskFlags.length - 1 ? 6 : 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span>🔴</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color }}>Timeline Feasibility Warning</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                              {feas.components.map((c, ci) => (
                                <React.Fragment key={ci}>
                                  <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.07)", color, fontWeight: 600 }}>
                                    <span style={{ fontSize: 12 }}>{c.days}d</span>
                                    <span style={{ fontWeight: 400, marginLeft: 3 }}>{c.label}</span>
                                  </div>
                                  {ci < feas.components.length - 1 && <span style={{ color, fontSize: 11 }}>+</span>}
                                </React.Fragment>
                              ))}
                              <span style={{ color, fontSize: 11 }}>=</span>
                              <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: color, color: "#fff", fontWeight: 700 }}>
                                {feas.total}d total
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "3px 0", fontSize: 11 }}>
                              <span style={{ color }}>Days to Completion</span>
                              <span style={{ fontWeight: 700, color, fontFamily: "monospace" }}>{feas.total} days</span>
                              <span style={{ color }}>Available</span>
                              <span style={{ fontFamily: "monospace", color }}>{feas.avail} days</span>
                              <span style={{ borderTop: `1px solid ${color}40`, paddingTop: 3, color }}></span>
                              <span style={{ borderTop: `1px solid ${color}40`, paddingTop: 3, fontWeight: 700, color, fontFamily: "monospace" }}>
                                Short by {feas.shortBy} day{feas.shortBy !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={i} style={{ fontSize: 11, padding: "7px 10px", borderRadius: 7, lineHeight: 1.4, background: bg, color, marginBottom: i < riskFlags.length - 1 ? 6 : 0 }}>
                          {icon} {f.msg}
                        </div>
                      );
                    })}
                  </div>
                )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>

                    {/* Left: recommended vendor display */}
                    <div style={{ padding: "16px 20px", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 14 }}>

                      {/* Recommended vendor — read-only display, set by clicking table */}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Recommended Vendor</div>
                        {awarV ? (
                          <div style={{ padding: "12px 14px", borderRadius: 9, background: C.surface, border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.coral, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                              ★ Recommended
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 3 }}>
                              {awarVInfo?.full_name || "—"}
                            </div>
                            {awarVc?.tot > 0 && (
                              <div style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: C.coral, marginBottom: 8 }}>
                                ₱ {fmtPeso(awarVc.tot)}
                              </div>
                            )}
                            {awarVc?.ptLabel && (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
                                {awarVc.ptLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ padding: "16px 14px", borderRadius: 9, background: C.offWhite, border: `1px dashed ${C.borderMid}`, textAlign: "center" }}>
                            <div style={{ fontSize: 18, marginBottom: 5 }}>☝️</div>
                            <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.5 }}>Click a vendor column in the comparison table above to recommend</div>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Right: justification */}
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

                      {/* Justification */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                          Basis for Award Recommendation <span style={{ color: C.redText }}>*</span>
                        </div>
                        <textarea value={awardReason} onChange={e => { setAwardReason(e.target.value); if (autoGenNotice) setAutoGenNotice(false); }} rows={7}
                          placeholder="Explain why this vendor is recommended — e.g. lowest compliant bid, best value for money, technical score, track record…"
                          style={{ ...styles.input, margin: 0, resize: "vertical", fontSize: 12, lineHeight: 1.6 }} />
                        {autoGenNotice && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "5px 10px", borderRadius: 6, background: C.coralLight, border: `1px solid ${C.coral}30` }}>
                            <span style={{ fontSize: 12 }}>⚡</span>
                            <span style={{ fontSize: 10, color: C.coralDark, fontWeight: 600 }}>Auto-generated — review and edit as needed</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Contract terms: full-width row below the split */}
                  {awarV && awarVc && (
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 20px", background: C.offWhite }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Recommended Contract Terms</div>
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                        {/* Header: total amount */}
                        <div style={{ padding: "8px 14px", background: C.coralLight, borderBottom: `1px solid ${C.coral}20`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>Total Contract Amount</span>
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: C.coral }}>
                            {awarVc.tot > 0 ? `₱ ${fmtPeso(awarVc.tot)}` : "—"}
                          </span>
                        </div>
                        {/* 3-column body */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#fff" }}>
                          {/* Column 1: Payment Schedule */}
                          <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Payment Schedule</div>
                            {awarBreakdown.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                {awarBreakdown.map((row, i) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textSec }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: row.color, display: "inline-block", flexShrink: 0 }} />
                                      {row.label}
                                    </span>
                                    <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: C.textPri }}>
                                      {awarVc.tot > 0 ? `₱ ${fmtPeso(row.amount)}` : "—"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: C.textTer }}>—</span>
                            )}
                          </div>
                          {/* Column 2: Required Bonds */}
                          <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Required Bonds</div>
                            {(awarAutoAmts.surety > 0 || awarAutoAmts.performance > 0 || awarAutoAmts.warranty > 0) ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {[
                                  { label: "Surety Bond",      amt: awarAutoAmts.surety },
                                  { label: "Performance Bond", amt: awarAutoAmts.performance },
                                  { label: "Warranty Bond",    amt: awarAutoAmts.warranty },
                                ].filter(b => b.amt > 0).map(b => (
                                  <div key={b.label} style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 11, color: C.textSec }}>{b.label}</span>
                                    <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: C.textPri }}>₱ {fmtPeso(b.amt)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: C.textTer }}>None required</span>
                            )}
                          </div>
                          {/* Column 3: Timeline */}
                          <div style={{ padding: "10px 14px" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 6 }}>Timeline</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {[
                                { label: "Commencement",      value: COMMENCEMENT_TYPES.find(c => c.value === awarVc.ptd.commencement_type)?.label },
                                { label: "Work Duration",     value: awarVc.ptd.completion_mode === "work_duration" && awarVc.ptd.work_duration ? `${awarVc.ptd.work_duration} ${awarVc.ptd.work_duration_type === "working_days" ? "Working Days" : "Calendar Days"}` : null },
                                { label: "Target Completion", value: (awarVc.ptd.completion_mode || "end_date") === "end_date" && awarV.completion_date ? fmtShort(awarV.completion_date) : null },
                                { label: "Warranty / DLP",    value: awarVc.ptd.warranty_period ? `${awarVc.ptd.warranty_period} month(s)` : null },
                              ].filter(f => f.value).map(f => (
                                <div key={f.label}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: C.textTer, textTransform: "uppercase", marginBottom: 1 }}>{f.label}</div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textPri }}>{f.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>{/* ── end section 4 ── */}

                {/* ④ Signatories */}
                <div style={{ padding: "24px 32px", borderBottom: `1px solid #F3F4F6` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.coral, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>4</div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF" }}>Signatories</div>
                    <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
                    {[
                      { role: "Prepared by",               name: profile?.full_name || "________________________", title: profile?.position || "Commercial Officer" },
                      { role: "Reviewed & Recommended by", name: genForm.reviewedByName || "________________________", title: genForm.reviewedByTitle || "Commercial Manager" },
                      { role: "Approved by",               name: genForm.endorsedByName || "________________________", title: genForm.endorsedByTitle || "D&C Head" },
                    ].map(sig => (
                      <div key={sig.role} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 40 }}>{sig.role}</div>
                        <div style={{ borderTop: `1.5px solid #374151`, paddingTop: 6, margin: "0 12px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{sig.name}</div>
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>{sig.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document footer */}
                <div style={{ padding: "9px 32px", background: "#F9FAFB", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#9CA3AF" }}>
                  <span>{rfaNumber}&nbsp;·&nbsp;Commercial &amp; Contract Management System</span>
                  <span>CONFIDENTIAL — FOR INTERNAL USE ONLY</span>
                </div>

                </div>{/* ── end formal document ── */}

              {/* ── Scope & Timeline Alignment ── */}
              {(() => {
                const canEdit = status === "Draft" || status === "Returned";
                const alignComplete = alignment.scopeWith?.trim() && alignment.scopeDate && alignment.timelineWith?.trim() && alignment.timelineDate;
                const AlignField = ({ label, value, onChange, type="text", placeholder="" }) => (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:C.textTer, textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:4 }}>{label}</div>
                    {canEdit
                      ? <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
                          style={{ ...styles.input, margin:0, fontSize:12 }} />
                      : <div style={{ fontSize:12, color: value ? C.textPri : C.textTer, fontStyle: value ? "normal" : "italic" }}>{value || "—"}</div>
                    }
                  </div>
                );
                return (
                  <div style={{ ...styles.card, marginTop:16, overflow:"hidden" }}>
                    {/* Header */}
                    <div style={{ padding:"12px 20px", background: alignComplete ? C.greenBg : C.amberBg, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:15 }}>{alignComplete ? "✅" : "⚠️"}</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color: alignComplete ? C.greenText : C.amberText }}>
                          Scope & Timeline Alignment
                        </div>
                        <div style={{ fontSize:10, color:C.textTer, marginTop:1 }}>
                          {alignComplete
                            ? "End user alignment confirmed — ready to submit"
                            : canEdit ? "Required before submitting for review" : "Incomplete — returned for completion"}
                        </div>
                      </div>
                      {alignDocUrl && (
                        <a href={alignDocUrl} target="_blank" rel="noreferrer"
                          style={{ marginLeft:"auto", fontSize:11, color:C.coral, fontWeight:600, textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
                          📎 {alignDocName||"Supporting doc"}
                        </a>
                      )}
                    </div>

                    <div style={{ padding:"16px 20px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                      {/* Scope block */}
                      <div style={{ display:"flex", flexDirection:"column", gap:10, padding:"14px 16px", background:C.offWhite, borderRadius:8, border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.textPri, paddingBottom:6, borderBottom:`1px solid ${C.border}` }}>Scope of Works</div>
                        {AlignField({ label:"Confirmed with *", value:alignment.scopeWith, onChange:v=>setAlignment(a=>({...a,scopeWith:v})), placeholder:"Name of PR User / End User" })}
                        {AlignField({ label:"Date confirmed *", value:alignment.scopeDate, onChange:v=>setAlignment(a=>({...a,scopeDate:v})), type:"date" })}
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:C.textTer, textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:4 }}>Notes / Clarifications</div>
                          {canEdit
                            ? <textarea value={alignment.scopeNotes} onChange={e=>setAlignment(a=>({...a,scopeNotes:e.target.value}))}
                                placeholder="Any scope adjustments, exclusions, or clarifications raised by the end user…"
                                rows={3} style={{ ...styles.input, margin:0, fontSize:12, resize:"vertical" }} />
                            : <div style={{ fontSize:12, color: alignment.scopeNotes ? C.textPri : C.textTer, fontStyle: alignment.scopeNotes ? "normal" : "italic" }}>{alignment.scopeNotes||"—"}</div>
                          }
                        </div>
                      </div>

                      {/* Timeline block */}
                      <div style={{ display:"flex", flexDirection:"column", gap:10, padding:"14px 16px", background:C.offWhite, borderRadius:8, border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:11, fontWeight:700, color:C.textPri, paddingBottom:6, borderBottom:`1px solid ${C.border}` }}>Timeline</div>
                        {AlignField({ label:"Confirmed with *", value:alignment.timelineWith, onChange:v=>setAlignment(a=>({...a,timelineWith:v})), placeholder:"Name of PR User / End User" })}
                        {AlignField({ label:"Date confirmed *", value:alignment.timelineDate, onChange:v=>setAlignment(a=>({...a,timelineDate:v})), type:"date" })}
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:C.textTer, textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:4 }}>Notes / Clarifications</div>
                          {canEdit
                            ? <textarea value={alignment.timelineNotes} onChange={e=>setAlignment(a=>({...a,timelineNotes:e.target.value}))}
                                placeholder="Any timeline concerns, requested completion dates, or constraints raised by the end user…"
                                rows={3} style={{ ...styles.input, margin:0, fontSize:12, resize:"vertical" }} />
                            : <div style={{ fontSize:12, color: alignment.timelineNotes ? C.textPri : C.textTer, fontStyle: alignment.timelineNotes ? "normal" : "italic" }}>{alignment.timelineNotes||"—"}</div>
                          }
                        </div>
                      </div>
                    </div>

                    {/* Optional supporting doc upload */}
                    {canEdit && (
                      <div style={{ padding:"10px 20px 14px", borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ fontSize:11, color:C.textTer }}>Supporting evidence (optional):</div>
                        <label style={{ ...styles.btnSecondary, cursor:"pointer", padding:"4px 12px", fontSize:11 }}>
                          {alignUploading ? "Uploading…" : alignDocName ? "Replace file" : "Upload file"}
                          <input type="file" style={{ display:"none" }} onChange={e=>e.target.files[0]&&uploadAlignDoc(e.target.files[0])} />
                        </label>
                        {alignDocName && (
                          <span style={{ fontSize:11, color:C.textSec }}>📎 {alignDocName}
                            <button onClick={()=>{setAlignDocUrl("");setAlignDocName("");}} style={{ background:"none", border:"none", cursor:"pointer", color:C.textTer, fontSize:12, marginLeft:6 }}>✕</button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              </div>
            );
          })()}
          {/* ══ END TAB 2 ══ */}

        </div>{/* end section-first layout */}


      </div>
    </>
  );
}

// ─── CONTRACTS LIST PAGE ──────────────────────────────────────────────────────
function ContractsListPage({ profile, setPage, setSelectedContractId }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeCard, setActiveCard] = useState(null);

  const contractCardStatusMap = {
    "Draft":       ["Draft"],
    "For Signing": ["For Signing"],
    "Signed":      ["Signed"],
  };

  const fetchContracts = () => {
    setLoading(true);
    supabase.from("contracts")
      .select(`id, contract_number, status, created_at,
        rfas(rfa_number, purchase_requests(pr_number, projects(name))),
        creator:created_by(full_name)`)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setContracts(data || []); setLoading(false); });
  };

  useEffect(() => { fetchContracts(); }, []);

  const contractStatusColors = {
    Draft:         { bg: C.amberBg,  color: C.amberText },
    "For Signing": { bg: "#EFF6FF",  color: "#2563EB"   },
    Signed:        { bg: C.greenBg,  color: C.greenText  },
  };

  const filtered = contracts.filter(c => {
    const s = search.toLowerCase();
    const matchSearch =
      (c.contract_number || "").toLowerCase().includes(s) ||
      (c.rfas?.rfa_number || "").toLowerCase().includes(s) ||
      (c.rfas?.purchase_requests?.projects?.name || "").toLowerCase().includes(s) ||
      (c.creator?.full_name || "").toLowerCase().includes(s);
    let matchStatus;
    if (activeCard && activeCard !== "Total") {
      matchStatus = (contractCardStatusMap[activeCard] || []).includes(c.status);
    } else if (activeCard === "Total") {
      matchStatus = true;
    } else {
      matchStatus = statusFilter === "All" || c.status === statusFilter;
    }
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div style={styles.topBar}>
        <div style={{ flex: 1 }} />
      </div>
      <div style={styles.pageBody}>
        <div style={{ maxWidth: "80%", margin: "0 auto" }}>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            {[
              { label: "Total",       value: contracts.length,                                              color: C.textPri,  desc: "All procurement contracts"  },
              { label: "Draft",       value: contracts.filter(c => c.status === "Draft").length,       color: C.amberText,desc: "Being prepared"               },
              { label: "For Signing", value: contracts.filter(c => c.status === "For Signing").length, color: "#2563EB",  desc: "Awaiting signatures"           },
              { label: "Signed",      value: contracts.filter(c => c.status === "Signed").length,      color: C.greenText,desc: "Fully executed"                },
            ].map(s => {
              const isActive = activeCard === s.label;
              return (
                <div key={s.label}
                  onClick={() => setActiveCard(prev => prev === s.label ? null : s.label)}
                  style={{
                    background: isActive ? C.coralLight : C.white,
                    border: `1px solid ${isActive ? C.coral : C.border}`,
                    borderRadius: 12, padding: "14px 18px",
                    boxShadow: isActive ? `0 0 0 2px ${C.coralMid}` : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)",
                    cursor: "pointer", userSelect: "none",
                    transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
                  }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? C.coralDark : C.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.4 }}>{s.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Search and filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={13} color={C.textTer} /></div>
              <input placeholder="Search contract, RFA, or project…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, paddingLeft: 30, fontSize: 12 }} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...styles.input, width: "auto", fontSize: 12 }}>
              {["All","Draft","For Signing","Signed"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: "center", color: C.textTer, padding: 60 }}>Loading…</div>
          ) : contracts.length === 0 ? (
            <div style={{ textAlign: "center", color: C.textTer, padding: 60, background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No contracts yet</div>
              <div style={{ fontSize: 12 }}>Contracts are created automatically when documents are issued from an approved RFA.</div>
            </div>
          ) : (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)", overflow: "clip" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.coralMid }}>
                    {["Contract No.", "RFA No.", "Project", "Status", "Prepared by", "Date", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontWeight: 600, color: C.coralDark, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: `1px solid ${C.coralLight}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "48px 0", color: C.textTer }}>No contracts found.</td></tr>}
                  {filtered.map((c, i) => (
                    <tr key={c.id}
                      onClick={() => { setSelectedContractId(c.id); setPage("contract_detail"); }}
                      style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.15s" }}
                      onMouseOver={e => e.currentTarget.style.background = C.offWhite}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "9px 14px", fontWeight: 600, color: C.coral, fontFamily: "monospace" }}>{c.contract_number}</td>
                      <td style={{ padding: "9px 14px", color: C.textSec }}>{c.rfas?.rfa_number || "—"}</td>
                      <td style={{ padding: "9px 14px", color: C.textSec }}>{c.rfas?.purchase_requests?.projects?.name || "—"}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ ...contractStatusColors[c.status], fontWeight: 600, fontSize: 11, padding: "3px 10px", borderRadius: 99 }}>{c.status}</span>
                      </td>
                      <td style={{ padding: "9px 14px", color: C.textSec }}>{c.creator?.full_name || "—"}</td>
                      <td style={{ padding: "9px 14px", color: C.textTer, whiteSpace: "nowrap" }}>{fmt(c.created_at)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right" }}><Icon name="chevronRight" size={13} color={C.textTer} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.textTer }}>Showing {filtered.length} of {contracts.length} records</span>
                <button onClick={fetchContracts} style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }}>Refresh</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── CONTRACT DETAIL PAGE ─────────────────────────────────────────────────────
function ContractDetailPage({ profile, setPage, contractId, setSelectedRFAId, setRfaPRId }) {
  const [contract, setContract]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [notes, setNotes]             = useState("");
  const [notesEditing, setNotesEditing] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const fileInputRef = useRef(null);

  const canManage = can(profile, "rfa.approve");

  const statusColors = {
    Draft:       { bg: C.amberBg,  color: C.amberText },
    "For Signing": { bg: "#EFF6FF", color: "#2563EB" },
    Signed:      { bg: C.greenBg,  color: C.greenText },
  };

  useEffect(() => {
    if (!contractId) return;
    supabase.from("contracts")
      .select(`id, contract_number, status, notes, signed_doc_url, signed_doc_name, signed_at, created_at, updated_at,
        rfas(id, rfa_number, purchase_requests(pr_number, projects(name, address))),
        signer:signed_by(full_name),
        creator:created_by(full_name)`)
      .eq("id", contractId).single()
      .then(({ data }) => {
        if (data) { setContract(data); setNotes(data.notes || ""); }
        setLoading(false);
      });
  }, [contractId]);

  const advanceStatus = async (newStatus) => {
    setSaving(true);
    const { error } = await supabase.from("contracts").update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(newStatus === "Signed" ? { signed_at: new Date().toISOString(), signed_by: profile?.id } : {}),
    }).eq("id", contractId);
    if (error) { alert("Error: " + error.message); }
    else setContract(prev => ({ ...prev, status: newStatus, ...(newStatus === "Signed" ? { signed_at: new Date().toISOString() } : {}) }));
    setSaving(false);
  };

  const saveNotes = async () => {
    setSaving(true);
    await supabase.from("contracts").update({ notes, updated_at: new Date().toISOString() }).eq("id", contractId);
    setContract(prev => ({ ...prev, notes }));
    setNotesEditing(false);
    setSaving(false);
  };

  const uploadSignedDoc = async (file) => {
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `contracts/${contractId}/signed-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("pr-documents").upload(path, file);
    if (upErr) { alert("Upload failed: " + upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("pr-documents").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("contracts").update({
      signed_doc_url: urlData.publicUrl,
      signed_doc_name: file.name,
      updated_at: new Date().toISOString(),
    }).eq("id", contractId);
    if (dbErr) { alert("Error saving URL: " + dbErr.message); }
    else setContract(prev => ({ ...prev, signed_doc_url: urlData.publicUrl, signed_doc_name: file.name }));
    setUploading(false);
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}><div style={{ fontSize: 13, color: C.textTer }}>Loading…</div></div>;
  if (!contract) return <div style={{ padding: 40, textAlign: "center", color: C.textTer }}>Contract not found.</div>;

  const rfa = contract.rfas;
  const pr  = rfa?.purchase_requests;

  return (
    <>
      <div style={styles.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <button onClick={() => setPage("contracts")} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSec, padding: 0, fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="chevronLeft" size={14} color={C.textTer} /> Contracts
            </button>
            <Icon name="chevronRight" size={12} color={C.textTer} />
            <span style={{ color: C.textPri, fontWeight: 500, fontFamily: "monospace" }}>{contract.contract_number}</span>
            <span style={{ ...statusColors[contract.status], fontWeight: 600, fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>{contract.status}</span>
          </div>
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8 }}>
            {contract.status === "Draft" && (
              <button style={styles.btnPrimary} onClick={() => advanceStatus("For Signing")} disabled={saving}>
                {saving ? "Saving…" : "Send for Signing"}
              </button>
            )}
            {contract.status === "For Signing" && (
              <>
                <button style={styles.btnSecondary} onClick={() => advanceStatus("Draft")} disabled={saving}>Back to Draft</button>
                <button style={{ ...styles.btnPrimary, background: C.greenText, borderColor: C.greenText }} onClick={() => advanceStatus("Signed")} disabled={saving || !contract.signed_doc_url}
                  title={!contract.signed_doc_url ? "Upload the signed copy first" : undefined}>
                  {saving ? "Saving…" : "Mark as Signed"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div style={styles.pageBody}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>

          {/* Main panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Contract info card */}
            <div style={{ ...styles.card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.04em" }}>Contract Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { label: "Contract No.", value: contract.contract_number, mono: true },
                  { label: "Status",       value: contract.status },
                  { label: "Linked RFA",   value: rfa?.rfa_number || "—" },
                  { label: "Project",      value: pr?.projects?.name || "—" },
                  { label: "PR No.",       value: pr?.pr_number || "—" },
                  { label: "Created",      value: fmt(contract.created_at) },
                  { label: "Prepared by",  value: contract.creator?.full_name || "—" },
                  { label: "Last updated", value: fmt(contract.updated_at) },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textTer, textTransform: "uppercase", marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 12, fontWeight: f.mono ? 600 : 400, fontFamily: f.mono ? "monospace" : "inherit", color: C.textPri }}>{f.value}</div>
                  </div>
                ))}
              </div>
              {rfa && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => { if (setSelectedRFAId) setSelectedRFAId(rfa.id); if (setRfaPRId) setRfaPRId(null); setPage("rfa_form"); }}
                    style={{ ...styles.btnGhost, fontSize: 11 }}>
                    View RFA {rfa.rfa_number} →
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ ...styles.card }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, textTransform: "uppercase", letterSpacing: "0.04em" }}>Notes</div>
                {canManage && !notesEditing && (
                  <button style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }} onClick={() => setNotesEditing(true)}>Edit</button>
                )}
              </div>
              {notesEditing ? (
                <>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                    style={{ ...styles.input, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 12 }}
                    placeholder="Add contract notes, special conditions, or remarks…" />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button style={styles.btnPrimary} onClick={saveNotes} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                    <button style={styles.btnGhost} onClick={() => { setNotes(contract.notes || ""); setNotesEditing(false); }}>Cancel</button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: notes ? C.textPri : C.textTer, fontStyle: notes ? "normal" : "italic", whiteSpace: "pre-wrap", minHeight: 40 }}>
                  {notes || "No notes added."}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: signed document */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...styles.card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Signed Contract</div>
              {contract.signed_doc_url ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: C.greenBg, borderRadius: 8, border: `1px solid ${C.greenText}30` }}>
                    <Icon name="file" size={14} color={C.greenText} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.greenText, flex: 1, wordBreak: "break-all" }}>{contract.signed_doc_name || "signed-contract.pdf"}</span>
                  </div>
                  {contract.signed_at && (
                    <div style={{ fontSize: 11, color: C.textTer }}>
                      Signed {fmt(contract.signed_at)}{contract.signer?.full_name ? ` by ${contract.signer.full_name}` : ""}
                    </div>
                  )}
                  <a href={contract.signed_doc_url} target="_blank" rel="noopener noreferrer"
                    style={{ ...styles.btnGhost, fontSize: 11, textAlign: "center", display: "block", textDecoration: "none" }}>
                    View Document
                  </a>
                  {canManage && (
                    <button style={{ ...styles.btnGhost, fontSize: 11 }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? "Uploading…" : "Replace"}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: C.textTer, textAlign: "center", padding: "20px 0" }}>
                    No signed copy uploaded yet.
                  </div>
                  {canManage && (
                    <button style={styles.btnSecondary} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? "Uploading…" : "Upload Signed Copy"}
                    </button>
                  )}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.png" style={{ display: "none" }}
                onChange={e => { if (e.target.files?.[0]) uploadSignedDoc(e.target.files[0]); e.target.value = ""; }} />
            </div>

            {/* Status timeline */}
            <div style={{ ...styles.card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textPri, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Status Flow</div>
              {[
                { s: "Draft",        label: "Draft",       desc: "Contract created, pending review" },
                { s: "For Signing",  label: "For Signing", desc: "Sent to parties for signature" },
                { s: "Signed",       label: "Signed",      desc: "Fully executed contract" },
              ].map((step, i) => {
                const statuses = ["Draft", "For Signing", "Signed"];
                const current  = statuses.indexOf(contract.status);
                const done     = i < current;
                const active   = i === current;
                return (
                  <div key={step.s} style={{ display: "flex", gap: 10, marginBottom: i < 2 ? 12 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
                        background: done ? C.greenText : active ? C.coral : C.offWhite,
                        color: done || active ? "#fff" : C.textTer,
                        border: `2px solid ${done ? C.greenText : active ? C.coral : C.border}` }}>
                        {done ? "✓" : i + 1}
                      </div>
                      {i < 2 && <div style={{ width: 2, flex: 1, minHeight: 16, background: done ? C.greenText : C.border, margin: "3px 0" }} />}
                    </div>
                    <div style={{ paddingTop: 2 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: active ? C.coral : done ? C.greenText : C.textSec }}>{step.label}</div>
                      <div style={{ fontSize: 11, color: C.textTer }}>{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PlaceholderPage({ title }) {
  return (
    <>
      <div style={{ ...styles.pageBody, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.textSec }}>{title}</div>
          <div style={{ fontSize: 12, marginTop: 4, color: C.textTer }}>This section will be built in the next phase.</div>
        </div>
      </div>
    </>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [selectedPRId, setSelectedPRId] = useState(null);
  const [selectedRFPId, setSelectedRFPId] = useState(null);
  const [selectedRFAId, setSelectedRFAId] = useState(null);
  const [selectedRFQId, setSelectedRFQId] = useState(null);
  const [rfaPRId, setRfaPRId] = useState(null);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ph1LogoUrl, setPh1LogoUrl] = useState(null);

  useEffect(() => {
    // Fetch PH1 World Developers Inc. logo for loading screen (public, no auth needed)
    supabase.from("business_units").select("logo_url").eq("name", "PH1 World Developers Inc.").maybeSingle()
      .then(({ data }) => { if (data?.logo_url) setPh1LogoUrl(data.logo_url); });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from("profiles").select("id, full_name, position, is_admin").eq("id", userId).single();
    if (data) setProfile(data);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setPage("dashboard"); };

  if (session === undefined) return <LoadingScreen logoUrl={ph1LogoUrl} />;
  if (!session) return <LoginPage />;

  const activeSidebarPage = ["create", "detail"].includes(page) ? "dashboard"
    : ["rfp_create", "rfp_detail"].includes(page) ? "rfps"
    : ["rfa_form"].includes(page) ? "rfa_list"
    : ["contract_detail"].includes(page) ? "contracts"
    : page;

  const pageTitleMap = {
    dashboard:    "Purchase Requests",
    create:       "Create Purchase Request",
    detail:       "PR Detail",
    projects:     "Projects",
    rfps:         "RFPs",
    rfp_create:   "Create RFP",
    rfp_detail:   "RFP Detail",
    vendors:      "Vendors",
    users:        "Users & Roles",
    rfa_list:        "Recommendations for Award",
    rfa_form:        "Rec. for Award",
    contracts:       "Contracts",
    contract_detail: "Contract Detail",
    settings:        "Settings",
    budget_codes:    "Budget Codes",
  };

  const pageMap = {
    dashboard:  <DashboardPage  setPage={setPage} setSelectedPRId={setSelectedPRId} profile={profile} />,
    create:     <CreatePRPage   setPage={setPage} profile={profile} />,
    detail:     <PRDetailPage   prId={selectedPRId} setPage={setPage} profile={profile} setSelectedRFAId={setSelectedRFAId} setRfaPRId={setRfaPRId} setSelectedRFQId={setSelectedRFQId} />,
    projects:   <ProjectsPage   profile={profile} />,
    rfps:       <RFPsPage       profile={profile} setPage={setPage} setSelectedRFPId={setSelectedRFPId} />,
    rfp_create: <RFPCreatePage  profile={profile} setPage={setPage} />,
    rfp_detail: <RFPDetailPage   rfpId={selectedRFPId} profile={profile} setPage={setPage} setSelectedRFAId={setSelectedRFAId} setRfaPRId={setRfaPRId} />,
    vendors:    <VendorsPage    profile={profile} />,
    reports:    <PlaceholderPage title="Reports" />,
    users:        <UsersPage        profile={profile} />,
    budget_codes: <BudgetCodesPage profile={profile} />,
    rfa_list:        <RFAListPage       profile={profile} setPage={setPage} setSelectedRFAId={setSelectedRFAId} setRfaPRId={setRfaPRId} />,
    rfa_form:        <RFAFormPage       profile={profile} setPage={setPage} rfaId={selectedRFAId} prId={rfaPRId} setSelectedPRId={setSelectedPRId} setSelectedContractId={setSelectedContractId} />,
    contracts:       <ContractsListPage profile={profile} setPage={setPage} setSelectedContractId={setSelectedContractId} />,
    contract_detail: <ContractDetailPage profile={profile} setPage={setPage} contractId={selectedContractId} setSelectedRFAId={setSelectedRFAId} setRfaPRId={setRfaPRId} />,
    rfq_list:        <RFQListPage profile={profile} setPage={setPage} setSelectedRFQId={setSelectedRFQId} />,
    rfq_detail:      <RFQDetailPage profile={profile} rfqId={selectedRFQId} setPage={setPage} />,
    settings:        <SettingsPage      profile={profile} />,
  };

  return (
    <SidebarCtx.Provider value={{ toggle: () => setSidebarOpen(o => !o) }}>
    <div style={styles.appShell}>
      {/* Full-width fixed header */}
      <AppHeader profile={profile} pageTitle={pageTitleMap[page] || ""} />

      {/* Sidebar overlay drawer */}
      <Sidebar
        page={activeSidebarPage} setPage={(p) => { setPage(p); setSidebarOpen(false); }}
        profile={profile} onLogout={handleLogout}
        open={sidebarOpen} onClose={() => setSidebarOpen(false)}
      />

      {/* Backdrop — closes sidebar on click */}
      <div style={styles.sidebarBackdrop(sidebarOpen)} onClick={() => setSidebarOpen(false)} />

      {/* Main content — always full width */}
      <div style={styles.mainContent}>{pageMap[page] || pageMap.dashboard}</div>
    </div>
    </SidebarCtx.Provider>
  );
}