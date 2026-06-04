"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoAiStatePanel } from "@/components/demo/demo-ai-state-panel";
import type { AiPresenterState } from "@/lib/demo/ai-presenter-types";
export function DemoRightWorkspacePanel({
  voicePanel,
  aiState,
  voiceStatus,
  aiPaused,
  detectedIntent,
  customerSentiment,
  objections,
  suggestedNextAction,
  conversationPanel,
  transcriptLines,
}: {
  voicePanel?: React.ReactNode;
  aiState?: AiPresenterState;
  voiceStatus?: string;
  aiPaused?: boolean;
  detectedIntent?: string | null;
  customerSentiment?: string | null;
  objections?: string[];
  suggestedNextAction?: string | null;
  conversationPanel: React.ReactNode;
  transcriptLines: { speaker: string; content: string; input_type?: string }[];
}) {
  const lines = transcriptLines.length > 0 ? transcriptLines : [];

  return (
    <div className="space-y-4 flex flex-col min-h-0">
      {voicePanel && (
        <div className="space-y-2">
          <SectionLabel>Voice demo</SectionLabel>
          {voicePanel}
        </div>
      )}

      <div className="space-y-2">
        <SectionLabel>AI state</SectionLabel>
        <DemoAiStatePanel
          embedded
          aiState={aiState}
          voiceStatus={voiceStatus}
          aiPaused={aiPaused}
          detectedIntent={detectedIntent}
          customerSentiment={customerSentiment}
          objections={objections}
          suggestedNextAction={suggestedNextAction}
        />
      </div>

      <div className="space-y-2 flex-1 flex flex-col min-h-0">
        <SectionLabel>Live conversation</SectionLabel>
        {conversationPanel}
      </div>

      <Card className="border-slate-800/60 bg-slate-900/30">
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-sm text-slate-300 font-medium">Transcript</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {lines.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">Transcript will appear as you talk.</p>
          ) : (
            <div className="max-h-36 overflow-y-auto text-xs text-slate-500 space-y-1.5 font-mono">
              {lines.map((t, i) => (
                <p key={i} className="leading-relaxed">
                  <span className="text-slate-600">
                    {t.speaker}
                    {t.input_type === "voice" ? " (voice)" : ""}:
                  </span>{" "}
                  {t.content.slice(0, 200)}
                  {t.content.length > 200 ? "…" : ""}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-0.5">
      {children}
    </p>
  );
}
