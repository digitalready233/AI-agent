import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import { endDemoSession } from "@/lib/demo/end-demo-session";
import {
  assertStaffCanManageLiveKit,
  endLiveKitRoomForSession,
} from "@/lib/demo/livekit-service";
import { isLiveKitEnvConfigured } from "@/lib/demo/demo-provider";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
  end_demo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.manage");

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const demo = await getDemoSession(parsed.data.demo_session_id);
  if (!demo || demo.organization_id !== ctx.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await assertStaffCanManageLiveKit(ctx, demo);
    let session = demo;
    if (isLiveKitEnvConfigured() && demo.livekit_room_name) {
      session = await endLiveKitRoomForSession(demo.id, { endedBy: ctx.userId });
    }
    if (parsed.data.end_demo) {
      const ended = await endDemoSession({ demoSessionId: demo.id });
      session = (await getDemoSession(demo.id))!;
      return Response.json({ ok: true, session, summary: ended.summary });
    }
    return Response.json({ ok: true, session });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "End room failed" },
      { status: 400 }
    );
  }
}
