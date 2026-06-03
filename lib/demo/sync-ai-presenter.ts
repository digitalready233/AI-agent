import type { AiPresenterMode, AiPresenterState } from "./ai-presenter-types";
import { getDemoSession, saveDemoSession } from "./demo-data";
import { saveDemoPresenterEvent } from "./demo-presenter-events-data";
import { publishDemoAiSyncToRoom } from "./demo-livekit-ai-sync";
import { safeRecordDemoTimeline } from "./demo-timeline-helpers";
import type { DemoSession } from "./types";

const STATE_EVENT_MAP: Partial<Record<AiPresenterState, string>> = {
  speaking: "ai_started_speaking",
  listening: "ai_stopped_speaking",
  presenting: "ai_started_presenting_asset",
  paused: "ai_paused",
  handoff_required: "ai_handoff_triggered",
};

export async function syncAiPresenterState(params: {
  session: DemoSession;
  state: AiPresenterState;
  mode?: AiPresenterMode | string;
  stage?: string | null;
  assetId?: string | null;
  assetTitle?: string | null;
  recordEvent?: boolean;
}): Promise<DemoSession> {
  const prev = params.session.ai_presenter_state;
  const now = new Date().toISOString();

  const updated = await saveDemoSession({
    ...params.session,
    ai_presenter_state: params.state,
    ai_presenter_mode:
      params.mode ?? params.session.ai_presenter_mode ?? "animated_card",
    ai_presenter_last_stage: params.stage ?? params.session.current_demo_stage ?? null,
    ai_presenter_last_asset_id:
      params.assetId ?? params.session.current_demo_asset_id ?? null,
    ai_presenter_last_updated_at: now,
    metadata: {
      ...(params.session.metadata ?? {}),
      ai_presenter_state: params.state,
      ai_presenter_asset_title: params.assetTitle ?? null,
    },
  });

  if (params.recordEvent !== false && prev !== params.state) {
    const eventType = STATE_EVENT_MAP[params.state] ?? "ai_state_changed";
    await saveDemoPresenterEvent({
      organization_id: updated.organization_id,
      demo_session_id: updated.id,
      event_type: eventType,
      actor_type: "ai",
      actor_id: "ai-agent",
      title: `AI presenter: ${params.state.replace(/_/g, " ")}`,
      description: params.assetTitle ?? params.stage ?? null,
      metadata: {
        previous: prev,
        next: params.state,
        asset_id: params.assetId,
        stage: params.stage,
      },
    });

    await safeRecordDemoTimeline({
      demoSessionId: updated.id,
      organizationId: updated.organization_id,
      eventType: "ai_state_changed",
      title: `AI presenter ${params.state.replace(/_/g, " ")}`,
      description: params.assetTitle ?? undefined,
      metadata: { presenter_state: params.state, event_type: eventType },
    });
  }

  await publishDemoAiSyncToRoom(updated, {
    aiState: params.state,
    currentDemoAssetId: updated.current_demo_asset_id,
  });

  return updated;
}

export async function syncAiPresenterForSessionId(
  demoSessionId: string,
  state: AiPresenterState,
  extras?: {
    assetId?: string | null;
    assetTitle?: string | null;
    stage?: string | null;
  }
): Promise<DemoSession | null> {
  const session = await getDemoSession(demoSessionId);
  if (!session) return null;
  return syncAiPresenterState({
    session,
    state,
    assetId: extras?.assetId,
    assetTitle: extras?.assetTitle,
    stage: extras?.stage,
  });
}

export async function recordStaffBecamePresenter(session: DemoSession, staff: {
  userId: string;
  name?: string;
}) {
  await saveDemoPresenterEvent({
    organization_id: session.organization_id,
    demo_session_id: session.id,
    event_type: "staff_became_presenter",
    actor_type: "staff",
    actor_id: staff.userId,
    title: "Staff became presenter",
    description: staff.name ?? null,
    metadata: { staff_name: staff.name },
  });
  await safeRecordDemoTimeline({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "presenter_changed",
    title: "Staff presenting",
    description: staff.name ?? undefined,
    metadata: { presenter_type: "staff" },
  });
}

export async function recordAiPresenterResumed(session: DemoSession) {
  await saveDemoPresenterEvent({
    organization_id: session.organization_id,
    demo_session_id: session.id,
    event_type: "ai_resumed",
    actor_type: "staff",
    actor_id: session.human_takeover_by ?? null,
    title: "AI presenter resumed",
    description: "Control returned to AI",
  });
}
