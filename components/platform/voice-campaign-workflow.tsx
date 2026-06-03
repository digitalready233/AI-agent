import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VoiceCampaignResults } from "@/lib/voice/campaign-metrics";

const STEPS = [
  { key: "leads", label: "Admin selects leads" },
  { key: "agent", label: "Admin selects AI voice agent" },
  { key: "campaign", label: "Admin creates outbound call campaign" },
  { key: "dial", label: "AI calls leads automatically" },
  { key: "qualify", label: "AI qualifies them by voice" },
  { key: "book", label: "AI books meetings" },
  { key: "crm", label: "AI updates CRM" },
  { key: "summary", label: "AI creates call summary" },
  { key: "dashboard", label: "Dashboard tracks results" },
] as const;

function stepDone(
  key: (typeof STEPS)[number]["key"],
  ctx: {
    hasLeads: boolean;
    hasAgent: boolean;
    campaignSaved: boolean;
    results?: VoiceCampaignResults | null;
  }
): boolean {
  switch (key) {
    case "leads":
      return ctx.hasLeads;
    case "agent":
      return ctx.hasAgent;
    case "campaign":
      return ctx.campaignSaved;
    case "dial":
      return (ctx.results?.dialed ?? 0) > 0;
    case "qualify":
      return (ctx.results?.qualified ?? 0) > 0;
    case "book":
      return (ctx.results?.booked ?? 0) > 0;
    case "crm":
      return (ctx.results?.qualified ?? 0) > 0 || (ctx.results?.completed ?? 0) > 0;
    case "summary":
      return (ctx.results?.withSummary ?? 0) > 0;
    case "dashboard":
      return (ctx.results?.dialed ?? 0) > 0;
    default:
      return false;
  }
}

export function VoiceCampaignWorkflow({
  hasLeads,
  hasAgent,
  campaignSaved,
  results,
}: {
  hasLeads: boolean;
  hasAgent: boolean;
  campaignSaved: boolean;
  results?: VoiceCampaignResults | null;
}) {
  const ctx = { hasLeads, hasAgent, campaignSaved, results };

  return (
    <Card className="border-cyan-500/20 bg-cyan-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Voice outbound workflow</CardTitle>
        <p className="text-xs text-slate-500">
          SalesCloser-style: select leads → AI agent → campaign → auto-dial → qualify →
          book → CRM → summary → track here.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {STEPS.map((step, i) => {
            const done = stepDone(step.key, ctx);
            return (
              <li key={step.key} className="flex items-start gap-2 text-sm">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" />
                )}
                <span className={done ? "text-slate-200" : "text-slate-500"}>
                  <span className="text-slate-600 mr-1.5">{i + 1}.</span>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
