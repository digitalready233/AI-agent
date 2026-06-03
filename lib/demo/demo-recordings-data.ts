import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoRecording } from "./types";

const JSON_FILE = "platform/demo-recordings.json";

async function readAll(): Promise<DemoRecording[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: DemoRecording[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function getDemoRecording(id: string): Promise<DemoRecording | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase.from("demo_recordings").select("*").eq("id", id).maybeSingle();
    return (data as DemoRecording) ?? null;
  }
  return (await readAll()).find((r) => r.id === id) ?? null;
}

export async function getActiveDemoRecording(
  demoSessionId: string
): Promise<DemoRecording | null> {
  const rows = await listDemoRecordings(demoSessionId);
  return (
    rows.find((r) => r.status === "recording" || r.status === "starting") ??
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ??
    null
  );
}

export async function listDemoRecordings(demoSessionId: string): Promise<DemoRecording[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_recordings")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: false });
    return (data as DemoRecording[]) ?? [];
  }
  return (await readAll())
    .filter((r) => r.demo_session_id === demoSessionId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function saveDemoRecording(recording: DemoRecording): Promise<DemoRecording> {
  const row = {
    ...recording,
    updated_at: new Date().toISOString(),
  };
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_recordings")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    return data as DemoRecording;
  }
  const all = await readAll();
  const idx = all.findIndex((r) => r.id === row.id);
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await writeAll(all);
  return row;
}
