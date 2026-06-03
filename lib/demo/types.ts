export const DEMO_STATUSES = [
  "scheduled",
  "waiting",
  "in_progress",
  "completed",
  "missed",
  "cancelled",
  "human_taken_over",
] as const;

export type DemoStatus = (typeof DEMO_STATUSES)[number];

export const HANDOFF_STATUSES = [
  "none",
  "requested",
  "notified",
  "joined",
  "taken_over",
  "resolved",
] as const;

export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const HANDOFF_REASONS = [
  "hot_lead",
  "human_requested",
  "ready_to_pay",
  "custom_pricing",
  "complaint",
  "outside_knowledge",
  "low_confidence",
  "final_confirmation",
  "negotiation",
  "manual",
] as const;

export type HandoffReason = (typeof HANDOFF_REASONS)[number];

export const VIDEO_PROVIDERS = [
  "internal",
  "livekit",
  "daily_future",
  "zoom_future",
  "agora_future",
] as const;

export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const LIVEKIT_ROOM_STATUSES = [
  "not_created",
  "created",
  "active",
  "ended",
  "failed",
] as const;

export type LiveKitRoomStatus = (typeof LIVEKIT_ROOM_STATUSES)[number];

export const DEMO_AI_STATUSES = [
  "not_started",
  "starting",
  "active",
  "paused",
  "stopped",
  "failed",
] as const;

export type DemoAiStatus = (typeof DEMO_AI_STATUSES)[number];

export const DEMO_AI_AUDIO_MODES = [
  "fallback_tts",
  "livekit_track",
  "realtime_agent",
] as const;

export type DemoAiAudioMode = (typeof DEMO_AI_AUDIO_MODES)[number];

export const DEMO_AI_AUDIO_STATUSES = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "paused",
  "failed",
] as const;

export type DemoAiAudioStatus = (typeof DEMO_AI_AUDIO_STATUSES)[number];

export const DEMO_RECORDING_STATUSES = [
  "idle",
  "consent_required",
  "pending_consent",
  "starting",
  "recording",
  "stopped",
  "failed",
  "unavailable",
] as const;

export const DEMO_REVIEW_STATUSES = [
  "not_reviewed",
  "reviewed",
  "needs_attention",
] as const;

export type DemoReviewStatus = (typeof DEMO_REVIEW_STATUSES)[number];

export type DemoRecordingStatus = (typeof DEMO_RECORDING_STATUSES)[number];

export const DEMO_RECORDING_ROW_STATUSES = [
  "idle",
  "starting",
  "recording",
  "stopped",
  "failed",
  "processing",
] as const;

export type DemoRecordingRowStatus = (typeof DEMO_RECORDING_ROW_STATUSES)[number];

export const PRESENTATION_CONTROL_MODES = [
  "ai_controlled",
  "staff_controlled",
  "shared_control",
] as const;

export type PresentationControlMode = (typeof PRESENTATION_CONTROL_MODES)[number];

export const DEMO_PRESENTER_TYPES = ["ai", "staff", "prospect"] as const;
export type DemoPresenterType = (typeof DEMO_PRESENTER_TYPES)[number];

export const DEMO_PRESENTATION_EVENT_TYPES = [
  "screen_share_started",
  "screen_share_stopped",
  "presenter_changed",
  "ai_selected_asset",
  "staff_selected_asset",
  "ai_moved_next",
  "staff_moved_next",
  "ai_paused",
  "ai_resumed",
  "staff_takeover_started",
  "staff_takeover_ended",
  "booking_cta_shown",
  "handoff_triggered",
  "control_mode_changed",
] as const;

export type DemoPresentationEventType = (typeof DEMO_PRESENTATION_EVENT_TYPES)[number];

