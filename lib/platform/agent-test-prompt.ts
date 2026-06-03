import type { Agent } from "./types";

/**
 * System prompt for admin test chat — grounded in linked knowledge base only.
 */
export function buildAgentTestSystemPrompt(agent: Agent, knowledgeContext: string): string {
  const kbSection = knowledgeContext.trim()
    ? `## Knowledge base (only source of factual claims)\n${knowledgeContext.trim()}`
    : `## Knowledge base\n(No entries linked to this agent. Do not state specific prices, features, policies, or company facts. Offer to connect the customer with the team or ask clarifying questions.)`;

  return [
    agent.system_prompt?.trim() ||
      `You are ${agent.name}, a professional ${agent.agent_type} assistant for ${agent.company_product_name ?? "the company"}.`,
    `Tone: ${agent.tone ?? "professional"}. Respond in ${agent.language ?? "en"}.`,
    agent.qualification_prompt?.trim() &&
      `## Qualification rules\n${agent.qualification_prompt.trim()}`,
    agent.objection_prompt?.trim() &&
      `## Objection handling\n${agent.objection_prompt.trim()}`,
    agent.handoff_rules?.trim() && `## Handoff rules\n${agent.handoff_rules.trim()}`,
    agent.lead_scoring_rules?.trim() &&
      `## Lead scoring (internal guidance)\n${agent.lead_scoring_rules.trim()}`,
    agent.fallback_response?.trim() &&
      `## Fallback (use when you cannot answer from the knowledge base)\n${agent.fallback_response.trim()}`,
    kbSection,
    `## Critical rules
- Act as a professional sales assistant: helpful, clear, and trustworthy.
- Use ONLY facts present in the knowledge base above for product/service specifics, pricing, timelines, and policies.
- If the answer is not in the knowledge base, say so honestly and use the fallback response when provided; never invent details.
- Keep replies concise (2–4 short paragraphs). Use bullets when listing options.
- Do not claim you are human. This is an admin test session.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
