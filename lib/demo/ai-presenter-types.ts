export const AI_PRESENTER_STATES = [
  "idle",
  "joining",
  "listening",
  "thinking",
  "speaking",
  "presenting",
  "paused",
  "handoff_required",
  "stopped",
  "failed",
] as const;

export type AiPresenterState = (typeof AI_PRESENTER_STATES)[number];

export const AI_PRESENTER_MODES = [
  "card",
  "animated_card",
  "avatar_future",
  "video_avatar_future",
] as const;

export type AiPresenterMode = (typeof AI_PRESENTER_MODES)[number];

export const AI_PRESENTER_UI_MODES = ["static_card", "animated_card", "avatar_future"] as const;
export type AiPresenterUiMode = (typeof AI_PRESENTER_UI_MODES)[number];

export const DEMO_PRESENTER_EVENT_TYPES = [
  "ai_state_changed",
  "ai_started_speaking",
  "ai_stopped_speaking",
  "ai_started_presenting_asset",
  "ai_handoff_triggered",
  "ai_paused",
  "ai_resumed",
  "presenter_mode_changed",
  "staff_became_presenter",
] as const;

export type DemoPresenterEventType = (typeof DEMO_PRESENTER_EVENT_TYPES)[number];

export interface DemoPresenterEvent {
  id: string;
  organization_id: string;
  demo_session_id: string;
  event_type: DemoPresenterEventType | string;
  actor_type: string | null;
  actor_id: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type AgentPresenterConfig = {
  avatar_url?: string | null;
  display_name?: string | null;
  role_title?: string | null;
  style?: "professional" | "friendly" | "executive" | string;
  welcome_phrase?: string | null;
  voice_sync_enabled?: boolean;
  fallback_initials?: string | null;
};

export type AiPresenterOrgSettings = {
  enable_ai_presenter: boolean;
  presenter_ui_mode: AiPresenterUiMode;
  default_avatar_url?: string | null;
  show_waveform: boolean;
  show_demo_stage: boolean;
  show_demo_path: boolean;
  show_booking_badge: boolean;
  show_handoff_badge: boolean;
  brand_color: string;
  compact_mode: boolean;
};

export const DEFAULT_AI_PRESENTER_ORG_SETTINGS: AiPresenterOrgSettings = {
  enable_ai_presenter: true,
  presenter_ui_mode: "animated_card",
  show_waveform: true,
  show_demo_stage: true,
  show_demo_path: true,
  show_booking_badge: true,
  show_handoff_badge: true,
  brand_color: "#22d3ee",
  compact_mode: false,
};

export function presenterInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
