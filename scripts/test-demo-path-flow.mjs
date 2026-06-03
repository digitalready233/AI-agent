/**
 * E2E: Social Media path → qualification → hot lead → booking CTA → notifications → summary
 * Run: node scripts/test-demo-path-flow.mjs
 * Requires: npm run dev, .env.local (Supabase service role + LLM keys)
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
  process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID ||
  process.env.PLATFORM_AGENT_ID;

const SOCIAL_PATH_TITLE = "Social Media Management Demo";
const EXPECTED_SLIDES = [
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

async function request(method, path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
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

function includesSocialPath(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  return t.includes("social media") || t.includes("social_media");
}

async function main() {
  if (!AGENT_ID) {
    fail("config", "NEXT_PUBLIC_PLATFORM_AGENT_ID missing in .env.local");
    process.exit(1);
  }

  console.log(`\nDemo path flow test → ${BASE}\nAgent: ${AGENT_ID}\n`);

  // 1. Start on-demand demo
  const start = await request("POST", "/api/demo/on-demand/start", {
    agent_id: AGENT_ID,
    visitor_name: "Test Prospect",
    visitor_email: "demo-test@example.com",
  });
  if (start.status !== 200) {
    fail("start demo", `${start.status} ${JSON.stringify(start.data)}`);
    printSummary();
    process.exit(1);
  }
  const sessionId = start.data.session?.id;
  pass("start demo", `session ${sessionId}`);

  // 2. Join
  const join = await request("POST", `/api/demo-room/${sessionId}/join`, {
    display_name: "Test Prospect",
    email: "demo-test@example.com",
  });
  if (join.status !== 200) {
    fail("join", `${join.status} ${JSON.stringify(join.data)}`);
  } else {
    pass("join", join.data.welcome?.slice(0, 60) ?? "joined");
  }

  // 3. Load room — assets should be path-scoped after first message; check after msg1
  async function getRoom() {
    const r = await request("GET", `/api/demo-room/${sessionId}`);
    return r.status === 200 ? r.data : null;
  }

  const messages = [
    {
      label: "opening — social + real estate",
      text: "I need social media management for my real estate company.",
    },
    {
      label: "goal + business type",
      text: "My main goal is more qualified buyer leads from Instagram and Facebook for our property listings. We are a real estate agency in Accra.",
    },
    {
      label: "budget + timeline + authority",
      text: "Budget is GHS 5,000 per month. I want to start this month. I am the managing director and I approve marketing spend.",
    },
  ];

  let lastMsg = null;
  for (const turn of messages) {
    const msg = await request("POST", `/api/demo-room/${sessionId}/message`, {
      message: turn.text,
      display_name: "Test Prospect",
      email: "demo-test@example.com",
    });
    lastMsg = msg;
    if (msg.status !== 200) {
      fail(turn.label, `${msg.status} ${JSON.stringify(msg.data)}`);
      if (msg.data?.fallback_reply) {
        console.log("  fallback:", msg.data.fallback_reply.slice(0, 120));
      }
      continue;
    }
    pass(
      turn.label,
      `stage=${msg.data.demo_stage ?? msg.data.current_demo_stage} path=${msg.data.selected_demo_path_title ?? "—"} score=${msg.data.lead_score ?? "—"} cat=${msg.data.lead_category ?? "—"}`
    );
    await new Promise((r) => setTimeout(r, 1500));
  }

  const room = await getRoom();
  if (!room) {
    fail("room state", "GET demo-room failed");
  } else {
    const pathTitle =
      room.session?.demo_path_title ??
      room.demo_path?.title ??
      "";
    if (includesSocialPath(pathTitle)) {
      pass("path selected", pathTitle);
    } else {
      fail("path selected", `expected Social Media path, got "${pathTitle || "none"}"`);
    }

    const assetTitles = (room.assets ?? room.presentationAssets ?? []).map((a) => a.title);
    const hasSocialSlides = EXPECTED_SLIDES.every((t) =>
      assetTitles.some((at) => at.toLowerCase() === t.toLowerCase())
    );
    if (assetTitles.length >= 5 && hasSocialSlides) {
      pass("social path assets", assetTitles.join(" → "));
    } else if (assetTitles.length > 0) {
      fail(
        "social path assets",
        `got ${assetTitles.length} slides: ${assetTitles.join(", ")} (re-seed paths & slides in admin)`
      );
    } else {
      fail("social path assets", "no presentation assets — seed path slides for agent");
    }

    const q = room.session?.qualification_progress;
    if (q?.need && q?.budget && q?.timeline) {
      pass("qualification", `need=${q.need} budget=${q.budget} authority=${q.authority} timeline=${q.timeline}`);
    } else {
      fail("qualification", JSON.stringify(q));
    }

    const cat = (room.session?.lead_category ?? "").toLowerCase();
    if (cat === "hot" || cat === "hot lead") {
      pass("hot lead", room.session.lead_category);
    } else {
      fail("hot lead", `category=${room.session?.lead_category} score=${room.session?.lead_score}`);
    }

    if (room.session?.booking_recommended) {
      pass("booking CTA flag", "booking_recommended=true");
    } else {
      fail("booking CTA flag", "booking_recommended=false");
    }

    if (room.session?.handoff_required) {
      pass("human handoff", "handoff_required=true (hot lead / closer needed)");
    } else {
      fail("human handoff", "handoff_required=false for hot demo");
    }
  }

  // Notifications (Supabase REST)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const orgId =
    room?.session?.organization_id ?? start.data.session?.organization_id;
  if (supabaseUrl && serviceKey && orgId) {
    const nRes = await fetch(
      `${supabaseUrl}/rest/v1/notifications?organization_id=eq.${orgId}&order=created_at.desc&limit=20`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    if (nRes.ok) {
      const notes = await nRes.json();
      const demoNotes = notes.filter(
        (n) =>
          n.metadata?.demo_session_id === sessionId ||
          n.type === "hot_lead" ||
          n.type === "demo_handoff"
      );
      const hot = demoNotes.find((n) => n.type === "hot_lead");
      const handoff = demoNotes.find((n) => n.type === "demo_handoff");
      if (hot || handoff) {
        pass(
          "admin notifications",
          [hot && `hot_lead: ${hot.title}`, handoff && `demo_handoff: ${handoff.title}`]
            .filter(Boolean)
            .join("; ")
        );
      } else {
        fail(
          "admin notifications",
          `no hot_lead/demo_handoff for session (found ${notes.length} recent org notifications)`
        );
      }
    } else {
      fail("admin notifications", `Supabase ${nRes.status}`);
    }
  }

  // End demo + summary
  const end = await request("POST", `/api/demo-room/${sessionId}/end`, {});
  if (end.status === 200) {
    const summary = end.data.summary ?? end.data.session?.summary ?? "";
    if (summary.length > 100) {
      pass("demo summary", `${summary.length} chars saved`);
      if (summary.toLowerCase().includes("social") || summary.toLowerCase().includes("real estate")) {
        pass("summary content", "mentions path or real estate");
      }
    } else {
      fail("demo summary", "summary empty or short");
    }
  } else {
    fail("end demo", `${end.status} ${JSON.stringify(end.data)}`);
  }

  // Path selection unit check (no LLM)
  try {
    const { selectDemoPathFromMessage } = await import("../lib/demo/select-demo-path.ts");
    const { listDemoPaths } = await import("../lib/demo/demo-paths-data.ts");
    const orgId = room?.session?.organization_id;
    if (orgId) {
      const paths = await listDemoPaths(orgId, AGENT_ID);
      const sel = selectDemoPathFromMessage(
        "I need social media management for my real estate company.",
        paths
      );
      if (sel.path && includesSocialPath(sel.path.title)) {
        pass("keyword path rules", `${sel.path.title} (${sel.reason})`);
      } else {
        fail("keyword path rules", sel.reason);
      }
    }
  } catch (e) {
    console.warn("  (skipped TS path rule check:", e.message, ")");
  }

  printSummary();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log("\n--- Results ---");
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok);
  console.log(`${ok}/${results.length} passed`);
  if (bad.length) {
    console.log("\nFailed:");
    for (const r of bad) console.log(`  - ${r.step}: ${r.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
