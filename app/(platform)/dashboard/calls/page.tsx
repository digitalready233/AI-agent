import { requireSession } from "@/lib/platform/auth";
import { listAgents } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { CallsList } from "@/components/platform/calls-list";

export default async function CallsPage() {
  const session = await requireSession();
  requirePermission(session, "conversations.view");

  const agents = await listAgents(session.organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="Voice calls"
        description="Inbound and outbound call history, transcripts, summaries, and handoffs."
      />
      <CallsList agents={agents.map((a) => ({ id: a.id, name: a.nickname ?? a.name }))} />
    </div>
  );
}
