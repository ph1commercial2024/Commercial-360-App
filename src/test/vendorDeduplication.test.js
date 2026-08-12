import { describe, it, expect } from 'vitest'
import { resolveVendorFromTokens } from '../lib/vendorDeduplication.js'

// ─── resolveVendorFromTokens ──────────────────────────────────────────────────
// Before creating a new vendor draft, the system checks all tokens that share
// the invited email. If any of them are already linked to a vendor, that vendor
// is reused instead of creating a duplicate.

describe('resolveVendorFromTokens', () => {
  it('returns null when there are no tokens (create new vendor)', () => {
    expect(resolveVendorFromTokens([])).toBeNull()
  })

  it('returns null when no token is linked to a vendor yet', () => {
    const tokens = [
      { token: 'abc', invited_email: 'v@co.com', vendor_id: null },
      { token: 'def', invited_email: 'v@co.com', vendor_id: null },
    ]
    expect(resolveVendorFromTokens(tokens)).toBeNull()
  })

  it('returns the vendor_id when a token is already linked', () => {
    const tokens = [
      { token: 'abc', invited_email: 'v@co.com', vendor_id: 'VEN-000001' },
    ]
    expect(resolveVendorFromTokens(tokens)).toBe('VEN-000001')
  })

  it('returns the linked vendor_id even when other tokens are unlinked', () => {
    const tokens = [
      { token: 'abc', invited_email: 'v@co.com', vendor_id: null },
      { token: 'def', invited_email: 'v@co.com', vendor_id: 'VEN-000001' },
      { token: 'ghi', invited_email: 'v@co.com', vendor_id: null },
    ]
    expect(resolveVendorFromTokens(tokens)).toBe('VEN-000001')
  })

  it('returns the first linked vendor_id when multiple tokens are linked', () => {
    const tokens = [
      { token: 'abc', invited_email: 'v@co.com', vendor_id: 'VEN-000001' },
      { token: 'def', invited_email: 'v@co.com', vendor_id: 'VEN-000002' },
    ]
    expect(resolveVendorFromTokens(tokens)).toBe('VEN-000001')
  })

  it('handles undefined vendor_id as unlinked', () => {
    const tokens = [
      { token: 'abc', invited_email: 'v@co.com', vendor_id: undefined },
    ]
    expect(resolveVendorFromTokens(tokens)).toBeNull()
  })
})
