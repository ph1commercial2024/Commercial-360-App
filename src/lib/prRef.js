/** Returns the canonical text identifier for a purchase_request row. */
export const prRef = (pr) => pr.pr_number;

/** Generates a PR number string from a sequential count and year. */
export const generatePRNumber = (count, year) =>
  `PR-${year}-${String(count).padStart(4, "0")}`;
