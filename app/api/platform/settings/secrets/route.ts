import { requireSession } from "@/lib/platform/auth";
import {
  getMaskedOrganizationSecret,
  hasOrganizationSecret,
  regenerateApiToken,
  regenerateWebhookSecret,
} from "@/lib/platform/settings-data";
import { requirePermission } from "@/lib/platform/rbac";

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "settings.view");
  const orgId = session.organization.id;

  const [hasApiToken, hasWebhookSecret, apiTokenMasked, webhookMasked] =
    await Promise.all([
      hasOrganizationSecret(orgId, "api_token"),
      hasOrganizationSecret(orgId, "webhook_secret"),
      getMaskedOrganizationSecret(orgId, "api_token"),
      getMaskedOrganizationSecret(orgId, "webhook_secret"),
    ]);

  return Response.json({
    api_token_configured: hasApiToken,
    api_token_masked: apiTokenMasked,
    webhook_secret_configured: hasWebhookSecret,
    webhook_secret_masked: webhookMasked,
  });
}

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");

  const body = await req.json();
  const action = body.action as string;

  if (action === "regenerate_api_token") {
    const token = await regenerateApiToken(session.organization.id);
    return Response.json({
      api_token: token,
      message: "Copy this token now. It will not be shown again.",
    });
  }

  if (action === "regenerate_webhook_secret") {
    const secret = await regenerateWebhookSecret(session.organization.id);
    return Response.json({
      webhook_secret: secret,
      message: "Copy this secret now. It will not be shown again.",
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
