import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { loginUrl } from "@/lib/auth/login-url";
import { jsonStore } from "./json-store";
import { seedPlatformData } from "./seed";
import type { Organization, Profile, SessionContext } from "./types";

const DEMO_USER_ID = "demo-user-0001";
const DEMO_EMAIL = "admin@digitalreadyghana.com";

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    if (cookieStore.get("platform_demo_auth")?.value !== "1") return null;

    let org = await jsonStore.getOrg();
    if (!org) {
      await seedPlatformData();
      org = await jsonStore.getOrg();
    }
    const profiles = await jsonStore.getProfiles();
    const profile = profiles.find((p) => p.user_id === DEMO_USER_ID) ?? profiles[0];
    if (!org || !profile) return null;

    return {
      userId: DEMO_USER_ID,
      email: DEMO_EMAIL,
      profile,
      organization: org,
    };
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) return null;

    const { data: organization } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();

    if (!organization) return null;

    return {
      userId: user.id,
      email: user.email ?? "",
      profile: profile as Profile,
      organization: organization as Organization,
    };
  }

  return null;
});

export async function requireSession(nextPath = "/dashboard"): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect(loginUrl(nextPath));
  return ctx;
}

export function isDemoAuthMode(): boolean {
  return !isSupabaseConfigured();
}
