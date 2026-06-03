export const AVATAR_PROVIDER_IDS = [
  "internal_card",
  "tavus",
  "did",
  "heygen",
  "custom_future",
] as const;

export type AvatarProviderId = (typeof AVATAR_PROVIDER_IDS)[number];

export const AVATAR_SESSION_STATUSES = [
  "not_started",
  "starting",
  "active",
  "speaking",
  "listening",
  "paused",
  "stopped",
  "failed",
  "fallback_active",
] as const;

export type AvatarSessionStatus = (typeof AVATAR_SESSION_STATUSES)[number];

export const AVATAR_FALLBACK_MODES = ["internal_card"] as const;
export type AvatarFallbackMode = (typeof AVATAR_FALLBACK_MODES)[number];

export type AvatarIntegrationStatus = "connected" | "not_connected" | "needs_attention";

export interface AvatarIntegration {
  id: string;
  organization_id: string;
  provider: AvatarProviderId | string;
  status: AvatarIntegrationStatus | string;
  api_key_encrypted?: string | null;
  config: Record<string, unknown>;
  default_avatar_id?: string | null;
  default_voice_id?: string | null;
  last_tested_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvatarEvent {
  id: string;
  organization_id: string;
  demo_session_id: string | null;
  provider: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AvatarAgentConfig {
  avatar_provider?: AvatarProviderId | string | null;
  avatar_provider_mode?: AvatarProviderMode | string | null;
  avatar_preferred_provider?: AvatarProviderId | string | null;
  avatar_allow_auto_switch?: boolean;
  avatar_id?: string | null;
  avatar_replica_id?: string | null;
  avatar_persona_id?: string | null;
  avatar_voice_id?: string | null;
  avatar_style?: string | null;
  avatar_enabled?: boolean;
  avatar_fallback_mode?: AvatarFallbackMode | string | null;
}

export interface AvatarSessionContext {
  organizationId: string;
  demoSessionId: string;
  agent: AvatarAgentConfig & { id: string; name: string };
  integration?: AvatarIntegration | null;
  credentials: AvatarProviderCredentials;
  config: Record<string, unknown>;
}

export interface AvatarProviderCredentials {
  apiKey?: string | null;
  defaultAvatarId?: string | null;
  defaultVoiceId?: string | null;
  defaultPersonaId?: string | null;
  defaultReplicaId?: string | null;
}

export interface AvatarSessionResult {
  sessionId: string;
  provider: AvatarProviderId | string;
  status: AvatarSessionStatus;
  streamUrl?: string | null;
  joinUrl?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AvatarSpeakResult {
  ok: boolean;
  status?: AvatarSessionStatus;
  error?: string | null;
}

export interface AvatarStatusResult {
  status: AvatarSessionStatus;
  providerSessionId?: string | null;
  streamUrl?: string | null;
  error?: string | null;
  raw?: Record<string, unknown>;
}

export interface AvatarWebhookResult {
  status?: AvatarSessionStatus;
  eventType?: string;
  demoSessionId?: string | null;
  payload?: Record<string, unknown>;
}

export const AVATAR_PROVIDER_MODES = [
  "org_default",
  "fixed",
  "smart_routing",
] as const;
export type AvatarProviderMode = (typeof AVATAR_PROVIDER_MODES)[number];

export type AvatarRoutingConditions = {
  agent_id?: string;
  demo_path_id?: string;
  demo_type?: string;
  lead_category?: string;
  industry?: string;
  service_interest?: string;
  language?: string;
  country?: string;
  client_workspace?: string;
  time_of_day?: { start?: string; end?: string };
  use_best_performing_provider?: boolean;
};

export type AvatarRoutingRule = {
  id: string;
  organization_id: string;
  name: string;
  priority: number;
  conditions: AvatarRoutingConditions;
  provider: AvatarProviderId | string;
  fallback_provider: AvatarProviderId | string;
  status: "active" | "inactive" | string;
  created_at: string;
  updated_at: string;
};

export type AvatarProviderMetric = {
  id: string;
  organization_id: string;
  provider: string;
  demo_session_id: string | null;
  status: string;
  start_time_ms: number | null;
  session_duration_seconds: number | null;
  failed_reason: string | null;
  fallback_used: boolean;
  booking_created: boolean;
  lead_category: string | null;
  human_handoff: boolean;
  created_at: string;
};

export type AvatarSelectionResult = {
  provider: AvatarProviderId;
  fallbackProvider: AvatarProviderId;
  source:
    | "agent_fixed"
    | "routing_rule"
    | "org_default"
    | "best_performing"
    | "internal_fallback";
  routingRuleId?: string | null;
  routingRuleName?: string | null;
  reason?: string;
};

export type AvatarOrgSettings = {
  enable_ai_avatar?: boolean;
  default_avatar_provider?: AvatarProviderId;
  enable_smart_routing?: boolean;
  default_fallback_provider?: AvatarProviderId;
};

export const DEFAULT_AVATAR_ORG_SETTINGS: AvatarOrgSettings = {
  enable_ai_avatar: false,
  default_avatar_provider: "internal_card",
  enable_smart_routing: true,
  default_fallback_provider: "internal_card",
};

export const AVATAR_PROVIDER_LABELS: Record<AvatarProviderId, string> = {
  internal_card: "Internal animated presenter",
  tavus: "Tavus",
  did: "D-ID",
  heygen: "HeyGen",
  custom_future: "Custom (future)",
};
