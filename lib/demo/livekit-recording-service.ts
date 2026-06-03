import { EgressClient, EncodedFileOutput, EncodedFileType } from "livekit-server-sdk";
import { getDemoSession, saveDemoSession } from "./demo-data";
import { demoLiveKitRoomName } from "./livekit-token";
import { isLiveKitEnvConfigured } from "./demo-provider";
import { getDemoProviderSettings } from "./demo-provider";
import { resolveDemoRecordingSettings } from "./demo-recording-settings";
import {
  getActiveDemoRecording,
  saveDemoRecording,
} from "./demo-recordings-data";
import { recordDemoRoomEvent } from "./demo-room-events-data";
import { recordDemoTimelineEvent } from "./demo-timeline-data";
import type { DemoRecording } from "./types";

function liveKitHost(): string {
  const url = process.env.LIVEKIT_URL!.trim().replace(/\/$/, "");
  return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export async function getRecordingProviderStatus(organizationId: string) {
  const settings = await getDemoProviderSettings(organizationId);
  const rec = resolveDemoRecordingSettings(settings);
  return {
    configured: rec.egressReady,
    provider: rec.provider,
    enable_recording: rec.enableRecording,
    message: rec.egressReady
      ? null
      : "Recording provider is not configured yet.",
  };
}

export async function startDemoRecording(params: {
  demoSessionId: string;
  startedBy: string;
  consentGiven: boolean;
}): Promise<{ session: Awaited<ReturnType<typeof getDemoSession>>; recording: DemoRecording }> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session) throw new Error("Demo session not found");

  const recSettings = resolveDemoRecordingSettings(
    await getDemoProviderSettings(session.organization_id)
  );

  if (!recSettings.enableRecording) {
    throw new Error("Recording is disabled in demo settings");
  }
  if (recSettings.recordOnlyWithConsent && !params.consentGiven) {
    throw new Error("Recording consent required");
  }
  if (!isLiveKitEnvConfigured()) {
    throw new Error("LiveKit not configured");
  }

  const roomName = session.livekit_room_name ?? demoLiveKitRoomName(session.id);
  const roomStatus = session.livekit_room_status;
  if (!roomName || roomStatus === "not_created" || roomStatus === "ended") {
    throw new Error("LiveKit room is not active. Join the video room first.");
  }

  const now = new Date().toISOString();
  const recordingId = crypto.randomUUID();
  let egressId: string | null = null;
  let errorMessage: string | null = null;
  let rowStatus: DemoRecording["status"] = "starting";

  if (recSettings.egressReady) {
    try {
      const client = new EgressClient(
        liveKitHost(),
        process.env.LIVEKIT_API_KEY!.trim(),
        process.env.LIVEKIT_API_SECRET!.trim()
      );
      const filepath = `demos/${session.organization_id}/${session.id}/${recordingId}.mp4`;
      const output = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath,
      });
      const info = await client.startRoomCompositeEgress(roomName, { file: output });
      egressId = info.egressId ?? null;
      rowStatus = "recording";
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "Failed to start egress";
      rowStatus = "failed";
    }
  } else {
    errorMessage = "Recording provider is not configured yet.";
    rowStatus = "failed";
  }

  const recording: DemoRecording = {
    id: recordingId,
    demo_session_id: session.id,
    organization_id: session.organization_id,
    provider: recSettings.provider,
    status: rowStatus,
    egress_id: egressId,
    recording_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    file_size: null,
    consent_given: params.consentGiven,
    started_by: params.startedBy,
    started_at: now,
    ended_at: null,
    error_message: errorMessage,
    metadata: { storage: recSettings.storageLocation },
    created_at: now,
  };
  await saveDemoRecording(recording);

  const updated = await saveDemoSession({
    ...session,
    recording_enabled: true,
    recording_consent_given: params.consentGiven,
    recording_status: rowStatus === "recording" ? "recording" : rowStatus === "failed" ? "failed" : "starting",
    recording_started_at: now,
    recording_provider: recSettings.provider,
    recording_error: errorMessage,
  });

  if (rowStatus === "recording") {
    await recordDemoRoomEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "recording_started",
      metadata: { recording_id: recordingId, egress_id: egressId },
    });
    await recordDemoTimelineEvent({
      demoSessionId: session.id,
      organizationId: session.organization_id,
      eventType: "recording_started",
      title: "Recording started",
      description: params.startedBy ? `Started by ${params.startedBy}` : undefined,
      metadata: { recording_id: recordingId },
    });
  }

  return { session: updated, recording };
}

