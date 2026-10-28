import { describe, it, expect } from 'vitest'
import { prSubmitProblems, blockersFor, isSubmitClick, canSaveDraft, checklistVisible, clickTarget } from '../lib/prSubmit.js'
import { emptyScope, scopeKey } from '../lib/scopeOfWorks.js'

const k = scopeKey

// A scope that scopeProblems() accepts
const goodScope = () => ({
  ...emptyScope(),
  types: ['Architectural Works'],
  included: [k('Architectural Works', 'Flooring — Tiles')],
  lines: { [k('Architectural Works', 'Flooring — Tiles')]: [{ spec: '600x600 porcelain', qty: '10', unit: 'm²', location: 'Tower 1' }] },
  confirmed: true,
})

// A fully valid Supervisor input (needs a Manager, no budget)
const valid = (over = {}) => ({
  projectId: '5', projectHasAreas: true, areas: [1],
  description: 'Fit-out', justification: 'Needed', isRush: false, rushJustification: '',
  startDate: '2026-12-15', endDate: '2026-12-20', minDate: '2026-12-10',
  scope: goodScope(),
  managerId: '3', budgetStatus: '',
  docModes: { plans: 'file', tor: 'file', specs: 'file' },
  docLinks: { plans: '', tor: '', specs: '' },
  docFiles: { plans: { name: 'a.pdf' }, tor: { name: 'b.pdf' }, specs: { name: 'c.pdf' } },
  existingDocs: { plans: null, tor: null, specs: null },
  ...over,
})

const msgs = (list) => list.map(x => x.message)
const sections = (list) => list.map(x => x.section)

describe('prSubmitProblems: valid input', () => {
  it('has no problems for a complete Supervisor PR', () => {
    const r = prSubmitProblems(valid())
    expect(r.draft).toEqual([])
    expect(r.submit).toEqual([])
  })
})

describe('draft basics', () => {
  it('flags a missing project', () => {
    const r = prSubmitProblems(valid({ projectId: '' }))
    expect(sections(r.draft)).toContain('project')
  })
  it('flags missing areas only when the project has areas', () => {
    expect(sections(prSubmitProblems(valid({ areas: [] })).draft)).toContain('project')
    expect(prSubmitProblems(valid({ areas: [], projectHasAreas: false })).draft).toEqual([])
  })
  it('flags blank description and justification (whitespace counts as blank)', () => {
    const r = prSubmitProblems(valid({ description: '   ', justification: '' }))
    expect(r.draft).toHaveLength(2)
    expect(sections(r.draft)).toEqual(['details', 'details'])
  })
  it('requires a rush reason only when rush', () => {
    expect(prSubmitProblems(valid({ isRush: false, rushJustification: '' })).draft).toEqual([])
    const r = prSubmitProblems(valid({ isRush: true, rushJustification: '  ' }))
    expect(r.draft).toHaveLength(1)
    expect(r.draft[0].section).toBe('dates')
  })
  it('flags missing start and end dates separately', () => {
    const r = prSubmitProblems(valid({ startDate: '', endDate: '' }))
    expect(r.draft).toHaveLength(2)
    expect(new Set(sections(r.draft))).toEqual(new Set(['dates']))
  })
  it('does not complain about the lead time or end-before-start when a date is empty', () => {
    const r = prSubmitProblems(valid({ startDate: '', endDate: '2026-12-20' }))
    expect(r.draft).toHaveLength(1)
    // the submit list holds only that same item: no lead-time message for a missing start date
    expect(r.submit).toEqual(r.draft)
    expect(msgs(r.submit).join(' ')).not.toMatch(/lead time/i)
  })
})

describe('end date rule', () => {
  it('end == start passes', () => {
    const r = prSubmitProblems(valid({ startDate: '2026-12-15', endDate: '2026-12-15' }))
    expect(r.draft).toEqual([])
    expect(r.submit).toEqual([])
  })
  it('end < start fails, as a draft problem', () => {
    const r = prSubmitProblems(valid({ startDate: '2026-12-15', endDate: '2026-12-14' }))
    expect(r.draft).toHaveLength(1)
    expect(r.draft[0].section).toBe('dates')
    expect(r.draft[0].message).toMatch(/end date/i)
    expect(r.submit).toHaveLength(1)
  })
})

