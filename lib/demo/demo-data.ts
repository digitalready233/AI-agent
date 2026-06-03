import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type {
  DemoAsset,
  DemoMessage,
  DemoOutcome,
  DemoParticipant,
  DemoSession,
  DemoTranscriptSegment,
} from "./types";

const JSON_FILES = {
  sessions: "platform/demo-sessions.json",
  participants: "platform/demo-participants.json",
  messages: "platform/demo-messages.json",
  transcripts: "platform/demo-transcripts.json",
  assets: "platform/demo-assets.json",
  outcomes: "platform/demo-outcomes.json",
} as const;

async function readSessions(): Promise<DemoSession[]> {
  return readJsonFile(JSON_FILES.sessions, []);
}
async function writeSessions(rows: DemoSession[]) {
  await writeJsonFile(JSON_FILES.sessions, rows);
}

export async function listDemoSessions(
  organizationId: string,
  filters?: {
    status?: string;
    agentId?: string;
    leadCategory?: string;
    handoffRequired?: boolean;
    bookingRecommended?: boolean;
    from?: string;
    to?: string;
  }
): Promise<DemoSession[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase
      .from("demo_sessions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.agentId) q = q.eq("agent_id", filters.agentId);
    if (filters?.leadCategory) q = q.eq("lead_category", filters.leadCategory);
    if (filters?.handoffRequired === true) q = q.eq("handoff_required", true);
    if (filters?.bookingRecommended === true) {
      q = q.eq("booking_recommended", true);
    }
    if (filters?.from) q = q.gte("created_at", filters.from);
    if (filters?.to) q = q.lte("created_at", filters.to);
    const { data } = await q;
    return (data as DemoSession[]) ?? [];
  }
  let rows = (await readSessions()).filter((s) => s.organization_id === organizationId);
  if (filters?.status) rows = rows.filter((s) => s.status === filters.status);
  if (filters?.agentId) rows = rows.filter((s) => s.agent_id === filters.agentId);
  if (filters?.leadCategory) {
    rows = rows.filter((s) => s.lead_category === filters.leadCategory);
  }
  if (filters?.handoffRequired === true) {
    rows = rows.filter((s) => s.handoff_required);
  }
  if (filters?.bookingRecommended === true) {
    rows = rows.filter((s) => s.booking_recommended);
  }
  if (filters?.from) {
    rows = rows.filter((s) => s.created_at >= filters.from!);
  }
  if (filters?.to) {
    rows = rows.filter((s) => s.created_at <= filters.to!);
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDemoSession(id: string): Promise<DemoSession | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as DemoSession) ?? null;
  }
  return (await readSessions()).find((s) => s.id === id) ?? null;
}

export async function saveDemoSession(session: DemoSession): Promise<DemoSession> {
  const row = { ...session, updated_at: new Date().toISOString() };
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_sessions")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    return data as DemoSession;
  }
  const all = await readSessions();
  const idx = all.findIndex((s) => s.id === row.id);
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await writeSessions(all);
  return row;
}

export async function listDemoMessages(demoSessionId: string): Promise<DemoMessage[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_messages")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: true });
    return (data as DemoMessage[]) ?? [];
  }
  const all = await readJsonFile<DemoMessage[]>(JSON_FILES.messages, []);
  return all
    .filter((m) => m.demo_session_id === demoSessionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function patchDemoMessageMetadata(
  messageId: string,
  metadataPatch: Record<string, unknown>
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data: row } = await supabase
      .from("demo_messages")
      .select("metadata")
      .eq("id", messageId)
      .maybeSingle();
    const merged = {
      ...((row?.metadata as Record<string, unknown>) ?? {}),
      ...metadataPatch,
    };
    await supabase.from("demo_messages").update({ metadata: merged }).eq("id", messageId);
    return;
  }
  const all = await readJsonFile<DemoMessage[]>(JSON_FILES.messages, []);
  const idx = all.findIndex((m) => m.id === messageId);
  if (idx >= 0) {
    all[idx] = {
      ...all[idx],
      metadata: { ...(all[idx].metadata ?? {}), ...metadataPatch },
    };
    await writeJsonFile(JSON_FILES.messages, all);
  }
}

export async function saveDemoMessage(message: DemoMessage): Promise<DemoMessage> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_messages")
      .upsert(message)
      .select()
      .single();
    if (error) throw error;
    return data as DemoMessage;
  }
  const all = await readJsonFile<DemoMessage[]>(JSON_FILES.messages, []);
  all.push(message);
  await writeJsonFile(JSON_FILES.messages, all);
  return message;
}

export async function appendDemoTranscript(
  segment: DemoTranscriptSegment
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    await supabase.from("demo_transcripts").insert(segment);
    return;
  }
  const all = await readJsonFile<DemoTranscriptSegment[]>(JSON_FILES.transcripts, []);
  all.push(segment);
  await writeJsonFile(JSON_FILES.transcripts, all);
}

