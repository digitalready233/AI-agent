import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { AvatarRoutingRule } from "./types";

const JSON_FILE = "platform/avatar-routing-rules.json";

async function readAll(): Promise<AvatarRoutingRule[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: AvatarRoutingRule[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function listAvatarRoutingRules(
  organizationId: string
): Promise<AvatarRoutingRule[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("avatar_routing_rules")
      .select("*")
      .eq("organization_id", organizationId)
      .order("priority", { ascending: true });
    return (data as AvatarRoutingRule[]) ?? [];
  }
  return (await readAll())
    .filter((r) => r.organization_id === organizationId)
    .sort((a, b) => a.priority - b.priority);
}

export async function getAvatarRoutingRule(
  organizationId: string,
  id: string
): Promise<AvatarRoutingRule | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("avatar_routing_rules")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();
    return (data as AvatarRoutingRule) ?? null;
  }
  return (
    (await readAll()).find(
      (r) => r.organization_id === organizationId && r.id === id
    ) ?? null
  );
}

export async function saveAvatarRoutingRule(
  row: Omit<AvatarRoutingRule, "created_at" | "updated_at"> & {
    created_at?: string;
    updated_at?: string;
  }
): Promise<AvatarRoutingRule> {
  const now = new Date().toISOString();
  const record: AvatarRoutingRule = {
    ...row,
    conditions: row.conditions ?? {},
    status: row.status ?? "active",
    created_at: row.created_at ?? now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("avatar_routing_rules")
      .upsert(record)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as AvatarRoutingRule;
  }

  const all = await readAll();
  const idx = all.findIndex((r) => r.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  await writeAll(all);
  return record;
}

export async function deleteAvatarRoutingRule(
  organizationId: string,
  id: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    await supabase
      .from("avatar_routing_rules")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", id);
    return;
  }
  const all = (await readAll()).filter(
    (r) => !(r.organization_id === organizationId && r.id === id)
  );
  await writeAll(all);
}