describe('lead time (submit only)', () => {
  it('start == minDate passes', () => {
    const r = prSubmitProblems(valid({ startDate: '2026-12-10', endDate: '2026-12-11' }))
    expect(r.submit).toEqual([])
  })
  it('start one day before minDate fails for submit but not draft', () => {
    const r = prSubmitProblems(valid({ startDate: '2026-12-09', endDate: '2026-12-11' }))
    expect(r.draft).toEqual([])
    expect(r.submit).toHaveLength(1)
    expect(r.submit[0].section).toBe('dates')
    expect(r.submit[0].message).toContain('2026-12-10')
  })
  it('mentions the rush lead time when rush', () => {
    const r = prSubmitProblems(valid({ isRush: true, rushJustification: 'late', minDays: 30, startDate: '2026-12-09', endDate: '2026-12-11' }))
    expect(r.submit[0].message).toMatch(/30-day/)
    expect(r.submit[0].message).toMatch(/rush/i)
  })
})

describe('scope (submit only)', () => {
  it('uses scopeProblems and is not a draft problem', () => {
    const r = prSubmitProblems(valid({ scope: emptyScope() }))
    expect(r.draft).toEqual([])
    expect(r.submit).toHaveLength(1)
    expect(r.submit[0].section).toBe('scope')
    expect(r.submit[0].step).toBe(1)
  })
  it('maps "at least one work" to step 2', () => {
    const s = { ...emptyScope(), types: ['Architectural Works'] }
    const r = prSubmitProblems(valid({ scope: s }))
    const item = r.submit.find(x => /at least one work/i.test(x.message))
    expect(item.step).toBe(2)
  })
  it('extracts the step number from "(Scope of Works, step N)" (regex-escape regression)', () => {
    const s = goodScope()
    s.lines[k('Architectural Works', 'Flooring — Tiles')][0].spec = ''
    const r = prSubmitProblems(valid({ scope: s }))
    const item = r.submit.find(x => x.section === 'scope')
    expect(item.message).toMatch(/step 3/)
    expect(item.step).toBe(3)
    // "by others" with no who is step 2
    const s2 = { ...goodScope(), byOthers: { [k('Architectural Works', 'Waterproofing')]: '' } }
    expect(prSubmitProblems(valid({ scope: s2 })).submit.find(x => x.section === 'scope').step).toBe(2)
  })
  it('maps the unconfirmed scope to the Summary step 4', () => {
    const r = prSubmitProblems(valid({ scope: { ...goodScope(), confirmed: false } }))
    expect(r.submit).toHaveLength(1)
    expect(r.submit[0].step).toBe(4)
  })
})

describe('roles', () => {
  it('Supervisor needs a Manager (submit only)', () => {
    const r = prSubmitProblems(valid({ managerId: '' }))
    expect(r.draft).toEqual([])
    expect(r.submit).toHaveLength(1)
    expect(r.submit[0].section).toBe('manager')
  })
  it('Manager creating does not need a Manager or a budget', () => {
    const r = prSubmitProblems(valid({ isManagerCreating: true, managerId: '', budgetStatus: '' }))
    expect(r.submit).toEqual([])
  })
  it('Commercial staff needs a budget status but no Manager (submit only)', () => {
    const r = prSubmitProblems(valid({ isReviewerCreating: true, managerId: '', budgetStatus: '' }))
    expect(r.draft).toEqual([])
    expect(r.submit).toHaveLength(1)
    expect(r.submit[0].section).toBe('budget')
    expect(prSubmitProblems(valid({ isReviewerCreating: true, budgetStatus: 'Budgeted' })).submit).toEqual([])
    expect(prSubmitProblems(valid({ isReviewerCreating: true, budgetStatus: 'Unbudgeted' })).submit).toEqual([])
  })
  it('does not ask a Supervisor for a budget', () => {
    expect(sections(prSubmitProblems(valid({ budgetStatus: '' })).submit)).not.toContain('budget')
  })
})

