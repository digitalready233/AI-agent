import { NextRequest } from "next/server";
import { runCampaignScheduler } from "@/lib/platform/campaign-scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled campaign processor.
 * - Vercel Cron: add CRON_SECRET to project env; `vercel.json` schedules this route.
 * - Manual/local: GET /api/cron/campaigns?secret=YOUR_CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const vercelCron = req.headers.get("x-vercel-cron");
    const authorized =
      auth === `Bearer ${secret}` ||
      querySecret === secret ||
      vercelCron === "1";
    if (!authorized) {
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
