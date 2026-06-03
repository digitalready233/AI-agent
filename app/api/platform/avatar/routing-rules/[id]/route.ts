import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canConfigureAvatarRouting } from "@/lib/avatar/avatar-permissions";
import { deleteAvatarRoutingRule } from "@/lib/avatar/routing-rules-data";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.manage");
  if (!canConfigureAvatarRouting(ctx.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await deleteAvatarRoutingRule(ctx.organization.id, id);
  return Response.json({ ok: true });
}
