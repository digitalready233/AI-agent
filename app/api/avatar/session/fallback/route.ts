import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canForceAvatarFallback } from "@/lib/avatar/avatar-permissions";
import { activateAvatarFallback } from "@/lib/avatar/avatar-session-service";
import { getDemoSession } from "@/lib/demo/demo-data";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.manage");
  if (!canForceAvatarFallback(ctx.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const session = await getDemoSession(parsed.data.demo_session_id);
  if (!session || session.organization_id !== ctx.organization.id) {
    return Response.json({ error: "Demo not found" }, { status: 404 });
  }

  const updated = await activateAvatarFallback(
    session,
    parsed.data.reason ?? "Staff requested fallback to internal presenter"
  );
  return Response.json({
    ok: true,
    avatar_status: updated.avatar_status,
    avatar_error: updated.avatar_error,
  });
}
