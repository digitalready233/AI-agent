import { postRunAgentWorkflow } from "./handler";

export async function POST(req: Request) {
  return postRunAgentWorkflow(req);
}
