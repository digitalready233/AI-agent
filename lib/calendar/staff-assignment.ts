import { saveCalendarSettings } from "./calendar-settings-data";
import type { CalendarSettings, MeetingType } from "./types";
import type { Conversation, Profile } from "@/lib/platform/types";

const BOOKABLE_ROLES = new Set([
  "sales_agent",
  "sales_manager",
  "company_admin",
  "super_admin",
]);

export function profileBookingEmail(profile: Profile): string | null {
  const email = (profile as Profile & { booking_email?: string | null }).booking_email;
  return email?.trim() || null;
}

function bookableProfiles(profiles: Profile[]): Profile[] {
  return profiles.filter((p) => BOOKABLE_ROLES.has(p.role));
}

function resolveRoundRobinPool(
  settings: CalendarSettings,
  profiles: Profile[]
): Profile[] {
  const bookable = bookableProfiles(profiles);
  const configured = (settings.round_robin_profile_ids ?? [])
    .map((id) => bookable.find((p) => p.id === id))
    .filter((p): p is Profile => Boolean(p));

  return configured.length > 0 ? configured : bookable;
}

export async function assignStaffForBooking(params: {
  organizationId: string;
  settings: CalendarSettings;
  meetingType: MeetingType;
  conversation: Conversation;
  profiles: Profile[];
}): Promise<{
  profileId: string | null;
  staffEmail: string | null;
  roundRobinUsed: boolean;
}> {
  const { settings, meetingType, conversation, profiles } = params;

  const pick = (profileId: string | null) => {
    if (!profileId) return { profileId: null, staffEmail: null, roundRobinUsed: false };
    const profile = profiles.find((p) => p.id === profileId);
    return {
      profileId,
      staffEmail: profile ? profileBookingEmail(profile) : null,
      roundRobinUsed: false,
    };
  };

  if (meetingType.assigned_profile_id) {
    return pick(meetingType.assigned_profile_id);
  }

  if (conversation.assigned_to) {
    return pick(conversation.assigned_to);
  }

  if (settings.default_assigned_profile_id) {
    return pick(settings.default_assigned_profile_id);
  }

  const pool = resolveRoundRobinPool(settings, profiles);
  if (pool.length === 0) {
    return { profileId: null, staffEmail: null, roundRobinUsed: false };
  }

  const index =
    ((settings.last_round_robin_index ?? 0) % pool.length + pool.length) % pool.length;
  const chosen = pool[index];

  await saveCalendarSettings({
    ...settings,
    last_round_robin_index: index + 1,
  });

  return {
    profileId: chosen.id,
    staffEmail: profileBookingEmail(chosen),
    roundRobinUsed: true,
  };
}
