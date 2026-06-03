import { getAgent } from "@/lib/platform/data";
import { WorkflowError } from "@/lib/platform/workflow/types";
import {
  getDemoSession,
  listDemoMessages,
  saveDemoSession,
} from "./demo-data";
import {
  demoAiParticipantDisplayName,
  demoAiParticipantIdentity,
} from "./demo-livekit-ai-prompt";
import { getDemoProviderSettings } from "./demo-provider";
import { isDemoAiPaused } from "./demo-live-handoff";
import { recordDemoRoomEvent } from "./demo-room-events-data";
import { ensureLiveKitRoomForSession } from "./livekit-service";
import { createDemoLiveKitToken } from "./livekit-token";
import { isLiveKitEnvConfigured } from "./demo-provider";
import { runDemoWorkflow } from "./run-demo-workflow";
import {
  bridgeConnectDemoAiPublisher,
  bridgeDisconnectDemoAiPublisher,
  bridgeMuteDemoAiPublisher,
  bridgeSpeakDemoAi,
  isLiveKitAiBridgeEnabled,
} from "./livekit-ai-bridge-client";
import {
  resolveDemoAiAudioMode,
  shouldUseBrowserTts,
  type DemoAiAudioMode,
  type DemoAiAudioStatus,
} from "./demo-livekit-ai-audio";
import { publishDemoAiSyncToRoom } from "./demo-livekit-ai-sync";
import { patchDemoMessageMetadata } from "./demo-data";
import { synthesizeDemoSpeech, toDemoVoiceText } from "./voice-tts";
import type { DemoAiStatus, DemoSession } from "./types";

export type DemoAiWorkerPhase =
  | "not_started"
  | "joining"
  | "listening"
  | "thinking"
  | "speaking"
  | "paused"
  | "stopped"
  | "failed";

export type DemoLiveKitAiTurnResult = {
  ok: boolean;
  ai_status: DemoAiStatus | string;
  phase: DemoAiWorkerPhase;
  ai_response?: string;
  ai_voice_text?: string;
  audio_base64?: string | null;
  audio_mime_type?: string | null;
  use_browser_tts?: boolean;
  published_to_livekit?: boolean;
  ai_audio_mode?: DemoAiAudioMode | string;
  ai_audio_status?: DemoAiAudioStatus | string;
  ai_audio_track_published?: boolean;
  structured?: Record<string, unknown>;
  selected_demo_path_id?: string | null;
  current_demo_asset_id?: string | null;
  next_demo_asset_id?: string | null;
  lead_score?: number;
  lead_category?: string | null;
  booking_recommended?: boolean;
  handoff_required?: boolean;
  recommended_next_action?: string | null;
  demo_stage?: string;
  message_id?: string;
  used_fallback?: boolean;
  error?: string;
  selected_demo_path_title?: string | null;
  next_asset?: {
    id: string;
    title: string;
    content: string;
    asset_type: string;
  } | null;
  qualification_progress?: Record<string, boolean>;
  objections?: string[];
};

function workerPhaseFromSession(session: DemoSession): DemoAiWorkerPhase {
  const meta = session.metadata ?? {};
  const explicit = meta.ai_worker_phase as DemoAiWorkerPhase | undefined;
  if (explicit) return explicit;
  if (session.ai_status === "paused" || isDemoAiPaused(session)) return "paused";
  if (session.ai_status === "stopped") return "stopped";
  if (session.ai_status === "failed") return "failed";
  if (session.ai_status === "starting") return "joining";
  if (session.ai_status === "active") return "listening";
  return "not_started";
}

async function patchAiWorkerMeta(
  session: DemoSession,
  patch: Record<string, unknown>
): Promise<DemoSession> {
  return saveDemoSession({
    ...session,
    metadata: {
      ...(session.metadata ?? {}),
      ...patch,
    },
  });
}

