import type {
  AvatarProviderId,
  AvatarSessionContext,
  AvatarSessionResult,
  AvatarSpeakResult,
  AvatarStatusResult,
  AvatarWebhookResult,
} from "./types";

export interface AvatarProviderAdapter {
  readonly id: AvatarProviderId;
  createAvatarSession(ctx: AvatarSessionContext): Promise<AvatarSessionResult>;
  startAvatarSession(
    ctx: AvatarSessionContext,
    existing: AvatarSessionResult
  ): Promise<AvatarSessionResult>;
  sendTextToAvatar(
    ctx: AvatarSessionContext,
    sessionId: string,
    text: string
  ): Promise<AvatarSpeakResult>;
  sendAudioToAvatar?(
    ctx: AvatarSessionContext,
    sessionId: string,
    audioUrl: string
  ): Promise<AvatarSpeakResult>;
  stopAvatarSession(
    ctx: AvatarSessionContext,
    sessionId: string
  ): Promise<AvatarSessionResult>;
  getAvatarSessionStatus(
    ctx: AvatarSessionContext,
    sessionId: string
  ): Promise<AvatarStatusResult>;
  handleAvatarWebhook?(
    provider: AvatarProviderId,
    body: unknown,
    headers: Record<string, string>
  ): Promise<AvatarWebhookResult>;
  testConnection(ctx: AvatarSessionContext): Promise<{ ok: boolean; message: string }>;
  /** D-ID: create domain-restricted client key for frontend SDK */
  createClientKey?(
    ctx: AvatarSessionContext,
    allowedDomains?: string[]
  ): Promise<{ clientKey: string; allowedDomains: string[] }>;
  fallbackToInternalPresenter(reason: string): AvatarSessionResult;
}
