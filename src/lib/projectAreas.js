// Buildings / areas of a project (where the work is). Saved on projects.areas as
// [{ id, name, kind, units, active }]; a PR keeps the ids of the areas it covers.
//   kind: "tower" (condominium towers) | "unit_type" (housing units) | "area" (everything else)
// Areas are never deleted, only unticked (active: false), so older PRs keep their names.

export const PROJECT_TYPES = ["Condominium", "Housing"];

const CONDO_AREAS = ["Parking Building", "Site Development", "Amenities", "Add-Ons", "Professional Fees", "Pre-Engineering"];
const HOUSING_UNIT_TYPES = ["TH End", "TH Mid", "SA"];
const HOUSING_AREAS = ["Site Development", "Amenities", "Temporary Sales Office", "Gate and Guardhouse", "Model Unit ID", "Add-on Solar", "Professional Fees", "Pre-Engineering"];
const START_UNTICKED = new Set(["Add-Ons", "Add-on Solar"]);

export const AREA_KIND_LABEL = { tower: "Tower", unit_type: "Unit type", area: "Area" };
const KIND_ORDER = { tower: 0, unit_type: 1, area: 2 };

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const make = (name, kind) => ({ id: slug(name), name, kind, units: null, active: !START_UNTICKED.has(name) });
const tower = (n) => ({ id: `tower-${n}`, name: `Tower ${n}`, kind: "tower", units: null, active: true });
const towerNo = (a) => Number(String(a.id).replace("tower-", "")) || 0;

// Towers (by number), then unit types, then other areas; otherwise keeps the order given
const ordered = (areas) => areas
  .map((a, i) => ({ a, i }))
  .sort((x, y) => (KIND_ORDER[x.a.kind] ?? 2) - (KIND_ORDER[y.a.kind] ?? 2)
    || (x.a.kind === "tower" ? towerNo(x.a) - towerNo(y.a) : 0) || x.i - y.i)
  .map(x => x.a);

export function defaultAreas(type, towers = 1) {
  if (type === "Housing") {
    return [...HOUSING_UNIT_TYPES.map(n => ({ ...make(n, "unit_type"), active: true })), ...HOUSING_AREAS.map(n => make(n, "area"))];
  }
  return [...Array.from({ length: Math.max(1, towers) }, (_, i) => tower(i + 1)), ...CONDO_AREAS.map(n => make(n, "area"))];
}

export const activeAreas = (areas) => (areas || []).filter(a => a.active);
export const towerCount = (areas) => activeAreas(areas).filter(a => a.kind === "tower").length;

export function setTowerCount(areas, n) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const list = areas.map(a => a.kind === "tower" ? { ...a, active: towerNo(a) <= count } : a);
  for (let i = 1; i <= count; i++) {
    if (!list.some(a => a.id === `tower-${i}`)) list.push(tower(i));
  }
  return ordered(list);
}

export const hasAreaName = (areas, name) =>
  (areas || []).some(a => a.name.trim().toLowerCase() === String(name).trim().toLowerCase());

export function addArea(areas, name, kind = "area") {
  const clean = String(name).trim();
  const id = `${slug(clean) || "area"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  return ordered([...areas, { id, name: clean, kind, units: null, active: true }]);
}

export const totalUnits = (areas) => activeAreas(areas).reduce((s, a) => s + (Number(a.units) || 0), 0);

export function areaSummary(type, areas) {
  const on = activeAreas(areas);
  if (!on.length) return "";
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const main = type === "Housing"
    ? plural(on.filter(a => a.kind === "unit_type").length, "unit type")
    : plural(on.filter(a => a.kind === "tower").length, "tower");
  const others = plural(on.filter(a => a.kind === "area").length, "other area");
  const units = totalUnits(on);
  return [main, others, units ? `${units.toLocaleString("en-US")} units` : ""].filter(Boolean).join(" · ");
}

// Names for the area ids saved on a PR (unticked areas still have names)
export const areaNames = (areas, ids) =>
  (ids || []).map(id => (areas || []).find(a => a.id === id)?.name).filter(Boolean);

// Changing a project's type: the new type's standard list, keeping what was set for shared
// areas; areas only the old type had stay in the list, unticked
export function switchType(prev, type) {
  const next = defaultAreas(type, Math.max(1, towerCount(prev))).map(d => {
    const old = prev.find(a => a.id === d.id);
    return old ? { ...d, name: old.name, units: old.units, active: d.kind === "tower" ? true : old.active } : d;
  });
  const leftovers = prev.filter(a => !next.some(d => d.id === a.id)).map(a => ({ ...a, active: false }));
  return ordered([...next, ...leftovers]);
}
