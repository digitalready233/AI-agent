import {
  getOrganizationSecret,
  getMaskedOrganizationSecret,
  hasOrganizationSecret,
  setOrganizationSecret,
} from "@/lib/platform/settings-data";
import type { AvatarProviderCredentials, AvatarProviderId } from "./types";

export function avatarSecretKey(provider: string, field = "api_key"): string {
  return `avatar:${provider}:${field}`;
}

const ENV_KEYS: Record<string, { apiKey?: string; avatar?: string; voice?: string; persona?: string; replica?: string }> = {
  tavus: {
    apiKey: "TAVUS_API_KEY",
    persona: "TAVUS_DEFAULT_PERSONA_ID",
    replica: "TAVUS_DEFAULT_REPLICA_ID",
  },
  did: {
    apiKey: "DID_API_KEY",
    avatar: "DID_DEFAULT_AGENT_ID",
    voice: "DID_DEFAULT_VOICE_ID",
  },
  heygen: {
    apiKey: "HEYGEN_API_KEY",
    avatar: "HEYGEN_DEFAULT_AVATAR_ID",
    voice: "HEYGEN_DEFAULT_VOICE_ID",
  },
};

export async function loadAvatarProviderCredentials(
  organizationId: string,
  provider: AvatarProviderId | string,
  integrationDefaults?: {
    default_avatar_id?: string | null;
    default_voice_id?: string | null;
    config?: Record<string, unknown>;
  }
): Promise<AvatarProviderCredentials> {
  if (provider === "internal_card" || provider === "custom_future") {
    return {};
  }

  const env = ENV_KEYS[provider] ?? {};
  let apiKey: string | null = null;
  const secretKey = avatarSecretKey(provider);
  if (await hasOrganizationSecret(organizationId, secretKey)) {
    apiKey = await getOrganizationSecret(organizationId, secretKey);
  } else if (env.apiKey && process.env[env.apiKey]?.trim()) {
    apiKey = process.env[env.apiKey]!.trim();
  }

  const cfg = integrationDefaults?.config ?? {};
  return {
    apiKey,
    defaultAvatarId:
      integrationDefaults?.default_avatar_id ??
      (typeof cfg.default_avatar_id === "string" ? cfg.default_avatar_id : null) ??
      (env.avatar ? process.env[env.avatar]?.trim() : null) ??
      null,
    defaultVoiceId:
      integrationDefaults?.default_voice_id ??
      (typeof cfg.default_voice_id === "string" ? cfg.default_voice_id : null) ??
      (env.voice ? process.env[env.voice]?.trim() : null) ??
      null,
    defaultPersonaId:
      (typeof cfg.default_persona_id === "string" ? cfg.default_persona_id : null) ??
      (env.persona ? process.env[env.persona]?.trim() : null) ??
      null,
    defaultReplicaId:
      (typeof cfg.default_replica_id === "string" ? cfg.default_replica_id : null) ??
      (env.replica ? process.env[env.replica]?.trim() : null) ??
      null,
  };
}

export async function saveAvatarProviderApiKey(
  organizationId: string,
  provider: string,
  apiKey: string
): Promise<void> {
  await setOrganizationSecret(organizationId, avatarSecretKey(provider), apiKey.trim());
}

export async function getMaskedAvatarApiKey(
  organizationId: string,
  provider: string
): Promise<string | null> {
  return getMaskedOrganizationSecret(organizationId, avatarSecretKey(provider));
}

export async function hasAvatarProviderApiKey(
  organizationId: string,
  provider: string
): Promise<boolean> {
  if (await hasOrganizationSecret(organizationId, avatarSecretKey(provider))) return true;
  const env = ENV_KEYS[provider];
  return Boolean(env?.apiKey && process.env[env.apiKey]?.trim());
}
