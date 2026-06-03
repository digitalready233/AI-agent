/** Campaign automation types and constants */

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "paused"
  | "completed"
  | "failed";

export type CampaignChannel = "whatsapp" | "email" | "voice" | "voice_future";

export type CampaignLeadSequenceStatus = "active" | "paused" | "completed" | "stopped";

export type CampaignLogStatus = "sent" | "failed" | "delivered" | "replied" | "skipped";

export type MessageTemplateStatus = "draft" | "approved" | "rejected" | "active";

export type DelayUnit = "minutes" | "hours" | "days";

export const CAMPAIGN_TYPE_OPTIONS = [
  { value: "new_lead_follow_up", label: "New lead follow-up" },
  { value: "hot_lead_follow_up", label: "Hot lead follow-up" },
  { value: "cold_lead_reactivation", label: "Cold lead reactivation" },
  { value: "missed_booking_follow_up", label: "Missed booking follow-up" },
  { value: "quote_follow_up", label: "Quote follow-up" },
  { value: "consultation_reminder", label: "Consultation reminder" },
  { value: "post_meeting_follow_up", label: "Post-meeting follow-up" },
  { value: "no_response_follow_up", label: "No response follow-up" },
  { value: "follow_up", label: "General follow-up (legacy)" },
  { value: "outbound", label: "Outbound outreach" },
  { value: "outbound_voice_campaign", label: "Outbound AI voice campaign" },
  { value: "nurture", label: "Nurture sequence" },
  { value: "reactivation", label: "Reactivation" },
] as const;

export const CAMPAIGN_CHANNEL_OPTIONS: { value: CampaignChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "voice", label: "Voice (AI outbound calls)" },
];

export function isVoiceCampaignChannel(
  channel: string | null | undefined
): boolean {
  return channel === "voice" || channel === "voice_future";
}

export const TEMPLATE_VARIABLES = [
  "{{full_name}}",
  "{{business_name}}",
  "{{service_interest}}",
  "{{booking_date}}",
  "{{assigned_staff}}",
  "{{company_name}}",
  "{{email}}",
  "{{phone}}",
] as const;

/** Stored in campaigns.follow_up_rules jsonb (legacy + counters) */
export type CampaignFollowUpRules = {
  message_template?: string;
  delay_hours?: number;
  max_attempts?: number;
  channel?: "whatsapp" | "email" | "sms" | "both" | "auto";
  whatsapp_template_id?: string;
  whatsapp_template_parameters?: string[];
  sent_count?: number;
  replied_count?: number;
  booking_conversions?: number;
  failed_count?: number;
  /** Max simultaneous outbound voice dials per org (default 2) */
  max_concurrent_calls?: number;
  /** Per-campaign outbound voice settings (also on campaigns.voice_settings) */
  voice_settings?: import("@/lib/voice/types").OutboundVoiceCampaignSettings;
  retry_delay_minutes?: number;
};

export function isOutboundVoiceCampaign(campaign: {
  channel?: string | null;
  campaign_type?: string | null;
}): boolean {
  return (
    isVoiceCampaignChannel(campaign.channel) ||
    campaign.campaign_type === "outbound_voice_campaign"
  );
}

export type CampaignAudienceFilters = {
  lead_statuses?: string[];
  lead_categories?: string[];
  sources?: string[];
  service_interests?: string[];
  assigned_to?: string | null;
  last_contacted_before?: string | null;
  last_contacted_after?: string | null;
  manual_lead_ids?: string[];
  require_marketing_opt_in?: boolean;
};

export type CampaignStopConditions = {
  stop_on_reply?: boolean;
  stop_on_booking?: boolean;
  stop_on_customer?: boolean;
  stop_on_disqualified?: boolean;
  stop_on_human_handoff?: boolean;
  stop_on_unsubscribe?: boolean;
  stop_keywords?: string[];
};

export const DEFAULT_STOP_CONDITIONS: CampaignStopConditions = {
  stop_on_reply: true,
  stop_on_booking: true,
  stop_on_customer: true,
  stop_on_disqualified: true,
  stop_on_human_handoff: true,
  stop_on_unsubscribe: true,
  stop_keywords: ["stop", "unsubscribe", "opt out", "opt-out"],
};

export interface MessageTemplate {
  id: string;
  organization_id: string;
  name: string;
  channel: CampaignChannel | string;
  campaign_type?: string | null;
  body: string;
  variables: string[];
  whatsapp_template_name?: string | null;
  status: MessageTemplateStatus;
  created_at: string;
  updated_at: string;
}

