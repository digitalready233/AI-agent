import { getAnalyticsSummary } from "@/lib/analytics";
import { checkAdminApiAuth } from "@/lib/security/admin-auth";

export async function GET(req: Request) {
  if (!checkAdminApiAuth(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(getAnalyticsSummary());
}
