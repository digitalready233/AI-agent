"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoAuthMode } from "@/lib/auth/demo-mode";
import { isRecaptchaClientEnabled } from "@/lib/auth/recaptcha";
import { useInvisibleRecaptcha } from "@/hooks/use-invisible-recaptcha";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const demoMode = isDemoAuthMode();
  const { execute: executeRecaptcha } = useInvisibleRecaptcha();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (demoMode) {
      toast.info("Demo mode has no email reset. Use demo login credentials.");
      return;
    }

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await executeRecaptcha("password_reset");
      const res = await fetch("/api/auth/platform/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          recaptchaToken,
          origin: window.location.origin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send reset email.");
      }
      setSent(true);
      toast.success(data.message ?? "Check your email for a reset link.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] space-y-10">
      <div className="space-y-3 text-center lg:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
          Reset password
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Enter the email you used to sign up. We will send a secure link to choose a new password.
        </p>
      </div>

      <div className="platform-card p-8 sm:p-9">
        {sent ? (
          <div className="space-y-4 text-sm text-slate-300">
            <p>
              If an account exists for <strong className="text-white">{email}</strong>, you will
              receive an email shortly. Open the link in that email to set a new password.
            </p>
            <p className="text-slate-500 text-xs">
              Did not get it? Check spam, or wait a minute and try again.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setSent(false)}
            >
              Send again
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2.5">
              <Label className="text-slate-300">Email address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>
            {isRecaptchaClientEnabled() && (
              <p className="text-[11px] leading-relaxed text-slate-500">
                Protected by reCAPTCHA.
              </p>
            )}
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        )}
      </div>

      <p className="text-center text-sm text-slate-500 lg:text-left">
        <Link
          href="/auth/login"
          className="font-medium text-cyan-400/90 hover:text-cyan-300 transition-colors no-underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
