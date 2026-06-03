import { getSessionLog } from "../orchestrator/conversation-log";
import type { CustomerIntent } from "../orchestrator/types";
import { intentLabel, stageLabel, type ConversationStage } from "./types";

/** Rolling conversation summary for CRM / dashboard (no extra LLM call). */
export function buildRollingConversationSummary(params: {
  sessionId: string;
  intent: CustomerIntent;
  stage: ConversationStage;
  inferredService?: string;
}): string {
  const log = getSessionLog(params.sessionId);
  const userLines = log
    .filter((m) => m.role === "user")
    .slice(-6)
    .map((m) => `Customer: ${m.content.slice(0, 280)}`);
  const agentLines = log
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => `Agent: ${m.content.slice(0, 200)}`);

  const header = [
    `Intent: ${intentLabel(params.intent)}`,
    `Stage: ${stageLabel(params.stage)}`,
    params.inferredService ? `Service interest: ${params.inferredService}` : null,
    `Updated: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const body = [...userLines, ...agentLines].join("\n");
  return body ? `${header}\n\n${body}` : header;
}
