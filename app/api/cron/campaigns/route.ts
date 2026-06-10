import { NextRequest } from "next/server";
import { runCampaignScheduler } from "@/lib/platform/campaign-scheduler";
import { isProductionRuntime } from "@/lib/security/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled campaign processor.
 * Production: requires `Authorization: Bearer CRON_SECRET` (no query-string or header bypass).
 * Local dev: optional secret — omit CRON_SECRET to allow unauthenticated runs.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (isProductionRuntime() && !secret) {
    return Response.json(
      { error: "CRON_SECRET must be configured in production." },
      { status: 503 }
    );
  }

  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const organizationId = req.nextUrl.searchParams.get("organization_id") ?? undefined;
  const result = await runCampaignScheduler(organizationId);

  return Response.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
