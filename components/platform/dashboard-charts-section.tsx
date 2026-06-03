import { listConversations, listLeads } from "@/lib/platform/data";
import {
  groupConversationsByDate,
  groupLeadsBySource,
  type DashboardPeriod,
} from "@/lib/platform/dashboard-period";
import { DashboardChartsLazy } from "@/components/platform/dashboard-charts-lazy";

export async function DashboardChartsSection({
  orgId,
  period,
}: {
  orgId: string;
  period: DashboardPeriod;
}) {
  const [leads, conversations] = await Promise.all([
    listLeads(orgId),
    listConversations(orgId),
  ]);

  const conversationByDay = groupConversationsByDate(conversations, period);
  const leadSources = groupLeadsBySource(leads);

  return (
    <DashboardChartsLazy
      conversationByDay={conversationByDay}
      leadSources={leadSources}
      hasConversations={conversations.length > 0}
      hasLeads={leads.length > 0}
    />
  );
}
