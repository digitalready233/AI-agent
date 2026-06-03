import { getCalendarSettings, saveCalendarSettings } from "@/lib/calendar/calendar-settings-data";
import type { CalendarSettings } from "@/lib/calendar/types";
import type { BookingSettings } from "./types";

export function calendarToBookingSettings(cal: CalendarSettings): BookingSettings {
  return {
    organization_id: cal.organization_id,
    default_booking_provider:
      cal.default_booking_provider === "both"
        ? "internal"
        : (cal.default_booking_provider as BookingSettings["default_booking_provider"]),
    timezone: cal.timezone,
    default_meeting_duration_minutes: cal.default_meeting_duration_minutes,
    minimum_notice_hours: cal.minimum_notice_hours,
    maximum_days_ahead: cal.maximum_days_ahead,
    buffer_before_minutes: cal.buffer_before_minutes,
    buffer_after_minutes: cal.buffer_after_minutes,
    slot_interval_minutes: cal.slot_interval_minutes,
    default_assigned_profile_id: cal.default_assigned_profile_id,
    updated_at: cal.updated_at,
  };
}

export async function getBookingSettings(
  organizationId: string
): Promise<BookingSettings> {
  const cal = await getCalendarSettings(organizationId);
  const settings = calendarToBookingSettings(cal);
  if (
    cal.default_booking_provider !== "internal" &&
    !cal.enable_google_calendar &&
    !cal.enable_calendly
  ) {
    settings.default_booking_provider = "internal";
  }
  return settings;
}

export async function saveBookingSettings(
  organizationId: string,
  patch: Partial<BookingSettings>
): Promise<BookingSettings> {
  const current = await getCalendarSettings(organizationId);
  const updated = await saveCalendarSettings({
    ...current,
    default_booking_provider: patch.default_booking_provider ?? "internal",
    timezone: patch.timezone ?? current.timezone,
    default_meeting_duration_minutes:
      patch.default_meeting_duration_minutes ?? current.default_meeting_duration_minutes,
    minimum_notice_hours: patch.minimum_notice_hours ?? current.minimum_notice_hours,
    maximum_days_ahead: patch.maximum_days_ahead ?? current.maximum_days_ahead,
    buffer_before_minutes: patch.buffer_before_minutes ?? current.buffer_before_minutes,
    buffer_after_minutes: patch.buffer_after_minutes ?? current.buffer_after_minutes,
    slot_interval_minutes: patch.slot_interval_minutes ?? current.slot_interval_minutes,
    default_assigned_profile_id:
      patch.default_assigned_profile_id !== undefined
        ? patch.default_assigned_profile_id
        : current.default_assigned_profile_id,
    enable_google_calendar: false,
    enable_calendly: false,
  });
  return calendarToBookingSettings(updated);
}
