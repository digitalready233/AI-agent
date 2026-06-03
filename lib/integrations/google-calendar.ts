import { booking } from "../config";
import type { CalendarSlot } from "@/lib/calendar/types";

export type { CalendarSlot };

/** Legacy demo-agent slots (env service account). Platform booking uses `@/lib/calendar/slots`. */
export async function getAvailableSlots(
  dateIso?: string
): Promise<{ configured: boolean; slots: CalendarSlot[] }> {
  if (!booking.googleCalendarId || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const base = dateIso ? new Date(dateIso) : new Date();
    const day = base.toISOString().slice(0, 10);
    return {
      configured: false,
      slots: [
        { start: `${day}T10:00:00`, end: `${day}T10:30:00`, label: "10:00 AM" },
        { start: `${day}T14:00:00`, end: `${day}T14:30:00`, label: "2:00 PM" },
        { start: `${day}T16:00:00`, end: `${day}T16:30:00`, label: "4:00 PM" },
      ],
    };
  }
  return { configured: true, slots: [] };
}

/** Legacy demo-agent event insert. Platform booking uses `createGoogleCalendarEvent`. */
export async function createCalendarEvent(params: {
  summary: string;
  description: string;
  start: string;
  end: string;
  attendeeEmail: string;
}): Promise<{ eventId?: string; configured: boolean }> {
  if (!booking.googleCalendarId || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return { configured: false };
  }
  return { configured: true, eventId: `evt_stub_${Date.now()}` };
}
