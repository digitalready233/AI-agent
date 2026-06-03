import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";

export type FollowUpTaskStatus = "pending" | "completed" | "cancelled";

export interface FollowUpTask {
  id: string;
  organization_id: string;
  demo_session_id: string | null;
  lead_id: string | null;
  title: string;
  description: string | null;
  status: FollowUpTaskStatus;
  due_at: string | null;
  assigned_to: string | null;
  follow_up_draft: string | null;
  priority: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const JSON_FILE = "platform/follow-up-tasks.json";

async function readAll(): Promise<FollowUpTask[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: FollowUpTask[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function saveFollowUpTask(task: FollowUpTask): Promise<FollowUpTask> {
  const row = { ...task, updated_at: new Date().toISOString() };
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("follow_up_tasks")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    return data as FollowUpTask;
  }
  const all = await readAll();
  const idx = all.findIndex((t) => t.id === row.id);
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await writeAll(all);
  return row;
}

export async function listFollowUpTasksForSession(
  demoSessionId: string
): Promise<FollowUpTask[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("follow_up_tasks")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: false });
    return (data as FollowUpTask[]) ?? [];
  }
  return (await readAll()).filter((t) => t.demo_session_id === demoSessionId);
}