async function patchAiAudioState(
  session: DemoSession,
  patch: {
    ai_audio_status?: DemoAiAudioStatus | string;
    ai_audio_mode?: DemoAiAudioMode | string;
    ai_audio_track_published?: boolean;
    ai_audio_error?: string | null;
    ai_last_spoken_at?: string | null;
    workerPhase?: DemoAiWorkerPhase;
  }
): Promise<DemoSession> {
  const metaPatch: Record<string, unknown> = {};
  if (patch.workerPhase) metaPatch.ai_worker_phase = patch.workerPhase;

  return saveDemoSession({
    ...session,
    ai_audio_status: patch.ai_audio_status ?? session.ai_audio_status ?? "idle",
    ai_audio_mode: patch.ai_audio_mode ?? session.ai_audio_mode ?? resolveDemoAiAudioMode(),
    ai_audio_track_published:
      patch.ai_audio_track_published ?? session.ai_audio_track_published ?? false,
    ai_audio_error:
      patch.ai_audio_error !== undefined ? patch.ai_audio_error : session.ai_audio_error,
    ai_last_spoken_at: patch.ai_last_spoken_at ?? session.ai_last_spoken_at,
    metadata: {
      ...(session.metadata ?? {}),
      ...metaPatch,
    },
  });
}

export function getDemoLiveKitAiStatus(session: DemoSession) {
  return {
    ai_joined: session.ai_joined ?? false,
    ai_status: session.ai_status ?? "not_started",
    ai_paused: isDemoAiPaused(session),
    ai_participant_identity: session.ai_participant_identity ?? null,
    ai_started_at: session.ai_started_at ?? null,
    ai_stopped_at: session.ai_stopped_at ?? null,
    ai_last_response_at: session.ai_last_response_at ?? null,
    phase: workerPhaseFromSession(session),
    last_error:
      typeof session.metadata?.ai_worker_last_error === "string"
        ? session.metadata.ai_worker_last_error
        : null,
    audio_publish_mvp:
      typeof session.metadata?.ai_audio_publish_mvp === "boolean"
        ? session.metadata.ai_audio_publish_mvp
        : true,
    ai_audio_mode: session.ai_audio_mode ?? resolveDemoAiAudioMode(),
    ai_audio_status: session.ai_audio_status ?? "idle",
    ai_audio_track_published: session.ai_audio_track_published ?? false,
    ai_audio_error: session.ai_audio_error ?? null,
    ai_last_spoken_at: session.ai_last_spoken_at ?? null,
    uses_native_livekit_audio:
      (session.ai_audio_mode === "livekit_track" ||
        session.ai_audio_mode === "realtime_agent") &&
      session.ai_audio_track_published === true,
    duplicate_audio_prevented: shouldUseBrowserTts(session) === false,
  };
}

