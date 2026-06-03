import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoPath } from "./types";

const JSON_FILE = "platform/demo-paths.json";

async function readPaths(): Promise<DemoPath[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writePaths(rows: DemoPath[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function listDemoPaths(
  organizationId: string,
  agentId?: string | null,
  status: "active" | "draft" | "archived" | "all" = "active"
): Promise<DemoPath[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase
      .from("demo_paths")
      .select("*")
      .eq("organization_id", organizationId)
      .order("title", { ascending: true });
    if (agentId) q = q.eq("agent_id", agentId);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    return (data as DemoPath[]) ?? [];
  }
  let rows = (await readPaths()).filter((p) => p.organization_id === organizationId);
  if (agentId) rows = rows.filter((p) => p.agent_id === agentId);
  if (status !== "all") rows = rows.filter((p) => p.status === status);
  return rows;
}

export async function getDemoPath(id: string): Promise<DemoPath | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_paths")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as DemoPath) ?? null;
  }
  return (await readPaths()).find((p) => p.id === id) ?? null;
}

export async function saveDemoPath(path: DemoPath): Promise<DemoPath> {
  const row = { ...path, updated_at: new Date().toISOString() };
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase.from("demo_paths").upsert(row).select().single();
    if (error) throw error;
    return data as DemoPath;
  }
  const all = await readPaths();
  const idx = all.findIndex((p) => p.id === row.id);
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await writePaths(all);
  return row;
}
