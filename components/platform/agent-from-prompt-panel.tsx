"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentDraftFromPrompt } from "@/lib/platform/agent-from-prompt";

export function AgentFromPromptPanel({
  onApply,
}: {
  onApply: (draft: AgentDraftFromPrompt) => void;
}) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (description.trim().length < 12) {
      toast.error("Describe your business and what the agent should do (12+ characters).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/platform/agents/from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      onApply(data.draft as AgentDraftFromPrompt);
      toast.success("Agent draft ready — review tabs and save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate agent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          Create with a short prompt
        </CardTitle>
        <p className="text-xs text-slate-400 mt-1">
          Describe the agent&apos;s role in plain language — e.g. &quot;Create an agent for
          incoming calls at a pizza shop&quot; or &quot;Luxury travel concierge for private
          islands&quot;. We fill role, prompts, and channels; you review before saving.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Handle website chat and phone for Acme SaaS — qualify B2B leads, book demos, never quote pricing not in our FAQ."
        />
        <Button type="button" onClick={generate} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating…
            </>
          ) : (
            "Generate agent draft"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
