import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRecaptchaToken } from "@/lib/auth/recaptcha";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  fullName: z.string().min(2),
  organizationName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  recaptchaToken: z.string().optional(),
});

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Registration is unavailable." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your registration details." }, { status: 400 });
  }

  const captcha = await verifyRecaptchaToken(parsed.data.recaptchaToken, "register");
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        organization_name: parsed.data.organizationName,
        role: "company_admin",
      },
    },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Registration failed." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Check your email to confirm your account.",
  });
}
