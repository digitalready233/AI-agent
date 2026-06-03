import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getWhatsAppConnectionStatus } from "@/lib/whatsapp/settings-data";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings-data";
import { hasWhatsAppAccessToken } from "@/lib/whatsapp/credentials";

export async function GET(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const origin = new URL(req.url).origin;
  const [status, settings] = await Promise.all([
    getWhatsAppConnectionStatus(session.organization.id, origin),
    getWhatsAppSettings(session.organization.id),
  ]);

  return Response.json({
    status,
    settings: {
      ...settings,
      has_access_token: await hasWhatsAppAccessToken(session.organization.id),
    },
  });
}
