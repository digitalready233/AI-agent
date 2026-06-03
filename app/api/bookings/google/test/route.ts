import { testGoogleCalendarConnection } from "@/lib/calendar/test-connection";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";

export async function POST() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const result = await testGoogleCalendarConnection(session.organization.id);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
