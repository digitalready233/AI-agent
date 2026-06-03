import { twilio as envTwilio } from "@/lib/config";
import {
  getOrganizationSecret,
  hasOrganizationSecret,
  setOrganizationSecret,
} from "@/lib/platform/settings-data";

const PREFIX = "integration:voice";

export const VOICE_SECRET_KEYS = {
  authToken: `${PREFIX}:auth_token`,
} as const;

export async function getTwilioAuthToken(
  organizationId: string
): Promise<string | null> {
  const fromSecret = await getOrganizationSecret(
    organizationId,
    VOICE_SECRET_KEYS.authToken
  );
  if (fromSecret?.trim()) return fromSecret.trim();
  return envTwilio.authToken?.trim() ?? null;
}

export async function hasTwilioAuthToken(organizationId: string): Promise<boolean> {
  if (await hasOrganizationSecret(organizationId, VOICE_SECRET_KEYS.authToken)) {
    return true;
  }
  return Boolean(envTwilio.authToken?.trim());
}

export async function saveTwilioAuthToken(
  organizationId: string,
  authToken: string
): Promise<void> {
  await setOrganizationSecret(
    organizationId,
    VOICE_SECRET_KEYS.authToken,
    authToken.trim()
  );
}
