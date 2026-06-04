"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  showAuthError,
  showAuthLoading,
  showAuthSuccess,
} from "@/lib/auth/auth-toast";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  fullName: z.string().min(2),
  organizationName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const demoMode = isDemoAuthMode();
  const { execute: executeRecaptcha } = useInvisibleRecaptcha();
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormData) {
    setLoading(true);
    showAuthLoading("Creating your account…");
    try {
      if (demoMode) {
        toast.info("Demo mode: use Sign in with demo credentials.");
        router.push("/auth/login");
        return;
      }

      const recaptchaToken = await executeRecaptcha("register");
      const res = await fetch("/api/auth/platform/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, recaptchaToken }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Registration failed");
      }
      const data = await res.json();
      showAuthSuccess(data.message ?? "Check your email to confirm your account.");
      router.push("/auth/login");
    } catch (e) {
      showAuthError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="platform-card p-8 sm:p-9 space-y-6">
      <GoogleSignInButton label="Sign up with Google" />
      <OAuthDivider />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2.5">
          <Label className="text-slate-300">Full name</Label>
          <Input {...form.register("fullName")} />
        </div>
        <div className="space-y-2.5">
          <Label className="text-slate-300">Company name</Label>
          <Input {...form.register("organizationName")} />
        </div>
        <div className="space-y-2.5">
          <Label className="text-slate-300">Email</Label>
          <Input type="email" autoComplete="email" {...form.register("email")} />
        </div>
        <div className="space-y-2.5">
          <Label className="text-slate-300">Password</Label>
          <Input type="password" autoComplete="new-password" {...form.register("password")} />
        </div>
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
        <Button type="submit" className="h-11 w-full rounded-xl mt-2 gap-2" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </div>
  );
}
