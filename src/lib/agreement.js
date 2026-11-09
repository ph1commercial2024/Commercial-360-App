// Construction Agreement generator: turns the form into the values for the Word template
// (src/assets/construction_agreement_template.docx, made from the user's Construction_Agreement_Template.docx)
// and fills the template. The app's reference number (CA-YYYY-NNN) is internal and never goes in the document.
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// ── numbers in words ──
const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE',
  'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
function under1000(n) {
  const parts = [];
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)] + ' HUNDRED'); n %= 100; }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
  else if (n) parts.push(ONES[n]);
  return parts.join(' ');
}
function wholeWords(n) {
  if (!n) return 'ZERO';
  const parts = [];
  for (const [v, label] of [[1e9, 'BILLION'], [1e6, 'MILLION'], [1e3, 'THOUSAND']]) {
    if (n >= v) { parts.push(under1000(Math.floor(n / v)) + ' ' + label); n %= v; }
  }
  if (n) parts.push(under1000(n));
  return parts.join(' ');
}

export const parseAmount = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** 4850000.5 → "FOUR MILLION EIGHT HUNDRED FIFTY THOUSAND PESOS AND FIFTY CENTAVOS" */
export function pesoWords(amount) {
  const cents = Math.round(parseAmount(amount) * 100);
  const pesos = Math.floor(cents / 100), c = cents % 100;
  return wholeWords(pesos) + (pesos === 1 ? ' PESO' : ' PESOS') + (c ? ' AND ' + wholeWords(c) + (c === 1 ? ' CENTAVO' : ' CENTAVOS') : '');
}

export const pesoFigures = (amount) =>
  parseAmount(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 120 → "one hundred twenty (120)"; blank or not a number → "" */
export function countWords(v) {
  const n = parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n <= 0 || String(n) !== String(v).trim()) return '';
  return `${wholeWords(n).toLowerCase()} (${n})`;
}

const longDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

// ── suggested wording (all editable in the form) ──
export const WORK_TYPES = {
  build: {
    label: 'Build only', phrase: 'the construction of',
    lead: 'The CONTRACTOR shall supply all necessary labor, materials, fixtures, tools, and equipment, including supervision, required to complete {works} at the Project Site (the "Works"), consisting of the following:',
    a12: 'The Works shall be performed in accordance with the scope, plans, and specifications provided by the CLIENT and agreed upon by both Parties. All final drawings to be implemented shall be approved in writing by the CLIENT prior to execution.',
    a23: 'The CONTRACTOR warrants that it has thoroughly inspected the Project Site, plans, and all pertinent bid documents prior to and during the preparation of its proposal, and that the Contract Price already includes all items necessary to fully complete the Works in accordance with the approved plans, specifications, and finishes.',
  },
  db: {
    label: 'Design and Build', phrase: 'the design and construction of',
    lead: 'The CONTRACTOR shall design, supply all necessary labor, materials, fixtures, tools, and equipment, including supervision, and construct {works} at the Project Site (the "Works"), consisting of the following:',
    a12: "The CONTRACTOR shall prepare the design, drawings, and specifications of the Works in accordance with the CLIENT's design brief and requirements, and shall submit them for the CLIENT's written approval before execution. The CONTRACTOR shall be responsible for the adequacy of its design, and all design documents shall be signed and sealed by its duly licensed professionals.",
    a23: "The CONTRACTOR warrants that it has thoroughly inspected the Project Site and the CLIENT's design brief and requirements prior to and during the preparation of its proposal, and that the Contract Price already includes the design and all items necessary to fully complete the Works in accordance with the approved design, specifications, and finishes.",
  },
  si: {
    label: 'Supply and Install', phrase: 'the supply and installation of',
    lead: 'The CONTRACTOR shall supply, deliver, install, test, and commission {works} at the Project Site (the "Works"), including all necessary labor, materials, tools, equipment, and supervision, consisting of the following:',
    a12: "The Works shall be performed in accordance with the approved specifications and the manufacturer's installation requirements. Shop drawings and material submittals shall be approved in writing by the CLIENT prior to delivery and installation.",
    a23: 'The CONTRACTOR warrants that it has thoroughly inspected the Project Site, the specifications, and all pertinent bid documents prior to and during the preparation of its proposal, and that the Contract Price already includes all items necessary to supply, deliver, install, test, and commission the Works in accordance with the approved specifications.',
  },
};

