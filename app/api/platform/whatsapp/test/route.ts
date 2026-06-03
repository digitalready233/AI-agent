import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { resolveWhatsAppCredentials } from "@/lib/whatsapp/credentials";
import {
  getWhatsAppConnectionStatus,
  getWhatsAppSettings,
  recordWhatsAppConnectionTest,
} from "@/lib/whatsapp/settings-data";
import { testWhatsAppConnection } from "@/lib/whatsapp/test-connection";
import { hasOrganizationSecret } from "@/lib/platform/settings-data";
import { WHATSAPP_SECRET_KEYS } from "@/lib/whatsapp/credentials";

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const orgId = session.organization.id;
  const origin = new URL(req.url).origin;
  const settings = await getWhatsAppSettings(orgId);
  const status = await getWhatsAppConnectionStatus(orgId, origin);

  const credentials = await resolveWhatsAppCredentials({
    organizationId: orgId,
    phoneNumberId: settings.phone_number_id,
    wabaId: settings.waba_id,
  });

  if (!credentials) {
    return Response.json(
      {
        ok: false,
        error: "Access token and phone number ID are required.",
        connection_status: "not_connected" as const,
      },
      { status: 400 }
    );
  }

  const hasVerify = Boolean(
    settings.webhook_verify_token?.trim() ||
      (await hasOrganizationSecret(orgId, WHATSAPP_SECRET_KEYS.verifyToken))
  );

  const result = await testWhatsAppConnection({
    credentials,
    webhookUrl: status.webhook_url,
    hasVerifyToken: hasVerify,
  });

  const updated = await recordWhatsAppConnectionTest({
    organizationId: orgId,
    result,
    businessPhoneFromMeta: result.display_phone_number,
  });

  const nextStatus = await getWhatsAppConnectionStatus(orgId, origin);

  return Response.json({
    ok: result.ok,
    error: result.error,
    test: result,
    settings: updated,
    status: nextStatus,
  });
}
