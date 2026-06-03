import { LEAD_STATUS_LABELS } from "./sales-ops";
import type { LeadStatus } from "./types";
import type {
  AgentDefaultsSettings,
  ApiSettings,
  DemoProviderSettings,
  BillingSettings,
  DataPrivacySettings,
  HumanHandoffSettings,
  LeadScoringSettings,
  NotificationsSettings,
  OrganizationSettingsRecord,
  PipelineStatusConfig,
  SalesPipelineSettings,
  SecuritySettings,
  TeamSettings,
  WorkspaceSettings,
} from "./settings-types";

const LEAD_STATUS_ORDER: LeadStatus[] = [
  "created",
  "open",
  "working",
  "qualified",
  "disqualified",
  "opportunity_created",
  "opportunity_lost",
  "customer",
];

export function defaultPipelineStatuses(): PipelineStatusConfig[] {
  return LEAD_STATUS_ORDER.map((key) => ({
    key,
    label: LEAD_STATUS_LABELS[key],
    enabled: true,
  }));
}

export const DEFAULT_WORKSPACE: WorkspaceSettings = {
  default_language: "en",
  default_timezone: "Africa/Accra",
  date_format: "MMM d, yyyy",
  time_format: "24h",
  default_dashboard_view: "overview",
  default_lead_owner_id: null,
};

export const DEFAULT_AGENT_DEFAULTS: AgentDefaultsSettings = {
  default_tone: "professional",
  default_role: "sales",
  default_welcome_message:
    "Hi! How are you doing? What's your name, please — and how can I help you today?",
  default_fallback_response:
    "I'm not sure I have the right answer for that. Let me connect you with a teammate who can help.",
  default_qualification_prompt: "",
  default_objection_prompt: "",
  default_booking_message:
    "I'd love to schedule a quick call. What day and time work best for you?",
  default_handoff_message:
    "I'm connecting you with a member of our team who can help you directly.",
};

export const DEFAULT_SALES_PIPELINE: SalesPipelineSettings = {
  statuses: defaultPipelineStatuses(),
  default_status: "created",
};

export const DEFAULT_LEAD_SCORING: LeadScoringSettings = {
  need_min: 0,
  need_max: 25,
  budget_min: 0,
  budget_max: 25,
  authority_min: 0,
  authority_max: 25,
  timeline_min: 0,
  timeline_max: 25,
  hot_threshold: 75,
  warm_threshold: 50,
  cold_threshold: 25,
  auto_qualify_rules:
    "Auto-qualify when total BANT score >= warm threshold and timeline score >= 15.",
};

export const DEFAULT_HUMAN_HANDOFF: HumanHandoffSettings = {
  enabled: true,
  triggers: {
    customer_asks_human: true,
    lead_becomes_hot: true,
    ready_to_pay: true,
    custom_pricing: true,
    complaint_detected: true,
    ai_confidence_low: true,
  },
  default_department: "Sales",
  default_message: "A team member will join this conversation shortly.",
  notification_channel: "dashboard",
};

export const DEFAULT_NOTIFICATIONS: NotificationsSettings = {
  events: {
    new_hot_lead: true,
    new_qualified_lead: true,
    new_booking: true,
    human_handoff_required: true,
    complaint_detected: true,
    follow_up_due: true,
    integration_error: true,
    daily_summary: false,
    weekly_report: true,
  },
  channels: {
    email: true,
    slack: false,
    whatsapp: false,
    dashboard: true,
  },
};

export const DEFAULT_SECURITY: SecuritySettings = {
  session_timeout_minutes: 480,
  require_2fa: false,
};

export const DEFAULT_BILLING: BillingSettings = {
  plan_name: "Trial",
  agents_allowed: 2,
  subscription_status: "trial",
  trial_ends_at: null,
  paystack_reference: null,
  paid_at: null,
};

export const DEFAULT_DATA_PRIVACY: DataPrivacySettings = {
  retention_days: 365,
  privacy_policy_url: "",
  consent_message:
    "By continuing, you agree to our privacy policy and consent to us storing conversation data to improve your experience.",
};

