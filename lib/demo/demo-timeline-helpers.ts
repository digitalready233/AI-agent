import { recordDemoTimelineEvent } from "./demo-timeline-data";
import type { DemoTimelineEventType } from "./types";

/** Record a timeline event; failures are logged and do not throw. */
export async function safeRecordDemoTimeline(params: {
  demoSessionId: string;
  organizationId: string;
  eventType: DemoTimelineEventType | string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await recordDemoTimelineEvent(params);
  } catch (e) {
    console.warn("[demo-timeline] save failed", params.eventType, e);
  }
}

export async function recordLeadCategoryTimeline(params: {
  demoSessionId: string;
  organizationId: string;
  previousCategory: string | null | undefined;
  nextCategory: string | null;
}) {
  const { previousCategory, nextCategory } = params;
  if (!nextCategory || nextCategory === previousCategory) return;
  if (nextCategory === "hot") {
    await safeRecordDemoTimeline({
      ...params,
      eventType: "lead_became_hot",
      title: "Lead became hot",
      metadata: { previous: previousCategory, category: nextCategory },
    });
  } else if (nextCategory === "warm") {
    await safeRecordDemoTimeline({
      ...params,
      eventType: "lead_became_warm",
      title: "Lead became warm",
      metadata: { previous: previousCategory, category: nextCategory },
    });
  }
}
