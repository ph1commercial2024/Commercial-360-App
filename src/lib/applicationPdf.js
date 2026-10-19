import { jsPDF } from "jspdf";

const PAGE = { w: 210, h: 297, margin: 16 };
const INK = [26, 25, 23], SEC = [107, 104, 96], TER = [160, 157, 151], LINE = [229, 227, 223];

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtDateTime = (iso) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Safe file name, e.g. Accreditation_Northbay_Builders_Corporation_2026-10-20.pdf */
export function pdfFileName(snapshot) {
  const name = String(snapshot.company_name || "Vendor").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const date = new Date(snapshot.submitted_at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return `Accreditation_${name}_${date}.pdf`;
}

/**
 * The official copy of a submitted accreditation application.
 * snapshot: { submitted_at, company_name, vendor_code, sections[{title, rows[[label, value]]}],
 *             documents[{name, file, number, expiry, status}], declaration, signatures[{role, name}] }
 * Returns an ArrayBuffer.
 */
export function buildApplicationPdf(snapshot) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  const left = PAGE.margin, right = PAGE.w - PAGE.margin, width = right - left;
  let y = PAGE.margin;

  const footer = () => {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...TER);
    doc.text(`${snapshot.company_name} · Supplier accreditation application · submitted ${fmtDateTime(snapshot.submitted_at)}`, left, PAGE.h - 8);
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, right, PAGE.h - 8, { align: "right" });
  };
  const ensure = (needed) => {
    if (y + needed > PAGE.h - 16) { footer(); doc.addPage(); y = PAGE.margin; }
  };
  const heading = (title) => {
    ensure(14);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK).text(title.toUpperCase(), left, y);
    y += 2;
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(left, y, right, y);
    y += 5;
  };
  const row = (label, value) => {
    const labelW = 52;
    const lines = doc.setFont("helvetica", "normal").setFontSize(9.5).splitTextToSize(String(value ?? "—") || "—", width - labelW);
    ensure(lines.length * 4.4 + 1.5);
    doc.setTextColor(...SEC).text(String(label), left, y);
    doc.setTextColor(...INK).text(lines, left + labelW, y);
    y += lines.length * 4.4 + 1.5;
  };

  // Title block
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TER).text("PH1 WORLD DEVELOPERS · SUPPLIER ACCREDITATION APPLICATION", left, y);
  y += 8;
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...INK);
  const titleLines = doc.splitTextToSize(snapshot.company_name || "Vendor", width);
  doc.text(titleLines, left, y);
  y += titleLines.length * 7;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...SEC)
    .text(`Submitted ${fmtDateTime(snapshot.submitted_at)}${snapshot.vendor_code ? ` · Reference ${snapshot.vendor_code}` : ""}`, left, y);
  y += 4;

  for (const section of snapshot.sections || []) {
    heading(section.title);
    for (const [label, value] of section.rows || []) row(label, value);
  }

  // Documents table
  heading("Documents");
  const cols = [{ t: "Document", w: 56 }, { t: "File", w: 46 }, { t: "Number", w: 28 }, { t: "Expires", w: 22 }, { t: "Status", w: width - 152 }];
  const drawHeader = () => {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...TER);
    let x = left;
    for (const c of cols) { doc.text(c.t.toUpperCase(), x, y); x += c.w; }
    y += 4;
  };
  drawHeader();
  for (const d of snapshot.documents || []) {
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    const cells = [d.name, d.file || "—", d.number || "", d.expiry ? fmtDate(d.expiry) : "", d.status || ""]
      .map((v, i) => doc.splitTextToSize(String(v), cols[i].w - 2));
    const h = Math.max(...cells.map(c => c.length)) * 3.8 + 1.8;
    if (y + h > PAGE.h - 16) { footer(); doc.addPage(); y = PAGE.margin; drawHeader(); }
    doc.setDrawColor(...LINE).line(left, y - 3, right, y - 3);
    let x = left;
    cells.forEach((c, i) => {
      doc.setTextColor(...(i === 4 && /missing/i.test(d.status || "") ? [185, 28, 28] : INK)).text(c, x, y);
      x += cols[i].w;
    });
    y += h;
  }

  // Declaration and signatures
  const decl = doc.setFont("helvetica", "normal").setFontSize(9.5).splitTextToSize(snapshot.declaration || "", width);
  ensure(decl.length * 4.4 + 30); // keep the heading, text and names together
  heading("Declaration");
  doc.setTextColor(...INK).text(decl, left, y);
  y += decl.length * 4.4 + 4;

  const people = (snapshot.signatures || []).filter(p => p.name);
  if (people.length) {
    ensure(8 + people.length * 5);
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...TER).text("CONFIRMED BY", left, y);
    y += 5;
    for (const p of people) {
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK).text(String(p.name), left, y);
      doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...SEC).text(`— ${p.role || ""}`, left + doc.getTextWidth(String(p.name)) + 2, y);
      y += 5;
    }
    y += 2;
  }
  ensure(8);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...SEC)
    .text(`Confirmed and submitted by the vendor on ${fmtDateTime(snapshot.submitted_at)} (Philippine time).`, left, y);

  footer();
  return doc.output("arraybuffer");
}
