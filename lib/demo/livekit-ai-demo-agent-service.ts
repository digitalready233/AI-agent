/**
 * Long-running LiveKit AI demo agent service (HTTP sidecar).
 * Publishes AI speech as a real microphone track via @livekit/rtc-node.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  connectDemoAiLiveKitPublisher,
  disconnectDemoAiLiveKitPublisher,
  muteDemoAiLiveKitPublisher,
  publishDemoAiPcmToLiveKit,
  publishDemoAiRoomSync,
  shutdownAllDemoAiPublishers,
} from "./livekit-ai-room-publisher";
import { synthesizeDemoSpeechPcm } from "./synthesize-demo-pcm";
import type { DemoAiRoomSyncPayload } from "./demo-livekit-ai-audio";

export type DemoLiveKitAiBridgeConfig = {
  port?: number;
};

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createDemoLiveKitAiAgentServer(config?: DemoLiveKitAiBridgeConfig) {
  const port = config?.port ?? Number(process.env.LIVEKIT_AI_BRIDGE_PORT || 3100);

  const server = createServer(async (req, res) => {
    const path = req.url?.split("?")[0] ?? "/";

    if (path === "/health" && (req.method === "GET" || req.method === "POST")) {
      send(res, 200, { ok: true, service: "livekit-ai-demo-agent" });
      return;
    }

    if (req.method !== "POST") {
      send(res, 405, { error: "POST only" });
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await readJson(req);
    } catch {
      send(res, 400, { error: "Invalid JSON" });
      return;
    }

    const sessionId = body.demo_session_id as string | undefined;
    const agentId = body.agent_id as string | undefined;

    try {
      if (path === "/connect") {
        if (!sessionId || !agentId) {
          send(res, 400, { error: "demo_session_id and agent_id required" });
          return;
        }
        const result = await connectDemoAiLiveKitPublisher({
          demoSessionId: sessionId,
          agentId,
        });
        send(res, result.ok ? 200 : 503, result);
        return;
      }

      if (path === "/speak") {
        if (!sessionId || !agentId) {
          send(res, 400, { error: "demo_session_id and agent_id required" });
          return;
        }
        const voiceText = (body.voice_text as string)?.trim();
        if (!voiceText) {
          send(res, 400, { error: "voice_text required" });
          return;
        }

        const connected = await connectDemoAiLiveKitPublisher({
          demoSessionId: sessionId,
          agentId,
        });
        if (!connected.ok) {
          send(res, 503, connected);
          return;
        }

        const pcm = await synthesizeDemoSpeechPcm(voiceText);
        if (!pcm) {
          send(res, 503, {
            ok: false,
            error: "PCM synthesis failed",
            published_to_livekit: false,
          });
          return;
        }

        const published = await publishDemoAiPcmToLiveKit({
          demoSessionId: sessionId,
          pcm: pcm.pcm,
          sampleRate: pcm.sampleRate,
          channels: pcm.channels,
        });
        send(res, published.ok ? 200 : 503, {
          ok: published.ok,
          published_to_livekit: published.ok,
          error: published.error,
        });
        return;
      }

      if (path === "/mute") {
        if (!sessionId) {
          send(res, 400, { error: "demo_session_id required" });
          return;
        }
        const muted = body.muted !== false;
        const result = await muteDemoAiLiveKitPublisher(sessionId, muted);
        send(res, result.ok ? 200 : 503, result);
        return;
      }

      if (path === "/sync") {
        if (!sessionId) {
          send(res, 400, { error: "demo_session_id required" });
          return;
        }
        const payload = body.payload as DemoAiRoomSyncPayload | undefined;
        if (!payload?.type) {
          send(res, 400, { error: "payload required" });
          return;
        }
        const result = await publishDemoAiRoomSync(sessionId, payload);
        send(res, result.ok ? 200 : 503, result);
        return;
      }

      if (path === "/disconnect") {
        if (!sessionId) {
          send(res, 400, { error: "demo_session_id required" });
          return;
        }
        await disconnectDemoAiLiveKitPublisher(sessionId);
        send(res, 200, { ok: true });
        return;
      }

      send(res, 404, { error: "Not found" });
    } catch (e) {
      console.error("[livekit-ai-demo-agent]", e);
      send(res, 500, { error: e instanceof Error ? e.message : "Internal error" });
    }
  });

  return { server, port };
}

export function startDemoLiveKitAiAgentService(config?: DemoLiveKitAiBridgeConfig): Promise<number> {
  const { server, port } = createDemoLiveKitAiAgentServer(config);
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.info(`[livekit-ai-demo-agent] http://127.0.0.1:${port}`);
      console.info(
        "  POST /connect /speak /mute /sync /disconnect  GET|POST /health"
      );
      resolve(port);
    });
  });
}

export async function shutdownDemoLiveKitAiAgentService(): Promise<void> {
  await shutdownAllDemoAiPublishers();
}
