import { NextResponse } from "next/server";
import { verifyRecaptchaToken } from "@/lib/auth/recaptcha";
import { seedPlatformData } from "@/lib/platform/seed";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const recaptchaToken =
    typeof body.recaptchaToken === "string" ? body.recaptchaToken : undefined;

  const captcha = await verifyRecaptchaToken(recaptchaToken, "login");
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  const demoEmail = process.env.PLATFORM_DEMO_EMAIL ?? "admin@digitalreadyghana.com";
  const demoPassword = process.env.PLATFORM_DEMO_PASSWORD ?? "demo1234";

  if (email !== demoEmail || password !== demoPassword) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  await seedPlatformData();

  const res = NextResponse.json({ ok: true });
  res.cookies.set("platform_demo_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
