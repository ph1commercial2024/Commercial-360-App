import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, attachments } = await req.json();
    // Optional attachments: [{ filename, content (base64), contentType }], at most 3 files of 8 MB each
    const files = Array.isArray(attachments) ? attachments.slice(0, 3)
      .filter((a) => a?.filename && typeof a.content === "string" && a.content.length <= 8 * 1024 * 1024 * 1.4)
      .map((a) => ({ filename: String(a.filename).slice(0, 120), content: a.content, encoding: "base64", contentType: a.contentType || "application/octet-stream" }))
      : [];
    const user = Deno.env.get("GMAIL_USER")!;
    const pass = Deno.env.get("GMAIL_APP_PASSWORD")!;

    console.log("send-email: to=", to, "subject=", subject?.slice(0, 60));
    console.log("send-email: GMAIL_USER set=", !!user, "PASS set=", !!pass);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({ from: user, to, subject, html, ...(files.length ? { attachments: files } : {}) });
    console.log("send-email: sent OK", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
