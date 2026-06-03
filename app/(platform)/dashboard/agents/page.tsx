import Link from "next/link";
import { Plus, Bot } from "lucide-react";
import { requireSession } from "@/lib/platform/auth";
import { listAgents } from "@/lib/platform/data";
import { SyncAgentEnv } from "@/components/platform/sync-agent-env";
import { AgentCard } from "@/components/platform/agent-card";
import { EmptyState } from "@/components/platform/empty-state";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";

export default async function AgentsPage() {
  const { organization } = await requireSession();
  const agents = await listAgents(organization.id);
  const primary =
    agents.find((a) => a.enabled && a.status === "active") ?? agents[0] ?? null;

  return (
    <div className="platform-page">
      {primary ? (
        <SyncAgentEnv agentId={primary.id} primaryAgentName={primary.name} />
      ) : null}
      <PageHeader
        title="AI sales agents"
        description="Create and manage sales agents — qualification, objections, booking, handoff, and knowledge."
        actions={
          <Button asChild className="rounded-xl">
            <Link href="/dashboard/agents/new">
              <Plus className="h-4 w-4" />
              Create agent
            </Link>
          </Button>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first AI agent to qualify leads, answer questions, and book meetings 24/7."
          actionLabel="Create agent"
          actionHref="/dashboard/agents/new"
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}
