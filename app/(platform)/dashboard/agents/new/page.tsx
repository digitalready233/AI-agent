import { requireSession } from "@/lib/platform/auth";
import { listKnowledgeBases } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { AgentBuilderForm } from "@/components/platform/agent-builder-form";
import { PageHeader } from "@/components/platform/page-header";

export default async function NewAgentPage() {
  const session = await requireSession();
  requirePermission(session, "agents.manage");
  const { organization } = session;
  const knowledgeBases = await listKnowledgeBases(organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="Create sales agent"
        description="Sales playbook: role, BANT qualification, objections, booking, handoff, CRM rules, and knowledge."
        backHref="/dashboard/agents"
        backLabel="Sales agents"
      />
      <AgentBuilderForm organizationName={organization.name} knowledgeBases={knowledgeBases} />
    </div>
  );
}
