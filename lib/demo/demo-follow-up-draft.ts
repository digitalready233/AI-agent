import type { DemoSession } from "./types";
import type { Lead } from "@/lib/platform/types";

export function buildDemoFollowUpDraft(params: {
  session: DemoSession;
  lead?: Lead | null;
  agentName?: string;
  companyName?: string;
  bookingUrl?: string | null;
}): string {
  const { session, lead, agentName, companyName, bookingUrl } = params;
  const name = lead?.full_name?.trim() || "there";
  const interest =
    lead?.service_interest?.trim() ||
    session.detected_intent?.trim() ||
    "our solution";
  const next =
    session.recommended_next_action?.trim() ||
    (session.booking_id ? "Your booking is confirmed — see details below." : "Book a follow-up call when you're ready.");

  const lines = [
    `Hi ${name},`,
    "",
    `Thank you for joining today's demo${companyName ? ` with ${companyName}` : ""}.`,
    "",
    `Based on our conversation, you showed interest in ${interest}.`,
    session.summary
      ? `\nQuick recap: ${session.summary.slice(0, 400)}${session.summary.length > 400 ? "…" : ""}`
      : "",
    "",
    `Recommended next step: ${next}`,
  ];

  if (session.booking_id && bookingUrl) {
    lines.push("", `Booking: ${bookingUrl}`);
  } else if (bookingUrl) {
    lines.push("", `Schedule here: ${bookingUrl}`);
  }

  lines.push(
    "",
    `Best regards,`,
    agentName?.trim() ? agentName : "The team"
  );

  return lines.filter(Boolean).join("\n");
}

export function followUpDueHoursForCategory(category: string | null | undefined): number {
  switch (category) {
    case "hot":
      return 1;
    case "warm":
      return 24;
    case "cold":
      return 72;
    default:
      return 48;
  }
}
