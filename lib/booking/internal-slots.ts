import { listBookings } from "@/lib/platform/data";
import type { Booking } from "@/lib/platform/types";
import { getMeetingTypeBySlug } from "./meeting-types-data";
import { getBookingSettings } from "./settings-data";
import { listStaffAvailability } from "./staff-availability-data";
import type { AvailableSlot } from "./types";

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatSlotLabel(startMins: number, tz: string): string {
  const h = Math.floor(startMins / 60);
  const m = startMins % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

function bookingRangeMinutes(b: Booking): { start: number; end: number } | null {
  if (b.start_time && b.end_time) {
    return {
      start: parseTimeToMinutes(b.start_time.slice(0, 5)),
      end: parseTimeToMinutes(b.end_time.slice(0, 5)),
    };
  }
  if (b.meeting_time && b.duration_minutes) {
    const start = parseTimeToMinutes(b.meeting_time.slice(0, 5));
    return { start, end: start + b.duration_minutes };
  }
  if (b.starts_at && b.ends_at) {
    const start = new Date(b.starts_at);
    const end = new Date(b.ends_at);
    return {
      start: start.getHours() * 60 + start.getMinutes(),
      end: end.getHours() * 60 + end.getMinutes(),
    };
  }
  return null;
}

function overlaps(
  slotStart: number,
  slotEnd: number,
  busyStart: number,
  busyEnd: number,
  bufferBefore: number,
  bufferAfter: number
): boolean {
  const a0 = slotStart - bufferBefore;
  const a1 = slotEnd + bufferAfter;
  const b0 = busyStart - bufferBefore;
  const b1 = busyEnd + bufferAfter;
  return a0 < b1 && a1 > b0;
}

export async function getInternalAvailableSlots(params: {
  organizationId: string;
  dateIso: string;
  meetingTypeSlug: string;
  staffId?: string | null;
}): Promise<{ timezone: string; slots: AvailableSlot[]; meetingTypeId: string }> {
  const settings = await getBookingSettings(params.organizationId);
  const meetingType = await getMeetingTypeBySlug(
    params.organizationId,
    params.meetingTypeSlug
  );
  if (!meetingType || meetingType.status !== "active") {
    throw new Error("Invalid meeting type");
  }

  const date = new Date(`${params.dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  const dayOfWeek = date.getDay();
  const tz = settings.timezone;
  const duration = meetingType.duration_minutes;
  const interval = settings.slot_interval_minutes;
  const staffFilter =
    params.staffId ??
    meetingType.assigned_staff ??
    settings.default_assigned_profile_id ??
    undefined;

  let windows = await listStaffAvailability(params.organizationId, staffFilter);
  if (windows.length === 0 && staffFilter) {
    windows = await listStaffAvailability(params.organizationId);
  }

  const dayWindows = windows.filter(
    (w) => w.is_available && w.day_of_week === dayOfWeek
  );

  if (dayWindows.length === 0) {
    return { timezone: tz, slots: [], meetingTypeId: meetingType.id };
  }

  const now = new Date();
  const minStart = new Date(
    now.getTime() + settings.minimum_notice_hours * 60 * 60 * 1000
  );
  const maxDate = new Date(now.getTime() + settings.maximum_days_ahead * 86400000);
  const dayStart = new Date(`${params.dateIso}T00:00:00`);
  if (dayStart > maxDate) {
    return { timezone: tz, slots: [], meetingTypeId: meetingType.id };
  }

  const allBookings = await listBookings(params.organizationId);
  const dayBookings = allBookings.filter((b) => {
    const d = b.meeting_date ?? b.starts_at?.slice(0, 10);
    return (
      d === params.dateIso &&
      b.status !== "cancelled" &&
      (!staffFilter || b.assigned_to === staffFilter)
    );
  });

  const busy = dayBookings
    .map(bookingRangeMinutes)
    .filter((x): x is { start: number; end: number } => Boolean(x));

  const slots: AvailableSlot[] = [];
  const seen = new Set<string>();

  for (const window of dayWindows) {
    const winStart = parseTimeToMinutes(window.start_time.slice(0, 5));
    const winEnd = parseTimeToMinutes(window.end_time.slice(0, 5));
    const bufBefore = Math.max(settings.buffer_before_minutes, window.buffer_before_minutes);
    const bufAfter = Math.max(settings.buffer_after_minutes, window.buffer_after_minutes);

    for (let start = winStart; start + duration <= winEnd; start += interval) {
      const end = start + duration;
      const slotIso = `${params.dateIso}T${minutesToTime(start)}:00`;
      const slotDate = new Date(slotIso);
      if (slotDate < minStart) continue;

      const conflict = busy.some((b) =>
        overlaps(start, end, b.start, b.end, bufBefore, bufAfter)
      );
      if (conflict) continue;

      const endIso = `${params.dateIso}T${minutesToTime(end)}:00`;
      const key = `${slotIso}|${endIso}`;
      if (seen.has(key)) continue;
      seen.add(key);

      slots.push({
        start: new Date(slotIso).toISOString(),
        end: new Date(endIso).toISOString(),
        label: formatSlotLabel(start, tz),
      });
    }
  }

  slots.sort((a, b) => a.start.localeCompare(b.start));
  return { timezone: tz, slots, meetingTypeId: meetingType.id };
}
