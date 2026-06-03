import { getValidGoogleAccessToken } from "./google-tokens";

export interface CreateGoogleEventParams {
  organizationId: string;
  calendarId: string;
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  timezone: string;
  attendeeEmails: string[];
  addGoogleMeet?: boolean;
}

export async function createGoogleCalendarEvent(
  params: CreateGoogleEventParams
): Promise<{ eventId: string; htmlLink?: string }> {
  const accessToken = await getValidGoogleAccessToken(params.organizationId);
  if (!accessToken) {
    throw new Error("Google Calendar is not connected for this organization.");
  }

  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: params.startIso,
      timeZone: params.timezone,
    },
    end: {
      dateTime: params.endIso,
      timeZone: params.timezone,
    },
    attendees: params.attendeeEmails
      .filter(Boolean)
      .map((email) => ({ email })),
    reminders: { useDefault: true },
  };

  if (params.addGoogleMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const conferenceParam = params.addGoogleMeet ? "&conferenceDataVersion=1" : "";
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events?sendUpdates=all${conferenceParam}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { uri?: string }[] };
    error?: { message?: string };
  };

  if (!res.ok || !data.id) {
    throw new Error(
      data.error?.message ?? `Google Calendar API error (${res.status})`
    );
  }

  const meetLink =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e) => e.uri)?.uri;

  return { eventId: data.id, htmlLink: meetLink ?? data.htmlLink };
}

export async function fetchGoogleFreeBusy(params: {
  organizationId: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
  timezone: string;
}): Promise<{ start: string; end: string }[]> {
  const accessToken = await getValidGoogleAccessToken(params.organizationId);
  if (!accessToken) return [];

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      timeZone: params.timezone,
      items: [{ id: params.calendarId }],
    }),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };

  const busy = data.calendars?.[params.calendarId]?.busy ?? [];
  return busy;
}
