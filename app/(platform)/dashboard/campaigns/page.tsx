import Link from "next/link";
import { Megaphone, Phone, Plus } from "lucide-react";
import { requireSession } from "@/lib/platform/auth";
import { countLeadsByCampaign, listAgents, listCampaigns } from "@/lib/platform/data";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings-data";
import { can, requirePermission } from "@/lib/platform/rbac";
import { parseFollowUpRules } from "@/lib/platform/campaign-types";
import { PageHeader } from "@/components/platform/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CampaignsPage() {
  const session = await requireSession();
  requirePermission(session, "campaigns.view");

  const [campaigns, leadCounts, agents, waSettings] = await Promise.all([
    listCampaigns(session.organization.id),
    countLeadsByCampaign(session.organization.id),
    listAgents(session.organization.id),
    getWhatsAppSettings(session.organization.id),
  ]);

  const waTemplateName = new Map(
    waSettings.message_templates.map((t) => [t.id, t.name])
  );

  const agentName = new Map(agents.map((a) => [a.id, a.name]));
  const canManage = can(session.profile.role, "campaigns.manage");

  return (
    <div className="platform-page">
      <PageHeader
        title="Sales campaigns"
        description="Outbound outreach and follow-up operations — agent, audience, schedule, and performance."
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" asChild>
                <Link href="/dashboard/campaigns/templates">Templates</Link>
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" asChild>
                <Link href="/dashboard/campaigns/new?voice=1">
                  <Phone className="h-4 w-4 mr-1.5" />
                  Voice campaign
                </Link>
              </Button>
              <Button size="sm" className="rounded-xl" asChild>
                <Link href="/dashboard/campaigns/new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New campaign
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No campaigns yet.</p>
            {canManage && (
              <Button className="mt-4" size="sm" asChild>
                <Link href="/dashboard/campaigns/new">Create your first campaign</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const rules = parseFollowUpRules(c.follow_up_rules);
            const leads = leadCounts[c.id] ?? 0;
            return (
              <Link
                key={c.id}
                href={canManage ? `/dashboard/campaigns/${c.id}/edit` : "#"}
                className={canManage ? "block" : "pointer-events-none"}
              >
                <Card className="hover:border-cyan-500/30 transition-colors h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <Badge
                        variant={
                          c.status === "live"
                            ? "success"
                            : c.status === "paused"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {c.campaign_type?.replace(/_/g, " ") ?? "campaign"}
                      {c.channel ? ` · ${c.channel.replace(/_/g, " ")}` : ""}
                      {c.agent_id && agentName.get(c.agent_id)
                        ? ` · ${agentName.get(c.agent_id)}`
                        : ""}
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-400 space-y-1">
                    <p>{leads} lead{leads === 1 ? "" : "s"} in audience</p>
                    {c.scheduled_at ? (
                      <p>Scheduled: {new Date(c.scheduled_at).toLocaleString()}</p>
                    ) : (
                      <p>Not scheduled</p>
                    )}
                    {rules.delay_hours != null && (
                      <p className="text-xs">
                        Follow-up: every {rules.delay_hours}h, max {rules.max_attempts ?? 3}{" "}
                        attempts
                      </p>
                    )}
                    {rules.whatsapp_template_id && (
                      <p className="text-xs">
                        WhatsApp template:{" "}
                        {waTemplateName.get(rules.whatsapp_template_id) ??
                          rules.whatsapp_template_id.slice(0, 8)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
