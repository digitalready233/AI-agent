import { requireSession } from "@/lib/platform/auth";
import {
  getDashboardStats,
  listIntegrations,
  listProfiles,
} from "@/lib/platform/data";
import {
  getMaskedOrganizationSecret,
  getOrganizationSettings,
  hasOrganizationSecret,
  isSettingsSchemaReady,
  SETTINGS_MIGRATION_HINT,
} from "@/lib/platform/settings-data";
import { INTEGRATION_CREDENTIAL_FIELDS } from "@/lib/platform/integration-credentials";
import { can, requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { SettingsWorkspace } from "@/components/platform/settings/settings-workspace";

export default async function SettingsPage() {
  const session = await requireSession();
  requirePermission(session, "settings.view");

  const orgId = session.organization.id;
  const canManage = can(session.profile.role, "settings.manage");
  const schemaReady = await isSettingsSchemaReady();

  const [settings, profiles, integrations, stats] = await Promise.all([
    getOrganizationSettings(orgId),
    listProfiles(orgId),
    listIntegrations(orgId),
    getDashboardStats(orgId),
  ]);

  const [hasApiToken, hasWebhookSecret, apiTokenMasked, webhookMasked] =
    await Promise.all([
      hasOrganizationSecret(orgId, "api_token"),
      hasOrganizationSecret(orgId, "webhook_secret"),
      getMaskedOrganizationSecret(orgId, "api_token"),
      getMaskedOrganizationSecret(orgId, "webhook_secret"),
    ]);

  const integrationPublic = await Promise.all(
  Object.keys(INTEGRATION_CREDENTIAL_FIELDS).map(async (integration_type) => {
    const row = integrations.find((i) => i.integration_type === integration_type);
    const fields = INTEGRATION_CREDENTIAL_FIELDS[integration_type] ?? [];
    const masked_fields: Record<string, string> = {};
    for (const f of fields) {
      const masked = await getMaskedOrganizationSecret(
        orgId,
        `integration:${integration_type}:${f.key}`
      );
      if (masked) masked_fields[f.key] = masked;
    }
    const configured = Object.keys(masked_fields).length > 0;
    return {
      integration_type,
      status: row?.status ?? "not_connected",
      configured,
      masked_fields,
    };
  })
  );

  return (
    <div className="platform-page">
      <PageHeader
        title="Settings"
        description="Company profile, workspace preferences, AI defaults, pipeline, integrations, and security — scoped to your organization."
      />
      {!schemaReady && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
          <p className="font-medium">Database migration required</p>
          <p className="mt-1 text-amber-200/80">{SETTINGS_MIGRATION_HINT}</p>
        </div>
      )}
      <SettingsWorkspace
        organization={session.organization}
        settings={settings}
        profiles={profiles}
        canManage={canManage}
        stats={stats}
        secrets={{
          api_token_configured: hasApiToken,
          api_token_masked: apiTokenMasked,
          webhook_secret_configured: hasWebhookSecret,
          webhook_secret_masked: webhookMasked,
        }}
        integrations={integrationPublic}
      />
    </div>
  );
}
