import { AvatarProviderError } from "../errors";
import type { AvatarProviderAdapter } from "../provider-interface";
import type { AvatarSessionContext, AvatarSessionResult, AvatarSpeakResult, AvatarStatusResult } from "../types";
import { internalCardAdapter } from "./internal-card";

export const customFutureAdapter: AvatarProviderAdapter = {
  id: "custom_future",

  async createAvatarSession() {
    throw new AvatarProviderError(
      "NOT_CONFIGURED",
      "Custom avatar provider is not available yet.",
      { provider: "custom_future" }
    );
  },

  async startAvatarSession(_ctx, existing) {
    return existing;
  },

  async sendTextToAvatar(): Promise<AvatarSpeakResult> {
    return { ok: false, error: "Not configured" };
  },

  async stopAvatarSession(ctx): Promise<AvatarSessionResult> {
    return internalCardAdapter.stopAvatarSession(ctx, "custom");
  },

  async getAvatarSessionStatus(): Promise<AvatarStatusResult> {
    return { status: "failed", error: "Not configured" };
  },

  async testConnection() {
    return { ok: false, message: "Custom provider integration coming soon." };
  },

  fallbackToInternalPresenter(reason: string) {
    return internalCardAdapter.fallbackToInternalPresenter(reason);
  },
};
