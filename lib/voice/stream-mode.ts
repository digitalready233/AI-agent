import type { VoiceIntegration } from "./types";

/**
 * Media stream only when WS is reachable from Twilio (not localhost WS on a public app).
 * Otherwise use Gather + runAgentWorkflow (works on Vercel without a separate WS server).
 */
export function shouldUseMediaStream(integration: VoiceIntegration): boolean {
  if (!integration.use_media_stream) return false;
  if (!process.env.OPENAI_API_KEY?.trim()) return false;

  const ws = integration.media_stream_ws_url?.trim();
  if (!ws) return false;

  const publicWs = process.env.VOICE_MEDIA_WS_PUBLIC_URL?.trim();
  if (publicWs) return true;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.TWILIO_WEBHOOK_PUBLIC_URL?.trim() ||
    ""
  ).toLowerCase();

  const appIsLocal =
    appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const wsIsLocal =
    ws.includes("localhost") || ws.includes("127.0.0.1");

  if (!appIsLocal && wsIsLocal) return false;

  return true;
}