export const DP_SUGGESTIONS = {
  none: "No down payment shall be made under this Agreement. Accordingly, no down payment bond, performance bond, or contractor's insurance shall be required of the CONTRACTOR.",
  fifteen: 'The CLIENT shall pay a down payment of fifteen percent (15%) of the Contract Price within fifteen (15) calendar days from issuance of the NTP, secured by a down payment bond of equal amount, to be recouped pro rata from each progress billing.',
  twenty: 'The CLIENT shall pay a down payment of twenty percent (20%) of the Contract Price within fifteen (15) calendar days from issuance of the NTP, secured by a down payment bond of equal amount, to be recouped pro rata from each progress billing.',
};

export const BILLING_TYPES = { progress: 'Progress', milestone: 'Milestone', turnkey: 'Turnkey' };
export const BILLING_SUGGESTIONS = {
  progress: 'The Contract Price shall be paid through monthly progress billings based on the percentage of actual accomplishment of the Works, as jointly evaluated by the Parties, less the pro rata recoupment of any down payment and the retention under Section 4.4.',
  milestone: 'The Contract Price shall be paid through the following billing milestones:\n(a) First Billing – fifty percent (50%) of the Contract Price upon completion of [milestone]; and\n(b) Second Billing – the remaining balance upon one hundred percent (100%) completion of the Works.',
  turnkey: 'The Contract Price shall be paid in full in a single billing upon one hundred percent (100%) completion, turnover, and acceptance of the Works by the CLIENT.',
};

export const RETENTION_SUGGESTIONS = {
  ten: "A retention of ten percent (10%) shall be withheld from each billing. The retention shall be released upon the CONTRACTOR's submission of the Certificate of Completion and Acceptance, the accomplishment of all punch list items, and the submission of the final billing invoice.",
  five: "A retention of five percent (5%) shall be withheld from each billing. The retention shall be released upon the CONTRACTOR's submission of the Certificate of Completion and Acceptance, the accomplishment of all punch list items, and the submission of the final billing invoice.",
  none: 'No retention shall be withheld from the billings under this Agreement.',
};

export const defaultTerms = () => ({
  ldRate: 'one-tenth of one percent (1/10 of 1%)', ldCap: 'ten percent (10%)', takeoverDays: '14',
  cocaDays: '7', dlpMonths: '12', noticeDays: '60', termFee: 'fifteen percent (15%)',
});

export const emptyAgreement = () => ({
  projectId: '', projectName: '', projectLocation: '',
  clientName: '', clientAddress: '', clientRep: '', clientRepDesignation: '',
  vendorId: '', contractorName: '', contractorType: 'corporation', contractorAddress: '', contractorRep: '', contractorRepDesignation: '',
  works: '', workType: 'build', lead: WORK_TYPES.build.lead, a12: WORK_TYPES.build.a12, a23: WORK_TYPES.build.a23, items: [''],
  price: '', completionMode: 'duration', days: '', startDate: '', endDate: '',
  dp: DP_SUGGESTIONS.none, billingType: 'milestone', billing: BILLING_SUGGESTIONS.milestone, payDays: '30', retention: RETENTION_SUGGESTIONS.ten,
  ...defaultTerms(),
  clientSignatory: '', clientSignatoryDesignation: '', client2Signatory: '', client2SignatoryDesignation: '',
  contractorSignatory: '', contractorSignatoryDesignation: '', witness1: '', witness2: '',
});

