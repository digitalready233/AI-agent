/**
 * LiveKit demo room scenarios (requires dev server + LIVEKIT_* in .env.local)
 * Run: npm run test:demo-livekit
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

const livekitConfigured = Boolean(
  process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
);

const results = [];
function pass(s, d) {
  results.push({ s, ok: true, d });
  console.log(`✓ ${s}: ${d}`);
}
function fail(s, d) {
  results.push({ s, ok: false, d });
  console.error(`✗ ${s}: ${d}`);
}
function skip(s, d) {
  results.push({ s, ok: true, d: `SKIP: ${d}` });
  console.log(`○ ${s}: ${d}`);
}

async function json(method, path, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    const code =
      err && typeof err === "object" && "cause" in err && err.cause && typeof err.cause === "object" && "code" in err.cause
        ? String(err.cause.code)
        : "";
    if (code === "ECONNREFUSED") {
      throw new Error(
        `Cannot reach ${BASE}. Start the app first: npm run dev (in another terminal), then re-run this test.`
      );
    }
    throw err;
  }
}

async function main() {
  console.log(`Base URL: ${BASE}`);
  if (!AGENT_ID) {
    fail("config", "Set NEXT_PUBLIC_PLATFORM_AGENT_ID in .env.local");
    process.exit(1);
  }

  if (!livekitConfigured) {
    skip(
      "livekit env",
      "Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to .env.local (from cloud.livekit.io), then restart npm run dev"
    );
  }

  const start = await json("POST", "/api/demo/on-demand/start", {
    agent_id: AGENT_ID,
    visitor_name: "LiveKit Test",
    visitor_email: "livekit-test@example.com",
  });
  const sessionId = start.data.session?.id ?? start.data.session_id;
  if (start.status !== 200 || !sessionId) {
    fail("start demo", start.data.error ?? `status ${start.status}`);
    process.exit(1);
  }
  pass("start demo", sessionId);

  const room = await json("GET", `/api/demo-room/${sessionId}`);
  if (room.status !== 200) {
    fail("load demo room", `status ${room.status}`);
  } else {
    const s = room.data.session ?? {};
    pass("room payload", `video_provider=${s.video_provider ?? "?"}`);
    if (s.use_livekit_video || s.video_provider === "livekit") {
      pass("livekit mode flag", "session exposes livekit video");
    } else if (livekitConfigured) {
      fail("livekit mode flag", "expected livekit when env configured");
    }
  }

  if (livekitConfigured) {
    const token = await json("POST", "/api/demo/livekit/token", {
      demo_session_id: sessionId,
      role: "prospect",
      name: "LiveKit Test",
      identity: `prospect-test-${Date.now()}`,
      ensure_room: true,
    });
    if (token.status === 200 && token.data.livekit?.token) {
      pass("prospect token", token.data.livekit.room_name);
    } else {
      fail("prospect token", token.data.error ?? `status ${token.status}`);
    }

    const status = await json("GET", `/api/demo/livekit/status?demo_session_id=${sessionId}`);
    if (status.status === 200) {
      pass("room status", status.data.livekit_room_status ?? status.data.status);
    } else {
      fail("room status", status.data.error ?? `status ${status.status}`);
    }
  }

  const msg = await json("POST", `/api/demo-room/${sessionId}/message`, {
    message: "We need social media management for our brand",
    display_name: "LiveKit Test",
    email: "livekit-test@example.com",
  });
  if (msg.status === 200) {
    pass("demo workflow", "message accepted");
  } else {
    fail("demo workflow", msg.data.error ?? `status ${msg.status}`);
  }

  const handoff = await json("POST", `/api/demo/sessions/${sessionId}/human-takeover`, {
    as_staff: false,
  });
  if (handoff.status === 200) {
    pass("handoff request", handoff.data.handoff_status ?? "ok");
  } else {
    fail("handoff request", handoff.data.error ?? `status ${handoff.status}`);
  }

  const end = await json("POST", `/api/demo-room/${sessionId}/end`, {
    display_name: "LiveKit Test",
  });
  if (end.status === 200) {
    pass("end demo", "session ended");
  } else {
    fail("end demo", end.data.error ?? `status ${end.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
