import { scopeProblemItems } from "./scopeOfWorks.js";

// Pure rules for the Purchase Request form: what is still missing before it can be saved as a draft
// or submitted. No React and no database in here, so the form and its tests share one source of truth.

const DOC_LABELS = { plans: "Plans", tor: "Terms of Reference", specs: "Specifications" };

/**
 * input: {
 *   projectId, projectHasAreas, areas,
 *   description, justification, isRush, rushJustification,
 *   startDate, endDate (YYYY-MM-DD strings), minDate (YYYY-MM-DD), minDays,
 *   scope,
 *   isReviewerCreating, isManagerCreating,   // the creator's role; neither = Supervisor
 *   managerId,                               // Supervisors only need one
 *   budgetStatus,                            // Commercial staff (reviewers) only need one
 *   docModes, docLinks, docFiles, existingDocs   // each keyed plans / tor / specs
 * }
 * Returns { draft, submit }, each a list of { section, message, step?, doc?, blocksDraft? }.
 * "submit" includes everything in "draft" (those items carry blocksDraft: true), in the order the form shows them.
 */
export function prSubmitProblems(input) {
  const {
    projectId, projectHasAreas, areas = [], description = "", justification = "", isRush, rushJustification = "",
    startDate = "", endDate = "", minDate, minDays, scope,
    isReviewerCreating = false, isManagerCreating = false, managerId, budgetStatus,
    docModes = {}, docLinks = {}, docFiles = {}, existingDocs = {},
  } = input;
  const needsManager = !isReviewerCreating && !isManagerCreating; // Supervisor
  const needsBudget = !!isReviewerCreating;                       // Commercial staff

  const draft = [];
  const d = (section, message) => draft.push({ section, message, blocksDraft: true });
  if (!projectId) d("project", "Select a project.");
  if (projectId && projectHasAreas && areas.length === 0) d("project", "Pick the building(s) / area(s) this work is for.");
  if (!description.trim()) d("details", "Enter a description.");
  if (!justification.trim()) d("details", "Enter a justification.");
  if (isRush && !rushJustification.trim()) d("dates", "Explain the reason for the late (rush) request.");
  if (!startDate) d("dates", "Select a start date.");
  if (!endDate) d("dates", "Select an end date.");
  if (startDate && endDate && endDate < startDate) d("dates", "The end date must be on or after the start date.");

  // Everything below is only needed to submit
  const extra = [];
  if (startDate && minDate && startDate < minDate) {
    extra.push({ section: "dates", message: `The start date must be on or after ${minDate} (${minDays}-day lead time${isRush ? " for rush requests" : ""}). Pick a later date.` });
  }
  for (const { message, step } of scope ? scopeProblemItems(scope) : []) {
    extra.push({ section: "scope", message, step });
  }
  if (needsManager && !managerId) extra.push({ section: "manager", message: "Select a Manager to send to." });
  if (needsBudget && !budgetStatus) extra.push({ section: "budget", message: 'Tick at least one budget line, or "No budget line covers this work".' });
  for (const doc of ["plans", "tor", "specs"]) {
    const label = DOC_LABELS[doc];
    if (docModes[doc] === "link") {
      if (!String(docLinks[doc] || "").trim()) extra.push({ section: "documents", doc, message: `${label}: provide a link.` });
    } else if (!docFiles[doc] && !existingDocs[doc]) {
      extra.push({ section: "documents", doc, message: `${label}: upload a file.` });
    }
  }

  // Keep the form's top-to-bottom order: project, Manager, details, dates, scope, budget, documents
  const order = ["project", "manager", "details", "dates", "scope", "budget", "documents"];
  const submit = [...draft, ...extra].sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
  return { draft, submit };
}

/** Does this click submit? Only a Supervisor's "Save draft" (sendToGM false) does not; Manager and Commercial staff buttons always submit. */
export function isSubmitClick({ isReviewerCreating = false }, sendToGM) {
  return !!sendToGM || !!isReviewerCreating;
}

/** The list that blocks this click: the draft list for a Save draft click, the submit list for anything that submits. */
export function blockersFor(problems, role, sendToGM) {
  return isSubmitClick(role, sendToGM) ? problems.submit : problems.draft;
}

/** Only creators with a Save draft button (everyone except Commercial staff) see the "needed to save a draft" tags. */
export function canSaveDraft({ isReviewerCreating = false }) {
  return !isReviewerCreating;
}

/** The amber checklist panel is shown only while 1 to 3 items are left; with more it is hidden (only the button tooltip shows the count). */
export const CHECKLIST_MAX = 3;
export function checklistVisible(count) {
  return count >= 1 && count <= CHECKLIST_MAX;
}

/**
 * What an unavailable button click should do. null = nothing blocks it (go ahead and save).
 * { kind: "checklist" } = the panel is showing, scroll to it. { kind: "item", item } = the panel is hidden,
 * jump straight to the first item that blocks THIS click.
 */
export function clickTarget(problems, role, sendToGM) {
  const blockers = blockersFor(problems, role, sendToGM);
  if (!blockers.length) return null;
  if (checklistVisible(problems.submit.length)) return { kind: "checklist" };
  return { kind: "item", item: blockers[0] };
}
