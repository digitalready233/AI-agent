import type { Booking, Campaign, Conversation, Lead } from "./types";

export type DashboardPeriod = "7d" | "30d" | "90d" | "all";

export const DASHBOARD_PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function parseDashboardPeriod(value: string | undefined): DashboardPeriod {
  if (value === "7d" || value === "30d" || value === "90d" || value === "all") {
    return value;
  }
  return "30d";
}

export function getPeriodStart(period: DashboardPeriod): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start;
}

export function isWithinPeriod(isoDate: string, period: DashboardPeriod): boolean {
  const start = getPeriodStart(period);
  if (!start) return true;
  return new Date(isoDate) >= start;
}

export function isHotLeadCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const n = category.toLowerCase().replace(/\s+/g, "_");
  return n === "hot" || n === "hot_lead";
}

const TERMINAL_LEAD_STATUSES = new Set(["customer", "disqualified"]);

export function isPendingFollowUp(lead: Lead): boolean {
  if (!lead.follow_up_date) return false;
  if (lead.lead_status && TERMINAL_LEAD_STATUSES.has(lead.lead_status)) return false;
  return true;
}

export function isFollowUpDue(lead: Lead): boolean {
  if (!lead.follow_up_date) return false;
  if (lead.lead_status && TERMINAL_LEAD_STATUSES.has(lead.lead_status)) return false;
  const due = new Date(lead.follow_up_date);
  due.setHours(23, 59, 59, 999);
  return due <= new Date();
}

export function isAiResolvedConversation(c: Conversation): boolean {
  return c.status === "resolved" || c.status === "closed";
}

