// ─── Doc Expiry Notification Logic ───────────────────────────────────────────
// Pure functions shared between the admin UI and the check-doc-expiry edge function.

/** Trigger days relative to expiry (positive = before, negative = after) */
export const TRIGGER_DAYS = [40, 30, 7, 0, -7, -30];

/**
 * How many days until the doc expires.
 * Positive = future (not yet expired), negative = past (already expired), 0 = expires today.
 * @param {string} expiryDate  ISO date string e.g. "2026-09-20"
 * @param {Date}   today       Reference date (defaults to now)
 * @returns {number}
 */
export function computeDaysToExpiry(expiryDate, today = new Date()) {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const e = new Date(expiryDate);
  e.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - t.getTime()) / 86_400_000);
}

/**
 * Whether today is one of the scheduled email trigger days for a given doc.
 * @param {number} daysToExpiry
 * @returns {boolean}
 */
export function isOnTriggerDay(daysToExpiry) {
  return TRIGGER_DAYS.includes(daysToExpiry);
}

/**
 * Whether an email should be sent for this vendor/doc/trigger/expiry combination.
 * Returns false if the email was already sent (deduplication).
 * @param {string} vendorId
 * @param {string} docType
 * @param {number} triggerDay
 * @param {string} expiryDateRef  ISO date string
 * @param {Set<string>} sentSet   Set of "vendorId|docType|triggerDay|expiryDateRef" keys
 * @returns {boolean}
 */
export function shouldSend(vendorId, docType, triggerDay, expiryDateRef, sentSet) {
  return !sentSet.has(`${vendorId}|${docType}|${triggerDay}|${expiryDateRef}`);
}
