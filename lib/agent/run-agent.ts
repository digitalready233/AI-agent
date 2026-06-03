import { generateText, streamText } from "ai";
import { getChatModel } from "./llm-model";
import { createAgentTools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { loadKnowledgeBase } from "../knowledge";
import type { AgentRole, Channel } from "../config";
import { openaiPrompt } from "../config";
import { logEvent } from "../analytics";
import {
  ensureChatMemoryHydrated,
  resolveChatMessages,
} from "../chat-memory";
import {
  intentLabel,
  recordAssistantTurn,
  runWorkflowTurn,
  stageLabel,
} from "../workflow";
import {
  generateStoredPromptReply,
  streamStoredPromptResponse,
  useStoredOpenAIPrompt,
} from "../integrations/openai-stored-prompt";

export interface RunAgentOptions {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  sessionId: string;
  channel?: Channel;
  role?: AgentRole;
}

function workflowMetaEnabled() {
  return (
    process.env.WORKFLOW_ENGINE_ENABLED !== "false" &&
    process.env.ORCHESTRATOR_ENABLED !== "false"
  );
}

async function getExtraContext(): Promise<string | undefined> {
  if (!openaiPrompt.mergeLocalKnowledge) return undefined;
  return loadKnowledgeBase();
}

/**
 * Website chat stream.
 * If OPENAI_PROMPT_ID is set → answers from your OpenAI hosted Prompt (pmpt_…).
 * Otherwise → local playbook + knowledge/company-knowledge.md + CRM tools.
 */
export async function streamAgentResponse(
  options: RunAgentOptions
): Promise<Response> {
  const channel = options.channel ?? "website";

  await ensureChatMemoryHydrated();
  const messages = resolveChatMessages(options.sessionId, options.messages);

  if (useStoredOpenAIPrompt()) {
    const extraContext = await getExtraContext();
    return streamStoredPromptResponse({
      messages,
      sessionId: options.sessionId,
      channel,
      extraContext,
    });
  }

  const wf = await runWorkflowTurn({
    sessionId: options.sessionId,
    channel,
    messages,
    clientRole: options.role,
  });

  const workflowMeta = workflowMetaEnabled()
    ? {
        intent: wf.intent.intent,
        intent_label: intentLabel(wf.intent.intent),
        conversation_stage: wf.conversationStage,
        stage_label: stageLabel(wf.conversationStage),
        inferred_service: wf.intent.inferred_service,
        brief_reason: wf.intent.brief_reason,
        retrieval_sections: wf.retrievalSectionTitles,
        lead_completeness_percent: wf.leadGaps.completenessPercent,
        lead_fields_missing: wf.leadGaps.missing,
        lead_collection_hint: wf.leadCollectionHint,
        calendar_ready: wf.integrationsReady.calendar,
        whatsapp_ready: wf.integrationsReady.whatsapp,
        crm_ready: wf.integrationsReady.crmWebhook,
      }
    : undefined;

  const system = buildSystemPrompt({
    knowledgeBase: wf.knowledgeForPrompt,
    channel,
    role: wf.effectiveRole,
    workflowMeta,
  });
  const tools = createAgentTools(options.sessionId, channel);

  const result = streamText({
    model: getChatModel(),
    system,
    messages,
    tools,
    maxSteps: 6,
    temperature: channel === "voice" ? 0.5 : 0.7,
    onFinish: async ({ text }) => {
      const reply = text?.trim();
      if (!reply) return;
      await recordAssistantTurn(options.sessionId, channel, reply);
      logEvent("assistant_replied", options.sessionId, channel, {
        preview: reply.slice(0, 240),
      });
    },
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error) => {
      if (error instanceof Error) return error.message;
      return "Something went wrong. Please try again or ask for a team member.";
    },
  });
}

/** Non-streaming reply for WhatsApp / Twilio webhooks */
export async function generateAgentReply(
  options: RunAgentOptions
): Promise<string> {
  if (useStoredOpenAIPrompt()) {
    const extraContext = await getExtraContext();
    return generateStoredPromptReply({
      messages: options.messages,
      extraContext,
    });
  }

  const channel = options.channel ?? "whatsapp";

  await ensureChatMemoryHydrated();
  const messages = resolveChatMessages(options.sessionId, options.messages);

  const wf = await runWorkflowTurn({
    sessionId: options.sessionId,
    channel,
    messages,
    clientRole: options.role,
  });

  const workflowMeta = workflowMetaEnabled()
    ? {
        intent: wf.intent.intent,
        intent_label: intentLabel(wf.intent.intent),
        conversation_stage: wf.conversationStage,
        stage_label: stageLabel(wf.conversationStage),
        inferred_service: wf.intent.inferred_service,
        brief_reason: wf.intent.brief_reason,
        retrieval_sections: wf.retrievalSectionTitles,
        lead_completeness_percent: wf.leadGaps.completenessPercent,
        lead_fields_missing: wf.leadGaps.missing,
        lead_collection_hint: wf.leadCollectionHint,
        calendar_ready: wf.integrationsReady.calendar,
        whatsapp_ready: wf.integrationsReady.whatsapp,
        crm_ready: wf.integrationsReady.crmWebhook,
      }
    : undefined;

  const system = buildSystemPrompt({
    knowledgeBase: wf.knowledgeForPrompt,
    channel,
    role: wf.effectiveRole,
    workflowMeta,
  });
  const tools = createAgentTools(options.sessionId, channel);

  const result = await generateText({
    model: getChatModel(),
    system,
    messages,
    tools,
    maxSteps: 6,
    temperature: 0.6,
  });

  const out =
    result.text ||
    "Thanks for your message. How can I help you today?";
  if (out.trim()) {
    await recordAssistantTurn(options.sessionId, channel, out.trim());
    logEvent("assistant_replied", options.sessionId, channel, {
      preview: out.slice(0, 240),
    });
  }
  return out;
}
