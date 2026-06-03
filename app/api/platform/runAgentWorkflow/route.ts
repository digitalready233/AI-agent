import { postRunAgentWorkflow } from "@/app/api/platform/workflow/handler";

export async function POST(req: Request) {
  return postRunAgentWorkflow(req);
}
