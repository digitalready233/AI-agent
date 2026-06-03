"use client";

import { Badge } from "@/components/ui/badge";
import type { DemoQualificationProgress } from "@/lib/demo/types";
import {
  buyingIntentFromScore,
  formatLeadCategory,
  recommendedQualificationQuestion,
  type BuyingIntent,
  type LeadCategoryDisplay,
} from "@/lib/demo/demo-room-ui";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

const INTENT_STYLES: Record<BuyingIntent, string> = {
  Low: "border-slate-600 text-slate-400 bg-slate-800/40",
  Medium: "border-amber-500/40 text-amber-200 bg-amber-500/10",
  High: "border-emerald-500/40 text-emerald-200 bg-emerald-500/10",
};

const CATEGORY_STYLES: Record<LeadCategoryDisplay, string> = {
  Cold: "border-slate-500/50 text-slate-300",
  Warm: "border-amber-500/40 text-amber-200",
  Hot: "border-orange-500/50 text-orange-200",
  Unknown: "border-slate-700 text-slate-500",
};

export function DemoLeadIntelligenceCard({
  progress,
  leadScore,
  leadCategory,
}: {
  progress?: DemoQualificationProgress | null;
  leadScore?: number | null;
  leadCategory?: string | null;
}) {
  const p = progress ?? { need: false, budget: false, authority: false, timeline: false };
  const items = [
    { key: "need", label: "Need captured", done: p.need },
    { key: "budget", label: "Budget captured", done: p.budget },
    { key: "authority", label: "Authority captured", done: p.authority },
    { key: "timeline", label: "Timeline captured", done: p.timeline },
  ] as const;
  const doneCount = items.filter((i) => i.done).length;
  const score = leadScore ?? 0;
  const category = formatLeadCategory(leadCategory);
  const intent = buyingIntentFromScore(leadScore);
  const nextQ = recommendedQualificationQuestion(p);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("text-xs", CATEGORY_STYLES[category])}>
          {category}
        </Badge>
        <Badge variant="outline" className={cn("text-xs", INTENT_STYLES[intent])}>
          Buying intent: {intent}
        </Badge>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-500">Lead score</span>
          <span className="text-slate-200 font-medium tabular-nums">{score}/12</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-violet-500 transition-all"
            style={{ width: `${Math.min(100, (score / 12) * 100)}%` }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-slate-600" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm", item.done ? "text-slate-200" : "text-slate-500")}>
                {item.label}
              </p>
              <div className="h-1 mt-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    item.done ? "w-full bg-emerald-500/60" : "w-0"
                  )}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500">
        Qualification {doneCount}/4 complete
      </p>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wide text-cyan-500/80 mb-1">
          Recommended next question
        </p>
        <p className="text-sm text-cyan-100/90 leading-snug">{nextQ}</p>
      </div>
    </div>
  );
}
