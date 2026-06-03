import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { listIntegrations, saveIntegration } from "@/lib/platform/data";
import {
  getMaskedOrganizationSecret,
  hasOrganizationSecret,
  setOrganizationSecret,
} from "@/lib/platform/settings-data";
import { INTEGRATION_CREDENTIAL_FIELDS } from "@/lib/platform/integration-credentials";
import { requirePermission } from "@/lib/platform/rbac";
import type { Integration, IntegrationStatus } from "@/lib/platform/types";

const patchSchema = z.object({
  integration_type: z.string().min(1),
  status: z.enum(["connected", "not_connected", "needs_attention"]).optional(),
  credentials: z.record(z.string()).optional(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "settings.view");
  const orgId = session.organization.id;
  const integrations = await listIntegrations(orgId);

  const publicState = await Promise.all(
    integrations.map(async (i) => {
      const fields = INTEGRATION_CREDENTIAL_FIELDS[i.integration_type] ?? [];
      const masked_fields: Record<string, string> = {};
      for (const f of fields) {
        const secretKey = `integration:${i.integration_type}:${f.key}`;
        const masked = await getMaskedOrganizationSecret(orgId, secretKey);
        if (masked) masked_fields[f.key] = masked;
      }
      const configured =
        Object.keys(masked_fields).length > 0 ||
        (await hasOrganizationSecret(orgId, `integration:${i.integration_type}:api_key`));
      return {
        integration_type: i.integration_type,
        status: i.status,
        configured,
        masked_fields,
        fields,
      };
    })
  );

  return Response.json({ integrations: publicState });
}

export async function PATCH(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { integration_type, status, credentials } = parsed.data;
  const orgId = session.organization.id;

  if (credentials) {
    for (const [key, value] of Object.entries(credentials)) {
      if (!value?.trim()) continue;
      await setOrganizationSecret(
        orgId,
        `integration:${integration_type}:${key}`,
        value.trim()
      );
    }
  }

  const all = await listIntegrations(orgId);
  const existing = all.find((i) => i.integration_type === integration_type);
  const now = new Date().toISOString();

  const integration: Integration = existing
    ? {
        ...existing,
        status: (status ?? existing.status) as IntegrationStatus,
        config: { ...(existing.config ?? {}), credentials_configured: true },
        last_tested_at: now,
        updated_at: now,
      }
    : {
        id: crypto.randomUUID(),
        organization_id: orgId,
        integration_type,
        status: (status ?? "connected") as IntegrationStatus,
        config: { credentials_configured: true },
        last_tested_at: now,
        created_at: now,
        updated_at: now,
      };

  const saved = await saveIntegration(integration);
  return Response.json({ integration: saved });
}
