import { z } from "zod";
import {
  deleteMeetingType,
  listMeetingTypes,
  saveMeetingType,
} from "@/lib/booking/meeting-types-data";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional().nullable(),
  duration_minutes: z.number().int().min(5).max(480),
  provider: z.enum(["internal", "google_calendar", "calendly"]).optional(),
  location_type: z
    .enum(["phone_call", "google_meet", "zoom", "office", "custom"])
    .optional(),
  assigned_staff: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  sort_order: z.number().int().optional(),
});

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "settings.view");
  const types = await listMeetingTypes(session.organization.id, {
    includeInactive: true,
  });
  return Response.json({ meetingTypes: types });
}

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const slug =
    parsed.data.slug ??
    parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const now = new Date().toISOString();
  const saved = await saveMeetingType({
    id: parsed.data.id ?? crypto.randomUUID(),
    organization_id: session.organization.id,
    slug,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    duration_minutes: parsed.data.duration_minutes,
    provider: parsed.data.provider ?? "internal",
    location_type: parsed.data.location_type ?? "phone_call",
    assigned_staff: parsed.data.assigned_staff ?? null,
    status: parsed.data.status ?? "active",
    sort_order: parsed.data.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  });

  return Response.json({ meetingType: saved }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  requirePermission(session, "settings.manage");
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await deleteMeetingType(session.organization.id, id);
  return Response.json({ ok: true });
}
