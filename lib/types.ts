export type LeadStatus = "Hot" | "Warm" | "Cold" | "Support" | "Not Qualified";

export type CustomerType =
  | "new_prospect"
  | "existing_customer"
  | "returning_lead"
  | "complaint"
  | "support"
  | "partnership"
  | "job_seeker"
  | "unknown";

export type Urgency = "low" | "medium" | "high" | "critical";

export type Channel = "website" | "whatsapp" | "voice" | "sms";

export interface NbatScores {
  need: number;
  budget: number;
  authority: number;
  timeline: number;
}

export interface LeadRecord {
  id: string;
  sessionId: string;
  channel: Channel;
  createdAt: string;
  updatedAt: string;
  status: LeadStatus;
  customerType: CustomerType;
  leadScore?: number;
  leadCategory?: string;
  nbat?: NbatScores;
  sentiment?: string;
  objections?: string;
  followUpDate?: string;
  assignedTeam?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  businessName?: string;
  location?: string;
  serviceNeeded?: string;
  mainChallenge?: string;
  budgetRange?: string;
  timeline?: string;
  preferredContact?: string;
  bestTimeToReach?: string;
  notes?: string;
  conversationSummary?: string;
  crmSummary?: string;
  /** Workflow funnel stage (see lib/workflow) */
  conversationStage?: string;
  lastIntent?: string;
}

export interface CrmSummaryRecord {
  id: string;
  sessionId: string;
  leadId?: string;
  createdAt: string;
  payload: Record<string, string | number | undefined>;
}

export interface EscalationPayload {
  id: string;
  createdAt: string;
  sessionId: string;
  channel: Channel;
  urgency: Urgency;
  reason: string;
  customerName?: string;
  email?: string;
  phone?: string;
  leadStatus?: LeadStatus;
  summary: string;
  recommendedNextAction: string;
}

export interface AppointmentRequest {
  id: string;
  sessionId: string;
  channel: Channel;
  createdAt: string;
  fullName: string;
  email: string;
  phone?: string;
  preferredDate?: string;
  preferredTime?: string;
  meetingType: string;
  notes?: string;
  calendarEventId?: string;
}

export type AnalyticsEventType =
  | "conversation_started"
  | "message_sent"
  | "customer_message_saved"
  | "intent_classified"
  | "knowledge_retrieved"
  | "orchestrator_completed"
  | "assistant_replied"
  | "lead_saved"
  | "lead_scored"
  | "appointment_booked"
  | "escalation"
  | "follow_up_scheduled"
  | "crm_summary_saved"
  | "hot_lead_alert"
  | "workflow_stage_updated"
  | "workflow_completed"
  | "conversation_summary_saved"
  | "human_attention_alert"
  | "crm_synced";

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  sessionId: string;
  channel: Channel;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
