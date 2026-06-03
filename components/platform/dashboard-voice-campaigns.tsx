import Link from "next/link";
import { listCampaigns } from "@/lib/platform/data";
import { isVoiceCampaignChannel } from "@/lib/platform/campaign-types";
import { getVoiceCampaignResults } from "@/lib/voice/campaign-metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function DashboardVoiceCampaigns({ orgId }: { orgId: string }) {
  const campaigns = await listCampaigns(orgId);
  const voice = campaigns.filter((c) => isVoiceCampaignChannel(c.channel));

  if (voice.length === 0) return null;

  const summaries = await Promise.all(
    voice.slice(0, 3).map(async (c) => ({
      campaign: c,
      results: await getVoiceCampaignResults(orgId, c.id),
    }))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
        <CardTitle className="text-base">Voice outbound campaigns</CardTitle>
        <Button variant="ghost" size="sm" className="text-cyan-400 h-8" asChild>
          <Link href="/dashboard/campaigns">All campaigns</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {summaries.map(({ campaign, results }) => (
          <Link
            key={campaign.id}
            href={`/dashboard/campaigns/${campaign.id}/edit`}
            className="block rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 hover:border-cyan-500/30 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-medium text-slate-100">{campaign.name}</p>
              <Badge variant={campaign.status === "live" ? "success" : "secondary"}>
                {campaign.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              {results.dialed} dialed · {results.qualified} qualified ·{" "}
              {results.booked} bookings · {results.withSummary} summaries
            </p>
          </Link>
        ))}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/dashboard/campaigns/new?voice=1">Start new voice campaign</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