export interface CampaignStep {
  id: string;
  campaign_id: string;
  organization_id: string;
  step_order: number;
  delay_amount: number;
  delay_unit: DelayUnit;
  message_template_id?: string | null;
  message_body?: string | null;
  action_after_send?: string | null;
  stop_on_reply: boolean;
  mark_no_response: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignLog {
  id: string;
  organization_id: string;
  campaign_id: string;
  lead_id: string;
  campaign_step_id?: string | null;
  channel: string;
  message_sent?: string | null;
  status: CampaignLogStatus;
  error_message?: string | null;
  sent_at: string;
  replied_at?: string | null;
}

export function parseFollowUpRules(raw: unknown): CampaignFollowUpRules {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    message_template: typeof o.message_template === "string" ? o.message_template : undefined,
    delay_hours: typeof o.delay_hours === "number" ? o.delay_hours : undefined,
    max_attempts: typeof o.max_attempts === "number" ? o.max_attempts : undefined,
    channel:
      o.channel === "whatsapp" ||
      o.channel === "email" ||
      o.channel === "sms" ||
      o.channel === "both" ||
      o.channel === "auto"
        ? o.channel
        : undefined,
    whatsapp_template_id:
      typeof o.whatsapp_template_id === "string" ? o.whatsapp_template_id : undefined,
    whatsapp_template_parameters: Array.isArray(o.whatsapp_template_parameters)
      ? o.whatsapp_template_parameters.filter((p): p is string => typeof p === "string")
      : undefined,
    sent_count: typeof o.sent_count === "number" ? o.sent_count : 0,
    replied_count: typeof o.replied_count === "number" ? o.replied_count : 0,
    booking_conversions: typeof o.booking_conversions === "number" ? o.booking_conversions : 0,
    failed_count: typeof o.failed_count === "number" ? o.failed_count : 0,
    max_concurrent_calls:
      typeof o.max_concurrent_calls === "number" ? o.max_concurrent_calls : undefined,
    retry_delay_minutes:
      typeof o.retry_delay_minutes === "number" ? o.retry_delay_minutes : undefined,
    voice_settings:
      o.voice_settings && typeof o.voice_settings === "object"
        ? (o.voice_settings as import("@/lib/voice/types").OutboundVoiceCampaignSettings)
        : undefined,
  };
}

export function parseAudienceFilters(raw: unknown): CampaignAudienceFilters {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
  return {
    lead_statuses: arr(o.lead_statuses),
    lead_categories: arr(o.lead_categories),
    sources: arr(o.sources),
    service_interests: arr(o.service_interests),
    assigned_to: typeof o.assigned_to === "string" ? o.assigned_to : o.assigned_to === null ? null : undefined,
    last_contacted_before:
      typeof o.last_contacted_before === "string" ? o.last_contacted_before : undefined,
    last_contacted_after:
      typeof o.last_contacted_after === "string" ? o.last_contacted_after : undefined,
    manual_lead_ids: arr(o.manual_lead_ids),
    require_marketing_opt_in:
      typeof o.require_marketing_opt_in === "boolean" ? o.require_marketing_opt_in : true,
  };
}

export function parseStopConditions(raw: unknown): CampaignStopConditions {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STOP_CONDITIONS };
  const o = raw as Record<string, unknown>;
  return {
    stop_on_reply: o.stop_on_reply !== false,
    stop_on_booking: o.stop_on_booking !== false,
    stop_on_customer: o.stop_on_customer !== false,
    stop_on_disqualified: o.stop_on_disqualified !== false,
    stop_on_human_handoff: o.stop_on_human_handoff !== false,
    stop_on_unsubscribe: o.stop_on_unsubscribe !== false,
    stop_keywords: Array.isArray(o.stop_keywords)
      ? o.stop_keywords.filter((k): k is string => typeof k === "string")
      : DEFAULT_STOP_CONDITIONS.stop_keywords,
  };
}

export function delayToMs(amount: number, unit: DelayUnit): number {
  if (unit === "minutes") return amount * 60 * 1000;
  if (unit === "days") return amount * 24 * 60 * 60 * 1000;
  return amount * 60 * 60 * 1000;
}

export function addDelay(iso: string, amount: number, unit: DelayUnit): string {
  return new Date(new Date(iso).getTime() + delayToMs(amount, unit)).toISOString();
}
