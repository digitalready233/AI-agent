/**
 * Restore Digital Ready ReadyBot agent + master KB after accidental reset.
 * Recreates from lib/platform/playbooks + readybot-knowledge seed (same content as before).
 *
 *   npm run restore:readybot-agent
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *      NEXT_PUBLIC_PLATFORM_AGENT_ID (default agent uuid to restore)
 *      PLATFORM_PRESERVE_EMAIL (admin org lookup)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "../lib/supabase/admin";
import { readybotPlaybookForAgent } from "../lib/platform/playbooks/digital-ready-readybot";
import { buildReadybotKnowledgeEntries } from "../lib/platform/seed/readybot-knowledge";

const DEFAULT_AGENT_ID = "d35fd890-3a80-49e0-9c14-0d706984a81e";
const DEFAULT_KB_ID = "b35fd890-3a80-49e0-9c14-0d706984a81f";

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

async function main() {
  loadEnvLocal();

  const preserveEmail = (
    process.env.PLATFORM_PRESERVE_EMAIL ?? "digitalready233@gmail.com"
  )
    .trim()
    .toLowerCase();
  const agentId =
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() || DEFAULT_AGENT_ID;
  const kbId = process.env.RESTORE_KB_ID?.trim() || DEFAULT_KB_ID;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const { data: userList } = await admin.auth.admin.listUsers();
  const preserveUser = userList?.users.find(
    (u) => u.email?.toLowerCase() === preserveEmail
  );
  if (!preserveUser) {
    console.error(`Admin user not found: ${preserveEmail}`);
    process.exit(1);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("user_id", preserveUser.id)
    .single();

  if (!profile?.organization_id) {
    console.error("Admin profile / organization missing.");
    process.exit(1);
  }

  const orgId = profile.organization_id as string;
  const now = new Date().toISOString();
  const playbook = readybotPlaybookForAgent();

  const { data: existingAgent } = await admin
    .from("agents")
    .select("id, name")
    .eq("id", agentId)
    .maybeSingle();

  if (existingAgent) {
    console.log(`Agent already exists: ${existingAgent.name} (${agentId})`);
  } else {
    const agentRow = {
      id: agentId,
      organization_id: orgId,
      name: playbook.name,
      nickname: playbook.nickname,
      company_product_name: playbook.company_product_name,
      agent_type: playbook.agent_type,
      position: "Lead Qualification — BDR",
      language: "en",
      tone: playbook.tone,
      timezone: "Africa/Accra",
      voice: "alloy",
      voice_speed: 1,
      welcome_message: playbook.welcome_message,
      system_prompt: playbook.system_prompt,
      qualification_prompt: playbook.qualification_prompt,
      objection_prompt: playbook.objection_prompt,
      handoff_rules: playbook.handoff_rules,
      booking_rules: playbook.booking_rules,
      lead_scoring_rules: playbook.lead_scoring_rules,
      crm_update_rules: playbook.crm_update_rules,
      fallback_response: playbook.fallback_response,
      channels: ["website", "whatsapp", "live_agent", "embed"],
      status: "active",
      enabled: true,
      created_at: now,
      updated_at: now,
    };

    const { error: agentErr } = await admin.from("agents").insert(agentRow);
    if (agentErr) {
      console.error("Agent insert failed:", agentErr.message);
      process.exit(1);
    }
    console.log(`✓ Restored agent ReadyBot (${agentId})`);
  }

  const { data: existingKb } = await admin
    .from("knowledge_bases")
    .select("id, title")
    .eq("id", kbId)
    .maybeSingle();

  if (!existingKb) {
    const { error: kbErr } = await admin.from("knowledge_bases").insert({
      id: kbId,
      organization_id: orgId,
      title: "Digital Ready Ltd — Master KB",
      description: "Company profile, services, pricing, FAQs — ReadyBot",
      status: "active",
      created_at: now,
      updated_at: now,
    });
    if (kbErr) {
      console.error("KB insert failed:", kbErr.message);
      process.exit(1);
    }
    console.log(`✓ Created knowledge base (${kbId})`);
  } else {
    console.log(`Knowledge base exists: ${existingKb.title}`);
  }

  await admin.from("knowledge_entries").delete().eq("knowledge_base_id", kbId);

  const entries = buildReadybotKnowledgeEntries({
    knowledgeBaseId: kbId,
    organizationId: orgId,
    now,
  });

  const entryRows = entries.map((entry) => ({
    id: randomUUID(),
    knowledge_base_id: kbId,
    organization_id: orgId,
    title: entry.title,
    category: entry.category,
    content: entry.content,
    status: entry.status,
    created_at: now,
    updated_at: now,
  }));

  const { error: entriesErr } = await admin.from("knowledge_entries").insert(entryRows);
  if (entriesErr) {
    console.error("Knowledge entries insert failed:", entriesErr.message);
    process.exit(1);
  }
  console.log(`✓ Seeded ${entryRows.length} knowledge entries`);

  const { data: link } = await admin
    .from("agent_knowledge_bases")
    .select("id")
    .eq("agent_id", agentId)
    .eq("knowledge_base_id", kbId)
    .maybeSingle();

  if (!link) {
    const { error: linkErr } = await admin.from("agent_knowledge_bases").insert({
      id: randomUUID(),
      agent_id: agentId,
      knowledge_base_id: kbId,
      created_at: now,
    });
    if (linkErr) {
      console.error("KB link failed:", linkErr.message);
      process.exit(1);
    }
    console.log("✓ Linked agent to knowledge base");
  }

  console.log("\nReadyBot restored.");
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  KB ID:    ${kbId}`);
  console.log(`  Live:     /live-agent/${agentId}`);
  console.log("\nNEXT_PUBLIC_PLATFORM_AGENT_ID in .env.local already matches — rebuild VPS if needed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
