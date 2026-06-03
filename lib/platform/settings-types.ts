import type { AvatarOrgSettings } from "@/lib/avatar/types";
import type { LeadStatus, UserRole } from "./types";

export type SettingsSection =
  | "workspace"
  | "agent_defaults"
  | "sales_pipeline"
  | "lead_scoring"
  | "human_handoff"
  | "notifications"
  | "security"
  | "billing"
  | "data_privacy"
  | "api_settings"
  | "team_settings";

export type WorkspaceSettings = {
  default_language: string;
  default_timezone: string;
  date_format: string;
  time_format: "12h" | "24h";
  default_dashboard_view: string;
  default_lead_owner_id: string | null;
};

export type AgentDefaultsSettings = {
  default_tone: string;
  default_role: string;
  default_welcome_message: string;
  default_fallback_response: string;
  default_qualification_prompt: string;
  default_objection_prompt: string;
  default_booking_message: string;
  default_handoff_message: string;
};

export type PipelineStatusConfig = {
  key: LeadStatus;
  label: string;
  enabled: boolean;
};

export type SalesPipelineSettings = {
  statuses: PipelineStatusConfig[];
  default_status: LeadStatus;
};

export type LeadScoringSettings = {
  need_min: number;
  need_max: number;
  budget_min: number;
  budget_max: number;
  authority_min: number;
  authority_max: number;
  timeline_min: number;
  timeline_max: number;
  hot_threshold: number;
  warm_threshold: number;
  cold_threshold: number;
  auto_qualify_rules: string;
};

export type HandoffTriggerKey =
  | "customer_asks_human"
  | "lead_becomes_hot"
  | "ready_to_pay"
  | "custom_pricing"
  | "complaint_detected"
  | "ai_confidence_low";

export type HumanHandoffSettings = {
  enabled: boolean;
  triggers: Record<HandoffTriggerKey, boolean>;
  default_department: string;
  default_message: string;
  notification_channel: "email" | "slack" | "whatsapp" | "dashboard";
};

export type NotificationEventKey =
  | "new_hot_lead"
  | "new_qualified_lead"
  | "new_booking"
  | "human_handoff_required"
  | "complaint_detected"
  | "follow_up_due"
  | "integration_error"
  | "daily_summary"
  | "weekly_report";

export type NotificationChannelKey = "email" | "slack" | "whatsapp" | "dashboard";

export type NotificationsSettings = {
  events: Record<NotificationEventKey, boolean>;
  channels: Record<NotificationChannelKey, boolean>;
};

export type SecuritySettings = {
  session_timeout_minutes: number;
  require_2fa: boolean;
};

export type BillingSettings = {
  plan_name: string;
  agents_allowed: number;
  subscription_status?: "trial" | "active" | "past_due" | "none";
  trial_ends_at?: string | null;
  paystack_reference?: string | null;
  paid_at?: string | null;
};

export type DataPrivacySettings = {
  retention_days: number;
  privacy_policy_url: string;
  consent_message: string;
};

export type DemoProviderType =
  | "internal"
  | "livekit_future"
  | "daily_future"
  | "zoom_future";

export type DemoConnectionStatus =
  | "not_configured"
  | "ready"
  | "degraded"
  | "offline";

export type DemoRecordingProvider = "livekit_egress" | "none";

export type AiPresenterSettingsPayload = {
  enable_ai_presenter?: boolean;
  presenter_ui_mode?: "static_card" | "animated_card" | "avatar_future";
  default_avatar_url?: string | null;
  show_waveform?: boolean;
  show_demo_stage?: boolean;
  show_demo_path?: boolean;
  show_booking_badge?: boolean;
  show_handoff_badge?: boolean;
  brand_color?: string;
  compact_mode?: boolean;
};

export type DemoProviderSettings = {
  provider: DemoProviderType;
  default_demo_provider: DemoProviderType;
  enable_voice_demo: boolean;
  enable_human_takeover: boolean;
  /** @deprecated use enable_recording */
  enable_recording_placeholder: boolean;
  enable_recording?: boolean;
  auto_record_demos?: boolean;
  /** @deprecated use require_recording_consent */
  record_only_with_consent?: boolean;
  require_recording_consent?: boolean;
  recording_provider?: DemoRecordingProvider;
  recording_storage_location?: string;
  recording_retention_days?: number;
  recording_consent_message?: string;
  auto_send_follow_up?: boolean;
  enable_transcript: boolean;
  /** Auto-start LiveKit AI agent when prospect joins video room */
  enable_ai_auto_join?: boolean;
  default_demo_agent_id: string | null;
  demo_session_timeout_minutes: number;
  demo_room_branding: {
    primary_color?: string;
    logo_url?: string;
    welcome_title?: string;
  };
  connection_status: DemoConnectionStatus;
  ai_presenter?: AiPresenterSettingsPayload;
  avatar?: AvatarOrgSettings;
  multi_agent?: import("@/lib/demo/multi-agent/types").MultiAgentDemoSettings;
};

export type ApiSettings = {
  webhook_events_enabled: string[];
  demo_room?: DemoProviderSettings;
};

export type TeamInvite = {
  id: string;
  email: string;
  role: UserRole;
  status: "pending" | "accepted";
  created_at: string;
};

export type TeamSettings = {
  pending_invites: TeamInvite[];
};

export type OrganizationSettingsRecord = {
  organization_id: string;
  workspace: WorkspaceSettings;
  agent_defaults: AgentDefaultsSettings;
  sales_pipeline: SalesPipelineSettings;
  lead_scoring: LeadScoringSettings;
  human_handoff: HumanHandoffSettings;
  notifications: NotificationsSettings;
  security: SecuritySettings;
  billing: BillingSettings;
  data_privacy: DataPrivacySettings;
  api_settings: ApiSettings;
  team_settings: TeamSettings;
  updated_at: string;
};

export type OrganizationProfilePayload = {
  name: string;
  logo_url?: string | null;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  timezone?: string | null;
  currency?: string | null;
  description?: string | null;
};

export type IntegrationCredentialField = {
  key: string;
  label: string;
  type: "password" | "text";
  placeholder?: string;
};

export type IntegrationPublicState = {
  integration_type: string;
  status: string;
  configured: boolean;
  masked_fields: Record<string, string>;
};
