import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getAvatarSessionStatusForDemo } from "@/lib/avatar/avatar-session-service";

export async function GET(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.view");

  const demoSessionId = new URL(req.url).searchParams.get("demo_session_id")?.trim();
  if (!demoSessionId) {
    return Response.json({ error: "demo_session_id required" }, { status: 400 });
  }

  const status = await getAvatarSessionStatusForDemo(
    demoSessionId,
    ctx.organization.id
  );
  return Response.json(status);
}
