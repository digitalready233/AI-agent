import { handleDidWebhookPayload } from "@/lib/avatar/did-webhook";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = await handleDidWebhookPayload(body);
  return Response.json({ ok: true, matched: result.matched });
}
