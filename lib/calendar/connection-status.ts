import { getCalendarSettings } from "./calendar-settings-data";
import { getGoogleConnectedEmail, hasGoogleCalendarOAuth } from "./google-tokens";
import { isGoogleOAuthConfigured } from "./google-oauth";
import type { GoogleCalendarConnectionStatus } from "./types";

export async function getGoogleCalendarConnectionStatus(
  organizationId: string
): Promise<GoogleCalendarConnectionStatus> {
  const settings = await getCalendarSettings(organizationId);
  const connected = await hasGoogleCalendarOAuth(organizationId);
  const connected_email = connected
    ? await getGoogleConnectedEmail(organizationId)
    : null;

  return {
    connected,
    connected_email,
    calendar_id: settings.calendar_id,
    oauth_configured: isGoogleOAuthConfigured(),
  };
}
