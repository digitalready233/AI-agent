import { RegisterForm } from "@/components/platform/auth/register-form";
import Link from "next/link";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <div className="w-full max-w-[420px] space-y-10">
      <div className="space-y-3 text-center lg:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
          Create your account
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Start building your AI sales workspace in minutes.
        </p>
      </div>
      <Suspense
        fallback={<div className="platform-card h-96 animate-pulse rounded-2xl" aria-hidden />}
      >
        <RegisterForm />
      </Suspense>
      <p className="text-center text-sm text-slate-500 lg:text-left">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-cyan-400/90 hover:text-cyan-300 transition-colors no-underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
