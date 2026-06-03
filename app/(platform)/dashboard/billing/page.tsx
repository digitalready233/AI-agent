import { Suspense } from "react";
import { requireSession } from "@/lib/platform/auth";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import { PageHeader } from "@/components/platform/page-header";
import { BillingPaystackPanel } from "@/components/platform/billing-paystack-panel";

export default async function BillingPage() {
  const session = await requireSession();
  const settings = await getOrganizationSettings(session.organization.id);

  return (
    <div className="platform-page">
      <PageHeader
        title="Billing"
        description="Start a free trial, then pay via Paystack for full workspace access — agents, voice, demos, and integrations."
        backHref="/dashboard/settings"
        backLabel="Settings"
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-900/40" />}>
        <BillingPaystackPanel billing={settings.billing} />
      </Suspense>
    </div>
  );
}
