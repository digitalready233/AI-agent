import { getCalendlyWebhookSigningKey } from "@/lib/calendly/credentials";
import {
  processCalendlyWebhook,
  resolveCalendlyWebhookOrganization,
  verifyCalendlyWebhookSignature,
} from "@/lib/calendly/webhook";
import type { CalendlyWebhookEvent } from "@/lib/calendly/types";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("calendly-webhook-signature");

  const organizationId =
    req.headers.get("x-organization-id")?.trim() ||
    process.env.PLATFORM_ORGANIZATION_ID?.trim() ||
    null;

  let orgId = organizationId;
  let body: CalendlyWebhookEvent;

  try {
    body = JSON.parse(rawBody) as CalendlyWebhookEvent;
  } catch (err) {
    console.error("[calendly webhook] invalid JSON", err);
    return Response.json({ status: "invalid_json" }, { status: 400 });
  }

  if (!orgId) {
    orgId = await resolveCalendlyWebhookOrganization(body);
  }

  if (!orgId) {
    console.error("[calendly webhook] could not resolve organization");
    return Response.json({ status: "unknown_organization" }, { status: 400 });
  }

  const signingKey = await getCalendlyWebhookSigningKey(orgId);
  const sig = verifyCalendlyWebhookSignature({
    rawBody,
    signatureHeader,
    signingKey,
  });

  if (!sig.valid) {
    return Response.json({ status: "invalid_signature" }, { status: 401 });
  }

  try {
    const result = await processCalendlyWebhook(orgId, body);
    return Response.json(result);
  } catch (err) {
    console.error("[calendly webhook] processing failed", err);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
