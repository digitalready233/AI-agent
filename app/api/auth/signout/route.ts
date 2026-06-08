import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSessionActivityCookie } from "@/lib/auth/session-inactivity-server";
import { getSupabaseAnonKey, isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST() {
  const cookieStore = await cookies();
  let response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getSupabaseAnonKey(),
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );
    await supabase.auth.signOut();
  }

  response.cookies.set("platform_demo_auth", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("digisales_auth", "", { path: "/", maxAge: 0 });
  return clearSessionActivityCookie(response);
}
