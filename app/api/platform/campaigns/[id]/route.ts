import { requireSession } from "@/lib/platform/auth";
import { getCampaign, getCampaignLeadIds } from "@/lib/platform/data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organization } = await requireSession();
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign || campaign.organization_id !== organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const lead_ids = await getCampaignLeadIds(id);
  return Response.json({ campaign, lead_ids });
}
