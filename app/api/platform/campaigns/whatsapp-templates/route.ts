import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings-data";

/** Approved WhatsApp templates for campaign builder (campaigns.view). */
export async function GET() {
  const session = await requireSession();
  requirePermission(session, "campaigns.view");

  const settings = await getWhatsAppSettings(session.organization.id);
  const templates = settings.message_templates
    .filter((t) => t.status === "approved" && t.meta_template_name)
    .map((t) => ({
      id: t.id,
      name: t.name,
      meta_template_name: t.meta_template_name,
      language: t.language,
      body_preview: t.body_preview,
    }));

  return Response.json({ templates });
}
