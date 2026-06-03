"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoAuthMode } from "@/lib/auth/demo-mode";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (isDemoAuthMode()) {
      setChecking(false);
      setCanReset(false);
      return;
    }

    const supabase = createClient();

    async function verifySession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCanReset(true);
        setChecking(false);
        return;
      }

      // PKCE: code may still be in the URL if callback was skipped
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setCanReset(true);
          window.history.replaceState({}, "", "/auth/reset-password");
        }
      }
      setChecking(false);
    }

    void verifySession();
  }, []);

  async function onSubmit(values: FormData) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;

      await supabase.auth.signOut();
      toast.success("Password updated. Sign in with your new password.");
      router.push("/auth/login?reset=success");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="platform-card h-48 animate-pulse rounded-2xl" aria-hidden />
    );
  }

  if (isDemoAuthMode()) {
    return (
      <div className="platform-card p-8 text-sm text-slate-400">
        Password reset is not available in demo mode. Use the demo sign-in credentials on the login
        page.
        <p className="mt-4">
          <Link href="/auth/login" className="text-cyan-400 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  if (!canReset) {
    return (
      <div className="platform-card p-8 sm:p-9 space-y-4 text-sm text-slate-400">
        <p>
          This reset link is invalid or has expired. Request a new link from the forgot password
          page.
        </p>
        <Link
          href="/auth/forgot-password"
          className="inline-block font-medium text-cyan-400 hover:underline"
        >
          Send a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="platform-card p-8 sm:p-9">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2.5">
          <Label htmlFor="password" className="text-slate-300">
            New password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="confirmPassword" className="text-slate-300">
            Confirm new password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-xs text-red-400">{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
