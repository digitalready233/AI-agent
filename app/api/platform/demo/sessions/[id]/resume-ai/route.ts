import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import { staffResumeAiDemo } from "@/lib/demo/demo-live-handoff";
import { canJoinLiveDemo } from "@/lib/demo/demo-takeover-permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.manage");

  if (!canJoinLiveDemo(ctx.profile.role)) {
    return Response.json({ error: "You cannot control demo takeover." }, { status: 403 });
  }

  const { id } = await params;
  const demo = await getDemoSession(id);
  if (!demo || demo.organization_id !== ctx.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const session = await staffResumeAiDemo({ ctx, demoSessionId: id });
    return Response.json({ ok: true, session, ai_paused: false });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Resume failed" },
      { status: 400 }
    );
  }
}
