"use client";

import { Bot, Calendar, Mic, Pause, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AiPresenterState } from "@/lib/demo/ai-presenter-types";
import { presenterStateLabel } from "@/lib/demo/resolve-ai-presenter-state";

export function DemoPresenterStatusChip({
  displayName,
  state,
  bookingRecommended,
  handoffRequired,
  className,
}: {
  displayName: string;
  state: AiPresenterState;
  bookingRecommended?: boolean;
  handoffRequired?: boolean;
  className?: string;
}) {
  const labels = presenterStateLabel(state);

  const Icon = () => {
    if (state === "paused") return <Pause className="h-3.5 w-3.5" />;
    if (state === "listening") return <Mic className="h-3.5 w-3.5" />;
    if (state === "speaking" || state === "presenting")
      return <Volume2 className="h-3.5 w-3.5" />;
    return <Bot className="h-3.5 w-3.5" />;
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-2.5 flex items-center gap-2.5",
        className
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
          (state === "speaking" || state === "listening") && "ring-1 ring-cyan-500/40"
        )}
      >
        <Icon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white truncate">{displayName}</p>
        <p className="text-[10px] text-slate-500 truncate">{labels.subtitle}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge
          variant="outline"
          className="text-[10px] border-cyan-500/30 text-cyan-200 capitalize"
        >
          {labels.title}
        </Badge>
        {bookingRecommended && (
          <Badge
            variant="outline"
            className="text-[10px] border-emerald-500/40 text-emerald-200 gap-0.5"
          >
            <Calendar className="h-2.5 w-2.5" />
            Book
          </Badge>
        )}
        {handoffRequired && (
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-200">
            Handoff
          </Badge>
        )}
      </div>
      <p className="sr-only">Primary AI presenter is shown in the demo stage</p>
    </div>
  );
}
