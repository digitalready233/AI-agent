/**
 * LiveKit AI demo agent scenarios (requires dev server + env).
 * Run: npm run dev  then  npm run test:demo-livekit-ai
 */
const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function assert(name, cond, detail = "") {
  if (!cond) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log(`Base URL: ${BASE}\n`);

  const onDemand = await post("/api/demo/on-demand/start", {
    visitor_name: "AI Test Prospect",
    visitor_email: `ai-test-${Date.now()}@example.com`,
    organization_slug: process.env.DEMO_ORG_SLUG || undefined,
  });
  if (!onDemand.ok) {
    console.error("On-demand start failed:", onDemand.status, onDemand.data);
    process.exit(1);
  }
  const sessionId = onDemand.data.session_id ?? onDemand.data.demo_session_id;
  assert("on-demand session created", Boolean(sessionId));

  const createRoom = await post("/api/demo/livekit/create-room", {
    demo_session_id: sessionId,
  });
  assert("LiveKit room ready", createRoom.ok, JSON.stringify(createRoom.data));

  const startAi = await post("/api/demo/livekit/ai/start", {
    demo_session_id: sessionId,
  });
  assert("AI worker started", startAi.ok, JSON.stringify(startAi.data));
  assert("AI status active", ["active", "starting"].includes(startAi.data.ai_status));

  const status1 = await post("/api/demo/livekit/ai/status", {
    demo_session_id: sessionId,
  });
  assert("AI status poll", status1.ok && status1.data.ai_joined === true);
  console.log(
    `    audio_mode: ${status1.data.ai_audio_mode ?? "—"} · track: ${status1.data.ai_audio_track_published ? "yes" : "no"}`
  );

  const msg1 = await post("/api/demo/livekit/ai/message", {
    demo_session_id: sessionId,
    message: "I need a website for my business",
    input_type: "voice",
  });
  assert("Scenario 1 — website intent", msg1.ok || msg1.data.ai_response, JSON.stringify(msg1.data));

  const msg2 = await post("/api/demo/livekit/ai/message", {
    demo_session_id: sessionId,
    message: "My budget is GHS 5,000 and I want to start this month.",
    input_type: "voice",
  });
  assert("Scenario 2 — budget message", msg2.ok || msg2.data.ai_response);
  if (msg2.data.published_to_livekit) {
    console.log("    native LiveKit audio published for turn");
  }
  if (msg2.data.use_browser_tts) {
    console.log("    fallback TTS path used (bridge may be offline)");
  }
  if (msg2.data.lead_category) {
    console.log(`    lead_category: ${msg2.data.lead_category}`);
  }
  if (msg2.data.booking_recommended) {
    console.log("    booking_recommended: true");
  }

  const pause = await post("/api/demo/livekit/ai/pause", { demo_session_id: sessionId });
  assert("Scenario 3 — AI paused", pause.ok && pause.data.ai_paused === true);

  const msgWhilePaused = await post("/api/demo/livekit/ai/message", {
    demo_session_id: sessionId,
    message: "Are you still there?",
  });
  assert(
    "Paused blocks or soft-fails",
    !msgWhilePaused.data?.ok || msgWhilePaused.data?.phase === "paused"
  );

  const resume = await post("/api/demo/livekit/ai/resume", { demo_session_id: sessionId });
  assert("Scenario 4 — AI resumed", resume.ok && resume.data.ai_paused === false);

  const audioLogs = await post("/api/demo/livekit/ai/audio-logs", {
    demo_session_id: sessionId,
  });
  assert("AI audio logs", audioLogs.ok && Array.isArray(audioLogs.data.logs));

  const stop = await post("/api/demo/livekit/ai/stop", { demo_session_id: sessionId });
  assert("AI stopped", stop.ok && stop.data.ai_status === "stopped");

  console.log("\nAll LiveKit AI scenario checks passed.");
  console.log(
    "For native room audio: run npm run demo:livekit-ai-bridge and set LIVEKIT_AI_BRIDGE_URL in .env.local"
  );
}

main().catch((e) => {
  if (e.cause?.code === "ECONNREFUSED" || e.message?.includes("fetch failed")) {
    console.error("\nCould not reach dev server. Start with: npm run dev");
  }
  console.error(e);
  process.exit(1);
});
