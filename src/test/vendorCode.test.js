import { describe, it, expect } from 'vitest'

import { venCode, vendorRef } from '../lib/vendorCode.js'

describe('venCode', () => {
  it('formats single-digit id with leading zeros', () => {
    expect(venCode(1)).toBe('VEN-000001')
  })

  it('formats a 4-digit id', () => {
    expect(venCode(1234)).toBe('VEN-001234')
  })

  it('formats a 6-digit id without padding', () => {
    expect(venCode(123456)).toBe('VEN-123456')
  })
})

describe('vendorRef', () => {
  it('returns vendor_code from DB when available', () => {
    expect(vendorRef({ id: 1, vendor_code: 'VEN-000001' })).toBe('VEN-000001')
  })

  it('falls back to computed code when vendor_code is missing', () => {
    expect(vendorRef({ id: 42 })).toBe('VEN-000042')
  })

  it('falls back when vendor_code is null', () => {
    expect(vendorRef({ id: 5, vendor_code: null })).toBe('VEN-000005')
  })

  it('builds a ciMap keyed by vendor_code for DB lookups', () => {
    const vendors = [
      { id: 1, vendor_code: 'VEN-000001' },
      { id: 2, vendor_code: 'VEN-000002' },
    ]
    const ciList = [
      { vendor_id: 'VEN-000001', company_name: 'Acme Corp' },
      { vendor_id: 'VEN-000002', company_name: 'Beta Inc' },
    ]
    const ciMap = {}
    ciList.forEach(ci => { ciMap[ci.vendor_id] = ci })
    const enriched = vendors.map(v => ({ ...v, company_name: (ciMap[vendorRef(v)] || {}).company_name || null }))
    expect(enriched[0].company_name).toBe('Acme Corp')
    expect(enriched[1].company_name).toBe('Beta Inc')
  })
})
