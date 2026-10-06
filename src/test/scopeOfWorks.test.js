import { describe, it, expect } from 'vitest'
import {
  emptyScope, scopeKey, lineComplete, scopeStats, scopeProblems, toScopeItems, fromLegacyScope, defaultUnit,
} from '../lib/scopeOfWorks.js'

const k = scopeKey

const sample = () => ({
  ...emptyScope(),
  types: ['Architectural Works', 'General Requirements'],
  custom: { 'Architectural Works': ['Kitchen Backsplash'] },
  included: [k('Architectural Works', 'Flooring — Tiles'), k('General Requirements', 'Full-Time Safety Officer')],
  byOthers: { [k('Architectural Works', 'Wet Area Waterproofing')]: 'Separate contractor' },
  lines: {
    [k('Architectural Works', 'Flooring — Tiles')]: [
      { spec: '600×600 porcelain, matte', qty: '1250', unit: 'm²', location: 'Tower 1, L2–L5' },
      { spec: '300×600 anti-slip', qty: '180', unit: 'm²', location: '' },
    ],
    [k('General Requirements', 'Full-Time Safety Officer')]: [
      { spec: 'Licensed SO2, full-time on site', qty: '12', unit: 'month', location: 'Site' },
    ],
  },
})

describe('lineComplete', () => {
  it('needs a spec, a positive quantity and a unit', () => {
    expect(lineComplete({ spec: 'x', qty: '2', unit: 'm²' })).toBe(true)
    expect(lineComplete({ spec: '', qty: '2', unit: 'm²' })).toBe(false)
    expect(lineComplete({ spec: 'x', qty: '0', unit: 'm²' })).toBe(false)
    expect(lineComplete({ spec: 'x', qty: '2', unit: '' })).toBe(false)
  })

  it('accepts quantities written with commas', () => {
    expect(lineComplete({ spec: 'x', qty: '1,250', unit: 'm²' })).toBe(true)
  })

  it('needs a real description of what a "lot" includes', () => {
    expect(lineComplete({ spec: 'lot', qty: '1', unit: 'lot' })).toBe(false)
    expect(lineComplete({ spec: 'All building permits and fees', qty: '1', unit: 'lot' })).toBe(true)
  })
})

describe('scopeStats', () => {
  it('counts work types, included items, lines and complete lines', () => {
    expect(scopeStats(sample())).toEqual({ types: 2, items: 2, lines: 3, done: 3, byOthers: 1, missingWho: 0 })
  })

  it('counts By others items that do not say who', () => {
    const s = sample()
    s.byOthers[k('Architectural Works', 'Masonry / Blockwork')] = ''
    expect(scopeStats(s).missingWho).toBe(1)
  })

  it('ignores included items whose work type was removed', () => {
    const s = sample()
    s.types = ['Architectural Works']
    expect(scopeStats(s)).toMatchObject({ types: 1, items: 1, lines: 2 })
  })
})

describe('scopeProblems', () => {
  it('has no problems for a complete, confirmed scope', () => {
    expect(scopeProblems({ ...sample(), confirmed: true })).toEqual([])
  })

  it('lists what is missing before the PR can be sent', () => {
    const s = { ...emptyScope() }
    expect(scopeProblems(s)[0]).toMatch(/work type/i)
    const t = sample()
    t.lines[k('Architectural Works', 'Flooring — Tiles')][1].qty = ''
    t.byOthers[k('Architectural Works', 'Masonry / Blockwork')] = ''
    const p = scopeProblems(t)
    expect(p.some(m => /1 line/.test(m))).toBe(true)
    expect(p.some(m => /who/i.test(m))).toBe(true)
    expect(p.some(m => /confirm/i.test(m))).toBe(true)
  })
})

describe('toScopeItems', () => {
  it('turns each line into a scope item with the spec and location in the description', () => {
    expect(toScopeItems(sample())).toEqual([
      { description: 'Flooring — Tiles — 600×600 porcelain, matte (Tower 1, L2–L5)', quantity: 1250, unit_of_measure: 'm²', sort_order: 0 },
      { description: 'Flooring — Tiles — 300×600 anti-slip', quantity: 180, unit_of_measure: 'm²', sort_order: 1 },
      { description: 'Full-Time Safety Officer — Licensed SO2, full-time on site (Site)', quantity: 12, unit_of_measure: 'month', sort_order: 2 },
    ])
  })
})

describe('fromLegacyScope', () => {
  it('converts the old Required / Not Required checklist', () => {
    const legacy = [{ workType: 'Architectural Works', items: [
      { label: 'Flooring — Tiles', status: 'required', isCustom: false },
      { label: 'Masonry / Blockwork', status: 'not_required', remarks: 'n/a', isCustom: false },
      { label: 'Kitchen Backsplash', status: 'required', isCustom: true },
    ] }]
    const s = fromLegacyScope(legacy)
    expect(s.version).toBe(2)
    expect(s.types).toEqual(['Architectural Works'])
    expect(s.included).toEqual([k('Architectural Works', 'Flooring — Tiles'), k('Architectural Works', 'Kitchen Backsplash')])
    expect(s.custom).toEqual({ 'Architectural Works': ['Kitchen Backsplash'] })
    expect(s.lines[k('Architectural Works', 'Flooring — Tiles')]).toHaveLength(1)
  })

  it('passes a new-style scope through unchanged and handles empty input', () => {
    const s = sample()
    expect(fromLegacyScope(s)).toBe(s)
    expect(fromLegacyScope(null)).toEqual(emptyScope())
  })
})

describe('defaultUnit', () => {
  it('suggests a unit from the item name', () => {
    expect(defaultUnit('Full-Time Safety Officer')).toBe('month')
    expect(defaultUnit("Architect's Site Visit (Periodic)")).toBe('visit')
    expect(defaultUnit('Flooring — Tiles')).toBe('m²')
    expect(defaultUnit('Permits and Licenses')).toBe('lot')
    expect(defaultUnit('Something unusual')).toBe('')
  })
})
