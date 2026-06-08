"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isDemoAuthMode } from "@/lib/auth/demo-mode";
import { isRecaptchaClientEnabled } from "@/lib/auth/recaptcha";
import { useInvisibleRecaptcha } from "@/hooks/use-invisible-recaptcha";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/login-url";
import { showAuthError, showAuthLoading } from "@/lib/auth/auth-toast";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type Props = {
  label?: string;
};

export function GoogleSignInButton({ label = "Continue with Google" }: Props) {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/dashboard");
  const [loading, setLoading] = useState(false);
  const { enabled: recaptchaEnabled, execute } = useInvisibleRecaptcha();
  const demoMode = isDemoAuthMode();

  async function signInWithGoogle() {
    if (demoMode) {
      toast.info("Google sign-in requires Supabase Auth. Configure Supabase in .env.local.");
      return;
    }

    setLoading(true);
    showAuthLoading("Connecting to Google…");
    try {
      if (recaptchaEnabled && isRecaptchaClientEnabled()) {
        const token = await execute("google_oauth");
        const verifyRes = await fetch("/api/auth/verify-recaptcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action: "google_oauth" }),
        });
        if (!verifyRes.ok) {
          const d = await verifyRes.json().catch(() => ({}));
          throw new Error(d.error ?? "Security verification failed.");
        }
      }

      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
      /* OAuth redirect — keep loading toast until navigation */
    } catch (e) {
      showAuthError(e instanceof Error ? e.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full rounded-xl border-slate-700 bg-slate-900/50 text-[15px] text-slate-100 hover:bg-slate-800/80"
      disabled={loading || demoMode}
      onClick={() => void signInWithGoogle()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <GoogleIcon />
      )}
      {loading ? "Redirecting…" : label}
    </Button>
  );
}