export async function startDemoLiveKitAiWorker(params: {
  demoSessionId: string;
  skipWelcome?: boolean;
}): Promise<{
  session: DemoSession;
  status: ReturnType<typeof getDemoLiveKitAiStatus>;
  welcome_turn?: DemoLiveKitAiTurnResult;
  livekit_token?: string | null;
}> {
  if (!isLiveKitEnvConfigured()) {
    throw new WorkflowError("LiveKit is not configured.", "LIVEKIT_NOT_CONFIGURED", 503);
  }

  const session = await getDemoSession(params.demoSessionId);
  if (!session) throw new WorkflowError("Demo session not found.", "NOT_FOUND", 404);
  if (!session.agent_id) {
    throw new WorkflowError("Demo has no assigned agent.", "NO_AGENT", 400);
  }

  const agent = await getAgent(session.agent_id);
  if (!agent?.enabled) {
    throw new WorkflowError("Agent not available.", "AGENT_NOT_FOUND", 404);
  }

  if (session.status === "completed" || session.status === "cancelled") {
    throw new WorkflowError("Demo has ended.", "DEMO_ENDED", 400);
  }

  const identity = demoAiParticipantIdentity(agent.id, session.id);
  const displayName = demoAiParticipantDisplayName(agent.name);
  const now = new Date().toISOString();

  const targetAudioMode = resolveDemoAiAudioMode();

  let current = await saveDemoSession({
    ...session,
    ai_status: "starting",
    ai_joined: false,
    ai_participant_identity: identity,
    ai_audio_mode: targetAudioMode,
    ai_audio_status: "idle",
    ai_audio_track_published: false,
    ai_audio_error: null,
    metadata: {
      ...(session.metadata ?? {}),
      ai_worker_phase: "joining",
      ai_worker_last_error: null,
      ai_audio_publish_mvp: !isLiveKitAiBridgeEnabled(),
      ai_audio_publish_livekit: isLiveKitAiBridgeEnabled(),
      ai_agent_display_name: displayName,
    },
  });

  try {
    await ensureLiveKitRoomForSession(session.id, { createdBy: "ai_worker" });
  } catch (e) {
    const failed = await saveDemoSession({
      ...current,
      ai_status: "failed",
      metadata: {
        ...(current.metadata ?? {}),
        ai_worker_phase: "failed",
        ai_worker_last_error: e instanceof Error ? e.message : "Room setup failed",
      },
    });
    await recordDemoRoomEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "ai_failed",
      participantIdentity: identity,
      participantRole: "ai_agent",
      metadata: { error: e instanceof Error ? e.message : "unknown" },
    });
    throw e;
  }

  const tokenBundle = await createDemoLiveKitToken({
    sessionId: session.id,
    identity,
    name: displayName,
    role: "ai_agent",
  });

  current = await saveDemoSession({
    ...(await getDemoSession(session.id))!,
    ai_joined: true,
    ai_status: "active",
    ai_paused: false,
    ai_started_at: current.ai_started_at ?? now,
    ai_stopped_at: null,
    status:
      current.status === "scheduled" || current.status === "waiting"
        ? "in_progress"
        : current.status,
    started_at: current.started_at ?? now,
    metadata: {
      ...(current.metadata ?? {}),
      ai_paused: false,
      ai_worker_phase: "listening",
    },
  });

  await recordDemoRoomEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "ai_joined",
    participantIdentity: identity,
    participantRole: "ai_agent",
    metadata: { display_name: displayName },
  });
  await recordDemoRoomEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "ai_started",
    participantIdentity: identity,
    participantRole: "ai_agent",
  });
  const { recordDemoTimelineEvent } = await import("./demo-timeline-data");
  await recordDemoTimelineEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "ai_joined",
    title: "AI joined the demo",
    metadata: { identity },
  });

  let audioTrackPublished = false;
  let audioError: string | null = null;
  if (isLiveKitAiBridgeEnabled() && session.agent_id) {
    const bridgeConnect = await bridgeConnectDemoAiPublisher({
      demoSessionId: session.id,
      agentId: session.agent_id,
    });
    if (bridgeConnect.ok) {
      audioTrackPublished = true;
    } else {
      audioError = bridgeConnect.error ?? "Bridge connect failed";
      console.warn("[startDemoLiveKitAiWorker] bridge connect failed", audioError);
      await recordDemoRoomEvent({
        demoSessionId: session.id,
        organizationId: session.organization_id,
        eventType: "ai_failed",
        participantIdentity: identity,
        participantRole: "ai_agent",
        metadata: {
          scope: "native_audio_connect",
          error: audioError,
          fallback: "fallback_tts",
        },
      });
    }
  }

  current = await patchAiAudioState(current, {
    ai_audio_mode: audioTrackPublished ? targetAudioMode : "fallback_tts",
    ai_audio_status: "listening",
    ai_audio_track_published: audioTrackPublished,
    ai_audio_error: audioError,
    workerPhase: "listening",
  });
  await publishDemoAiSyncToRoom(current, { aiState: "listening" });

  let welcome_turn: DemoLiveKitAiTurnResult | undefined;
  if (!params.skipWelcome) {
    const prior = await listDemoMessages(session.id);
    const hasAgentReply = prior.some((m) => m.sender_type === "agent");
    if (!hasAgentReply) {
      welcome_turn = await processDemoLiveKitAiMessage({
        demoSessionId: session.id,
        message:
          agent.welcome_message ??
          "Hello, I just joined the live demo room and I'm ready to explore your services.",
        inputType: "voice",
        isWelcomeTurn: true,
      });
    }
  }

  const refreshed = (await getDemoSession(session.id))!;
  return {
    session: refreshed,
    status: getDemoLiveKitAiStatus(refreshed),
    welcome_turn,
    livekit_token: tokenBundle?.token ?? null,
  };
}

