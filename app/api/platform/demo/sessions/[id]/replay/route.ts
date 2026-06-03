import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getAgent, getLead } from "@/lib/platform/data";
import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import { listDemoRecordings } from "@/lib/demo/demo-recordings-data";
import { listDemoTimelineEvents } from "@/lib/demo/demo-timeline-data";
import { listDemoPresentationEvents } from "@/lib/demo/demo-presentation-events-data";
import { listDemoPresenterEvents } from "@/lib/demo/demo-presenter-events-data";
import { listAvatarEvents } from "@/lib/avatar/avatar-events-data";
import { listDemoMessages, listDemoTranscripts } from "@/lib/demo/demo-data";
import { listDemoRoomEvents } from "@/lib/demo/demo-room-events-data";
import { canViewDemoRecording } from "@/lib/demo/demo-recording-permissions";
import { getDemoPath } from "@/lib/demo/demo-paths-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireSession();
  requirePermission(ctx, "conversations.view");
  const { id } = await params;

  const demo = await getDemoSession(id);
  if (!demo || demo.organization_id !== ctx.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!canViewDemoRecording(ctx, demo)) {
    return Response.json({ error: "Recording access denied" }, { status: 403 });
  }

  const [
    recordings,
    timeline,
    presentationEvents,
    presenterEvents,
    avatarEvents,
    messages,
    transcripts,
    roomEvents,
    lead,
    agent,
    demoPath,
  ] = await Promise.all([
    listDemoRecordings(id),
    listDemoTimelineEvents(id),
    listDemoPresentationEvents(id),
    listDemoPresenterEvents(id),
    listAvatarEvents(id),
    listDemoMessages(id),
    listDemoTranscripts(id),
    listDemoRoomEvents(id),
    demo.lead_id ? getLead(demo.lead_id) : null,
    demo.agent_id ? getAgent(demo.agent_id) : null,
    demo.demo_path_id ? getDemoPath(demo.demo_path_id) : null,
  ]);

  const viewCount = (demo.replay_view_count ?? 0) + 1;
  await saveDemoSession({ ...demo, replay_view_count: viewCount });

  const assetsViewed = Array.isArray(demo.metadata?.assets_viewed)
    ? (demo.metadata.assets_viewed as string[])
    : [];

  const leadScoreTimeline = timeline.filter((e) =>
    ["lead_became_warm", "lead_became_hot"].includes(e.event_type)
  );
  const bookingMoment =
    timeline.find((e) => e.event_type === "booking_created") ??
    (demo.booking_id
      ? timeline.find((e) => e.event_type === "booking_recommended")
      : undefined);
  const takeoverMoment = timeline.find((e) =>
    ["staff_takeover_started", "staff_took_over", "staff_joined", "human_handoff_triggered"].includes(
      e.event_type
    )
  );

  return Response.json({
    session: { ...demo, replay_view_count: viewCount },
    recordings,
    timeline,
    presentation_events: presentationEvents,
    presenter_events: presenterEvents,
    avatar_events: avatarEvents,
    messages,
    transcripts,
    room_events: roomEvents,
    lead,
    agent,
    demo_path: demoPath,
    assets_viewed: assetsViewed,
    objections: demo.objections ?? [],
    follow_up_draft: demo.follow_up_draft ?? null,
    lead_score_timeline: leadScoreTimeline,
    booking_moment: bookingMoment ?? null,
    takeover_moment: takeoverMoment ?? null,
  });
}
