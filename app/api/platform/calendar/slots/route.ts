import { z } from "zod";
import { getAgent } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getAvailableCalendarSlots } from "@/lib/calendar/slots";

const querySchema = z.object({
  agentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meetingType: z.string().min(1),
});

export async function GET(req: Request) {
  if (!hasServiceRoleKey()) {
    return Response.json(
      { error: "Calendar slots require server configuration." },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    agentId: url.searchParams.get("agentId"),
    date: url.searchParams.get("date"),
    meetingType: url.searchParams.get("meetingType"),
  });

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agent = await withPlatformAdmin(() => getAgent(parsed.data.agentId));
  if (!agent?.enabled) {
    return Response.json({ error: "Agent not found." }, { status: 404 });
  }

  const result = await withPlatformAdmin(() =>
    getAvailableCalendarSlots({
      organizationId: agent.organization_id,
      dateIso: parsed.data.date,
      meetingTypeKey: parsed.data.meetingType,
    })
  );

  return Response.json({
    ...result,
    meetingTypes: undefined,
  });
}