export async function stopDemoLiveKitAiWorker(params: {
  demoSessionId: string;
  reason?: string;
}): Promise<DemoSession> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session) throw new WorkflowError("Demo session not found.", "NOT_FOUND", 404);

  const now = new Date().toISOString();
  const identity = session.ai_participant_identity;

  const updated = await saveDemoSession({
    ...session,
    ai_status: "stopped",
    ai_joined: false,
    ai_stopped_at: now,
    ai_audio_status: "idle",
    ai_audio_track_published: false,
    metadata: {
      ...(session.metadata ?? {}),
      ai_worker_phase: "stopped",
      ai_worker_stop_reason: params.reason ?? "manual",
    },
  });

  if (identity) {
    await recordDemoRoomEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "ai_stopped",
      participantIdentity: identity,
      participantRole: "ai_agent",
      metadata: { reason: params.reason ?? "manual" },
    });
  }

  if (isLiveKitAiBridgeEnabled()) {
    try {
      await bridgeDisconnectDemoAiPublisher(params.demoSessionId);
    } catch (e) {
      console.warn("[stopDemoLiveKitAiWorker] bridge disconnect failed", e);
    }
  }

  return updated;
}

export async function pauseDemoLiveKitAiWorker(demoSessionId: string): Promise<DemoSession> {
  const session = await getDemoSession(demoSessionId);
  if (!session) throw new WorkflowError("Demo session not found.", "NOT_FOUND", 404);

  if (isLiveKitAiBridgeEnabled()) {
    try {
      await bridgeMuteDemoAiPublisher(demoSessionId, true);
    } catch (e) {
      console.warn("[pauseDemoLiveKitAiWorker] bridge mute failed", e);
    }
  }

  const updated = await saveDemoSession({
    ...session,
    ai_paused: true,
    ai_status: session.ai_status === "active" ? "paused" : session.ai_status,
    ai_audio_status: "paused",
    metadata: {
      ...(session.metadata ?? {}),
      ai_paused: true,
      ai_worker_phase: "paused",
    },
  });

  await publishDemoAiSyncToRoom(updated, { aiState: "paused" });

  if (session.ai_participant_identity) {
    await recordDemoRoomEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "ai_paused",
      participantIdentity: session.ai_participant_identity,
      participantRole: "ai_agent",
    });
  }

  return updated;
}

export async function resumeDemoLiveKitAiWorker(demoSessionId: string): Promise<DemoSession> {
  const session = await getDemoSession(demoSessionId);
  if (!session) throw new WorkflowError("Demo session not found.", "NOT_FOUND", 404);

  if (isLiveKitAiBridgeEnabled()) {
    try {
      await bridgeMuteDemoAiPublisher(demoSessionId, false);
    } catch (e) {
      console.warn("[resumeDemoLiveKitAiWorker] bridge unmute failed", e);
    }
  }

  const updated = await saveDemoSession({
    ...session,
    ai_paused: false,
    ai_status:
      session.ai_status === "paused" || session.ai_status === "stopped"
        ? "active"
        : session.ai_status === "not_started"
          ? "active"
          : session.ai_status,
    ai_joined: true,
    ai_audio_status: "listening",
    metadata: {
      ...(session.metadata ?? {}),
      ai_paused: false,
      ai_worker_phase: "listening",
    },
  });

  await publishDemoAiSyncToRoom(updated, { aiState: "listening" });

  if (session.ai_participant_identity) {
    await recordDemoRoomEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "ai_resumed",
      participantIdentity: session.ai_participant_identity,
      participantRole: "ai_agent",
    });
  }

  return updated;
}

