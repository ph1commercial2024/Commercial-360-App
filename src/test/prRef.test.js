import { describe, it, expect } from 'vitest'
import { prRef } from '../lib/prRef.js'

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
