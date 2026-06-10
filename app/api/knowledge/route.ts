import { getKnowledgeBaseStatus } from "@/lib/knowledge";
import { checkAdminApiAuth } from "@/lib/security/admin-auth";

export async function GET(req: Request) {
  if (!checkAdminApiAuth(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getKnowledgeBaseStatus();
  return Response.json(status);
}
