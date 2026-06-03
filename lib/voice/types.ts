export type VoiceConnectionStatus = "connected" | "not_connected" | "error";

export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "initiated"
  | "ringing"
  | "in_progress"
  | "completed"
  | "busy"
  | "failed"
  | "no_answer"
  | "canceled"
  | "human_needed"
  | "transferred";

/** Business outcome after an outbound campaign call (distinct from Twilio status). */
export type CallOutcome =
  | "answered"
  | "no_answer"
  | "busy"
  | "failed"
  | "voicemail"
  | "qualified"
  | "not_interested"
  | "booked"
  | "human_transfer"
  | "do_not_call";

export type OutboundQueueStatus =
  | "pending"
  | "dialing"
  | "completed"
  | "exhausted"
  | "skipped"
  | "cancelled";

export type VoicemailBehavior = "leave_message" | "hangup" | "retry";

export interface OutboundVoiceCampaignSettings {
  call_window?: VoiceBusinessHours;
  max_attempts?: number;
  retry_delay_minutes?: number;
  voicemail_behavior?: VoicemailBehavior;
  human_transfer_phone?: string | null;
  max_concurrent_calls?: number;
}

export interface OutboundCallQueueItem {
  id: string;
  organization_id: string;
  campaign_id: string;
  campaign_lead_id?: string | null;
  lead_id: string;
  phone_number: string;
  attempt_count: number;
  max_attempts: number;
  scheduled_at: string;
  status: OutboundQueueStatus;
  last_attempt_at?: string | null;
  next_attempt_at?: string | null;
  call_outcome?: CallOutcome | null;
  error_message?: string | null;
  last_call_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type AfterHoursBehavior = "voicemail" | "message" | "transfer" | "ai_only";

export interface VoiceBusinessHours {
  timezone?: string;
  /** 0=Sunday … 6=Saturday */
  days?: number[];
  start?: string;
  end?: string;
}

export interface VoiceIntegration {
  organization_id: string;
  provider: "twilio";
  twilio_account_sid: string | null;
  twilio_phone_number: string | null;
  default_agent_id: string | null;
  default_voice: string;
  human_transfer_phone: string | null;
  recording_enabled: boolean;
  transcription_enabled: boolean;
  business_hours: VoiceBusinessHours;
  after_hours_behavior: AfterHoursBehavior;
  /** Spoken when after_hours_behavior is message */
  after_hours_message?: string | null;
  connection_status: VoiceConnectionStatus;
  last_tested_at: string | null;
  inbound_webhook_url: string | null;
  status_callback_url: string | null;
  media_stream_ws_url: string | null;
  use_media_stream: boolean;
  updated_at: string;
  /** Client-only: whether auth token is stored server-side */
  has_auth_token?: boolean;
}

export interface CallRecord {
  id: string;
  organization_id: string;
  agent_id: string | null;
  lead_id: string | null;
  conversation_id: string | null;
  provider: string;
  twilio_call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  direction: CallDirection;
  status: CallStatus;
  call_type: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  detected_intent: string | null;
  lead_score: number | null;
  lead_category: string | null;
  handoff_required: boolean;
  recommended_next_action: string | null;
  failure_reason: string | null;
  call_outcome?: CallOutcome | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CallEvent {
  id: string;
  organization_id: string;
  call_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CallTranscriptSegment {
  id: string;
  organization_id: string;
  call_id: string;
  speaker: "caller" | "agent" | "system" | "unknown";
  content: string;
  sequence_num: number;
  created_at: string;
}

export interface CallSummaryPayload {
  caller_name?: string;
  phone_number?: string;
  service_interest?: string;
  budget?: string;
  timeline?: string;
  objections?: string;
  intent?: string;
  lead_category?: string;
  next_action?: string;
  handoff_required?: boolean;
}

export interface VoiceSimulateResult {
  reply: string;
  detected_intent: string | null;
  lead_score: number | null;
  lead_category: string | null;
  handoff_triggered: boolean;
  booking_recommended: boolean;
  recommended_next_action: string | null;
}
