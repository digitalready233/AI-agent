import type { WorkflowAnalysis } from "./schemas";
import { READYBOT_RESPONSE_CONTRACT } from "@/lib/platform/playbooks/readybot-response-contract";
import { workflowGenerateText } from "./llm-invoke";
import {
  isReadybotStyleAgent,
  readybotStageDirective,
} from "./readybot-stage-directives";
import type { WorkflowRuntimeContext } from "./workflow-context";

function missingLeadFields(
  extraction: WorkflowAnalysis["lead_extraction"]
): string[] {
  const checks: [string, string | undefined][] = [
    ["name", extraction.full_name],
    ["phone", extraction.phone],
    ["email", extraction.email],
    ["business", extraction.business_name],
    ["service pillar", extraction.service_interest],
    ["budget tier", extraction.budget_tier ?? extraction.budget],
    ["timeline", extraction.timeline],
  ];
  return checks.filter(([, v]) => !v?.trim()).map(([k]) => k);
}

export async function generateWorkflowResponse(params: {
  ctx: WorkflowRuntimeContext;
  customerMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  knowledgeContext: string;
  analysis: WorkflowAnalysis;
  handoffRequired: boolean;
  suggestBooking: boolean;
  bookingProvider?: "internal" | "google_calendar" | "calendly" | null;
  preferredDateTime?: string | null;
}): Promise<string> {
  const { ctx, analysis, handoffRequired, suggestBooking, bookingProvider, preferredDateTime } =
    params;
  const { agent, effective } = ctx;

  const systemParts = [
    agent.system_prompt ??
      `You are ${agent.name}, a helpful ${agent.agent_type} agent for ${agent.company_product_name ?? "the company"}.`,
    effective.qualification_prompt && `Qualification:\n${effective.qualification_prompt}`,
    effective.objection_prompt && `Objection handling:\n${effective.objection_prompt}`,
    effective.handoff_rules && `Handoff rules:\n${effective.handoff_rules}`,
    effective.booking_rules && `Booking rules:\n${effective.booking_rules}`,
    effective.crm_update_rules && `CRM update rules:\n${effective.crm_update_rules}`,
    effective.fallback_response && `Fallback:\n${effective.fallback_response}`,
    params.knowledgeContext && `Knowledge base:\n${params.knowledgeContext}`,
    `\nCurrent intent: ${analysis.detected_intent}`,
    `Conversation stage: ${analysis.conversation_stage}`,
    `Recommended next action (internal): ${analysis.recommended_next_action}`,
    handoffRequired
      ? `IMPORTANT: ${effective.handoff_message} A human teammate will follow up. Acknowledge warmly; do not pretend you are human.`
      : "",
    suggestBooking
      ? `${effective.booking_message || "Next step: a quick strategy call."} Lead is warm/hot. Invite scheduler in chat — max 2 sentences. Example: "**Book a strategy call** — pick a time below."${preferredDateTime ? ` They suggested: ${preferredDateTime}.` : ""} No invented slots.`
      : "",
    `Tone: ${effective.tone}. Language: ${effective.language}.`,
    `Welcome style: ${effective.welcome_message}`,
    isReadybotStyleAgent(agent)
      ? readybotStageDirective(
          analysis.conversation_stage,
          missingLeadFields(analysis.lead_extraction)
        )
      : "",
    isReadybotStyleAgent(agent) ? READYBOT_RESPONSE_CONTRACT : "",
    `## Rules
- Professional AI sales assistant.${isReadybotStyleAgent(agent) ? " Follow ReadyBot response contract above — no long paragraphs." : " Concise (2–4 short paragraphs)."}
- Use ONLY knowledge base facts for product, pricing, policies, timelines.
- If information is missing, say so — use fallback when provided; never invent.
- Collect lead details naturally when relevant.
- Do not claim to be human.`,
  ].filter(Boolean);

  const messages = [
    ...params.history.slice(-12).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: params.customerMessage },
  ];

  const text = await workflowGenerateText({
    label: "respond",
    system: systemParts.join("\n\n"),
    messages,
    maxTokens: isReadybotStyleAgent(agent) ? 120 : 900,
    temperature: isReadybotStyleAgent(agent) ? 0.35 : 0.6,
  });

  return (
    text.trim() ||
    effective.fallback_response ||
    "Thanks for your message — how can I help you today?"
  );
}
