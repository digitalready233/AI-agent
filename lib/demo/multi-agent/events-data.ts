import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { DemoAgentRole, MultiAgentEvent } from "./types";

const JSON_FILE = "platform/multi-agent-events.json";

async function readAll(): Promise<MultiAgentEvent[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: MultiAgentEvent[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function saveMultiAgentEvent(
  row: Omit<MultiAgentEvent, "id" | "created_at"> & {
    id?: string;
    created_at?: string;
  }
): Promise<MultiAgentEvent> {
  const record: MultiAgentEvent = {
    id: row.id ?? crypto.randomUUID(),
    organization_id: row.organization_id,
    demo_session_id: row.demo_session_id,
    agent_role: row.agent_role,
    agent_id: row.agent_id ?? null,
    event_type: row.event_type,
    input: row.input ?? {},
    output: row.output ?? {},
    metadata: row.metadata ?? {},
    created_at: row.created_at ?? new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("multi_agent_events")
      .insert(record)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as MultiAgentEvent;
  }

  const all = await readAll();
  all.push(record);
  await writeAll(all);
  return record;
}

export async function listMultiAgentEvents(
  demoSessionId: string,
  opts?: { limit?: number }
): Promise<MultiAgentEvent[]> {
  const limit = opts?.limit ?? 200;
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("multi_agent_events")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as MultiAgentEvent[]) ?? [];
  }
  return (await readAll())
    .filter((e) => e.demo_session_id === demoSessionId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function recordSpecialistEvent(params: {
  organizationId: string;
  demoSessionId: string;
  agentRole: DemoAgentRole;
  agentId: string | null;
  eventType: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  saveReasoning?: boolean;
  reasoning?: string;
}): Promise<void> {
  const output = { ...(params.output ?? {}) };
  if (params.saveReasoning !== false && params.reasoning) {
    output.reasoning = params.reasoning;
  }
  await saveMultiAgentEvent({
    organization_id: params.organizationId,
    demo_session_id: params.demoSessionId,
    agent_role: params.agentRole,
    agent_id: params.agentId,
    event_type: params.eventType,
    input: params.input ?? {},
    output,
    metadata: {},
  });
}
