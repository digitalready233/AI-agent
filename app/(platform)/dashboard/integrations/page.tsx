import { requireSession } from "@/lib/platform/auth";
import { listIntegrations } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { IntegrationsPanel } from "@/components/platform/integrations-panel";

export default async function IntegrationsPage() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");
  const { organization } = session;
  const integrations = await listIntegrations(organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="Integrations"
        description="Connect channels and tools to your AI agent platform. Credentials stay server-side."
      />
      <IntegrationsPanel integrations={integrations} />
    </div>
  );
}
