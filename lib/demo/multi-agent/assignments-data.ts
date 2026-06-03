import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoAgentAssignment, DemoAgentRole } from "./types";

const JSON_FILE = "platform/demo-agent-assignments.json";

async function readAll(): Promise<DemoAgentAssignment[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: DemoAgentAssignment[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function saveDemoAgentAssignment(
  row: Omit<DemoAgentAssignment, "id" | "created_at" | "updated_at"> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
  }
): Promise<DemoAgentAssignment> {
  const now = new Date().toISOString();
  const record: DemoAgentAssignment = {
    id: row.id ?? crypto.randomUUID(),
    organization_id: row.organization_id,
    demo_session_id: row.demo_session_id,
    agent_id: row.agent_id,
    agent_role: row.agent_role,
    status: row.status ?? "active",
    created_at: row.created_at ?? now,
    updated_at: row.updated_at ?? now,
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_agent_assignments")
      .insert(record)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DemoAgentAssignment;
  }

  const all = await readAll();
  all.push(record);
  await writeAll(all);
  return record;
}

export async function listDemoAgentAssignments(
  demoSessionId: string
): Promise<DemoAgentAssignment[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_agent_assignments")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: true });
    return (data as DemoAgentAssignment[]) ?? [];
  }
  return (await readAll()).filter((a) => a.demo_session_id === demoSessionId);
}

export async function syncDemoAgentAssignments(params: {
  organizationId: string;
  demoSessionId: string;
  team: Partial<Record<DemoAgentRole, string | null>>;
}): Promise<void> {
  const existing = await listDemoAgentAssignments(params.demoSessionId);
  const existingRoles = new Set(existing.map((a) => a.agent_role));

  for (const [role, agentId] of Object.entries(params.team)) {
    if (!agentId) continue;
    if (existingRoles.has(role)) continue;
    await saveDemoAgentAssignment({
      organization_id: params.organizationId,
      demo_session_id: params.demoSessionId,
      agent_id: agentId,
      agent_role: role,
      status: "active",
    });
  }
}
