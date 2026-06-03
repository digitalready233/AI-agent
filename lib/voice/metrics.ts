import { isWithinPeriod, type DashboardPeriod } from "@/lib/platform/dashboard-period";
import { listCalls } from "./call-data";
import type { CallRecord } from "./types";

export interface VoiceDashboardMetrics {
  totalCalls: number;
  callsToday: number;
  completedCalls: number;
  missedCalls: number;
  averageCallDurationSeconds: number;
  hotLeadsFromCalls: number;
  bookingsFromCalls: number;
  humanTransfers: number;
  callConversionRate: number;
  outboundCallsStarted: number;
  outboundAnswered: number;
  outboundFailed: number;
  outboundQualified: number;
  outboundBookings: number;
  outboundHumanTransfers: number;
  outboundConversionRate: number;
}

export async function getVoiceMetrics(
  organizationId: string,
  period: DashboardPeriod
): Promise<VoiceDashboardMetrics> {
  const calls = await listCalls(organizationId);
  const periodCalls = calls.filter((c) => isWithinPeriod(c.created_at, period));

  const todayKey = new Date().toISOString().slice(0, 10);
  const callsToday = calls.filter(
    (c) => c.created_at.slice(0, 10) === todayKey
  ).length;

  const completed = periodCalls.filter((c) => c.status === "completed");
  const missed = periodCalls.filter(
    (c) => c.status === "no_answer" || c.status === "busy" || c.status === "failed"
  );

  const durations = completed
    .map((c) => c.duration_seconds)
    .filter((d): d is number => typeof d === "number" && d > 0);
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const hotLeads = periodCalls.filter((c) =>
    (c.lead_category ?? "").toLowerCase().includes("hot")
  ).length;

  const transfers = periodCalls.filter(
    (c) =>
      c.handoff_required ||
      c.status === "transferred" ||
      c.status === "human_needed"
  ).length;

  const withBooking = periodCalls.filter((c) =>
    Boolean(
      c.metadata &&
        typeof c.metadata === "object" &&
        (c.metadata as { booking_id?: string }).booking_id
    )
  ).length;

  const qualified = periodCalls.filter(
    (c) => c.lead_category && c.lead_category !== "not_qualified"
  ).length;
  const conversionRate = periodCalls.length
    ? Math.round((qualified / periodCalls.length) * 100)
    : 0;

  const { getOutboundVoiceDashboardMetrics } = await import("./campaign-metrics");
  const outbound = await getOutboundVoiceDashboardMetrics(
    organizationId,
    periodCalls
  );

  return {
    totalCalls: periodCalls.length,
    callsToday,
    completedCalls: completed.length,
    missedCalls: missed.length,
    averageCallDurationSeconds: avgDuration,
    hotLeadsFromCalls: hotLeads,
    bookingsFromCalls: withBooking,
    humanTransfers: transfers,
    callConversionRate: conversionRate,
    outboundCallsStarted: outbound.outboundStarted,
    outboundAnswered: outbound.answered,
    outboundFailed: outbound.failed,
    outboundQualified: outbound.qualified,
    outboundBookings: outbound.bookings,
    outboundHumanTransfers: outbound.humanTransfers,
    outboundConversionRate: outbound.conversionRate,
  };
}

export function countBookingsFromCallEvents(
  calls: CallRecord[]
): number {
  return calls.filter((c) =>
    JSON.stringify(c.metadata ?? {}).includes("booking")
  ).length;
}
