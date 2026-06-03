import { z } from "zod";
import {
  deleteStaffAvailability,
  listStaffAvailability,
  saveStaffAvailability,
} from "@/lib/booking/staff-availability-data";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  staff_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  timezone: z.string().min(1).optional(),
  is_available: z.boolean().optional(),
  buffer_before_minutes: z.number().int().min(0).optional(),
  buffer_after_minutes: z.number().int().min(0).optional(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "settings.view");
  const rows = await listStaffAvailability(session.organization.id);
  return Response.json({ availability: rows });
}

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await import("@/lib/booking/settings-data").then((m) =>
    m.getBookingSettings(session.organization.id)
  );

  const now = new Date().toISOString();
  const saved = await saveStaffAvailability({
    id: parsed.data.id ?? crypto.randomUUID(),
    organization_id: session.organization.id,
    staff_id: parsed.data.staff_id,
    day_of_week: parsed.data.day_of_week,
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
    timezone: parsed.data.timezone ?? settings.timezone,
    is_available: parsed.data.is_available ?? true,
    buffer_before_minutes: parsed.data.buffer_before_minutes ?? 0,
    buffer_after_minutes: parsed.data.buffer_after_minutes ?? 0,
    created_at: now,
    updated_at: now,
  });

  return Response.json({ availability: saved }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await deleteStaffAvailability(session.organization.id, id);
  return Response.json({ ok: true });
}
