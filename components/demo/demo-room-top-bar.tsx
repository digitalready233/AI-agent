"use client";

import { MonitorPlay, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDemoStageLabel } from "@/lib/demo/demo-room-ui";
import { cn } from "@/lib/utils";

export function DemoRoomTopBar({
  title,
  productName,
  joined,
  status,
  currentStage,
  timerLabel,
  connectionLabel,
  connectionOk,
  staffMode,
  handoffActive,
  demoPathTitle,
  leadScore,
  leadCategory,
  buyingIntent,
  objectionsCount,
  bookingReady,
  humanCloserStatus,
}: {
  title?: string | null;
  productName?: string | null;
  joined?: boolean;
  status?: string | null;
  currentStage?: string | null;
  timerLabel?: string;
  connectionLabel?: string;
  connectionOk?: boolean;
  staffMode?: boolean;
  handoffActive?: boolean;
  demoPathTitle?: string | null;
  leadScore?: number | null;
  leadCategory?: string | null;
  buyingIntent?: string | null;
  objectionsCount?: number;
  bookingReady?: boolean;
  humanCloserStatus?: string | null;
}) {
  const stageLabel = formatDemoStageLabel(currentStage);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-30">
      <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-lg shadow-cyan-500/20">
              <MonitorPlay className="h-5 w-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90">
                AI sales demo control room
              </p>
              <h1 className="text-lg font-semibold text-white truncate">
                {title ?? "Demo session"}
              </h1>
              {productName && (
                <p className="text-xs text-slate-500 truncate">{productName}</p>
              )}
            </div>
          </div>

          {joined && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <MetricPill label="Status" value={status?.replace(/_/g, " ") ?? "—"} />
              <MetricPill
                label="Stage"
                value={stageLabel}
                highlight
              />
              {demoPathTitle && (
                <Badge
                  variant="outline"
                  className="text-[10px] max-w-[140px] truncate border-violet-500/30 text-violet-200"
                  title={demoPathTitle}
                >
                  {demoPathTitle}
                </Badge>
              )}
              {leadScore != null && (
                <MetricPill label="Score" value={`${leadScore}/12`} />
              )}
              {leadCategory && (
                <MetricPill label="Intent band" value={leadCategory} />
              )}
              {buyingIntent && (
                <MetricPill label="Buying intent" value={buyingIntent} highlight />
              )}
              {objectionsCount != null && objectionsCount > 0 && (
                <MetricPill label="Objections" value={String(objectionsCount)} />
              )}
              {bookingReady && (
                <MetricPill label="Booking" value="Ready" highlight />
              )}
              {humanCloserStatus && humanCloserStatus !== "none" && (
                <MetricPill
                  label="Human closer"
                  value={humanCloserStatus.replace(/_/g, " ")}
                />
              )}
              {handoffActive && (
                <Badge variant="destructive" className="text-[10px]">
                  Handoff active
                </Badge>
              )}
              {staffMode && (
                <Badge className="text-[10px] bg-violet-600/30 text-violet-200 border-violet-500/40">
                  Staff
                </Badge>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs font-mono text-slate-300">
                {timerLabel ?? "00:00"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] capitalize",
                  connectionOk
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                )}
              >
                {connectionOk ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                {connectionLabel?.replace(/_/g, " ") ?? "connecting"}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MetricPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-col rounded-md border px-2 py-0.5 min-w-[72px]",
        highlight
          ? "border-cyan-500/35 bg-cyan-500/10"
          : "border-slate-800 bg-slate-900/50"
      )}
    >
      <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
      <span
        className={cn(
          "text-xs font-medium capitalize truncate",
          highlight ? "text-cyan-200" : "text-slate-200"
        )}
      >
        {value}
      </span>
    </span>
  );
}
