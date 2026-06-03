import { listDemoMessages } from "./demo-data";
import type { DemoSession } from "./types";
import type { Lead } from "@/lib/platform/types";

export function buildStage1PlaceholderSummary(params: {
  session: DemoSession;
  lead: Lead | null;
  messages: Awaited<ReturnType<typeof listDemoMessages>>;
}): string {
  const { session, lead, messages } = params;
  const transcript = messages
    .map((m) => `${m.sender_type}: ${m.content}`)
    .join("\n");

  return [
    "Prospect:",
    lead?.full_name ?? "—",
    "",
    "Company:",
    lead?.business_name ?? "—",
    "",
    "Service/Product Interest:",
    lead?.service_interest ?? session.detected_intent ?? "—",
    "",
    "Main Need:",
    "(Captured during demo — Stage 1 summary)",
    "",
    "Budget:",
    lead?.budget ?? "—",
    "",
    "Timeline:",
    lead?.timeline ?? "—",
    "",
    "Objections:",
    "—",
    "",
    "Lead Category:",
    session.lead_category ?? lead?.lead_category ?? "—",
    "",
    "Recommended Next Action:",
    session.recommended_next_action ?? "Follow up with prospect",
    "",
    "Booking Status:",
    session.booking_id ? "Booked" : session.booking_recommended ? "Recommended" : "—",
    "",
    "Human Handoff Needed:",
    session.handoff_required ? "Yes" : "No",
    "",
    "Transcript:",
    transcript.slice(0, 4000) || "(No messages recorded)",
  ].join("\n");
}
