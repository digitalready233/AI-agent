import { z } from "zod";
import { getBookingSettings, saveBookingSettings } from "@/lib/booking/settings-data";
import { listMeetingTypes } from "@/lib/booking/meeting-types-data";
import { listStaffAvailability } from "@/lib/booking/staff-availability-data";
import { requireSession } from "@/lib/platform/auth";
import { listProfiles, saveProfile } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";

const putSchema = z.object({
  default_booking_provider: z.enum(["internal", "google_calendar", "calendly"]).optional(),
  timezone: z.string().optional(),
  default_meeting_duration_minutes: z.number().int().min(15).max(240).optional(),
  minimum_notice_hours: z.number().int().min(0).max(168).optional(),
  maximum_days_ahead: z.number().int().min(1).max(365).optional(),
  buffer_before_minutes: z.number().int().min(0).max(120).optional(),
  buffer_after_minutes: z.number().int().min(0).max(120).optional(),
  slot_interval_minutes: z.number().int().min(5).max(120).optional(),
  default_assigned_profile_id: z.string().uuid().nullable().optional(),
  profile_booking_emails: z.record(z.string().uuid(), z.string().max(320).nullable()).optional(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "settings.view");

  const orgId = session.organization.id;
  const [settings, meetingTypes, availability] = await Promise.all([
    getBookingSettings(orgId),
    listMeetingTypes(orgId, { includeInactive: true }),
    listStaffAvailability(orgId),
  ]);

  return Response.json({
    settings,
    meetingTypes,
    staffAvailability: availability,
    providers: {
      internal: true,
      google_calendar: false,
      calendly: false,
    },
  });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orgId = session.organization.id;
  const body = parsed.data;

  if (body.profile_booking_emails) {
    const profiles = await listProfiles(orgId);
    await Promise.all(
      Object.entries(body.profile_booking_emails).map(async ([profileId, email]) => {
        const profile = profiles.find((p) => p.id === profileId);
        if (!profile) return;
        await saveProfile({ ...profile, booking_email: email?.trim() || null });
      })
    );
  }

  const updated = await saveBookingSettings(orgId, {
    ...body,
    default_booking_provider: body.default_booking_provider ?? "internal",
  });

  return Response.json({ settings: updated });
}
