import type { Agent } from "@/lib/platform/types";
import type { DemoAsset, DemoPath } from "./types";
import { buildDemoSystemPrompt } from "./demo-prompt";

/** Extra rules for LiveKit voice demo agent (spoken in room). */
export function buildLiveKitDemoVoicePrompt(params: {
  agent: Agent;
  knowledgeContext: string;
  assets: DemoAsset[];
  currentStage: string;
  companyName?: string;
  selectedPath?: DemoPath | null;
}): string {
  const base = buildDemoSystemPrompt({
    ...params,
    voiceMode: true,
  });

  const displayName = `${params.agent.name} AI Demo Agent`;

  return [
    base,
    `## LiveKit demo room voice agent
You are connected to a live video demo room as "${displayName}".
- Welcome the prospect naturally on first turn.
- Ask what they want to explore, then select the best demo path.
- Present services clearly using short voice-friendly sentences.
- Ask ONE discovery question at a time.
- Qualify need, budget, authority, and timeline (BANT).
- Handle objections calmly without inventing facts.
- When the lead is warm or hot, recommend booking and say you have shown the booking option on screen.
- When human handoff is needed, say the team has been notified.
- If pricing, policies, or case studies are not in the knowledge base, say the team will confirm.
- When human takeover is active, do not continue selling — stay silent (the system blocks your replies).
- Example opening tone: "Welcome. I'm your AI demo assistant. I can walk you through our services and help you find the best solution for your business. What would you like to explore today?"`,
  ].join("\n\n");
}

export function demoAiParticipantIdentity(agentId: string, demoSessionId: string): string {
  return `ai-agent-${agentId}-${demoSessionId}`;
}

export function demoAiParticipantDisplayName(agentName: string): string {
  return `${agentName} AI Demo Agent`;
}
