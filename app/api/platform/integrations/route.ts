import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { listIntegrations, saveIntegration } from "@/lib/platform/data";
import type { Integration, IntegrationStatus } from "@/lib/platform/types";

const patchSchema = z.object({
  integration_type: z.string().min(1),
  status: z.enum(["connected", "not_connected", "needs_attention"]),
  config: z.record(z.unknown()).optional(),
});

export async function GET() {
  const { organization } = await requireSession();
  let integrations = await listIntegrations(organization.id);

  const types = [
    "openai",
    "whatsapp",
    "google_calendar",
    "hubspot",
    "airtable",
    "google_sheets",
    "slack",
    "email_smtp",
    "zoom",
    "website_chat",
    "webhook_api",
  ];

  if (integrations.length === 0) {
    const now = new Date().toISOString();
    integrations = await Promise.all(
      types.map((integration_type) =>
        saveIntegration({
          id: crypto.randomUUID(),
          organization_id: organization.id,
          integration_type,
          status:
            integration_type === "openai" || integration_type === "website_chat"
              ? "connected"
              : "not_connected",
          config: {},
          created_at: now,
          updated_at: now,
        })
      )
    );
  }

  return Response.json({ integrations });
}

export async function PATCH(req: Request) {
  const { organization } = await requireSession();
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const all = await listIntegrations(organization.id);
  const existing = all.find((i) => i.integration_type === parsed.data.integration_type);
  const now = new Date().toISOString();

  const integration: Integration = existing
    ? {
        ...existing,
        status: parsed.data.status as IntegrationStatus,
        config: parsed.data.config ?? existing.config,
        last_tested_at: now,
        updated_at: now,
      }
    : {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        integration_type: parsed.data.integration_type,
        status: parsed.data.status as IntegrationStatus,
        config: parsed.data.config ?? {},
        last_tested_at: now,
        created_at: now,
        updated_at: now,
      };

  const saved = await saveIntegration(integration);
  return Response.json({ integration: saved });
}
