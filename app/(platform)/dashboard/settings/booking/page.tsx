import Link from "next/link";
import { requireSession } from "@/lib/platform/auth";
import { listProfiles } from "@/lib/platform/data";
import { can } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { InternalBookingSettingsPanel } from "@/components/platform/internal-booking-settings-panel";

export default async function BookingSettingsPage() {
  const session = await requireSession();
  const profiles = await listProfiles(session.organization.id);
  const canManage = can(session.profile.role, "settings.manage");

  return (
    <div className="platform-page">
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/dashboard/settings" className="text-cyan-400 hover:underline">
          Settings
        </Link>
        <span> / </span>
        <span>Booking</span>
      </div>
      <PageHeader
        title="Booking settings"
        description="Internal booking — meeting types, staff availability, and scheduling rules."
      />
      <InternalBookingSettingsPanel profiles={profiles} canManage={canManage} />
    </div>
  );
}
