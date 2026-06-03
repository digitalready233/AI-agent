import {
  getOrganizationSecret,
  setOrganizationSecret,
} from "@/lib/platform/settings-data";

const TOKEN_KEY = "integration:calendly:personal_access_token";
const WEBHOOK_SIGNING_KEY = "integration:calendly:webhook_signing_key";

export async function getCalendlyAccessToken(
  organizationId: string
): Promise<string | null> {
  const stored = await getOrganizationSecret(organizationId, TOKEN_KEY);
  if (stored) return stored;
  return process.env.CALENDLY_ACCESS_TOKEN?.trim() || null;
}

export async function setCalendlyAccessToken(
  organizationId: string,
  token: string
): Promise<void> {
  await setOrganizationSecret(organizationId, TOKEN_KEY, token);
}

export async function hasCalendlyAccessToken(
  organizationId: string
): Promise<boolean> {
  return Boolean(await getCalendlyAccessToken(organizationId));
}

export async function getCalendlyWebhookSigningKey(
  organizationId: string
): Promise<string | null> {
  const stored = await getOrganizationSecret(organizationId, WEBHOOK_SIGNING_KEY);
  if (stored) return stored;
  return process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim() || null;
}

export async function setCalendlyWebhookSigningKey(
  organizationId: string,
  key: string
): Promise<void> {
  await setOrganizationSecret(organizationId, WEBHOOK_SIGNING_KEY, key);
}
