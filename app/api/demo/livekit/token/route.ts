import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { withDemoPublicApi } from "@/lib/demo/demo-api";
import { getDemoSession } from "@/lib/demo/demo-data";
import {
  assertProspectCanJoin,
  assertStaffCanManageLiveKit,
  issueLiveKitParticipantToken,
} from "@/lib/demo/livekit-service";
import { isLiveKitEnvConfigured } from "@/lib/demo/demo-provider";
const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
  identity: z.string().max(120).optional(),
  name: z.string().max(120).optional(),
  role: z.enum(["prospect", "staff", "ai_observer"]).optional(),
  ensure_room: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!isLiveKitEnvConfigured()) {
    return Response.json(
      { error: "LiveKit not configured", internal_mode: true },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { demo_session_id: sessionId } = parsed.data;
  const role = parsed.data.role ?? "prospect";

  // Staff must be authenticated platform user
  if (role === "staff") {
    try {
      const ctx = await requireSession();
      requirePermission(ctx, "conversations.manage");
      const demo = await getDemoSession(sessionId);
      if (!demo || demo.organization_id !== ctx.organization.id) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      await assertStaffCanManageLiveKit(ctx, demo);
      const token = await issueLiveKitParticipantToken({
        sessionId,
        identity:
          parsed.data.identity?.trim() ||
          `staff-${ctx.userId.slice(0, 8)}`,
        name:
          parsed.data.name?.trim() ||
          ctx.profile.full_name?.trim() ||
          ctx.email ||
          "Team member",
        role: "staff",
        ensureRoom: parsed.data.ensure_room ?? true,
      });
      return Response.json({
        ok: true,
        livekit: {
          url: token.url,
          token: token.token,
          room_name: token.roomName,
          identity: token.identity,
          role: token.role,
        },
        livekit_url: token.url,
        livekit_room_status: token.livekit_room_status,
      });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Unauthorized" },
        { status: role === "staff" ? 403 : 400 }
      );
    }
  }

  // Prospect / public demo API
  return withDemoPublicApi(async () => {
    try {
      await assertProspectCanJoin(sessionId);
      const identity =
        parsed.data.identity?.trim() || `prospect-${sessionId.slice(0, 8)}`;
      const name = parsed.data.name?.trim() || "Guest";
      const token = await issueLiveKitParticipantToken({
        sessionId,
        identity,
        name,
        role: role === "ai_observer" ? "ai_observer" : "prospect",
        ensureRoom: parsed.data.ensure_room ?? true,
      });
      return {
        status: 200,
        body: {
          ok: true,
          livekit: {
            url: token.url,
            token: token.token,
            room_name: token.roomName,
            identity: token.identity,
            role: token.role,
          },
          livekit_url: token.url,
          livekit_room_status: token.livekit_room_status,
          internal_mode: false,
        },
      };
    } catch (e) {
      return {
        status: 400,
        body: {
          error: e instanceof Error ? e.message : "Token failed",
          internal_mode: true,
        },
      };
    }
  });
}
