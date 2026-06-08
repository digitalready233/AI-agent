import type { RunAgentWorkflowResult } from "@/lib/platform/workflow";

export type PlatformChatResponseBody = {
  reply?: string;
  transcript?: string;
  inputMode?: "text" | "audio";
  audioBase64?: string | null;
  audioMimeType?: string | null;
  conversationId?: string;
  leadId?: string | null;
  handoffRequired?: boolean;
  handoffMessage?: string;
  handoffActive?: boolean;
  staffHandling?: boolean;
  staffJoined?: boolean;
  suggestBooking?: boolean;
  bookingRecommended?: boolean;
  bookingProvider?: "internal" | "google_calendar" | "calendly" | null;
  meetingTypeKey?: string | null;
  detectedIntent?: string;
  conversationStage?: string;
  readybotPipelineStep?: RunAgentWorkflowResult["readybotPipelineStep"];
  readybotMicroStep?: RunAgentWorkflowResult["readybotMicroStep"];
  leadScore?: number;
  leadCategory?: string;
  leadStatus?: string;
  recommendedNextAction?: string;
  turnTimestamp?: string;
};

export function buildPlatformChatResponse(
  workflow: RunAgentWorkflowResult,
  extras?: {
    transcript?: string;
    inputMode?: "text" | "audio";
    audioBase64?: string | null;
    audioMimeType?: string | null;
    turnTimestamp?: string;
  }
): PlatformChatResponseBody {
  return {
    reply: workflow.aiResponse,
    transcript: extras?.transcript,
    inputMode: extras?.inputMode,
    audioBase64: extras?.audioBase64 ?? null,
    audioMimeType: extras?.audioMimeType ?? null,
    conversationId: workflow.conversationId,
    leadId: workflow.leadId,
    handoffRequired: workflow.handoffRequired,
    handoffMessage: workflow.handoffRequired
      ? workflow.handoffVisitorMessage ?? undefined
      : undefined,
    handoffActive: workflow.handoffRequired,
    suggestBooking: workflow.suggestBooking,
    bookingRecommended: workflow.bookingRecommended,
    bookingProvider: workflow.bookingProvider,
    meetingTypeKey: workflow.meetingTypeKey,
    detectedIntent: workflow.detectedIntent,
    conversationStage: workflow.conversationStage,
    readybotPipelineStep: workflow.readybotPipelineStep ?? undefined,
    readybotMicroStep: workflow.readybotMicroStep ?? undefined,
    leadScore: workflow.leadScore,
    leadCategory: workflow.leadCategory,
    leadStatus: workflow.leadStatus,
    recommendedNextAction: workflow.recommendedNextAction,
    turnTimestamp: extras?.turnTimestamp,
  };
}
