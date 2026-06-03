import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getGoogleCalendarConnectionStatus } from "@/lib/calendar/connection-status";
import { getCalendarSettings } from "@/lib/calendar/calendar-settings-data";

export async function GET() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const [status, settings] = await Promise.all([
    getGoogleCalendarConnectionStatus(session.organization.id),
    getCalendarSettings(session.organization.id),
  ]);

  return Response.json({ status, settings });
}
