/**
 * check-doc-expiry — Supabase Edge Function
 *
 * Checks all accredited vendors for expiring / expired documents and sends
 * reminder emails via the existing send-email function.
 *
 * Trigger schedule (via Supabase cron or pg_cron — run daily at 7 AM):
 *   SELECT cron.schedule('check-doc-expiry-daily', '0 7 * * *',
 *     $$SELECT net.http_post(
 *       url := current_setting('app.supabase_url') || '/functions/v1/check-doc-expiry',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
 *       ),
 *       body := '{}'::jsonb
 *     ) AS request_id;$$
 *   );
 *
 * Trigger days (relative to expiry date):
 *   40  = 40 days before expiry  (first notice)
 *   30  = 30 days before expiry  (second reminder)
 *   7   = 7 days before expiry   (urgent reminder)
 *   0   = on expiry date         (expiration notice)
 *  -7   = 7 days after expiry    (follow-up)
 *  -30  = 30 days after expiry   (final notice)
 *
 * Stops automatically when vendor uploads a renewed document
 * (i.e. vendor_doc_expiry.expiry_date > today for that doc).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Days relative to expiry date at which to send emails.
// Positive = before expiry, negative = after expiry.
// Source of truth: src/lib/docExpiryLogic.js (keep in sync)
const TRIGGER_DAYS = [40, 30, 7, 0, -7, -30];

const TRIGGER_LABELS: Record<number, string> = {
  40:  "expires in 40 days",
  30:  "expires in 30 days",
  7:   "expires in 7 days",
  0:   "expired today",
  [-7]:  "expired 7 days ago",
  [-30]: "expired 30 days ago",
};

function docLabel(docType: string): string {
  return docType;
}

function buildEmailHtml(companyName: string, docs: { docType: string; expiryDate: string; daysLabel: string }[]): string {
  const rows = docs.map(d => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#1A1917;">${docLabel(d.docType)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#92580A;white-space:nowrap;">${d.daysLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E3DF;font-size:13px;color:#6B6860;white-space:nowrap;">${d.expiryDate}</td>
    </tr>`).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8F7F5;font-family:Calibri,Candara,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #E5E3DF;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#3F3F3F,#2A2A2A);padding:20px 24px;">
      <div style="font-size:16px;font-weight:700;color:#fff;">Document Renewal Required</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:3px;">PH1 World Developers Inc. — Vendor Accreditation</div>
    </div>
    <div style="padding:20px 24px;">
      <p style="font-size:14px;color:#1A1917;margin:0 0 16px;">Dear <strong>${companyName}</strong>,</p>
      <p style="font-size:13px;color:#6B6860;line-height:1.6;margin:0 0 16px;">
        Your accreditation is active. However, the following documents require renewal.
        Please upload renewed copies through your accreditation portal link.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E5E3DF;border-radius:8px;overflow:hidden;margin-bottom:20px;">
        <thead>
          <tr style="background:#F8F7F5;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#A09D97;text-transform:uppercase;letter-spacing:0.06em;">Document</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#A09D97;text-transform:uppercase;letter-spacing:0.06em;">Status</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#A09D97;text-transform:uppercase;letter-spacing:0.06em;">Expiry Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:12px;color:#A09D97;line-height:1.6;margin:0;">
        Please use the accreditation link sent to your email to upload the renewed documents.
        If you need assistance, contact us at <a href="mailto:procurement@ph1worlddevelopers.com" style="color:#3F3F3F;">procurement@ph1worlddevelopers.com</a>.
      </p>
    </div>
    <div style="padding:14px 24px;background:#F8F7F5;border-top:1px solid #E5E3DF;">
      <p style="font-size:11px;color:#A09D97;margin:0;">PH1 World Developers Inc. · 22nd Floor, Primex Tower, EDSA corner Connecticut, San Juan, Metro Manila</p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Fetch all expiry records for accredited vendors, with company name + email
  const { data: expiries, error: expErr } = await supabase
    .from("vendor_doc_expiry")
    .select(`
      vendor_id,
      doc_type,
      expiry_date,
      vendors!inner (
        accreditation_status,
        vendor_company_info ( company_name, rfq_email )
      )
    `)
    .eq("vendors.accreditation_status", "Accredited")
    .not("expiry_date", "is", null);

  if (expErr) {
    console.error("Failed to fetch expiries:", expErr);
    return new Response(JSON.stringify({ error: expErr.message }), { status: 500, headers: CORS });
  }

  // 2. For each expiry record, check if today matches a trigger day
  const toSend: {
    vendorId: string;
    docType: string;
    expiryDate: string;
    triggerDay: number;
    companyName: string;
    email: string;
  }[] = [];

  for (const row of expiries || []) {
    const vendor = (row as any).vendors;
    const ci = vendor?.vendor_company_info;
    const email = ci?.rfq_email;
    const companyName = ci?.company_name || "Vendor";
    if (!email) continue;

    const expiry = new Date(row.expiry_date);
    expiry.setHours(0, 0, 0, 0);
    // daysToExpiry: positive = future (before expiry), negative = past (after expiry)
    const daysToExpiry = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);

    if (TRIGGER_DAYS.includes(daysToExpiry)) {
      toSend.push({
        vendorId:    row.vendor_id,
        docType:     row.doc_type,
        expiryDate:  row.expiry_date,
        triggerDay:  daysToExpiry,
        companyName,
        email,
      });
    }
  }

  if (toSend.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No triggers today" }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // 3. Check which have already been notified (avoid duplicates)
  const { data: alreadySent } = await supabase
    .from("vendor_doc_notifications")
    .select("vendor_id, doc_type, trigger_day, expiry_date_ref")
    .in("vendor_id", [...new Set(toSend.map(r => r.vendorId))]);

  const sentSet = new Set(
    (alreadySent || []).map(r => `${r.vendor_id}|${r.doc_type}|${r.trigger_day}|${r.expiry_date_ref}`)
  );

  const pending = toSend.filter(r =>
    !sentSet.has(`${r.vendorId}|${r.docType}|${r.triggerDay}|${r.expiryDate}`)
  );

  // 4. Group pending by vendor+email so we send one email per vendor
  const byVendor = new Map<string, typeof pending>();
  for (const item of pending) {
    const key = `${item.vendorId}|${item.email}`;
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key)!.push(item);
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const [, items] of byVendor) {
    const { companyName, email } = items[0];
    const docList = items.map(i => ({
      docType:    i.docType,
      expiryDate: i.expiryDate,
      daysLabel:  TRIGGER_LABELS[i.triggerDay] ?? `${Math.abs(i.triggerDay)} days`,
    }));

    const subject = `Action Required: Document Renewal — ${companyName}`;
    const html    = buildEmailHtml(companyName, docList);

    // Send via existing send-email function
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ to: email, subject, html }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      errors.push(`${email}: ${e}`);
      continue;
    }

    // Log sent notifications
    const rows = items.map(i => ({
      vendor_id:       i.vendorId,
      doc_type:        i.docType,
      trigger_day:     i.triggerDay,
      expiry_date_ref: i.expiryDate,
      email_to:        email,
    }));
    await supabase.from("vendor_doc_notifications").upsert(rows, {
      onConflict: "vendor_id,doc_type,trigger_day,expiry_date_ref",
    });

    sentCount++;
  }

  console.log(`check-doc-expiry: sent=${sentCount} errors=${errors.length}`);
  return new Response(
    JSON.stringify({ sent: sentCount, errors }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
