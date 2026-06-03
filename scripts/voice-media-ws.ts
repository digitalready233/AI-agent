/**
 * Standalone WebSocket server for Twilio Media Streams (development).
 * Run: npx tsx scripts/voice-media-ws.ts
 */
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { handleTwilioMediaMessage } from "../lib/voice/media-stream/bridge";

const port = Number(process.env.VOICE_MEDIA_WS_PORT || 3099);

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Voice media WebSocket server\n");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  console.info("[voice-ws] connected", url.search);

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString()) as Record<string, unknown>;
      await handleTwilioMediaMessage(ws, message);
    } catch (err) {
      console.error("[voice-ws] message error", err);
    }
  });
});

httpServer.listen(port, () => {
  console.info(`[voice-ws] ws://127.0.0.1:${port}`);
});
