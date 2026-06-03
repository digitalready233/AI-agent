import { NextResponse } from "next/server";
import {
  exchangeGoogleOAuthCode,
  fetchGoogleUserEmail,
  getGoogleOAuthRedirectUri,
  verifyOAuthState,
} from "@/lib/calendar/google-oauth";
import { getCalendarSettings, saveCalendarSettings } from "@/lib/calendar/calendar-settings-data";
import { storeGoogleOAuthTokens } from "@/lib/calendar/google-tokens";
import { listIntegrations, saveIntegration } from "@/lib/platform/data";
import type { IntegrationStatus } from "@/lib/platform/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = url.origin;
  const settingsPath = `${origin}/dashboard/settings/booking`;

  if (error) {
    return NextResponse.redirect(
      `${settingsPath}?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsPath}?error=missing_code`);
  }

  const payload = verifyOAuthState(state);
  if (!payload) {
    return NextResponse.redirect(`${settingsPath}?error=invalid_state`);
  }

  try {
    const redirectUri = getGoogleOAuthRedirectUri(origin);
    const tokens = await exchangeGoogleOAuthCode({ code, redirectUri });
    const email = await fetchGoogleUserEmail(tokens.access_token);

    await storeGoogleOAuthTokens({
      organizationId: payload.organizationId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
      connectedEmail: email,
    });

    const all = await listIntegrations(payload.organizationId);
    const existing = all.find((i) => i.integration_type === "google_calendar");
    const now = new Date().toISOString();
    const calSettings = await getCalendarSettings(payload.organizationId);
    await saveCalendarSettings({
      ...calSettings,
      connected_calendar_email: email,
    });

    await saveIntegration(
      existing
        ? {
            ...existing,
            status: "connected" as IntegrationStatus,
            config: {
              ...(existing.config ?? {}),
              oauth: true,
              connected_email: email,
            },
            updated_at: now,
          }
        : {
            id: crypto.randomUUID(),
            organization_id: payload.organizationId,
            integration_type: "google_calendar",
            status: "connected",
            config: { oauth: true, connected_email: email },
            created_at: now,
            updated_at: now,
          }
    );

    return NextResponse.redirect(`${settingsPath}?connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      `${settingsPath}?error=${encodeURIComponent(msg)}`
    );
  }
}
