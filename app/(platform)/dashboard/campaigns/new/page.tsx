import Link from "next/link";
import { requireSession } from "@/lib/platform/auth";
import { listAgents, listLeads } from "@/lib/platform/data";
import { getCampaignChannelStatus } from "@/lib/platform/campaign-runner";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { CampaignBuilderForm } from "@/components/platform/campaign-builder-form";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

type SearchParams = Promise<{ voice?: string }>;

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const voiceMode = params.voice === "1" || params.voice === "true";

  const session = await requireSession();
  requirePermission(session, "campaigns.manage");

  const [agents, leads, channelStatus] = await Promise.all([
    listAgents(session.organization.id),
    listLeads(session.organization.id),
    getCampaignChannelStatus(session.organization.id),
  ]);

  return (
    <div className="platform-page">
      <PageHeader
        title={voiceMode ? "New voice outbound campaign" : "New sales campaign"}
        description={
          voiceMode
            ? "Select leads and an AI voice agent — the platform dials, qualifies, books, updates CRM, and summarizes each call."
            : "Choose an agent, select leads, schedule outreach, and define follow-up rules."
        }
        actions={
          <div className="flex gap-2">
            {!voiceMode && (
              <Button variant="outline" size="sm" className="rounded-xl" asChild>
                <Link href="/dashboard/campaigns/new?voice=1">
                  <Phone className="h-4 w-4 mr-1.5" />
                  Voice campaign
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/dashboard/campaigns">Back to campaigns</Link>
            </Button>
          </div>
        }
      />

      {voiceMode && !channelStatus.voice && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Configure Twilio voice under{" "}
          <Link href="/dashboard/integrations/voice" className="underline text-cyan-300">
            Integrations → Voice
          </Link>{" "}
          before dialing leads.
        </p>
      )}

      <CampaignBuilderForm
        agents={agents}
        leads={leads}
        defaultVoice={voiceMode}
      />
    </div>
  );
}
