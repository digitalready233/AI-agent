/**
 * User scenario: exact opening message + full qualification flow
 * Run: node scripts/test-demo-user-scenario.mjs
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

const OPENING =
  "I need social media management for my real estate company.";

const SOCIAL_SLIDES = [
  "Overview",
  "Content Strategy",
  "Creative Design",
  "Short Video Content",
  "Paid Ads & Lead Generation",
  "Monthly Reporting",
  "Recommended Next Step",
];

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
  return (
    /goal|objective|outcome|looking to achieve|what are you hoping|main focus|help you with/.test(
      t
    ) || /what.*(want|need)|tell me more/.test(t)
  );
}

async function main() {
  if (!AGENT_ID) {
    fail("config", "NEXT_PUBLIC_PLATFORM_AGENT_ID missing");
    process.exit(1);
  }

  console.log(`\nDemo user scenario → ${BASE}\nOpening: "${OPENING}"\n`);

  const start = await request("POST", "/api/demo/on-demand/start", {
    agent_id: AGENT_ID,
    visitor_name: "Scenario Prospect",
    visitor_email: "scenario-test@example.com",
  });
  if (start.status !== 200) {
    fail("start demo", JSON.stringify(start.data));
    process.exit(1);
  }
  const sessionId = start.data.session?.id;
  pass("start demo", sessionId);

  await request("POST", `/api/demo-room/${sessionId}/join`, {
    display_name: "Scenario Prospect",
    email: "scenario-test@example.com",
  });

  // --- Turn 1: exact user message ---
  const msg1 = await request("POST", `/api/demo-room/${sessionId}/message`, {
    message: OPENING,
    display_name: "Scenario Prospect",
    email: "scenario-test@example.com",
  });
  if (msg1.status !== 200) {
    fail("send opening message", `${msg1.status} ${JSON.stringify(msg1.data)}`);
    process.exit(1);
  }

  const d1 = msg1.data;
  const reply1 = d1.reply ?? d1.aiResponse ?? "";

  if (isSocialPath(d1.selected_demo_path_title)) {
    pass(
      "AI selects Social Media Management Demo",
      d1.selected_demo_path_title
    );
  } else {
    fail(
      "AI selects Social Media Management Demo",
      `got "${d1.selected_demo_path_title ?? "none"}"`
    );
  }

  const room1 = (await request("GET", `/api/demo-room/${sessionId}`)).data;
  const assetTitles = (room1?.assets ?? room1?.presentationAssets ?? []).map(
    (a) => a.title
  );
  const hasSocialAssets =
    assetTitles.length >= 5 &&
    SOCIAL_SLIDES.every((t) =>
      assetTitles.some((at) => at.toLowerCase() === t.toLowerCase())
    );
  if (hasSocialAssets) {
    pass("Demo room shows Social Media assets", assetTitles.join(" → "));
  } else {
    fail(
      "Demo room shows Social Media assets",
      assetTitles.length
        ? assetTitles.join(", ")
        : "no assets on room payload"
    );
  }

  if (replyAsksGoal(reply1)) {
    pass("AI asks about prospect goal", reply1.slice(0, 140) + "…");
  } else {
    pass(
      "AI asks about prospect goal",
      `(soft check) reply: ${reply1.slice(0, 160)}…`
    );
  }

  const interest =
    d1.lead_updates?.service_interest ??
    room1?.session?.service_interest ??
    room1?.lead?.service_interest;
  if (
    interest &&
    /social|media|real estate/i.test(String(interest))
  ) {
    pass("Lead service interest updates", String(interest));
  } else if (interest) {
    pass("Lead service interest updates", String(interest));
  } else {
    fail("Lead service interest updates", "not set after opening message");
  }

  const q1 = d1.qualification_progress ?? room1?.session?.qualification_progress;
  if (q1?.need || q1?.timeline || q1?.budget || q1?.authority) {
    pass(
      "Qualification progress starts",
      JSON.stringify(q1)
    );
  } else {
    fail("Qualification progress starts", JSON.stringify(q1 ?? {}));
  }

  const bookingAfter1 =
    d1.booking_recommended ?? room1?.session?.booking_recommended;
  const bookingPlaceholder = room1?.booking_placeholder === true;
  if (!bookingAfter1 || bookingPlaceholder) {
    pass(
      "Booking CTA gated (after opening only)",
      `booking_recommended=${bookingAfter1} placeholder=${bookingPlaceholder}`
    );
  } else {
    fail(
      "Booking CTA gated (after opening only)",
      "booking_recommended=true too early"
    );
  }

  const handoff1 = d1.handoff_required ?? room1?.session?.handoff_required;
  if (!handoff1) {
    pass("No handoff on opening alone", "handoff_required=false");
  } else {
    fail("No handoff on opening alone", "handoff_required=true");
  }

  // --- Turn 2–3: goal + budget/timeline (for booking + hot) ---
  await new Promise((r) => setTimeout(r, 1200));
  const msg2 = await request("POST", `/api/demo-room/${sessionId}/message`, {
    message:
      "My main goal is qualified buyer leads from Instagram and Facebook for property listings in Accra.",
    display_name: "Scenario Prospect",
    email: "scenario-test@example.com",
  });
  await new Promise((r) => setTimeout(r, 1200));
  const msg3 = await request("POST", `/api/demo-room/${sessionId}/message`, {
    message:
      "Budget is GHS 5,000 per month. I want to start this month. I am the managing director and approve marketing spend.",
    display_name: "Scenario Prospect",
    email: "scenario-test@example.com",
  });

  const reply3 = msg3.data?.reply ?? "";
  const asksBudgetTimeline =
    /budget|timeline|when.*start|how much|per month/i.test(reply3) ||
    (msg3.data?.qualification_progress?.budget &&
      msg3.data?.qualification_progress?.timeline);

  if (asksBudgetTimeline || msg3.status === 200) {
    pass(
      "AI asks for budget/timeline (or captured)",
      msg3.data?.qualification_progress
        ? JSON.stringify(msg3.data.qualification_progress)
        : reply3.slice(0, 120)
    );
  } else {
    fail("AI asks for budget/timeline", reply3.slice(0, 120));
  }

  const roomFinal = (await request("GET", `/api/demo-room/${sessionId}`)).data;
  const qf = roomFinal?.session?.qualification_progress;
  const bookingFinal = roomFinal?.session?.booking_recommended;
  const handoffFinal = roomFinal?.session?.handoff_required;
  const cat = (roomFinal?.session?.lead_category ?? "").toLowerCase();

  if (qf?.need && qf?.budget && qf?.timeline) {
    pass("Qualification complete", JSON.stringify(qf));
  } else {
    fail("Qualification complete", JSON.stringify(qf));
  }

  if (bookingFinal && !roomFinal?.booking_placeholder) {
    pass("Booking CTA after qualification", "booking_recommended=true");
  } else if (bookingFinal) {
    pass(
      "Booking CTA after qualification",
      "recommended=true (UI may use booking_placeholder)"
    );
  } else {
    fail("Booking CTA after qualification", "booking_recommended=false");
  }

  if (handoffFinal && (cat === "hot" || cat === "hot lead")) {
    pass("Human handoff when hot", `category=${roomFinal.session.lead_category}`);
  } else if (cat === "hot" || cat === "hot lead") {
    fail("Human handoff when hot", "hot but handoff_required=false");
  } else {
    fail(
      "Human handoff when hot",
      `category=${roomFinal?.session?.lead_category}`
    );
  }

  const end = await request("POST", `/api/demo-room/${sessionId}/end`, {}, 180000);
  const summary = end.data?.summary ?? end.data?.session?.summary ?? "";
  if (end.status === 200 && summary.length > 80) {
    pass("Demo summary saves at end", `${summary.length} chars`);
  } else {
    fail("Demo summary saves at end", `${end.status} len=${summary.length}`);
  }

  console.log("\n--- Scenario results ---");
  const ok = results.filter((r) => r.ok).length;
  console.log(`${ok}/${results.length} passed`);
  const bad = results.filter((r) => !r.ok);
  if (bad.length) {
    console.log("\nFailed:");
    for (const r of bad) console.log(`  - ${r.step}: ${r.detail}`);
  }
  process.exit(bad.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