describe('which list blocks which click, per role', () => {
  const broken = { projectId: '', managerId: '', docFiles: { plans: null, tor: null, specs: null } } // 1 draft + manager + 3 docs
  const supervisor = {}
  const manager = { isManagerCreating: true }
  const reviewer = { isReviewerCreating: true }

  it('Supervisor: Save draft is blocked by the draft list, Send to Manager by the submit list', () => {
    const r = prSubmitProblems(valid({ ...supervisor, ...broken }))
    expect(blockersFor(r, supervisor, false)).toBe(r.draft)
    expect(blockersFor(r, supervisor, true)).toBe(r.submit)
    expect(r.draft).toHaveLength(1)
    expect(r.submit).toHaveLength(5)
    expect(sections(r.submit)).toContain('manager')
    expect(sections(r.submit)).not.toContain('budget')
    expect(canSaveDraft(supervisor)).toBe(true)
  })
  it('Manager: no Manager rule, no budget rule; Save draft uses the draft list, Submit the submit list', () => {
    const r = prSubmitProblems(valid({ ...manager, ...broken, budgetStatus: '' }))
    expect(sections(r.submit)).not.toContain('manager')
    expect(sections(r.submit)).not.toContain('budget')
    expect(r.submit).toHaveLength(4)
    expect(blockersFor(r, manager, false)).toBe(r.draft)
    expect(blockersFor(r, manager, true)).toBe(r.submit)
    expect(canSaveDraft(manager)).toBe(true)
  })
  it('Commercial staff: budget rule, no Manager rule, and their one button always uses the submit list', () => {
    const r = prSubmitProblems(valid({ ...reviewer, ...broken }))
    expect(sections(r.submit)).toContain('budget')
    expect(sections(r.submit)).not.toContain('manager')
    expect(r.submit).toHaveLength(5)
    expect(blockersFor(r, reviewer, false)).toBe(r.submit)
    expect(blockersFor(r, reviewer, true)).toBe(r.submit)
    expect(isSubmitClick(reviewer, false)).toBe(true)
    expect(isSubmitClick(supervisor, false)).toBe(false)
    expect(canSaveDraft(reviewer)).toBe(false)
  })
  it('marks draft items so the checklist can tag them', () => {
    const r = prSubmitProblems(valid({ ...broken }))
    expect(r.submit.filter(p => p.blocksDraft).map(p => p.section)).toEqual(['project'])
    expect(r.submit.filter(p => !p.blocksDraft)).toHaveLength(4)
  })
})

describe('documents (submit only)', () => {
  it('file mode with nothing fails for each of the three documents', () => {
    const r = prSubmitProblems(valid({ docFiles: { plans: null, tor: null, specs: null } }))
    expect(r.draft).toEqual([])
    expect(r.submit).toHaveLength(3)
    expect(new Set(sections(r.submit))).toEqual(new Set(['documents']))
    expect(msgs(r.submit).join(' ')).toMatch(/Plans/)
    expect(msgs(r.submit).join(' ')).toMatch(/Terms of Reference/)
    expect(msgs(r.submit).join(' ')).toMatch(/Specifications/)
    expect(r.submit.map(x => x.doc)).toEqual(['plans', 'tor', 'specs'])
  })
  it('an existing file satisfies file mode', () => {
    const r = prSubmitProblems(valid({
      docFiles: { plans: null, tor: null, specs: null },
      existingDocs: { plans: { url: 'u', name: 'n' }, tor: { url: 'u', name: 'n' }, specs: { url: 'u', name: 'n' } },
    }))
    expect(r.submit).toEqual([])
  })
  it('link mode needs a non-empty link, and ignores files', () => {
    const modes = { plans: 'link', tor: 'link', specs: 'link' }
    const bad = prSubmitProblems(valid({ docModes: modes, docLinks: { plans: ' ', tor: '', specs: '' } }))
    expect(bad.submit).toHaveLength(3)
    const ok = prSubmitProblems(valid({
      docModes: modes, docLinks: { plans: 'https://a', tor: 'https://b', specs: 'https://c' },
      docFiles: { plans: null, tor: null, specs: null },
    }))
    expect(ok.submit).toEqual([])
  })
  it('a leftover file does not satisfy link mode', () => {
    const r = prSubmitProblems(valid({ docModes: { plans: 'link', tor: 'file', specs: 'file' } }))
    expect(r.submit).toHaveLength(1)
    expect(r.submit[0].doc).toBe('plans')
  })
})

