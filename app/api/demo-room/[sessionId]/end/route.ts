import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { endDemoSession } from "@/lib/demo/end-demo-session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo room not configured." }, { status: 503 });
  }

  const { sessionId } = await params;

  return withPlatformAdmin(async () => {
    const session = await getDemoSession(sessionId);
    if (!session) {
      return Response.json({ error: "Demo not found" }, { status: 404 });
    }

    const result = await endDemoSession({ demoSessionId: sessionId, status: "completed" });
    return Response.json({ ok: true, summary: result.summary });
  });
}
