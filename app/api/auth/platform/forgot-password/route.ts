import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRecaptchaToken } from "@/lib/auth/recaptcha";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().email(),
  recaptchaToken: z.string().optional(),
  /** Browser origin, e.g. http://localhost:3000 */
  origin: z.string().url().optional(),
});

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Password reset requires Supabase Auth." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const captcha = await verifyRecaptchaToken(parsed.data.recaptchaToken, "password_reset");
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  const origin =
    parsed.data.origin?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    new URL(req.url).origin;

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  if (error) {
    console.error("[forgot-password]", error.message);
    // Do not reveal whether the email exists
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, we sent a link to reset your password. Check your inbox and spam folder.",
  });
}
