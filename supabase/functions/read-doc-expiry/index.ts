// Edge function: read-doc-expiry
// Receives a base64-encoded document file, sends it to Claude, returns the expiry date.
// Supported types: PDF, JPEG, PNG.  Others return { expiry_date: null, reason: "unsupported_type" }.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — larger files are sent back for manual entry

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { base64, mime_type, doc_type } = await req.json();

    // Size guard (base64 is ~4/3 of original)
    if (base64.length > MAX_BYTES * 1.4) {
      return json({ expiry_date: null, reason: "file_too_large" });
    }

    const isPdf   = mime_type === "application/pdf";
    const isImage = ["image/jpeg", "image/jpg", "image/png"].includes(mime_type);

    if (!isPdf && !isImage) {
      return json({ expiry_date: null, reason: "unsupported_type" });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ expiry_date: null, reason: "no_api_key" }, 500);

    const contentBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf",    data: base64 } }
      : { type: "image",    source: { type: "base64", media_type: mime_type,             data: base64 } };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 32,
        messages: [{
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: [
                `This document is: "${doc_type}".`,
                "Find the expiration, validity, or expiry date.",
                "Reply with ONLY the date in YYYY-MM-DD format (e.g. 2025-12-31).",
                "If no expiry date is visible, reply with exactly: null",
              ].join(" "),
            },
          ],
        }],
      }),
    });

    const result = await res.json();
    const text = (result.content?.[0]?.text ?? "").trim();

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const expiry_date = dateRegex.test(text) ? text : null;

    return json({ expiry_date });
  } catch (err) {
    console.error("read-doc-expiry error:", err);
    return json({ expiry_date: null, reason: "error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
