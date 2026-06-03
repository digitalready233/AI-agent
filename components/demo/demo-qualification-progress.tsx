import { CheckCircle2, Circle } from "lucide-react";
import type { DemoQualificationProgress } from "@/lib/demo/types";

export function DemoQualificationProgressCard({
  progress,
}: {
  progress?: DemoQualificationProgress | null;
}) {
  const p = progress ?? { need: false, budget: false, authority: false, timeline: false };
  const items = [
    { key: "need", label: "Need captured", done: p.need },
    { key: "budget", label: "Budget captured", done: p.budget },
    { key: "authority", label: "Authority captured", done: p.authority },
    { key: "timeline", label: "Timeline captured", done: p.timeline },
  ] as const;

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Qualification ({doneCount}/4)
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-slate-600" />
            )}
            <span className={item.done ? "text-slate-200" : "text-slate-500"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
