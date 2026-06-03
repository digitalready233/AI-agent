"use client";

import dynamic from "next/dynamic";
import { ChartsSkeleton } from "@/components/platform/dashboard-skeleton";
import type { ComponentProps } from "react";

const DashboardCharts = dynamic(
  () =>
    import("@/components/platform/dashboard-charts").then((m) => m.DashboardCharts),
  {
    loading: () => <ChartsSkeleton />,
    ssr: false,
  }
);

type DashboardChartsProps = ComponentProps<
  typeof import("@/components/platform/dashboard-charts").DashboardCharts
>;

export function DashboardChartsLazy(props: DashboardChartsProps) {
  return <DashboardCharts {...props} />;
}
