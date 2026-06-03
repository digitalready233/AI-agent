import { requireSession } from "@/lib/platform/auth";
import { getAgent, saveAgent } from "@/lib/platform/data";
import { readybotPlaybookForAgent } from "@/lib/platform/playbooks/digital-ready-readybot";
import { can } from "@/lib/platform/rbac";

/** Apply Digital Ready ReadyBot playbook fields to an existing agent. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!can(session.profile.role, "agents.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent || agent.organization_id !== session.organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const playbook = readybotPlaybookForAgent();
  const now = new Date().toISOString();
  const updated = await saveAgent({
    ...agent,
    ...playbook,
    channels: agent.channels.length ? agent.channels : ["website", "live_agent", "embed"],
    updated_at: now,
  });

  return Response.json({ agent: updated });
}
