import { describe, it, expect } from 'vitest'
import { parseCostReport, decideBudget, parseAwardItems, parseVOItems, reconcileItems } from '../lib/costReport.js'

// Mirrors the "Budget Vs Awarded" sheet layout: title block, a section row, then the column header row
const HEADER = ['Budget Code', 'Items', 'Particulars', 'Qty', 'Unit', 'Unit Cost', 'Approved Budget',
  'Awarded', 'For Approval', 'Anticipated',
  'Approved', 'For Approval', 'Waiting Direction', 'Ongoing Evaluation', 'Anticipated - Waiting for Proposal',
  'Projected Cost at Completion', 'Variance [Total Budget - Awarded]']
const row = (code, items, particulars, budget, awarded, anticipated, voApproved, extra = {}) =>
  [code, items, particulars, 1, 'lot', budget, budget, awarded, extra.wpForApproval ?? 0, anticipated,
    voApproved, extra.voForApproval ?? 0, 0, 0, 0, 0, 0]

const SHEET = [
  ['Date: December 01, 2025'],
  ['Project: My Enso Lofts'],
  ['Location: Sgt. Esguerra St.'],
  ['Subject: Budget Monitoring'],
  ['', '', '', '', '', '', '', 'Work Packages', '', '', 'Variation Order'],
  HEADER,
  ['Tower 1', '', '', '', '', '', 1000, 500, 0, 0, 0],
  row('PH1.D&C.MLOH.BUDGET.0001', 'Construction', 'Construction', 921102980, 886034837.94, 11495259.12, 757476.49),
  row('PH1.D&C.MLOH.BUDGET.0004', 'Site Development', 'Site Development', 92378300, 72378300, 20000000, 0),
  row('PH1.D&C.MLOH.BUDGET.0006', 'Add-ons', 'Add-ons or FFE', 100677289, 0, 0, 78660696.57),
  row('PH1.D&C.MLOH.BUDGET.0006.5', 'Add-ons', 'Cooktop', 3622500, 0, 0, 3502827.78),
  row('PH1.D&C.MLOH.BUDGET.0006.6', 'Add-ons', 'Window Blinds', 1297642.5, 0, 0, 3887000, { voForApproval: 500 }),
  row('PH1.D&C.MLOH.BUDGET.000CT1', 'Contingency', 'Contingency', 69811037, 0, 940561.03, 51106183.55),
  ['Tower 3', '', '', '', '', '', 0, 0],
  ['PH1.D&C.MLOH.BUDGET.0015', 'Parking Building', 'Parking Building', 3672, 'cfa', 0, '', 0, 0, 0, 0],
  row('PH1.D&C.MLOH.BUDGET.0018', 'Add-ons', 'Add-ons or FFE', 96273928, 0, 0, 0),
  row('PH1.D&C.MLOH.BUDGET.0019.1', 'Add-ons', 'Loft & Stair', 45793267, 0, 0, 0),
  ['TOTAL', '', '', '', '', '', 999, 999],
  [],
  ['Item No.', 'Award No.', 'Particular', '', '', '', 'Awarded'],
  [1, 'Award 001', 'Construction Cost', '', '', '', 1299948313.42],
]

describe('parseCostReport', () => {
  const r = parseCostReport(SHEET)
  const byCode = c => r.lines.find(l => l.code === `PH1.D&C.MLOH.BUDGET.${c}`)

  it('reads the report date and project text from the title block', () => {
    expect(r.reportDate).toBe('2025-12-01')
    expect(r.projectText).toBe('My Enso Lofts')
  })

  it('keeps budget lines and skips tower rows, TOTAL and the award summary', () => {
    expect(r.lines.map(l => l.code.replace('PH1.D&C.MLOH.BUDGET.', ''))).toEqual(
      ['0001', '0004', '0006', '0006.5', '0006.6', '000CT1', '0015', '0018', '0019.1'])
  })

  it('records the tower each line belongs to', () => {
    expect(byCode('0001').group).toBe('Tower 1')
    expect(byCode('0018').group).toBe('Tower 3')
  })

  it('maps work-package and variation-order columns that share a header name', () => {
    const blinds = byCode('0006.6')
    expect(blinds.wp_for_approval).toBe(0)
    expect(blinds.vo_for_approval).toBe(500)
    expect(blinds.vo_approved).toBe(3887000)
    expect(byCode('0004').anticipated).toBe(20000000)
  })

  it('computes money left as budget − awarded − approved VOs, ignoring anticipated', () => {
    expect(byCode('0001').money_left).toBe(34310665.57)
    expect(byCode('0004').money_left).toBe(20000000)
    expect(byCode('0006.6').money_left).toBe(-2589357.5)
  })

  it('treats a blank approved budget as zero', () => {
    expect(byCode('0015').approved_budget).toBe(0)
    expect(byCode('0015').money_left).toBe(0)
  })

  it('links sub-lines to the line directly above them, even when the numbers differ', () => {
    expect(byCode('0006.5').parent_code).toBe('PH1.D&C.MLOH.BUDGET.0006')
    expect(byCode('0019.1').parent_code).toBe('PH1.D&C.MLOH.BUDGET.0018')
    expect(byCode('0006').is_parent).toBe(true)
    expect(byCode('0018').is_parent).toBe(true)
    expect(byCode('0001').is_parent).toBe(false)
    expect(byCode('0001').parent_code).toBeNull()
  })

  it('flags contingency lines', () => {
    expect(byCode('000CT1').is_contingency).toBe(true)
    expect(byCode('0001').is_contingency).toBe(false)
  })

  it('uses the Particulars text as the line name', () => {
    expect(byCode('0006.5').name).toBe('Cooktop')
  })

  it('rejects a sheet without a Budget Code header', () => {
    expect(() => parseCostReport([['Date: x'], ['Something else']])).toThrow(/Budget Code/)
  })

  it('accepts amounts written as text with commas', () => {
    const s = [HEADER, ['A.0001', 'X', 'X', 1, 'lot', 0, '1,000.50', '500', 0, 0, '0.25', 0, 0, 0, 0, 0, 0]]
    expect(parseCostReport(s).lines[0].money_left).toBe(500.25)
  })
})

