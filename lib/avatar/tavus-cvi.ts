import { AvatarProviderError } from "./errors";
import type { AvatarSessionContext, AvatarSessionResult } from "./types";
import { avatarProviderFetch, parseJsonOrThrow } from "./providers/http-helper";

export const TAVUS_API_BASE = "https://tavusapi.com/v2";

export function resolvePublicAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim()}`
      : "") ||
    "http://localhost:3000";
  return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw}`;
}

export function tavusWebhookCallbackUrl(): string {
  return `${resolvePublicAppUrl()}/api/avatar/webhook/tavus`;
}

export function resolveTavusIds(ctx: AvatarSessionContext): {
  personaId: string;
  replicaId: string;
} {
  const personaId =
    ctx.agent.avatar_persona_id?.trim() ||
    ctx.credentials.defaultPersonaId?.trim() ||
    null;
  const replicaId =
    ctx.agent.avatar_replica_id?.trim() ||
    ctx.agent.avatar_id?.trim() ||
    ctx.credentials.defaultReplicaId?.trim() ||
    ctx.credentials.defaultAvatarId?.trim() ||
    null;
  if (!personaId || !replicaId) {
    throw new AvatarProviderError(
      "INVALID_CONFIG",
      "Tavus requires persona ID and replica ID on the agent or in integration defaults.",
      { provider: "tavus" }
    );
  }
  return { personaId, replicaId };
}

export function requireTavusApiKey(ctx: AvatarSessionContext): string {
  const key = ctx.credentials.apiKey?.trim();
  if (!key) {
    throw new AvatarProviderError(
      "MISSING_CREDENTIALS",
      "Tavus API key is not configured. Add it in Avatar settings or set TAVUS_API_KEY.",
      { provider: "tavus" }
    );
  }
  return key;
}

export function mapTavusConversationResponse(
  data: Record<string, unknown>
): AvatarSessionResult & {
  conversationId: string;
  conversationUrl: string | null;
  replicaId: string | null;
  personaId: string | null;
} {
  const conversationId = String(data.conversation_id ?? data.id ?? "");
  const conversationUrl =
    (typeof data.conversation_url === "string" && data.conversation_url) || null;
  const streamUrl = conversationUrl;
  const joinUrl = conversationUrl;

  return {
    sessionId: conversationId,
    provider: "tavus",
    status: mapTavusRemoteStatus(String(data.status ?? "active")),
    streamUrl,
    joinUrl,
    metadata: data,
    conversationId,
    conversationUrl,
    replicaId: (typeof data.replica_id === "string" && data.replica_id) || null,
    personaId: (typeof data.persona_id === "string" && data.persona_id) || null,
  };
}

export function mapTavusRemoteStatus(raw: string): AvatarSessionResult["status"] {
  const s = raw.toLowerCase();
  if (s.includes("speak")) return "speaking";
  if (s.includes("listen")) return "listening";
  if (s.includes("start")) return "starting";
  if (s.includes("end") || s.includes("stop") || s === "inactive") return "stopped";
  if (s.includes("fail") || s.includes("error")) return "failed";
  if (s.includes("pause")) return "paused";
  return "active";
}

export type CreateTavusConversationInput = {
  ctx: AvatarSessionContext;
  conversationName?: string;
  conversationalContext?: string;
  customGreeting?: string;
  callbackUrl?: string;
  properties?: Record<string, unknown>;
};

export async function createTavusConversation(
  input: CreateTavusConversationInput
): Promise<ReturnType<typeof mapTavusConversationResponse>> {
  const apiKey = requireTavusApiKey(input.ctx);
  const { personaId, replicaId } = resolveTavusIds(input.ctx);
  const callbackUrl = input.callbackUrl ?? tavusWebhookCallbackUrl();

  const res = await avatarProviderFetch(`${TAVUS_API_BASE}/conversations`, {
    provider: "tavus",
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      persona_id: personaId,
      replica_id: replicaId,
      conversation_name:
        input.conversationName ?? `demo-${input.ctx.demoSessionId}`,
      callback_url: callbackUrl,
      conversational_context: input.conversationalContext,
      custom_greeting: input.customGreeting,
      properties: {
        demo_session_id: input.ctx.demoSessionId,
        organization_id: input.ctx.organizationId,
        agent_id: input.ctx.agent.id,
        ...(input.properties ?? {}),
      },
    }),
  });

  const data = await parseJsonOrThrow(res, "tavus");
  const mapped = mapTavusConversationResponse(data);

  if (!mapped.conversationId) {
    throw new AvatarProviderError(
      "PROVIDER_API_ERROR",
      "Tavus did not return a conversation_id.",
      { provider: "tavus", raw: data }
    );
  }
  if (!mapped.conversationUrl) {
    throw new AvatarProviderError(
      "PROVIDER_API_ERROR",
      "Tavus did not return a conversation_url.",
      { provider: "tavus", raw: data }
    );
  }

  return mapped;
}

export async function getTavusConversation(
  ctx: AvatarSessionContext,
  conversationId: string
): Promise<Record<string, unknown>> {
  const apiKey = requireTavusApiKey(ctx);
  const res = await avatarProviderFetch(
    `${TAVUS_API_BASE}/conversations/${encodeURIComponent(conversationId)}`,
    {
      provider: "tavus",
      method: "GET",
      headers: { "x-api-key": apiKey },
    }
  );
  return parseJsonOrThrow(res, "tavus");
}

export async function endTavusConversation(
  ctx: AvatarSessionContext,
  conversationId: string
): Promise<void> {
  const apiKey = requireTavusApiKey(ctx);
  try {
    const res = await avatarProviderFetch(
      `${TAVUS_API_BASE}/conversations/${encodeURIComponent(conversationId)}/end`,
      {
        provider: "tavus",
        method: "POST",
        headers: { "x-api-key": apiKey },
      }
    );
    await parseJsonOrThrow(res, "tavus");
  } catch {
    const res = await avatarProviderFetch(
      `${TAVUS_API_BASE}/conversations/${encodeURIComponent(conversationId)}`,
      {
        provider: "tavus",
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      }
    );
    await parseJsonOrThrow(res, "tavus");
  }
}

export function mapTavusWebhookEvent(body: Record<string, unknown>): {
  eventType: string;
  conversationId: string | null;
  demoSessionId: string | null;
  status?: AvatarSessionResult["status"];
  payload: Record<string, unknown>;
} {
  const conversationId =
    (typeof body.conversation_id === "string" && body.conversation_id) || null;
  const properties =
    typeof body.properties === "object" && body.properties
      ? (body.properties as Record<string, unknown>)
      : {};
  const demoSessionId =
    (typeof properties.demo_session_id === "string" && properties.demo_session_id) ||
    (typeof body.demo_session_id === "string" && body.demo_session_id) ||
    null;

  const eventType = String(body.event_type ?? body.type ?? "tavus_webhook");
  let status: AvatarSessionResult["status"] | undefined;
  const et = eventType.toLowerCase();
  if (et.includes("end") || et.includes("shutdown") || et.includes("left")) {
    status = "stopped";
  } else if (et.includes("fail") || et.includes("error")) {
    status = "failed";
  } else if (et.includes("speak")) {
    status = "speaking";
  } else if (et.includes("listen") || et.includes("join")) {
    status = "listening";
  } else if (et.includes("active") || et.includes("start")) {
    status = "active";
  }

  return {
    eventType,
    conversationId,
    demoSessionId,
    status,
    payload: body,
  };
}
