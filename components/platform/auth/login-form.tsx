"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoAuthMode } from "@/lib/auth/demo-mode";
import { isRecaptchaClientEnabled } from "@/lib/auth/recaptcha";
import { useInvisibleRecaptcha } from "@/hooks/use-invisible-recaptcha";
import { GoogleSignInButton } from "@/components/platform/auth/google-sign-in-button";
import { OAuthDivider } from "@/components/platform/auth/oauth-divider";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const demoMode = isDemoAuthMode();
  const { execute: executeRecaptcha } = useInvisibleRecaptcha();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@digitalreadyghana.com", password: "demo1234" },
  });

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      toast.success("Password updated. Sign in with your new password.");
    } else if (authError === "oauth_failed") {
      toast.error("Google sign-in failed. Try again or use email.");
    } else if (authError) {
      toast.error("Sign-in was interrupted. Please try again.");
    }
  }, [authError, searchParams]);

  async function onSubmit(values: FormData) {
    setLoading(true);
    try {
      if (demoMode) {
        const recaptchaToken = await executeRecaptcha("login");
        const res = await fetch("/api/auth/demo-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, recaptchaToken }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Login failed");
        }
      } else {
        const recaptchaToken = await executeRecaptcha("login");
        const res = await fetch("/api/auth/platform/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, recaptchaToken }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Login failed");
        }
      }
      toast.success("Welcome back");
      router.push(next);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="platform-card p-8 sm:p-9 space-y-6">
      {!demoMode && (
        <>
          <GoogleSignInButton />
          <OAuthDivider />
        </>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2.5">
          <Label htmlFor="email" className="text-slate-300">
            Email address
          </Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="password" className="text-slate-300">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
        </div>
        {demoMode && (
          <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3 text-xs leading-relaxed text-slate-400">
            <span className="font-medium text-cyan-300/90">Demo credentials — </span>
            admin@digitalreadyghana.com / demo1234
          </div>
        )}
        {isRecaptchaClientEnabled() && (
          <p className="text-[11px] leading-relaxed text-slate-500">
            Protected by reCAPTCHA. Google{" "}
            <a
              href="https://policies.google.com/privacy"
              className="underline hover:text-slate-400"
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/terms"
              className="underline hover:text-slate-400"
              target="_blank"
              rel="noreferrer"
            >
              Terms
            </a>
            .
          </p>
        )}
        <Button type="submit" className="h-11 w-full rounded-xl text-[15px]" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
