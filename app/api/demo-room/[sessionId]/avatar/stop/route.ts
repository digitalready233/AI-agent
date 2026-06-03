import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { stopAvatarSessionForDemo } from "@/lib/avatar/avatar-session-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo room not configured." }, { status: 503 });
  }

  const { sessionId } = await params;

  return withPlatformAdmin(async () => {
    const { getDemoSession } = await import("@/lib/demo/demo-data");
    const session = await getDemoSession(sessionId);
    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await stopAvatarSessionForDemo({
      demoSessionId: sessionId,
      organizationId: session.organization_id,
    });

    return Response.json({
      ok: true,
      avatar_status: updated?.avatar_status ?? "stopped",
    });
  });
}
