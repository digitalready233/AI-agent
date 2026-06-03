import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import type { DemoSession } from "@/lib/demo/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { saveAvatarEvent } from "./avatar-events-data";
import { mapDidWebhookEvent } from "./did-api";
import type { AvatarSessionStatus } from "./types";

async function findDemoSessionByDidStreamId(
  streamId: string
): Promise<DemoSession | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_sessions")
      .select("*")
      .or(
        `avatar_session_id.eq.${streamId},did_stream_id.eq.${streamId},did_session_id.eq.${streamId}`
      )
      .limit(1)
      .maybeSingle();
    return (data as DemoSession) ?? null;
  }
  const { readJsonFile } = await import("@/lib/persistence/json-db");
  const sessions = await readJsonFile<DemoSession[]>("platform/demo-sessions.json", []);
  return (
    sessions.find(
      (s) =>
        s.avatar_session_id === streamId ||
        s.did_stream_id === streamId ||
        s.did_session_id === streamId
    ) ?? null
  );
}

export async function handleDidWebhookPayload(
  body: Record<string, unknown>
): Promise<{ ok: boolean; matched: boolean }> {
  const mapped = mapDidWebhookEvent(body);
  let session =
    mapped.demoSessionId ? await getDemoSession(mapped.demoSessionId) : null;

  if (!session && mapped.streamId) {
    session = await findDemoSessionByDidStreamId(mapped.streamId);
  }

  if (!session) {
    return { ok: true, matched: false };
  }

  const eventType = mapped.eventType.startsWith("did_")
    ? mapped.eventType
    : `did_${mapped.eventType.replace(/\./g, "_")}`;

  await saveAvatarEvent({
    organization_id: session.organization_id,
    demo_session_id: session.id,
    provider: "did",
    event_type: eventType,
    payload: mapped.payload,
  });

  const patch: Partial<DemoSession> = {
    metadata: {
      ...(session.metadata ?? {}),
      avatar_last_event: eventType,
      did_last_webhook_at: new Date().toISOString(),
    },
  };

  if (mapped.status) {
    patch.avatar_status = mapped.status as AvatarSessionStatus;
  }
  if (mapped.status === "stopped") {
    patch.avatar_stopped_at = new Date().toISOString();
  }
  if (mapped.status === "failed") {
    patch.avatar_error =
      typeof mapped.payload.error === "string"
        ? mapped.payload.error
        : "D-ID reported an error";
  }

  await saveDemoSession({ ...session, ...patch });

  return { ok: true, matched: true };
}
