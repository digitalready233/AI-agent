import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoPresenterEvent } from "./ai-presenter-types";

const JSON_FILE = "platform/demo-presenter-events.json";

async function readAll(): Promise<DemoPresenterEvent[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: DemoPresenterEvent[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function listDemoPresenterEvents(
  demoSessionId: string
): Promise<DemoPresenterEvent[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_presenter_events")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: true });
    return (data as DemoPresenterEvent[]) ?? [];
  }
  return (await readAll())
    .filter((e) => e.demo_session_id === demoSessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveDemoPresenterEvent(
  event: Omit<DemoPresenterEvent, "id" | "created_at" | "metadata"> & {
    id?: string;
    created_at?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<DemoPresenterEvent> {
  const row: DemoPresenterEvent = {
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
      .from("demo_presenter_events")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data as DemoPresenterEvent;
  }

  const all = await readAll();
  all.push(row);
  await writeAll(all);
  return row;
}
