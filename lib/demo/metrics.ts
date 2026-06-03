import {
  getPeriodStart,
  isHotLeadCategory,
} from "@/lib/platform/dashboard-period";
import type { DashboardPeriod } from "@/lib/platform/dashboard-period";
import { aggregateProviderStats } from "@/lib/avatar/provider-metrics-data";
import { listDemoSessions } from "./demo-data";
import type { DemoDashboardMetrics } from "./types";

export async function getDemoMetrics(
  organizationId: string,
  period: DashboardPeriod = "30d"
): Promise<DemoDashboardMetrics> {
  const sessions = await listDemoSessions(organizationId);
  const periodStart = getPeriodStart(period);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const inPeriod = (iso: string) =>
    !periodStart || new Date(iso) >= periodStart;

  const periodSessions = sessions.filter((s) => inPeriod(s.created_at));
  const demosToday = sessions.filter(
    (s) => new Date(s.created_at) >= todayStart
  ).length;

  const demosStarted = periodSessions.filter(
    (s) => s.started_at || ["in_progress", "human_taken_over", "completed"].includes(s.status)
  ).length;

  const completedDemos = periodSessions.filter(
    (s) => s.status === "completed"
  ).length;
  const missedDemos = periodSessions.filter((s) => s.status === "missed").length;
  const hotLeadsFromDemos = periodSessions.filter((s) =>
    isHotLeadCategory(s.lead_category)
  ).length;
  const bookingsFromDemos = periodSessions.filter((s) => s.booking_id).length;
  const liveDemosNow = sessions.filter((s) =>
    ["in_progress", "human_taken_over", "waiting"].includes(s.status)
  ).length;

  const demosNeedingHandoff = periodSessions.filter(
    (s) => s.handoff_required && !["completed", "cancelled", "missed"].includes(s.status)
  ).length;

  const humanTakeovers = periodSessions.filter(
    (s) => s.status === "human_taken_over" || s.handoff_required
  ).length;

  const demoConversionRate =
    completedDemos > 0
      ? Math.round((bookingsFromDemos / completedDemos) * 100)
      : 0;

  const withPath = periodSessions.filter((s) => s.demo_path_id);
  const demosWithPathSelected = withPath.length;

  const hotAfterPath = withPath.filter((s) => isHotLeadCategory(s.lead_category)).length;

  const pathCounts: Record<string, number> = {};
  for (const s of withPath) {
    const title =
      (typeof s.metadata?.demo_path_title === "string"
        ? s.metadata.demo_path_title
        : null) ?? s.demo_path_id ?? "Unknown";
    pathCounts[title] = (pathCounts[title] ?? 0) + 1;
  }
  let mostSelectedPathTitle: string | null = null;
  let max = 0;
  for (const [title, count] of Object.entries(pathCounts)) {
    if (count > max) {
      max = count;
      mostSelectedPathTitle = title;
    }
  }

  const liveRoomsActive = sessions.filter(
    (s) => s.livekit_room_status === "active"
  ).length;
  const demosWithVideoEnabled = periodSessions.filter((s) => s.video_enabled).length;
  const staffJoinedDemos = periodSessions.filter((s) =>
    ["joined", "taken_over", "resolved"].includes(s.handoff_status ?? "")
  ).length;
  const completedVideoDemos = periodSessions.filter(
    (s) => s.status === "completed" && s.video_provider === "livekit"
  ).length;
  const videoDemosWithBookings = periodSessions.filter(
    (s) => s.video_provider === "livekit" && s.booking_id
  ).length;

  const recordedDemos = periodSessions.filter(
    (s) =>
      s.recording_url ||
      s.recording_status === "stopped" ||
      s.recording_status === "recording"
  ).length;
  const replayViews = periodSessions.reduce(
    (sum, s) => sum + (s.replay_view_count ?? 0),
    0
  );
  const demosReviewed = periodSessions.filter(
    (s) => s.review_status === "reviewed" || s.reviewed_at
  ).length;
  const demosWithFollowUp = periodSessions.filter(
    (s) => s.follow_up_draft || s.post_demo_automation_at
  ).length;
  const completedWithDuration = periodSessions.filter(
    (s) => s.status === "completed" && (s.duration_seconds ?? 0) > 0
  );
  const averageDemoDurationSeconds =
    completedWithDuration.length > 0
      ? Math.round(
          completedWithDuration.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) /
            completedWithDuration.length
        )
      : 0;
  const humanTakeoverCompleted = periodSessions.filter(
    (s) => s.status === "completed" && Boolean(s.human_takeover_by)
  ).length;
  const humanTakeoverConversion =
    humanTakeovers > 0
      ? Math.round((humanTakeoverCompleted / humanTakeovers) * 100)
      : 0;
  const demoToBookingConversion =
    completedDemos > 0 ? Math.round((bookingsFromDemos / completedDemos) * 100) : 0;

  const avatarDemosStarted = periodSessions.filter(
    (s) =>
      s.avatar_started_at ||
      ["active", "speaking", "listening", "paused", "stopped", "fallback_active"].includes(
        s.avatar_status ?? ""
      )
  ).length;
  const avatarProviderFailures = periodSessions.filter(
    (s) => s.avatar_status === "failed"
  ).length;
  const avatarFallbackActivations = periodSessions.filter(
    (s) =>
      s.avatar_status === "fallback_active" ||
      (typeof s.metadata?.avatar_last_event === "string" &&
        s.metadata.avatar_last_event === "fallback_activated")
  ).length;
  const externalAvatarSessions = periodSessions.filter(
    (s) => s.avatar_provider && s.avatar_provider !== "internal_card"
  );
  const avatarDemosWithBooking = externalAvatarSessions.filter((s) => s.booking_id).length;
  const avatarCompleted = externalAvatarSessions.filter((s) => s.status === "completed");
  const avatarDemoConversionRate =
    avatarCompleted.length > 0
      ? Math.round(
          (avatarDemosWithBooking / avatarCompleted.length) * 100
        )
      : 0;
  const avatarDemosNeedingHandoff = externalAvatarSessions.filter(
    (s) => s.handoff_required
  ).length;

  const tavusSessions = periodSessions.filter(
    (s) => s.avatar_provider === "tavus" || s.tavus_conversation_id
  );
  const tavusAvatarDemosStarted = tavusSessions.filter(
    (s) =>
      s.tavus_conversation_id ||
      s.avatar_started_at ||
      ["active", "speaking", "listening", "paused", "stopped"].includes(
        s.avatar_status ?? ""
      )
  ).length;
  const tavusAvatarFailures = tavusSessions.filter(
    (s) =>
      s.avatar_status === "failed" ||
      (typeof s.metadata?.avatar_last_event === "string" &&
        s.metadata.avatar_last_event === "tavus_avatar_failed")
  ).length;

  const didSessions = periodSessions.filter(
    (s) => s.avatar_provider === "did" || s.did_stream_id || s.did_agent_id
  );
  const didAvatarDemosStarted = didSessions.filter(
    (s) =>
      s.did_stream_id ||
      s.avatar_started_at ||
      ["active", "speaking", "listening", "paused", "starting"].includes(
        s.avatar_status ?? ""
      )
  ).length;
  const didAvatarFailures = didSessions.filter(
    (s) =>
      s.avatar_status === "failed" ||
      (typeof s.metadata?.avatar_last_event === "string" &&
        s.metadata.avatar_last_event === "did_session_failed")
  ).length;
  const didAvatarFallbackActivations = didSessions.filter(
    (s) =>
      s.avatar_status === "fallback_active" &&
      (s.avatar_provider === "did" ||
        (typeof s.metadata?.avatar_last_event === "string" &&
          s.metadata.avatar_last_event.includes("fallback")))
  ).length;
  const didCompleted = didSessions.filter((s) => s.status === "completed");
  const didDemosWithBooking = didSessions.filter((s) => s.booking_id).length;
  const didDemoConversionRate =
    didCompleted.length > 0
      ? Math.round((didDemosWithBooking / didCompleted.length) * 100)
      : 0;
  const didDemosNeedingHandoff = didSessions.filter((s) => s.handoff_required).length;

  const providerStatsRaw = await aggregateProviderStats(organizationId);
  const providerStats = providerStatsRaw.map((s) => ({
    provider: String(s.provider),
    demosStarted: s.demosStarted,
    failures: s.failures,
    fallbacks: s.fallbacks,
    bookings: s.bookings,
    handoffs: s.handoffs,
    successRate: s.successRate,
    failureRate: s.failureRate,
    conversionRate: s.conversionRate,
    avgStartTimeMs: s.avgStartTimeMs,
  }));

  let mostReliableProvider: string | null = null;
  let bestReliability = -1;
  for (const s of providerStats) {
    if (s.demosStarted + s.failures === 0) continue;
    if (s.successRate > bestReliability) {
      bestReliability = s.successRate;
      mostReliableProvider = s.provider;
    }
  }

  let bestConvertingProvider: string | null = null;
  let bestConv = -1;
  for (const s of providerStats) {
    if (s.demosStarted === 0) continue;
    if (s.conversionRate > bestConv) {
      bestConv = s.conversionRate;
      bestConvertingProvider = s.provider;
    }
  }

  const multiAgentDemos = periodSessions.filter((s) => s.multi_agent_enabled).length;
  const multiAgentSessions = periodSessions.filter((s) => s.multi_agent_enabled);
  const multiAgentBookingRecommendations = multiAgentSessions.filter(
    (s) => s.booking_recommended
  ).length;
  const multiAgentObjectionsDetected = multiAgentSessions.filter(
    (s) => (s.objections?.length ?? 0) > 0
  ).length;
  const multiAgentHandoffsRecommended = multiAgentSessions.filter(
    (s) => s.handoff_required
  ).length;
  const multiAgentCrmSummaries = multiAgentSessions.filter((s) => s.summary?.trim()).length;
  const multiAgentFollowUpsCreated = multiAgentSessions.filter(
    (s) => s.follow_up_draft?.trim()
  ).length;
  const multiAgentCompleted = multiAgentSessions.filter((s) => s.status === "completed");
  const multiAgentWithBooking = multiAgentCompleted.filter((s) => s.booking_id).length;
  const multiAgentConversionRate =
    multiAgentCompleted.length > 0
      ? Math.round((multiAgentWithBooking / multiAgentCompleted.length) * 100)
      : 0;

  const internalCardFallbackCount = periodSessions.filter(
    (s) =>
      s.avatar_fallback_provider === "internal_card" ||
      (s.avatar_status === "fallback_active" && s.avatar_provider === "internal_card")
  ).length;

  return {
    totalDemos: periodSessions.length,
    demosToday,
    demosStarted,
    liveDemosNow,
    completedDemos,
    missedDemos,
    hotLeadsFromDemos,
    bookingsFromDemos,
    demosNeedingHandoff,
    humanTakeovers,
    demoConversionRate,
    demosWithPathSelected,
    hotLeadsAfterPath: hotAfterPath,
    mostSelectedPathTitle,
    pathSelectionCounts: pathCounts,
    liveRoomsActive,
    demosWithVideoEnabled,
    staffJoinedDemos,
    completedVideoDemos,
    videoDemosWithBookings,
    recordedDemos,
    replayViews,
    demosReviewed,
    demosWithFollowUp,
    demoToBookingConversion,
    humanTakeoverConversion,
    averageDemoDurationSeconds,
    avatarDemosStarted,
    avatarProviderFailures,
    avatarFallbackActivations,
    avatarDemoConversionRate,
    avatarDemosWithBooking,
    avatarDemosNeedingHandoff,
    tavusAvatarDemosStarted,
    tavusAvatarFailures,
    didAvatarDemosStarted,
    didAvatarFailures,
    didAvatarFallbackActivations,
    didDemoConversionRate,
    didDemosWithBooking,
    didDemosNeedingHandoff,
    providerStats,
    mostReliableProvider,
    bestConvertingProvider,
    internalCardFallbackCount,
    multiAgentDemos,
    multiAgentBookingRecommendations,
    multiAgentObjectionsDetected,
    multiAgentHandoffsRecommended,
    multiAgentCrmSummaries,
    multiAgentFollowUpsCreated,
    multiAgentConversionRate,
  };
}
