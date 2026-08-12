import { describe, it, expect } from 'vitest'
import { pickToken, buildInviteUrl } from '../lib/inviteTokenLogic.js'

// ─── pickToken ──────────────────────────────────────────────────────────────
// When a vendor's email already has an accreditation token, the SAME token
// must be returned so the same invite link is emailed every time.

describe('pickToken', () => {
  it('reuses the existing token when one is found', () => {
    expect(pickToken('abc-111', null)).toBe('abc-111')
  })

  it('uses the newly created token when no existing token is found', () => {
    expect(pickToken(null, 'xyz-999')).toBe('xyz-999')
  })

  it('existing token wins even if a new token is also provided', () => {
    expect(pickToken('abc-111', 'xyz-999')).toBe('abc-111')
  })

  it('treats undefined existing token as missing (uses new token)', () => {
    expect(pickToken(undefined, 'xyz-999')).toBe('xyz-999')
  })

  it('treats empty-string existing token as missing (uses new token)', () => {
    expect(pickToken('', 'xyz-999')).toBe('xyz-999')
  })
})

// ─── buildInviteUrl ─────────────────────────────────────────────────────────
// The invite link is constructed from the app origin + the token.
// Same token → same URL → same email link every time.

describe('buildInviteUrl', () => {
  it('builds the correct accreditation URL', () => {
    const url = buildInviteUrl('https://app.example.com', 'abc-111')
    expect(url).toBe('https://app.example.com/vendor/accreditation/abc-111')
  })

  it('same token always produces the same URL', () => {
    const token = 'abc-111'
    const url1 = buildInviteUrl('https://app.example.com', token)
    const url2 = buildInviteUrl('https://app.example.com', token)
    expect(url1).toBe(url2)
  })

  it('different tokens produce different URLs', () => {
    const url1 = buildInviteUrl('https://app.example.com', 'abc-111')
    const url2 = buildInviteUrl('https://app.example.com', 'xyz-999')
    expect(url1).not.toBe(url2)
  })
})
