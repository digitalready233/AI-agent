"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DASHBOARD_PERIOD_OPTIONS, type DashboardPeriod } from "@/lib/platform/dashboard-period";

export function DashboardPeriodSelect({ value }: { value: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: DashboardPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "30d") {
      params.delete("period");
    } else {
      params.set("period", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-400">
      <span className="sr-only">Time period</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DashboardPeriod)}
        className="h-10 rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 text-sm font-medium text-slate-200 outline-none transition-colors hover:border-slate-600 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
      >
        {DASHBOARD_PERIOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
