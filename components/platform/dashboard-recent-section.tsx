import Link from "next/link";
import {
  listConversations,
  listLeads,
  sortConversationsRecent,
  sortLeadsRecent,
} from "@/lib/platform/data";
import { listCalls } from "@/lib/voice/call-data";
import { isHotLeadCategory } from "@/lib/platform/dashboard-period";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function DashboardRecentSection({ orgId }: { orgId: string }) {
  const [leads, conversations, calls] = await Promise.all([
    listLeads(orgId),
    listConversations(orgId),
    listCalls(orgId),
  ]);

  const recentLeads = sortLeadsRecent(leads).slice(0, 5);
  const recentConversations = sortConversationsRecent(conversations).slice(0, 5);
  const recentCalls = [...calls]
    .sort(
      (a, b) =>
        new Date(b.started_at ?? b.created_at).getTime() -
        new Date(a.started_at ?? a.created_at).getTime()
    )
    .slice(0, 5);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
          <CardTitle>Recent leads</CardTitle>
          <Button variant="ghost" size="sm" className="text-cyan-400 h-8" asChild>
            <Link href="/dashboard/leads">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 pt-4">
          {recentLeads.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No leads yet.</p>
          ) : (
            recentLeads.map((l) => (
              <Link
                key={l.id}
                href={`/dashboard/leads?highlight=${l.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-800/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {l.full_name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {l.service_interest ?? "—"}
                  </p>
                </div>
                <Badge
                  variant={isHotLeadCategory(l.lead_category) ? "destructive" : "secondary"}
                >
                  {l.lead_category ?? "warm"}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
          <CardTitle>Recent conversations</CardTitle>
          <Button variant="ghost" size="sm" className="text-cyan-400 h-8" asChild>
            <Link href="/dashboard/conversations">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 pt-4">
          {recentConversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No conversations yet.</p>
          ) : (
            recentConversations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/conversations/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-800/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {c.customer_name ?? "Visitor"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.channel} · {c.status.replace(/_/g, " ")}
                  </p>
                </div>
                {c.status === "human_needed" && <Badge variant="warning">Handoff</Badge>}
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-4">
          <CardTitle>Recent voice calls</CardTitle>
          <Button variant="ghost" size="sm" className="text-cyan-400 h-8" asChild>
            <Link href="/dashboard/calls">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 pt-4">
          {recentCalls.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No calls yet.</p>
          ) : (
            recentCalls.map((call) => (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-800/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {call.from_number ?? "Unknown caller"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {call.detected_intent?.replace(/_/g, " ") ?? call.call_type}
                  </p>
                </div>
                <Badge
                  variant={
                    call.status === "human_needed" || call.handoff_required
                      ? "warning"
                      : call.status === "completed"
                        ? "secondary"
                        : "default"
                  }
                >
                  {call.status.replace(/_/g, " ")}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
