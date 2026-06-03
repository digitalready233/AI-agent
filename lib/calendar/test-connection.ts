import { fetchGoogleFreeBusy } from "./google-calendar-api";
import { getCalendarSettings } from "./calendar-settings-data";
import { getValidGoogleAccessToken } from "./google-tokens";

export async function testGoogleCalendarConnection(
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidGoogleAccessToken(organizationId);
  if (!token) {
    return { ok: false, error: "Google Calendar is not connected." };
  }

  const settings = await getCalendarSettings(organizationId);
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60_000);

  try {
    await fetchGoogleFreeBusy({
      organizationId,
      calendarId: settings.calendar_id,
      timeMin: now.toISOString(),
      timeMax: later.toISOString(),
      timezone: settings.timezone,
    });
    return { ok: true };
  } catch (err) {
    console.error("[testGoogleCalendarConnection]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Calendar test failed",
    };
  }
}
