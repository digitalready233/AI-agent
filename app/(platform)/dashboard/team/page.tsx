import { UserCircle } from "lucide-react";
import { requireSession } from "@/lib/platform/auth";
import { listProfiles } from "@/lib/platform/data";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const roleLabels: Record<string, string> = {
  super_admin: "Platform Admin",
  company_admin: "Company Admin",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  support_agent: "Support Agent",
  viewer: "Viewer",
};

export default async function TeamPage() {
  const session = await requireSession();
  requirePermission(session, "team.view");
  const { organization } = session;
  const profiles = await listProfiles(organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="Team"
        description="Manage team members and roles for your organization."
      />

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No team members found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <Card key={p.id} className="hover:border-cyan-500/30 transition-colors">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{p.full_name}</p>
                    {p.department && (
                      <p className="text-xs text-slate-500">{p.department}</p>
                    )}
                  </div>
                  <Badge variant="outline">{roleLabels[p.role] ?? p.role}</Badge>
                </div>
                <p className="text-xs text-slate-500 capitalize">
                  Status: {p.status ?? "active"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
