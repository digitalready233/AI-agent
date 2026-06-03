import { requireSession } from "@/lib/platform/auth";
import { getCampaign } from "@/lib/platform/data";
import { runCampaign } from "@/lib/platform/campaign-runner";
import { requirePermission } from "@/lib/platform/rbac";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "campaigns.manage");

  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign || campaign.organization_id !== session.organization.id) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  let force = false;
  try {
    const body = await req.json();
    force = Boolean(body?.force);
  } catch {
    // empty body is fine
  }

  try {
    const result = await runCampaign(id, session.organization.id, { force });
    return Response.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Campaign run failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
