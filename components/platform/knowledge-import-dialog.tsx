"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileJson, Loader2, Upload } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const EXAMPLE_ENTRIES = `[
  {
    "title": "Pricing overview",
    "category": "Pricing",
    "content": "Starter packages from GHS 2,500/month..."
  },
  {
    "title": "WhatsApp support hours",
    "category": "FAQ",
    "content": "We respond on WhatsApp Mon–Fri, 8am–6pm GMT."
  }
]`;

const EXAMPLE_PLAYBOOK = `[
  {
    "id": "discovery_goal_1",
    "intent": "discovery_goal",
    "stage": "Discovery",
    "pillar": "social",
    "keywords": ["followers", "brand", "social media"],
    "response": "What is your main goal on social right now?"
  }
]`;

type KnowledgeImportDialogProps = {
  knowledgeBaseId: string | null;
  knowledgeBaseTitle?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
  /** When false, only render the dialog (trigger lives elsewhere). */
  showTrigger?: boolean;
};

export function KnowledgeImportDialog({
  knowledgeBaseId,
  knowledgeBaseTitle,
  open,
  onOpenChange,
  variant = "outline",
  size = "sm",
  className,
  disabled = false,
  showTrigger = true,
}: KnowledgeImportDialogProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const noKb = !knowledgeBaseId;

  async function runImport(data: unknown) {
    if (!knowledgeBaseId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/platform/knowledge-bases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgeBaseId,
          overwrite,
          data,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        created?: number;
        skipped?: number;
        totalRows?: number;
        format?: "entries" | "playbook";
        linkedAgentId?: string | null;
      };
      if (!res.ok) throw new Error(payload.error ?? "Import failed");

      const formatLabel =
        payload.format === "playbook" ? "playbook scripts" : "articles";
      toast.success(`Imported ${payload.created ?? 0} ${formatLabel}`, {
        description: [
          payload.skipped ? `${payload.skipped} skipped (already present).` : null,
          payload.totalRows ? `${payload.totalRows} rows in file.` : null,
          payload.linkedAgentId ? "Linked to live agent." : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      setJsonText("");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import JSON");
    } finally {
      setLoading(false);
    }
  }

  async function importFromText() {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      toast.error("Paste JSON or choose a file");
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      toast.error("Invalid JSON — check brackets and quotes");
      return;
    }
    await runImport(data);
  }

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      toast.error("Please upload a .json file");
      return;
    }
    try {
      const text = await file.text();
      setJsonText(text);
      const data = JSON.parse(text) as unknown;
      await runImport(data);
    } catch {
      toast.error("Could not read or parse the file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      {showTrigger && (
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(className)}
          disabled={disabled || noKb || loading}
          title={
            noKb
              ? "Create a knowledge base first"
              : "Import articles or playbook rows from JSON"
          }
          onClick={() => onOpenChange(true)}
        >
          <FileJson className="h-4 w-4" />
          Import JSON
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
        <DialogContent className="border-slate-800 bg-slate-950 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Upload className="h-5 w-5 text-cyan-400" />
              Import knowledge (JSON)
            </DialogTitle>
            <DialogDescription className="text-left text-slate-400">
              {knowledgeBaseTitle
                ? `Add entries to “${knowledgeBaseTitle}”. `
                : "Add entries to your knowledge base. "}
              Supports standard articles or ReadyBot playbook rows (intent/stage/keywords).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">JSON file</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-cyan-200 hover:file:bg-cyan-500/25"
                disabled={loading || noKb}
                onChange={(e) => void onFileChange(e.target.files?.[0])}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Or paste JSON</Label>
              <Textarea
                rows={8}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={EXAMPLE_ENTRIES}
                disabled={loading || noKb}
                className="font-mono text-xs"
              />
            </div>

            <details className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-500">
              <summary className="cursor-pointer text-slate-400">Format help</summary>
              <p className="mt-2">
                <strong className="text-slate-300">Articles:</strong> array of{" "}
                <code className="text-cyan-300/90">title</code>,{" "}
                <code className="text-cyan-300/90">category</code>,{" "}
                <code className="text-cyan-300/90">content</code> (aliases: name,
                body, answer).
              </p>
              <p className="mt-2">
                <strong className="text-slate-300">Playbook:</strong> array with{" "}
                <code className="text-cyan-300/90">intent</code>,{" "}
                <code className="text-cyan-300/90">stage</code>,{" "}
                <code className="text-cyan-300/90">keywords</code>,{" "}
                <code className="text-cyan-300/90">response</code> — same as
                ReadyBot_Large_KB.json.
              </p>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-950 p-2 text-[10px] text-slate-500">
                {EXAMPLE_PLAYBOOK}
              </pre>
            </details>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                disabled={loading}
                className="rounded border-slate-600"
              />
              Overwrite existing entries with the same title
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={loading || noKb || !jsonText.trim()}
              onClick={() => void importFromText()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <FileJson className="h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function KnowledgeImportButton({
  knowledgeBaseId,
  knowledgeBaseTitle,
  variant = "outline",
  size = "sm",
  className,
  disabled = false,
}: {
  knowledgeBaseId: string | null;
  knowledgeBaseTitle?: string | null;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(className)}
        disabled={disabled || !knowledgeBaseId}
        title={
          !knowledgeBaseId
            ? "Create a knowledge base first"
            : "Import articles or playbook rows from JSON"
        }
        onClick={() => setOpen(true)}
      >
        <FileJson className="h-4 w-4" />
        Import JSON
      </Button>
      <KnowledgeImportDialog
        knowledgeBaseId={knowledgeBaseId}
        knowledgeBaseTitle={knowledgeBaseTitle}
        open={open}
        onOpenChange={setOpen}
        showTrigger={false}
      />
    </>
  );
}
