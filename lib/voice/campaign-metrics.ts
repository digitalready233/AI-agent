import { listQueueForCampaign } from "./outbound-queue-data";
import { listCalls } from "./call-data";
import type { CallOutcome, CallRecord } from "./types";

export type VoiceCampaignResults = {
  campaignId: string;
  totalLeads: number;
  dialed: number;
  inProgress: number;
  completed: number;
  failed: number;
  answered: number;
  noAnswer: number;
  busy: number;
  voicemail: number;
  qualified: number;
  notInterested: number;
  booked: number;
  humanTransfers: number;
  doNotCall: number;
  hotLeads: number;
  withSummary: number;
  conversionRate: number;
  queuePending: number;
  queueExhausted: number;
  recentCalls: CallRecord[];
  queueOutcomes: Partial<Record<CallOutcome, number>>;
};

function isCampaignCall(call: CallRecord, campaignId: string): boolean {
  if (call.call_type === "campaign" && call.metadata?.campaign_id === campaignId) {
    return true;
  }
  return call.metadata?.campaign_id === campaignId;
}

function outcomeOf(call: CallRecord): CallOutcome | null {
  if (call.call_outcome) return call.call_outcome;
  if (call.status === "completed") return "answered";
  if (call.status === "no_answer") return "no_answer";
  if (call.status === "busy") return "busy";
  if (call.status === "failed") return "failed";
  return null;
}

export async function getVoiceCampaignResults(
  organizationId: string,
  campaignId: string
): Promise<VoiceCampaignResults> {
  const all = await listCalls(organizationId);
  const calls = all
    .filter((c) => isCampaignCall(c, campaignId))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const queue = await listQueueForCampaign(campaignId);

  const countOutcome = (o: CallOutcome) =>
    calls.filter((c) => outcomeOf(c) === o).length +
    queue.filter((q) => q.call_outcome === o).length;

  const completed = calls.filter((c) => c.status === "completed");
  const failed = calls.filter((c) =>
    ["failed", "no_answer", "busy", "canceled"].includes(c.status)
  );
  const inProgress = calls.filter((c) =>
    ["initiated", "ringing", "in_progress"].includes(c.status)
  );

  const qualified = countOutcome("qualified");
  const hotLeads = calls.filter((c) =>
    (c.lead_category ?? "").toLowerCase().includes("hot")
  );
  const bookings = countOutcome("booked");
  const humanTransfers = countOutcome("human_transfer");
  const withSummary = calls.filter((c) => Boolean(c.summary?.trim()));

  const answered = countOutcome("answered");
  const conversionRate = calls.length
    ? Math.round(((qualified + bookings) / calls.length) * 100)
    : 0;

  const queueOutcomes: Partial<Record<CallOutcome, number>> = {};
  for (const q of queue) {
    if (q.call_outcome) {
      queueOutcomes[q.call_outcome] = (queueOutcomes[q.call_outcome] ?? 0) + 1;
    }
  }

  return {
    campaignId,
    totalLeads: queue.length || calls.length,
    dialed: calls.length,
    inProgress: inProgress.length,
    completed: completed.length,
    failed: failed.length,
    answered,
    noAnswer: countOutcome("no_answer"),
    busy: countOutcome("busy"),
    voicemail: countOutcome("voicemail"),
    qualified,
    notInterested: countOutcome("not_interested"),
    booked: bookings,
    humanTransfers,
    doNotCall: countOutcome("do_not_call"),
    hotLeads: hotLeads.length,
    withSummary: withSummary.length,
    conversionRate,
    queuePending: queue.filter((q) => q.status === "pending").length,
    queueExhausted: queue.filter((q) => q.status === "exhausted").length,
    recentCalls: calls.slice(0, 20),
    queueOutcomes,
  };
}

export async function getOutboundVoiceDashboardMetrics(
  organizationId: string,
  periodCalls: CallRecord[]
): Promise<{
  outboundStarted: number;
  answered: number;
  failed: number;
  qualified: number;
  bookings: number;
  humanTransfers: number;
  conversionRate: number;
}> {
  const outbound = periodCalls.filter((c) => c.direction === "outbound");
  const campaignOutbound = outbound.filter(
    (c) => c.call_type === "campaign" || c.metadata?.campaign_id
  );

  const answered = campaignOutbound.filter(
    (c) =>
      c.call_outcome === "answered" ||
      c.call_outcome === "qualified" ||
      c.call_outcome === "booked" ||
      c.status === "completed"
  ).length;

  const failed = campaignOutbound.filter(
    (c) =>
      c.call_outcome === "failed" ||
      c.call_outcome === "no_answer" ||
      c.call_outcome === "busy" ||
      ["failed", "no_answer", "busy"].includes(c.status)
  ).length;

  const qualified = campaignOutbound.filter(
    (c) => c.call_outcome === "qualified" || c.lead_category === "hot"
  ).length;

  const bookings = campaignOutbound.filter(
    (c) =>
      c.call_outcome === "booked" ||
      Boolean((c.metadata as { booking_id?: string })?.booking_id)
  ).length;

  const humanTransfers = campaignOutbound.filter(
    (c) =>
      c.call_outcome === "human_transfer" ||
      c.handoff_required ||
      c.status === "transferred"
  ).length;

  const conversionRate = campaignOutbound.length
    ? Math.round(((qualified + bookings) / campaignOutbound.length) * 100)
    : 0;

  return {
    outboundStarted: campaignOutbound.length,
    answered,
    failed,
    qualified,
    bookings,
    humanTransfers,
    conversionRate,
  };
}
