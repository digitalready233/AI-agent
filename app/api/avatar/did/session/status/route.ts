import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { getAvatarSessionStatusForDemo } from "@/lib/avatar/avatar-session-service";

export async function GET(req: Request) {
  const demoSessionId = new URL(req.url).searchParams.get("demo_session_id")?.trim();
  if (!demoSessionId) {
    return Response.json({ error: "demo_session_id required" }, { status: 400 });
  }

  const respond = async (organizationId: string) => {
    const session = await getDemoSession(demoSessionId);
    if (!session || session.organization_id !== organizationId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const remote = await getAvatarSessionStatusForDemo(demoSessionId, organizationId);
    return Response.json({
      ...remote,
      did_agent_id: session.did_agent_id,
      did_stream_id: session.did_stream_id,
      did_session_id: session.did_session_id,
      avatar_provider: session.avatar_provider,
    });
  };

  try {
    const ctx = await requireSession();
    requirePermission(ctx, "conversations.view");
    return respond(ctx.organization.id);
  } catch {
    if (!hasServiceRoleKey()) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await getDemoSession(demoSessionId);
    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return withPlatformAdmin(() => respond(session.organization_id));
  }
}
