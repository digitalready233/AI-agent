import { requireSession } from "@/lib/platform/auth";
import {
  getDashboardStats,
  listAgents,
  listConversations,
  listLeads,
} from "@/lib/platform/data";
import {
  groupConversationsByDate,
  groupLeadsBySource,
} from "@/lib/platform/dashboard-period";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { DashboardCharts } from "@/components/platform/dashboard-charts";
import { StatCard } from "@/components/platform/stat-card";
import {
  MessageSquare,
  Users,
  Flame,
  TrendingUp,
  Bot,
  UserX,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AnalyticsPage() {
  const session = await requireSession();
  requirePermission(session, "analytics.view");
  const orgId = session.organization.id;

  const [stats, leads, conversations, agents] = await Promise.all([
    getDashboardStats(orgId, "30d"),
    listLeads(orgId),
    listConversations(orgId),
    listAgents(orgId),
  ]);

  const conversationByDay = groupConversationsByDate(conversations, "30d").map(
    ({ day, conversations: count }) => ({ day, conversations: count })
  );
  const leadSources = groupLeadsBySource(leads);

  const byChannel = ["website", "whatsapp", "phone", "email"].map((ch) => ({
    channel: ch,
    count: conversations.filter((c) => c.channel === ch).length,
  }));

  const byAgentType = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.agent_type] = (acc[a.agent_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="platform-page">
      <PageHeader
        title="Sales analytics"
        description="Pipeline conversion, conversations, hot leads, handoffs, and channel performance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total conversations" value={stats.totalConversations} icon={MessageSquare} />
        <StatCard title="New leads" value={stats.newLeads} icon={Users} />
        <StatCard title="Hot leads" value={stats.hotLeads} icon={Flame} />
        <StatCard title="Qualified leads" value={stats.qualifiedLeads} icon={TrendingUp} />
        <StatCard title="AI resolution rate" value={`${stats.aiResolutionRate}%`} icon={Bot} />
        <StatCard title="Human handoffs" value={stats.humanHandoffs} icon={UserX} />
        <StatCard title="Conversion rate" value={`${stats.conversionRate}%`} icon={TrendingUp} />
        <StatCard title="Booked meetings" value={stats.bookedMeetings} icon={TrendingUp} />
        <StatCard title="Active agents" value={agents.filter((a) => a.status === "active").length} icon={Bot} />
      </div>

      <DashboardCharts
        conversationByDay={conversationByDay}
        leadSources={leadSources}
        hasConversations={conversations.length > 0}
        hasLeads={leads.length > 0}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversations by channel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {byChannel.map(({ channel, count }) => {
              const max = Math.max(...byChannel.map((c) => c.count), 1);
              const pct = Math.round((count / max) * 100);
              return (
                <div key={channel} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 capitalize">{channel}</span>
                    <span className="font-medium text-cyan-300">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agents by type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byAgentType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-slate-400 capitalize">{type}</span>
                <span className="font-medium text-cyan-300">{count}</span>
              </div>
            ))}
            {Object.keys(byAgentType).length === 0 && (
              <p className="text-sm text-slate-500">No agents yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

