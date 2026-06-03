"use client";

import { RefObject } from "react";
import { Bot, HandHelping, Loader2, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { AiPresenterState } from "@/lib/demo/ai-presenter-types";
import { presenterStateLabel } from "@/lib/demo/resolve-ai-presenter-state";
import { cn } from "@/lib/utils";

export type ConversationLine = {
  role: "user" | "assistant" | "system" | "staff";
  content: string;
  senderName?: string;
  createdAt?: string;
};

type VoiceStatus = string;

export function DemoConversationPanel({
  lines,
  sending,
  voiceStatus,
  aiPresenterState,
  detectedIntent,
  customerSentiment,
  input,
  onInputChange,
  onSend,
  staffMode,
  staffInput,
  onStaffInputChange,
  onStaffSend,
  staffSending,
  endedSummary,
  aiPaused,
  livekitAiPhase,
  useLiveKitVideo,
  livekitAiJoined,
  sendError,
  retryable,
  onRetry,
  bottomRef,
  voicePanel,
  staffControls,
  showStateBadges = true,
}: {
  lines: ConversationLine[];
  sending?: boolean;
  voiceStatus?: VoiceStatus;
  aiPresenterState?: AiPresenterState;
  detectedIntent?: string | null;
  customerSentiment?: string | null;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  staffMode?: boolean;
  staffInput?: string;
  onStaffInputChange?: (v: string) => void;
  onStaffSend?: () => void;
  staffSending?: boolean;
  endedSummary?: string | null;
  aiPaused?: boolean;
  livekitAiPhase?: string | null;
  useLiveKitVideo?: boolean;
  livekitAiJoined?: boolean;
  sendError?: string | null;
  retryable?: boolean;
  onRetry?: () => void;
  bottomRef?: RefObject<HTMLDivElement | null>;
  voicePanel?: React.ReactNode;
  staffControls?: React.ReactNode;
  showStateBadges?: boolean;
}) {
  const stateLabels = aiPresenterState
    ? presenterStateLabel(aiPresenterState)
    : { title: "Ready", subtitle: "AI ready to begin" };

  const voiceLabel = (() => {
    if (voiceStatus === "listening") return "Listening";
    if (voiceStatus === "processing") return "Processing";
    if (voiceStatus === "ai_speaking") return "Speaking";
    if (voiceStatus === "muted") return "Muted";
    if (voiceStatus === "connected") return "Voice connected";
    return "Voice idle";
  })();

  return (
    <Card className="border-slate-800/80 bg-slate-900/40 flex flex-col flex-1 min-h-[420px] shadow-lg shadow-black/20">
      <CardHeader className="pb-2 border-b border-slate-800/60 space-y-2">
        <div>
          <CardTitle className="text-sm text-slate-300 font-medium">Chat</CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            {lines.length === 0 && !sending
              ? "Waiting for prospect response…"
              : "Timestamped messages"}
          </p>
        </div>
        {showStateBadges && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="text-xs border-cyan-500/30 text-cyan-200 capitalize"
            >
              AI: {stateLabels.title}
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
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-4 min-h-0">
        {voicePanel}
        <div className="flex-1 space-y-3 overflow-y-auto max-h-[45vh] lg:max-h-[52vh] pr-1">
          {lines.length === 0 && !sending && (
            <p className="text-sm text-slate-500 text-center py-8">
              Waiting for prospect response…
            </p>
          )}
          {lines.map((line, i) => (
            <div
              key={`${i}-${line.content.slice(0, 12)}`}
              className={cn(
                "flex flex-col gap-0.5",
                line.role === "user" ? "items-end" : "items-start"
              )}
            >
              {line.createdAt && (
                <span className="text-[10px] text-slate-600 px-1">
                  {new Date(line.createdAt).toLocaleTimeString()}
                </span>
              )}
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  line.role === "user"
                    ? "bg-cyan-600/90 text-white"
                    : line.role === "staff"
                      ? "bg-violet-900/80 text-violet-50 border border-violet-500/40"
                      : line.role === "system"
                        ? "bg-slate-800/50 text-slate-400 text-xs italic"
                        : "bg-slate-800/90 text-slate-100 border border-slate-700/50"
                )}
              >
                {line.role === "staff" && line.senderName && (
                  <p className="text-[10px] uppercase tracking-wide text-violet-300/90 mb-1">
                    {line.senderName}
                  </p>
                )}
                {line.content}
              </div>
            </div>
          ))}
          {sending && (
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI is thinking…
            </p>
          )}
          {voiceStatus === "listening" && (
            <p className="text-sm text-cyan-400 flex items-center gap-2">
              <Mic className="h-4 w-4 animate-pulse" />
              Listening…
            </p>
          )}
          {useLiveKitVideo && livekitAiJoined && livekitAiPhase === "listening" && (
            <p className="text-sm text-cyan-400/80 text-xs">Room AI listening</p>
          )}
          {useLiveKitVideo && livekitAiPhase === "thinking" && (
            <p className="text-sm text-amber-200/90 flex items-center gap-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Room AI thinking
            </p>
          )}
          {useLiveKitVideo && livekitAiPhase === "speaking" && (
            <p className="text-sm text-violet-300 flex items-center gap-2 text-xs">
              <Bot className="h-3 w-3" />
              Room AI speaking
            </p>
          )}
          {aiPaused && (
            <p className="text-sm text-amber-200/80 flex items-center gap-2">
              <HandHelping className="h-4 w-4" />
              AI paused — team assisting
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {!endedSummary && staffMode && staffControls}

        {!endedSummary && staffMode && onStaffSend && (
          <div className="mt-3 flex gap-2 shrink-0">
            <Textarea
              value={staffInput ?? ""}
              onChange={(e) => onStaffInputChange?.(e.target.value)}
              placeholder="Message the prospect…"
              className="min-h-[48px] bg-slate-950/80 border-violet-700/50 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onStaffSend();
                }
              }}
            />
            <Button
              size="icon"
              className="shrink-0 h-12 w-12 bg-violet-600 hover:bg-violet-500"
              onClick={onStaffSend}
              disabled={staffSending || !staffInput?.trim()}
            >
              <Send className="h-5 w-5 text-white" />
            </Button>
          </div>
        )}

        {!endedSummary && !staffMode && (
          <div className="mt-4 flex gap-2 shrink-0">
            <Textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask a question…"
              className="min-h-[48px] bg-slate-950/80 border-slate-700 resize-none focus-visible:ring-cyan-500/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <Button
              size="icon"
              className="shrink-0 h-12 w-12 bg-cyan-500 hover:bg-cyan-400"
              onClick={onSend}
              disabled={sending || !input.trim()}
            >
              <Send className="h-5 w-5 text-slate-950" />
            </Button>
          </div>
        )}

        {sendError && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm">
            <p className="text-red-300">{sendError}</p>
            {retryable && onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onRetry}
                disabled={sending}
              >
                Retry
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
