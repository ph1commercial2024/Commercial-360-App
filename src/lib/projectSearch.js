// Type-to-search for the project pickers: every typed word must appear in the
// project's name, short name, project code or business unit.
const haystack = (p) =>
  [p.name, p.short_name, p.project_code, p.business_unit].filter(Boolean).join(" ").toLowerCase();

export function matchProjects(projects, query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return projects;
  const q = words.join(" ");
  return projects
    .filter(p => words.every(w => haystack(p).includes(w)))
    // Names starting with what was typed come first; otherwise keep the original order
    .map((p, i) => ({ p, i, starts: (p.name || "").toLowerCase().startsWith(q) ? 0 : 1 }))
    .sort((a, b) => a.starts - b.starts || a.i - b.i)
    .map(x => x.p);
}

export const projectLabel = (p) => (p ? p.name + (p.short_name ? ` · ${p.short_name}` : "") : "");
