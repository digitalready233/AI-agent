import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canUseAvatarInDemo } from "@/lib/avatar/avatar-permissions";
import { stopAvatarSessionForDemo } from "@/lib/avatar/avatar-session-service";

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

  const session = await stopAvatarSessionForDemo({
    demoSessionId: parsed.data.demo_session_id,
    organizationId: ctx.organization.id,
  });
  if (!session) {
    return Response.json({ error: "Demo not found" }, { status: 404 });
  }
  return Response.json({
    ok: true,
    avatar_status: session.avatar_status,
  });
}
