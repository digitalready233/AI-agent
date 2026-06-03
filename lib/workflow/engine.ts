import { logEvent } from "../analytics";
import type { AgentRole, Channel } from "../config";
import { ensureChatMemoryHydrated } from "../chat-memory";
import { ensureLeadsHydrated, getLeadBySession, upsertLead } from "../store";
import { appendSessionMessage, getSessionLog } from "../orchestrator/conversation-log";
import { runOrchestratorTurn } from "../orchestrator/run-turn";
import type { OrchestratorTurnResult } from "../orchestrator/types";
import { ensureDraftLeadForIntent } from "./auto-lead";
import { ensureSupportLead } from "./intent-lead-status";
import { getIntegrationReadiness } from "./integrations";
import { analyzeLeadProfile, buildLeadCollectionHint } from "./lead-profile";
import { buildRollingConversationSummary } from "./summary";
import { resolveConversationStage } from "./stage-engine";
import { getWorkflowState, upsertWorkflowState } from "./session-state";
import type { WorkflowTurnResult } from "./types";

const workflowDisabled = () => process.env.WORKFLOW_ENGINE_ENABLED === "false";

function fromOrchestratorOnly(
  orch: OrchestratorTurnResult,
  sessionId: string,
  channel: Channel
): WorkflowTurnResult {
  const lead = getLeadBySession(sessionId);
  const gaps = analyzeLeadProfile(lead);
  const state = upsertWorkflowState(sessionId, channel, {
    conversationStage: "discovery",
    lastIntent: orch.intent.intent,
    conversationSummary: "",
  });
  return {
    knowledgeForPrompt: orch.knowledgeForPrompt,
    effectiveRole: orch.effectiveRole,
    intent: orch.intent,
    retrievalSectionTitles: orch.retrievalSectionTitles,
    conversationStage: state.conversationStage,
    leadGaps: gaps,
    sessionState: state,
    lead,
    leadCollectionHint: buildLeadCollectionHint(gaps),
    integrationsReady: getIntegrationReadiness(),
  };
}

/**
 * AI Agent Workflow Engine — runs after each customer message (website, WhatsApp, voice).
 * 1. Persist message → 2. Classify intent → 3. Search KB → 4. Advance funnel stage
 * 5. Draft/update lead → 6. Build prompt context → 7. Hand off to OpenAI + tools
 */
export async function runWorkflowTurn(params: {
  sessionId: string;
  channel: Channel;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  clientRole?: AgentRole;
}): Promise<WorkflowTurnResult> {
  await Promise.all([ensureLeadsHydrated(), ensureChatMemoryHydrated()]);

  const orch = await runOrchestratorTurn({
    sessionId: params.sessionId,
    channel: params.channel,
    messages: params.messages,
    clientRole: params.clientRole,
  });

  if (workflowDisabled()) {
    return fromOrchestratorOnly(orch, params.sessionId, params.channel);
  }

  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  const log = getSessionLog(params.sessionId);
  const isFirstUserMessage =
    log.filter((m) => m.role === "user").length <= 1 && Boolean(lastUser);

  await ensureSupportLead({
    sessionId: params.sessionId,
    channel: params.channel,
    intent: orch.intent.intent,
  });

  const lead = await ensureDraftLeadForIntent({
    sessionId: params.sessionId,
    channel: params.channel,
    intent: orch.intent.intent,
    inferredService: orch.intent.inferred_service,
  });

  const previous = getWorkflowState(params.sessionId);
  const conversationStage = resolveConversationStage({
    isFirstUserMessage,
    intent: orch.intent.intent,
    lead: lead ?? getLeadBySession(params.sessionId),
    previousStage: previous?.conversationStage,
  });

  const summary = buildRollingConversationSummary({
    sessionId: params.sessionId,
    intent: orch.intent.intent,
    stage: conversationStage,
    inferredService: orch.intent.inferred_service,
  });

  const sessionState = upsertWorkflowState(params.sessionId, params.channel, {
    conversationStage,
    lastIntent: orch.intent.intent,
    conversationSummary: summary,
  });

  let currentLead = getLeadBySession(params.sessionId);
  if (currentLead) {
    currentLead = upsertLead({
      ...currentLead,
      conversationSummary: summary,
      conversationStage,
      lastIntent: orch.intent.intent,
      updatedAt: new Date().toISOString(),
    });
  }

  const leadGaps = analyzeLeadProfile(currentLead);
  const leadCollectionHint = buildLeadCollectionHint(leadGaps);

  logEvent("workflow_stage_updated", params.sessionId, params.channel, {
    stage: conversationStage,
    intent: orch.intent.intent,
    leadCompleteness: leadGaps.completenessPercent,
  });

  logEvent("conversation_summary_saved", params.sessionId, params.channel, {
    chars: summary.length,
    stage: conversationStage,
  });

  logEvent("workflow_completed", params.sessionId, params.channel, {
    intent: orch.intent.intent,
    stage: conversationStage,
    effectiveRole: orch.effectiveRole,
    kbSections: orch.retrievalSectionTitles,
  });

  return {
    knowledgeForPrompt: orch.knowledgeForPrompt,
    effectiveRole: orch.effectiveRole,
    intent: orch.intent,
    retrievalSectionTitles: orch.retrievalSectionTitles,
    conversationStage,
    leadGaps,
    sessionState,
    lead: currentLead,
    leadCollectionHint,
    integrationsReady: getIntegrationReadiness(),
  };
}

/** Call after assistant reply is finalized to append to session log (if not already). */
export async function recordAssistantTurn(
  sessionId: string,
  channel: Channel,
  text: string
): Promise<void> {
  await appendSessionMessage(sessionId, "assistant", text, channel);
}
