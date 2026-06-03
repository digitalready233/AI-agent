import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { jsonStore } from "@/lib/platform/json-store";
import { mergeMeetingTypes } from "./meeting-types";
import type {
  CalendarSettings,
  CalendlyEventTypeRef,
  MeetingType,
  StaffAvailabilityBlock,
} from "./types";

function defaultSettings(organizationId: string): CalendarSettings {
  const now = new Date().toISOString();
  return {
    organization_id: organizationId,
    timezone: "UTC",
    calendar_id: "primary",
    slot_interval_minutes: 30,
    buffer_minutes: 0,
    meeting_types: mergeMeetingTypes([]),
    staff_availability: [],
    updated_at: now,
    default_booking_provider: "internal",
    enable_google_calendar: true,
    enable_calendly: false,
    default_meeting_duration_minutes: 30,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    minimum_notice_hours: 2,
    maximum_days_ahead: 60,
    default_assigned_profile_id: null,
    enable_google_meet: true,
    connected_calendar_email: null,
    calendly_scheduling_url: null,
    calendly_event_types: [],
    round_robin_profile_ids: [],
    last_round_robin_index: 0,
  };
}

export async function getCalendarSettings(
  organizationId: string
): Promise<CalendarSettings> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("calendar_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      const fallback = await jsonStore.getCalendarSettings(organizationId);
      if (fallback) return normalizeSettings(fallback);
      return defaultSettings(organizationId);
    }

    if (!data) return defaultSettings(organizationId);
    return normalizeSettings(data as CalendarSettings);
  }

  const stored = await jsonStore.getCalendarSettings(organizationId);
  return stored ? normalizeSettings(stored) : defaultSettings(organizationId);
}

export const getBookingSettings = getCalendarSettings;

function normalizeCalendlyEventTypes(raw: unknown): CalendlyEventTypeRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        id: String(o.id ?? crypto.randomUUID()),
        name: String(o.name ?? "Event"),
        scheduling_url: String(o.scheduling_url ?? ""),
        duration_minutes:
          typeof o.duration_minutes === "number" ? o.duration_minutes : undefined,
      };
    })
    .filter((e) => e.scheduling_url.length > 0);
}

function normalizeSettings(raw: CalendarSettings): CalendarSettings {
  const bufferAfter =
    raw.buffer_after_minutes ?? raw.buffer_minutes ?? 0;
  const bufferBefore = raw.buffer_before_minutes ?? 0;

  return {
    ...raw,
    meeting_types: mergeMeetingTypes(raw.meeting_types),
    staff_availability: parseStaffAvailability(raw.staff_availability ?? []),
    default_booking_provider: raw.default_booking_provider ?? "google_calendar",
    enable_google_calendar: raw.enable_google_calendar ?? true,
    enable_calendly: raw.enable_calendly ?? false,
    default_meeting_duration_minutes: raw.default_meeting_duration_minutes ?? 30,
    buffer_before_minutes: bufferBefore,
    buffer_after_minutes: bufferAfter,
    buffer_minutes: raw.buffer_minutes ?? bufferAfter,
    minimum_notice_hours: raw.minimum_notice_hours ?? 2,
    maximum_days_ahead: raw.maximum_days_ahead ?? 60,
    default_assigned_profile_id: raw.default_assigned_profile_id ?? null,
    enable_google_meet: raw.enable_google_meet ?? true,
    connected_calendar_email: raw.connected_calendar_email ?? null,
    calendly_scheduling_url: raw.calendly_scheduling_url ?? null,
    calendly_event_types: normalizeCalendlyEventTypes(raw.calendly_event_types),
    round_robin_profile_ids: Array.isArray(raw.round_robin_profile_ids)
      ? raw.round_robin_profile_ids.filter((id): id is string => typeof id === "string")
      : [],
    last_round_robin_index:
      typeof raw.last_round_robin_index === "number" ? raw.last_round_robin_index : 0,
  };
}

export async function saveCalendarSettings(
  settings: CalendarSettings
): Promise<CalendarSettings> {
  const normalized = normalizeSettings({
    ...settings,
    updated_at: new Date().toISOString(),
  });

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("calendar_settings")
      .upsert(normalized)
      .select()
      .single();

    if (error) {
      await jsonStore.setCalendarSettings(normalized);
      return normalized;
    }
    return normalizeSettings(data as CalendarSettings);
  }

  await jsonStore.setCalendarSettings(normalized);
  return normalized;
}

export const saveBookingSettings = saveCalendarSettings;

export async function updateCalendarSettingsPartial(
  organizationId: string,
  patch: Partial<CalendarSettings>
): Promise<CalendarSettings> {
  const current = await getCalendarSettings(organizationId);
  return saveCalendarSettings({ ...current, ...patch });
}

export function parseStaffAvailability(
  blocks: StaffAvailabilityBlock[]
): StaffAvailabilityBlock[] {
  return blocks
    .filter(
      (b) =>
        b.day_of_week >= 0 &&
        b.day_of_week <= 6 &&
        /^\d{2}:\d{2}$/.test(b.start_time) &&
        /^\d{2}:\d{2}$/.test(b.end_time)
    )
    .map((b) => ({
      ...b,
      timezone: b.timezone?.trim() || "UTC",
      available: b.available !== false,
    }));
}

export function parseMeetingTypes(types: MeetingType[]): MeetingType[] {
  return mergeMeetingTypes(types);
}
