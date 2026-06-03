import { listLiveCampaigns, listDueCampaignLeads } from "./campaign-automation-data";
import { processDueCampaignLead, activateScheduledCampaigns } from "./campaign-runner";

export type CampaignSchedulerResult = {
  activatedCampaigns: number;
  processedLeads: number;
  sent: number;
  failed: number;
  errors: string[];
};

/** Cron entry: activate due campaigns and run due sequence steps. */
export async function runCampaignScheduler(
  organizationId?: string
): Promise<CampaignSchedulerResult> {
  const activated = await activateScheduledCampaigns(organizationId);
  const due = await listDueCampaignLeads(organizationId);

  const result: CampaignSchedulerResult = {
    activatedCampaigns: activated,
    processedLeads: 0,
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const row of due) {
    result.processedLeads += 1;
    try {
      const stepResult = await processDueCampaignLead(row);
      if (stepResult.sent) result.sent += 1;
      if (stepResult.failed) result.failed += 1;
      if (stepResult.error) result.errors.push(stepResult.error);
    } catch (e) {
      result.failed += 1;
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Outbound voice queue (preferred for voice campaigns)
  const { listLiveCampaigns: listLive } = await import("./campaign-automation-data");
  const { isOutboundVoiceCampaign } = await import("./campaign-types");
  const liveAll = await listLive(organizationId);
  const { processOutboundCallQueue } = await import("@/lib/voice/outbound-queue");

  for (const c of liveAll) {
    if (!isOutboundVoiceCampaign(c) || c.status !== "live") continue;
    try {
      const q = await processOutboundCallQueue(c.organization_id, {
        campaignId: c.id,
        limit: 5,
      });
      result.sent += q.dialed;
      result.failed += q.failed;
      result.errors.push(...q.errors);
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Legacy: simple delay_hours campaigns without sequences
  const live = await listLiveCampaigns(organizationId);
  const { runCampaign } = await import("./campaign-runner");
  for (const c of live) {
    if (c.use_sequence) continue;
    if (isOutboundVoiceCampaign(c)) continue;
    if (c.status !== "live") continue;
    try {
      const r = await runCampaign(c.id, c.organization_id);
      result.sent += r.sent;
      result.failed += r.failed;
    } catch {
      /* skip campaigns not ready */
    }
  }

  return result;
}
