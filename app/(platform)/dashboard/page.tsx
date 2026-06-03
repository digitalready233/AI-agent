import { Suspense } from "react";
import { requireSession } from "@/lib/platform/auth";
import { parseDashboardPeriod } from "@/lib/platform/dashboard-period";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { DashboardPeriodSelect } from "@/components/platform/dashboard-period-select";
import { DashboardHandoffBanner } from "@/components/platform/dashboard-handoff-banner";
import { DashboardStatsSection } from "@/components/platform/dashboard-stats-section";
import { DashboardChartsSection } from "@/components/platform/dashboard-charts-section";
import { DashboardRecentSection } from "@/components/platform/dashboard-recent-section";
import {
  StatsGridSkeleton,
  ChartsSkeleton,
  RecentListsSkeleton,
} from "@/components/platform/dashboard-skeleton";
import { DashboardVoiceSimulate } from "@/components/platform/dashboard-voice-simulate";
import { DashboardVoiceCampaigns } from "@/components/platform/dashboard-voice-campaigns";

type SearchParams = Promise<{ period?: string; error?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const session = await requireSession();
  requirePermission(session, "dashboard.view");

  const { organization, profile } = session;
  const orgId = organization.id;
  const period = parseDashboardPeriod(params.period);

  return (
    <div className="platform-page space-y-8">
      <PageHeader
        title="Sales operations dashboard"
        description={`Pipeline, qualified leads, bookings, and handoffs for ${organization.name}.`}
        actions={
          <Suspense
            fallback={
              <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-800/75" />
            }
          >
            <DashboardPeriodSelect value={period} />
          </Suspense>
        }
      />

      {params.error === "forbidden" && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          You do not have permission to access that page.
        </p>
      )}

      <Suspense fallback={null}>
        <DashboardHandoffBanner orgId={orgId} />
      </Suspense>

      <Suspense fallback={<StatsGridSkeleton />}>
        <DashboardStatsSection orgId={orgId} period={period} role={profile.role} />
      </Suspense>

      <Suspense fallback={null}>
        <DashboardVoiceSimulate orgId={orgId} />
      </Suspense>

      <Suspense fallback={null}>
        <DashboardVoiceCampaigns orgId={orgId} />
      </Suspense>

      <Suspense fallback={<ChartsSkeleton />}>
        <DashboardChartsSection orgId={orgId} period={period} />
      </Suspense>

      <Suspense fallback={<RecentListsSkeleton />}>
        <DashboardRecentSection orgId={orgId} />
      </Suspense>
    </div>
  );
}
