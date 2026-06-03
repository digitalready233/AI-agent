import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoEvent, DemoEventType } from "./types";

const JSON_FILE = "platform/demo-events.json";

export async function listDemoEvents(demoSessionId: string): Promise<DemoEvent[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_events")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: true });
    return (data as DemoEvent[]) ?? [];
  }
  return (await readJsonFile<DemoEvent[]>(JSON_FILE, []))
    .filter((e) => e.demo_session_id === demoSessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveDemoEvent(event: DemoEvent): Promise<DemoEvent> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_events")
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data as DemoEvent;
  }
  const all = await readJsonFile<DemoEvent[]>(JSON_FILE, []);
  all.push(event);
  await writeJsonFile(JSON_FILE, all);
  return event;
}

export async function recordDemoEvent(params: {
  demoSessionId: string;
  organizationId: string;
  eventType: DemoEventType;
  actorType?: DemoEvent["actor_type"];
  actorId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
}): Promise<DemoEvent> {
  const now = new Date().toISOString();
  return saveDemoEvent({
    id: crypto.randomUUID(),
    demo_session_id: params.demoSessionId,
    organization_id: params.organizationId,
    event_type: params.eventType,
    actor_type: params.actorType ?? "system",
    actor_id: params.actorId ?? null,
    description: params.description ?? null,
    metadata: params.metadata ?? {},
    created_at: now,
  });
}
