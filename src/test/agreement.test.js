import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import process from 'node:process';
import PizZip from 'pizzip';
import {
  pesoWords, countWords, worksPhrase, splitLead, agreementData, renderAgreement, agreementNo, agreementMissing, smartQuotes, billingParts, isSuggested,
  WORK_TYPES, DP_SUGGESTIONS, BILLING_SUGGESTIONS, RETENTION_SUGGESTIONS, defaultTerms, emptyAgreement,
} from '../lib/agreement.js';

const TEMPLATE = fs.readFileSync(process.cwd() + '/src/assets/construction_agreement_template.docx');
const docText = (buf) => {
  const xml = new PizZip(buf).file('word/document.xml').asText();
  return xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
};

const sample = () => ({
  ...emptyAgreement(),
  projectName: 'Avesta Residences', projectLocation: 'Santa Rosa, Laguna',
  clientName: 'Avesta Development Corp.', clientAddress: 'Paseo de Sta. Rosa, Laguna', clientRep: 'Maria L. Reyes', clientRepDesignation: 'President',
  contractorName: 'Maxbuild Construction Corp.', contractorType: 'corporation', contractorAddress: 'Shaw Blvd., Mandaluyong City',
  contractorRep: 'Ramon D. Cruz', contractorRepDesignation: 'President',
  works: 'the perimeter fence and guardhouse', workType: 'db',
  lead: WORK_TYPES.db.lead, a12: WORK_TYPES.db.a12, a23: WORK_TYPES.db.a23,
  items: ['Design drawings', 'Footings and columns', 'CHB wall'],
  price: '4,850,000.50', completionMode: 'duration', days: '120',
  dp: DP_SUGGESTIONS.none, billingType: 'milestone', billing: BILLING_SUGGESTIONS.milestone.replace('[milestone]', 'the structural works'), payDays: '30', retention: RETENTION_SUGGESTIONS.ten,
  clientSignatory: 'Maria L. Reyes', clientSignatoryDesignation: 'President',
  contractorSignatory: 'Ramon D. Cruz', contractorSignatoryDesignation: 'President',
});

describe('amounts and numbers in words', () => {
  it('writes pesos the way the template does', () => {
    expect(pesoWords(4850000)).toBe('FOUR MILLION EIGHT HUNDRED FIFTY THOUSAND PESOS');
    expect(pesoWords(1275500.25)).toBe('ONE MILLION TWO HUNDRED SEVENTY-FIVE THOUSAND FIVE HUNDRED PESOS AND TWENTY-FIVE CENTAVOS');
    expect(pesoWords(1000000000)).toBe('ONE BILLION PESOS');
    expect(pesoWords(0.5)).toBe('ZERO PESOS AND FIFTY CENTAVOS');
    expect(pesoWords(1)).toBe('ONE PESO');
  });
  it('writes day counts as "words (number)"', () => {
    expect(countWords(120)).toBe('one hundred twenty (120)');
    expect(countWords('14')).toBe('fourteen (14)');
    expect(countWords('')).toBe('');
    expect(countWords('abc')).toBe('');
  });
  it('rounds a price with stray decimals to centavos', () => {
    expect(pesoWords(10.999)).toBe('ELEVEN PESOS');
  });
});

describe('type of works', () => {
  it('words the WHEREAS clause to match', () => {
    expect(worksPhrase('build', 'the fence')).toBe('the construction of the fence');
    expect(worksPhrase('db', 'the fence')).toBe('the design and construction of the fence');
    expect(worksPhrase('si', 'the fence')).toBe('the supply and installation of the fence');
  });
  it('every type has 1.1, 1.2 and 2.3 wording, and 1.1 names the works and the defined term', () => {
    for (const t of Object.values(WORK_TYPES)) {
      expect(t.lead).toContain('{works}');
      expect(t.lead).toMatch(/"Works"/);
      expect(t.a12.length).toBeGreaterThan(40);
      expect(t.a23.length).toBeGreaterThan(40);
    }
  });
  it('splits the 1.1 opening around the defined term so "Works" stays bold', () => {
    const s = splitLead('Build {works} at the Project Site (the "Works"), as follows:', 'the fence');
    expect(s).toEqual({ lead_a: 'Build the fence at the Project Site (the “', works_word: 'Works', lead_b: '”), as follows:' });
    expect(splitLead('Build {works} only.', 'X')).toEqual({ lead_a: 'Build X only.', works_word: '', lead_b: '' });
  });
});

