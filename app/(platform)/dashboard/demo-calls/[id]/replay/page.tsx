import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import { canViewDemoRecording } from "@/lib/demo/demo-recording-permissions";
import { DemoReplayClient } from "@/components/platform/demo-replay-client";

export default async function DemoReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.view");
  const { id } = await params;

  const demo = await getDemoSession(id);
  if (!demo || demo.organization_id !== ctx.organization.id) notFound();
  if (!canViewDemoRecording(ctx, demo)) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-lg font-semibold">Replay unavailable</h1>
        <p className="text-sm text-muted-foreground mt-2">
          You do not have permission to view recordings for this demo.
        </p>
        <Link
          href={`/dashboard/demo-calls/${id}`}
          className="text-sm text-cyan-600 hover:underline mt-4 inline-block"
        >
          Back to demo detail
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/demo-calls/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Demo detail
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Demo replay</h1>
          <p className="text-sm text-muted-foreground">{demo.title}</p>
        </div>
      </div>
      <DemoReplayClient sessionId={id} />
    </div>
  );
}
