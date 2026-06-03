/** Public URLs for Twilio voice webhooks (no secrets). */
export function voiceWebhookPaths() {
  return {
    incoming: "/api/voice/twilio/incoming",
    status: "/api/voice/twilio/status",
    mediaStream: "/api/voice/twilio/media-stream",
    outbound: "/api/voice/twilio/outbound",
    transfer: "/api/voice/twilio/transfer",
    endCall: "/api/voice/twilio/end-call",
  };
}

export function buildVoiceWebhookUrls(appOrigin: string) {
  const base = appOrigin.replace(/\/$/, "");
  const paths = voiceWebhookPaths();
  const wsBase = process.env.VOICE_MEDIA_WS_PUBLIC_URL?.trim()
    || process.env.VOICE_MEDIA_WS_URL?.trim()
    || defaultMediaStreamWsUrl(base);

  return {
    inbound_webhook_url: `${base}${paths.incoming}`,
    status_callback_url: `${base}${paths.status}`,
    media_stream_ws_url: wsBase,
    paths,
  };
}

function defaultMediaStreamWsUrl(httpBase: string): string {
  const port = process.env.VOICE_MEDIA_WS_PORT?.trim() || "3099";
  if (httpBase.includes("localhost") || httpBase.includes("127.0.0.1")) {
    return `ws://127.0.0.1:${port}`;
  }
  try {
    const u = new URL(httpBase);
    const proto = u.protocol === "http:" ? "ws:" : "wss:";
    return `${proto}//${u.host}/voice-media-stream`;
  } catch {
    return `wss://${httpBase.replace(/^https?:\/\//, "")}/voice-media-stream`;
  }
}
