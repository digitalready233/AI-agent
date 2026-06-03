import Link from "next/link";
import { Suspense } from "react";
import { requireSession } from "@/lib/platform/auth";
import { listAgents, listLeads } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { DemoSessionsList } from "@/components/platform/demo-sessions-list";
import { DemoCallsMetrics } from "@/components/platform/demo-calls-metrics";
import { Button } from "@/components/ui/button";

export default async function DemoCallsPage() {
  const session = await requireSession();
  requirePermission(session, "conversations.view");

  const [agents, leads] = await Promise.all([
    listAgents(session.organization.id),
    listLeads(session.organization.id),
  ]);

  return (
    <div className="platform-page">
      <PageHeader
        title="Demo calls"
        description="Browser-based AI product demos, transcripts, qualification, and handoffs."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/demo-paths">Demo paths</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/demo-assets">Demo assets</Link>
            </Button>
          </div>
        }
      />
      <DemoCallsMetrics organizationId={session.organization.id} />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading demos…</p>}>
        <DemoSessionsList
          agents={agents.map((a) => ({
            id: a.id,
            name: a.nickname ?? a.name,
            operational_role: a.operational_role ?? null,
          }))}
          leads={leads.map((l) => ({
            id: l.id,
            full_name: l.full_name ?? null,
            email: l.email ?? null,
          }))}
        />
      </Suspense>
    </div>
  );
}
