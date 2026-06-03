import Link from "next/link";
import { requireSession } from "@/lib/platform/auth";
import { listAgents } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { DemoPathsManager } from "@/components/platform/demo-paths-manager";
import { Button } from "@/components/ui/button";

export default async function DemoPathsPage() {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");

  const agents = await listAgents(session.organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="Demo paths"
        description="Guided sales demo tracks, slide order, and per-path hero branding for the presentation room."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/demo-assets">Demo assets</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/demo-calls">Demo calls</Link>
            </Button>
          </div>
        }
      />
      <DemoPathsManager
        agents={agents.map((a) => ({ id: a.id, name: a.nickname ?? a.name }))}
      />
    </div>
  );
}
