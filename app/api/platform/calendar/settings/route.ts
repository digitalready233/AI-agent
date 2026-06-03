import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import {
  getCalendarSettings,
  saveCalendarSettings,
  parseMeetingTypes,
  parseStaffAvailability,
} from "@/lib/calendar/calendar-settings-data";

const putSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  calendar_id: z.string().min(1).max(256).optional(),
  slot_interval_minutes: z.number().int().min(15).max(120).optional(),
  buffer_minutes: z.number().int().min(0).max(60).optional(),
  meeting_types: z.array(z.record(z.unknown())).optional(),
  staff_availability: z.array(z.record(z.unknown())).optional(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");
  const settings = await getCalendarSettings(session.organization.id);
  return Response.json({ settings });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const current = await getCalendarSettings(session.organization.id);
  const body = parsed.data;

  const settings = await saveCalendarSettings({
    ...current,
    timezone: body.timezone ?? current.timezone,
    calendar_id: body.calendar_id ?? current.calendar_id,
    slot_interval_minutes:
      body.slot_interval_minutes ?? current.slot_interval_minutes,
    buffer_minutes: body.buffer_minutes ?? current.buffer_minutes,
    meeting_types: body.meeting_types
      ? parseMeetingTypes(body.meeting_types as never)
      : current.meeting_types,
    staff_availability: body.staff_availability
      ? parseStaffAvailability(body.staff_availability as never)
      : current.staff_availability,
  });

  return Response.json({ settings });
}
