import { logEvent } from "../analytics";
import type { AgentRole, Channel } from "../config";
import { loadKnowledgeBase } from "../knowledge";
import { appendSessionMessage } from "./conversation-log";
import { classifyCustomerIntent } from "./classify-intent";
import { retrieveKnowledgeChunks } from "./kb-retrieval";
import type { IntentClassification, OrchestratorTurnResult } from "./types";
import { mapIntentToRole } from "./types";

const orchestratorDisabled = () =>
  process.env.ORCHESTRATOR_ENABLED === "false";

function fallbackResult(
  fullKb: string,
  role: AgentRole
): OrchestratorTurnResult {
  return {
    knowledgeForPrompt: fullKb,
    effectiveRole: role,
    intent: {
      intent: "general_question",
      lead_stage: "n_a",
      brief_reason: "Orchestrator disabled or fallback.",
    },
    retrievalSectionTitles: ["(full knowledge base)"],
  };
}

export async function runOrchestratorTurn(params: {
  sessionId: string;
  channel: Channel;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  clientRole?: AgentRole;
}): Promise<OrchestratorTurnResult> {
  const fullKb = await loadKnowledgeBase();
  const requestedRole = params.clientRole ?? "unified";

  const lastUser = [...params.messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!lastUser?.content?.trim()) {
    return fallbackResult(fullKb, requestedRole);
  }

  await appendSessionMessage(
    params.sessionId,
    "user",
    lastUser.content.trim(),
    params.channel
  );

  if (orchestratorDisabled()) {
    logEvent("orchestrator_completed", params.sessionId, params.channel, {
      mode: "disabled",
    });
    return fallbackResult(fullKb, requestedRole);
  }

  let intent: IntentClassification;
  try {
    intent = await classifyCustomerIntent({
      latestUserMessage: lastUser.content,
      recentMessages: params.messages,
    });
  } catch {
    intent = {
      intent: "general_question",
      lead_stage: "n_a",
      brief_reason: "Classification failed; defaulted.",
    };
  }

  logEvent("intent_classified", params.sessionId, params.channel, {
    intent: intent.intent,
    lead_stage: intent.lead_stage,
    inferred_service: intent.inferred_service,
  });

  const retrieved = retrieveKnowledgeChunks({
    fullMarkdown: fullKb,
    userMessage: lastUser.content,
    intent: intent.intent,
  });

  logEvent("knowledge_retrieved", params.sessionId, params.channel, {
    sections: retrieved.sectionTitles,
    chars: retrieved.text.length,
  });

  const effectiveRole = mapIntentToRole(intent.intent, requestedRole);

  logEvent("orchestrator_completed", params.sessionId, params.channel, {
    intent: intent.intent,
    effectiveRole,
    sections: retrieved.sectionTitles,
  });

  const MIN_CHARS = 900;
  let knowledgeForPrompt =
    retrieved.text.length >= MIN_CHARS
      ? retrieved.text
      : `${retrieved.text}\n\n--- Full company knowledge (reference) ---\n\n${fullKb.slice(0, 14_000)}`;

  return {
    knowledgeForPrompt,
    effectiveRole,
    intent,
    retrievalSectionTitles: retrieved.sectionTitles,
  };
}
