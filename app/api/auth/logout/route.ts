import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("digisales_auth", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set("digisales_email", "", { path: "/", maxAge: 0 });
  return res;
}
