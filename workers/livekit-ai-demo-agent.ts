/**
 * LiveKit AI demo agent worker — publishes AI voice as a real room audio track.
 *
 * Run alongside Next.js dev/prod:
 *   npm run demo:livekit-ai-bridge
 *
 * Requires .env.local:
 *   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, OPENAI_API_KEY
 *   SUPABASE_SERVICE_ROLE_KEY (agent lookup)
 *   LIVEKIT_AI_BRIDGE_URL=http://127.0.0.1:3100  (in Next.js app)
 *
 * Flow:
 *   1. Next.js AI worker calls this service via HTTP (livekit-ai-bridge-client)
 *   2. Worker connects as ai-agent-{agentId}-{sessionId}
 *   3. OpenAI TTS → PCM → LiveKit AudioSource → remote participants hear AI
 *   4. Room data messages sync UI state (path, asset, lead, handoff)
 *
 * Future: LIVEKIT_AI_REALTIME_ENABLED=true → LiveKit Agents + OpenAI Realtime plugin
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  shutdownDemoLiveKitAiAgentService,
  startDemoLiveKitAiAgentService,
} from "../lib/demo/livekit-ai-demo-agent-service";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
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
}

async function main() {
  loadEnvLocal();
  await startDemoLiveKitAiAgentService();

  const shutdown = async () => {
    await shutdownDemoLiveKitAiAgentService();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
