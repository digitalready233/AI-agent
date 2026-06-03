import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-slate-800/50 bg-slate-900/35 transition-all duration-200 hover:border-slate-700/60 hover:shadow-lg hover:shadow-cyan-500/5",
        className
      )}
    >
      <CardContent className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {title}
            </p>
            <p className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
              {value}
            </p>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            {trend && <p className="text-sm font-medium text-emerald-400/90">{trend}</p>}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/12 to-indigo-500/8 ring-1 ring-cyan-500/15">
            <Icon className="h-5 w-5 text-cyan-400" strokeWidth={1.75} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
