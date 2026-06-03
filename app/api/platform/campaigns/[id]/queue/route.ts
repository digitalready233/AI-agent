import { NextRequest } from "next/server";
import { requireSession } from "@/lib/platform/auth";
import { getCampaign } from "@/lib/platform/data";
import { isOutboundVoiceCampaign } from "@/lib/platform/campaign-types";
import { listQueueForCampaign } from "@/lib/voice/outbound-queue-data";
import {
  processOutboundCallQueue,
  rebuildOutboundQueue,
  syncOutboundQueueForCampaign,
} from "@/lib/voice/outbound-queue";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign || campaign.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!isOutboundVoiceCampaign(campaign)) {
    return Response.json({ error: "Not a voice campaign" }, { status: 400 });
  }
  const queue = await listQueueForCampaign(id);
  return Response.json({ queue });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign || campaign.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!isOutboundVoiceCampaign(campaign)) {
    return Response.json({ error: "Not a voice campaign" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "sync" | "rebuild" | "dial";
  };

  if (body.action === "rebuild") {
    await rebuildOutboundQueue(id);
    const queue = await listQueueForCampaign(id);
    return Response.json({ ok: true, queue });
  }

  if (body.action === "dial") {
    const result = await processOutboundCallQueue(session.organization.id, {
      campaignId: id,
      limit: 15,
    });
    return Response.json({ ok: true, ...result });
  }

  const sync = await syncOutboundQueueForCampaign(id);
  const queue = await listQueueForCampaign(id);
  return Response.json({ ok: true, ...sync, queue });
}
