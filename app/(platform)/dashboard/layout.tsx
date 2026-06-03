import { requireSession } from "@/lib/platform/auth";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import { DashboardShell } from "@/components/platform/dashboard-shell";
import { BillingGate } from "@/components/platform/billing-gate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const settings = await getOrganizationSettings(session.organization.id);

  const agentId = process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim();
  const liveAgentHref = agentId
    ? `/chat?agentId=${encodeURIComponent(agentId)}`
    : "/chat";

  return (
    <DashboardShell
      orgName={session.organization.name}
      userName={session.profile.full_name}
      userRole={session.profile.role}
      liveAgentHref={liveAgentHref}
    >
      <BillingGate billing={settings.billing} />
      {children}
    </DashboardShell>
  );
}
