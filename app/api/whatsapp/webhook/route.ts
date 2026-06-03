import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp/signature";
import { verifyWhatsAppWebhookToken } from "@/lib/whatsapp/verify";
import {
  isWhatsAppStatusOnlyWebhook,
  parseInboundWhatsAppMessages,
  parseUnsupportedWhatsAppMessages,
} from "@/lib/whatsapp/webhook-parser";
import { processInboundWhatsAppMessage } from "@/lib/whatsapp/inbound";
import { processUnsupportedWhatsAppMessage } from "@/lib/whatsapp/unsupported";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.info("[whatsapp] webhook verify", { mode, hasChallenge: Boolean(challenge) });

  if (mode !== "subscribe" || !challenge) {
    return new Response("Bad Request", { status: 400 });
  }

  const valid = await verifyWhatsAppWebhookToken(token);
  if (!valid) {
    console.warn("[whatsapp] webhook verify failed — token mismatch");
    return new Response("Forbidden", { status: 403 });
  }

  console.info("[whatsapp] webhook verified");
  return new Response(challenge, { status: 200 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-hub-signature-256");

  const sig = verifyWhatsAppWebhookSignature({
    rawBody,
    signatureHeader,
  });

  if (!sig.valid) {
    return Response.json({ status: "invalid_signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch (err) {
    console.error("[whatsapp] invalid JSON body", err);
    return Response.json({ status: "invalid_json" }, { status: 400 });
  }

  if (isWhatsAppStatusOnlyWebhook(body as Parameters<typeof isWhatsAppStatusOnlyWebhook>[0])) {
    return Response.json({ status: "status_ack" });
  }

  const messages = parseInboundWhatsAppMessages(
    body as Parameters<typeof parseInboundWhatsAppMessages>[0]
  );
  const unsupported = parseUnsupportedWhatsAppMessages(
    body as Parameters<typeof parseUnsupportedWhatsAppMessages>[0]
  );

  if (messages.length === 0 && unsupported.length === 0) {
    return Response.json({ status: "ignored" });
  }

  const [textResults, mediaResults] = await Promise.all([
    Promise.all(messages.map((msg) => processInboundWhatsAppMessage(msg))),
    Promise.all(unsupported.map((msg) => processUnsupportedWhatsAppMessage(msg))),
  ]);

  const results = [...textResults, ...mediaResults];
  const failed = results.filter((r) => r.status === "error");
  if (failed.length) {
    console.warn("[whatsapp] batch had errors", { count: failed.length });
  }

  return Response.json({
    status: "ok",
    processed: results.filter((r) => r.status === "ok").length,
    ignored: results.filter((r) => r.status === "ignored").length,
    errors: failed.length,
    text: messages.length,
    unsupported: unsupported.length,
  });
}
