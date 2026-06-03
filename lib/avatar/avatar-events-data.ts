import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { AvatarEvent } from "./types";

const JSON_FILE = "platform/avatar-events.json";

async function readAll(): Promise<AvatarEvent[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: AvatarEvent[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function listAvatarEvents(
  demoSessionId: string
): Promise<AvatarEvent[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("avatar_events")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: true });
    return (data as AvatarEvent[]) ?? [];
  }
  return (await readAll())
    .filter((e) => e.demo_session_id === demoSessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveAvatarEvent(
  event: Omit<AvatarEvent, "id" | "created_at"> & {
    id?: string;
    created_at?: string;
  }
): Promise<AvatarEvent> {
  const row: AvatarEvent = {
    id: event.id ?? crypto.randomUUID(),
    created_at: event.created_at ?? new Date().toISOString(),
    organization_id: event.organization_id,
    demo_session_id: event.demo_session_id,
    provider: event.provider,
    event_type: event.event_type,
    payload: event.payload ?? {},
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("avatar_events")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data as AvatarEvent;
  }

  const all = await readAll();
  all.push(row);
  await writeAll(all);
  return row;
}
