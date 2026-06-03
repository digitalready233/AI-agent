import { listBookings } from "@/lib/platform/data";
import { getCalendarSettings } from "./calendar-settings-data";
import { fetchGoogleFreeBusy } from "./google-calendar-api";
import { getMeetingType } from "./meeting-types";
import type { CalendarSlot } from "./types";

function parseTimeOnDate(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00`);
}

function formatSlotLabel(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
}

function overlaps(
  start: Date,
  end: Date,
  busy: { start: string; end: string }[]
): boolean {
  const s = start.getTime();
  const e = end.getTime();
  return busy.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return s < be && e > bs;
  });
}

export async function getAvailableCalendarSlots(params: {
  organizationId: string;
  dateIso: string;
  meetingTypeKey: string;
}): Promise<{
  configured: boolean;
  timezone: string;
  slots: CalendarSlot[];
  meetingTypeLabel: string;
  durationMinutes: number;
}> {
  const settings = await getCalendarSettings(params.organizationId);
  const meetingType = getMeetingType(settings.meeting_types, params.meetingTypeKey);
  if (!meetingType) {
    return {
      configured: false,
      timezone: settings.timezone,
      slots: [],
      meetingTypeLabel: params.meetingTypeKey,
      durationMinutes: settings.default_meeting_duration_minutes,
    };
  }

  const dateStr = params.dateIso.slice(0, 10);
  const requestedDate = new Date(`${dateStr}T12:00:00Z`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + settings.maximum_days_ahead);

  if (requestedDate < today || requestedDate > maxDate) {
    return {
      configured: true,
      timezone: settings.timezone,
      slots: [],
      meetingTypeLabel: meetingType.label,
      durationMinutes: meetingType.duration_minutes,
    };
  }

  const dayOfWeek = requestedDate.getUTCDay();
  const blocks = settings.staff_availability.filter(
    (b) => b.available !== false && b.day_of_week === dayOfWeek
  );

  const defaultBlocks =
    blocks.length > 0
      ? blocks
      : [
          { start_time: "09:00", end_time: "12:00" },
          { start_time: "13:00", end_time: "17:00" },
        ];

  const durationMs = meetingType.duration_minutes * 60_000;
  const intervalMs = settings.slot_interval_minutes * 60_000;
  const bufferBeforeMs = settings.buffer_before_minutes * 60_000;
  const bufferAfterMs = settings.buffer_after_minutes * 60_000;
  const minNoticeMs = settings.minimum_notice_hours * 60 * 60_000;

  const timeMin = `${dateStr}T00:00:00`;
  const timeMax = `${dateStr}T23:59:59`;

  const googleBusy = await fetchGoogleFreeBusy({
    organizationId: params.organizationId,
    calendarId: settings.calendar_id,
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    timezone: settings.timezone,
  });

  const allBookings = await listBookings(params.organizationId);
  const dayBookings = allBookings.filter((b) => {
    if (b.starts_at) {
      return b.starts_at.startsWith(dateStr);
    }
    return b.meeting_date === dateStr;
  });

  const bookingBusy = dayBookings
    .filter((b) => b.status === "scheduled" || b.status === "confirmed")
    .map((b) => {
      if (b.starts_at && b.ends_at) {
        return { start: b.starts_at, end: b.ends_at };
      }
      const start = `${dateStr}T${b.meeting_time ?? "09:00"}:00`;
      const endDate = new Date(start);
      endDate.setMinutes(endDate.getMinutes() + (b.duration_minutes ?? 30));
      return { start, end: endDate.toISOString() };
    });

  const busy = [...googleBusy, ...bookingBusy];
  const slots: CalendarSlot[] = [];
  const now = Date.now();

  for (const block of defaultBlocks) {
    let cursor = parseTimeOnDate(dateStr, block.start_time);
    const blockEnd = parseTimeOnDate(dateStr, block.end_time);

    while (cursor.getTime() + durationMs <= blockEnd.getTime()) {
      const slotStart = new Date(cursor.getTime() + bufferBeforeMs);
      const slotEnd = new Date(cursor.getTime() + durationMs + bufferAfterMs);
      const slotStartIso = slotStart.toISOString();
      const slotEndIso = slotEnd.toISOString();

      if (
        slotStart.getTime() >= now + minNoticeMs &&
        !overlaps(slotStart, slotEnd, busy)
      ) {
        slots.push({
          start: slotStartIso,
          end: slotEndIso,
          label: formatSlotLabel(slotStartIso, settings.timezone),
        });
      }

      cursor = new Date(cursor.getTime() + intervalMs);
    }
  }

  return {
    configured: true,
    timezone: settings.timezone,
    slots,
    meetingTypeLabel: meetingType.label,
    durationMinutes: meetingType.duration_minutes,
  };
}
