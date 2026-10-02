/** Formats a Date as YYYY-MM-DD using the local calendar day (not UTC, which shifts days in UTC+8). */
export const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Parses a stored YYYY-MM-DD (or timestamp) string into local midnight of that day. */
export const fromDateStr = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
