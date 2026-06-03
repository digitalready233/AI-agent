import { getAnalyticsSummary } from "@/lib/analytics";

export async function GET(req: Request) {
  const secret = process.env.ADMIN_API_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return Response.json(getAnalyticsSummary());
}
