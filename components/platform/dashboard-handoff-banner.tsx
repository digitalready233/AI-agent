import Link from "next/link";
import { AlertTriangle, ArrowRight, MonitorPlay } from "lucide-react";
import { listDemoSessions } from "@/lib/demo/demo-data";
import { listConversations } from "@/lib/platform/data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function DashboardHandoffBanner({ orgId }: { orgId: string }) {
  const [conversations, demoSessions] = await Promise.all([
    listConversations(orgId),
    listDemoSessions(orgId, { handoffRequired: true }),
  ]);

  const humanNeeded = conversations.filter((c) => c.status === "human_needed");
  const demoHandoffs = demoSessions.filter(
    (d) =>
      d.handoff_required &&
      !["completed", "cancelled", "missed"].includes(d.status)
  );

  if (humanNeeded.length === 0 && demoHandoffs.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <p className="font-semibold text-amber-100">Live demo needs human</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {humanNeeded.length > 0 && (
                <>
                  {humanNeeded.length} conversation
                  {humanNeeded.length > 1 ? "s" : ""} need a team member
                </>
              )}
              {humanNeeded.length > 0 && demoHandoffs.length > 0 && " · "}
              {demoHandoffs.length > 0 && (
                <>
                  {demoHandoffs.length} live demo
                  {demoHandoffs.length > 1 ? "s" : ""} need a human closer
                </>
              )}
              .
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {demoHandoffs.length > 0 && (
            <Button
              variant="outline"
              className="rounded-xl border-amber-500/30"
              asChild
            >
              <Link href="/dashboard/demo-calls?handoff=1">
                <MonitorPlay className="h-4 w-4 mr-1" />
                Demo calls
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          )}
          {humanNeeded.length > 0 && (
            <Button variant="outline" className="rounded-xl border-amber-500/30" asChild>
              <Link href="/dashboard/conversations?status=human_needed">
                View inbox
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
