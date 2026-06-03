import { requireSession } from "@/lib/platform/auth";
import { listCampaignLogs } from "@/lib/platform/campaign-automation-data";
import { getCampaign } from "@/lib/platform/data";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organization } = await requireSession();
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign || campaign.organization_id !== organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? "100");
  const logs = await listCampaignLogs(id, Math.min(limit, 500));
  return Response.json({ logs });
}
