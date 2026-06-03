import { requireSession } from "@/lib/platform/auth";
import { listAgents, listLeads, listProfiles } from "@/lib/platform/data";
import { PageHeader } from "@/components/platform/page-header";
import { LeadsManager } from "@/components/platform/leads-manager";

export default async function LeadsPage() {
  const { organization } = await requireSession();
  const [leads, profiles, agents] = await Promise.all([
    listLeads(organization.id),
    listProfiles(organization.id),
    listAgents(organization.id),
  ]);

  return (
    <div className="platform-page">
      <PageHeader
        title="Leads & CRM"
        description="BANT-qualified pipeline — score, status, follow-ups, and assignments for every sales conversation."
      />
      <LeadsManager
        leads={leads}
        profiles={profiles}
        agents={agents.filter((a) => a.enabled).map((a) => ({
          id: a.id,
          name: a.nickname ?? a.name,
        }))}
      />
    </div>
  );
}
