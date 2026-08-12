import { describe, it, expect } from 'vitest'
import { prRef, generatePRNumber } from '../lib/prRef.js'

describe('prRef', () => {
  it('returns the pr_number string as the canonical PR identifier', () => {
    const pr = { id: 42, pr_number: 'PR-2026-0042' }
    expect(prRef(pr)).toBe('PR-2026-0042')
  })

  it('returns a string, never the integer id', () => {
    const pr = { id: 7, pr_number: 'PR-2025-0007' }
    expect(typeof prRef(pr)).toBe('string')
    expect(prRef(pr)).not.toBe(7)
  })

  it('handles pr_number on a plain object (e.g. from Supabase row)', () => {
    const row = { id: 1, pr_number: 'PR-2026-0001', status: 'Draft' }
    expect(prRef(row)).toBe('PR-2026-0001')
  })
})

describe('generatePRNumber', () => {
  it('formats a single-digit count with leading zeros', () => {
    expect(generatePRNumber(1, 2026)).toBe('PR-2026-0001')
  })

  it('formats a 4-digit count without truncation', () => {
    expect(generatePRNumber(1234, 2026)).toBe('PR-2026-1234')
  })

  it('uses the provided year', () => {
    expect(generatePRNumber(5, 2025)).toBe('PR-2025-0005')
  })

  it('matches the format currently used in App.jsx', () => {
    // App generates: `PR-${year}-${String((count || 0) + 1).padStart(4, "0")}`
    // prRef lib generates: generatePRNumber(count + 1, year)
    const count = 9 // existing row count
    expect(generatePRNumber(count + 1, 2026)).toBe('PR-2026-0010')
  })
})
