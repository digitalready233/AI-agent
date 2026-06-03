import { workflowGenerateText } from "@/lib/platform/workflow/llm-invoke";
import type { DemoAnalysis } from "./demo-schemas";
import type { DemoAsset } from "./types";

export async function generateDemoResponse(params: {
  systemPrompt: string;
  customerMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  analysis: DemoAnalysis;
  nextAsset: DemoAsset | null;
  handoffRequired: boolean;
  suggestBooking: boolean;
  handoffMessage?: string;
  bookingMessage?: string;
  voiceMode?: boolean;
}): Promise<string> {
  const {
    systemPrompt,
    analysis,
    nextAsset,
    handoffRequired,
    suggestBooking,
    handoffMessage,
    bookingMessage,
    voiceMode,
  } = params;

  const extra = [
    `Intent: ${analysis.detected_intent}`,
    `Stage: ${analysis.current_demo_stage}`,
    nextAsset
      ? `Guide the prospect to this demo content next: "${nextAsset.title}" — ${nextAsset.content.slice(0, 300)}`
      : "",
    handoffRequired
      ? `IMPORTANT: ${handoffMessage ?? "A team member will join shortly."} Acknowledge warmly.`
      : "",
    suggestBooking
      ? `${bookingMessage ?? "Based on what you shared, scheduling a consultation is the best next step."} Invite them to use the booking panel in the demo room.`
      : "",
    voiceMode
      ? `VOICE MODE (spoken aloud):
- 2–3 short sentences maximum. One question only.
- Conversational tone. Do not read long lists or paragraphs.
- Mention the on-screen slide briefly by title if presenting.
- Never invent pricing or policies.
- If unsure, offer human assistance.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages = [
    ...params.history.slice(-12).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: params.customerMessage },
  ];

  return workflowGenerateText({
    label: "demo-respond",
    system: `${systemPrompt}\n\n${extra}`,
    messages,
    maxTokens: voiceMode ? 220 : 400,
  });
}
