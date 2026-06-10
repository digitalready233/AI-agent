import { handleDidWebhookPayload } from "@/lib/avatar/did-webhook";
import { verifyDidWebhookRequest } from "@/lib/avatar/webhook-verify";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyDidWebhookRequest(req, rawBody);
  if (!verified.ok) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = await handleDidWebhookPayload(body);
  return Response.json({ ok: true, matched: result.matched });
}
