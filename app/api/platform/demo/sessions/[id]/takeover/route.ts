import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import { staffTakeOverDemo } from "@/lib/demo/demo-live-handoff";
import { canJoinLiveDemo } from "@/lib/demo/demo-takeover-permissions";

const bodySchema = z.object({
  notes: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.manage");

  if (!canJoinLiveDemo(ctx.profile.role)) {
    return Response.json({ error: "You cannot take over demos." }, { status: 403 });
  }

  const { id } = await params;
  const demo = await getDemoSession(id);
  if (!demo || demo.organization_id !== ctx.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await staffTakeOverDemo({
      ctx,
      demoSessionId: id,
      notes: parsed.data.notes,
    });
    return Response.json({ ok: true, session, ai_paused: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Takeover failed" },
      { status: 400 }
    );
  }
}
