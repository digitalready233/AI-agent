/**
 * Verifies demo workflow for real-estate social media scenario.
 * Run: npx tsx scripts/test-demo-real-estate-messages.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* optional */
}

type Check = { label: string; ok: boolean; detail: string };

function check(label: string, ok: boolean, detail: string): Check {
  const mark = ok ? "✓" : "✗";
  console.log(`  ${mark} ${label}: ${detail}`);
  return { label, ok, detail };
}

async function resolveAgentAndOrg(): Promise<{ agentId: string; orgId: string }> {
  const { isSupabaseConfigured } = await import("../lib/supabase/env");
  const { hasServiceRoleKey } = await import("../lib/platform/db");
  if (isSupabaseConfigured() && hasServiceRoleKey()) {
    const { createAdminClient } = await import("../lib/supabase/admin");
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("agents")
      .select("id, organization_id")
      .eq("enabled", true)
      .limit(1)
      .single();
    if (data?.id && data.organization_id) {
      return { agentId: data.id, orgId: data.organization_id };
    }
  }
  const { listAgents } = await import("../lib/platform/data");
  const agents = await listAgents("org-drg-001");
  const agent = agents.find((a) => a.enabled) ?? agents[0];
  if (!agent) throw new Error("No demo agent found");
  return { agentId: agent.id, orgId: agent.organization_id };
}

