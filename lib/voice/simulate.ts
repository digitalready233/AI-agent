import { runAgentWorkflow } from "@/lib/platform/workflow";
import type { VoiceSimulateResult } from "./types";

export async function simulateVoiceTurn(params: {
  organizationId: string;
  agentId: string;
  conversationId: string;
  userMessage: string;
}): Promise<VoiceSimulateResult> {
  const result = await runAgentWorkflow({
    organizationId: params.organizationId,
    agentId: params.agentId,
    conversationId: params.conversationId,
    customerMessage: params.userMessage,
    channel: "voice",
    customerMetadata: { phone: undefined },
  });

  return {
    reply: result.aiResponse,
    detected_intent: result.detectedIntent,
    lead_score: result.leadScore,
    lead_category: result.leadCategory,
    handoff_triggered: result.handoffRequired,
    booking_recommended: result.bookingRecommended || result.suggestBooking,
    recommended_next_action: result.recommendedNextAction,
  };
}
