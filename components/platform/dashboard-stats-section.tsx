import Link from "next/link";
import {
  MessageSquare,
  Users,
  Flame,
  Calendar,
  UserX,
  TrendingUp,
  Bot,
  Megaphone,
  Clock,
  Target,
  Phone,
  MonitorPlay,
} from "lucide-react";
import { getDashboardStats, listAgents } from "@/lib/platform/data";
import type { DashboardPeriod } from "@/lib/platform/dashboard-period";
import { can } from "@/lib/platform/rbac";
import type { UserRole } from "@/lib/platform/types";
import { StatCard } from "@/components/platform/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function DashboardStatsSection({
  orgId,
  period,
  role,
}: {
  orgId: string;
  period: DashboardPeriod;
  role: UserRole;
}) {
  const [stats, agents] = await Promise.all([
    getDashboardStats(orgId, period),
    listAgents(orgId),
  ]);

  const activeAgents = agents.filter((a) => a.status === "active").length;
  const canManageAgents = can(role, "agents.manage");

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Sales conversations" value={stats.totalConversations} icon={MessageSquare} />
        <StatCard
          title="New leads"
          value={stats.newLeads}
          icon={Users}
          subtitle="Created in selected period"
        />
        <StatCard title="Qualified leads" value={stats.qualifiedLeads} icon={TrendingUp} />
        <StatCard
          title="Hot leads"
          value={stats.hotLeads}
          icon={Flame}
          trend="Priority outreach"
        />
        <StatCard title="Booked meetings" value={stats.bookedMeetings} icon={Calendar} />
        <StatCard title="Booking rate" value={`${stats.bookingRate ?? 0}%`} icon={Calendar} />
        <StatCard
          title="Revenue opportunity"
          value={stats.revenueOpportunity}
          icon={Target}
          subtitle="Hot + qualified pipeline"
        />
        <StatCard
          title="Active campaigns"
          value={stats.activeCampaigns}
          icon={Megaphone}
          subtitle="Scheduled or live"
        />
        <StatCard
          title="Campaign messages"
          value={stats.campaignMessagesSent}
          icon={Megaphone}
          subtitle="Sent (30d)"
        />
        <StatCard
          title="Campaign replies"
          value={stats.campaignReplies}
          icon={MessageSquare}
          subtitle="Customer responses"
        />
        <StatCard title="Human handoffs" value={stats.humanHandoffs} icon={UserX} />
        <StatCard title="Voice calls" value={stats.totalCalls} icon={Phone} subtitle="In period" />
        <StatCard title="Calls today" value={stats.callsToday} icon={Phone} />
        <StatCard title="Completed calls" value={stats.completedCalls} icon={Phone} />
        <StatCard title="Missed calls" value={stats.missedCalls} icon={Phone} />
        <StatCard
          title="Avg call duration"
          value={
            stats.averageCallDurationSeconds > 0
              ? `${Math.floor(stats.averageCallDurationSeconds / 60)}m ${stats.averageCallDurationSeconds % 60}s`
              : "—"
          }
          icon={Clock}
        />
        <StatCard title="Hot leads (calls)" value={stats.hotLeadsFromCalls} icon={Flame} />
        <StatCard title="Call conversion" value={`${stats.callConversionRate}%`} icon={TrendingUp} />
        <StatCard title="Transfers" value={stats.humanTransfersFromCalls} icon={UserX} />
        <StatCard title="Demo calls" value={stats.totalDemos} icon={MonitorPlay} subtitle="In period" />
        <StatCard
          title="Demos started"
          value={stats.demosStarted ?? stats.totalDemos}
          icon={MonitorPlay}
        />
        <StatCard title="Live demos now" value={stats.liveDemosNow} icon={MonitorPlay} />
        <StatCard title="Demos today" value={stats.demosToday} icon={MonitorPlay} />
        <StatCard
          title="Demo paths selected"
          value={stats.demosWithPathSelected ?? 0}
          icon={MonitorPlay}
          subtitle={stats.mostSelectedDemoPath ?? undefined}
        />
        <StatCard
          title="Hot leads (with path)"
          value={stats.hotLeadsAfterPath ?? 0}
          icon={Flame}
        />
        <StatCard title="Completed demos" value={stats.completedDemos} icon={MonitorPlay} />
        <StatCard title="Missed demos" value={stats.missedDemos} icon={MonitorPlay} />
        <StatCard title="Hot leads (demos)" value={stats.hotLeadsFromDemos} icon={Flame} />
        <StatCard title="Bookings from demos" value={stats.bookingsFromDemos} icon={Calendar} />
        <StatCard title="Demos need handoff" value={stats.demosNeedingHandoff} icon={UserX} />
        <StatCard title="Demo takeovers" value={stats.humanTakeoversFromDemos} icon={UserX} />
        <StatCard
          title="Demo conversion"
          value={`${stats.demoConversionRate}%`}
          icon={TrendingUp}
        />
        <StatCard
          title="LiveKit rooms active"
          value={stats.liveRoomsActive ?? 0}
          icon={MonitorPlay}
        />
        <StatCard
          title="Demos with video"
          value={stats.demosWithVideoEnabled ?? 0}
          icon={MonitorPlay}
          subtitle="Video enabled in period"
        />
        <StatCard
          title="Staff joined demos"
          value={stats.staffJoinedDemos ?? 0}
          icon={UserX}
        />
        <StatCard
          title="Completed video demos"
          value={stats.completedVideoDemos ?? 0}
          icon={MonitorPlay}
        />
        <StatCard
          title="Video demos → bookings"
          value={stats.videoDemosWithBookings ?? 0}
          icon={Calendar}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Follow-ups due"
          value={stats.followUpsDue}
          icon={Clock}
          subtitle="Action needed today"
        />
        <StatCard title="Pending follow-ups" value={stats.pendingFollowUps} icon={Calendar} />
        <StatCard title="AI resolution rate" value={`${stats.aiResolutionRate}%`} icon={Bot} />
        <StatCard
          title="Lead → qualified"
          value={`${stats.conversionRate}%`}
          icon={TrendingUp}
          subtitle="Conversion rate"
        />
        <StatCard
          title="Campaign failures"
          value={stats.campaignFailedMessages}
          icon={Megaphone}
          subtitle="Failed sends (30d)"
        />
        {stats.topCampaignName && (
          <StatCard
            title="Top campaign"
            value={stats.topCampaignName}
            icon={Megaphone}
            subtitle="By messages sent"
          />
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Active sales agents
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight text-white">{activeAgents}</p>
            <p className="text-sm text-slate-500 mt-1">of {agents.length} agents in workspace</p>
          </div>
          {canManageAgents ? (
            <Button asChild className="rounded-xl shrink-0">
              <Link href="/dashboard/agents/new">Create sales agent</Link>
            </Button>
          ) : (
            <Button variant="outline" className="rounded-xl shrink-0" asChild>
              <Link href="/dashboard/agents">View agents</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