export const DEFAULT_DEMO_ROOM: DemoProviderSettings = {
  provider: "internal",
  default_demo_provider: "internal",
  enable_voice_demo: true,
  enable_human_takeover: true,
  enable_recording_placeholder: false,
  enable_transcript: true,
  default_demo_agent_id: null,
  demo_session_timeout_minutes: 90,
  demo_room_branding: {},
  connection_status: "not_configured",
};

export const DEFAULT_API_SETTINGS: ApiSettings = {
  webhook_events_enabled: [
    "lead.created",
    "lead.qualified",
    "conversation.handoff",
    "booking.created",
  ],
  demo_room: { ...DEFAULT_DEMO_ROOM },
};

export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  pending_invites: [],
};

export function defaultOrganizationSettings(
  organizationId: string
): OrganizationSettingsRecord {
  const now = new Date().toISOString();
  return {
    organization_id: organizationId,
    workspace: { ...DEFAULT_WORKSPACE },
    agent_defaults: { ...DEFAULT_AGENT_DEFAULTS },
    sales_pipeline: {
      statuses: defaultPipelineStatuses(),
      default_status: DEFAULT_SALES_PIPELINE.default_status,
    },
    lead_scoring: { ...DEFAULT_LEAD_SCORING },
    human_handoff: {
      ...DEFAULT_HUMAN_HANDOFF,
      triggers: { ...DEFAULT_HUMAN_HANDOFF.triggers },
    },
    notifications: {
      events: { ...DEFAULT_NOTIFICATIONS.events },
      channels: { ...DEFAULT_NOTIFICATIONS.channels },
    },
    security: { ...DEFAULT_SECURITY },
    billing: {
      ...DEFAULT_BILLING,
      trial_ends_at: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d.toISOString();
      })(),
    },
    data_privacy: { ...DEFAULT_DATA_PRIVACY },
    api_settings: {
      webhook_events_enabled: [...DEFAULT_API_SETTINGS.webhook_events_enabled],
      demo_room: { ...DEFAULT_DEMO_ROOM },
    },
    team_settings: { pending_invites: [] },
    updated_at: now,
  };
}

export function mergeSettings(
  organizationId: string,
  partial: Partial<OrganizationSettingsRecord> | null
): OrganizationSettingsRecord {
  const base = defaultOrganizationSettings(organizationId);
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    organization_id: organizationId,
    workspace: { ...base.workspace, ...(partial.workspace ?? {}) },
    agent_defaults: { ...base.agent_defaults, ...(partial.agent_defaults ?? {}) },
    sales_pipeline: {
      ...base.sales_pipeline,
      ...(partial.sales_pipeline ?? {}),
      statuses:
        partial.sales_pipeline?.statuses ?? base.sales_pipeline.statuses,
    },
    lead_scoring: { ...base.lead_scoring, ...(partial.lead_scoring ?? {}) },
    human_handoff: {
      ...base.human_handoff,
      ...(partial.human_handoff ?? {}),
      triggers: {
        ...base.human_handoff.triggers,
        ...(partial.human_handoff?.triggers ?? {}),
      },
    },
    notifications: {
      events: {
        ...base.notifications.events,
        ...(partial.notifications?.events ?? {}),
      },
      channels: {
        ...base.notifications.channels,
        ...(partial.notifications?.channels ?? {}),
      },
    },
    security: { ...base.security, ...(partial.security ?? {}) },
    billing: { ...base.billing, ...(partial.billing ?? {}) },
    data_privacy: { ...base.data_privacy, ...(partial.data_privacy ?? {}) },
    api_settings: {
      ...base.api_settings,
      ...(partial.api_settings ?? {}),
      webhook_events_enabled:
        partial.api_settings?.webhook_events_enabled ??
        base.api_settings.webhook_events_enabled,
      demo_room: {
        ...(base.api_settings.demo_room ?? DEFAULT_DEMO_ROOM),
        ...(partial.api_settings?.demo_room ?? {}),
      } as DemoProviderSettings,
    },
    team_settings: {
      pending_invites:
        partial.team_settings?.pending_invites ??
        base.team_settings.pending_invites,
    },
    updated_at: partial.updated_at ?? base.updated_at,
  };
}
