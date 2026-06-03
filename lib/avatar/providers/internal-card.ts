import type { AvatarProviderAdapter } from "../provider-interface";
import type {
  AvatarSessionContext,
  AvatarSessionResult,
  AvatarSpeakResult,
  AvatarStatusResult,
} from "../types";

function baseResult(ctx: AvatarSessionContext, status: AvatarSessionResult["status"]): AvatarSessionResult {
  return {
    sessionId: `internal-${ctx.demoSessionId}`,
    provider: "internal_card",
    status,
    streamUrl: null,
    joinUrl: null,
    metadata: { mode: "animated_card" },
  };
}

export const internalCardAdapter: AvatarProviderAdapter = {
  id: "internal_card",

  async createAvatarSession(ctx) {
    return baseResult(ctx, "active");
  },

  async startAvatarSession(ctx, existing) {
    return { ...existing, status: "active" };
  },

  async sendTextToAvatar() {
    return { ok: true, status: "speaking" };
  },

  async stopAvatarSession(ctx) {
    return baseResult(ctx, "stopped");
  },

  async getAvatarSessionStatus(ctx) {
    return { status: "active", providerSessionId: `internal-${ctx.demoSessionId}` };
  },

  async testConnection() {
    return { ok: true, message: "Internal animated presenter is always available." };
  },

  fallbackToInternalPresenter(reason: string) {
    return {
      sessionId: "internal-fallback",
      provider: "internal_card",
      status: "fallback_active",
      error: reason,
      metadata: { fallback: true },
    };
  },
};
