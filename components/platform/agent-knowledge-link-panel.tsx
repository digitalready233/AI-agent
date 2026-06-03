"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeBase } from "@/lib/platform/types";

export function AgentKnowledgeLinkPanel({
  agentId,
  agentName,
  knowledgeBases,
  linkedKnowledgeBaseIds: initialLinkedIds,
}: {
  agentId: string;
  agentName: string;
  knowledgeBases: KnowledgeBase[];
  linkedKnowledgeBaseIds: string[];
}) {
  const router = useRouter();
  const [linkedIds, setLinkedIds] = useState<string[]>(initialLinkedIds);
  const [saving, setSaving] = useState(false);

  function toggleKb(id: string) {
    setLinkedIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  }

  async function saveLinks() {
    setSaving(true);
    try {
      const res = await fetch(`/api/platform/agents/${agentId}/knowledge-bases`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge_base_ids: linkedIds }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `Could not save links (${res.status})`
        );
      }
      toast.success(
        linkedIds.length
          ? `Linked ${linkedIds.length} knowledge base${linkedIds.length === 1 ? "" : "s"} to ${agentName}`
          : "Knowledge base links cleared"
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    linkedIds.length !== initialLinkedIds.length ||
    linkedIds.some((id) => !initialLinkedIds.includes(id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linked knowledge bases</CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Chat and tests only use content from bases you link here. Seed articles on{" "}
          <Link href="/dashboard/knowledge" className="text-cyan-400 hover:underline">
            Knowledge
          </Link>
          , then check the bases below and save.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {knowledgeBases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-500">
            <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-600" />
            <p>No knowledge bases in your organization yet.</p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href="/dashboard/knowledge/new">Create knowledge base</Link>
            </Button>
          </div>
        ) : linkedIds.length === 0 && !dirty ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              No linked knowledge base yet — select one or more below, then click Save links.
            </p>
            {knowledgeBases.map((kb) => (
              <KbRow
                key={kb.id}
                kb={kb}
                checked={false}
                onToggle={() => toggleKb(kb.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {knowledgeBases.map((kb) => (
              <KbRow
                key={kb.id}
                kb={kb}
                checked={linkedIds.includes(kb.id)}
                onToggle={() => toggleKb(kb.id)}
              />
            ))}
          </div>
        )}

        {knowledgeBases.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={() => void saveLinks()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save links"
              )}
            </Button>
            {dirty && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setLinkedIds(initialLinkedIds)}
              >
                Reset
              </Button>
            )}
          </div>
        )}

        {linkedIds.length > 0 && (
          <ul className="text-xs text-slate-500 space-y-1 border-t border-slate-800 pt-3">
            {knowledgeBases
              .filter((kb) => linkedIds.includes(kb.id))
              .map((kb) => (
                <li key={kb.id}>
                  Active:{" "}
                  <Link
                    href={`/dashboard/knowledge/${kb.id}`}
                    className="text-cyan-400 hover:underline"
                  >
                    {kb.title}
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function KbRow({
  kb,
  checked,
  onToggle,
}: {
  kb: KnowledgeBase;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 p-3 hover:border-cyan-500/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 rounded border-slate-600"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{kb.title}</p>
        {kb.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{kb.description}</p>
        )}
      </div>
      <Link
        href={`/dashboard/knowledge/${kb.id}`}
        className="shrink-0 text-slate-500 hover:text-cyan-400"
        title="Edit knowledge base"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-4 w-4" />
      </Link>
    </label>
  );
}
