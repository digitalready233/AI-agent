import { AvatarProviderError } from "../errors";
import type { AvatarProviderAdapter } from "../provider-interface";
import type { AvatarSessionContext, AvatarSessionResult } from "../types";
import { avatarProviderFetch, parseJsonOrThrow } from "./http-helper";
import { internalCardAdapter } from "./internal-card";

const HEYGEN_API = "https://api.heygen.com/v1";

function requireKey(ctx: AvatarSessionContext) {
  if (!ctx.credentials.apiKey?.trim()) {
    throw new AvatarProviderError(
      "MISSING_CREDENTIALS",
      "HeyGen API key is not configured. Add it in Avatar settings or set HEYGEN_API_KEY.",
      { provider: "heygen" }
    );
  }
}

function avatarAndVoice(ctx: AvatarSessionContext) {
  const avatar =
    ctx.agent.avatar_id?.trim() || ctx.credentials.defaultAvatarId?.trim() || null;
  const voice =
    ctx.agent.avatar_voice_id?.trim() || ctx.credentials.defaultVoiceId?.trim() || null;
  if (!avatar) {
    throw new AvatarProviderError(
      "INVALID_CONFIG",
      "HeyGen requires an avatar ID on the agent or integration defaults.",
      { provider: "heygen" }
    );
  }
  return { avatar, voice };
}

export const heygenAdapter: AvatarProviderAdapter = {
  id: "heygen",

  async createAvatarSession(ctx) {
    requireKey(ctx);
    const { avatar, voice } = avatarAndVoice(ctx);
    const res = await avatarProviderFetch(`${HEYGEN_API}/streaming.new`, {
      provider: "heygen",
      method: "POST",
      headers: {
        "X-Api-Key": ctx.credentials.apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quality: "high",
        avatar_name: avatar,
        voice: voice ? { voice_id: voice } : undefined,
        version: "v2",
      }),
    });
    const data = await parseJsonOrThrow(res, "heygen");
    const inner =
      (typeof data.data === "object" && data.data
        ? (data.data as Record<string, unknown>)
        : data) ?? {};
    const sessionId = String(inner.session_id ?? inner.id ?? "");
    const streamUrl =
      (typeof inner.url === "string" && inner.url) ||
      (typeof inner.rtmp_url === "string" && inner.rtmp_url) ||
      null;
    const joinUrl =
      (typeof inner.access_token === "string" && inner.access_token) || streamUrl;
    return {
      sessionId,
      provider: "heygen",
      status: "active",
      streamUrl,
      joinUrl: typeof joinUrl === "string" ? joinUrl : null,
      metadata: inner,
    };
  },

  async startAvatarSession(_ctx, existing) {
    return { ...existing, status: "active" };
  },

  async sendTextToAvatar(ctx, sessionId, text) {
    requireKey(ctx);
    const res = await avatarProviderFetch(`${HEYGEN_API}/streaming.task`, {
      provider: "heygen",
      method: "POST",
      headers: {
        "X-Api-Key": ctx.credentials.apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        text,
        task_type: "repeat",
      }),
    });
    await parseJsonOrThrow(res, "heygen");
    return { ok: true, status: "speaking" };
  },

  async stopAvatarSession(ctx, sessionId) {
    requireKey(ctx);
    try {
      await avatarProviderFetch(`${HEYGEN_API}/streaming.stop`, {
        provider: "heygen",
        method: "POST",
        headers: {
          "X-Api-Key": ctx.credentials.apiKey!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {
      /* ignore */
    }
    return { sessionId, provider: "heygen", status: "stopped" };
  },

  async getAvatarSessionStatus(ctx, sessionId) {
    requireKey(ctx);
    return { status: "active", providerSessionId: sessionId };
  },

  async handleAvatarWebhook(_provider, body) {
    const payload = (body ?? {}) as Record<string, unknown>;
    return {
      eventType: String(payload.event_type ?? "webhook"),
      demoSessionId:
        typeof payload.session_id === "string" ? payload.session_id : null,
      payload,
    };
  },

  async testConnection(ctx) {
    try {
      requireKey(ctx);
      avatarAndVoice(ctx);
      const res = await avatarProviderFetch(`${HEYGEN_API}/streaming.list`, {
        provider: "heygen",
        method: "GET",
        headers: { "X-Api-Key": ctx.credentials.apiKey! },
      });
      if (res.status === 404) {
        const res2 = await avatarProviderFetch("https://api.heygen.com/v2/user/remaining_quota", {
          provider: "heygen",
          method: "GET",
          headers: { "X-Api-Key": ctx.credentials.apiKey! },
        });
        await parseJsonOrThrow(res2, "heygen");
        return { ok: true, message: "HeyGen API key accepted." };
      }
      await parseJsonOrThrow(res, "heygen");
      return { ok: true, message: "HeyGen API key accepted." };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "HeyGen connection failed",
      };
    }
  },

  fallbackToInternalPresenter(reason: string) {
    return internalCardAdapter.fallbackToInternalPresenter(reason);
  },
};
