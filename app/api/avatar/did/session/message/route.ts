import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { isDemoAiPaused } from "@/lib/demo/demo-live-handoff";
import { canUseAvatarInDemo } from "@/lib/avatar/avatar-permissions";
import { sendDidMessageForDemo } from "@/lib/avatar/did-demo";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
  text: z.string().min(1).max(8000),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const run = async (organizationId: string) => {
    const session = await getDemoSession(parsed.data.demo_session_id);
    if (!session || session.organization_id !== organizationId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (isDemoAiPaused(session)) {
      return Response.json({ ok: false, skipped: true, reason: "ai_paused" });
    }
    const updated = await sendDidMessageForDemo({
      demoSessionId: parsed.data.demo_session_id,
      organizationId,
      text: parsed.data.text,
    });
    return Response.json({
      ok: true,
      avatar_status: updated.avatar_status,
      pending_speech:
        typeof updated.metadata?.did_pending_speech === "string"
          ? updated.metadata.did_pending_speech
          : null,
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
