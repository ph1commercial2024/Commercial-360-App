export const SCOPE_UNITS = ["m²", "m³", "lm", "pcs", "set", "unit", "kg", "month", "visit", "lot"];
export const BY_OTHERS_WHO = ["Owner-supplied", "Separate contractor", "Existing"];

export const scopeKey = (workType, label) => `${workType}||${label}`;
export const splitKey = (key) => { const i = key.indexOf("||"); return [key.slice(0, i), key.slice(i + 2)]; };

// Scope of works, version 2: types chosen, items included (each with one or more lines), items by others
export const emptyScope = () => ({ version: 2, types: [], custom: {}, included: [], byOthers: {}, lines: {}, confirmed: false });
export const emptyLine = (unit = "") => ({ spec: "", qty: "", unit, location: "" });

const qtyNum = (q) => parseFloat(String(q ?? "").replace(/,/g, ""));

export function lineComplete(l) {
  const spec = String(l.spec || "").trim();
  if (!spec || !(qtyNum(l.qty) > 0) || !l.unit) return false;
  return l.unit !== "lot" || spec.length >= 12;
}

const activeIncluded = (s) => s.included.filter(k => s.types.includes(splitKey(k)[0]));
const activeByOthers = (s) => Object.entries(s.byOthers).filter(([k]) => s.types.includes(splitKey(k)[0]));

export function scopeStats(s) {
  const items = activeIncluded(s);
  const lines = items.flatMap(k => s.lines[k] || []);
  const bo = activeByOthers(s);
  return {
    types: s.types.length, items: items.length, lines: lines.length, done: lines.filter(lineComplete).length,
    byOthers: bo.length, missingWho: bo.filter(([, who]) => !who).length,
  };
}

/** What still blocks sending the PR, in plain words. Empty when the scope is ready. */
export function scopeProblems(s) {
  const st = scopeStats(s);
  if (st.types === 0) return ["Choose at least one work type in the Scope of Works."];
  const p = [];
  if (st.items === 0) p.push("Include at least one work in the Scope of Works.");
  if (st.done < st.lines) p.push(`${st.lines - st.done} line${st.lines - st.done > 1 ? "s are" : " is"} missing a spec, quantity or unit (Scope of Works, step 3).`);
  if (st.missingWho) p.push(`${st.missingWho} "By others" item${st.missingWho > 1 ? "s don't" : " doesn't"} say who (Scope of Works, step 2).`);
  if (!s.confirmed) p.push("Confirm the scope on the Summary step of the Scope of Works.");
  return p;
}

/** One scope item per line, in the order chosen; these feed the RFQ, RFA and vendor portal. */
export function toScopeItems(s) {
  const out = [];
  for (const wt of s.types) {
    for (const k of s.included.filter(x => splitKey(x)[0] === wt)) {
      const label = splitKey(k)[1];
      for (const l of s.lines[k] || []) {
        if (!lineComplete(l)) continue;
        const loc = String(l.location || "").trim();
        out.push({
          description: `${label} — ${String(l.spec).trim()}${loc ? ` (${loc})` : ""}`,
          quantity: qtyNum(l.qty),
          unit_of_measure: l.unit,
          sort_order: out.length,
        });
      }
    }
  }
  return out;
}

/** Reads a saved scope: the old Required / Not Required checklist becomes version 2 (included items get one empty line). */
export function fromLegacyScope(saved) {
  if (!saved) return emptyScope();
  if (!Array.isArray(saved)) return saved;
  const s = emptyScope();
  for (const wt of saved) {
    s.types.push(wt.workType);
    for (const it of wt.items || []) {
      const label = String(it.label || "").trim();
      if (!label || it.status !== "required") continue;
      const k = scopeKey(wt.workType, label);
      s.included.push(k);
      s.lines[k] = [emptyLine(defaultUnit(label))];
      if (it.isCustom) (s.custom[wt.workType] = s.custom[wt.workType] || []).push(label);
    }
  }
  return s;
}

export function defaultUnit(label) {
  const s = String(label).toLowerCase();
  if (/site visit|inspection/.test(s)) return "visit";
  if (/officer|supervision|management|rental|temporary site office|bodega|comfort room/.test(s)) return "month";
  if (/insurance|permit|license|design|survey|study|report|model|drawing|manual|review|commissioning/.test(s)) return "lot";
  if (/floor|tiling|tiles|paint|plaster|ceiling|waterproof|cladding|curtain wall|insulation|pavers|turf|planting/.test(s)) return "m²";
  if (/concrete|earthworks|fill/.test(s)) return "m³";
  if (/curb|gutter|railing|balustrade|pipe|conduit|wiring/.test(s)) return "lm";
  if (/elevator|escalator|panel|fixture|door|window|pump|tank/.test(s)) return "unit";
  return "";
}