export async function processDemoLiveKitAiMessage(params: {
  demoSessionId: string;
  message: string;
  transcriptSegment?: string;
  inputType?: "text" | "voice";
  customerMetadata?: {
    name?: string;
    email?: string;
    phone?: string;
    businessName?: string;
    industry?: string;
  };
  currentDemoAssetId?: string | null;
  isWelcomeTurn?: boolean;
}): Promise<DemoLiveKitAiTurnResult> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session) {
    return { ok: false, ai_status: "failed", phase: "failed", error: "Demo not found" };
  }
  if (!session.agent_id) {
    return { ok: false, ai_status: "failed", phase: "failed", error: "No agent" };
  }

  if (isDemoAiPaused(session)) {
    return {
      ok: false,
      ai_status: session.ai_status ?? "paused",
      phase: "paused",
      error: "AI is paused during human takeover",
    };
  }

  if (session.ai_status !== "active" && session.ai_status !== "starting") {
    return {
      ok: false,
      ai_status: session.ai_status ?? "not_started",
      phase: workerPhaseFromSession(session),
      error: "AI worker is not active",
    };
  }

  await patchAiAudioState(session, {
    ai_audio_status: "thinking",
    workerPhase: "thinking",
  });
  const sessionAfterThink = (await getDemoSession(session.id)) ?? session;
  await publishDemoAiSyncToRoom(sessionAfterThink, { aiState: "thinking" });

  const identity = session.ai_participant_identity;
  if (identity && !params.isWelcomeTurn) {
    await recordDemoRoomEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "ai_heard_user",
      participantIdentity: identity,
      participantRole: "ai_agent",
      metadata: { preview: params.message.slice(0, 120) },
    });
  }

  let result;
  try {
    result = await runDemoWorkflow({
      organizationId: session.organization_id,
      demoSessionId: session.id,
      agentId: session.agent_id,
      leadId: session.lead_id,
      customerMessage: params.message,
      transcriptSegment: params.transcriptSegment,
      inputType: params.inputType ?? "voice",
      participantRole: "prospect",
      currentDemoAssetId: params.currentDemoAssetId ?? session.current_demo_asset_id,
      channel: "demo_call",
      customerMetadata: params.customerMetadata,
      livekitAiVoice: true,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Workflow failed";
    await saveDemoSession({
      ...(await getDemoSession(session.id))!,
      ai_status: "failed",
      metadata: {
        ...((await getDemoSession(session.id))!.metadata ?? {}),
        ai_worker_phase: "failed",
        ai_worker_last_error: errMsg,
      },
    });
    await recordDemoRoomEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "ai_failed",
      participantIdentity: identity,
      participantRole: "ai_agent",
      metadata: { error: errMsg },
    });
    const fallback =
      "I'm having trouble responding clearly right now. I'll notify the team so they can assist you.";
    return {
      ok: false,
      ai_status: "failed",
      phase: "failed",
      ai_response: fallback,
      ai_voice_text: fallback,
      use_browser_tts: true,
      error: errMsg,
    };
  }

  const voiceText = toDemoVoiceText(result.aiVoiceText ?? result.aiResponse);
  let audio_base64: string | null = null;
  let audio_mime_type: string | null = null;
  let use_browser_tts = true;
  let published_to_livekit = false;
  let audioDelivery: DemoAiAudioMode = (sessionAfterThink.ai_audio_mode as DemoAiAudioMode) ?? "fallback_tts";
  let audioError: string | null = null;

  await patchAiAudioState(sessionAfterThink, {
    ai_audio_status: "speaking",
    workerPhase: "speaking",
  });
  await publishDemoAiSyncToRoom(sessionAfterThink, { aiState: "speaking" });

  if (
    isLiveKitAiBridgeEnabled() &&
    session.agent_id &&
    sessionAfterThink.ai_audio_mode !== "fallback_tts"
  ) {
    const bridgeSpeak = await bridgeSpeakDemoAi({
      demoSessionId: session.id,
      agentId: session.agent_id,
      voiceText,
    });
    if (bridgeSpeak.ok && bridgeSpeak.published_to_livekit) {
      published_to_livekit = true;
      use_browser_tts = false;
      audioDelivery = (sessionAfterThink.ai_audio_mode as DemoAiAudioMode) ?? "livekit_track";
    } else {
      audioError = bridgeSpeak.error ?? "LiveKit audio publish failed";
      audioDelivery = "fallback_tts";
      await recordDemoRoomEvent({
        demoSessionId: session.id,
        organizationId: session.organization_id,
        eventType: "ai_failed",
        participantIdentity: identity,
        participantRole: "ai_agent",
        metadata: { scope: "native_audio_speak", error: audioError, fallback: "fallback_tts" },
      });
    }
  }

  if (!published_to_livekit) {
    try {
      const speech = await synthesizeDemoSpeech(voiceText);
      if (speech?.audioBase64) {
        audio_base64 = speech.audioBase64;
        audio_mime_type = speech.mimeType ?? "audio/mpeg";
        use_browser_tts = false;
      }
    } catch {
      use_browser_tts = true;
    }
    if (!use_browser_tts && !published_to_livekit) {
      audioDelivery = "fallback_tts";
    }
    if (use_browser_tts) {
      audioDelivery = "fallback_tts";
    }
  }

  const now = new Date().toISOString();
  const latest = (await getDemoSession(session.id)) ?? sessionAfterThink;
  const refreshed = await saveDemoSession({
    ...latest,
    ai_last_response_at: now,
    ai_last_spoken_at: now,
    ai_status: "active",
    ai_audio_mode: audioDelivery,
    ai_audio_status: "listening",
    ai_audio_track_published: published_to_livekit || latest.ai_audio_track_published === true,
    ai_audio_error: audioError,
    metadata: {
      ...(latest.metadata ?? {}),
      ai_worker_phase: "listening",
    },
  });

  if (result.messageId) {
    await patchDemoMessageMetadata(result.messageId, {
      audio_delivery: audioDelivery,
      published_to_livekit,
      use_browser_tts,
    });
  }

  await publishDemoAiSyncToRoom(refreshed, {
    aiState: "listening",
    selectedDemoPathId: result.selectedDemoPathId,
    currentDemoAssetId: result.currentDemoAssetId,
    leadScore: result.leadScore,
    leadCategory: result.leadCategory,
    bookingRecommended: result.bookingRecommended,
    handoffRequired: result.handoffRequired,
  });

  if (identity) {
    await recordDemoRoomEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "ai_spoke",
      participantIdentity: identity,
      participantRole: "ai_agent",
      metadata: {
        preview: voiceText.slice(0, 120),
        audio_delivery: audioDelivery,
        published_to_livekit,
      },
    });
    if (result.bookingRecommended) {
      await recordDemoRoomEvent({
        demoSessionId: session.id,
        organizationId: session.organization_id,
        eventType: "ai_triggered_booking",
        participantIdentity: identity,
        participantRole: "ai_agent",
      });
    }
    if (result.handoffRequired) {
      await recordDemoRoomEvent({
        demoSessionId: session.id,
        organizationId: session.organization_id,
        eventType: "ai_triggered_handoff",
        participantIdentity: identity,
        participantRole: "ai_agent",
      });
    }
  }

  return {
    ok: true,
    ai_status: refreshed.ai_status ?? "active",
    phase: "listening",
    ai_response: result.aiResponse,
    ai_voice_text: voiceText,
    audio_base64,
    audio_mime_type,
    use_browser_tts: shouldUseBrowserTts(refreshed, { published_to_livekit }),
    published_to_livekit,
    ai_audio_mode: refreshed.ai_audio_mode,
    ai_audio_status: refreshed.ai_audio_status,
    ai_audio_track_published: refreshed.ai_audio_track_published,
    structured: result.structured as Record<string, unknown> | undefined,
    selected_demo_path_id: result.selectedDemoPathId,
    current_demo_asset_id: result.currentDemoAssetId,
    next_demo_asset_id: result.nextDemoAssetId,
    lead_score: result.leadScore,
    lead_category: result.leadCategory,
    booking_recommended: result.bookingRecommended,
    handoff_required: result.handoffRequired,
    recommended_next_action: result.recommendedNextAction,
    demo_stage: result.demoStage,
    message_id: result.messageId,
    used_fallback: result.usedFallback,
    selected_demo_path_title: result.selectedDemoPathTitle ?? null,
    next_asset: result.nextDemoAsset
      ? {
          id: result.nextDemoAsset.id,
          title: result.nextDemoAsset.title,
          content: result.nextDemoAsset.content,
          asset_type: result.nextDemoAsset.asset_type,
        }
      : null,
    qualification_progress: result.qualificationProgress as
      | Record<string, boolean>
      | undefined,
    objections: result.objections,
  };
}

