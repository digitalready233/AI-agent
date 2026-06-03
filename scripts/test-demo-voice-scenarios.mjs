/**
 * Voice demo scenarios (API — simulates STT output as transcript text)
 * Run: node scripts/test-demo-voice-scenarios.mjs
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

const results = [];
function pass(s, d) {
  results.push({ s, ok: true, d });
  console.log(`✓ ${s}: ${d}`);
}
function fail(s, d) {
  results.push({ s, ok: false, d });
  console.error(`✗ ${s}: ${d}`);
}

async function json(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function voiceTurn(sessionId, transcript, extra = {}) {
  return json("POST", `/api/demo/sessions/${sessionId}/voice`, {
    transcript,
    display_name: "Voice Test Prospect",
    email: "voice-test@example.com",
    ...extra,
  });
}

async function speak(sessionId, text) {
  return json("POST", `/api/demo/sessions/${sessionId}/speak`, { text });
}

function isSocial(title) {
  return (title ?? "").toLowerCase().includes("social media");
}

async function main() {
  if (!AGENT_ID) {
    fail("config", "NEXT_PUBLIC_PLATFORM_AGENT_ID missing");
    process.exit(1);
  }

  console.log(`\nVoice scenarios → ${BASE}\n`);

  const start = await json("POST", "/api/demo/on-demand/start", {
    agent_id: AGENT_ID,
    visitor_name: "Voice Test Prospect",
    visitor_email: "voice-test@example.com",
  });
  if (start.status !== 200) {
    fail("start", JSON.stringify(start.data));
    process.exit(1);
  }
  const sessionId = start.data.session?.id;
  pass("start demo", sessionId);

  await json("POST", `/api/demo-room/${sessionId}/join`, {
    display_name: "Voice Test Prospect",
    email: "voice-test@example.com",
  });

  // Scenario 1
  const s1 = await voiceTurn(
    sessionId,
    "I need social media management for my real estate company."
  );
  if (s1.status !== 200) {
    fail("S1 voice turn", `${s1.status} ${JSON.stringify(s1.data)}`);
  } else {
    pass("S1 transcript processed", s1.data.reply?.slice(0, 80) + "…");
    const room = (await json("GET", `/api/demo-room/${sessionId}`)).data;
    const pathTitle = room.session?.demo_path_title ?? "";
    if (isSocial(pathTitle)) pass("S1 Social Media path", pathTitle);
    else fail("S1 Social Media path", pathTitle || "none");
    const assets = (room.assets ?? []).map((a) => a.title);
    if (assets.length >= 5) pass("S1 path assets", assets.join(", "));
    else fail("S1 path assets", String(assets.length));
    if (!s1.data.booking_recommended) pass("S1 booking gated", "false");
    else fail("S1 booking gated", "true too early");
    const speakRes = await speak(sessionId, s1.data.ai_voice_text ?? s1.data.reply);
    if (speakRes.status === 200) {
      pass(
        "S1 TTS speak route",
        speakRes.data.use_browser_tts
          ? "browser fallback"
          : `audio ${(speakRes.data.audio_base64 ?? "").length} b64 chars`
      );
    } else fail("S1 TTS speak route", String(speakRes.status));
  }

  await new Promise((r) => setTimeout(r, 1200));

  // Scenario 2
  const s2 = await voiceTurn(
    sessionId,
    "My budget is GHS 5,000 and I want to start this month. I am the managing director."
  );
  if (s2.status !== 200) {
    fail("S2 voice turn", `${s2.status}`);
  } else {
    const cat = (s2.data.lead_category ?? "").toLowerCase();
    if (cat === "hot" || cat === "hot lead") pass("S2 hot lead", s2.data.lead_category);
    else fail("S2 hot lead", `${s2.data.lead_category} score=${s2.data.lead_score}`);
    if (s2.data.booking_recommended) pass("S2 booking CTA", "recommended");
    else fail("S2 booking CTA", "not recommended");
    if (s2.data.handoff_required) pass("S2 handoff", "triggered");
    else fail("S2 handoff", "not triggered");
  }

  await new Promise((r) => setTimeout(r, 1200));

  // Scenario 3
  const s3 = await voiceTurn(sessionId, "I want to speak to someone.");
  if (s3.status !== 200) {
    fail("S3 voice turn", `${s3.status}`);
  } else {
    if (s3.data.handoff_required) pass("S3 handoff required", "true");
    else fail("S3 handoff required", "false");
    const spoken = (s3.data.ai_voice_text ?? s3.data.reply ?? "").toLowerCase();
    if (/team|human|assist|notify|member/.test(spoken)) {
      pass("S3 AI handoff phrase", s3.data.ai_voice_text?.slice(0, 100));
    } else {
      fail("S3 AI handoff phrase", s3.data.ai_voice_text?.slice(0, 100));
    }
  }

  const end = await json("POST", `/api/demo-room/${sessionId}/end`, {});
  if (end.status === 200 && (end.data.summary ?? "").length > 50) {
    pass("end summary", `${(end.data.summary ?? "").length} chars`);
  } else {
    fail("end summary", String(end.status));
  }

  console.log("\n--- Voice scenario results ---");
  const ok = results.filter((r) => r.ok).length;
  console.log(`${ok}/${results.length} passed`);
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
