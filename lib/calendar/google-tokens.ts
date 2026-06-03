import {
  deleteOrganizationSecret,
  getOrganizationSecret,
  setOrganizationSecret,
} from "@/lib/platform/settings-data";
import { refreshGoogleAccessToken } from "./google-oauth";

const PREFIX = "integration:google_calendar";

export const GOOGLE_TOKEN_KEYS = {
  access: `${PREFIX}:oauth_access_token`,
  refresh: `${PREFIX}:oauth_refresh_token`,
  expiry: `${PREFIX}:oauth_token_expiry`,
  email: `${PREFIX}:connected_email`,
} as const;

export async function storeGoogleOAuthTokens(params: {
  organizationId: string;
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
  connectedEmail?: string | null;
}): Promise<void> {
  const expiry = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();
  await setOrganizationSecret(params.organizationId, GOOGLE_TOKEN_KEYS.access, params.accessToken);
  if (params.refreshToken) {
    await setOrganizationSecret(
      params.organizationId,
      GOOGLE_TOKEN_KEYS.refresh,
      params.refreshToken
    );
  }
  await setOrganizationSecret(params.organizationId, GOOGLE_TOKEN_KEYS.expiry, expiry);
  if (params.connectedEmail) {
    await setOrganizationSecret(
      params.organizationId,
      GOOGLE_TOKEN_KEYS.email,
      params.connectedEmail
    );
  }
}

export async function clearGoogleOAuthTokens(organizationId: string): Promise<void> {
  await Promise.all([
    deleteOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.access),
    deleteOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.refresh),
    deleteOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.expiry),
    deleteOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.email),
  ]);
}

export async function getGoogleConnectedEmail(
  organizationId: string
): Promise<string | null> {
  return getOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.email);
}

export async function hasGoogleCalendarOAuth(organizationId: string): Promise<boolean> {
  const refresh = await getOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.refresh);
  const access = await getOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.access);
  return Boolean(refresh || access);
}

export async function getValidGoogleAccessToken(
  organizationId: string
): Promise<string | null> {
  const access = await getOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.access);
  const expiryStr = await getOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.expiry);
  const refresh = await getOrganizationSecret(organizationId, GOOGLE_TOKEN_KEYS.refresh);

  if (!access && !refresh) return null;

  const expiryMs = expiryStr ? new Date(expiryStr).getTime() : 0;
  const stillValid = access && expiryMs > Date.now() + 60_000;

  if (stillValid) return access!;

  if (!refresh) return access;

  try {
    const refreshed = await refreshGoogleAccessToken(refresh);
    await storeGoogleOAuthTokens({
      organizationId,
      accessToken: refreshed.access_token,
      expiresInSeconds: refreshed.expires_in,
    });
    return refreshed.access_token;
  } catch (err) {
    console.error("[google-tokens] refresh failed", err);
    return null;
  }
}
