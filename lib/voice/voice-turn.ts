import { runAgentWorkflow } from "@/lib/platform/workflow";
import type { RunAgentWorkflowResult } from "@/lib/platform/workflow/types";
import { getCallById, saveCall } from "./call-data";
import { syncConversationToCallTranscripts } from "./transcript-sync";
import type { CallRecord } from "./types";

export type VoiceTurnResult = RunAgentWorkflowResult & {
  call: CallRecord;
};

/**
 * One spoken turn: platform workflow + call CRM fields + transcript sync.
 * Used by Twilio Gather fallback (production-safe on Vercel).
 */
export async function processVoiceTurn(params: {
  call: CallRecord;
  speech: string;
}): Promise<VoiceTurnResult> {
  if (!params.call.conversation_id || !params.call.agent_id) {
    throw new Error("call_missing_conversation");
  }

  const result = await runAgentWorkflow({
    organizationId: params.call.organization_id,
    agentId: params.call.agent_id,
    conversationId: params.call.conversation_id,
    customerMessage: params.speech,
    channel: "voice",
    customerMetadata: {
      phone: params.call.from_number ?? undefined,
    },
  });

  const metadata = {
    ...(params.call.metadata ?? {}),
    ...(result.bookingId ? { booking_id: result.bookingId } : {}),
    last_intent: result.detectedIntent,
    last_lead_category: result.leadCategory,
  };

  const updated = await saveCall({
    ...params.call,
    status: "in_progress",
    lead_id: result.leadId ?? params.call.lead_id,
    detected_intent: result.detectedIntent,
    lead_category: result.leadCategory,
    lead_score: result.leadScore,
    handoff_required: result.handoffRequired,
    recommended_next_action: result.recommendedNextAction,
    metadata,
    updated_at: new Date().toISOString(),
  });

  await syncConversationToCallTranscripts({
    organizationId: params.call.organization_id,
    callId: params.call.id,
    conversationId: params.call.conversation_id,
  });

  return { ...result, call: updated };
}
