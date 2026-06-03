import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import {
  assertStaffCanManageLiveKit,
  ensureLiveKitRoomForSession,
} from "@/lib/demo/livekit-service";
import { isLiveKitEnvConfigured } from "@/lib/demo/demo-provider";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
});

export async function POST(req: Request) {
  if (!isLiveKitEnvConfigured()) {
    return Response.json({ error: "LiveKit is not configured" }, { status: 503 });
  }

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
    const result = await ensureLiveKitRoomForSession(demo.id, {
      createdBy: ctx.userId,
    });
    return Response.json({
      ok: true,
      created: result.created,
      room_name: result.roomName,
      livekit_room_status: result.session.livekit_room_status,
      video_provider: result.session.video_provider,
      session_id: result.session.id,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Create room failed" },
      { status: 400 }
    );
  }
}
