import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import process from 'node:process';
import { prSubmitProblems, clickTarget, checklistVisible } from '../lib/prSubmit.js';

// Round 2 QA: checklist only for 1-3 missing items; click routing per role; plain button labels.
const base = (over = {}) => ({
  projectId: '1', projectHasAreas: false, areas: [], description: 'd', justification: 'j',
  startDate: '2026-12-20', endDate: '2026-12-25', minDate: '2026-12-11', minDays: 45,
  scope: null, managerId: '5', budgetStatus: 'Unbudgeted',
  docModes: { plans: 'link', tor: 'link', specs: 'link' }, docLinks: { plans: 'x', tor: 'x', specs: 'x' },
  ...over,
});
const sup = {};
const co = { isReviewerCreating: true };

describe('QA2: checklist visibility follows the submit count', () => {
  it('exactly 1..3 missing shows, 0 and 4+ do not', () => {
    // vacuity: the fixture is complete, so removing items one at a time really does raise the count
    expect(prSubmitProblems(base()).submit).toHaveLength(0);
    const counts = [
      prSubmitProblems(base({ managerId: '' })).submit.length,
      prSubmitProblems(base({ managerId: '', docLinks: { plans: '', tor: 'x', specs: 'x' } })).submit.length,
      prSubmitProblems(base({ managerId: '', docLinks: { plans: '', tor: '', specs: 'x' } })).submit.length,
      prSubmitProblems(base({ managerId: '', docLinks: { plans: '', tor: '', specs: '' } })).submit.length,
    ];
    expect(counts).toEqual([1, 2, 3, 4]);
    expect(counts.map(checklistVisible)).toEqual([true, true, true, false]);
  });
});

describe('QA2: click routing', () => {
  it('Supervisor, 4+ missing: Send jumps to the first submit item (manager), Save draft to the first DRAFT item (description)', () => {
    const p = prSubmitProblems(base({ managerId: '', description: '', docLinks: { plans: '', tor: '', specs: '' } }));
    expect(p.submit.length).toBeGreaterThanOrEqual(4);
    expect(clickTarget(p, sup, true)).toEqual({ kind: 'item', item: p.submit[0] });
    expect(clickTarget(p, sup, true).item.section).toBe('manager');
    expect(clickTarget(p, sup, false).item.section).toBe('details');
  });
  it('Supervisor, 4+ missing but draft basics complete: Save draft is not blocked (saves)', () => {
    const p = prSubmitProblems(base({ managerId: '', docLinks: { plans: '', tor: '', specs: '' } }));
    expect(p.submit.length).toBe(4);
    expect(clickTarget(p, sup, false)).toBeNull();
    expect(clickTarget(p, sup, true)).not.toBeNull();
  });
  it('Supervisor, 1-3 missing: any blocked click goes to the checklist', () => {
    const p = prSubmitProblems(base({ description: '' }));
    expect(clickTarget(p, sup, true)).toEqual({ kind: 'checklist' });
    expect(clickTarget(p, sup, false)).toEqual({ kind: 'checklist' });
  });
  it('Commercial Officer, 4+ missing: first blocker is the first submit item incl. budget; nothing missing: go ahead', () => {
    const p = prSubmitProblems(base({ ...co, projectId: '', budgetStatus: '', docLinks: { plans: '', tor: '', specs: '' } }));
    expect(clickTarget(p, co, false).item.section).toBe('project');
    const p2 = prSubmitProblems(base({ ...co, budgetStatus: '', docLinks: { plans: '', tor: '', specs: '' } }));
    expect(clickTarget(p2, co, false).item.section).toBe('budget');
    expect(clickTarget(prSubmitProblems(base(co)), co, false)).toBeNull();
  });
});

describe('QA2: header labels are plain (source check)', () => {
  const src = fs.readFileSync(process.cwd() + '/src/App.jsx', 'utf8').replace(/\r\n/g, '\n');
  it('no "to complete" counter is rendered inside the header buttons', () => {
    expect(src.length).toBeGreaterThan(100000);                    // vacuity: file really loaded
    const i = src.indexOf('Send to Manager');
    expect(i).toBeGreaterThan(-1);
    const header = src.slice(src.lastIndexOf('actions: (', i), i + 300);
    expect(header).toContain('Save draft');
    expect(header).not.toMatch(/· \$\{|· \{.*Count|to complete<|· \{/);
  });
});
