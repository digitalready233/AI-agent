import type { AvatarProviderAdapter } from "../provider-interface";
import type { AvatarSessionContext, AvatarSessionResult } from "../types";
import {
  createTavusConversation,
  endTavusConversation,
  getTavusConversation,
  mapTavusConversationResponse,
  mapTavusRemoteStatus,
  mapTavusWebhookEvent,
  requireTavusApiKey,
} from "../tavus-cvi";
import { avatarProviderFetch, parseJsonOrThrow } from "./http-helper";
import { internalCardAdapter } from "./internal-card";
import { TAVUS_API_BASE } from "../tavus-cvi";

export const tavusAdapter: AvatarProviderAdapter = {
  id: "tavus",

  async createAvatarSession(ctx) {
    const created = await createTavusConversation({ ctx });
    return {
      sessionId: created.sessionId,
      provider: "tavus",
      status: created.status,
      streamUrl: created.streamUrl,
      joinUrl: created.joinUrl,
      metadata: created.metadata,
    };
  },

  async startAvatarSession(_ctx, existing) {
    return { ...existing, status: "active" };
  },

  async sendTextToAvatar(ctx, sessionId, text) {
    requireTavusApiKey(ctx);
    const apiKey = ctx.credentials.apiKey!.trim();
    const res = await avatarProviderFetch(
      `${TAVUS_API_BASE}/conversations/${encodeURIComponent(sessionId)}/respond`,
      {
        provider: "tavus",
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, mode: "text" }),
      }
    ).catch(() =>
      avatarProviderFetch(
        `${TAVUS_API_BASE}/conversations/${encodeURIComponent(sessionId)}/messages`,
        {
          provider: "tavus",
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: text, role: "assistant" }),
        }
      )
    );
    await parseJsonOrThrow(res, "tavus");
    return { ok: true, status: "speaking" };
  },

  async stopAvatarSession(ctx, sessionId) {
    await endTavusConversation(ctx, sessionId);
    return {
      sessionId,
      provider: "tavus",
      status: "stopped",
    };
  },

  async getAvatarSessionStatus(ctx, sessionId) {
    const data = await getTavusConversation(ctx, sessionId);
    const mapped = mapTavusConversationResponse(data);
    return {
      status: mapped.status,
      providerSessionId: sessionId,
      streamUrl: mapped.streamUrl,
      raw: data,
    };
  },

  async handleAvatarWebhook(_provider, body) {
    const payload = (body ?? {}) as Record<string, unknown>;
    const mapped = mapTavusWebhookEvent(payload);
    return {
      eventType: mapped.eventType,
      demoSessionId: mapped.demoSessionId,
      status: mapped.status,
      payload: mapped.payload,
    };
  },

  async testConnection(ctx) {
    try {
      requireTavusApiKey(ctx);
      const res = await avatarProviderFetch(`${TAVUS_API_BASE}/replicas`, {
        provider: "tavus",
        method: "GET",
        headers: { "x-api-key": ctx.credentials.apiKey! },
      });
      await parseJsonOrThrow(res, "tavus");
      return { ok: true, message: "Tavus API key accepted." };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Tavus connection failed",
      };
    }
  },

  fallbackToInternalPresenter(reason: string): AvatarSessionResult {
    return internalCardAdapter.fallbackToInternalPresenter(reason);
  },
};
