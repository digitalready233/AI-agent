import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { canUseAvatarInDemo } from "@/lib/avatar/avatar-permissions";
import { stopAvatarSessionForDemo } from "@/lib/avatar/avatar-session-service";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const run = async (organizationId: string) => {
    const updated = await stopAvatarSessionForDemo({
      demoSessionId: parsed.data.demo_session_id,
      organizationId,
    });
    return Response.json({
      ok: true,
      avatar_status: updated?.avatar_status ?? "stopped",
    });
  };

  try {
    const ctx = await requireSession();
    requirePermission(ctx, "conversations.manage");
    if (!canUseAvatarInDemo(ctx.profile.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return run(ctx.organization.id);
  } catch {
    if (!hasServiceRoleKey()) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await getDemoSession(parsed.data.demo_session_id);
    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return withPlatformAdmin(() => run(session.organization_id));
  }
}
