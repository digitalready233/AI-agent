import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { platformDb } from "@/lib/platform/db";
import { DEFAULT_MEETING_TYPE_SEEDS } from "./defaults";
import type { MeetingTypeRecord } from "./types";

const JSON_FILE = "platform/meeting-types.json";

async function loadAllJson(): Promise<MeetingTypeRecord[]> {
  return readJsonFile<MeetingTypeRecord[]>(JSON_FILE, []);
}

async function loadJson(orgId: string): Promise<MeetingTypeRecord[]> {
  return (await loadAllJson()).filter((m) => m.organization_id === orgId);
}

async function saveJsonOrg(orgId: string, orgRows: MeetingTypeRecord[]): Promise<void> {
  const all = await loadAllJson();
  const rest = all.filter((m) => m.organization_id !== orgId);
  await writeJsonFile(JSON_FILE, [...rest, ...orgRows]);
}

export async function seedDefaultMeetingTypes(
  organizationId: string
): Promise<MeetingTypeRecord[]> {
  const now = new Date().toISOString();
  const rows: MeetingTypeRecord[] = DEFAULT_MEETING_TYPE_SEEDS.map((seed) => ({
    ...seed,
    id: crypto.randomUUID(),
    organization_id: organizationId,
    created_at: now,
    updated_at: now,
  }));

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { count } = await supabase
      .from("meeting_types")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    if (count && count > 0) {
      const { data, error } = await supabase
        .from("meeting_types")
        .select("*")
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MeetingTypeRecord[];
    }
    const { data, error } = await supabase.from("meeting_types").insert(rows).select();
    if (error) throw error;
    return (data ?? []) as MeetingTypeRecord[];
  }

  await saveJsonOrg(organizationId, rows);
  return rows;
}

export async function listMeetingTypes(
  organizationId: string,
  opts?: { includeInactive?: boolean }
): Promise<MeetingTypeRecord[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase
      .from("meeting_types")
      .select("*")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });
    if (!opts?.includeInactive) {
      q = q.eq("status", "active");
    }
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as MeetingTypeRecord[];
    if (rows.length === 0) return seedDefaultMeetingTypes(organizationId);
    return rows;
  }

  const rows = await loadJson(organizationId);
  if (rows.length === 0) return seedDefaultMeetingTypes(organizationId);
  if (opts?.includeInactive) return rows;
  return rows.filter((m) => m.status === "active");
}

export async function getMeetingTypeById(
  organizationId: string,
  id: string
): Promise<MeetingTypeRecord | null> {
  const all = await listMeetingTypes(organizationId, { includeInactive: true });
  return all.find((m) => m.id === id) ?? null;
}

export async function getMeetingTypeBySlug(
  organizationId: string,
  slug: string
): Promise<MeetingTypeRecord | null> {
  const all = await listMeetingTypes(organizationId, { includeInactive: true });
  return all.find((m) => m.slug === slug) ?? null;
}

export async function saveMeetingType(
  row: MeetingTypeRecord
): Promise<MeetingTypeRecord> {
  const payload = { ...row, updated_at: new Date().toISOString() };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("meeting_types")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as MeetingTypeRecord;
  }

  const all = await loadJson(row.organization_id);
  const idx = all.findIndex((m) => m.id === row.id);
  if (idx >= 0) all[idx] = payload;
  else all.push(payload);
  await saveJsonOrg(row.organization_id, all);
  return payload;
}

export async function deleteMeetingType(
  organizationId: string,
  id: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase
      .from("meeting_types")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return;
  }

  const all = await loadAllJson();
  await writeJsonFile(
    JSON_FILE,
    all.filter((m) => !(m.id === id && m.organization_id === organizationId))
  );
}
