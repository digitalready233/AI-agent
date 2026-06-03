import { getLead, saveLead } from "@/lib/platform/data";
import { getDemoSession, saveDemoSession } from "./demo-data";
import { safeRecordDemoTimeline } from "./demo-timeline-helpers";

/**
 * Attach a completed booking to the demo session and refresh lead CRM fields.
 */
export async function linkBookingToDemoSession(params: {
  demoSessionId: string;
  bookingId: string;
  organizationId: string;
}): Promise<void> {
  const demo = await getDemoSession(params.demoSessionId);
  if (!demo || demo.organization_id !== params.organizationId) {
    return;
  }

  const now = new Date().toISOString();
  await saveDemoSession({
    ...demo,
    booking_id: params.bookingId,
    booking_recommended: true,
    recommended_next_action: "Meeting booked from demo",
    updated_at: now,
    metadata: {
      ...(demo.metadata ?? {}),
      booking_linked_at: now,
    },
  });

  await safeRecordDemoTimeline({
    demoSessionId: params.demoSessionId,
    organizationId: params.organizationId,
    eventType: "booking_created",
    title: "Booking created",
    metadata: { booking_id: params.bookingId },
  });

  if (demo.lead_id) {
    const lead = await getLead(demo.lead_id);
    if (lead) {
      const noteLine = `Demo booking confirmed (${now.slice(0, 10)}).`;
      await saveLead({
        ...lead,
        lead_status:
          lead.lead_status === "created" || lead.lead_status === "open"
            ? "qualified"
            : lead.lead_status,
        notes: [lead.notes, noteLine].filter(Boolean).join("\n\n"),
        updated_at: now,
      });
    }
  }
}
