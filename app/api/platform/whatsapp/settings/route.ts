import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { listIntegrations, saveIntegration } from "@/lib/platform/data";
import { setOrganizationSecret } from "@/lib/platform/settings-data";
import {
  getWhatsAppSettings,
  saveWhatsAppSettings,
} from "@/lib/whatsapp/settings-data";
import {
  WHATSAPP_SECRET_KEYS,
  hasWhatsAppAccessToken,
} from "@/lib/whatsapp/credentials";
import type { IntegrationStatus } from "@/lib/platform/types";
import type { WhatsAppMessageTemplate } from "@/lib/whatsapp/types";

const putSchema = z.object({
  phone_number_id: z.string().min(1).max(64),
  waba_id: z.string().max(64).optional().nullable(),
  business_phone_number: z.string().max(32).optional().nullable(),
  default_agent_id: z.string().uuid().optional().nullable(),
  webhook_verify_token: z.string().max(256).optional().nullable(),
  webhook_callback_url: z.string().max(512).optional().nullable(),
  access_token: z.string().max(4096).optional(),
  verify_token: z.string().max(256).optional(),
  message_templates: z.array(z.record(z.unknown())).optional(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");
  const settings = await getWhatsAppSettings(session.organization.id);
  return Response.json({ settings });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orgId = session.organization.id;
  const body = parsed.data;
  const current = await getWhatsAppSettings(orgId);

  if (body.access_token?.trim()) {
    await setOrganizationSecret(
      orgId,
      WHATSAPP_SECRET_KEYS.accessToken,
      body.access_token.trim()
    );
  }
  if (body.verify_token?.trim()) {
    await setOrganizationSecret(
      orgId,
      WHATSAPP_SECRET_KEYS.verifyToken,
      body.verify_token.trim()
    );
  }

  const origin = new URL(req.url).origin;
  const defaultWebhook = `${origin.replace(/\/$/, "")}/api/whatsapp/webhook`;

  const settings = await saveWhatsAppSettings({
    organization_id: orgId,
    phone_number_id: body.phone_number_id.trim(),
    waba_id: body.waba_id?.trim() ?? null,
    business_phone_number:
      body.business_phone_number?.trim() ?? current.business_phone_number,
    default_agent_id: body.default_agent_id ?? null,
    webhook_verify_token:
      body.webhook_verify_token?.trim() ??
      body.verify_token?.trim() ??
      current.webhook_verify_token,
    webhook_callback_url:
      body.webhook_callback_url?.trim() ?? current.webhook_callback_url ?? defaultWebhook,
    connection_status: current.connection_status,
    last_tested_at: current.last_tested_at,
    message_templates:
      (body.message_templates as unknown as WhatsAppMessageTemplate[]) ??
      current.message_templates,
    updated_at: new Date().toISOString(),
  });

  const all = await listIntegrations(orgId);
  const existing = all.find((i) => i.integration_type === "whatsapp");
  const now = new Date().toISOString();
  const connected = Boolean(
    settings.phone_number_id &&
      (body.access_token?.trim() || (await hasWhatsAppAccessToken(orgId)))
  );

  await saveIntegration(
    existing
      ? {
          ...existing,
          status: (connected ? "connected" : existing.status) as IntegrationStatus,
          config: {
            ...(existing.config ?? {}),
            phone_number_id: settings.phone_number_id,
            waba_id: settings.waba_id,
          },
          updated_at: now,
        }
      : {
          id: crypto.randomUUID(),
          organization_id: orgId,
          integration_type: "whatsapp",
          status: connected ? "connected" : "not_connected",
          config: {
            phone_number_id: settings.phone_number_id,
            waba_id: settings.waba_id,
          },
          created_at: now,
          updated_at: now,
        }
  );

  return Response.json({ settings });
}
