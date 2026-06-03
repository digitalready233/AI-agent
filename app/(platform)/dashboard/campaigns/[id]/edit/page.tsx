import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/platform/auth";
import {
  getCampaign,
  getCampaignLeadIds,
  listAgents,
  listLeads,
} from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { CampaignBuilderForm } from "@/components/platform/campaign-builder-form";
import { CampaignRunPanel } from "@/components/platform/campaign-run-panel";
import { CampaignLogsPanel } from "@/components/platform/campaign-logs-panel";
import { isVoiceCampaignChannel, parseFollowUpRules } from "@/lib/platform/campaign-types";
import { getCampaignChannelStatus } from "@/lib/platform/campaign-runner";
import { VoiceCampaignResults } from "@/components/platform/voice-campaign-results";
import { VoiceCampaignWorkflow } from "@/components/platform/voice-campaign-workflow";
import { getVoiceCampaignResults } from "@/lib/voice/campaign-metrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  requirePermission(session, "campaigns.manage");
  const { id } = await params;

  const campaign = await getCampaign(id);
  if (!campaign || campaign.organization_id !== session.organization.id) {
    notFound();
  }

  const [agents, leads, leadIds, channelStatus] = await Promise.all([
    listAgents(session.organization.id),
    listLeads(session.organization.id),
    getCampaignLeadIds(id),
    getCampaignChannelStatus(session.organization.id),
  ]);

  const isVoice = isVoiceCampaignChannel(campaign.channel);
  const voiceResults = isVoice
    ? await getVoiceCampaignResults(session.organization.id, campaign.id)
    : null;

  return (
    <div className="platform-page">
      <PageHeader
        title={`Edit — ${campaign.name}`}
        description="Update audience, schedule, and follow-up rules."
        actions={
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link href="/dashboard/campaigns">Back to campaigns</Link>
          </Button>
        }
      />
      <div className="space-y-6 max-w-3xl">
        {isVoice && (
          <VoiceCampaignWorkflow
            hasLeads={leadIds.length > 0}
            hasAgent={Boolean(campaign.agent_id)}
            campaignSaved
            results={voiceResults}
          />
        )}

        <CampaignRunPanel
          campaignId={campaign.id}
          status={campaign.status}
          leadCount={leadIds.length}
          channelStatus={channelStatus}
          campaignChannel={campaign.channel}
        />
        <Card className="border-slate-800 bg-slate-900/30">
          <CardContent className="pt-6 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide">Sent</p>
              <p className="text-xl font-semibold text-white">
                {parseFollowUpRules(campaign.follow_up_rules).sent_count ?? 0}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide">Replies</p>
              <p className="text-xl font-semibold text-white">
                {parseFollowUpRules(campaign.follow_up_rules).replied_count ?? 0}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide">Failed</p>
              <p className="text-xl font-semibold text-white">
                {parseFollowUpRules(campaign.follow_up_rules).failed_count ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <CampaignBuilderForm
          campaign={campaign}
          initialLeadIds={leadIds}
          agents={agents}
          leads={leads}
        />
        {isVoice && (
          <VoiceCampaignResults
            organizationId={session.organization.id}
            campaignId={campaign.id}
          />
        )}

        <CampaignLogsPanel campaignId={campaign.id} isVoice={isVoice} />
      </div>
    </div>
  );
}
