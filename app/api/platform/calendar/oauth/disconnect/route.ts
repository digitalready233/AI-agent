import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { clearGoogleOAuthTokens } from "@/lib/calendar/google-tokens";
import { listIntegrations, saveIntegration } from "@/lib/platform/data";

export async function POST() {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  await clearGoogleOAuthTokens(session.organization.id);

  const all = await listIntegrations(session.organization.id);
  const existing = all.find((i) => i.integration_type === "google_calendar");
  if (existing) {
    const now = new Date().toISOString();
    await saveIntegration({
      ...existing,
      status: "not_connected",
      config: {},
      updated_at: now,
    });
  }

  return Response.json({ ok: true });
}
