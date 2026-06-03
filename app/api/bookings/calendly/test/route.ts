import { testCalendlyConnection } from "@/lib/calendly/client";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";

export async function POST() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const result = await testCalendlyConnection(session.organization.id);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 });
  }
  return Response.json({
    ok: true,
    user_uri: result.userUri,
    scheduling_url: result.schedulingUrl,
    email: result.email,
  });
}
