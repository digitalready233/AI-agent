import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { platformDb } from "@/lib/platform/db";
import type { StaffAvailabilityRecord } from "./types";

const JSON_FILE = "platform/staff-availability.json";

async function loadAllJson(): Promise<StaffAvailabilityRecord[]> {
  return readJsonFile<StaffAvailabilityRecord[]>(JSON_FILE, []);
}

async function loadJson(orgId: string): Promise<StaffAvailabilityRecord[]> {
  return (await loadAllJson()).filter((r) => r.organization_id === orgId);
}

async function saveJsonOrg(orgId: string, orgRows: StaffAvailabilityRecord[]): Promise<void> {
  const all = await loadAllJson();
  const rest = all.filter((r) => r.organization_id !== orgId);
  await writeJsonFile(JSON_FILE, [...rest, ...orgRows]);
}

export async function listStaffAvailability(
  organizationId: string,
  staffId?: string
): Promise<StaffAvailabilityRecord[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase
      .from("staff_availability")
      .select("*")
      .eq("organization_id", organizationId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    if (staffId) q = q.eq("staff_id", staffId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as StaffAvailabilityRecord[];
  }

  let rows = await loadJson(organizationId);
  if (staffId) rows = rows.filter((r) => r.staff_id === staffId);
  return rows;
}

export async function saveStaffAvailability(
  row: StaffAvailabilityRecord
): Promise<StaffAvailabilityRecord> {
  const payload = { ...row, updated_at: new Date().toISOString() };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("staff_availability")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as StaffAvailabilityRecord;
  }

  const all = await loadJson(row.organization_id);
  const idx = all.findIndex((r) => r.id === row.id);
  if (idx >= 0) all[idx] = payload;
  else all.push(payload);
  await saveJsonOrg(row.organization_id, all);
  return payload;
}

export async function deleteStaffAvailability(
  organizationId: string,
  id: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase
      .from("staff_availability")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return;
  }

  const all = await loadAllJson();
  await writeJsonFile(
    JSON_FILE,
    all.filter((r) => !(r.id === id && r.organization_id === organizationId))
  );
}