describe('agreementData', () => {
  it('fills every template field', () => {
    const d = agreementData(sample());
    expect(d.price_words).toBe('FOUR MILLION EIGHT HUNDRED FIFTY THOUSAND PESOS AND FIFTY CENTAVOS');
    expect(d.price_figures).toBe('4,850,000.50');
    expect(d.client_name).toBe('AVESTA DEVELOPMENT CORP.');
    expect(d.contractor_rep).toBe('RAMON D. CRUZ');
    expect(d.items).toEqual([
      { letter: 'a', text: 'Design drawings', sep: ';' },
      { letter: 'b', text: 'Footings and columns', sep: '; and' },
      { letter: 'c', text: 'CHB wall', sep: '.' },
    ]);
    expect(d.a32).toBe('The CONTRACTOR shall complete the Works within one hundred twenty (120) calendar days from the official first day (the “Completion Period”).');
    expect(d.pay_days).toBe('thirty (30)');
    expect(d.takeover_days).toBe('fourteen (14)');
    expect(d.has_client2).toBe(false);
  });
  it('uses start and end dates when chosen', () => {
    const d = agreementData({ ...sample(), completionMode: 'dates', startDate: '2026-12-01', endDate: '2027-03-31' });
    expect(d.a31).toBe('The CONTRACTOR shall commence the Works on December 1, 2026, which day shall be considered the official first day of the Works.');
    expect(d.a32).toBe('The CONTRACTOR shall complete the Works on or before March 31, 2027 (the “Completion Period”).');
  });
  it('a single work item ends with a full stop', () => {
    expect(agreementData({ ...sample(), items: ['Only item', '  '] }).items).toEqual([{ letter: 'a', text: 'Only item', sep: '.' }]);
  });
  it('shows "Witness" when no witness name is typed', () => {
    const d = agreementData(sample());
    expect([d.witness1, d.witness2]).toEqual(['Witness', 'Witness']);
  });
});

describe('agreementNo (internal only)', () => {
  it('formats the app reference from id and year', () => {
    expect(agreementNo({ id: 7, created_at: '2026-11-06T08:00:00Z' })).toBe('CA-2026-007');
  });
});

describe('renderAgreement on the real template', () => {
  it('fills the Word file with no leftover blanks or tags', () => {
    const out = renderAgreement(TEMPLATE, agreementData(sample()));
    const t = docText(out);
    expect(t).not.toMatch(/[{}]/);
    expect(t).not.toMatch(/\[[^\]]*\]/);
    expect(t).toContain('AVESTA DEVELOPMENT CORP., a corporation');
    expect(t).toContain('MAXBUILD CONSTRUCTION CORP., a corporation duly registered');
    expect(t).toContain('for the design and construction of the perimeter fence and guardhouse at Santa Rosa, Laguna');
    expect(t).toContain('(a)\tDesign drawings;');
    expect(t).toContain('(c)\tCHB wall.');
    expect(t).toContain('FOUR MILLION EIGHT HUNDRED FIFTY THOUSAND PESOS AND FIFTY CENTAVOS (Php 4,850,000.50)');
    expect(t).toContain('The Contract Price shall be paid through the following billing milestones:\n');
    expect(t).toContain('(a)\tFirst Billing – fifty percent (50%)'); // each billing line is its own indented paragraph
    expect(t).toContain('(b)\tSecond Billing');
    expect(t).toContain('the CONTRACTOR’s submission of the Certificate');   // curly apostrophe like the template
    expect(t).toContain('this ____ day of ______________ 20___'); // date and place stay blank
    expect(t).not.toContain('CA-');                             // the app reference never goes in the document
  });
  it('drops the optional second client signatory line when blank, keeps it when filled', () => {
    const lines = (d) => (docText(renderAgreement(TEMPLATE, d)).match(/_{30}/g) || []).length;
    const base = agreementData(sample());
    const withTwo = agreementData({ ...sample(), client2Signatory: 'Juan Dela Cruz', client2SignatoryDesignation: 'Treasurer' });
    expect(lines(withTwo) - lines(base)).toBe(1);
    expect(docText(renderAgreement(TEMPLATE, withTwo))).toContain('JUAN DELA CRUZ');
  });
  it('produces a valid zip that Word can open (document.xml parses)', () => {
    const out = renderAgreement(TEMPLATE, agreementData(sample()));
    const xml = new PizZip(out).file('word/document.xml').asText();
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(() => new DOMParser().parseFromString(xml, 'application/xml')).not.toThrow();
    expect(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length).toBe(0);
  });
});

