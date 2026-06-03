import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const configured = process.env.DIGISALES_ACCESS_PASSWORD?.trim() ?? "";

  let body: { email?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
  }

  if (configured) {
    if (!password) {
      return NextResponse.json(
        { error: "Enter your workspace access code." },
        { status: 400 }
      );
    }
    if (!constantTimeMatch(password, configured)) {
      return NextResponse.json({ error: "Invalid email or access code." }, { status: 401 });
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("digisales_auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  res.cookies.set("digisales_email", encodeURIComponent(email), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return res;
}
