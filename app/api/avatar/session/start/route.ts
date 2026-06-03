import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canUseAvatarInDemo } from "@/lib/avatar/avatar-permissions";
import { startAvatarSessionForDemo } from "@/lib/avatar/avatar-session-service";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.manage");
  if (!canUseAvatarInDemo(ctx.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await startAvatarSessionForDemo({
      demoSessionId: parsed.data.demo_session_id,
      organizationId: ctx.organization.id,
    });
    return Response.json({
      ok: true,
      avatar_status: session.avatar_status,
      avatar_provider: session.avatar_provider,
      avatar_stream_url: session.avatar_stream_url,
      avatar_join_url: session.avatar_join_url,
      avatar_error: session.avatar_error,
      avatar_session_id: session.avatar_session_id,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to start avatar" },
      { status: 500 }
    );
  }
}
