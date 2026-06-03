/**
 * Two-turn demo: real estate social media → budget/timeline.
 * Run: node scripts/test-demo-real-estate-messages.mjs
 * Requires: npm run dev (TEST_BASE_URL defaults to http://localhost:3000)
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    console.warn("Could not load .env.local");
  }
}

loadEnv();

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const AGENT_ID =
  process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID || process.env.PLATFORM_AGENT_ID;

const MSG1 =
  "I need social media management for my real estate company.";
const MSG2 = "My budget is GHS 5,000 and I want to start this month.";

const results = [];
function pass(step, detail) {
  results.push({ step, ok: true, detail });
  console.log(`✓ ${step}: ${detail}`);
}
function fail(step, detail) {
  results.push({ step, ok: false, detail });
  console.error(`✗ ${step}: ${detail}`);
}

async function request(method, path, body, timeoutMs = 120000) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

function isSocialPath(title) {
  return (title ?? "").toLowerCase().includes("social media");
}

function replyAsksGoal(text) {
  const t = (text ?? "").toLowerCase();
  return /goal|objective|outcome|looking to achieve|what are you hoping|main focus|help you with/.test(
    t
  ) || /what.*(want|need)|tell me more/.test(t);
}

function normStage(s) {
  return (s ?? "").toLowerCase().replace(/\s+/g, "_");
}

async function main() {
  if (!AGENT_ID) {
    fail("config", "NEXT_PUBLIC_PLATFORM_AGENT_ID missing");
    process.exit(1);
  }

  console.log(`\n=== Real estate demo (2 messages) @ ${BASE} ===\n`);

  try {
    const ping = await fetch(BASE, { signal: AbortSignal.timeout(8000) });
    if (!ping.ok && ping.status >= 500) {
      fail("dev server", `${BASE} returned ${ping.status}`);
      process.exit(1);
    }
  } catch {
    fail("dev server", `Cannot reach ${BASE} — run npm run dev`);
    process.exit(1);
  }

  const start = await request("POST", "/api/demo/on-demand/start", {
    agent_id: AGENT_ID,
    visitor_name: "Real Estate Test",
    visitor_email: "re-test@example.com",
  });
  if (start.status !== 200) {
    fail("start demo", JSON.stringify(start.data));
    process.exit(1);
  }
  const sessionId = start.data.session?.id;
  pass("start demo", sessionId);

  await request("POST", `/api/demo-room/${sessionId}/join`, {
    display_name: "Real Estate Test",
    email: "re-test@example.com",
  });

  // --- Turn 1 ---
  console.log(`\n--- Turn 1: "${MSG1}" ---\n`);
  const msg1 = await request("POST", `/api/demo-room/${sessionId}/message`, {
    message: MSG1,
    display_name: "Real Estate Test",
    email: "re-test@example.com",
  });
  if (msg1.status !== 200) {
    fail("send message 1", `${msg1.status} ${JSON.stringify(msg1.data)}`);
    process.exit(1);
  }

  const d1 = msg1.data;
  const reply1 = d1.reply ?? d1.aiResponse ?? "";
  const room1 = (await request("GET", `/api/demo-room/${sessionId}`)).data;
  const session1 = room1?.session ?? {};

  if (isSocialPath(d1.selected_demo_path_title ?? session1.demo_path_title)) {
    pass(
      "Demo path → Social Media Management Demo",
      d1.selected_demo_path_title ?? session1.demo_path_title
    );
  } else {
    fail(
      "Demo path → Social Media Management Demo",
      `got "${d1.selected_demo_path_title ?? session1.demo_path_title ?? "none"}"`
    );
  }

  const stage1 = normStage(
    d1.current_demo_stage ?? session1.current_demo_stage ?? ""
  );
  if (
    ["need_discovery", "demo_path_selection", "presentation"].includes(stage1)
  ) {
    pass("Current stage → Need Discovery (or path/presentation)", stage1);
  } else {
    fail("Current stage → Need Discovery", stage1 || "—");
  }

  const interest =
    d1.lead_updates?.service_interest ??
    session1.service_interest ??
    room1?.lead?.service_interest ??
    d1.detected_intent;
  if (interest && /social|media|real estate/i.test(String(interest))) {
    pass("Lead interest updates", String(interest));
  } else if (/social|real estate|media/i.test(reply1)) {
    pass("Lead interest updates", `(inferred from reply)`);
  } else {
    fail("Lead interest updates", String(interest ?? "not set"));
  }

  const q1 = d1.qualification_progress ?? session1.qualification_progress;
  const score1 = session1.lead_score ?? d1.lead_score ?? 0;
  if (q1?.need || q1?.budget || q1?.authority || q1?.timeline || score1 > 0) {
    pass("Qualification progress starts", JSON.stringify(q1 ?? { score: score1 }));
  } else {
    fail("Qualification progress starts", JSON.stringify(q1 ?? {}));
  }

  if (replyAsksGoal(reply1)) {
    pass("AI asks about goal", reply1.slice(0, 140) + "…");
  } else {
    fail("AI asks about goal", reply1.slice(0, 160) + "…");
  }

  const asset1 =
    d1.next_demo_asset?.title ??
    d1.current_demo_asset_title ??
    session1.current_demo_asset_title;
  const assets = room1?.assets ?? room1?.presentationAssets ?? [];
  if (asset1 || assets.length > 0) {
    pass(
      "Center panel shows relevant demo asset",
      asset1 ?? `${assets.length} assets loaded`
    );
  } else {
    fail("Center panel shows relevant demo asset", "no asset on response or room");
  }

  const booking1 = d1.booking_recommended ?? session1.booking_recommended;
  const handoff1 = d1.handoff_required ?? session1.handoff_required;
  if (!booking1) pass("Booking CTA gated (turn 1)", "booking_recommended=false");
  else fail("Booking CTA gated (turn 1)", "booking too early");
  if (!handoff1) pass("Handoff gated (turn 1)", "handoff_required=false");
  else fail("Handoff gated (turn 1)", "handoff too early");

  // --- Turn 2 ---
  console.log(`\n--- Turn 2: "${MSG2}" ---\n`);
  await new Promise((r) => setTimeout(r, 800));
  const msg2 = await request("POST", `/api/demo-room/${sessionId}/message`, {
    message: MSG2,
    display_name: "Real Estate Test",
    email: "re-test@example.com",
  });
  if (msg2.status !== 200) {
    fail("send message 2", `${msg2.status} ${JSON.stringify(msg2.data)}`);
    process.exit(1);
  }

  const room2 = (await request("GET", `/api/demo-room/${sessionId}`)).data;
  const session2 = room2?.session ?? {};
  const score2 = session2.lead_score ?? msg2.data?.lead_score ?? 0;
  const scoreBefore = score1 || session1.lead_score ?? 0;

  if (score2 > scoreBefore || score2 >= 5) {
    pass("Lead score increases", `${scoreBefore} → ${score2}`);
  } else {
    fail("Lead score increases", `${scoreBefore} → ${score2}`);
  }

  const cat = (session2.lead_category ?? msg2.data?.lead_category ?? "").toLowerCase();
  if (cat === "hot" || cat === "hot lead" || score2 >= 8) {
    pass("Lead category → Hot Lead", session2.lead_category ?? cat);
  } else {
    fail("Lead category → Hot Lead", session2.lead_category ?? cat || "—");
  }

  const booking2 =
    msg2.data?.booking_recommended ?? session2.booking_recommended;
  const placeholder = room2?.booking_placeholder === true;
  if (booking2 && !placeholder) {
    pass("Booking CTA appears", "booking_recommended=true");
  } else if (booking2) {
    pass("Booking CTA appears", "recommended (placeholder may hide UI)");
  } else {
    fail("Booking CTA appears", "booking_recommended=false");
  }

  const handoff2 =
    msg2.data?.handoff_required ?? session2.handoff_required;
  if (handoff2) {
    pass("Human handoff alert", `handoff_required=true reason=${session2.handoff_reason ?? "—"}`);
  } else {
    fail("Human handoff alert", "handoff_required=false");
  }

  const nextAction =
    session2.recommended_next_action ?? msg2.data?.recommended_next_action;
  if (nextAction?.trim()) {
    pass("Recommended next action updates", nextAction.slice(0, 100));
  } else {
    fail("Recommended next action updates", "empty");
  }

  console.log("\n=== Summary ===\n");
  const ok = results.filter((r) => r.ok).length;
  console.log(`${ok}/${results.length} passed`);
  const bad = results.filter((r) => !r.ok);
  if (bad.length) {
    console.log("\nFailed:");
    for (const r of bad) console.log(`  - ${r.step}: ${r.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
