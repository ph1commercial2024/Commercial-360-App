import { describe, it, expect } from 'vitest'
import {
  computeDaysToExpiry,
  isOnTriggerDay,
  shouldSend,
} from '../lib/docExpiryLogic.js'

// ─── computeDaysToExpiry ────────────────────────────────────────────────────
// Returns how many days until the doc expires.
// Positive = future (before expiry), negative = past (after expiry), 0 = today.

describe('computeDaysToExpiry', () => {
  it('returns 40 when doc expires 40 days from today', () => {
    const today = new Date('2026-08-11')
    const expiry = '2026-09-20'
    expect(computeDaysToExpiry(expiry, today)).toBe(40)
  })

  it('returns 30 when doc expires 30 days from today', () => {
    const today = new Date('2026-08-11')
    const expiry = '2026-09-10'
    expect(computeDaysToExpiry(expiry, today)).toBe(30)
  })

  it('returns 7 when doc expires 7 days from today', () => {
    const today = new Date('2026-08-11')
    const expiry = '2026-08-18'
    expect(computeDaysToExpiry(expiry, today)).toBe(7)
  })

  it('returns 0 when doc expires today', () => {
    const today = new Date('2026-08-11')
    const expiry = '2026-08-11'
    expect(computeDaysToExpiry(expiry, today)).toBe(0)
  })

  it('returns -7 when doc expired 7 days ago', () => {
    const today = new Date('2026-08-11')
    const expiry = '2026-08-04'
    expect(computeDaysToExpiry(expiry, today)).toBe(-7)
  })

  it('returns -30 when doc expired 30 days ago', () => {
    const today = new Date('2026-08-11')
    const expiry = '2026-07-12'
    expect(computeDaysToExpiry(expiry, today)).toBe(-30)
  })
})

// ─── isOnTriggerDay ─────────────────────────────────────────────────────────
// Returns true only for the 6 scheduled trigger days.

describe('isOnTriggerDay', () => {
  it('triggers at 40 days before expiry', () => {
    expect(isOnTriggerDay(40)).toBe(true)
  })

  it('triggers at 30 days before expiry', () => {
    expect(isOnTriggerDay(30)).toBe(true)
  })

  it('triggers at 7 days before expiry', () => {
    expect(isOnTriggerDay(7)).toBe(true)
  })

  it('triggers on expiry day (0)', () => {
    expect(isOnTriggerDay(0)).toBe(true)
  })

  it('triggers at 7 days after expiry', () => {
    expect(isOnTriggerDay(-7)).toBe(true)
  })

  it('triggers at 30 days after expiry', () => {
    expect(isOnTriggerDay(-30)).toBe(true)
  })

  it('does not trigger at 39 days before expiry', () => {
    expect(isOnTriggerDay(39)).toBe(false)
  })

  it('does not trigger at 1 day before expiry', () => {
    expect(isOnTriggerDay(1)).toBe(false)
  })

  it('does not trigger at 1 day after expiry', () => {
    expect(isOnTriggerDay(-1)).toBe(false)
  })

  it('does not trigger at 31 days after expiry', () => {
    expect(isOnTriggerDay(-31)).toBe(false)
  })
})

// ─── shouldSend ─────────────────────────────────────────────────────────────
// Returns true when this vendor/doc/trigger/expiry combo has NOT been sent yet.

describe('shouldSend', () => {
  it('returns true when no email has been sent for this combo', () => {
    const sentSet = new Set()
    expect(shouldSend('VEN-000001', 'Mayor\'s Permit', 40, '2026-09-20', sentSet)).toBe(true)
  })

  it('returns false when email was already sent for this exact combo', () => {
    const sentSet = new Set(['VEN-000001|Mayor\'s Permit|40|2026-09-20'])
    expect(shouldSend('VEN-000001', 'Mayor\'s Permit', 40, '2026-09-20', sentSet)).toBe(false)
  })

  it('returns true when same doc was sent for a different trigger day', () => {
    const sentSet = new Set(['VEN-000001|Mayor\'s Permit|30|2026-09-20'])
    expect(shouldSend('VEN-000001', 'Mayor\'s Permit', 40, '2026-09-20', sentSet)).toBe(true)
  })

  it('returns true when vendor resubmits with a new expiry date (fresh cycle)', () => {
    // Old cycle was for 2026-09-20, vendor renewed to 2027-09-20
    const sentSet = new Set(['VEN-000001|Mayor\'s Permit|40|2026-09-20'])
    expect(shouldSend('VEN-000001', 'Mayor\'s Permit', 40, '2027-09-20', sentSet)).toBe(true)
  })

  it('returns true for a different vendor with the same doc and trigger', () => {
    const sentSet = new Set(['VEN-000001|Mayor\'s Permit|40|2026-09-20'])
    expect(shouldSend('VEN-000002', 'Mayor\'s Permit', 40, '2026-09-20', sentSet)).toBe(true)
  })
})
