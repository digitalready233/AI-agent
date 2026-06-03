import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoPresentationEvent, DemoPresentationEventType } from "./types";

const JSON_FILE = "platform/demo-presentation-events.json";

async function readAll(): Promise<DemoPresentationEvent[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: DemoPresentationEvent[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function listDemoPresentationEvents(
  demoSessionId: string
): Promise<DemoPresentationEvent[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_presentation_events")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: true });
    return (data as DemoPresentationEvent[]) ?? [];
  }
  return (await readAll())
    .filter((e) => e.demo_session_id === demoSessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveDemoPresentationEvent(
  event: Omit<DemoPresentationEvent, "id" | "created_at"> & {
    id?: string;
    created_at?: string;
  }
): Promise<DemoPresentationEvent> {
  const row: DemoPresentationEvent = {
    id: event.id ?? crypto.randomUUID(),
    created_at: event.created_at ?? new Date().toISOString(),
    organization_id: event.organization_id,
    demo_session_id: event.demo_session_id,
    event_type: event.event_type,
    actor_type: event.actor_type ?? null,
    actor_id: event.actor_id ?? null,
    title: event.title,
    description: event.description ?? null,
    metadata: event.metadata ?? {},
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_presentation_events")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data as DemoPresentationEvent;
  }

  const all = await readAll();
  all.push(row);
  await writeAll(all);
  return row;
}

export async function recordDemoPresentationEvent(params: {
  organizationId: string;
  demoSessionId: string;
  eventType: DemoPresentationEventType | string;
  actorType?: string | null;
  actorId?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<DemoPresentationEvent> {
  return saveDemoPresentationEvent({
    organization_id: params.organizationId,
    demo_session_id: params.demoSessionId,
    event_type: params.eventType,
    actor_type: params.actorType ?? null,
    actor_id: params.actorId ?? null,
    title: params.title,
    description: params.description ?? null,
    metadata: params.metadata ?? {},
  });
}
