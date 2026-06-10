import { handleTavusWebhookPayload } from "@/lib/avatar/tavus-webhook";
import { verifyTavusWebhookRequest } from "@/lib/avatar/webhook-verify";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyTavusWebhookRequest(req, rawBody);
  if (!verified.ok) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = await handleTavusWebhookPayload(body);
  return Response.json({ ok: true, matched: result.matched });
}
