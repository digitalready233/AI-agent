"use client";

import { cn } from "@/lib/utils";
import {
  DEMO_STAGE_PROGRESS,
  formatDemoStageLabel,
  resolveProgressStageIndex,
} from "@/lib/demo/demo-room-ui";

export function DemoStageProgress({
  currentStage,
  className,
}: {
  currentStage?: string | null;
  className?: string;
}) {
  const activeIdx = resolveProgressStageIndex(currentStage);
  const currentLabel = formatDemoStageLabel(currentStage);

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800/80 bg-slate-900/50 px-4 py-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Demo stage
        </p>
        <span className="text-xs font-medium text-cyan-300/90">{currentLabel}</span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {DEMO_STAGE_PROGRESS.map((stage, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={stage.id} className="flex flex-col items-center min-w-[72px] flex-1">
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  done && "bg-cyan-500/70",
                  active && "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]",
                  !done && !active && "bg-slate-800"
                )}
              />
              <span
                className={cn(
                  "mt-1.5 text-[9px] leading-tight text-center px-0.5",
                  active && "text-cyan-200 font-medium",
                  done && !active && "text-slate-400",
                  !done && !active && "text-slate-600"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
