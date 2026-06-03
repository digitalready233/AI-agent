import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { getAgent } from "@/lib/platform/data";
import { getDidSessionCredentialsForDemo } from "@/lib/avatar/did-demo";

export async function GET(
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
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (session.avatar_provider !== "did") {
      return Response.json({ error: "Session is not using D-ID" }, { status: 400 });
    }

    const agent = session.agent_id ? await getAgent(session.agent_id) : null;
    if (!agent) {
      return Response.json({ error: "Agent not found" }, { status: 404 });
    }

    try {
      const creds = await getDidSessionCredentialsForDemo({
        demoSessionId: sessionId,
        organizationId: session.organization_id,
        agent,
      });
      return Response.json({
        ok: true,
        agent_id: creds.agent_id,
        client_key: creds.client_key,
        did_agent_id: session.did_agent_id ?? creds.agent_id,
      });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Failed to load D-ID credentials" },
        { status: 502 }
      );
    }
  });
}
