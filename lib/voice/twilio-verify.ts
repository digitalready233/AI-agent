import twilio from "twilio";
import { isProductionRuntime } from "@/lib/security/production";
import { getTwilioAuthToken } from "./credentials";

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

/**
 * Verify Twilio webhook signature using org-stored auth token, then env fallback.
 */
export async function verifyTwilioSignatureForOrg(
  req: Request,
  params: Record<string, string>,
  organizationId: string | null
): Promise<boolean> {
  let token: string | null = null;
  if (organizationId) {
    token = await getTwilioAuthToken(organizationId);
  }
  if (!token) {
    token = process.env.TWILIO_AUTH_TOKEN?.trim() ?? null;
  }
  if (!token) {
    if (isProductionRuntime()) {
      console.error("[twilio] auth token required for webhook verification in production");
      return false;
    }
    return true;
  }

  const signature = req.headers.get("X-Twilio-Signature");
  if (!signature) return false;

  const url = getTwilioWebhookUrl(req);
  return twilio.validateRequest(token, signature, url, params);
}
