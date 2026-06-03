import {
  parseFollowUpRules,
  type CampaignFollowUpRules,
} from "@/lib/platform/campaign-types";
import type { Campaign } from "@/lib/platform/types";
import type { OutboundVoiceCampaignSettings, VoiceBusinessHours } from "./types";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_MINUTES = 240;
const DEFAULT_MAX_CONCURRENT = 2;

function parseVoiceSettingsRaw(raw: unknown): OutboundVoiceCampaignSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const bh =
    o.call_window && typeof o.call_window === "object"
      ? (o.call_window as VoiceBusinessHours)
      : undefined;
  return {
    call_window: bh,
    max_attempts:
      typeof o.max_attempts === "number" ? o.max_attempts : undefined,
    retry_delay_minutes:
      typeof o.retry_delay_minutes === "number"
        ? o.retry_delay_minutes
        : undefined,
    voicemail_behavior:
      o.voicemail_behavior === "leave_message" ||
      o.voicemail_behavior === "hangup" ||
      o.voicemail_behavior === "retry"
        ? o.voicemail_behavior
        : undefined,
    human_transfer_phone:
      typeof o.human_transfer_phone === "string"
        ? o.human_transfer_phone
        : o.human_transfer_phone === null
          ? null
          : undefined,
    max_concurrent_calls:
      typeof o.max_concurrent_calls === "number"
        ? o.max_concurrent_calls
        : undefined,
  };
}

/** Merge campaigns.voice_settings with follow_up_rules voice fields. */
export function getOutboundVoiceSettings(
  campaign: Campaign
): Required<
  Pick<
    OutboundVoiceCampaignSettings,
    | "max_attempts"
    | "retry_delay_minutes"
    | "voicemail_behavior"
    | "max_concurrent_calls"
  >
> &
  OutboundVoiceCampaignSettings {
  const rules = parseFollowUpRules(campaign.follow_up_rules) as CampaignFollowUpRules;
  const fromColumn = parseVoiceSettingsRaw(campaign.voice_settings);
  const fromRules = parseVoiceSettingsRaw(rules.voice_settings);

  const maxAttempts =
    fromColumn.max_attempts ??
    fromRules.max_attempts ??
    rules.max_attempts ??
    DEFAULT_MAX_ATTEMPTS;

  const retryMinutes =
    fromColumn.retry_delay_minutes ??
    fromRules.retry_delay_minutes ??
    rules.retry_delay_minutes ??
    (rules.delay_hours != null ? rules.delay_hours * 60 : DEFAULT_RETRY_MINUTES);

  return {
    call_window: fromColumn.call_window ?? fromRules.call_window,
    max_attempts: maxAttempts,
    retry_delay_minutes: retryMinutes,
    voicemail_behavior:
      fromColumn.voicemail_behavior ??
      fromRules.voicemail_behavior ??
      "retry",
    human_transfer_phone:
      fromColumn.human_transfer_phone ??
      fromRules.human_transfer_phone ??
      null,
    max_concurrent_calls:
      fromColumn.max_concurrent_calls ??
      fromRules.max_concurrent_calls ??
      rules.max_concurrent_calls ??
      DEFAULT_MAX_CONCURRENT,
  };
}

export function isWithinCallWindow(
  window: VoiceBusinessHours | undefined,
  now = new Date()
): boolean {
  if (!window?.start || !window?.end) return true;
  const tz = window.timezone ?? "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = fmt.formatToParts(now);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayNum = dayMap[weekday] ?? now.getDay();
    if (window.days?.length && !window.days.includes(dayNum)) return false;
    const current = `${hour}:${minute}`;
    const start = window.start;
    const end = window.end;
    if (start <= end) return current >= start && current <= end;
    return current >= start || current <= end;
  } catch {
    return true;
  }
}