describe('checklist order', () => {
  it('follows the form top to bottom: project, Manager, details, dates, scope, documents; draft items before submit-only ones in a section', () => {
    const r = prSubmitProblems(valid({
      projectId: '', description: '', managerId: '', endDate: '', startDate: '2026-12-01', scope: emptyScope(),
      docFiles: { plans: null, tor: null, specs: null },
    }))
    expect(sections(r.submit)).toEqual(['project', 'manager', 'details', 'dates', 'dates', 'scope', 'documents', 'documents', 'documents'])
    const dates = r.submit.filter(p => p.section === 'dates')
    expect(dates[0].message).toMatch(/end date/i)       // draft item first
    expect(dates[1].message).toMatch(/lead time/i)      // then the submit-only lead time
    expect(r.submit.filter(p => p.section === 'documents').map(p => p.doc)).toEqual(['plans', 'tor', 'specs'])
  })
  it('puts the budget item between scope and documents', () => {
    const r = prSubmitProblems(valid({ isReviewerCreating: true, budgetStatus: '', scope: emptyScope(), docFiles: { plans: null, tor: null, specs: null } }))
    expect(sections(r.submit)).toEqual(['scope', 'budget', 'documents', 'documents', 'documents'])
  })
})

describe('draft vs submit separation', () => {
  it('submit always includes every draft item', () => {
    const r = prSubmitProblems(valid({ projectId: '', description: '', startDate: '', scope: emptyScope(), managerId: '' }))
    for (const d of r.draft) expect(r.submit).toContainEqual(d)
    expect(r.submit.length).toBeGreaterThan(r.draft.length)
  })
  it('submit-only items never appear in draft', () => {
    const r = prSubmitProblems(valid({ scope: emptyScope(), managerId: '', docFiles: { plans: null, tor: null, specs: null } }))
    expect(r.draft).toEqual([])
  })
})

describe('checklist visibility and click target', () => {
  const items = (n) => Array.from({ length: n }, (_, i) => ({ section: 'details', message: `m${i}` }))
  const supervisor = {}
  it('shows the checklist only for 1 to 3 items', () => {
    expect([0, 1, 2, 3, 4, 7].map(checklistVisible)).toEqual([false, true, true, true, false, false])
  })
  it('click with nothing blocking returns null', () => {
    expect(clickTarget({ draft: [], submit: [] }, supervisor, true)).toBeNull()
  })
  it('checklist shown: scrolls to the checklist', () => {
    const r = { draft: items(1), submit: items(3) }
    expect(clickTarget(r, supervisor, true)).toEqual({ kind: 'checklist' })
    expect(clickTarget(r, supervisor, false)).toEqual({ kind: 'checklist' })
  })
  it('checklist hidden: submit click jumps to the first submit item', () => {
    const r = { draft: [], submit: items(5) }
    expect(clickTarget(r, supervisor, true)).toEqual({ kind: 'item', item: r.submit[0] })
  })
  it('checklist hidden: Save draft jumps to the first draft item', () => {
    const r = { draft: items(2), submit: [...items(2), ...items(4).map(p => ({ ...p, message: 'x' + p.message }))] }
    expect(clickTarget(r, supervisor, false)).toEqual({ kind: 'item', item: r.draft[0] })
  })
  it('Commercial staff always use the submit list', () => {
    const r = { draft: [], submit: items(4) }
    expect(clickTarget(r, { isReviewerCreating: true }, false)).toEqual({ kind: 'item', item: r.submit[0] })
  })
  it('Save draft with nothing in draft but a visible checklist does nothing', () => {
    expect(clickTarget({ draft: [], submit: items(2) }, supervisor, false)).toBeNull()
  })
  it('Save draft with only submit items missing does nothing', () => {
    expect(clickTarget({ draft: [], submit: items(5) }, supervisor, false)).toBeNull()
  })
})
