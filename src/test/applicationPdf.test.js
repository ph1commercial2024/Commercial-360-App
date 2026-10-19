import { describe, it, expect } from 'vitest'
import { buildApplicationPdf, pdfFileName } from '../lib/applicationPdf.js'

const snapshot = {
  submitted_at: '2026-10-20T06:14:00.000Z',
  company_name: 'Northbay Builders Corporation',
  vendor_code: 'VEN-000077',
  sections: [
    { title: 'Company information', rows: [['Registered address', 'Unit 1204, Tycoon Centre, Pasig City'], ['Email for RFQs', 'procurement@northbaybuilders.ph']] },
    { title: 'Tax & government', rows: [['Registration type', 'SEC — Corporation / Partnership'], ['TIN', '008-245-117-000']] },
  ],
  documents: [
    { name: 'SEC Certificate', file: 'SEC_Registration.pdf', number: 'CS200905008', expiry: '2029-03-31', status: 'Saved' },
    { name: 'ISO certificate', file: null, number: null, expiry: null, status: 'Not provided' },
  ],
  declaration: 'I confirm that the above information is true and correct.',
  signatures: [
    { role: 'Sales Manager', name: 'Maria Lourdes Tan' },
    { role: 'President', name: 'Ramon A. Villanueva' },
  ],
}

describe('buildApplicationPdf', () => {
  const bytes = new Uint8Array(buildApplicationPdf(snapshot))
  const text = new TextDecoder('latin1').decode(bytes)

  it('produces a PDF file', () => {
    expect(text.startsWith('%PDF-')).toBe(true)
    expect(bytes.length).toBeGreaterThan(1000)
  })

  it('contains the company, sections, documents and signatories', () => {
    for (const s of ['Northbay Builders Corporation', 'Registration type', 'SEC Certificate', 'CS200905008', 'Ramon A. Villanueva', 'Sales Manager']) {
      expect(text).toContain(s)
    }
  })

  it('lists who confirmed it, with no signature images', () => {
    expect(text).toContain('CONFIRMED BY')
    expect(text).toContain('Maria Lourdes Tan')
    expect(text).not.toMatch(/\/Subtype \/Image/)
  })

  it('handles a long document list across pages', () => {
    const many = { ...snapshot, documents: Array.from({ length: 80 }, (_, i) => ({ name: `Document ${i + 1}`, file: `file_${i}.pdf`, number: String(i), expiry: '2027-01-01', status: 'Saved' })) }
    const t = new TextDecoder('latin1').decode(new Uint8Array(buildApplicationPdf(many)))
    expect((t.match(/\/Type \/Page\b/g) || []).length).toBeGreaterThan(1)
    expect(t).toContain('Document 80')
  })
})

describe('pdfFileName', () => {
  it('builds a safe, dated file name', () => {
    expect(pdfFileName(snapshot)).toBe('Accreditation_Northbay_Builders_Corporation_2026-10-20.pdf')
  })
})
