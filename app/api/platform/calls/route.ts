import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { listCalls, type CallListFilters } from "@/lib/voice/call-data";

export async function GET(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");

  const { searchParams } = new URL(req.url);
  const filters: CallListFilters = {
    status: searchParams.get("status") ?? undefined,
    agent_id: searchParams.get("agent_id") ?? undefined,
    direction: searchParams.get("direction") ?? undefined,
    lead_category: searchParams.get("lead_category") ?? undefined,
    handoff_required:
      searchParams.get("handoff_required") === "true" ? true : undefined,
    from_date: searchParams.get("from_date") ?? undefined,
    to_date: searchParams.get("to_date") ?? undefined,
  };

  const calls = await listCalls(session.organization.id, filters);
  return Response.json({ calls });
}
