import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { requestDemoHumanHandoff } from "@/lib/demo/request-handoff";

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
    if (session.status === "completed" || session.status === "cancelled") {
      return Response.json({ error: "Demo has ended" }, { status: 400 });
    }

    const result = await requestDemoHumanHandoff({
      demoSessionId: sessionId,
      requestedBy: "prospect",
    });

    return Response.json({
      ok: true,
      handoff_required: result.handoff_required,
      status: "human_taken_over",
    });
  });
}
