import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { PageHeader } from "@/components/platform/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDemoSession,
  getDemoAsset,
  listDemoMessages,
  listDemoOutcomes,
  listDemoParticipants,
  listDemoTranscripts,
} from "@/lib/demo/demo-data";
import { listDemoRoomEvents } from "@/lib/demo/demo-room-events-data";
import { isLiveKitEnvConfigured } from "@/lib/demo/demo-provider";
import { getDemoPath } from "@/lib/demo/demo-paths-data";
import { DEMO_LEAD_CATEGORY_LABELS } from "@/lib/demo/demo-schemas";
import { formatObjectionTag } from "@/lib/demo/objection-labels";
import { getAgent, getLead } from "@/lib/platform/data";
import { DemoSessionActions } from "@/components/platform/demo-session-actions";
import { DemoManagerReview } from "@/components/platform/demo-manager-review";
import { DemoFollowUpNotes } from "@/components/platform/demo-follow-up-notes";
import {
  canAddFollowUpNotes,
  canMarkDemoReviewed,
  canViewDemoRecording,
} from "@/lib/demo/demo-recording-permissions";
import { DemoQualificationProgressCard } from "@/components/demo/demo-qualification-progress";
import { DemoCallDetailTabs } from "@/components/platform/demo-call-detail-tabs";
import {
  demoAiAudioModeLabel,
  demoAiAudioStatusLabel,
} from "@/lib/demo/demo-livekit-ai-audio";

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default async function DemoCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");
  const { id } = await params;

  const demo = await getDemoSession(id);
  if (!demo || demo.organization_id !== session.organization.id) {
    notFound();
  }

  const lastAssetId =
    demo.current_demo_asset_id ??
    (typeof demo.metadata?.last_asset_id === "string"
      ? demo.metadata.last_asset_id
      : null);

  const [messages, transcripts, outcomes, lead, agent, activeAsset, demoPath, participants, roomEvents] =
    await Promise.all([
      listDemoMessages(id),
      listDemoTranscripts(id),
      listDemoOutcomes(id),
      demo.lead_id ? getLead(demo.lead_id) : null,
      demo.agent_id ? getAgent(demo.agent_id) : null,
      lastAssetId ? getDemoAsset(lastAssetId) : null,
      demo.demo_path_id ? getDemoPath(demo.demo_path_id) : null,
      listDemoParticipants(id),
      listDemoRoomEvents(id),
    ]);

  const categoryLabel =
    demo.lead_category && demo.lead_category in DEMO_LEAD_CATEGORY_LABELS
      ? DEMO_LEAD_CATEGORY_LABELS[
          demo.lead_category as keyof typeof DEMO_LEAD_CATEGORY_LABELS
        ]
      : demo.lead_category;

  const assetsViewed = Array.isArray(demo.metadata?.assets_viewed)
    ? (demo.metadata.assets_viewed as string[])
    : [];

  return (
    <div className="platform-page space-y-6">
      <PageHeader
        title={demo.title}
        description={`${agent?.name ?? "Agent"} · ${lead?.full_name ?? "No lead linked"} · ${demo.entry_mode === "on_demand" ? "On-demand" : "Scheduled"}`}
        actions={
          <DemoSessionActions
            sessionId={demo.id}
            status={demo.status}
            handoffRequired={demo.handoff_required}
            handoffStatus={demo.handoff_status}
            handoffReason={demo.handoff_reason}
            aiPaused={demo.ai_paused}
            videoProvider={demo.video_provider}
            livekitRoomStatus={demo.livekit_room_status}
            livekitConfigured={isLiveKitEnvConfigured()}
            aiJoined={demo.ai_joined}
            aiStatus={demo.ai_status}
            aiParticipantIdentity={demo.ai_participant_identity}
            aiLastResponseAt={demo.ai_last_response_at}
            aiAudioMode={demo.ai_audio_mode}
            aiAudioStatus={demo.ai_audio_status}
            aiAudioTrackPublished={demo.ai_audio_track_published}
            aiAudioError={demo.ai_audio_error}
            aiLastSpokenAt={demo.ai_last_spoken_at}
            layout="row"
          />
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        {canViewDemoRecording(session, demo) && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/demo-calls/${demo.id}/replay`}>Open replay</Link>
          </Button>
        )}
        <Badge variant="outline">{demo.status.replace(/_/g, " ")}</Badge>
        <Badge variant="outline">{demo.current_demo_stage.replace(/_/g, " ")}</Badge>
        {demoPath && <Badge variant="outline">{demoPath.title}</Badge>}
        {categoryLabel && <Badge variant="outline">{categoryLabel}</Badge>}
        {demo.lead_score != null && (
          <Badge variant="outline">Score {demo.lead_score}</Badge>
        )}
        {demo.handoff_required && <Badge variant="destructive">Handoff required</Badge>}
        {demo.booking_recommended && (
          <Badge variant="success">Booking recommended</Badge>
        )}
        {demo.booking_id && <Badge variant="success">Meeting booked</Badge>}
        {demo.video_provider === "livekit" && (
          <Badge variant="outline">LiveKit video</Badge>
        )}
        {demo.livekit_room_status && demo.livekit_room_status !== "not_created" && (
          <Badge variant="outline">Room: {demo.livekit_room_status.replace(/_/g, " ")}</Badge>
        )}
        {demo.ai_joined && (
          <Badge variant="outline" className="border-cyan-500/40">
            AI agent: {(demo.ai_status ?? "unknown").replace(/_/g, " ")}
          </Badge>
        )}
        {(demo.recording_status === "recording" || demo.recording_url) && (
          <Badge variant="outline">Recorded</Badge>
        )}
        {demo.review_status && demo.review_status !== "not_reviewed" && (
          <Badge variant="outline" className="capitalize">
            {String(demo.review_status).replace(/_/g, " ")}
          </Badge>
        )}
        {demo.reviewed_at && demo.review_status !== "needs_attention" && (
          <Badge variant="outline">Reviewed</Badge>
        )}
        {demo.multi_agent_enabled && (
          <Badge variant="outline" className="border-violet-500/40">
            Multi-agent team
          </Badge>
        )}
      </div>

      {demo.follow_up_draft && (
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Follow-up draft</CardTitle>
            {demo.follow_up_due_at && (
              <p className="text-xs text-muted-foreground">
                Due {new Date(demo.follow_up_due_at).toLocaleString()}
              </p>
            )}
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap text-slate-300">
            {demo.follow_up_draft}
          </CardContent>
        </Card>
      )}

      <DemoCallDetailTabs
        sessionId={demo.id}
        multiAgentEnabled={demo.multi_agent_enabled}
        demoStatus={demo.status}
        lastTurn={
          demo.metadata?.multi_agent_last_turn as Record<string, unknown> | undefined
        }
      >
      <DemoManagerReview
        sessionId={demo.id}
        canReview={canMarkDemoReviewed(session)}
        initial={{
          demo_quality_score: demo.demo_quality_score,
          lead_quality_score: demo.lead_quality_score,
          ai_performance_rating: demo.ai_performance_rating,
          human_takeover_rating: demo.human_takeover_rating,
          review_notes: demo.review_notes,
          manager_notes: demo.manager_notes,
          review_status: demo.review_status,
          reviewed_at: demo.reviewed_at,
          reviewed_by: demo.reviewed_by,
        }}
      />

      <DemoFollowUpNotes
        sessionId={demo.id}
        canEdit={canAddFollowUpNotes(session, demo)}
        initialNotes={
          typeof demo.metadata?.agent_follow_up_notes === "string"
            ? demo.metadata.agent_follow_up_notes
            : ""
        }
      />

      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-base">LiveKit AI demo agent</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400 space-y-2">
          <p>
            <span className="text-slate-500">Status:</span>{" "}
            {demo.ai_status?.replace(/_/g, " ") ?? "not started"}
            {demo.ai_paused ? " (paused)" : ""}
          </p>
          <p>
            <span className="text-slate-500">Participant:</span>{" "}
            {demo.ai_participant_identity ?? "—"}
          </p>
          <p>
            <span className="text-slate-500">Audio mode:</span>{" "}
            {demoAiAudioModeLabel(demo.ai_audio_mode)}
          </p>
          <p>
            <span className="text-slate-500">Audio status:</span>{" "}
            {demoAiAudioStatusLabel(demo.ai_audio_status)}
          </p>
          <p>
            <span className="text-slate-500">Track published:</span>{" "}
            {demo.ai_audio_track_published ? "Yes" : "No"}
          </p>
          <p>
            <span className="text-slate-500">Last response:</span>{" "}
            {demo.ai_last_response_at
              ? new Date(demo.ai_last_response_at).toLocaleString()
              : "—"}
          </p>
          <p>
            <span className="text-slate-500">Last spoken:</span>{" "}
            {demo.ai_last_spoken_at
              ? new Date(demo.ai_last_spoken_at).toLocaleString()
              : "—"}
          </p>
          {demo.ai_audio_error && (
            <p className="text-amber-300/90 text-xs">Audio error: {demo.ai_audio_error}</p>
          )}
          {typeof demo.metadata?.ai_worker_last_error === "string" && (
            <p className="text-red-300/90 text-xs">
              Worker error: {demo.metadata.ai_worker_last_error}
            </p>
          )}
          <p className="text-xs text-slate-500">
            Run <code className="text-cyan-400">npm run demo:livekit-ai-bridge</code> and set{" "}
            <code className="text-cyan-400">LIVEKIT_AI_BRIDGE_URL</code> for native room audio.
            Browser TTS remains the automatic fallback.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-base">Live video room</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400 space-y-2">
          <p>
            <span className="text-slate-500">Provider:</span>{" "}
            {demo.video_provider ?? "internal"}
          </p>
          <p>
            <span className="text-slate-500">Room name:</span>{" "}
            {demo.livekit_room_name ?? "—"}
          </p>
          <p>
            <span className="text-slate-500">Status:</span>{" "}
            {demo.livekit_room_status?.replace(/_/g, " ") ?? "not created"}
          </p>
          <p>
            <span className="text-slate-500">Video:</span>{" "}
            {demo.video_enabled ? "enabled" : "off"}
            {demo.recording_enabled ? " · recording flag on" : ""}
          </p>
          {demo.room_started_at && (
            <p>
              <span className="text-slate-500">Started:</span>{" "}
              {new Date(demo.room_started_at).toLocaleString()}
            </p>
          )}
          {demo.room_ended_at && (
            <p>
              <span className="text-slate-500">Ended:</span>{" "}
              {new Date(demo.room_ended_at).toLocaleString()}
            </p>
          )}
          {participants.length > 0 && (
            <ul className="text-xs space-y-1 pt-2 border-t border-slate-800/60">
              {participants.map((p) => (
                <li key={p.id}>
                  {p.display_name ?? p.role} · {p.role}
                  {p.joined_at ? ` · joined ${new Date(p.joined_at).toLocaleTimeString()}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm text-slate-400">
        <p>Duration: {formatDuration(demo.duration_seconds)}</p>
        <p>Intent: {demo.detected_intent ?? "—"}</p>
        <p>Started: {demo.started_at ? new Date(demo.started_at).toLocaleString() : "—"}</p>
        <p>Ended: {demo.ended_at ? new Date(demo.ended_at).toLocaleString() : "—"}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Demo path</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400 space-y-2">
            {demoPath ? (
              <>
                <p className="text-white font-medium">{demoPath.title}</p>
                {demoPath.description && <p>{demoPath.description}</p>}
                <p className="text-xs text-slate-500">
                  Category: {demoPath.service_category ?? "—"}
                </p>
                <p className="text-xs text-slate-500">
                  CTA: {demoPath.recommended_cta ?? "—"}
                </p>
              </>
            ) : (
              <p>No guided path selected yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Qualification progress</CardTitle>
          </CardHeader>
          <CardContent>
            <DemoQualificationProgressCard progress={demo.qualification_progress} />
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Objections</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {demo.objections?.length ? (
              demo.objections.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {formatObjectionTag(tag)}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-slate-500">None recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">AI summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400 whitespace-pre-wrap max-h-[320px] overflow-y-auto">
            {demo.summary ?? "No summary yet."}
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Recommended next action</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-300">
            {demo.recommended_next_action ?? lead?.next_action ?? "—"}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Lead profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400 space-y-2">
            {lead ? (
              <>
                <p>
                  <span className="text-slate-500">Name:</span> {lead.full_name ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Email:</span> {lead.email ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Phone:</span> {lead.phone ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Company:</span> {lead.business_name ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Interest:</span>{" "}
                  {lead.service_interest ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Budget:</span> {lead.budget ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Timeline:</span> {lead.timeline ?? "—"}
                </p>
                <Link href="/dashboard/leads" className="text-cyan-400 hover:underline text-xs">
                  View in CRM →
                </Link>
              </>
            ) : (
              <p>No lead linked.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Assets viewed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400 space-y-2">
            {activeAsset && (
              <div className="border-b border-slate-800/60 pb-2">
                <p className="text-white font-medium">Current: {activeAsset.title}</p>
                <p className="text-xs capitalize">{activeAsset.asset_type.replace(/_/g, " ")}</p>
              </div>
            )}
            {assetsViewed.length > 0 ? (
              <ul className="list-disc list-inside text-xs space-y-1">
                {assetsViewed.map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
              </ul>
            ) : (
              <p>No asset history yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {roomEvents.length > 0 && (
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Room events</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 space-y-2 max-h-[240px] overflow-y-auto">
            {roomEvents.map((ev) => (
              <div key={ev.id} className="border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 capitalize">
                  {ev.event_type.replace(/_/g, " ")}
                </span>
                {ev.participant_identity && (
                  <span className="text-slate-600 ml-1">· {ev.participant_identity}</span>
                )}
                <p className="text-slate-600 mt-0.5">
                  {new Date(ev.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-800/80 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-base">Transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[420px] overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="text-sm border-b border-slate-800/60 pb-2">
                <span className="text-slate-500 capitalize">{m.sender_type}</span>
                {m.sender_name && (
                  <span className="text-slate-600 text-xs ml-1">({m.sender_name})</span>
                )}
                <p className="text-slate-200 mt-0.5">{m.content}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {transcripts.length > 0 && (
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Voice &amp; text transcript log</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 space-y-2 max-h-[320px] overflow-y-auto">
            {transcripts.map((t) => {
              const conf =
                typeof t.metadata?.confidence === "number"
                  ? Math.round(t.metadata.confidence * 100)
                  : null;
              return (
                <div
                  key={t.id}
                  className="border-b border-slate-800/60 pb-2 font-mono"
                >
                  <div className="flex flex-wrap gap-1 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {t.speaker_type ?? t.speaker}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {t.input_type ?? "text"}
                    </Badge>
                    {conf != null && (
                      <Badge variant="outline" className="text-[10px]">
                        {conf}% conf
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-300">{t.content}</p>
                  <p className="text-slate-600 mt-0.5">
                    {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {outcomes.length > 0 && (
        <Card className="border-slate-800/80 bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-base">Final outcome</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-400">
            {outcomes.map((o) => (
              <div key={o.id} className="border-b border-slate-800/60 pb-2">
                <p className="text-slate-300 capitalize">{o.outcome_type.replace(/_/g, " ")}</p>
                {o.next_action && <p className="text-xs mt-1">Next: {o.next_action}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {demo.booking_id && (
        <p className="text-sm text-slate-400">
          Booking:{" "}
          <Link href="/dashboard/bookings" className="text-cyan-400 hover:underline">
            View in bookings
          </Link>
        </p>
      )}

      </DemoCallDetailTabs>

      <Button variant="ghost" asChild>
        <Link href="/dashboard/demo-calls">← All demo calls</Link>
      </Button>
    </div>
  );
}