export async function stopDemoRecording(params: {
  demoSessionId: string;
  stoppedBy?: string;
}): Promise<{ session: Awaited<ReturnType<typeof getDemoSession>>; recording: DemoRecording | null }> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session) throw new Error("Demo session not found");

  const active = await getActiveDemoRecording(session.id);
  const now = new Date().toISOString();

  if (active?.egress_id && isLiveKitEnvConfigured()) {
    try {
      const client = new EgressClient(
        liveKitHost(),
        process.env.LIVEKIT_API_KEY!.trim(),
        process.env.LIVEKIT_API_SECRET!.trim()
      );
      await client.stopEgress(active.egress_id);
    } catch (e) {
      console.warn("[stopDemoRecording] stopEgress", e);
    }
  }

  let recording: DemoRecording | null = active;
  if (active) {
    recording = await saveDemoRecording({
      ...active,
      status: active.recording_url ? "stopped" : "processing",
      ended_at: now,
    });
  }

  const updated = await saveDemoSession({
    ...session,
    recording_status: "stopped",
    recording_ended_at: now,
    recording_error: null,
  });

  await recordDemoRoomEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "recording_stopped",
    metadata: { recording_id: active?.id, stopped_by: params.stoppedBy },
  });
  await recordDemoTimelineEvent({
    demoSessionId: session.id,
    organizationId: session.organization_id,
    eventType: "recording_stopped",
    title: "Recording stopped",
    metadata: { recording_id: active?.id },
  });

  return { session: updated, recording };
}

export async function applyEgressEndedWebhook(params: {
  egressId: string;
  fileUrl?: string | null;
  durationSeconds?: number;
  error?: string | null;
}) {
  const { isSupabaseConfigured } = await import("@/lib/supabase/env");
  const { platformDb } = await import("@/lib/platform/db");

  let recording: DemoRecording | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_recordings")
      .select("*")
      .eq("egress_id", params.egressId)
      .maybeSingle();
    recording = (data as DemoRecording) ?? null;
  } else {
    const { readJsonFile } = await import("@/lib/persistence/json-db");
    const rows = await readJsonFile<DemoRecording[]>("platform/demo-recordings.json", []);
    recording = rows.find((r) => r.egress_id === params.egressId) ?? null;
  }

  if (!recording) return { ok: true, ignored: true };

  const status = params.error ? "failed" : params.fileUrl ? "stopped" : "processing";
  await saveDemoRecording({
    ...recording,
    status,
    recording_url: params.fileUrl ?? recording.recording_url,
    duration_seconds: params.durationSeconds ?? recording.duration_seconds,
    error_message: params.error ?? null,
    ended_at: recording.ended_at ?? new Date().toISOString(),
  });

  const session = await getDemoSession(recording.demo_session_id);
  if (session) {
    await saveDemoSession({
      ...session,
      recording_url: params.fileUrl ?? session.recording_url,
      recording_status: params.error ? "failed" : "stopped",
      recording_error: params.error ?? null,
    });
  }

  return { ok: true, recording_id: recording.id };
}

export async function getDemoRecordingStatus(demoSessionId: string) {
  const session = await getDemoSession(demoSessionId);
  if (!session) throw new Error("Demo session not found");
  const recordings = await import("./demo-recordings-data").then((m) =>
    m.listDemoRecordings(demoSessionId)
  );
  const provider = await getRecordingProviderStatus(session.organization_id);
  return {
    session_id: demoSessionId,
    recording_status: session.recording_status ?? "idle",
    recording_consent_given: session.recording_consent_given ?? false,
    recording_started_at: session.recording_started_at,
    recording_ended_at: session.recording_ended_at,
    recording_url: session.recording_url,
    recording_error: session.recording_error,
    provider,
    recordings,
  };
}