describe('typography and billing lines', () => {
  it('turns straight quotes into curly ones', () => {
    expect(smartQuotes(`the CLIENT's "design brief" ('draft')`)).toBe('the CLIENT’s “design brief” (‘draft’)');
  });
  it('splits billing into 4.2 and labelled lines', () => {
    expect(billingParts('Paid as follows:\n(a) 50% on X; and\n\n(b) the rest.\nPlain line')).toEqual({
      billing_first: 'Paid as follows:',
      billing_lines: [{ label: '(a)', text: '50% on X; and' }, { label: '(b)', text: 'the rest.' }, { label: '', text: 'Plain line' }],
    });
    expect(billingParts(BILLING_SUGGESTIONS.turnkey).billing_lines).toEqual([]);
  });
});

describe('agreementMissing', () => {
  it('lists nothing for a complete agreement', () => {
    expect(agreementMissing({ ...sample(), projectId: 1, vendorId: 2 })).toEqual([]);
  });
  it('flags suggestion blanks still in square brackets', () => {
    const f = { ...sample(), projectId: 1, vendorId: 2, billing: BILLING_SUGGESTIONS.milestone };
    expect(agreementMissing(f)).toEqual(['Fill in [milestone] in Billing']);
  });
  it('flags missing basics and a completion date before the start', () => {
    expect(agreementMissing({ ...emptyAgreement() })).toEqual(['Project', 'Contractor', 'Description of the works', 'At least one work item', 'Contract price', 'Completion period', 'Fill in [milestone] in Billing']);
    const f = { ...sample(), projectId: 1, vendorId: 2, completionMode: 'dates', startDate: '2027-01-10', endDate: '2027-01-01' };
    expect(agreementMissing(f)).toEqual(['Completion date on or after the start date']);
  });
});

describe('review fixes', () => {
  const full = () => ({ ...sample(), projectId: 1, vendorId: 2 });
  it('flags blank or non-number day counts and blank other terms', () => {
    const f = { ...full(), payDays: 'thirty', takeoverDays: '', cocaDays: '7.', dlpMonths: '0', noticeDays: '60', ldRate: ' ', ldCap: '', termFee: '' };
    expect(agreementMissing(f)).toEqual([
      'Pay within (days)', 'Take-over after (days)', 'COCA / COFA within (days)', 'Defects liability (months)',
      'Liquidated damages per day', 'Liquidated damages cap', 'Termination fee',
    ]);
  });
  it('strips control characters pasted from Word or PDF, so the Word file can always be made', () => {
    const d = agreementData({ ...full(), a12: 'x\u000By\u0007z' });
    expect(d.a12).toBe('xyz');
    expect(() => renderAgreement(TEMPLATE, d)).not.toThrow();
  });
  it('keeps line breaks typed in the clause fields', () => {
    const out = renderAgreement(TEMPLATE, agreementData({ ...full(), dp: 'First part.\nSecond part.' }));
    const xml = new PizZip(out).file('word/document.xml').asText();
    expect(xml).toMatch(/First part\.<\/w:t>.*?<w:br\/>.*?Second part\./s); // a real Word line break, not a raw newline
    expect(xml).not.toContain('First part.\nSecond part.');
  });
  it('prints the second client signatory block when only the designation is filled', () => {
    expect(agreementData({ ...full(), client2SignatoryDesignation: 'Treasurer' }).has_client2).toBe(true);
  });
  it('says CENTAVO for one centavo', () => {
    expect(pesoWords(2.01)).toBe('TWO PESOS AND ONE CENTAVO');
  });
  it('flags amounts too large to write in words', () => {
    expect(agreementMissing({ ...full(), price: '1000000000000' })).toEqual(['Contract price below one trillion pesos']);
  });
  it('allows at most 26 work items (a to z)', () => {
    const many = Array.from({ length: 27 }, (_, i) => 'Item ' + i);
    expect(agreementMissing({ ...full(), items: many })).toEqual(['At most 26 work items']);
  });
  it('knows whether a clause still has the suggested wording', () => {
    expect(isSuggested('lead', WORK_TYPES.db.lead)).toBe(true);
    expect(isSuggested('billing', BILLING_SUGGESTIONS.turnkey)).toBe(true);
    expect(isSuggested('a12', 'My own wording')).toBe(false);
    expect(isSuggested('a12', '')).toBe(true);
  });
});

describe('defaults', () => {
  it('match the template values', () => {
    expect(defaultTerms()).toEqual({ ldRate: 'one-tenth of one percent (1/10 of 1%)', ldCap: 'ten percent (10%)', takeoverDays: '14', cocaDays: '7', dlpMonths: '12', noticeDays: '60', termFee: 'fifteen percent (15%)' });
  });
});
