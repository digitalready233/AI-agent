import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writePlatformAgentIdToEnv(agentId: string): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;

  const envPath = join(process.cwd(), ".env.local");
  let content = await readFile(envPath, "utf8");
  const line = `NEXT_PUBLIC_PLATFORM_AGENT_ID=${agentId}`;

  if (/^NEXT_PUBLIC_PLATFORM_AGENT_ID=/m.test(content)) {
    if (content.includes(line)) return;
    content = content.replace(/^NEXT_PUBLIC_PLATFORM_AGENT_ID=.*$/m, line);
  } else {
    content = `${content.trimEnd()}\n\n# Default agent for /embed and /agent live chat\n${line}\n`;
  }

  await writeFile(envPath, content, "utf8");
}
