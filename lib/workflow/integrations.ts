import { booking } from "../config";

/** Flags for channel features — calendar & WhatsApp hooks are wired in lib/integrations. */
export function getIntegrationReadiness() {
  return {
    calendar: Boolean(
      booking.googleCalendarId?.trim() || process.env.GOOGLE_CALENDAR_ID?.trim()
    ),
    whatsapp: Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
        process.env.TWILIO_AUTH_TOKEN?.trim()
    ),
    crmWebhook: Boolean(process.env.CRM_WEBHOOK_URL?.trim()),
  };
}
