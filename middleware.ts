import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { LOGIN_PATH, safeNextPath } from "@/lib/auth/login-url";
import { isPublicPlatformApiPath } from "@/lib/auth/public-api-paths";
import {
  clearSessionActivityCookie,
  isSessionIdleExpired,
} from "@/lib/auth/session-inactivity-server";
import { getSupabaseAnonKey, isSupabaseConfigured } from "@/lib/supabase/env";

const AUTH_PREFIXES = ["/auth"];

function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

function isAuthedDemo(request: NextRequest): boolean {
  return request.cookies.get("platform_demo_auth")?.value === "1";
}

function redirectToLogin(request: NextRequest, nextPath: string) {
  const login = new URL(LOGIN_PATH, request.url);
  login.searchParams.set("next", nextPath);
  const response = NextResponse.redirect(login);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

function isProtectedAppPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

function isAgentPasswordGate(): boolean {
  return Boolean(process.env.DIGISALES_ACCESS_PASSWORD?.trim());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseConfigured = isSupabaseConfigured();

  const isPlatform = isProtectedAppPath(pathname);
  const isPlatformApi =
    pathname === "/api/platform" || pathname.startsWith("/api/platform/");
  const isProtectedApi = isPlatformApi && !isPublicPlatformApiPath(pathname);
  const isAuth = AUTH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // Legacy /login → platform sign-in (keep /login only for optional agent password gate).
  if (pathname === "/login") {
    const nextParam = request.nextUrl.searchParams.get("next");
    const wantsAgent = safeNextPath(nextParam, "/agent").startsWith("/agent");
    if (!isAgentPasswordGate() || !wantsAgent) {
      return redirectToLogin(request, safeNextPath(nextParam, "/dashboard"));
    }
  }

  let response = NextResponse.next({ request });

  if (!supabaseConfigured) {
    if (isPlatform || isProtectedApi) {
      if (!isAuthedDemo(request)) {
        return redirectToLogin(request, pathname);
      }
    }
    if (
      isAuth &&
      isAuthedDemo(request) &&
      (pathname === LOGIN_PATH || pathname === "/auth/register")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  } else if (isPlatform || isAuth || isProtectedApi) {
    const supabase = createSupabaseMiddlewareClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && isSessionIdleExpired(request)) {
      await supabase.auth.signOut();
      clearSessionActivityCookie(response);

      if (isPlatform || isProtectedApi) {
        const loginRedirect = redirectToLogin(request, pathname);
        for (const cookie of response.cookies.getAll()) {
          loginRedirect.cookies.set(cookie.name, cookie.value);
        }
        clearSessionActivityCookie(loginRedirect);
        loginRedirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
        return loginRedirect;
      }

      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    if ((isPlatform || isProtectedApi) && !user) {
      return redirectToLogin(request, pathname);
    }

    if (
      isAuth &&
      user &&
      (pathname === LOGIN_PATH || pathname === "/auth/register")
    ) {
      const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
      redirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return redirect;
    }
  }

  if (isAgentPasswordGate() && pathname.startsWith("/agent")) {
    const authed = request.cookies.get("digisales_auth")?.value === "1";
    if (!authed) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/auth/:path*",
    "/api/platform/:path*",
    "/login",
    "/agent",
    "/agent/:path*",
  ],
};
