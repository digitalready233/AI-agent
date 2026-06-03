import type { LeadCategory, LeadStatus } from "@/lib/platform/types";
import type { WorkflowIntent, WorkflowStage } from "./schemas";

export type { WorkflowInput, WorkflowAnalysis, WorkflowIntent, WorkflowStage } from "./schemas";

export interface WorkflowLeadScores {
  need: number;
  budget: number;
  authority: number;
  timeline: number;
  total: number;
}

export interface RunAgentWorkflowResult {
  aiResponse: string;
  detectedIntent: WorkflowIntent;
  conversationStage: WorkflowStage;
  leadScore: number;
  leadCategory: LeadCategory;
  leadStatus: LeadStatus;
  handoffRequired: boolean;
  /** Shown to the visitor when handoff is triggered (from org Settings). */
  handoffVisitorMessage: string | null;
  recommendedNextAction: string;
  suggestBooking: boolean;
  /** Alias for suggestBooking — internal booking recommendation */
  bookingRecommended: boolean;
  suggestedMeetingType: string | null;
  preferredDateTime: string | null;
  bookingProvider: "internal" | "google_calendar" | "calendly" | null;
  nextAction: string | null;
  calendlyEmbedUrl: string | null;
  meetingTypeKey: string | null;
  bookingId: string | null;
  conversationId: string;
  leadId: string | null;
  messageIds: {
    user: string;
    assistant: string;
  };
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}
