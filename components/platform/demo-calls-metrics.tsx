import { getDemoMetrics } from "@/lib/demo/metrics";
import type { DashboardPeriod } from "@/lib/platform/dashboard-period";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export async function DemoCallsMetrics({
  organizationId,
  period = "30d",
}: {
  organizationId: string;
  period?: DashboardPeriod;
}) {
  const m = await getDemoMetrics(organizationId, period);

  const avgMin =
    m.averageDemoDurationSeconds > 0
      ? `${Math.floor(m.averageDemoDurationSeconds / 60)}m`
      : "—";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Demo metrics (last {period})</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <Metric label="Recorded demos" value={m.recordedDemos} />
        <Metric label="Replay views" value={m.replayViews} />
        <Metric label="Reviewed" value={m.demosReviewed} />
        <Metric label="Follow-ups" value={m.demosWithFollowUp} />
        <Metric label="Hot from demos" value={m.hotLeadsFromDemos} />
        <Metric label="Demo → booking %" value={`${m.demoToBookingConversion}%`} />
        <Metric label="Takeover conv. %" value={`${m.humanTakeoverConversion}%`} />
        <Metric label="Avg duration" value={avgMin} />
        <Metric label="Avatar demos" value={m.avatarDemosStarted} />
        <Metric label="Avatar failures" value={m.avatarProviderFailures} />
        <Metric label="Avatar fallbacks" value={m.avatarFallbackActivations} />
        <Metric label="Avatar → booking %" value={`${m.avatarDemoConversionRate}%`} />
        <Metric label="Avatar handoffs" value={m.avatarDemosNeedingHandoff} />
        <Metric label="Tavus demos" value={m.tavusAvatarDemosStarted} />
        <Metric label="Tavus failures" value={m.tavusAvatarFailures} />
        <Metric label="D-ID demos" value={m.didAvatarDemosStarted} />
        <Metric label="D-ID failures" value={m.didAvatarFailures} />
        <Metric label="D-ID fallbacks" value={m.didAvatarFallbackActivations} />
        <Metric label="D-ID → booking %" value={`${m.didDemoConversionRate}%`} />
        <Metric label="D-ID handoffs" value={m.didDemosNeedingHandoff} />
        {m.mostReliableProvider && (
          <Metric
            label="Most reliable provider"
            value={m.mostReliableProvider.replace(/_/g, " ")}
          />
        )}
        {m.bestConvertingProvider && (
          <Metric
            label="Best converting provider"
            value={m.bestConvertingProvider.replace(/_/g, " ")}
          />
        )}
        <Metric label="Internal fallbacks" value={m.internalCardFallbackCount} />
        <Metric label="Multi-agent demos" value={m.multiAgentDemos} />
        <Metric label="MA booking rec." value={m.multiAgentBookingRecommendations} />
        <Metric label="MA objections" value={m.multiAgentObjectionsDetected} />
        <Metric label="MA handoffs" value={m.multiAgentHandoffsRecommended} />
        <Metric label="MA → booking %" value={`${m.multiAgentConversionRate}%`} />
        {(m.providerStats ?? []).map((s) => (
          <Metric
            key={s.provider}
            label={`${s.provider.replace(/_/g, " ")} success %`}
            value={`${s.successRate}%`}
          />
        ))}
      </CardContent>
    </Card>
  );
}
