import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { toDateStr, fromDateStr } from '../lib/dates.js'

// The app is used in the Philippines (UTC+8), where toISOString() shifts local midnight to the previous day
let originalTZ
beforeAll(() => { originalTZ = process.env.TZ; process.env.TZ = 'Asia/Manila' })
afterAll(() => { process.env.TZ = originalTZ })

describe('toDateStr', () => {
  it('keeps the calendar day picked at local midnight', () => {
    expect(toDateStr(new Date(2026, 9, 15))).toBe('2026-10-15')
  })

  it('keeps the day late in the evening', () => {
    expect(toDateStr(new Date(2026, 9, 15, 23, 59))).toBe('2026-10-15')
  })

  it('pads month and day', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('fromDateStr', () => {
  it('returns local midnight of the stored day', () => {
    const d = fromDateStr('2026-10-15')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 15, 0])
  })

  it('accepts a timestamp string and uses its date part', () => {
    expect(toDateStr(fromDateStr('2026-10-15T00:00:00+00:00'))).toBe('2026-10-15')
  })

  it('returns null for empty input', () => {
    expect(fromDateStr('')).toBeNull()
    expect(fromDateStr(null)).toBeNull()
  })

  it('round-trips with toDateStr', () => {
    expect(toDateStr(fromDateStr('2027-02-28'))).toBe('2027-02-28')
  })
})
