// ─── Vendor Deduplication Logic ──────────────────────────────────────────────
// Used by handleStart in VendorApp.jsx to prevent multiple vendor records
// being created for the same invited email address.

/**
 * Given all accreditation tokens that share an invited email, find the
 * vendor_id that any of them is already linked to (i.e. the vendor record
 * created when the vendor first clicked "Start Application").
 *
 * Returns null if no token has been linked yet — caller should create a new vendor.
 *
 * @param {Array<{token: string, invited_email: string, vendor_id: string|null|undefined}>} tokenRows
 * @returns {string|null}
 */
export function resolveVendorFromTokens(tokenRows) {
  const linked = tokenRows.find(t => t.vendor_id);
  return linked?.vendor_id ?? null;
}