describe('decideBudget', () => {
  const line = (name, money_left, is_contingency = false) => ({ name, money_left, is_contingency })

  it('is Budgeted when every picked line has money left', () => {
    expect(decideBudget([line('Rangehood', 2299423.73), line('Cooktop', 119672.22)]))
      .toEqual({ status: 'Budgeted', reasons: [] })
  })

  it('is Unbudgeted when any line is over budget or used up', () => {
    const d = decideBudget([line('Rangehood', 100), line('Window Blinds', -2589357.5), line('Site Dev', 0)])
    expect(d.status).toBe('Unbudgeted')
    expect(d.reasons).toHaveLength(2)
    expect(d.reasons[0]).toMatch(/Window Blinds/)
    expect(d.reasons[1]).toMatch(/Site Dev/)
  })

  it('is Unbudgeted for contingency even with money left', () => {
    const d = decideBudget([line('Contingency', 18704853.45, true)])
    expect(d.status).toBe('Unbudgeted')
    expect(d.reasons[0]).toMatch(/[Cc]ontingency/)
  })

  it('is Unbudgeted when no line covers the work', () => {
    expect(decideBudget([], { noLine: true }).status).toBe('Unbudgeted')
  })

  it('has no decision until a line is picked', () => {
    expect(decideBudget([]).status).toBeNull()
  })
})

// Mirrors the WPP sheet: summary block, then the item table, a TOTAL row and an award summary below it
const WPP = [
  ['Date:', '', 46300],
  ['', 'No. of WPP', 'Status'],
  ['', 25, 'Awarded'],
  [],
  ['', 'Item No.', 'WPP No.', 'Particular', 'Target Budget', 'Budget Code', 'Awarded', 'For Approval', 'Award No.', 'Award Status', 'Target Date Award', 'Date Needed At Site', 'Remarks', 'Vendor'],
  ['', 1, 'MLOH. WP-001', 'Site Dev / Master Plan', '', 'PH1.D&C.MLOH.BUDGET.0007', 924000, '', 'Award 001', 'Awarded', '', '', '', 'ECTA'],
  ['', 9, 'MLOH. WP-008', 'Pre-Engineering Studies', '', '', '', '', '', '', '', '', '', 'MCC'],
  ['', 13, 'MLOH. WP-010', 'Tower 1', '', 'PH1.D&C.MLOH.BUDGET.0001', 886034837.94, '', 'Award 001', 'Awarded', '', '', '', 'MCC'],
  ['', 21, 'MLOH. WP-013', 'Landscaping Works', '', 'PH1.D&C.MLOH.BUDGET.0004', 5000, '', '', 'For Approval', '', '', '', 'TBA'],
  ['', 'TOTAL', '', '', 0, '', 886958837.94],
  [],
  ['', 'Item No.', 'Award No.', 'Particular', 'Awarded'],
  ['', 1, 'Award 001', 'Design fee', 1299948313.42],
]

