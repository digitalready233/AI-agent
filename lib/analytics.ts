import type { AnalyticsEvent, AnalyticsEventType, Channel } from "./types";

const events: AnalyticsEvent[] = [];

export function logEvent(
  type: AnalyticsEventType,
  sessionId: string,
  channel: Channel = "website",
  metadata?: Record<string, unknown>
): AnalyticsEvent {
  const event: AnalyticsEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    sessionId,
    channel,
    createdAt: new Date().toISOString(),
    metadata,
  };
  events.push(event);
  return event;
}

export function getAnalyticsSummary() {
  const leads = events.filter((e) => e.type === "lead_saved").length;
  const hot = events.filter(
    (e) => e.type === "lead_scored" && e.metadata?.category === "Hot Lead"
  ).length;
  const warm = events.filter(
    (e) => e.type === "lead_scored" && e.metadata?.category === "Warm Lead"
  ).length;
  const cold = events.filter(
    (e) => e.type === "lead_scored" && e.metadata?.category === "Cold Lead"
  ).length;
  const bookings = events.filter((e) => e.type === "appointment_booked").length;
  const escalations = events.filter((e) => e.type === "escalation").length;
  const followUps = events.filter(
    (e) => e.type === "follow_up_scheduled"
  ).length;
  const conversations = events.filter(
    (e) => e.type === "conversation_started"
  ).length;

  const intentSignals = events.filter(
    (e) => e.type === "intent_classified"
  ).length;
  const hotAlerts = events.filter((e) => e.type === "hot_lead_alert").length;
  const workflowTurns = events.filter((e) => e.type === "workflow_completed").length;
  const humanAlerts = events.filter(
    (e) => e.type === "human_attention_alert"
  ).length;

  return {
    conversations,
    leads,
    hotLeads: hot,
    warmLeads: warm,
    coldLeads: cold,
    bookings,
    escalations,
    followUps,
    intentClassifications: intentSignals,
    hotLeadAlerts: hotAlerts,
    workflowTurns,
    humanAttentionAlerts: humanAlerts,
    totalEvents: events.length,
    recentEvents: [...events].slice(-50).reverse(),
  };
}

export function listEvents(): AnalyticsEvent[] {
  return [...events];
}
