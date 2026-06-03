import { AvatarProviderError } from "./errors";
import type { AvatarSessionContext } from "./types";
import { avatarProviderFetch, parseJsonOrThrow } from "./providers/http-helper";
import { resolvePublicAppUrl } from "./tavus-cvi";

export const DID_API_BASE = "https://api.d-id.com";

export function didAuthHeaders(apiKey: string): Record<string, string> {
  const token = Buffer.from(`${apiKey}:`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}

export function requireDidApiKey(ctx: AvatarSessionContext): string {
  const key = ctx.credentials.apiKey?.trim();
  if (!key) {
    throw new AvatarProviderError(
      "MISSING_CREDENTIALS",
      "D-ID API key is not configured. Add it in Avatar settings or set DID_API_KEY.",
      { provider: "did" }
    );
  }
  return key;
}

export function resolveDidAgentId(ctx: AvatarSessionContext): string {
  const id =
    ctx.agent.avatar_id?.trim() ||
    ctx.credentials.defaultAvatarId?.trim() ||
    null;
  if (!id) {
    throw new AvatarProviderError(
      "INVALID_CONFIG",
      "D-ID requires an agent ID on the agent or in integration defaults.",
      { provider: "did" }
    );
  }
  return id;
}

export function resolveDidAllowedDomains(
  extra?: string[] | null
): string[] {
  const appUrl = resolvePublicAppUrl();
  const domains = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    appUrl,
  ]);
  if (extra) {
    for (const d of extra) {
      if (d?.trim()) domains.add(d.trim());
    }
  }
  const fromConfig = process.env.DID_ALLOWED_DOMAINS?.split(",").map((s) => s.trim());
  if (fromConfig) {
    for (const d of fromConfig) {
      if (d) domains.add(d);
    }
  }
  return [...domains];
}

export type DidClientKeyResult = {
  client_key: string;
  allowed_domains: string[];
};

export async function createDidClientKey(
  ctx: AvatarSessionContext,
  allowedDomains?: string[]
): Promise<DidClientKeyResult> {
  const apiKey = requireDidApiKey(ctx);
  const domains = resolveDidAllowedDomains(
    allowedDomains ??
      (Array.isArray(ctx.config.allowed_domains)
        ? (ctx.config.allowed_domains as string[])
        : null)
  );

  const res = await avatarProviderFetch(`${DID_API_BASE}/agents/client-key`, {
    provider: "did",
    method: "POST",
    headers: didAuthHeaders(apiKey),
    body: JSON.stringify({ allowed_domains: domains }),
  });
  const data = await parseJsonOrThrow(res, "did");
  const clientKey = String(data.client_key ?? "");
  if (!clientKey) {
    throw new AvatarProviderError(
      "PROVIDER_API_ERROR",
      "D-ID did not return a client_key.",
      { provider: "did" }
    );
  }
  return { client_key: clientKey, allowed_domains: domains };
}

export type DidStreamResult = {
  streamId: string;
  sessionId: string | null;
  offer: Record<string, unknown> | null;
  iceServers: unknown;
  metadata: Record<string, unknown>;
};

export async function createDidAgentStream(
  ctx: AvatarSessionContext,
  options?: { fluent?: boolean; sessionTimeout?: number }
): Promise<DidStreamResult> {
  const apiKey = requireDidApiKey(ctx);
  const agentId = resolveDidAgentId(ctx);

  const res = await avatarProviderFetch(
    `${DID_API_BASE}/agents/${encodeURIComponent(agentId)}/streams`,
    {
      provider: "did",
      method: "POST",
      headers: didAuthHeaders(apiKey),
      body: JSON.stringify({
        fluent: options?.fluent ?? true,
        session_timeout: options?.sessionTimeout ?? 120,
        compatibility_mode: "auto",
      }),
    }
  );
  const data = await parseJsonOrThrow(res, "did");
  const streamId = String(data.id ?? data.stream_id ?? "");
  if (!streamId) {
    throw new AvatarProviderError(
      "PROVIDER_API_ERROR",
      "D-ID stream creation did not return a stream id.",
      { provider: "did" }
    );
  }
  return {
    streamId,
    sessionId:
      (typeof data.session_id === "string" && data.session_id) ||
      (typeof data.chat_id === "string" && data.chat_id) ||
      null,
    offer:
      typeof data.offer === "object" && data.offer
        ? (data.offer as Record<string, unknown>)
        : null,
    iceServers: data.ice_servers ?? data.iceServers ?? null,
    metadata: data,
  };
}

