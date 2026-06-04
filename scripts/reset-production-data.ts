/**
 * Reset operational/analytics data for a fresh production start.
 * Keeps: admin auth user, admin org + profile, organization_settings, integration config.
 * Clears: leads, conversations, agents, KB, campaigns, demos, calls, etc.
 * Removes: other test users and their organizations.
 *
 * Usage:
 *   npx tsx scripts/reset-production-data.ts --dry-run
 *   CONFIRM_RESET=true npx tsx scripts/reset-production-data.ts
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PLATFORM_PRESERVE_EMAIL (default: digitalready233@gmail.com)
 */

import { readFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

/** Tables cleared in FK-safe order (children before parents). */
const OPERATIONAL_TABLES = [
  "messages",
  "demo_messages",
  "demo_transcripts",
  "demo_participants",
  "demo_outcomes",
  "demo_events",
  "demo_room_events",
  "demo_sessions",
  "demo_paths",
  "demo_assets",
  "call_transcripts",
  "call_events",
  "calls",
  "outbound_call_queue",
  "campaign_logs",
  "campaign_steps",
  "campaign_leads",
  "campaigns",
  "message_templates",
  "bookings",
  "conversations",
  "leads",
  "agent_knowledge_bases",
  "knowledge_entries",
  "knowledge_bases",
  "agents",
  "agent_tasks",
  "notifications",
] as const;

const SETTINGS_TABLES = [
  "organization_settings",
  "organization_secrets",
  "integrations",
  "whatsapp_settings",
  "voice_integrations",
  "calendar_settings",
  "meeting_types",
  "staff_availability",
] as const;

async function countRows(
  supabase: SupabaseClient,
  table: string
): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

async function deleteAllRows(supabase: SupabaseClient, table: string): Promise<number | null> {
  const before = await countRows(supabase, table);
  if (before === null) return null;
  if (before === 0) return 0;

  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    const fallback = await supabase
      .from(table)
      .delete()
      .neq("organization_id", "00000000-0000-0000-0000-000000000000");
    if (fallback.error) {
      console.warn(`  ⚠ ${table}: ${error.message}`);
      return null;
    }
  }
  return before;
}

function clearLocalDemoJson() {
  const dir = resolve(process.cwd(), "data/platform");
  if (!existsSync(dir)) return 0;
  let removed = 0;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    if (file === "organization.json" || file === "org.json") continue;
    unlinkSync(join(dir, file));
    removed++;
  }
  return removed;
}

async function main() {
  loadEnvLocal();

  const dryRun = process.argv.includes("--dry-run");
  const confirmed =
    process.env.CONFIRM_RESET === "true" || process.argv.includes("--confirm");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const preserveEmail = (
    process.env.PLATFORM_PRESERVE_EMAIL ?? "digitalready233@gmail.com"
  )
    .trim()
    .toLowerCase();

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userList, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error("listUsers:", listErr.message);
    process.exit(1);
  }

  const preserveUser = userList.users.find(
    (u) => u.email?.toLowerCase() === preserveEmail
  );
  if (!preserveUser) {
    console.error(`Preserve user not found: ${preserveEmail}`);
    console.error("Run npm run bootstrap:admin first.");
    process.exit(1);
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("organization_id, role, full_name")
    .eq("user_id", preserveUser.id)
    .single();

  if (profileErr || !profile) {
    console.error("Admin profile missing:", profileErr?.message);
    process.exit(1);
  }

  const preserveOrgId = profile.organization_id as string;
  const otherUsers = userList.users.filter(
    (u) => u.email?.toLowerCase() !== preserveEmail
  );
  const { data: allOrgs } = await admin.from("organizations").select("id, name, email");
  const otherOrgs = (allOrgs ?? []).filter((o) => o.id !== preserveOrgId);

  console.log("\nProduction data reset");
  console.log(`  Preserve admin: ${preserveEmail} (${preserveUser.id})`);
  console.log(`  Preserve org:   ${preserveOrgId}`);
  console.log(`  Mode:           ${dryRun ? "DRY RUN" : confirmed ? "LIVE" : "preview only"}\n`);

  console.log("Operational tables (will be cleared):");
  for (const table of OPERATIONAL_TABLES) {
    const n = await countRows(admin, table);
    console.log(`  ${table}: ${n === null ? "(skipped — table missing)" : n}`);
  }

  console.log("\nSettings tables (kept):");
  for (const table of SETTINGS_TABLES) {
    const n = await countRows(admin, table);
    console.log(`  ${table}: ${n === null ? "(missing)" : n}`);
  }

  console.log(`\nOther auth users to remove: ${otherUsers.length}`);
  for (const u of otherUsers) {
    console.log(`  - ${u.email ?? u.id}`);
  }
  console.log(`Other organizations to remove: ${otherOrgs.length}`);
  for (const o of otherOrgs) {
    console.log(`  - ${o.name} (${o.id})`);
  }

  if (dryRun) {
    console.log("\nDry run complete. Re-run with CONFIRM_RESET=true to apply.");
    return;
  }

  if (!confirmed) {
    console.log("\nAdd CONFIRM_RESET=true or --confirm to apply this reset.");
    process.exit(1);
  }

  console.log("\nClearing operational data…");
  let cleared = 0;
  for (const table of OPERATIONAL_TABLES) {
    const n = await deleteAllRows(admin, table);
    if (n !== null && n > 0) {
      console.log(`  ✓ ${table}: ${n} rows`);
      cleared += n;
    }
  }

  console.log("\nRemoving other organizations…");
  if (otherOrgs.length > 0) {
    const { error: orgDelErr } = await admin
      .from("organizations")
      .delete()
      .neq("id", preserveOrgId);
    if (orgDelErr) console.warn("  org delete:", orgDelErr.message);
    else console.log(`  ✓ removed ${otherOrgs.length} organization(s)`);
  } else {
    console.log("  (none)");
  }

  console.log("\nRemoving other auth users…");
  for (const u of otherUsers) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.warn(`  ⚠ ${u.email}: ${error.message}`);
    else console.log(`  ✓ removed ${u.email ?? u.id}`);
  }

  const jsonRemoved = clearLocalDemoJson();
  if (jsonRemoved > 0) {
    console.log(`\n✓ Removed ${jsonRemoved} local demo JSON file(s) in data/platform/`);
  }

  const { data: settingsCheck } = await admin
    .from("organization_settings")
    .select("organization_id")
    .eq("organization_id", preserveOrgId)
    .maybeSingle();

  console.log("\nDone.");
  console.log(`  Rows cleared (approx): ${cleared}`);
  console.log(`  Admin preserved:       ${preserveEmail}`);
  console.log(`  Settings preserved:    ${settingsCheck ? "yes" : "missing — open dashboard once to seed"}`);
  console.log("\nNext steps:");
  console.log("  1. Create a new agent at /dashboard/agents/new");
  console.log("  2. Update NEXT_PUBLIC_PLATFORM_AGENT_ID in .env.local and on VPS");
  console.log("  3. Rebuild and restart: npm run build && pm2 restart digisales");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
