/**
 * HTTP client for the demo LiveKit AI audio bridge (optional sidecar).
 * When LIVEKIT_AI_BRIDGE_URL is set, AI speech is published as a real LiveKit audio track.
 */

function bridgeBaseUrl(): string | null {
  const url = process.env.LIVEKIT_AI_BRIDGE_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, "");
}

export function isLiveKitAiBridgeEnabled(): boolean {
  return Boolean(bridgeBaseUrl());
}

async function bridgePost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const base = bridgeBaseUrl();
  if (!base) return { ok: false, error: "LIVEKIT_AI_BRIDGE_URL not set" };

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error ?? res.statusText };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bridge unreachable" };
  }
}

export async function bridgeConnectDemoAiPublisher(params: {
  demoSessionId: string;
  agentId: string;
}): Promise<{ ok: boolean; identity?: string; error?: string }> {
  const result = await bridgePost<{ ok: boolean; identity?: string }>("/connect", {
    demo_session_id: params.demoSessionId,
    agent_id: params.agentId,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, identity: result.data?.identity };
}

export async function bridgeSpeakDemoAi(params: {
  demoSessionId: string;
  agentId: string;
  voiceText: string;
}): Promise<{ ok: boolean; published_to_livekit?: boolean; error?: string }> {
  const result = await bridgePost<{ ok: boolean; published_to_livekit?: boolean }>("/speak", {
    demo_session_id: params.demoSessionId,
    agent_id: params.agentId,
    voice_text: params.voiceText,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    published_to_livekit: result.data?.published_to_livekit ?? result.data?.ok,
  };
}

export async function bridgeMuteDemoAiPublisher(
  demoSessionId: string,
  muted: boolean
): Promise<{ ok: boolean; error?: string }> {
  const result = await bridgePost<{ ok: boolean }>("/mute", {
    demo_session_id: demoSessionId,
    muted,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function bridgePublishDemoAiSync(
  demoSessionId: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const result = await bridgePost<{ ok: boolean }>("/sync", {
    demo_session_id: demoSessionId,
    payload,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function bridgeDisconnectDemoAiPublisher(
  demoSessionId: string
): Promise<void> {
  await bridgePost("/disconnect", { demo_session_id: demoSessionId });
}
