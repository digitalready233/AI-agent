import type { AgentRole } from "../config";
import type { Channel, LeadRecord, LeadStatus } from "../types";
import type {
  CustomerIntent,
  IntentClassification,
} from "../orchestrator/types";

/** Funnel stage tracked across the conversation (workflow engine). */
export const CONVERSATION_STAGES = [
  "new_visitor",
  "discovery",
  "qualification",
  "recommendation",
  "booking",
  "human_handoff",
  "follow_up",
] as const;

export type ConversationStage = (typeof CONVERSATION_STAGES)[number];

/** Core lead fields the workflow tries to collect before closing. */
export const LEAD_PROFILE_FIELDS = [
  "fullName",
  "phone",
  "email",
  "businessName",
  "serviceNeeded",
  "budgetRange",
  "timeline",
] as const;

export type LeadProfileField = (typeof LEAD_PROFILE_FIELDS)[number];

export interface LeadProfileGaps {
  collected: LeadProfileField[];
  missing: LeadProfileField[];
  completenessPercent: number;
}

export interface WorkflowSessionState {
  sessionId: string;
  channel: Channel;
  conversationStage: ConversationStage;
  lastIntent?: CustomerIntent;
  conversationSummary: string;
  updatedAt: string;
  /** Reserved for WhatsApp thread id, voice call sid, etc. */
  channelRef?: string;
}

export interface WorkflowTurnResult {
  /** Same as orchestrator output — KB slice for the system prompt */
  knowledgeForPrompt: string;
  effectiveRole: AgentRole;
  intent: IntentClassification;
  retrievalSectionTitles: string[];
  conversationStage: ConversationStage;
  leadGaps: LeadProfileGaps;
  sessionState: WorkflowSessionState;
  lead?: LeadRecord;
  /** Shown to the model so it knows what is missing */
  leadCollectionHint: string;
  integrationsReady: {
    calendar: boolean;
    whatsapp: boolean;
    crmWebhook: boolean;
  };
}

export function intentLabel(intent: CustomerIntent): string {
  const labels: Record<CustomerIntent, string> = {
    sales_enquiry: "Sales enquiry",
    support_request: "Support request",
    pricing_question: "Pricing question",
    booking_request: "Booking request",
    complaint: "Complaint",
    general_question: "General enquiry",
  };
  return labels[intent];
}

export function stageLabel(stage: ConversationStage): string {
  const labels: Record<ConversationStage, string> = {
    new_visitor: "New Visitor",
    discovery: "Discovery",
    qualification: "Qualification",
    recommendation: "Recommendation",
    booking: "Booking",
    human_handoff: "Human Handoff",
    follow_up: "Follow-Up",
  };
  return labels[stage];
}

export function defaultLeadStatusForIntent(intent: CustomerIntent): LeadStatus {
  switch (intent) {
    case "support_request":
    case "complaint":
      return "Support";
    case "sales_enquiry":
    case "pricing_question":
    case "booking_request":
      return "Warm";
    default:
      return "Cold";
  }
}
