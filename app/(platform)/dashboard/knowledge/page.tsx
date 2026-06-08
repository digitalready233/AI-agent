import Link from "next/link";
import { Plus, BookOpen, Pencil } from "lucide-react";
import { requireSession } from "@/lib/platform/auth";
import {
  listAgents,
  listKnowledgeBases,
  listKnowledgeEntries,
} from "@/lib/platform/data";
import { PageHeader } from "@/components/platform/page-header";
import { EmptyState } from "@/components/platform/empty-state";
import { KnowledgeImportButton } from "@/components/platform/knowledge-import-dialog";
import {
  ReadybotKnowledgeKitCard,
  ReadybotKnowledgeSeedButton,
} from "@/components/platform/readybot-knowledge-seed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function KnowledgePage() {
  const { organization } = await requireSession();
  const [bases, entries, agents] = await Promise.all([
    listKnowledgeBases(organization.id),
    listKnowledgeEntries(organization.id),
    listAgents(organization.id),
  ]);

  const defaultKb =
    bases.find((b) => b.status === "active") ?? bases[0] ?? null;
  const readybotAgent =
    agents.find(
      (a) =>
        a.enabled &&
        (a.name?.toLowerCase().includes("readybot") ||
          a.nickname?.toLowerCase().includes("readybot"))
    ) ??
    agents.find((a) => a.enabled && a.agent_type === "sales");
  const playbookAgentHref = readybotAgent
    ? `/dashboard/agents/${readybotAgent.id}`
    : null;

  return (
    <div className="platform-page">
      <PageHeader
        title="Knowledge base"
        description="Manage documents and content your agents use to answer questions."
        actions={
          <>
            <KnowledgeImportButton
              knowledgeBaseId={defaultKb?.id ?? null}
              knowledgeBaseTitle={defaultKb?.title ?? null}
              variant="outline"
              size="default"
              disabled={!defaultKb}
            />
            <ReadybotKnowledgeSeedButton
              knowledgeBaseId={defaultKb?.id ?? null}
              knowledgeBaseTitle={defaultKb?.title ?? null}
              variant="secondary"
              size="default"
              disabled={!defaultKb}
            />
            <Button asChild>
              <Link href="/dashboard/knowledge/new">
                <Plus className="h-4 w-4" />
                Add knowledge
              </Link>
            </Button>
          </>
        }
      />

      {bases.length > 0 && (
        <ReadybotKnowledgeKitCard
          defaultKnowledgeBaseId={defaultKb?.id ?? null}
          knowledgeBaseTitle={defaultKb?.title ?? null}
          playbookAgentHref={playbookAgentHref}
        />
      )}

      {bases.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No knowledge yet"
          description="Add FAQs, pricing, and product details so your agents answer with your approved content."
          actionLabel="Create knowledge base"
          actionHref="/dashboard/knowledge/new"
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {bases.map((kb) => {
            const kbEntries = entries.filter((e) => e.knowledge_base_id === kb.id);
            return (
              <Card key={kb.id} className="transition-all duration-200 hover:border-cyan-500/25 hover:shadow-lg hover:shadow-cyan-500/5">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{kb.title}</CardTitle>
                    <Badge variant="outline">{kb.status}</Badge>
                  </div>
                  {kb.description && (
                    <p className="text-sm text-slate-500">{kb.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">{kbEntries.length} entries</p>
                    <div className="flex flex-wrap gap-1">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/knowledge/${kb.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </Button>
                      <KnowledgeImportButton
                        knowledgeBaseId={kb.id}
                        knowledgeBaseTitle={kb.title}
                        variant="ghost"
                        size="sm"
                      />
                      <ReadybotKnowledgeSeedButton
                        knowledgeBaseId={kb.id}
                        knowledgeBaseTitle={kb.title}
                        variant="ghost"
                        size="sm"
                        label="Seed ReadyBot"
                      />
                    </div>
                  </div>
                  {kbEntries.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className="rounded-xl border border-slate-800/70 bg-slate-950/40 px-3.5 py-2.5 text-sm"
                    >
                      <p className="font-medium text-slate-200">{e.title}</p>
                      <p className="text-xs text-slate-500">{e.category}</p>
                    </div>
                  ))}
                  {kbEntries.length > 3 && (
                    <p className="text-xs text-slate-500">+{kbEntries.length - 3} more</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
