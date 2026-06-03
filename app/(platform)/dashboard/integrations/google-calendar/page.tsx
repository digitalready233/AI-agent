import { Suspense } from "react";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { GoogleCalendarSettings } from "@/components/platform/google-calendar-settings";

export default async function GoogleCalendarIntegrationPage() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  return (
    <div className="platform-page">
      <PageHeader
        title="Google Calendar"
        description="Connect OAuth, set availability, and configure meeting types for AI-assisted booking."
      />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <GoogleCalendarSettings />
      </Suspense>
    </div>
  );
}
