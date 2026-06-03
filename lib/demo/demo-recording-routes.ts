import { requireSession } from "@/lib/platform/auth";
import { getDemoSession } from "./demo-data";
import {
  canControlDemoRecording,
  canDeleteDemoRecording,
  canViewDemoRecording,
} from "./demo-recording-permissions";
import {
  handleRecordingConsent,
  handleRecordingStart,
  handleRecordingStatus,
  handleRecordingStop,
} from "./demo-recording-handlers";
import { listDemoRecordings, saveDemoRecording } from "./demo-recordings-data";
import { saveDemoSession } from "./demo-data";
import type { SessionContext } from "@/lib/platform/types";

async function loadSessionForUser(ctx: SessionContext, demoSessionId: string) {
  const demo = await getDemoSession(demoSessionId);
  if (!demo || demo.organization_id !== ctx.organization.id) {
    return { error: { status: 404, body: { error: "Not found" } } as const };
  }
  return { demo };
}

export async function platformRecordingStart(
  ctx: SessionContext,
  demoSessionId: string,
  body: unknown
) {
  const loaded = await loadSessionForUser(ctx, demoSessionId);
  if ("error" in loaded) return loaded.error;
  if (!canControlDemoRecording(ctx, loaded.demo)) {
    return { status: 403, body: { error: "Permission denied" } };
  }
  const payload =
    typeof body === "object" && body !== null
      ? {
          ...(body as Record<string, unknown>),
          demo_session_id: demoSessionId,
          started_by: ctx.userId,
        }
      : { demo_session_id: demoSessionId, started_by: ctx.userId };
  return handleRecordingStart(payload);
}

export async function platformRecordingStop(
  ctx: SessionContext,
  demoSessionId: string,
  body: unknown
) {
  const loaded = await loadSessionForUser(ctx, demoSessionId);
  if ("error" in loaded) return loaded.error;
  if (!canControlDemoRecording(ctx, loaded.demo)) {
    return { status: 403, body: { error: "Permission denied" } };
  }
  const payload =
    typeof body === "object" && body !== null
      ? { ...(body as Record<string, unknown>), demo_session_id: demoSessionId }
      : { demo_session_id: demoSessionId };
  return handleRecordingStop(payload);
}

export async function platformRecordingStatus(ctx: SessionContext, demoSessionId: string) {
  const loaded = await loadSessionForUser(ctx, demoSessionId);
  if ("error" in loaded) return loaded.error;
  if (!canViewDemoRecording(ctx, loaded.demo)) {
    return { status: 403, body: { error: "Recording access denied" } };
  }
  return handleRecordingStatus(demoSessionId);
}

export async function platformRecordingDelete(ctx: SessionContext, demoSessionId: string) {
  const loaded = await loadSessionForUser(ctx, demoSessionId);
  if ("error" in loaded) return loaded.error;
  if (!canDeleteDemoRecording(ctx)) {
    return { status: 403, body: { error: "Permission denied" } };
  }
  const recordings = await listDemoRecordings(demoSessionId);
  const now = new Date().toISOString();
  for (const rec of recordings) {
    await saveDemoRecording({
      ...rec,
      status: "stopped",
      recording_url: null,
      updated_at: now,
    });
  }
  await saveDemoSession({
    ...loaded.demo,
    recording_url: null,
    recording_status: "idle",
    recording_error: null,
  });
  return { status: 200, body: { ok: true, deleted: recordings.length } };
}

export async function withPlatformRecordingHandler(
  handler: (
    ctx: SessionContext
  ) => Promise<{ status: number; body: Record<string, unknown> } | undefined>
) {
  try {
    const ctx = await requireSession();
    const result = await handler(ctx);
    if (!result) {
      return Response.json({ error: "Recording handler returned no response" }, { status: 500 });
    }
    return Response.json(result.body, { status: result.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return Response.json({ error: msg }, { status: 401 });
  }
}