async function main() {
  console.log("\n=== Demo: Real estate social media messages ===\n");

  const { isLlmConfigured } = await import("../lib/platform/llm");
  if (!isLlmConfigured()) {
    console.error("LLM not configured (OPENAI_API_KEY or GROQ_API_KEY required).");
    process.exit(1);
  }

  const { agentId, orgId } = await resolveAgentAndOrg();
  const { withPlatformAdmin } = await import("../lib/platform/db");
  const { saveDemoSession, getDemoSession } = await import("../lib/demo/demo-data");
  const { runDemoWorkflow } = await import("../lib/demo/run-demo-workflow");
  const { listDemoPaths } = await import("../lib/demo/demo-paths-data");

  const paths = await withPlatformAdmin(() => listDemoPaths(orgId, agentId));
  const socialPath = paths.find((p) =>
    /social media management/i.test(p.title)
  );
  console.log(`Agent: ${agentId}`);
  console.log(
    `Paths: ${paths.map((p) => p.title).join(" | ") || "(none)"}\n`
  );

  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();

  await withPlatformAdmin(async () => {
    await saveDemoSession({
      id: sessionId,
      organization_id: orgId,
      agent_id: agentId,
      lead_id: null,
      conversation_id: null,
      title: "Real estate demo test",
      demo_type: "on_demand",
      status: "in_progress",
      current_demo_stage: "welcome",
      started_at: now,
      ended_at: null,
      duration_seconds: null,
      summary: null,
      transcript: null,
      detected_intent: null,
      lead_score: null,
      lead_category: null,
      handoff_required: false,
      booking_recommended: false,
      recommended_next_action: null,
      recording_url: null,
      metadata: { test: "real_estate_messages" },
      created_at: now,
      updated_at: now,
    });
  });

  const msg1 =
    "I need social media management for my real estate company.";
  console.log(`\n--- Turn 1: "${msg1}" ---\n`);

  const turn1Checks: Check[] = [];
  let wf1: Awaited<ReturnType<typeof runDemoWorkflow>>;

  await withPlatformAdmin(async () => {
    wf1 = await runDemoWorkflow({
      organizationId: orgId,
      demoSessionId: sessionId,
      agentId,
      customerMessage: msg1,
      channel: "demo_call",
      inputType: "text",
      participantRole: "prospect",
    });
  });

  const s1 = await withPlatformAdmin(() => getDemoSession(sessionId));
  if (!s1) throw new Error("Session missing after turn 1");

  const pathTitle1 = s1.demo_path_title ?? "";
  turn1Checks.push(
    check(
      "Demo path → Social Media Management Demo",
      /social media management/i.test(pathTitle1) ||
        (socialPath != null && s1.demo_path_id === socialPath.id),
      `path="${pathTitle1}" id=${s1.demo_path_id ?? "—"}`
    )
  );

  const stage1 = s1.current_demo_stage ?? "";
  turn1Checks.push(
    check(
      "Stage → Need Discovery (or path selection)",
      ["need_discovery", "demo_path_selection", "presentation"].includes(stage1),
      `stage=${stage1}`
    )
  );

  const interest1 =
    s1.metadata?.service_interest ??
    (typeof s1.metadata?.lead_service_interest === "string"
      ? s1.metadata.lead_service_interest
      : null);
  turn1Checks.push(
    check(
      "Lead interest updates",
      Boolean(
        interest1 ||
          /social|real estate|media/i.test(wf1!.aiResponse) ||
          /social|real estate|media/i.test(s1.detected_intent ?? "")
      ),
      `interest=${interest1 ?? s1.detected_intent ?? "—"}`
    )
  );

  const qp = s1.qualification_progress ?? {
    need: false,
    budget: false,
    authority: false,
    timeline: false,
  };
  turn1Checks.push(
    check(
      "Qualification progress starts",
      qp.need || qp.budget || qp.authority || qp.timeline || (s1.lead_score ?? 0) > 0,
      `need=${qp.need} budget=${qp.budget} authority=${qp.authority} timeline=${qp.timeline} score=${s1.lead_score ?? 0}`
    )
  );

  turn1Checks.push(
    check(
      "AI asks about goal",
      /goal|objective|outcome|grow|brand|leads|audience|what.*(want|hope|looking)/i.test(
        wf1!.aiResponse
      ),
      `reply snippet: ${wf1!.aiResponse.slice(0, 120)}…`
    )
  );

  turn1Checks.push(
    check(
      "Center asset available",
      Boolean(wf1!.nextDemoAsset?.title || s1.current_demo_asset_id),
      `asset=${wf1!.nextDemoAsset?.title ?? s1.current_demo_asset_id ?? "—"}`
    )
  );

  const msg2 =
    "My budget is GHS 5,000 and I want to start this month.";
  console.log(`\n--- Turn 2: "${msg2}" ---\n`);

  const turn2Checks: Check[] = [];
  let wf2: Awaited<ReturnType<typeof runDemoWorkflow>>;

  await withPlatformAdmin(async () => {
    wf2 = await runDemoWorkflow({
      organizationId: orgId,
      demoSessionId: sessionId,
      agentId,
      customerMessage: msg2,
      channel: "demo_call",
      inputType: "text",
      participantRole: "prospect",
    });
  });

  const s2 = await withPlatformAdmin(() => getDemoSession(sessionId));
  if (!s2) throw new Error("Session missing after turn 2");

  const score2 = s2.lead_score ?? 0;
  const score1 = s1.lead_score ?? 0;
  turn2Checks.push(
    check(
      "Lead score increases",
      score2 > score1 || score2 >= 5,
      `score ${score1} → ${score2}`
    )
  );

  const cat2 = (s2.lead_category ?? "").toLowerCase();
  turn2Checks.push(
    check(
      "Lead category → Hot (or warm+)",
      cat2.includes("hot") || cat2 === "hot lead" || score2 >= 8,
      `category=${s2.lead_category ?? "—"}`
    )
  );

  turn2Checks.push(
    check(
      "Booking CTA appears",
      Boolean(s2.booking_recommended || wf2!.bookingRecommended),
      `booking_recommended=${s2.booking_recommended}`
    )
  );

  turn2Checks.push(
    check(
      "Human handoff alert",
      Boolean(
        s2.handoff_required ||
          wf2!.handoffRequired ||
          s2.status === "human_taken_over"
      ),
      `handoff_required=${s2.handoff_required} status=${s2.status}`
    )
  );

  turn2Checks.push(
    check(
      "Recommended next action updates",
      Boolean(s2.recommended_next_action?.trim()),
      s2.recommended_next_action?.slice(0, 100) ?? "—"
    )
  );

  const all = [...turn1Checks, ...turn2Checks];
  const failed = all.filter((c) => !c.ok);
  console.log("\n=== Summary ===\n");
  console.log(`Passed: ${all.length - failed.length}/${all.length}`);
  if (failed.length) {
    console.log("\nFailed checks:");
    for (const f of failed) console.log(`  - ${f.label}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nAll checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
