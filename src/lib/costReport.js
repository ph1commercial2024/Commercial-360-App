import { toDateStr } from "./dates.js";

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const toNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/[₱,\s]/g, "").trim();
  if (!s || s === "-") return 0;
  const neg = /^\(.*\)$/.test(s);
  const n = parseFloat(s.replace(/[()]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

// "…0006.1" is a sub-line of the line above; "…BUDGET.0001" and "…000CT1" are not
const isSubCode = (code) => {
  const parts = code.split(".");
  return parts.length >= 2 && /^\d{1,3}$/.test(parts[parts.length - 1]) && /^\d+$/.test(parts[parts.length - 2]);
};

/**
 * Reads the "Budget Vs Awarded" sheet (array of rows from XLSX sheet_to_json with header: 1).
 * Returns { reportDate, projectText, lines }. Money left = approved budget − awarded − approved VOs.
 */
export function parseCostReport(rows) {
  const headerIdx = rows.findIndex(r => Array.isArray(r) && r.some(c => norm(c) === "budget code"));
  if (headerIdx < 0) throw new Error('Could not find the "Budget Code" column header. Is this the "Budget Vs Awarded" sheet?');

  let reportDate = null, projectText = null;
  for (const r of rows.slice(0, headerIdx)) {
    const first = String((r || []).find(c => String(c ?? "").trim()) ?? "").trim();
    const dm = first.match(/^date\s*:\s*(.+)$/i);
    if (dm && !reportDate) {
      const d = new Date(dm[1]);
      if (!isNaN(d)) reportDate = toDateStr(d);
    }
    const pm = first.match(/^project\s*:\s*(.+)$/i);
    if (pm && !projectText) projectText = pm[1].trim();
  }

  // Work Packages and Variation Order share header names, so map by order of appearance
  const header = rows[headerIdx].map(norm);
  const col = {};
  let forApprovalSeen = 0;
  header.forEach((h, i) => {
    if (h === "budget code") col.code = i;
    else if (h === "items") col.items = i;
    else if (h === "particulars") col.particulars = i;
    else if (h === "qty") col.qty = i;
    else if (h === "unit") col.unit = i;
    else if (h === "approved budget") col.approved_budget = i;
    else if (h === "awarded") col.awarded = i;
    else if (h === "for approval") { col[forApprovalSeen++ === 0 ? "wp_for_approval" : "vo_for_approval"] = i; }
    else if (h === "anticipated") col.anticipated = i;
    else if (h === "approved") col.vo_approved = i;
    else if (h === "waiting direction") col.vo_waiting = i;
    else if (h === "ongoing evaluation") col.vo_ongoing = i;
    else if (h.startsWith("anticipated -") || h.startsWith("anticipated –")) col.vo_anticipated = i;
    else if (h.startsWith("projected cost")) col.projected_cost = i;
  });
  for (const need of ["code", "approved_budget", "awarded"]) {
    if (col[need] === undefined) throw new Error(`Missing the "${need.replace("_", " ")}" column in the cost report.`);
  }

  const cell = (r, key) => (col[key] === undefined ? "" : r[col[key]]);
  const lines = [];
  let group = null;
  let lastMain = null;

  for (const r of rows.slice(headerIdx + 1)) {
    if (!Array.isArray(r)) continue;
    const code = String(cell(r, "code") ?? "").trim();
    const items = String(cell(r, "items") ?? "").trim();
    const particulars = String(cell(r, "particulars") ?? "").trim();
    if (norm(code) === "total") break;
    if (!code) continue;
    if (!items && !particulars) { group = code; lastMain = null; continue; }

    const sub = isSubCode(code) && lastMain !== null;
    const line = {
      sort_order: lines.length,
      group,
      code,
      items,
      name: particulars || items,
      qty: toNumber(cell(r, "qty")) || null,
      unit: String(cell(r, "unit") ?? "").trim() || null,
      approved_budget: round2(toNumber(cell(r, "approved_budget"))),
      awarded: round2(toNumber(cell(r, "awarded"))),
      wp_for_approval: round2(toNumber(cell(r, "wp_for_approval"))),
      anticipated: round2(toNumber(cell(r, "anticipated"))),
      vo_approved: round2(toNumber(cell(r, "vo_approved"))),
      vo_for_approval: round2(toNumber(cell(r, "vo_for_approval"))),
      vo_waiting: round2(toNumber(cell(r, "vo_waiting"))),
      vo_ongoing: round2(toNumber(cell(r, "vo_ongoing"))),
      vo_anticipated: round2(toNumber(cell(r, "vo_anticipated"))),
      projected_cost: round2(toNumber(cell(r, "projected_cost"))),
      parent_code: sub ? lastMain.code : null,
      is_parent: false,
      is_contingency: /contingency/i.test(items) || /contingency/i.test(particulars) || /CT\d*$/i.test(code),
    };
    line.money_left = round2(line.approved_budget - line.awarded - line.vo_approved);
    if (sub) lastMain.is_parent = true;
    else lastMain = line;
    lines.push(line);
  }

  return { reportDate, projectText, lines };
}

/** Budgeted only when every picked line still has money left and none is contingency. */
export function decideBudget(lines, { noLine = false } = {}) {
  if (noLine) return { status: "Unbudgeted", reasons: ["No budget line in the cost report covers this work."] };
  if (!lines || lines.length === 0) return { status: null, reasons: [] };
  const peso = (n) => "₱" + Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const reasons = [];
  for (const l of lines) {
    if (l.is_contingency) reasons.push(`${l.name}: charging contingency needs the D&C Head.`);
    else if (l.money_left < 0) reasons.push(`${l.name} is over budget by ${peso(l.money_left)}.`);
    else if (l.money_left === 0) reasons.push(`${l.name} has no money left.`);
  }
  return { status: reasons.length ? "Unbudgeted" : "Budgeted", reasons };
}

// Finds the item table's header row: the first row containing every required header (matched by prefix)
function findTable(rows, required) {
  if (!Array.isArray(rows)) return null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const h = r.map(norm);
    if (required.every(req => h.some(c => c.startsWith(req)))) {
      const col = (prefix, nth = 0) => { let seen = 0; for (let j = 0; j < h.length; j++) if (h[j].startsWith(prefix) && seen++ === nth) return j; return -1; };
      return { start: i + 1, col };
    }
  }
  return null;
}

const text = (r, i) => (i < 0 ? "" : String(r[i] ?? "").trim());

/** Awarded work packages from the WPP sheet: one item per row with a budget code and Award Status "Awarded". */
export function parseAwardItems(rows) {
  const t = findTable(rows, ["wpp no", "budget code", "awarded"]);
  if (!t) return [];
  const c = {
    item: t.col("item no"), ref: t.col("wpp no"), desc: t.col("particular"), code: t.col("budget code"),
    amount: t.col("awarded"), award: t.col("award no"), status: t.col("award status"), vendor: t.col("vendor"),
  };
  const items = [];
  for (const r of rows.slice(t.start)) {
    if (!Array.isArray(r)) continue;
    if (norm(r[c.item]) === "total" || norm(r[c.award]) === "total") break;
    const code = text(r, c.code);
    if (!code || norm(text(r, c.status)) !== "awarded") continue;
    items.push({
      kind: "award", code, ref: text(r, c.ref) || null, sub_ref: text(r, c.award) || null,
      description: text(r, c.desc) || null, vendor: text(r, c.vendor) || null, category: null,
      amount: round2(toNumber(r[c.amount])),
    });
  }
  return items;
}

/** Approved PMIs and claims from the PMIs sheet: one item per row with a budget code and STATUS "Approved". */
export function parseVOItems(rows) {
  const t = findTable(rows, ["pmi no", "approved cost", "budget code", "status"]);
  if (!t) return [];
  const c = {
    ref: t.col("co no"), pmi: t.col("pmi no"), desc: t.col("description"), amount: t.col("approved cost"),
    status: t.col("status"), code: t.col("budget code"),
  };
  const items = [];
  for (const r of rows.slice(t.start)) {
    if (!Array.isArray(r)) continue;
    const code = text(r, c.code);
    if (!code || norm(text(r, c.status)) !== "approved") continue;
    items.push({
      kind: "vo", code, ref: text(r, c.ref) || null, sub_ref: text(r, c.pmi) || null,
      description: text(r, c.desc) || null, vendor: null, category: text(r, 0) || null,
      amount: round2(toNumber(r[c.amount])),
    });
  }
  return items;
}

/** Compares each line's awarded + approved VOs with the sum of its items. Lines with no items at all are not flagged. */
export function reconcileItems(lines, items) {
  const byCode = new Map();
  for (const it of items) byCode.set(it.code, round2((byCode.get(it.code) || 0) + it.amount));
  const codes = new Set(lines.map(l => l.code));
  const mismatches = [];
  for (const l of lines) {
    if (!byCode.has(l.code)) continue;
    const expected = round2(l.awarded + l.vo_approved);
    const found = byCode.get(l.code);
    if (Math.abs(expected - found) > 0.01) mismatches.push({ code: l.code, expected, found });
  }
  const unmatched = [...byCode].filter(([code]) => !codes.has(code)).map(([code, amount]) => ({ code, amount }));
  return { mismatches, unmatched };
}
