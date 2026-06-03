import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoRoomEvent, DemoRoomEventType } from "./types";

const JSON_FILE = "platform/demo-room-events.json";

export async function listDemoRoomEvents(demoSessionId: string): Promise<DemoRoomEvent[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_room_events")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: true });
    return (data as DemoRoomEvent[]) ?? [];
  }
  return (await readJsonFile<DemoRoomEvent[]>(JSON_FILE, []))
    .filter((e) => e.demo_session_id === demoSessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveDemoRoomEvent(event: DemoRoomEvent): Promise<DemoRoomEvent> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_room_events")
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data as DemoRoomEvent;
  }
  const all = await readJsonFile<DemoRoomEvent[]>(JSON_FILE, []);
  all.push(event);
  await writeJsonFile(JSON_FILE, all);
  return event;
}

export async function recordDemoRoomEvent(params: {
  demoSessionId: string;
  organizationId: string;
  eventType: DemoRoomEventType;
  participantIdentity?: string | null;
  participantRole?: DemoRoomEvent["participant_role"];
  metadata?: Record<string, unknown>;
}): Promise<DemoRoomEvent> {
  const now = new Date().toISOString();
  return saveDemoRoomEvent({
    id: crypto.randomUUID(),
    demo_session_id: params.demoSessionId,
    organization_id: params.organizationId,
    event_type: params.eventType,
    participant_identity: params.participantIdentity ?? null,
    participant_role: params.participantRole ?? null,
    metadata: params.metadata ?? {},
    created_at: now,
  });
}
