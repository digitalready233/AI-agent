import { z } from "zod";
import { listMeetingTypes } from "@/lib/booking/meeting-types-data";
import { getBookingSettings } from "@/lib/booking/settings-data";
import { getAgent } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";

const querySchema = z.object({
  agentId: z.string().uuid(),
});

export async function GET(req: Request) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Not configured." }, { status: 503 });
  }

  const agentId = new URL(req.url).searchParams.get("agentId");
  const parsed = querySchema.safeParse({ agentId });
  if (!parsed.success) {
    return Response.json({ error: "agentId required" }, { status: 400 });
  }

  const agent = await withPlatformAdmin(() => getAgent(parsed.data.agentId));
  if (!agent?.enabled) {
    return Response.json({ error: "Agent not found." }, { status: 404 });
  }

  const [types, settings] = await withPlatformAdmin(() =>
    Promise.all([
      listMeetingTypes(agent.organization_id),
      getBookingSettings(agent.organization_id),
    ])
  );

  return Response.json({
    meetingTypes: types.map((t) => ({
      key: t.slug,
      id: t.id,
      label: t.name,
      description: t.description ?? "",
      duration_minutes: t.duration_minutes,
    })),
    timezone: settings.timezone,
  });
}
