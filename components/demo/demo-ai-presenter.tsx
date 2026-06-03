"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  HandHelping,
  Mic,
  Pause,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AiPresenterState } from "@/lib/demo/ai-presenter-types";
import { presenterStateLabel } from "@/lib/demo/resolve-ai-presenter-state";

export type DemoAiPresenterProps = {
  displayName: string;
  roleTitle?: string;
  avatarUrl?: string | null;
  fallbackInitials?: string;
  brandColor?: string;
  state: AiPresenterState;
  demoStage?: string | null;
  demoPathTitle?: string | null;
  currentAssetTitle?: string | null;
  bookingRecommended?: boolean;
  handoffRequired?: boolean;
  showWaveform?: boolean;
  showDemoStage?: boolean;
  showDemoPath?: boolean;
  showBookingBadge?: boolean;
  showHandoffBadge?: boolean;
  compact?: boolean;
  staffView?: boolean;
  leadScore?: number | null;
  leadCategory?: string | null;
  className?: string;
};

function WaveformBars({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-end justify-center gap-0.5 h-6" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-full transition-all",
            active ? "animate-pulse" : "opacity-30"
          )}
          style={{
            backgroundColor: color,
            height: active ? `${10 + (i % 3) * 6}px` : "6px",
            animationDelay: `${i * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1 items-center" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

export function DemoAiPresenter({
  displayName,
  roleTitle = "AI Sales Presenter",
  avatarUrl,
  fallbackInitials = "AI",
  brandColor = "#22d3ee",
  state,
  demoStage,
  demoPathTitle,
  currentAssetTitle,
  bookingRecommended,
  handoffRequired,
  showWaveform = true,
  showDemoStage = true,
  showDemoPath = true,
  showBookingBadge = true,
  showHandoffBadge = true,
  compact = false,
  staffView = false,
  leadScore,
  leadCategory,
  className,
}: DemoAiPresenterProps) {
  const [imgError, setImgError] = useState(false);
  const labels = useMemo(() => presenterStateLabel(state), [state]);
  const subtitle =
    state === "presenting" && currentAssetTitle
      ? `Presenting: ${currentAssetTitle}`
      : labels.subtitle;

  const ringActive = state === "speaking" || state === "listening" || state === "thinking";
  const pulseListening = state === "listening";
  const showWave = showWaveform && (state === "speaking" || state === "presenting");

  const stateIcon = (() => {
    if (state === "paused") return <Pause className="h-3.5 w-3.5" />;
    if (state === "handoff_required") return <HandHelping className="h-3.5 w-3.5" />;
    if (state === "failed") return <AlertTriangle className="h-3.5 w-3.5" />;
    if (state === "thinking") return <ThinkingDots />;
    if (state === "speaking" || state === "presenting") return <Volume2 className="h-3.5 w-3.5" />;
    if (state === "listening") return <Mic className="h-3.5 w-3.5" />;
    return <Bot className="h-3.5 w-3.5" />;
  })();

  return (
    <Card
      className={cn(
        "border-slate-800/80 bg-gradient-to-br from-slate-900/95 to-slate-950/95 overflow-hidden",
        state === "failed" && "border-red-500/40",
        state === "handoff_required" && "border-amber-500/40",
        state === "paused" && "border-violet-500/30",
        compact && "shadow-lg shadow-black/40",
        className
      )}
    >
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className={cn("flex gap-3", compact ? "items-center" : "items-start")}>
          <div className="relative shrink-0">
            <div
              className={cn(
                "rounded-full p-0.5 transition-all duration-500",
                pulseListening && "animate-pulse"
              )}
              style={
                ringActive
                  ? {
                      boxShadow: `0 0 0 2px ${state === "speaking" ? brandColor : `${brandColor}66`}`,
                    }
                  : undefined
              }
            >
              <div
                className={cn(
                  "rounded-full overflow-hidden flex items-center justify-center bg-slate-800 border border-slate-700/80",
                  compact ? "h-12 w-12" : "h-16 w-16"
                )}
              >
                {avatarUrl && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span
                    className={cn(
                      "font-semibold text-white",
                      compact ? "text-sm" : "text-lg"
                    )}
                    style={{ color: brandColor }}
                  >
                    {fallbackInitials}
                  </span>
                )}
              </div>
            </div>
            {state === "speaking" && (
              <span
                className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-slate-950 flex items-center justify-center"
                style={{ backgroundColor: brandColor }}
              >
                <Sparkles className="h-2.5 w-2.5 text-slate-950" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className={cn("font-semibold text-white truncate", compact && "text-sm")}>
                {displayName}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] capitalize gap-1",
                  state === "speaking" && "border-cyan-500/50 text-cyan-200",
                  state === "thinking" && "border-amber-500/50 text-amber-200",
                  state === "paused" && "border-violet-500/50 text-violet-200",
                  state === "handoff_required" && "border-amber-500/50 text-amber-100",
                  state === "failed" && "border-red-500/50 text-red-200"
                )}
              >
                {stateIcon}
                {labels.title}
              </Badge>
            </div>
            {!compact && (
              <p className="text-xs text-slate-500 truncate">{roleTitle}</p>
            )}
            <p className="text-xs text-slate-400">{subtitle}</p>

            {showWave && (
              <div className="pt-1">
                <WaveformBars
                  active={state === "speaking" || state === "presenting"}
                  color={brandColor}
                />
              </div>
            )}

            {!compact && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {showDemoStage && demoStage && (
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {demoStage.replace(/_/g, " ")}
                  </Badge>
                )}
                {showDemoPath && demoPathTitle && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-cyan-500/30 text-cyan-200/90 max-w-full truncate"
                  >
                    {demoPathTitle}
                  </Badge>
                )}
                {showBookingBadge && bookingRecommended && (
                  <Badge className="text-[10px] bg-cyan-600/25 text-cyan-100 border-cyan-500/40">
                    Booking recommended
                  </Badge>
                )}
                {showHandoffBadge && handoffRequired && (
                  <Badge className="text-[10px] bg-amber-600/25 text-amber-100 border-amber-500/40">
                    Human closer needed
                  </Badge>
                )}
                {staffView && leadCategory && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {leadCategory}
                    {leadScore != null ? ` · ${leadScore}` : ""}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
