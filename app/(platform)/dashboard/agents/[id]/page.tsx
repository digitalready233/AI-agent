import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/platform/auth";
import {
  getAgent,
  listConversations,
  listKnowledgeBases,
  listLeads,
} from "@/lib/platform/data";
import { getAgentKnowledgeBaseIds } from "@/lib/platform/data";
import { AgentDetailTabs } from "@/components/platform/agent-detail-tabs";
import { PageHeader } from "@/components/platform/page-header";
import { Badge } from "@/components/ui/badge";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireSession();
  const agent = await getAgent(id);

  if (!agent || agent.organization_id !== organization.id) {
    notFound();
  }

  const [knowledgeBases, leads, conversations] = await Promise.all([
    listKnowledgeBases(organization.id),
    listLeads(organization.id),
    listConversations(organization.id),
  ]);

  const linkedKnowledgeBaseIds = await getAgentKnowledgeBaseIds(agent.id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const siteOrigin = host ? `${proto}://${host}` : undefined;

  return (
    <div className="platform-page">
      <PageHeader
        title={agent.name}
        description={agent.nickname ? `Nickname: ${agent.nickname}` : undefined}
        backHref="/dashboard/agents"
        backLabel="Agents"
        actions={
          <Badge variant={agent.status === "active" ? "success" : "secondary"}>
            {agent.status}
          </Badge>
        }
      />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <AgentDetailTabs
          agent={agent}
          organizationName={organization.name}
          knowledgeBases={knowledgeBases}
          linkedKnowledgeBaseIds={linkedKnowledgeBaseIds}
          leads={leads}
          conversations={conversations}
          siteOrigin={siteOrigin}
        />
      </Suspense>
    </div>
  );
}
