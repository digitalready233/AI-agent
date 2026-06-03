import { z } from "zod";
import { getMeetingTypeById } from "@/lib/booking/meeting-types-data";
import { requireSession } from "@/lib/platform/auth";
import { deleteBooking, listBookings, saveBooking } from "@/lib/platform/data";
import type { Booking, BookingStatus } from "@/lib/platform/types";

const bookingSchema = z.object({
  id: z.string().optional(),
  agent_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  conversation_id: z.string().uuid().optional().nullable(),
  meeting_type_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).optional(),
  customer_name: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional(),
  service_needed: z.string().optional(),
  meeting_date: z.string().optional().nullable(),
  meeting_time: z.string().optional().nullable(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  duration_minutes: z.number().optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  meeting_link: z.string().optional().nullable(),
  status: z
    .enum(["scheduled", "confirmed", "completed", "missed", "rescheduled", "cancelled"])
    .optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const { organization } = await requireSession();
  const bookings = await listBookings(organization.id);
  return Response.json({ bookings });
}

export async function POST(req: Request) {
  const { organization } = await requireSession();
  const parsed = bookingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const title =
    d.title ??
    (d.meeting_type_id
      ? (await getMeetingTypeById(organization.id, d.meeting_type_id))?.name
      : null) ??
    "Meeting";

  const now = new Date().toISOString();
  const booking: Booking = {
    id: crypto.randomUUID(),
    organization_id: organization.id,
    agent_id: d.agent_id ?? null,
    lead_id: d.lead_id ?? null,
    conversation_id: d.conversation_id ?? null,
    meeting_type_id: d.meeting_type_id ?? null,
    title,
    customer_name: d.customer_name ?? null,
    customer_email: d.customer_email ?? null,
    customer_phone: d.customer_phone ?? null,
    service_needed: d.service_needed ?? null,
    meeting_date: d.meeting_date ?? null,
    meeting_time: d.meeting_time ?? null,
    start_time: d.start_time ?? null,
    end_time: d.end_time ?? null,
    timezone: d.timezone ?? null,
    duration_minutes: d.duration_minutes ?? 30,
    assigned_to: d.assigned_to ?? null,
    meeting_link: d.meeting_link ?? null,
    provider: "internal",
    status: (d.status as BookingStatus) ?? "scheduled",
    notes: d.notes ?? null,
    created_at: now,
    updated_at: now,
  };

  const saved = await saveBooking(booking);
  return Response.json({ booking: saved }, { status: 201 });
}

export async function PUT(req: Request) {
  const { organization } = await requireSession();
  const parsed = bookingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  if (!d.id) {
    return Response.json({ error: "Booking id required" }, { status: 400 });
  }

  const all = await listBookings(organization.id);
  const existing = all.find((b) => b.id === d.id);
  if (!existing) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  const booking: Booking = {
    ...existing,
    title: d.title ?? existing.title,
    agent_id: d.agent_id !== undefined ? d.agent_id : existing.agent_id,
    lead_id: d.lead_id !== undefined ? d.lead_id : existing.lead_id,
    conversation_id: d.conversation_id !== undefined ? d.conversation_id : existing.conversation_id,
    meeting_type_id: d.meeting_type_id !== undefined ? d.meeting_type_id : existing.meeting_type_id,
    customer_name: d.customer_name ?? existing.customer_name,
    customer_email: d.customer_email ?? existing.customer_email,
    customer_phone: d.customer_phone ?? existing.customer_phone,
    service_needed: d.service_needed ?? existing.service_needed,
    meeting_date: d.meeting_date ?? existing.meeting_date,
    meeting_time: d.meeting_time ?? existing.meeting_time,
    start_time: d.start_time ?? existing.start_time,
    end_time: d.end_time ?? existing.end_time,
    timezone: d.timezone ?? existing.timezone,
    duration_minutes: d.duration_minutes ?? existing.duration_minutes,
    assigned_to: d.assigned_to !== undefined ? d.assigned_to : existing.assigned_to,
    meeting_link: d.meeting_link ?? existing.meeting_link,
    status: (d.status as BookingStatus) ?? existing.status,
    notes: d.notes ?? existing.notes,
    updated_at: new Date().toISOString(),
  };

  const saved = await saveBooking(booking);
  return Response.json({ booking: saved });
}

export async function DELETE(req: Request) {
  const { organization } = await requireSession();
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const all = await listBookings(organization.id);
  const existing = all.find((b) => b.id === id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const cancelOnly = new URL(req.url).searchParams.get("cancel") === "true";
  if (cancelOnly) {
    const saved = await saveBooking({
      ...existing,
      status: "cancelled",
      updated_at: new Date().toISOString(),
    });
    return Response.json({ booking: saved });
  }

  await deleteBooking(id);
  return Response.json({ ok: true });
}
