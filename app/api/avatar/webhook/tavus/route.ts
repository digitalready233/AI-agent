import { handleTavusWebhookPayload } from "@/lib/avatar/tavus-webhook";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = await handleTavusWebhookPayload(body);
  return Response.json({ ok: true, matched: result.matched });
}
