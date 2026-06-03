import { isLlmConfigured } from "@/lib/agent/llm-env";
import {
  getAgent,
  getConversation,
  getKnowledgeContextForAgent,
  getLead,
  listMessages,
  saveConversation,
  saveMessage,
  saveNotification,
} from "@/lib/platform/data";
import type { LeadStatus, Message } from "@/lib/platform/types";
import { analyzeWorkflowTurn } from "./analyze-turn";
import { generateWorkflowResponse } from "./generate-response";
import {
  evaluateHandoff,
  resolveConversationStatus,
  shouldDeferHandoffForBooking,
  shouldSuggestBooking,
} from "./handoff";
import { upsertLeadFromWorkflow } from "./lead-sync";
import { workflowInputSchema, type WorkflowInput } from "./schemas";
import { resolveLeadCategory } from "./lead-category";
import { sumLeadScores } from "./scoring";
import { loadWorkflowContext } from "./workflow-context";
import { buildInternalWorkflowBookingContext } from "@/lib/booking/workflow-context";
import { WorkflowError, type RunAgentWorkflowResult } from "./types";

export async function runAgentWorkflow(
  input: WorkflowInput
): Promise<RunAgentWorkflowResult> {
  const parsed = workflowInputSchema.safeParse(input);
  if (!parsed.success) {
    console.error("[runAgentWorkflow] validation failed", parsed.error.flatten());
    throw new WorkflowError(
      parsed.error.errors.map((e) => e.message).join("; "),
      "VALIDATION_ERROR",
      400
    );
  }

  const {
    organizationId,
    agentId,
    conversationId,
    customerMessage,
    channel,
    customerMetadata,
    externalMessageId,
  } = parsed.data;

  console.info("[runAgentWorkflow] start", {
    organizationId,
    agentId,
    conversationId,
    channel,
    messageLength: customerMessage.length,
  });

  if (!isLlmConfigured()) {
    throw new WorkflowError(
      "LLM not configured. Set OPENAI_API_KEY or GROQ_API_KEY on the server.",
      "LLM_NOT_CONFIGURED",
      503
    );
  }

  const agent = await getAgent(agentId);
  if (!agent || agent.organization_id !== organizationId) {
    throw new WorkflowError("Agent not found for this organization.", "AGENT_NOT_FOUND", 404);
  }
  if (!agent.enabled) {
    throw new WorkflowError("Agent is disabled.", "AGENT_DISABLED", 400);
  }

  let conversation = await getConversation(conversationId);
  if (!conversation || conversation.organization_id !== organizationId) {
    throw new WorkflowError("Conversation not found.", "CONVERSATION_NOT_FOUND", 404);
  }

  const ctx = await loadWorkflowContext(organizationId, agent);
  const { settings } = ctx;

  const priorMessages = await listMessages(conversationId);
  const history = priorMessages
    .filter((m) => m.sender_type === "user" || m.sender_type === "assistant")
    .map((m) => ({
      role: m.sender_type === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

  const knowledgeContext = await getKnowledgeContextForAgent(agentId, organizationId, {
    strict: channel === "website" || channel === "embed",
  });

  let analysis;
  try {
    analysis = await analyzeWorkflowTurn({
      ctx,
      customerMessage,
      history,
      knowledgeContext,
      customerMetadata,
    });
  } catch (err) {
    if (err instanceof WorkflowError) throw err;
    console.error("[runAgentWorkflow] analyze failed", err);
    throw new WorkflowError(
      "Failed to analyze conversation turn.",
      "ANALYSIS_FAILED",
      502
    );
  }

  const scores = sumLeadScores(analysis.lead_scores, settings.lead_scoring);
  const leadCategory = resolveLeadCategory(
    analysis,
    scores.total,
    settings.lead_scoring
  );
  const bookingEligible = shouldSuggestBooking({ analysis, leadCategory });
  const handoffFromRules = evaluateHandoff({
    analysis,
    leadCategory,
    handoffSettings: settings.human_handoff,
  });
  const handoffRequired =
    handoffFromRules &&
    !shouldDeferHandoffForBooking({ analysis, bookingEligible });
  const suggestBooking = bookingEligible && !handoffRequired;

  const existingLeadForBooking = conversation.lead_id
    ? await getLead(conversation.lead_id)
    : null;

  const bookingContext = suggestBooking
    ? await buildInternalWorkflowBookingContext({
        organizationId,
        analysis,
        serviceInterest:
          existingLeadForBooking?.service_interest ??
          customerMetadata?.serviceInterest ??
          null,
        customerMessage,
        bookingRecommended: suggestBooking,
      })
    : null;

  let aiResponse: string;
  try {
    aiResponse = await generateWorkflowResponse({
      ctx,
      customerMessage,
      history,
      knowledgeContext,
      analysis,
      handoffRequired,
      suggestBooking,
      bookingProvider: bookingContext?.bookingProvider ?? null,
    });
  } catch (err) {
    if (err instanceof WorkflowError) throw err;
    console.error("[runAgentWorkflow] response generation failed", err);
    throw new WorkflowError(
      "Failed to generate agent response.",
      "RESPONSE_FAILED",
      502
    );
  }

  const lead = await upsertLeadFromWorkflow({
    organizationId,
    conversation,
    analysis,
    channel,
    scoring: settings.lead_scoring,
    pipeline: settings.sales_pipeline,
    workspace: settings.workspace,
    customerMetadata,
    existingLead: existingLeadForBooking,
  });

  const now = new Date().toISOString();
  const status = resolveConversationStatus({
    handoffRequired,
    stage: analysis.conversation_stage,
  });

  conversation = await saveConversation({
    ...conversation,
    agent_id: agentId,
    lead_id: lead.id,
    channel: channel || conversation.channel,
    customer_name:
      lead.full_name ?? conversation.customer_name ?? customerMetadata?.name ?? null,
    customer_email:
      lead.email ?? conversation.customer_email ?? customerMetadata?.email ?? null,
    customer_phone:
      lead.phone ?? conversation.customer_phone ?? customerMetadata?.phone ?? null,
    status,
    conversation_stage: analysis.conversation_stage,
    detected_intent: analysis.detected_intent,
    ai_confidence: analysis.ai_confidence,
    summary: analysis.conversation_summary,
    recommended_next_action: analysis.recommended_next_action,
    updated_at: now,
  });

  const userMessage = await persistMessage({
    conversation_id: conversationId,
    sender_type: "user",
    sender_name: lead.full_name ?? customerMetadata?.name ?? "Customer",
    content: customerMessage,
    metadata: {
      channel,
      intent: analysis.detected_intent,
      ...(externalMessageId ? { whatsapp_message_id: externalMessageId } : {}),
    },
  });

  const assistantMessage = await persistMessage({
    conversation_id: conversationId,
    sender_type: "assistant",
    sender_name: agent.nickname ?? agent.name,
    content: aiResponse,
    metadata: {
      stage: analysis.conversation_stage,
      lead_score: scores.total,
      lead_scores: scores,
      lead_category: leadCategory,
      lead_status: lead.lead_status,
      handoff_required: handoffRequired,
      suggest_booking: suggestBooking,
    },
  });

  let bookingId: string | null = null;
  if (suggestBooking) {
    try {
      const { createBookingFromSuggestion } = await import(
        "./create-booking-from-suggestion"
      );
      bookingId = await createBookingFromSuggestion({
        organizationId,
        agent,
        conversation,
        lead,
        analysis,
      });
    } catch (e) {
      console.error("[runAgentWorkflow] booking create failed", e);
    }
  }

  if (
    handoffRequired &&
    settings.notifications.events.human_handoff_required !== false
  ) {
    await saveNotification({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      type: "human_handoff",
      title: "Human handoff required",
      message: `${lead.full_name ?? "A customer"} needs attention (${analysis.detected_intent.replace(/_/g, " ")}). ${analysis.conversation_summary}`,
      status: "unread",
      metadata: {
        conversation_id: conversationId,
        lead_id: lead.id,
        agent_id: agentId,
        lead_category: leadCategory,
        department: settings.human_handoff.default_department,
        channel: settings.human_handoff.notification_channel,
      },
      created_at: now,
    });
  }

  if (
    leadCategory === "hot" &&
    settings.notifications.events.new_hot_lead
  ) {
    await saveNotification({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      type: "hot_lead",
      title: "New hot lead",
      message: `${lead.full_name ?? "Lead"} scored ${scores.total} — ${analysis.conversation_summary}`,
      status: "unread",
      metadata: { lead_id: lead.id, conversation_id: conversationId },
      created_at: now,
    });
  }

  const result: RunAgentWorkflowResult = {
    aiResponse,
    detectedIntent: analysis.detected_intent,
    conversationStage: analysis.conversation_stage,
    leadScore: scores.total,
    leadCategory,
    leadStatus: lead.lead_status,
    handoffRequired,
    handoffVisitorMessage: handoffRequired
      ? settings.human_handoff.default_message?.trim() ||
        ctx.effective.handoff_message
      : null,
    recommendedNextAction: analysis.recommended_next_action,
    suggestBooking,
    bookingRecommended: suggestBooking,
    suggestedMeetingType: bookingContext?.suggestedMeetingType ?? null,
    preferredDateTime: bookingContext?.preferredDateTime ?? null,
    bookingProvider: bookingContext?.bookingProvider ?? null,
    nextAction: bookingContext?.nextAction ?? null,
    calendlyEmbedUrl: null,
    meetingTypeKey: bookingContext?.suggestedMeetingType ?? null,
    bookingId,
    conversationId,
    leadId: lead.id,
    messageIds: {
      user: userMessage.id,
      assistant: assistantMessage.id,
    },
  };

  console.info("[runAgentWorkflow] complete", {
    conversationId,
    leadId: lead.id,
    intent: result.detectedIntent,
    stage: result.conversationStage,
    score: result.leadScore,
    category: result.leadCategory,
    handoff: result.handoffRequired,
  });

  return result;
}

async function persistMessage(
  partial: Omit<Message, "id" | "created_at">
): Promise<Message> {
  return saveMessage({
    ...partial,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  });
}
