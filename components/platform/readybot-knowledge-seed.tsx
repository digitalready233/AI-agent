"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { READYBOT_KB_ARTICLE_TITLES } from "@/lib/platform/readybot-kb-templates";

export { READYBOT_KB_ARTICLE_TITLES };

type SeedButtonProps = {
  knowledgeBaseId?: string | null;
  knowledgeBaseTitle?: string | null;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  label?: string;
  disabled?: boolean;
};

export function ReadybotKnowledgeSeedButton({
  knowledgeBaseId,
  knowledgeBaseTitle,
  variant = "secondary",
  size = "sm",
  className,
  label = "Seed ReadyBot KB",
  disabled = false,
}: SeedButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  const noKb = !knowledgeBaseId;

  async function runSeed() {
    if (!knowledgeBaseId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/platform/knowledge-bases/seed-readybot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBaseId, overwrite }),
      });
      const data = (await res.json()) as {
        error?: string;
        created?: number;
        skipped?: number;
        upserted?: number;
        linkedAgentId?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Seed failed");

      const created = data.created ?? data.upserted ?? 0;
      const skipped = data.skipped ?? 0;
      toast.success(
        created > 0
          ? `Added ${created} article${created === 1 ? "" : "s"}`
          : "No new articles added",
        {
          description: [
            skipped > 0
              ? `${skipped} existing article${skipped === 1 ? "" : "s"} left unchanged (your edits kept).`
              : null,
            data.linkedAgentId
              ? "Linked to your live agent."
              : "Link this base on the agent Knowledge tab.",
          ]
            .filter(Boolean)
            .join(" "),
        }
      );
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not seed knowledge");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(className)}
        disabled={disabled || noKb}
        title={
          noKb
            ? "Create a knowledge base first"
            : "Upsert ReadyBot articles into this knowledge base"
        }
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <BookOpen className="h-5 w-5 text-cyan-400" />
              Seed ReadyBot knowledge
            </DialogTitle>
            <DialogDescription className="text-left text-slate-400">
              {knowledgeBaseTitle ? (
                <>
                  Upserts {READYBOT_KB_ARTICLE_TITLES.length} articles into{" "}
                  <span className="font-medium text-slate-200">
                    {knowledgeBaseTitle}
                  </span>
                  . Adds any missing standard articles only —{" "}
                  <span className="text-slate-300">
                    does not change articles you already edited
                  </span>
                  . Nothing is deleted.
                </>
              ) : (
                "Select a knowledge base before seeding."
              )}
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5 text-xs text-slate-400">
            {READYBOT_KB_ARTICLE_TITLES.map((title) => (
              <li key={title} className="flex gap-2">
                <span className="text-cyan-500/80">•</span>
                <span>{title}</span>
              </li>
            ))}
          </ul>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5 text-xs text-slate-400">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-600"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              disabled={loading}
            />
            <span>
              Replace existing articles that share these titles (overwrites your edits
              for those seven only).
            </span>
          </label>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={loading || noKb}
              onClick={() => void runSeed()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Seeding…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Seed articles
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReadybotKnowledgeKitCard({
  defaultKnowledgeBaseId,
  knowledgeBaseTitle,
  playbookAgentHref,
}: {
  defaultKnowledgeBaseId: string | null;
  knowledgeBaseTitle?: string | null;
  playbookAgentHref?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-slate-950/80 to-slate-950 p-5 shadow-lg shadow-cyan-500/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 shrink-0 text-cyan-400" />
            <h2 className="font-display text-lg font-semibold text-white">
              ReadyBot content kit
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-400 max-w-xl">
            One-click setup for Digital Ready: Ghana-specific service pillars, pricing
            guardrails, and objection handling for agents — plus the sales playbook on
            your agent.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ReadybotKnowledgeSeedButton
            knowledgeBaseId={defaultKnowledgeBaseId}
            knowledgeBaseTitle={knowledgeBaseTitle}
            variant="default"
            size="sm"
          />
          {playbookAgentHref ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={playbookAgentHref}>Load ReadyBot playbook</Link>
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/agents">Set up sales agent</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
