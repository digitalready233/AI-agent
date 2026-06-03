import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      new URL("/auth/login?error=supabase_not_configured", origin)
    );
  }

  if (errorParam) {
    const login = new URL("/auth/login", origin);
    login.searchParams.set("error", String(errorParam).slice(0, 200));
    return NextResponse.redirect(login);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_code", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const login = new URL("/auth/login", origin);
    login.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(login);
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return NextResponse.redirect(new URL(safeNext, origin));
}
