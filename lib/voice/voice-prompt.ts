import { voiceChannelPrompt } from "@/lib/agent/prompts/modules";
import { KNOWLEDGE_POLICY } from "@/lib/workflow/knowledge-policy";
import { getAgent, getKnowledgeContextForAgent } from "@/lib/platform/data";
import type { Agent } from "@/lib/platform/types";

const VOICE_SALES_RULES = `
VOICE AGENT RULES (mandatory)
- Speak naturally and briefly. One question at a time.
- Follow the agent's sales workflow: discover need, qualify (need, budget, authority, timeline), recommend booking when qualified.
- Use only attached knowledge base for pricing, policies, and services. Never invent pricing or company policy.
- If unsure, offer a human callback or transfer — do not guess.
- When the caller is ready to book, use checkAvailability then createBooking.
- When angry, confused, or asking for a person, use transferToHuman or notifyHumanTeam.
- End calls with saveCallSummary when the conversation wraps up.
`;

export async function buildVoiceAgentInstructions(params: {
  organizationId: string;
  agentId: string;
}): Promise<string> {
  const agent = await getAgent(params.agentId);
  if (!agent || agent.organization_id !== params.organizationId) {
    throw new Error("Agent not found");
  }

  const knowledge = await getKnowledgeContextForAgent(
    params.agentId,
    params.organizationId,
    { strict: false }
  );

  const parts = [
    `You are ${agent.nickname ?? agent.name}, a voice sales assistant.`,
    agent.system_prompt?.trim() || "",
    agent.qualification_prompt?.trim()
      ? `QUALIFICATION:\n${agent.qualification_prompt}`
      : "",
    agent.objection_prompt?.trim()
      ? `OBJECTIONS:\n${agent.objection_prompt}`
      : "",
    agent.handoff_rules?.trim() ? `HANDOFF:\n${agent.handoff_rules}` : "",
    agent.booking_rules?.trim() ? `BOOKING:\n${agent.booking_rules}` : "",
    voiceChannelPrompt,
    VOICE_SALES_RULES,
    KNOWLEDGE_POLICY,
    knowledge ? `KNOWLEDGE BASE:\n${knowledge}` : "No knowledge base attached.",
    agent.fallback_response?.trim()
      ? `FALLBACK: ${agent.fallback_response}`
      : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function openAiRealtimeVoice(agent: Agent | null, settingsVoice: string): string {
  return settingsVoice?.trim() || agent?.voice?.trim() || "alloy";
}
