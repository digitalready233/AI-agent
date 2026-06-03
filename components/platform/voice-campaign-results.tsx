import Link from "next/link";
import { getVoiceCampaignResults } from "@/lib/voice/campaign-metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function VoiceCampaignResults({
  organizationId,
  campaignId,
}: {
  organizationId: string;
  campaignId: string;
}) {
  const r = await getVoiceCampaignResults(organizationId, campaignId);

  const stats = [
    { label: "Total leads", value: r.totalLeads },
    { label: "Calls attempted", value: r.dialed },
    { label: "Answered", value: r.answered },
    { label: "No answer", value: r.noAnswer },
    { label: "Busy", value: r.busy },
    { label: "Voicemail", value: r.voicemail },
    { label: "Qualified", value: r.qualified },
    { label: "Booked", value: r.booked },
    { label: "Not interested", value: r.notInterested },
    { label: "Human transfer", value: r.humanTransfers },
    { label: "Failed", value: r.failed },
    { label: "Queue pending", value: r.queuePending },
    { label: "Exhausted", value: r.queueExhausted },
    { label: "Conversion", value: `${r.conversionRate}%` },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
        <div>
          <CardTitle className="text-base">Outbound voice campaign</CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Queue-backed dialing with retries, outcomes, CRM updates, and booking.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-cyan-400 h-8" asChild>
          <Link href="/dashboard/calls?direction=outbound">All outbound calls</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2"
            >
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-lg font-semibold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {r.recentCalls.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            No calls yet. Set campaign to live — the scheduler dials from the queue.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Call log
            </p>
            {r.recentCalls.map((call) => (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/30 px-3 py-2.5 hover:border-cyan-500/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {call.to_number ?? call.from_number ?? "Unknown"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {call.call_outcome?.replace(/_/g, " ") ??
                      call.summary?.slice(0, 80) ??
                      call.detected_intent?.replace(/_/g, " ") ??
                      "No summary yet"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="secondary">
                    {(call.call_outcome ?? call.status).replace(/_/g, " ")}
                  </Badge>
                  {call.lead_category && (
                    <Badge
                      variant={
                        call.lead_category === "hot" ? "destructive" : "secondary"
                      }
                    >
                      {call.lead_category}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


