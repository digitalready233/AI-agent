import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import { listDemoAgentAssignments } from "@/lib/demo/multi-agent/assignments-data";
import { listMultiAgentEvents } from "@/lib/demo/multi-agent/events-data";
import { getAgent } from "@/lib/platform/data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");
  const { id } = await params;

  const demo = await getDemoSession(id);
  if (!demo || demo.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [assignments, events] = await Promise.all([
    listDemoAgentAssignments(id),
    listMultiAgentEvents(id, { limit: 50 }),
  ]);

  const withNames = await Promise.all(
    assignments.map(async (a) => {
      const agent = await getAgent(a.agent_id);
      return {
        ...a,
        agent_name: agent?.name ?? a.agent_id,
      };
    })
  );

  return Response.json({
    multi_agent_enabled: demo.multi_agent_enabled ?? false,
    assignments: withNames,
    events,
    last_turn: demo.metadata?.multi_agent_last_turn ?? null,
  });
}
