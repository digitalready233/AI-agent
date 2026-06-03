import { z } from "zod";
import { getInternalAvailableSlots } from "@/lib/booking/internal-slots";
import { requireSession } from "@/lib/platform/auth";
import { getAgent } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";

const querySchema = z.object({
  agentId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  date: z.string().min(10),
  meetingType: z.string().min(1),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    agentId: searchParams.get("agentId") ?? undefined,
    organizationId: searchParams.get("organizationId") ?? undefined,
    date: searchParams.get("date"),
    meetingType: searchParams.get("meetingType"),
  });

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let organizationId = parsed.data.organizationId;

  if (!organizationId && parsed.data.agentId) {
    const load = async () => {
      const agent = await getAgent(parsed.data.agentId!);
      return agent?.organization_id ?? null;
    };
    organizationId =
      (hasServiceRoleKey() ? await withPlatformAdmin(load) : await load()) ?? undefined;
  }

  if (!organizationId) {
    try {
      const session = await requireSession();
      organizationId = session.organization.id;
    } catch {
      return Response.json({ error: "organizationId or agentId required" }, { status: 400 });
    }
  }

  try {
    const load = () =>
      getInternalAvailableSlots({
        organizationId,
        dateIso: parsed.data.date,
        meetingTypeSlug: parsed.data.meetingType,
      });
    const result = hasServiceRoleKey()
      ? await withPlatformAdmin(load)
      : await load();
    return Response.json(result);
  } catch (err) {
    console.error("[GET /api/bookings/availability]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not load availability." },
      { status: 500 }
    );
  }
}
