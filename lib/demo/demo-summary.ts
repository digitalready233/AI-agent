import { workflowGenerateText } from "@/lib/platform/workflow/llm-invoke";
import type { Lead } from "@/lib/platform/types";
import type { DemoPath, DemoSession } from "./types";
import { formatObjectionTag } from "./objection-labels";
import { formatTakeoverSummaryBlock } from "./demo-live-handoff";

export function formatDemoSummaryText(params: {
  session: DemoSession;
  lead: Lead | null;
  transcript: string;
  aiSummary?: string;
  assetsViewed?: string[];
  demoPath?: DemoPath | null;
}): string {
  const { session, lead, transcript, aiSummary, assetsViewed, demoPath } = params;
  const objections =
    session.objections?.length
      ? session.objections.map(formatObjectionTag).join(", ")
      : lead?.notes?.includes("Objections:")
        ? lead.notes
        : "—";

  const qual = session.qualification_progress;
  const qualLine = qual
    ? `Need: ${qual.need ? "yes" : "no"} · Budget: ${qual.budget ? "yes" : "no"} · Authority: ${qual.authority ? "yes" : "no"} · Timeline: ${qual.timeline ? "yes" : "no"}`
    : "—";

  const lines = [
    "Prospect:",
    lead?.full_name ?? "—",
    "",
    "Business:",
    lead?.business_name ?? "—",
    "",
    "Industry:",
    (lead as { industry?: string | null })?.industry ?? "—",
    "",
    "Service interest:",
    lead?.service_interest ?? "—",
    "",
    "Main goal:",
    (lead as { main_goal?: string | null })?.main_goal ?? session.detected_intent ?? "—",
    "",
    "Pain points:",
    (lead as { pain_points?: string | null })?.pain_points ?? "—",
    "",
    "Budget:",
    lead?.budget ?? "—",
    "",
    "Timeline:",
    lead?.timeline ?? "—",
    "",
    "Authority:",
    (lead as { authority?: string | null })?.authority ?? "—",
    "",
    "Objections:",
    objections,
    "",
    "Demo path shown:",
    demoPath?.title ?? (typeof session.metadata?.demo_path_title === "string"
      ? session.metadata.demo_path_title
      : "—"),
    "",
    "Qualification progress:",
    qualLine,
    "",
    "Assets viewed:",
    assetsViewed?.length ? assetsViewed.join(", ") : "—",
    "",
    "Lead score:",
    session.lead_score != null ? String(session.lead_score) : "—",
    "",
    "Lead category:",
    session.lead_category ?? lead?.lead_category ?? "—",
    "",
    "Booking status:",
    session.booking_id
      ? "Booked"
      : session.booking_recommended
        ? "Recommended (not yet booked)"
        : "—",
    "",
    "Human handoff:",
    session.handoff_required || session.status === "human_taken_over" ? "Yes" : "No",
    "",
    ...(session.handoff_required || session.status === "human_taken_over"
      ? ["Human takeover:", "", formatTakeoverSummaryBlock(session), ""]
      : []),
    "Recommended next action:",
    session.recommended_next_action ?? lead?.next_action ?? "—",
    "",
    "Follow-up:",
    session.booking_id
      ? "Confirm booking and send prep materials."
      : session.handoff_required
        ? "Assign owner and join live demo or call back within 1 hour."
        : session.booking_recommended
          ? "Send booking link and recap key needs from the demo."
          : "Send recap email and schedule follow-up within 48 hours.",
  ];
  if (aiSummary) {
    lines.push("", "AI summary:", aiSummary);
  } else if (transcript) {
    lines.push("", "Transcript excerpt:", transcript.slice(0, 1500));
  }
  return lines.join("\n");
}

export async function generateDemoSummaryFromTranscript(params: {
  transcript: string;
  agentName: string;
  companyName?: string;
  demoPathTitle?: string;
}): Promise<string> {
  const { transcript, agentName, companyName, demoPathTitle } = params;
  if (!transcript.trim()) {
    return "Demo ended with no transcript captured.";
  }

  return workflowGenerateText({
    label: "demo-summary",
    system: `Summarize this sales demo for CRM. Agent: ${agentName}. Company: ${companyName ?? "N/A"}.
Demo path: ${demoPathTitle ?? "general"}.
Include: prospect needs, objections, BANT qualification, demo path and assets discussed, recommended follow-up. Be factual; do not invent details.`,
    messages: [{ role: "user", content: transcript.slice(0, 12000) }],
    maxTokens: 600,
  });
}
