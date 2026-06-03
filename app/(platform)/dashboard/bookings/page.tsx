import { requireSession } from "@/lib/platform/auth";
import { listBookings, listProfiles } from "@/lib/platform/data";
import { PageHeader } from "@/components/platform/page-header";
import { BookingsManager } from "@/components/platform/bookings-manager";

export default async function BookingsPage() {
  const { organization } = await requireSession();
  const [bookings, profiles] = await Promise.all([
    listBookings(organization.id),
    listProfiles(organization.id),
  ]);

  return (
    <div className="platform-page">
      <PageHeader
        title="Meetings & bookings"
        description="Consultations, demos, and sales calls booked by AI agents — linked to leads and conversations."
      />
      <BookingsManager
        bookings={bookings}
        profiles={profiles.map((p) => ({ id: p.id, full_name: p.full_name }))}
      />
    </div>
  );
}
