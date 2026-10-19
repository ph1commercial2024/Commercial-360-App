// Edge function: send-vendor-copy
// Emails a vendor the PDF copy of the accreditation application they just submitted.
// Called from the vendor portal (public key), so it is deliberately narrow:
//   - the recipient is the vendor's registered RFQ email, never chosen by the caller
//   - the message is fixed; the only attachment is the PDF stored for that submission
//   - only within 2 hours of submitting, once per submission, and at most once an hour per vendor
import nodemailer from "npm:nodemailer@6";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let submissionId: number | null = null;

  try {
    const body = await req.json();
    submissionId = Number(body?.submission_id) || null;
    if (!submissionId) return json({ error: "Missing submission." }, 400);

    const { data: sub } = await db.from("vendor_submissions")
      .select("id, vendor_id, submitted_at, pdf_path, email_sent_at, snapshot").eq("id", submissionId).maybeSingle();
    if (!sub) return json({ error: "Submission not found." }, 404);
    if (sub.email_sent_at) return json({ success: true, already_sent: true });
    if (Date.now() - new Date(sub.submitted_at).getTime() > 2 * 3600e3) return json({ error: "Too late to send this copy." }, 403);

    const { count: recent } = await db.from("vendor_submissions").select("id", { count: "exact", head: true })
      .eq("vendor_id", sub.vendor_id).gte("email_sent_at", new Date(Date.now() - 3600e3).toISOString());
    if ((recent ?? 0) > 0) return json({ error: "A copy was already emailed in the last hour." }, 429);

    const { data: ci } = await db.from("vendor_company_info").select("company_name, rfq_email").eq("vendor_id", sub.vendor_id).maybeSingle();
    const recipients = String(ci?.rfq_email ?? "").split(/[,;]/).map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 5);
    if (!recipients.length) return json({ error: "No registered email for this vendor." }, 400);

    const { data: file, error: dlErr } = await db.storage.from("vendor-submissions").download(sub.pdf_path);
    if (dlErr || !file) throw new Error(`PDF not found: ${dlErr?.message ?? "missing"}`);
    const pdf = new Uint8Array(await file.arrayBuffer());

    const company = String(ci?.company_name || sub.snapshot?.company_name || "Vendor");
    const when = new Date(sub.submitted_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short" });
    const date = new Date(sub.submitted_at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const fileName = `Accreditation_${company.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}_${date}.pdf`;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: Deno.env.get("GMAIL_USER")!, pass: Deno.env.get("GMAIL_APP_PASSWORD")! },
    });
    await transporter.sendMail({
      from: Deno.env.get("GMAIL_USER")!,
      to: recipients.join(","),
      subject: `Your accreditation application — ${company}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;">
        <h2 style="margin:0 0 12px;">Thank you for your application</h2>
        <p>Dear <strong>${esc(company)}</strong>,</p>
        <p>We received your supplier accreditation application on <strong>${esc(when)}</strong>.</p>
        <p>Attached is a PDF copy of exactly what you submitted, including your confirmed declaration. Please keep it for your records.</p>
        <p>PH1 World Developers will review your application and contact you at this email address.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:11px;color:#999;">PH1 World Developers · Supplier accreditation</p>
      </div>`,
      attachments: [{ filename: fileName, content: toBase64(pdf), encoding: "base64", contentType: "application/pdf" }],
    });

    await db.from("vendor_submissions").update({ email_sent_at: new Date().toISOString(), emailed_to: recipients.join(","), email_error: null }).eq("id", sub.id);
    return json({ success: true, emailed_to: recipients.join(",") });
  } catch (err) {
    console.error("send-vendor-copy error:", err);
    if (submissionId) await db.from("vendor_submissions").update({ email_error: String(err).slice(0, 500) }).eq("id", submissionId);
    return json({ error: "Could not send the copy." }, 500);
  }
});
