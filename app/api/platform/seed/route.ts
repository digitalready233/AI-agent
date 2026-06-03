import { NextResponse } from "next/server";
import { seedPlatformData } from "@/lib/platform/seed";

/** POST — seed demo JSON data (dev only). */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }
  await seedPlatformData();
  return NextResponse.json({ ok: true });
}
