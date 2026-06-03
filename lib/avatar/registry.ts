import type { AvatarProviderAdapter } from "./provider-interface";
import type { AvatarProviderId } from "./types";
import { internalCardAdapter } from "./providers/internal-card";
import { tavusAdapter } from "./providers/tavus";
import { didAdapter } from "./providers/did";
import { heygenAdapter } from "./providers/heygen";
import { customFutureAdapter } from "./providers/custom-future";

const ADAPTERS: Record<AvatarProviderId, AvatarProviderAdapter> = {
  internal_card: internalCardAdapter,
  tavus: tavusAdapter,
  did: didAdapter,
  heygen: heygenAdapter,
  custom_future: customFutureAdapter,
};

export function getAvatarProvider(provider: string): AvatarProviderAdapter {
  const id = provider as AvatarProviderId;
  return ADAPTERS[id] ?? internalCardAdapter;
}

export function isExternalAvatarProvider(provider: string | null | undefined): boolean {
  return Boolean(provider && provider !== "internal_card");
}