/** WHEREAS wording: "the design and construction of the fence" */
export const worksPhrase = (type, works) => `${(WORK_TYPES[type] || WORK_TYPES.build).phrase} ${works}`.trim();

/** Fills {works} and splits around the defined term so the template can keep "Works" bold */
export function splitLead(lead, works) {
  const filled = String(lead || '').split('{works}').join(works || '');
  const m = filled.match(/["“]Works["”]/);
  if (!m) return { lead_a: filled, works_word: '', lead_b: '' };
  return { lead_a: filled.slice(0, m.index) + '“', works_word: 'Works', lead_b: '”' + filled.slice(m.index + m[0].length) };
}

/** The template uses curly quotes and apostrophes; typed text usually has straight ones */
export const smartQuotes = (s) => String(s || '')
  .replace(/(^|[\s([“])"/g, '$1“').replace(/"/g, '”')
  .replace(/(^|[\s([“])'/g, '$1‘').replace(/'/g, '’');

// Control characters (often pasted from Word or PDF) are not allowed in a Word file and would stop it being made
// eslint-disable-next-line no-control-regex
const clean = (s) => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
const up = (s) => smartQuotes(clean(s).toUpperCase());
const tx = (s) => smartQuotes(clean(s));

/** True when a clause is empty or still the suggested wording, so switching type may replace it without losing edits */
export function isSuggested(field, value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (['lead', 'a12', 'a23'].includes(field)) return Object.values(WORK_TYPES).some(t => t[field] === v);
  if (field === 'billing') return Object.values(BILLING_SUGGESTIONS).includes(v);
  return false;
}

/** Billing: the first line is 4.2 itself; each further line becomes its own indented paragraph,
 *  with a leading "(a)" kept as the hanging label like the template's milestone lines */
export function billingParts(billing) {
  const lines = String(billing || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return {
    billing_first: tx(lines[0] || ''),
    billing_lines: lines.slice(1).map(l => {
      const m = l.match(/^(\([a-z0-9]+\))\s*(.*)$/i);
      return m ? { label: m[1], text: tx(m[2]) } : { label: '', text: tx(l) };
    }),
  };
}

/** Form values → template values */
export function agreementData(f) {
  const items = (f.items || []).map(tx).filter(Boolean);
  const byDates = f.completionMode === 'dates';
  return {
    project_name: tx(f.projectName), project_location: tx(f.projectLocation),
    client_name: up(f.clientName), client_address: tx(f.clientAddress),
    client_rep: up(f.clientRep), client_rep_designation: tx(f.clientRepDesignation),
    contractor_name: up(f.contractorName), contractor_type: tx(f.contractorType) || 'corporation',
    contractor_address: tx(f.contractorAddress), contractor_rep: up(f.contractorRep), contractor_rep_designation: tx(f.contractorRepDesignation),
    works_phrase: worksPhrase(f.workType, tx(f.works)),
    ...splitLead(f.lead, tx(f.works)),
    items: items.map((text, i) => ({
      letter: String.fromCharCode(97 + i), text,
      sep: i === items.length - 1 ? '.' : i === items.length - 2 ? '; and' : ';',
    })),
    a12: tx(f.a12), a23: tx(f.a23),
    price_words: pesoWords(f.price), price_figures: pesoFigures(f.price),
    a31: byDates
      ? `The CONTRACTOR shall commence the Works on ${longDate(f.startDate)}, which day shall be considered the official first day of the Works.`
      : 'The CONTRACTOR shall commence the Works within the day of its receipt of the Notice of Award/Notice to Proceed (“NTP”) from the CLIENT, which day shall be considered the official first day of the Works.',
    a32: byDates
      ? `The CONTRACTOR shall complete the Works on or before ${longDate(f.endDate)} (the “Completion Period”).`
      : `The CONTRACTOR shall complete the Works within ${countWords(f.days)} calendar days from the official first day (the “Completion Period”).`,
    dp: tx(f.dp), ...billingParts(f.billing), pay_days: countWords(f.payDays), retention: tx(f.retention),
    ld_rate: tx(f.ldRate), ld_cap: tx(f.ldCap), takeover_days: countWords(f.takeoverDays),
    coca_days: countWords(f.cocaDays), dlp_months: countWords(f.dlpMonths), notice_days: countWords(f.noticeDays), term_fee: tx(f.termFee),
    client_signatory: up(f.clientSignatory), client_signatory_designation: tx(f.clientSignatoryDesignation),
    has_client2: !!(tx(f.client2Signatory) || tx(f.client2SignatoryDesignation)),
    client2_signatory: up(f.client2Signatory), client2_signatory_designation: tx(f.client2SignatoryDesignation),
    contractor_signatory: up(f.contractorSignatory), contractor_signatory_designation: tx(f.contractorSignatoryDesignation),
    witness1: tx(f.witness1) || 'Witness', witness2: tx(f.witness2) || 'Witness',
  };
}

/** What's still missing before the Word file is worth downloading (saving a draft is always allowed) */
export function agreementMissing(f) {
  const miss = [];
  if (!f.projectId) miss.push('Project');
  if (!f.vendorId) miss.push('Contractor');
  if (!tx(f.works)) miss.push('Description of the works');
  const itemCount = (f.items || []).filter(i => tx(i)).length;
  if (!itemCount) miss.push('At least one work item');
  if (itemCount > 26) miss.push('At most 26 work items');
  if (!parseAmount(f.price)) miss.push('Contract price');
  else if (parseAmount(f.price) >= 1e12) miss.push('Contract price below one trillion pesos');
  if (f.completionMode === 'dates' ? !(f.startDate && f.endDate) : !countWords(f.days)) miss.push('Completion period');
  if (f.completionMode === 'dates' && f.startDate && f.endDate && f.endDate < f.startDate) miss.push('Completion date on or after the start date');
  // Day counts are written as "thirty (30)", so each must be a whole number
  for (const [k, label] of [['payDays', 'Pay within (days)'], ['takeoverDays', 'Take-over after (days)'], ['cocaDays', 'COCA / COFA within (days)'],
    ['dlpMonths', 'Defects liability (months)'], ['noticeDays', 'Termination notice (days)']]) {
    if (!countWords(f[k])) miss.push(label);
  }
  for (const [k, label] of [['ldRate', 'Liquidated damages per day'], ['ldCap', 'Liquidated damages cap'], ['termFee', 'Termination fee']]) {
    if (!tx(f[k])) miss.push(label);
  }
  // Suggested wording leaves blanks like [milestone] for the user to fill in
  const fields = [['lead', 'Article 1.1'], ['a12', 'Article 1.2'], ['a23', 'Article 2.3'], ['dp', 'Down payment'], ['billing', 'Billing'], ['retention', 'Retention']];
  for (const [k, label] of fields) {
    const m = String(f[k] || '').match(/\[[^\]]+\]/);
    if (m) miss.push(`Fill in ${m[0]} in ${label}`);
  }
  return miss;
}

/** Fills the Word template; returns the .docx as an ArrayBuffer/Uint8Array */
export function renderAgreement(templateBytes, data) {
  const doc = new Docxtemplater(new PizZip(templateBytes), { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
  doc.render(data);
  return doc.getZip().generate({ type: typeof window === 'undefined' ? 'nodebuffer' : 'arraybuffer', compression: 'DEFLATE' });
}

/** Internal reference shown only in the app, e.g. CA-2026-007 */
export const agreementNo = (row) => `CA-${new Date(row.created_at).getFullYear()}-${String(row.id).padStart(3, '0')}`;

/** File name for the download */
export const agreementFileName = (f) =>
  `Construction Agreement - ${tx(f.projectName) || 'Project'} - ${tx(f.contractorName) || 'Contractor'}.docx`.replace(/[\\/:*?"<>|]/g, '');
