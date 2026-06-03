import type { AvatarProviderAdapter } from "../provider-interface";
import type {
  AvatarSessionContext,
  AvatarSessionResult,
  AvatarSessionStatus,
} from "../types";
import {
  createDidAgentStream,
  createDidClientKey,
  deleteDidStream,
  getDidAgent,
  mapDidWebhookEvent,
  requireDidApiKey,
  resolveDidAgentId,
  sendDidAgentChatMessage,
  sendDidStreamScript,
} from "../did-api";
import { internalCardAdapter } from "./internal-card";

function mapStreamToSession(
  streamId: string,
  data: Record<string, unknown>
): AvatarSessionResult {
  return {
    sessionId: streamId,
    provider: "did",
    status: "active",
    streamUrl: null,
    joinUrl: null,
    metadata: data,
  };
}

export const didAdapter: AvatarProviderAdapter = {
  id: "did",

  async createAvatarSession(ctx) {
    const stream = await createDidAgentStream(ctx);
    return mapStreamToSession(stream.streamId, stream.metadata);
  },

  async startAvatarSession(_ctx, existing) {
    return { ...existing, status: "active" };
  },

  async sendTextToAvatar(ctx, sessionId, text) {
    if (sessionId.startsWith("did-sdk-")) {
      return { ok: true, status: "speaking" };
    }
    try {
      await sendDidAgentChatMessage(ctx, sessionId, text, "assistant");
    } catch {
      await sendDidStreamScript(ctx, sessionId, text);
    }
    return { ok: true, status: "speaking" };
  },

  async sendAudioToAvatar(ctx, sessionId, audioUrl) {
    const apiKey = requireDidApiKey(ctx);
    const { avatarProviderFetch, parseJsonOrThrow } = await import("./http-helper");
    const { DID_API_BASE, didAuthHeaders } = await import("../did-api");
    const res = await avatarProviderFetch(
      `${DID_API_BASE}/talks/streams/${encodeURIComponent(sessionId)}`,
      {
        provider: "did",
        method: "POST",
        headers: didAuthHeaders(apiKey),
        body: JSON.stringify({
          script: { type: "audio", audio_url: audioUrl },
        }),
      }
    );
    await parseJsonOrThrow(res, "did");
    return { ok: true, status: "speaking" };
  },

  async stopAvatarSession(ctx, sessionId) {
    if (!sessionId.startsWith("did-sdk-")) {
      await deleteDidStream(ctx, sessionId);
    }
    return { sessionId, provider: "did", status: "stopped" };
  },

  async getAvatarSessionStatus(ctx, sessionId) {
    let status: AvatarSessionStatus = "active";
    if (sessionId.startsWith("did-sdk-")) {
      return { status, providerSessionId: sessionId, streamUrl: null };
    }
    try {
      await getDidAgent(ctx);
    } catch {
      status = "failed";
    }
    return { status, providerSessionId: sessionId, streamUrl: null };
  },

  async handleAvatarWebhook(_provider, body) {
    const payload = (body ?? {}) as Record<string, unknown>;
    const mapped = mapDidWebhookEvent(payload);
    return {
      eventType: mapped.eventType.startsWith("did_")
        ? mapped.eventType
        : `did_${mapped.eventType}`,
      demoSessionId: mapped.demoSessionId,
      status: mapped.status as AvatarSessionStatus | undefined,
      payload: mapped.payload,
    };
  },

  async createClientKey(ctx, allowedDomains?: string[]) {
    const result = await createDidClientKey(ctx, allowedDomains);
    return {
      clientKey: result.client_key,
      allowedDomains: result.allowed_domains,
    };
  },

  async testConnection(ctx) {
    try {
      requireDidApiKey(ctx);
      resolveDidAgentId(ctx);
      await getDidAgent(ctx);
      return { ok: true, message: "D-ID API key and agent ID validated." };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "D-ID connection failed",
      };
    }
  },

  fallbackToInternalPresenter(reason: string) {
    return internalCardAdapter.fallbackToInternalPresenter(reason);
  },
};