export async function listDemoTranscripts(
  demoSessionId: string
): Promise<DemoTranscriptSegment[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_transcripts")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("sequence_num", { ascending: true });
    return (data as DemoTranscriptSegment[]) ?? [];
  }
  return (await readJsonFile<DemoTranscriptSegment[]>(JSON_FILES.transcripts, []))
    .filter((t) => t.demo_session_id === demoSessionId)
    .sort((a, b) => a.sequence_num - b.sequence_num);
}

export async function listDemoAssets(
  organizationId: string,
  agentId?: string,
  options?: { includeAllStatuses?: boolean; demoPathId?: string }
): Promise<DemoAsset[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase
      .from("demo_assets")
      .select("*")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });
    if (agentId) {
      q = q.or(`attached_agent_id.is.null,attached_agent_id.eq.${agentId}`);
    }
    if (options?.demoPathId) {
      q = q.eq("demo_path_id", options.demoPathId);
    }
    const { data } = await q;
    return (data as DemoAsset[]) ?? [];
  }
  let rows = (await readJsonFile<DemoAsset[]>(JSON_FILES.assets, [])).filter(
    (a) => a.organization_id === organizationId
  );
  if (agentId) {
    rows = rows.filter(
      (a) => !a.attached_agent_id || a.attached_agent_id === agentId
    );
  }
  if (options?.demoPathId) {
    rows = rows.filter((a) => a.demo_path_id === options.demoPathId);
  }
  if (!options?.includeAllStatuses) {
    rows = rows.filter((a) => a.status === "active");
  }
  return rows.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getDemoAsset(id: string): Promise<DemoAsset | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as DemoAsset) ?? null;
  }
  return (await readJsonFile<DemoAsset[]>(JSON_FILES.assets, [])).find(
    (a) => a.id === id
  ) ?? null;
}

export async function saveDemoAsset(asset: DemoAsset): Promise<DemoAsset> {
  const row = { ...asset, updated_at: new Date().toISOString() };
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_assets")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    return data as DemoAsset;
  }
  const all = await readJsonFile<DemoAsset[]>(JSON_FILES.assets, []);
  const idx = all.findIndex((a) => a.id === row.id);
  if (idx >= 0) all[idx] = row;
  else all.push(row);
  await writeJsonFile(JSON_FILES.assets, all);
  return row;
}

export async function deleteDemoAsset(id: string, organizationId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    await supabase
      .from("demo_assets")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    return;
  }
  const all = await readJsonFile<DemoAsset[]>(JSON_FILES.assets, []);
  await writeJsonFile(
    JSON_FILES.assets,
    all.filter((a) => a.id !== id)
  );
}

export async function listDemoParticipants(
  demoSessionId: string
): Promise<DemoParticipant[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_participants")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("joined_at", { ascending: true });
    return (data as DemoParticipant[]) ?? [];
  }
  return (await readJsonFile<DemoParticipant[]>(JSON_FILES.participants, []))
    .filter((p) => p.demo_session_id === demoSessionId)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
}

export async function saveDemoParticipant(
  participant: DemoParticipant
): Promise<DemoParticipant> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_participants")
      .upsert(participant)
      .select()
      .single();
    if (error) throw error;
    return data as DemoParticipant;
  }
  const all = await readJsonFile<DemoParticipant[]>(JSON_FILES.participants, []);
  const idx = all.findIndex((p) => p.id === participant.id);
  if (idx >= 0) all[idx] = participant;
  else all.push(participant);
  await writeJsonFile(JSON_FILES.participants, all);
  return participant;
}

export async function listDemoOutcomes(demoSessionId: string): Promise<DemoOutcome[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("demo_outcomes")
      .select("*")
      .eq("demo_session_id", demoSessionId)
      .order("created_at", { ascending: false });
    return (data as DemoOutcome[]) ?? [];
  }
  return (await readJsonFile<DemoOutcome[]>(JSON_FILES.outcomes, []))
    .filter((o) => o.demo_session_id === demoSessionId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function saveDemoOutcome(outcome: DemoOutcome): Promise<DemoOutcome> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("demo_outcomes")
      .insert(outcome)
      .select()
      .single();
    if (error) throw error;
    return data as DemoOutcome;
  }
  const all = await readJsonFile<DemoOutcome[]>(JSON_FILES.outcomes, []);
  all.push(outcome);
  await writeJsonFile(JSON_FILES.outcomes, all);
  return outcome;
}

export async function rebuildSessionTranscript(demoSessionId: string): Promise<string> {
  const segments = await listDemoTranscripts(demoSessionId);
  if (segments.length) {
    return segments.map((s) => `${s.speaker}: ${s.content}`).join("\n");
  }
  const messages = await listDemoMessages(demoSessionId);
  return messages
    .map((m) => `${m.sender_type}: ${m.content}`)
    .join("\n");
}
