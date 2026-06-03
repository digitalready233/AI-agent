import { requireSession } from "@/lib/platform/auth";
import { listAgentTasks } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { WebhooksPanel } from "@/components/platform/webhooks-panel";

export default async function WebhooksPage() {
  const session = await requireSession();
  requirePermission(session, "webhooks.manage");
  const { organization } = session;
  const tasks = await listAgentTasks(organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="Webhooks & agent tasks"
        description="Automated actions triggered by agent events and webhooks."
      />
      <WebhooksPanel tasks={tasks} />
    </div>
  );
}