export async function restartDemoLiveKitAiWorker(demoSessionId: string): Promise<{
  session: DemoSession;
  status: ReturnType<typeof getDemoLiveKitAiStatus>;
}> {
  await stopDemoLiveKitAiWorker({ demoSessionId, reason: "restart" });
  return startDemoLiveKitAiWorker({ demoSessionId, skipWelcome: true });
}

export async function setDemoLiveKitAiAudioMode(
  demoSessionId: string,
  mode: DemoAiAudioMode
): Promise<DemoSession> {
  const session = await getDemoSession(demoSessionId);
  if (!session) throw new WorkflowError("Demo session not found.", "NOT_FOUND", 404);

  if (mode === "fallback_tts" && isLiveKitAiBridgeEnabled()) {
    try {
      await bridgeMuteDemoAiPublisher(demoSessionId, true);
    } catch {
      /* ignore */
    }
  }

  if (mode === "livekit_track" && isLiveKitAiBridgeEnabled() && session.agent_id) {
    const connect = await bridgeConnectDemoAiPublisher({
      demoSessionId,
      agentId: session.agent_id,
    });
    return patchAiAudioState(session, {
      ai_audio_mode: connect.ok ? "livekit_track" : "fallback_tts",
      ai_audio_track_published: connect.ok,
      ai_audio_error: connect.ok ? null : (connect.error ?? "Connect failed"),
      ai_audio_status: "listening",
      workerPhase: "listening",
    });
  }

  return patchAiAudioState(session, {
    ai_audio_mode: mode,
    ai_audio_track_published: mode !== "fallback_tts",
    ai_audio_error: null,
  });
}

export async function shouldAutoStartLiveKitAi(
  organizationId: string,
  session: DemoSession
): Promise<boolean> {
  const settings = await getDemoProviderSettings(organizationId);
  const meta = session.metadata ?? {};
  if (meta.enable_ai_auto_join === false) return false;
  if (settings.enable_ai_auto_join === false) return false;
  return (
    isLiveKitEnvConfigured() &&
    (session.video_provider === "livekit" ||
      session.livekit_room_name != null ||
      meta.use_livekit_video === true)
  );
}
