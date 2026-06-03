import { LoginForm } from "@/components/platform/auth/login-form";
import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";

export default function AuthLoginPage() {
  return (
    <div className="w-full max-w-[420px] space-y-10">
      <div className="space-y-4 lg:hidden text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/25">
          <Sparkles className="h-5 w-5 text-slate-950" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400/90">
          DigiSales.ai
        </p>
      </div>

      <div className="space-y-3 text-center lg:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
          Welcome back
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Sign in to manage your agents, leads, and customer conversations.
        </p>
      </div>

      <Suspense
        fallback={<div className="platform-card h-72 animate-pulse rounded-2xl" aria-hidden />}
      >
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-slate-500 lg:text-left">
        <Link
          href="/auth/register"
          className="font-medium text-cyan-400/90 hover:text-cyan-300 transition-colors no-underline"
        >
          Create account
        </Link>
        <span className="mx-3 text-slate-700">·</span>
        <Link
          href="/auth/forgot-password"
          className="font-medium text-cyan-400/90 hover:text-cyan-300 transition-colors no-underline"
        >
          Forgot password
        </Link>
      </p>
    </div>
  );
}
