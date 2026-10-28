import { describe, it, expect } from 'vitest';

// QA guard tests for the PR submit rules. A mutation harness can alias ../lib/prSubmit.js to a COPY via its own vitest config.
import { prSubmitProblems, blockersFor, isSubmitClick, canSaveDraft } from '../lib/prSubmit.js';
import { emptyScope } from '../lib/scopeOfWorks.js';

const confirmedScope = () => {
  const s = emptyScope();
  const k = 'Site Works||Earthworks';
  s.types = ['Site Works']; s.included = [k];
  s.lines[k] = [{ spec: 'Excavation to footing level', qty: '10', unit: 'm³', location: 'Tower 2' }];
  s.confirmed = true;
  return s;
};
const ok = (over = {}) => ({
  projectId: '1', projectHasAreas: true, areas: ['a'], description: 'd', justification: 'j',
  isRush: false, rushJustification: '', startDate: '2026-12-20', endDate: '2026-12-25', minDate: '2026-12-11', minDays: 45,
  scope: confirmedScope(), managerId: '5', budgetStatus: 'Unbudgeted',
  docModes: { plans: 'link', tor: 'link', specs: 'link' }, docLinks: { plans: 'https://x', tor: 'https://x', specs: 'https://x' },
  ...over,
});
const msgs = (list) => list.map(p => p.message);

describe('QA: vacuity guard', () => {
  it('the fixture really is complete for each role, and removing one thing produces exactly one problem', () => {
    expect(prSubmitProblems(ok()).submit).toEqual([]);
    expect(prSubmitProblems(ok({ isReviewerCreating: true, managerId: undefined })).submit).toEqual([]);
    expect(prSubmitProblems(ok({ description: '' })).submit).toHaveLength(1);
  });
});

describe('QA: rules that block a submit', () => {
  it('end before start blocks both draft and submit; same day does not', () => {
    const p = prSubmitProblems(ok({ endDate: '2026-12-19' }));
    expect(p.draft).toHaveLength(1); expect(p.submit).toHaveLength(1);
    expect(prSubmitProblems(ok({ endDate: '2026-12-20' })).submit).toEqual([]);
  });
  it('lead time: day before minimum blocks submit only; rush text appears for rush', () => {
    const p = prSubmitProblems(ok({ startDate: '2026-12-10', endDate: '2026-12-25' }));
    expect(p.draft).toEqual([]); expect(p.submit).toHaveLength(1);
    expect(msgs(prSubmitProblems(ok({ startDate: '2026-12-10', isRush: true, rushJustification: 'r', minDays: 30 })).submit)[0]).toMatch(/rush/);
  });
  it('rush needs a non-blank reason', () => {
    expect(prSubmitProblems(ok({ isRush: true, rushJustification: '   ' })).draft).toHaveLength(1);
  });
  it('area only required when the project has areas', () => {
    expect(prSubmitProblems(ok({ areas: [] })).draft).toHaveLength(1);
    expect(prSubmitProblems(ok({ areas: [], projectHasAreas: false })).submit).toEqual([]);
  });
  it('Supervisor needs a Manager; Commercial staff needs a budget status instead', () => {
    expect(prSubmitProblems(ok({ managerId: '' })).submit).toHaveLength(1);
    expect(prSubmitProblems(ok({ isReviewerCreating: true, budgetStatus: undefined })).submit).toHaveLength(1);
    expect(prSubmitProblems(ok({ isReviewerCreating: true, managerId: '' })).submit).toEqual([]);
  });
  it('each document is checked on its own, and a whitespace link does not count', () => {
    const p = prSubmitProblems(ok({ docLinks: { plans: '   ', tor: 'https://x', specs: 'https://x' } }));
    expect(p.submit).toHaveLength(1); expect(p.submit[0].doc).toBe('plans');
  });
  it('unconfirmed scope blocks submit and points at step 4', () => {
    const s = confirmedScope(); s.confirmed = false;
    const p = prSubmitProblems(ok({ scope: s })).submit;
    expect(p).toHaveLength(1); expect(p[0].step).toBe(4);
  });
});

describe('QA: which click is blocked by which list', () => {
  it('only a Supervisor/Manager Save draft click uses the draft list; every submit click uses the submit list', () => {
    const p = prSubmitProblems(ok({ description: '', managerId: '' }));
    expect(blockersFor(p, { isReviewerCreating: false }, false)).toBe(p.draft);
    expect(blockersFor(p, { isReviewerCreating: false }, true)).toBe(p.submit);
    expect(blockersFor(p, { isReviewerCreating: true }, false)).toBe(p.submit);
    expect(isSubmitClick({}, false)).toBe(false);
    expect(canSaveDraft({ isReviewerCreating: true })).toBe(false);
    expect(canSaveDraft({})).toBe(true);
  });
});
