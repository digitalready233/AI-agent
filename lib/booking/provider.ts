import { getBookingSettings } from "@/lib/calendar/calendar-settings-data";
import { getMeetingType, resolveMeetingTypeProvider } from "@/lib/calendar/meeting-types";
import { getGoogleCalendarConnectionStatus } from "@/lib/calendar/connection-status";
import { hasGoogleCalendarOAuth } from "@/lib/calendar/google-tokens";
import { testCalendlyConnection } from "@/lib/calendly/client";
import { hasCalendlyAccessToken } from "@/lib/calendly/credentials";
import type {
  BookingProvider,
  BookingProviderStatus,
  DefaultBookingProvider,
  MeetingType,
} from "@/lib/calendar/types";

export async function getBookingProviderStatus(
  organizationId: string
): Promise<BookingProviderStatus> {
  const settings = await getBookingSettings(organizationId);
  const google = await getGoogleCalendarConnectionStatus(organizationId);
  const calendlyToken = await hasCalendlyAccessToken(organizationId);
  const calendlyTest = calendlyToken
    ? await testCalendlyConnection(organizationId)
    : { ok: false as const };

  return {
    default_provider: settings.default_booking_provider,
    enable_google_calendar: settings.enable_google_calendar,
    enable_calendly: settings.enable_calendly,
    google,
    calendly: {
      connected: calendlyTest.ok,
      user_uri: calendlyTest.userUri ?? null,
      scheduling_url:
        settings.calendly_scheduling_url ?? calendlyTest.schedulingUrl ?? null,
      token_configured: calendlyToken,
    },
  };
}

export async function resolveActiveBookingProvider(
  organizationId: string,
  meetingTypeKey?: string
): Promise<BookingProvider | null> {
  const settings = await getBookingSettings(organizationId);
  const googleOk =
    settings.enable_google_calendar && (await hasGoogleCalendarOAuth(organizationId));
  const calendlyOk =
    settings.enable_calendly && (await hasCalendlyAccessToken(organizationId));

  let preferred: BookingProvider | "both" = settings.default_booking_provider;
  if (meetingTypeKey) {
    const mt = getMeetingType(settings.meeting_types, meetingTypeKey);
    if (mt) {
      preferred = resolveMeetingTypeProvider(mt, settings.default_booking_provider);
    }
  }

  if (preferred === "google_calendar" && googleOk) return "google_calendar";
  if (preferred === "calendly" && calendlyOk) return "calendly";
  if (preferred === "both") {
    if (googleOk) return "google_calendar";
    if (calendlyOk) return "calendly";
  }
  if (googleOk) return "google_calendar";
  if (calendlyOk) return "calendly";
  return null;
}

export function resolveCalendlyUrlForMeetingType(
  settings: Awaited<ReturnType<typeof getBookingSettings>>,
  meetingType: MeetingType
): string | null {
  if (meetingType.calendly_event_type_url?.trim()) {
    return meetingType.calendly_event_type_url.trim();
  }
  const match = settings.calendly_event_types.find(
    (e) => e.name.toLowerCase() === meetingType.label.toLowerCase()
  );
  if (match?.scheduling_url) return match.scheduling_url;
  return settings.calendly_scheduling_url?.trim() || null;
}

export function isProviderEnabled(
  defaultProvider: DefaultBookingProvider,
  provider: BookingProvider,
  enableGoogle: boolean,
  enableCalendly: boolean
): boolean {
  if (provider === "google_calendar") return enableGoogle;
  if (provider === "calendly") return enableCalendly;
  return false;
}
