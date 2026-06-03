import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoTimelineEvent, DemoTimelineEventType } from "./types";

const JSON_FILE = "platform/demo-timeline-events.json";

async function readAll(): Promise<DemoTimelineEvent[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: DemoTimelineEvent[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function listDemoTimelineEvents(
  demoSessionId: string
): Promise<DemoTimelineEvent[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_timeline_events")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("event_at", { ascending: true });
    return (data as DemoTimelineEvent[]) ?? [];
  }
  return (await readAll())
    .filter((e) => e.demo_session_id === demoSessionId)
    .sort((a, b) => a.event_at.localeCompare(b.event_at));
}

export async function recordDemoTimelineEvent(params: {
  demoSessionId: string;
  organizationId: string;
  eventType: DemoTimelineEventType | string;
  title: string;
  description?: string | null;
  eventAt?: string;
  metadata?: Record<string, unknown>;
}): Promise<DemoTimelineEvent> {
  const row: DemoTimelineEvent = {
    id: crypto.randomUUID(),
    demo_session_id: params.demoSessionId,
    organization_id: params.organizationId,
    event_type: params.eventType,
    title: params.title,
    description: params.description ?? null,
    event_at: params.eventAt ?? new Date().toISOString(),
    metadata: params.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_timeline_events")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data as DemoTimelineEvent;
  }
  const all = await readAll();
  all.push(row);
  await writeAll(all);
  return row;
}
