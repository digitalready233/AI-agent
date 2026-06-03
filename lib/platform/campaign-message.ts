import type { Lead, Profile } from "./types";
import { brand } from "@/lib/config";
import type { Booking } from "./types";

/** Replace template variables in campaign messages. */
export function renderCampaignMessage(
  template: string,
  lead: Lead,
  extras?: {
    companyName?: string;
    assignedStaffName?: string | null;
    booking?: Booking | null;
  }
): string {
  const name = lead.full_name?.trim() || "there";
  const company =
    lead.business_name?.trim() || extras?.companyName || brand.name;
  const bookingDate =
    extras?.booking?.meeting_date && extras?.booking?.meeting_time
      ? `${extras.booking.meeting_date} ${extras.booking.meeting_time.slice(0, 5)}`
      : extras?.booking?.meeting_date ?? "";

  return template
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*full_name\s*\}\}/gi, name)
    .replace(/\{\{\s*email\s*\}\}/gi, lead.email ?? "")
    .replace(/\{\{\s*phone\s*\}\}/gi, lead.phone ?? "")
    .replace(/\{\{\s*company\s*\}\}/gi, company)
    .replace(/\{\{\s*company_name\s*\}\}/gi, extras?.companyName ?? brand.name)
    .replace(/\{\{\s*business\s*\}\}/gi, company)
    .replace(/\{\{\s*business_name\s*\}\}/gi, company)
    .replace(/\{\{\s*service\s*\}\}/gi, lead.service_interest ?? "our services")
    .replace(/\{\{\s*service_interest\s*\}\}/gi, lead.service_interest ?? "our services")
    .replace(/\{\{\s*booking_date\s*\}\}/gi, bookingDate)
    .replace(/\{\{\s*assigned_staff\s*\}\}/gi, extras?.assignedStaffName ?? "our team")
    .trim();
}

export function defaultCampaignTemplate(companyName?: string): string {
  const co = companyName ?? brand.name;
  return `Hi {{full_name}}, this is {{company_name}}. We wanted to follow up on your interest in {{service_interest}}. Reply here anytime if you'd like to book a quick call or learn more.`;
}

export function staffNameFromProfile(profile: Profile | null | undefined): string | null {
  return profile?.full_name?.trim() ?? null;
}
