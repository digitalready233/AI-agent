"use client";

import { Bot, HandHelping, Loader2, Mic, Pause, Volume2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AiPresenterState } from "@/lib/demo/ai-presenter-types";
import { presenterStateLabel } from "@/lib/demo/resolve-ai-presenter-state";
import { cn } from "@/lib/utils";

export function DemoAiStatePanel({
  aiState,
  voiceStatus,
  aiPaused,
  detectedIntent,
  customerSentiment,
  objections,
  suggestedNextAction,
  embedded,
}: {
  aiState?: AiPresenterState;
  voiceStatus?: string;
  aiPaused?: boolean;
  detectedIntent?: string | null;
  customerSentiment?: string | null;
  objections?: string[];
  suggestedNextAction?: string | null;
  embedded?: boolean;
}) {
  const labels = aiState
    ? presenterStateLabel(aiState)
    : { title: "Ready", subtitle: "AI ready to begin" };

  const voiceLabel = (() => {
    if (voiceStatus === "listening") return "Listening";
    if (voiceStatus === "processing") return "Processing";
    if (voiceStatus === "ai_speaking") return "Speaking";
    if (voiceStatus === "muted") return "Muted";
    if (voiceStatus === "connected") return "Connected";
    return "Idle";
  })();

  const StateIcon = () => {
    if (aiPaused || aiState === "paused") return <Pause className="h-4 w-4" />;
    if (aiState === "listening") return <Mic className="h-4 w-4" />;
    if (aiState === "thinking") return <Loader2 className="h-4 w-4 animate-spin" />;
    if (aiState === "speaking" || aiState === "presenting")
      return <Volume2 className="h-4 w-4" />;
    if (aiState === "handoff_required") return <HandHelping className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  const body = (
    <>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg border",
              aiPaused
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
            )}
          >
            <StateIcon />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{labels.title}</p>
            <p className="text-xs text-slate-500">{labels.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-200">
            AI: {aiPaused ? "Paused" : labels.title}
          </Badge>
          <Badge variant="outline" className="text-[10px] text-slate-400">
            Voice: {voiceLabel}
          </Badge>
          {detectedIntent && (
            <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-200">
              Intent: {detectedIntent}
            </Badge>
          )}
          {customerSentiment && (
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-200">
              Sentiment: {customerSentiment}
            </Badge>
          )}
          {(objections?.length ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-200">
              Objections: {objections!.length}
            </Badge>
          )}
        </div>
        {suggestedNextAction && (
          <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2">
            <span className="text-cyan-400/90">Suggested: </span>
            {suggestedNextAction}
          </p>
        )}
    </>
  );

  if (embedded) {
    return (
      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardContent className="pt-4 space-y-3">{body}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800/80 bg-slate-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300 font-medium">AI state</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{body}</CardContent>
    </Card>
  );
}