export interface DemoPresentationEvent {
  id: string;
  organization_id: string;
  demo_session_id: string;
  event_type: DemoPresentationEventType | string;
  actor_type: string | null;
  actor_id: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const DEMO_TIMELINE_EVENT_TYPES = [
  "prospect_joined",
  "ai_joined",
  "demo_path_selected",
  "asset_viewed",
  "screen_share_started",
  "screen_share_stopped",
  "presentation_control_changed",
  "presenter_changed",
  "ai_state_changed",
  "objection_detected",
  "lead_warm",
  "lead_hot",
  "booking_recommended",
  "handoff_triggered",
  "human_handoff_triggered",
  "staff_joined",
  "staff_takeover_started",
  "staff_took_over",
  "ai_paused",
  "ai_resumed",
  "demo_completed",
  "booking_created",
  "recording_started",
  "recording_stopped",
  "transcript_saved",
  "summary_generated",
  "crm_updated",
  "follow_up_scheduled",
  "demo_ended",
] as const;

export type DemoTimelineEventType = (typeof DEMO_TIMELINE_EVENT_TYPES)[number];

export interface DemoRecording {
  id: string;
  demo_session_id: string;
  organization_id: string;
  provider: string;
  status: DemoRecordingRowStatus | string;
  egress_id?: string | null;
  recording_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size: number | null;
  consent_given: boolean;
  started_by: string | null;
  started_at: string | null;
  ended_at: string | null;
  error_message: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface DemoTimelineEvent {
  id: string;
  demo_session_id: string;
  organization_id: string;
  event_type: DemoTimelineEventType | string;
  title: string;
  description: string | null;
  event_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const DEMO_ROOM_EVENT_TYPES = [
  "room_created",
  "participant_joined",
  "participant_left",
  "track_published",
  "track_unpublished",
  "staff_joined",
  "ai_joined",
  "ai_started",
  "ai_paused",
  "ai_resumed",
  "ai_stopped",
  "ai_failed",
  "ai_spoke",
  "ai_heard_user",
  "ai_triggered_booking",
  "ai_triggered_handoff",
  "recording_started",
  "recording_stopped",
  "room_ended",
] as const;

export type DemoRoomEventType = (typeof DEMO_ROOM_EVENT_TYPES)[number];

export interface DemoRoomEvent {
  id: string;
  demo_session_id: string;
  organization_id: string;
  event_type: DemoRoomEventType;
  participant_identity: string | null;
  participant_role: "prospect" | "staff" | "ai_observer" | "agent" | "ai_agent" | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export const DEMO_EVENT_TYPES = [
  "handoff_triggered",
  "staff_notified",
  "staff_joined",
  "takeover_started",
  "ai_paused",
  "ai_resumed",
  "takeover_ended",
  "demo_completed",
] as const;

export type DemoEventType = (typeof DEMO_EVENT_TYPES)[number];

export interface DemoEvent {
  id: string;
  demo_session_id: string;
  organization_id: string;
  event_type: DemoEventType;
  actor_type: "system" | "prospect" | "staff" | "agent";
  actor_id: string | null;
  description: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

import { SALES_DEMO_STAGES, type SalesDemoStage } from "./demo-stages";

/** Guided sales presentation stages */
export const DEMO_STAGES = SALES_DEMO_STAGES;

export type DemoStage = SalesDemoStage;

export type DemoEntryMode = "on_demand" | "scheduled";

export type DemoQualificationProgress = {
  need: boolean;
  budget: boolean;
  authority: boolean;
  timeline: boolean;
};

export interface DemoPath {
  id: string;
  organization_id: string;
  agent_id: string | null;
  title: string;
  description: string | null;
  service_category: string | null;
  target_industry: string | null;
  qualification_questions: string[];
  demo_asset_sequence: string[];
  recommended_cta: string | null;
  path_key: string | null;
  status: "active" | "draft" | "archived";
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const DEMO_ASSET_TYPES = [
  "slide",
  "service_card",
  "product_step",
  "pricing_placeholder",
  "pricing_overview",
  "case_study",
  "faq",
  "objection_response",
] as const;

export type DemoAssetType = (typeof DEMO_ASSET_TYPES)[number];

export const VIDEO_PROVIDER_PLACEHOLDERS = [
  "livekit",
  "daily",
  "zoom",
  "agora",
] as const;

export interface DemoSession {
  id: string;
  organization_id: string;
  agent_id: string | null;
  lead_id: string | null;
  conversation_id: string | null;
  booking_id?: string | null;
  title: string;
  demo_type: string;
  status: DemoStatus;
  current_demo_stage: DemoStage | string;
  demo_path_id?: string | null;
  entry_mode?: DemoEntryMode | string;
  current_demo_asset_id?: string | null;
  objections?: string[];
  qualification_progress?: DemoQualificationProgress;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
  transcript: string | null;
  detected_intent: string | null;
  lead_score: number | null;
  lead_category: string | null;
  handoff_required: boolean;
  ai_paused?: boolean;
  ai_joined?: boolean;
  ai_status?: DemoAiStatus | string;
  ai_participant_identity?: string | null;
  ai_started_at?: string | null;
  ai_stopped_at?: string | null;
  ai_last_response_at?: string | null;
  ai_audio_track_published?: boolean;
  ai_audio_mode?: DemoAiAudioMode | string;
  ai_audio_status?: DemoAiAudioStatus | string;
  ai_audio_error?: string | null;
  ai_last_spoken_at?: string | null;
  human_takeover_started_at?: string | null;
  human_takeover_ended_at?: string | null;
  human_takeover_by?: string | null;
  handoff_reason?: HandoffReason | string | null;
  handoff_status?: HandoffStatus | string;
  booking_recommended: boolean;
  recommended_next_action: string | null;
  recording_url: string | null;
  recording_consent_given?: boolean;
  recording_status?: DemoRecordingStatus | string;
  recording_started_at?: string | null;
  recording_ended_at?: string | null;
  recording_provider?: string | null;
  recording_error?: string | null;
  follow_up_draft?: string | null;
  follow_up_due_at?: string | null;
  post_demo_automation_at?: string | null;
  demo_quality_score?: number | null;
  lead_quality_score?: number | null;
  ai_performance_rating?: number | null;
  human_takeover_rating?: number | null;
  review_notes?: string | null;
  manager_notes?: string | null;
  review_status?: DemoReviewStatus | string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  replay_view_count?: number;
  livekit_room_name?: string | null;
  livekit_room_status?: LiveKitRoomStatus | string;
  video_provider?: VideoProvider | string;
  video_enabled?: boolean;
  audio_enabled?: boolean;
  screen_share_enabled?: boolean;
  screen_share_active?: boolean;
  screen_share_started_at?: string | null;
  screen_share_ended_at?: string | null;
  screen_share_by?: string | null;
  current_presenter_type?: DemoPresenterType | string | null;
  current_presenter_id?: string | null;
  presentation_control_mode?: PresentationControlMode | string;
  ai_presenter_state?: string | null;
  ai_presenter_mode?: string | null;
  ai_presenter_last_stage?: string | null;
  ai_presenter_last_asset_id?: string | null;
  ai_presenter_last_updated_at?: string | null;
  avatar_session_id?: string | null;
  avatar_provider?: string | null;
  avatar_status?: string | null;
  avatar_stream_url?: string | null;
  avatar_join_url?: string | null;
  avatar_error?: string | null;
  avatar_started_at?: string | null;
  avatar_stopped_at?: string | null;
  avatar_fallback_provider?: string | null;
  avatar_routing_rule_id?: string | null;
  avatar_provider_mode?: string | null;
  multi_agent_enabled?: boolean;
  multi_agent_assignment_mode?: string | null;
  primary_presenter_agent_id?: string | null;
  qualification_agent_id?: string | null;
  objection_agent_id?: string | null;
  booking_agent_id?: string | null;
  crm_summary_agent_id?: string | null;
  handoff_agent_id?: string | null;
  follow_up_agent_id?: string | null;
  tavus_conversation_id?: string | null;
  tavus_conversation_url?: string | null;
  tavus_replica_id?: string | null;
  tavus_persona_id?: string | null;
  did_session_id?: string | null;
  did_agent_id?: string | null;
  did_stream_id?: string | null;
  recording_enabled?: boolean;
  room_started_at?: string | null;
  room_ended_at?: string | null;
  scheduled_at?: string | null;
  admin_notes?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DemoParticipant {
  id: string;
  organization_id: string;
  demo_session_id: string;
  role: "prospect" | "agent" | "staff";
  lead_id?: string | null;
  name?: string | null;
  display_name: string | null;
  email: string | null;
  phone?: string | null;
  joined_at: string;
  left_at: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface DemoMessage {
  id: string;
  organization_id: string;
  demo_session_id: string;
  sender_type: "prospect" | "agent" | "staff" | "system";
  sender_name: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type DemoInputType = "text" | "voice";
export type DemoParticipantRole = "prospect" | "staff" | "agent";

export interface DemoTranscriptSegment {
  id: string;
  organization_id: string;
  demo_session_id: string;
  speaker: string;
  speaker_type?: "prospect" | "agent" | "staff" | "system" | string | null;
  content: string;
  input_type?: DemoInputType | string | null;
  sequence_num: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface DemoAsset {
  id: string;
  organization_id: string;
  demo_path_id?: string | null;
  title: string;
  content: string;
  asset_type: DemoAssetType | string;
  /** Display order within a demo path (DB column: sort_order). */
  sort_order: number;
  attached_agent_id: string | null;
  attached_knowledge_base_id: string | null;
  status: "draft" | "active" | "archived";
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DemoOutcome {
  id: string;
  organization_id: string;
  demo_session_id: string;
  lead_id?: string | null;
  outcome_type: string;
  notes: string | null;
  next_action?: string | null;
  booking_id?: string | null;
  handoff_required?: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RunDemoWorkflowResult {
  aiResponse: string;
  aiVoiceText?: string;
  demoStage: DemoStage | string;
  /** @deprecated use demoStage */
  currentDemoStage: DemoStage | string;
  selectedDemoPathId: string | null;
  selectedDemoPathTitle?: string | null;
  currentDemoAssetId: string | null;
  nextDemoAsset: DemoAsset | null;
  nextDemoAssetId: string | null;
  detectedIntent: string | null;
  leadScore: number;
  leadCategory: string | null;
  bookingRecommended: boolean;
  handoffRequired: boolean;
  recommendedNextAction: string | null;
  demoSummaryUpdate?: string;
  /** @deprecated use demoSummaryUpdate */
  summaryUpdate?: string;
  qualificationProgress?: DemoQualificationProgress;
  objections?: string[];
  bookingId: string | null;
  messageId: string;
  structured?: import("./demo-schemas").DemoWorkflowResponse;
  usedFallback?: boolean;
  aiPaused?: boolean;
  humanTakeoverActive?: boolean;
}

export interface DemoSimulateResult {
  reply: string;
  current_demo_stage: string;
  detected_intent: string | null;
  lead_score: number | null;
  lead_category: string | null;
  booking_recommended: boolean;
  handoff_required: boolean;
  recommended_next_action: string | null;
  next_asset_title: string | null;
}

export interface DemoDashboardMetrics {
  totalDemos: number;
  demosToday: number;
  demosStarted: number;
  liveDemosNow: number;
  completedDemos: number;
  missedDemos: number;
  hotLeadsFromDemos: number;
  bookingsFromDemos: number;
  demosNeedingHandoff: number;
  humanTakeovers: number;
  demoConversionRate: number;
  demosWithPathSelected: number;
  hotLeadsAfterPath: number;
  mostSelectedPathTitle: string | null;
  pathSelectionCounts: Record<string, number>;
  liveRoomsActive: number;
  demosWithVideoEnabled: number;
  staffJoinedDemos: number;
  completedVideoDemos: number;
  videoDemosWithBookings: number;
  recordedDemos: number;
  replayViews: number;
  demosReviewed: number;
  demosWithFollowUp: number;
  demoToBookingConversion: number;
  humanTakeoverConversion: number;
  averageDemoDurationSeconds: number;
  avatarDemosStarted: number;
  avatarProviderFailures: number;
  avatarFallbackActivations: number;
  avatarDemoConversionRate: number;
  avatarDemosWithBooking: number;
  avatarDemosNeedingHandoff: number;
  tavusAvatarDemosStarted: number;
  tavusAvatarFailures: number;
  didAvatarDemosStarted: number;
  didAvatarFailures: number;
  didAvatarFallbackActivations: number;
  didDemoConversionRate: number;
  didDemosWithBooking: number;
  didDemosNeedingHandoff: number;
  /** Per-provider aggregates from avatar_provider_metrics */
  providerStats?: Array<{
    provider: string;
    demosStarted: number;
    failures: number;
    fallbacks: number;
    bookings: number;
    handoffs: number;
    successRate: number;
    failureRate: number;
    conversionRate: number;
    avgStartTimeMs: number | null;
  }>;
  mostReliableProvider: string | null;
  bestConvertingProvider: string | null;
  internalCardFallbackCount: number;
  multiAgentDemos: number;
  multiAgentBookingRecommendations: number;
  multiAgentObjectionsDetected: number;
  multiAgentHandoffsRecommended: number;
  multiAgentCrmSummaries: number;
  multiAgentFollowUpsCreated: number;
  multiAgentConversionRate: number;
}
