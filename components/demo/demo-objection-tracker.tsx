"use client";

import { Badge } from "@/components/ui/badge";
import { OBJECTION_CATALOG } from "@/lib/demo/demo-room-ui";
import { formatObjectionTag } from "@/lib/demo/objection-labels";
import { cn } from "@/lib/utils";

export function DemoObjectionTracker({ objections }: { objections?: string[] }) {
  const detected = new Set((objections ?? []).map((o) => o.toLowerCase()));

  return (
    <div className="space-y-2">
      {OBJECTION_CATALOG.map((tag) => {
        const active = detected.has(tag);
        return (
          <div
            key={tag}
            className={cn(
              "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors",
              active
                ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                : "border-slate-800/80 bg-slate-950/40 text-slate-600"
            )}
          >
            <span>{formatObjectionTag(tag)}</span>
            {active ? (
              <Badge
                variant="outline"
                className="text-[10px] h-5 border-amber-500/30 text-amber-200"
              >
                Detected
              </Badge>
            ) : null}
          </div>
        );
      })}
      <div
        className={cn(
          "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs",
          detected.size === 0
            ? "border-slate-700/60 bg-slate-900/40 text-slate-400"
            : "border-slate-800/80 bg-slate-950/40 text-slate-600"
        )}
      >
        <span>No objection detected</span>
        {detected.size === 0 ? (
          <Badge variant="outline" className="text-[10px] h-5 border-slate-600 text-slate-400">
            Clear
          </Badge>
        ) : null}
      </div>
      {detected.size > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {[...detected].map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] border-amber-500/30 text-amber-200/90"
            >
              {formatObjectionTag(tag)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
