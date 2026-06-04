/**
 * One-time bootstrap for the platform operator (super_admin).
 *
 * Usage (do not commit passwords):
 *   npx tsx scripts/bootstrap-platform-admin.ts
 *
 * Env (from .env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PLATFORM_BOOTSTRAP_EMAIL
 *   PLATFORM_BOOTSTRAP_PASSWORD
 *   PLATFORM_BOOTSTRAP_FULL_NAME  (optional)
 *   PLATFORM_BOOTSTRAP_ORG_NAME   (optional)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_BILLING_ACTIVE } from "../lib/billing/exempt";
import { defaultOrganizationSettings } from "../lib/platform/settings-defaults";

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const email = process.env.PLATFORM_BOOTSTRAP_EMAIL?.trim();
  const password = process.env.PLATFORM_BOOTSTRAP_PASSWORD;
  const fullName =
    process.env.PLATFORM_BOOTSTRAP_FULL_NAME?.trim() || "Digital Ready Admin";
  const orgName =
    process.env.PLATFORM_BOOTSTRAP_ORG_NAME?.trim() || "Digital Ready Ltd";

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!email || !password) {
    console.error(
      "Set PLATFORM_BOOTSTRAP_EMAIL and PLATFORM_BOOTSTRAP_PASSWORD (shell env, not in git)."
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string;

  const { data: listData } = await admin.auth.admin.listUsers();
  const existing = listData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    userId = existing.id;
    console.log(`User exists (${email}), updating metadata…`);
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        organization_name: orgName,
        role: "super_admin",
      },
    });
    if (updateErr) {
      console.error("updateUserById:", updateErr.message);
      process.exit(1);
    }
  } else {
    console.log(`Creating super_admin user ${email}…`);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        organization_name: orgName,
        role: "super_admin",
      },
    });
    if (error || !data.user) {
      console.error("createUser:", error?.message ?? "no user returned");
      process.exit(1);
    }
    userId = data.user.id;
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, organization_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr) {
    console.error("profiles lookup:", profileErr.message);
    process.exit(1);
  }

  if (!profile) {
    console.error(
      "No profile row — run supabase/migrations/001_platform_schema.sql and ensure handle_new_user trigger exists."
    );
    process.exit(1);
  }

  if (profile.role !== "super_admin") {
    const { error: roleErr } = await admin
      .from("profiles")
      .update({ role: "super_admin", full_name: fullName })
      .eq("user_id", userId);
    if (roleErr) {
      console.error("profiles role update:", roleErr.message);
      process.exit(1);
    }
    console.log("Updated profile role → super_admin");
  }

  const orgId = profile.organization_id as string;

  await admin
    .from("organizations")
    .update({ name: orgName, email })
    .eq("id", orgId);

  const { data: settingsRow } = await admin
    .from("organization_settings")
    .select("organization_id")
    .eq("organization_id", orgId)
    .maybeSingle();

  const billingPatch = { billing: PLATFORM_BILLING_ACTIVE };

  if (settingsRow) {
    const { error: billErr } = await admin
      .from("organization_settings")
      .update(billingPatch)
      .eq("organization_id", orgId);
    if (billErr) {
      console.error("billing update:", billErr.message);
      process.exit(1);
    }
  } else {
    const defaults = defaultOrganizationSettings(orgId);
    defaults.billing = { ...PLATFORM_BILLING_ACTIVE };
    const { error: insErr } = await admin.from("organization_settings").insert({
      organization_id: orgId,
      workspace: defaults.workspace,
      agent_defaults: defaults.agent_defaults,
      sales_pipeline: defaults.sales_pipeline,
      lead_scoring: defaults.lead_scoring,
      human_handoff: defaults.human_handoff,
      notifications: defaults.notifications,
      security: defaults.security,
      billing: defaults.billing,
      data_privacy: defaults.data_privacy,
      api_settings: defaults.api_settings,
      team_settings: defaults.team_settings,
    });
    if (insErr) {
      console.error("organization_settings insert:", insErr.message);
      process.exit(1);
    }
  }

  console.log("\nPlatform super_admin ready.");
  console.log(`  Email:    ${email}`);
  console.log(`  Org:      ${orgName} (${orgId})`);
  console.log(`  Role:     super_admin`);
  console.log(`  Billing:  active (no trial gate)`);
  console.log("\nSign in at /auth/login — clients who register separately still get a 14-day trial when BILLING_ENFORCEMENT=true.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
