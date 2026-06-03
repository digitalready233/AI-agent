import Link from "next/link";
import { requireSession } from "@/lib/platform/auth";
import { listAgents, listKnowledgeBases } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { DemoAssetsManager } from "@/components/platform/demo-assets-manager";
import { Button } from "@/components/ui/button";

export default async function DemoAssetsPage() {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");

  const [agents, knowledgeBases] = await Promise.all([
    listAgents(session.organization.id),
    listKnowledgeBases(session.organization.id),
  ]);

  return (
    <div className="platform-page">
      <PageHeader
        title="Demo assets"
        description="Slides, cards, and steps shown during browser-based AI demos."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/demo-paths">Demo paths</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/demo-calls">Demo calls</Link>
            </Button>
          </div>
        }
      />
      <DemoAssetsManager
        agents={agents.map((a) => ({ id: a.id, name: a.nickname ?? a.name }))}
        knowledgeBases={knowledgeBases.map((k) => ({ id: k.id, name: k.title }))}
      />
    </div>
  );
}
