import { NextResponse } from "next/server";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import {
  buildGoogleOAuthUrl,
  getGoogleOAuthRedirectUri,
  isGoogleOAuthConfigured,
} from "@/lib/calendar/google-oauth";

export async function GET(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET on the server.",
      },
      { status: 503 }
    );
  }

  const origin = new URL(req.url).origin;
  const url = buildGoogleOAuthUrl({
    organizationId: session.organization.id,
    redirectUri: getGoogleOAuthRedirectUri(origin),
  });

  return NextResponse.redirect(url);
}