// Mirrors the PMIs sheet: status summary on top, then the item table with a BUDGET CODE column
const PMIS = [
  ['', 'MODAN LOFTS ORTIGAS HILLS'],
  ['', 'ITEM NO.', 'NOS.', 'STATUS', '', '', '', '', '', "MCC'S PROPOSAL (In PHP)", 'EVALUATED COST (In PHP)', 'APPROVED COST (In PHP)'],
  ['', 'Claim', 1, '', '', '', '', '', '', 100, 100, 100],
  [],
  ['', 'ITEM NO.', 'PMI NO.', 'DESCRIPTION', 'CATEGORY', 'MAIN SCOPE', 'CLASSIFICATION', 'COST IMPLICATION', 'EOT (Days)', "MCC'S PROPOSAL (In PHP)", 'EVALUATED COST (In PHP)', 'APPROVED COST (In PHP)', 'Anticipated - Waiting for Proposal', 'DATE NEEDED AT SITE', 'REMARKS', 'STATUS', 'CO NO.', 'BUDGET CODE'],
  ['Claim', 1, '', 'Wage Increase', '', '', '', '', '', 14774955.67, 14774955.67, 14774955.67, 0, '', '', 'Approved', 'MLOH.CON.CO-002', 'PH1.D&C.MLOH.BUDGET.000CT1'],
  ['PMI', 15, 'MLOH.CON.PMI-006.1', 'Units Equipment - Cooktop', '', '', '', '', '', 6717693.03, 3502827.78, 3502827.78, '', '', '', 'Approved', 'MLOH.CON.CO-015', 'PH1.D&C.MLOH.BUDGET.0006.5'],
  ['PMI', 14, 'MLOH.CON.PMI-006.1', 'Units Equipment - Cooktop resubmit', '', '', '', '', '', 13246292, 11852484.72, '', 0, '', '', 'Anticipated - Waiting for Proposal', '', 'PH1.D&C.MLOH.BUDGET.0006.5'],
  ['PMI', 34, 'N/A', 'Toilet Exhaust Fan', '', '', '', '', '', -7229.34, -7229.34, -7229.34, 0, '', '', 'Approved', 'MLOH.CON.CO-020', 'PH1.D&C.MLOH.BUDGET.0001'],
  ['PMI', 29, 'MLOH.CON.PMI-0016', 'Resumption', '', '', '', '', '', 18587035.83, 15682862.81, '', '', '', '', 'For Approval', 'MLOH.CON.CO-005', 'PH1.D&C.MLOH.BUDGET.000CT1'],
  ['', '', '', '', '', '', '', '', '', '', '', 33319960.48],
]

describe('parseAwardItems (WPP sheet)', () => {
  const items = parseAwardItems(WPP)

  it('keeps only awarded work packages that have a budget code', () => {
    expect(items.map(i => i.ref)).toEqual(['MLOH. WP-001', 'MLOH. WP-010'])
  })

  it('records the award number, vendor and amount', () => {
    expect(items[1]).toMatchObject({ kind: 'award', code: 'PH1.D&C.MLOH.BUDGET.0001', sub_ref: 'Award 001', vendor: 'MCC', amount: 886034837.94, description: 'Tower 1' })
  })

  it('returns no items when the sheet is missing or has no item table', () => {
    expect(parseAwardItems(undefined)).toEqual([])
    expect(parseAwardItems([['nothing here']])).toEqual([])
  })
})

describe('parseVOItems (PMIs sheet)', () => {
  const items = parseVOItems(PMIS)

  it('keeps only approved items with a budget code, including claims and deductives', () => {
    expect(items.map(i => i.ref)).toEqual(['MLOH.CON.CO-002', 'MLOH.CON.CO-015', 'MLOH.CON.CO-020'])
  })

  it('records the PMI number, category and approved cost', () => {
    expect(items[1]).toMatchObject({ kind: 'vo', code: 'PH1.D&C.MLOH.BUDGET.0006.5', sub_ref: 'MLOH.CON.PMI-006.1', category: 'PMI', amount: 3502827.78 })
    expect(items[0].category).toBe('Claim')
    expect(items[2].amount).toBe(-7229.34)
  })

  it('returns no items when the sheet is missing', () => {
    expect(parseVOItems(undefined)).toEqual([])
  })
})

describe('reconcileItems', () => {
  const lines = [
    { code: 'A.0001', awarded: 100, vo_approved: 50 },
    { code: 'A.0002', awarded: 0, vo_approved: 20 },
    { code: 'A.0003', awarded: 0, vo_approved: 0 },
  ]
  const items = [
    { code: 'A.0001', amount: 100 }, { code: 'A.0001', amount: 50 },
    { code: 'A.0002', amount: 15 },
    { code: 'A.9999', amount: 7 },
  ]

  it('lists lines whose items do not add up to awarded + approved VOs', () => {
    const r = reconcileItems(lines, items)
    expect(r.mismatches).toEqual([{ code: 'A.0002', expected: 20, found: 15 }])
  })

  it('lists items whose budget code is not in the report', () => {
    expect(reconcileItems(lines, items).unmatched).toEqual([{ code: 'A.9999', amount: 7 }])
  })
})
