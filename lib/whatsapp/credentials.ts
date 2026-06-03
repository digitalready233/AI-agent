import { whatsapp as envWhatsapp } from "@/lib/config";
import {
  getOrganizationSecret,
  hasOrganizationSecret,
} from "@/lib/platform/settings-data";
import type { WhatsAppCredentials } from "./types";

const PREFIX = "integration:whatsapp";

export const WHATSAPP_SECRET_KEYS = {
  accessToken: `${PREFIX}:access_token`,
  verifyToken: `${PREFIX}:verify_token`,
} as const;

export async function getWhatsAppAccessToken(
  organizationId: string
): Promise<string | null> {
  const fromSecret = await getOrganizationSecret(
    organizationId,
    WHATSAPP_SECRET_KEYS.accessToken
  );
  if (fromSecret?.trim()) return fromSecret.trim();
  return envWhatsapp.accessToken?.trim() ?? null;
}

export async function getWhatsAppVerifyToken(
  organizationId: string
): Promise<string | null> {
  const fromSecret = await getOrganizationSecret(
    organizationId,
    WHATSAPP_SECRET_KEYS.verifyToken
  );
  if (fromSecret?.trim()) return fromSecret.trim();
  return envWhatsapp.verifyToken?.trim() ?? null;
}

export async function hasWhatsAppAccessToken(
  organizationId: string
): Promise<boolean> {
  if (await hasOrganizationSecret(organizationId, WHATSAPP_SECRET_KEYS.accessToken)) {
    return true;
  }
  return Boolean(envWhatsapp.accessToken?.trim());
}

export async function resolveWhatsAppCredentials(params: {
  organizationId: string;
  phoneNumberId: string;
  wabaId?: string | null;
}): Promise<WhatsAppCredentials | null> {
  const accessToken = await getWhatsAppAccessToken(params.organizationId);
  if (!accessToken) return null;
  return {
    organizationId: params.organizationId,
    accessToken,
    phoneNumberId: params.phoneNumberId,
    wabaId: params.wabaId ?? null,
  };
}
