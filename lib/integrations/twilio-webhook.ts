import twilio from "twilio";

/**
 * Verify Twilio Voice / Messaging webhook (X-Twilio-Signature).
 * When `TWILIO_AUTH_TOKEN` is unset, returns true (local dev only).
 */
export function verifyTwilioSignature(
  req: Request,
  params: Record<string, string>
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!token) return true;

  const signature = req.headers.get("X-Twilio-Signature");
  if (!signature) return false;

  const url = getTwilioWebhookUrl(req);
  return twilio.validateRequest(token, signature, url, params);
}

function getTwilioWebhookUrl(req: Request): string {
  const override = process.env.TWILIO_WEBHOOK_PUBLIC_URL?.trim();
  if (override) return override.replace(/\/$/, "") + new URL(req.url).pathname;

  const u = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}${u.pathname}`;
}