export function computeDashboardStatsFromRows(
  leads: Lead[],
  conversations: Conversation[],
  bookings: Booking[],
  period: DashboardPeriod,
  campaigns: Campaign[] = [],
  campaignMetrics?: {
    messagesSent: number;
    replies: number;
    failed: number;
    bookingConversions: number;
    topCampaignName: string | null;
  },
  voiceMetrics?: {
    totalCalls: number;
    callsToday: number;
    completedCalls: number;
    missedCalls: number;
    averageCallDurationSeconds: number;
    hotLeadsFromCalls: number;
    bookingsFromCalls: number;
    humanTransfers: number;
    callConversionRate: number;
  },
  demoMetrics?: {
    totalDemos: number;
    demosToday: number;
    liveDemosNow: number;
    completedDemos: number;
    missedDemos: number;
    hotLeadsFromDemos: number;
    bookingsFromDemos: number;
    demosNeedingHandoff: number;
    humanTakeovers: number;
    demoConversionRate: number;
    demosStarted?: number;
    demosWithPathSelected?: number;
    hotLeadsAfterPath?: number;
    mostSelectedPathTitle?: string | null;
    liveRoomsActive?: number;
    demosWithVideoEnabled?: number;
    staffJoinedDemos?: number;
    completedVideoDemos?: number;
    videoDemosWithBookings?: number;
  }
) {
  const periodLeads = leads.filter((l) => isWithinPeriod(l.created_at, period));
  const qualifiedLeads = leads.filter((l) => l.lead_status === "qualified").length;
  const hotLeads = leads.filter((l) => isHotLeadCategory(l.lead_category)).length;
  const humanHandoffs = conversations.filter((c) => c.status === "human_needed").length;
  const aiResolved = conversations.filter(isAiResolvedConversation).length;
  const totalConversations = conversations.length;
  const bookedMeetings = bookings.filter(
    (b) =>
      (b.status === "scheduled" || b.status === "confirmed") &&
      isWithinPeriod(b.created_at, period)
  ).length;
  const periodQualified = leads.filter(
    (l) => l.lead_status === "qualified" && isWithinPeriod(l.updated_at, period)
  ).length;
  const bookingRate = periodQualified
    ? Math.round((bookedMeetings / periodQualified) * 100)
    : bookedMeetings > 0
      ? 100
      : 0;
  const pendingFollowUps = leads.filter(isPendingFollowUp).length;
  const followUpsDue = leads.filter(isFollowUpDue).length;
  const activeCampaigns = campaigns.filter((c) =>
    c.status === "live" || c.status === "scheduled"
  ).length;
  const revenueOpportunity = leads.filter(
    (l) =>
      isHotLeadCategory(l.lead_category) ||
      l.lead_status === "qualified" ||
      l.lead_status === "opportunity_created"
  ).length;

  const aiResolutionRate = totalConversations
    ? Math.round((aiResolved / totalConversations) * 100)
    : 0;

  const conversionRate = leads.length
    ? Math.round((qualifiedLeads / leads.length) * 100)
    : 0;

  return {
    totalConversations,
    newLeads: periodLeads.length,
    qualifiedLeads,
    hotLeads,
    bookedMeetings,
    bookingRate,
    pendingFollowUps,
    followUpsDue,
    humanHandoffs,
    activeCampaigns,
    campaignMessagesSent: campaignMetrics?.messagesSent ?? 0,
    campaignReplies: campaignMetrics?.replies ?? 0,
    campaignBookingConversions: campaignMetrics?.bookingConversions ?? 0,
    campaignFailedMessages: campaignMetrics?.failed ?? 0,
    topCampaignName: campaignMetrics?.topCampaignName ?? null,
    aiResolutionRate,
    conversionRate,
    revenueOpportunity,
    totalCalls: voiceMetrics?.totalCalls ?? 0,
    callsToday: voiceMetrics?.callsToday ?? 0,
    completedCalls: voiceMetrics?.completedCalls ?? 0,
    missedCalls: voiceMetrics?.missedCalls ?? 0,
    averageCallDurationSeconds: voiceMetrics?.averageCallDurationSeconds ?? 0,
    hotLeadsFromCalls: voiceMetrics?.hotLeadsFromCalls ?? 0,
    bookingsFromCalls: voiceMetrics?.bookingsFromCalls ?? 0,
    humanTransfersFromCalls: voiceMetrics?.humanTransfers ?? 0,
    callConversionRate: voiceMetrics?.callConversionRate ?? 0,
    totalDemos: demoMetrics?.totalDemos ?? 0,
    demosToday: demoMetrics?.demosToday ?? 0,
    liveDemosNow: demoMetrics?.liveDemosNow ?? 0,
    completedDemos: demoMetrics?.completedDemos ?? 0,
    missedDemos: demoMetrics?.missedDemos ?? 0,
    hotLeadsFromDemos: demoMetrics?.hotLeadsFromDemos ?? 0,
    bookingsFromDemos: demoMetrics?.bookingsFromDemos ?? 0,
    demosNeedingHandoff: demoMetrics?.demosNeedingHandoff ?? 0,
    humanTakeoversFromDemos: demoMetrics?.humanTakeovers ?? 0,
    demoConversionRate: demoMetrics?.demoConversionRate ?? 0,
    demosStarted: demoMetrics?.demosStarted ?? 0,
    demosWithPathSelected: demoMetrics?.demosWithPathSelected ?? 0,
    hotLeadsAfterPath: demoMetrics?.hotLeadsAfterPath ?? 0,
    mostSelectedDemoPath: demoMetrics?.mostSelectedPathTitle ?? null,
    liveRoomsActive: demoMetrics?.liveRoomsActive ?? 0,
    demosWithVideoEnabled: demoMetrics?.demosWithVideoEnabled ?? 0,
    staffJoinedDemos: demoMetrics?.staffJoinedDemos ?? 0,
    completedVideoDemos: demoMetrics?.completedVideoDemos ?? 0,
    videoDemosWithBookings: demoMetrics?.videoDemosWithBookings ?? 0,
  };
}

/** Last N calendar days (within period) with conversation counts by created_at date */
export function groupConversationsByDate(
  conversations: Conversation[],
  period: DashboardPeriod,
  dayCount = 7
): { day: string; date: string; conversations: number }[] {
  const start = getPeriodStart(period);
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const buckets: { day: string; date: string; conversations: number }[] = [];

  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    if (start && d < start) continue;

    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    buckets.push({ day: label, date: key, conversations: 0 });
  }

  const indexByDate = new Map(buckets.map((b, i) => [b.date, i]));

  for (const c of conversations) {
    const key = c.created_at.slice(0, 10);
    const idx = indexByDate.get(key);
    if (idx !== undefined) {
      buckets[idx].conversations += 1;
    }
  }

  return buckets;
}

/** Distinct lead sources from data, sorted by count */
export function groupLeadsBySource(leads: Lead[]): { source: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const source = (l.source?.trim() || "unknown").toLowerCase();
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export function sortLeadsRecent(leads: Lead[]): Lead[] {
  return [...leads].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function sortConversationsRecent(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}