export async function sendDidAgentChatMessage(
  ctx: AvatarSessionContext,
  streamId: string,
  text: string,
  role: "assistant" | "user" = "assistant"
): Promise<void> {
  const apiKey = requireDidApiKey(ctx);
  const agentId = resolveDidAgentId(ctx);

  const res = await avatarProviderFetch(
    `${DID_API_BASE}/agents/${encodeURIComponent(agentId)}/chat`,
    {
      provider: "did",
      method: "POST",
      headers: didAuthHeaders(apiKey),
      body: JSON.stringify({
        streamId,
        session_id: ctx.demoSessionId,
        messages: [{ role, content: text, type: "text" }],
      }),
    }
  );
  await parseJsonOrThrow(res, "did");
}

export async function sendDidStreamScript(
  ctx: AvatarSessionContext,
  streamId: string,
  text: string
): Promise<void> {
  const apiKey = requireDidApiKey(ctx);
  const res = await avatarProviderFetch(
    `${DID_API_BASE}/talks/streams/${encodeURIComponent(streamId)}`,
    {
      provider: "did",
      method: "POST",
      headers: didAuthHeaders(apiKey),
      body: JSON.stringify({
        script: {
          type: "text",
          input: text,
          provider: ctx.agent.avatar_voice_id
            ? { type: "elevenlabs", voice_id: ctx.agent.avatar_voice_id }
            : undefined,
        },
        session_id: ctx.demoSessionId,
      }),
    }
  );
  await parseJsonOrThrow(res, "did");
}

export async function deleteDidStream(
  ctx: AvatarSessionContext,
  streamId: string
): Promise<void> {
  const apiKey = requireDidApiKey(ctx);
  try {
    await avatarProviderFetch(
      `${DID_API_BASE}/talks/streams/${encodeURIComponent(streamId)}`,
      {
        provider: "did",
        method: "DELETE",
        headers: didAuthHeaders(apiKey),
      }
    );
  } catch {
    /* best effort */
  }
}

export async function getDidAgent(
  ctx: AvatarSessionContext
): Promise<Record<string, unknown>> {
  const apiKey = requireDidApiKey(ctx);
  const agentId = resolveDidAgentId(ctx);
  const res = await avatarProviderFetch(
    `${DID_API_BASE}/agents/${encodeURIComponent(agentId)}`,
    {
      provider: "did",
      method: "GET",
      headers: didAuthHeaders(apiKey),
    }
  );
  return parseJsonOrThrow(res, "did");
}

export function mapDidWebhookEvent(body: Record<string, unknown>): {
  eventType: string;
  demoSessionId: string | null;
  streamId: string | null;
  status?: string;
  payload: Record<string, unknown>;
} {
  const payload = body;
  const demoSessionId =
    (typeof payload.session_id === "string" && payload.session_id) ||
    (typeof payload.properties === "object" &&
      payload.properties &&
      typeof (payload.properties as Record<string, unknown>).demo_session_id ===
        "string" &&
      ((payload.properties as Record<string, unknown>).demo_session_id as string)) ||
    null;
  const streamId =
    (typeof payload.stream_id === "string" && payload.stream_id) ||
    (typeof payload.streamId === "string" && payload.streamId) ||
    null;
  const eventType = String(payload.event ?? payload.type ?? payload.status ?? "did_webhook");
  let status: string | undefined;
  const et = eventType.toLowerCase();
  if (et.includes("fail") || et.includes("error")) status = "failed";
  else if (et.includes("stop") || et.includes("end") || et.includes("disconnect")) {
    status = "stopped";
  } else if (et.includes("speak")) status = "speaking";
  else if (et.includes("connect") || et.includes("ready") || et.includes("active")) {
    status = "active";
  }
  return { eventType, demoSessionId, streamId, status, payload };
}
