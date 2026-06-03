import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/platform/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-[420px] space-y-10">
      <div className="space-y-3 text-center lg:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
          Choose a new password
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Enter a new password for your account, then sign in again.
        </p>
      </div>

      <Suspense
        fallback={<div className="platform-card h-48 animate-pulse rounded-2xl" aria-hidden />}
      >
        <ResetPasswordForm />
      </Suspense>

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
