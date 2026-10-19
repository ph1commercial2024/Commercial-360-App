import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Only logged-in staff (the main app) and our own server jobs (service key) may send email.
// The public anon key is visible in the website, so it must not be enough.
async function isAllowed(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return true;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
  });
  if (!res.ok) return false;
  const user = await res.json().catch(() => null);
  return !!user?.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!(await isAllowed(req))) return json({ error: "Not allowed to send email." }, 401);

    const { to, subject, html, attachments } = await req.json();
    // Optional attachments: [{ filename, content (base64), contentType }], at most 3 files of 8 MB each
    const files = Array.isArray(attachments) ? attachments.slice(0, 3)
      .filter((a) => a?.filename && typeof a.content === "string" && a.content.length <= 8 * 1024 * 1024 * 1.4)
      .map((a) => ({ filename: String(a.filename).slice(0, 120), content: a.content, encoding: "base64", contentType: a.contentType || "application/octet-stream" }))
      : [];
    const user = Deno.env.get("GMAIL_USER")!;
    const pass = Deno.env.get("GMAIL_APP_PASSWORD")!;

    console.log("send-email: to=", to, "subject=", subject?.slice(0, 60));

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({ from: user, to, subject, html, ...(files.length ? { attachments: files } : {}) });
    console.log("send-email: sent OK", info.messageId);

    return json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error("send-email error:", err);
    return json({ error: String(err) }, 500);
  }
});
