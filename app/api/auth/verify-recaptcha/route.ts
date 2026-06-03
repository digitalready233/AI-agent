import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRecaptchaToken, type RecaptchaAction } from "@/lib/auth/recaptcha";

const bodySchema = z.object({
  token: z.string().optional(),
  action: z.enum(["login", "register", "password_reset", "google_oauth"]),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await verifyRecaptchaToken(
    parsed.data.token,
    parsed.data.action as RecaptchaAction
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, score: result.score });
}
