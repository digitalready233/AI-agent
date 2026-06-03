import { buildVoiceWebhookUrls } from "@/lib/voice/urls";

/** Media Streams use a WebSocket server — see `npm run voice:ws` for local dev. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const urls = buildVoiceWebhookUrls(origin);
  return Response.json({
    message:
      "Twilio Media Streams require a WebSocket endpoint. Run `npm run voice:ws` locally and set media_stream_ws_url in Voice settings.",
    suggested_ws_url: urls.media_stream_ws_url,
    note: "On Vercel/serverless, host the WebSocket bridge on a long-running Node service and set VOICE_MEDIA_WS_PUBLIC_URL.",
  });
}
