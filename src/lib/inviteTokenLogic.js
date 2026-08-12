// ─── Invite Token Logic ──────────────────────────────────────────────────────
// Pure functions for vendor accreditation invite token handling.
// Used by handleGenerateInvite in App.jsx.

/**
 * Select which token to use for the invite link.
 * If an existing token is found for this email, reuse it — the vendor always
 * receives the same accreditation link, preventing duplicate tokens.
 *
 * @param {string|null|undefined} existingToken  Token already in DB for this email
 * @param {string|null|undefined} createdToken   Newly-inserted token (only relevant if no existing)
 * @returns {string}
 */
export function pickToken(existingToken, createdToken) {
  if (existingToken) return existingToken;
  return createdToken;
}

/**
 * Build the full accreditation invite URL from the app origin and a token.
 *
 * @param {string} origin  e.g. window.location.origin
 * @param {string} token   UUID token from vendor_accreditation_tokens
 * @returns {string}
 */
export function buildInviteUrl(origin, token) {
  return `${origin}/vendor/accreditation/${token}`;
}
