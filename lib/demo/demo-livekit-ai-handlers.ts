import { z } from "zod";
import { WorkflowError } from "@/lib/platform/workflow/types";
import { getDemoSession } from "./demo-data";
import { listDemoRoomEvents } from "./demo-room-events-data";
import { DEMO_AI_AUDIO_MODES } from "./types";
import {
  getDemoLiveKitAiStatus,
  pauseDemoLiveKitAiWorker,
  processDemoLiveKitAiMessage,
  restartDemoLiveKitAiWorker,
  resumeDemoLiveKitAiWorker,
  setDemoLiveKitAiAudioMode,
  startDemoLiveKitAiWorker,
  stopDemoLiveKitAiWorker,
} from "./demo-livekit-ai-worker";

const sessionIdSchema = z.object({
  demo_session_id: z.string().uuid(),
});

const messageSchema = sessionIdSchema.extend({
  message: z.string().min(1).max(8000),
  transcript_segment: z.string().max(8000).optional(),
  input_type: z.enum(["text", "voice"]).optional(),
  current_demo_asset_id: z.string().uuid().optional().nullable(),
  display_name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
});

function workflowToResponse(e: unknown) {
  if (e instanceof WorkflowError) {
    return {
      status: e.statusCode ?? 400,
      body: { error: e.message, code: e.code },
    };
  }
  return {
    status: 500,
    body: { error: e instanceof Error ? e.message : "AI worker error" },
  };
}

export async function handleLiveKitAiStart(body: unknown) {
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const result = await startDemoLiveKitAiWorker({
      demoSessionId: parsed.data.demo_session_id,
    });
    return {
      status: 200,
      body: {
        ok: true,
        session_id: result.session.id,
        ...result.status,
        welcome_turn: result.welcome_turn,
        livekit_token: result.livekit_token,
      },
    };
  } catch (e) {
    return workflowToResponse(e);
  }
}

export async function handleLiveKitAiStop(body: unknown) {
  const parsed = sessionIdSchema.extend({ reason: z.string().max(200).optional() }).safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const session = await stopDemoLiveKitAiWorker({
      demoSessionId: parsed.data.demo_session_id,
      reason: parsed.data.reason,
    });
    return {
      status: 200,
      body: { ok: true, ...getDemoLiveKitAiStatus(session) },
    };
  } catch (e) {
    return workflowToResponse(e);
  }
}

export async function handleLiveKitAiStatus(body: unknown) {
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  const session = await getDemoSession(parsed.data.demo_session_id);
  if (!session) return { status: 404, body: { error: "Not found" } };
  const pathTitle =
    typeof session.metadata?.demo_path_title === "string"
      ? session.metadata.demo_path_title
      : null;
  return {
    status: 200,
    body: {
      ok: true,
      session_id: session.id,
      ...getDemoLiveKitAiStatus(session),
      demo_path_id: session.demo_path_id,
      demo_path_title: pathTitle,
      current_demo_stage: session.current_demo_stage,
      current_demo_asset_id: session.current_demo_asset_id,
      lead_score: session.lead_score,
      lead_category: session.lead_category,
      booking_recommended: session.booking_recommended,
      handoff_required: session.handoff_required,
      recommended_next_action: session.recommended_next_action,
      qualification_progress: session.qualification_progress,
      objections: session.objections,
    },
  };
}

export async function handleLiveKitAiMessage(body: unknown) {
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const turn = await processDemoLiveKitAiMessage({
      demoSessionId: parsed.data.demo_session_id,
      message: parsed.data.message,
      transcriptSegment: parsed.data.transcript_segment,
      inputType: parsed.data.input_type,
      currentDemoAssetId: parsed.data.current_demo_asset_id,
      customerMetadata: {
        name: parsed.data.display_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
    });
    return { status: turn.ok ? 200 : 503, body: { ...turn } };
  } catch (e) {
    return workflowToResponse(e);
  }
}

export async function handleLiveKitAiPause(body: unknown) {
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const session = await pauseDemoLiveKitAiWorker(parsed.data.demo_session_id);
    return { status: 200, body: { ok: true, ...getDemoLiveKitAiStatus(session) } };
  } catch (e) {
    return workflowToResponse(e);
  }
}

export async function handleLiveKitAiRestart(body: unknown) {
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const result = await restartDemoLiveKitAiWorker(parsed.data.demo_session_id);
    return {
      status: 200,
      body: { ok: true, session_id: result.session.id, ...result.status },
    };
  } catch (e) {
    return workflowToResponse(e);
  }
}

export async function handleLiveKitAiAudioMode(body: unknown) {
  const parsed = sessionIdSchema
    .extend({ mode: z.enum(DEMO_AI_AUDIO_MODES) })
    .safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const session = await setDemoLiveKitAiAudioMode(
      parsed.data.demo_session_id,
      parsed.data.mode
    );
    return { status: 200, body: { ok: true, ...getDemoLiveKitAiStatus(session) } };
  } catch (e) {
    return workflowToResponse(e);
  }
}

export async function handleLiveKitAiAudioLogs(body: unknown) {
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  const session = await getDemoSession(parsed.data.demo_session_id);
  if (!session) return { status: 404, body: { error: "Not found" } };
  const events = await listDemoRoomEvents(session.id);
  const aiTypes = new Set([
    "ai_joined",
    "ai_started",
    "ai_paused",
    "ai_resumed",
    "ai_stopped",
    "ai_failed",
    "ai_spoke",
    "ai_heard_user",
    "ai_triggered_booking",
    "ai_triggered_handoff",
  ]);
  const logs = events
    .filter((e) => aiTypes.has(e.event_type))
    .slice(0, 80)
    .map((e) => ({
      event_type: e.event_type,
      created_at: e.created_at,
      metadata: e.metadata ?? {},
    }));
  return {
    status: 200,
    body: {
      ok: true,
      logs,
      ...getDemoLiveKitAiStatus(session),
    },
  };
}

export async function handleLiveKitAiResume(body: unknown) {
  const parsed = sessionIdSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const session = await resumeDemoLiveKitAiWorker(parsed.data.demo_session_id);
    return { status: 200, body: { ok: true, ...getDemoLiveKitAiStatus(session) } };
  } catch (e) {
    return workflowToResponse(e);
  }
}
