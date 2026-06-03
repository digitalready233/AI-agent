import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import {
  getMaskedOrganizationSecret,
  getOrganizationSettings,
  hasOrganizationSecret,
  patchOrganizationSettingsSection,
  saveOrganizationSettings,
} from "@/lib/platform/settings-data";
import { requirePermission } from "@/lib/platform/rbac";
import type { OrganizationSettingsRecord, SettingsSection } from "@/lib/platform/settings-types";

const sectionSchema = z.enum([
  "workspace",
  "agent_defaults",
  "sales_pipeline",
  "lead_scoring",
  "human_handoff",
  "notifications",
  "security",
  "billing",
  "data_privacy",
  "api_settings",
  "team_settings",
]);

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "settings.view");
  const { organization } = session;

  const settings = await getOrganizationSettings(organization.id);
  const [hasApiToken, hasWebhookSecret, apiTokenMasked, webhookMasked] =
    await Promise.all([
      hasOrganizationSecret(organization.id, "api_token"),
      hasOrganizationSecret(organization.id, "webhook_secret"),
      getMaskedOrganizationSecret(organization.id, "api_token"),
      getMaskedOrganizationSecret(organization.id, "webhook_secret"),
    ]);

  return Response.json({
    settings,
    secrets: {
      api_token_configured: hasApiToken,
      api_token_masked: apiTokenMasked,
      webhook_secret_configured: hasWebhookSecret,
      webhook_secret_masked: webhookMasked,
    },
  });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");

  const body = await req.json();
  const parsed = z
    .object({ section: sectionSchema, value: z.unknown() })
    .safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { section, value } = parsed.data;

  const updated = await patchOrganizationSettingsSection(
    session.organization.id,
    section as SettingsSection,
    value as OrganizationSettingsRecord[typeof section]
  );

  return Response.json({ settings: updated });
}

export async function PATCH(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");

  const body = await req.json();
  const current = await getOrganizationSettings(session.organization.id);
  const merged = { ...current, ...body, organization_id: session.organization.id };
  const saved = await saveOrganizationSettings(merged);
  return Response.json({ settings: saved });
}
