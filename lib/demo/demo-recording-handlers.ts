import { z } from "zod";
import {
  getDemoRecordingStatus,
  startDemoRecording,
  stopDemoRecording,
  applyEgressEndedWebhook,
} from "./livekit-recording-service";
import { getDemoSession, saveDemoSession } from "./demo-data";
import { recordDemoTimelineEvent } from "./demo-timeline-data";

const sessionSchema = z.object({
  demo_session_id: z.string().uuid(),
});

const startSchema = sessionSchema.extend({
  consent_given: z.boolean().optional().default(false),
  started_by: z.string().max(120).optional(),
});

const consentSchema = sessionSchema.extend({
  consent_given: z.boolean(),
});

export async function handleRecordingStart(body: unknown) {
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const result = await startDemoRecording({
      demoSessionId: parsed.data.demo_session_id,
      startedBy: parsed.data.started_by ?? "staff",
      consentGiven: parsed.data.consent_given ?? false,
    });
    return {
      status: 200,
      body: {
        ok: true,
        recording_status: result.session?.recording_status,
        recording: result.recording,
      },
    };
  } catch (e) {
    return {
      status: 400,
      body: { error: e instanceof Error ? e.message : "Recording start failed" },
    };
  }
}

export async function handleRecordingStop(body: unknown) {
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  try {
    const result = await stopDemoRecording({
      demoSessionId: parsed.data.demo_session_id,
      stoppedBy: parsed.data.started_by,
    });
    return {
      status: 200,
      body: {
        ok: true,
        recording_status: result.session?.recording_status,
        recording: result.recording,
      },
    };
  } catch (e) {
    return {
      status: 400,
      body: { error: e instanceof Error ? e.message : "Recording stop failed" },
    };
  }
}

export async function handleRecordingStatus(demoSessionId: string) {
  try {
    const body = await getDemoRecordingStatus(demoSessionId);
    return { status: 200, body: { ok: true, ...body } };
  } catch (e) {
    return {
      status: 404,
      body: { error: e instanceof Error ? e.message : "Not found" },
    };
  }
}

export async function handleRecordingConsent(body: unknown) {
  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.flatten() } };
  }
  const session = await getDemoSession(parsed.data.demo_session_id);
  if (!session) {
    return { status: 404, body: { error: "Session not found" } };
  }

  const updated = await saveDemoSession({
    ...session,
    recording_consent_given: parsed.data.consent_given,
    recording_status: parsed.data.consent_given
      ? ["consent_required", "pending_consent"].includes(session.recording_status ?? "")
        ? "idle"
        : session.recording_status
      : "idle",
    recording_enabled: parsed.data.consent_given,
    metadata: {
      ...session.metadata,
      recording_consent_declined: !parsed.data.consent_given,
    },
  });

  return {
    status: 200,
    body: {
      ok: true,
      recording_consent_given: updated.recording_consent_given,
      recording_status: updated.recording_status,
    },
  };
}

export async function handleRecordingWebhook(payload: {
  egress_id?: string;
  egressId?: string;
  file?: { location?: string; filename?: string };
  file_results?: Array<{ location?: string; duration?: number }>;
  error?: string;
}) {
  const egressId = payload.egress_id ?? payload.egressId;
  if (!egressId) {
    return { status: 200, body: { ok: true, ignored: true } };
  }
  const fileUrl =
    payload.file?.location ??
    payload.file_results?.[0]?.location ??
    null;
  const duration = payload.file_results?.[0]?.duration;
  const result = await applyEgressEndedWebhook({
    egressId,
    fileUrl,
    durationSeconds: duration ? Math.round(duration) : undefined,
    error: payload.error ?? null,
  });
  return { status: 200, body: result };
}
