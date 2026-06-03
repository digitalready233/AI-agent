/**
 * Seed demo paths + path-linked slides for platform agent.
 * Run: npx tsx scripts/seed-demo-paths-run.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname ?? ".", "..");
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!process.env[k]) process.env[k] = v;
}

import { getAgent } from "@/lib/platform/data";
import { withPlatformAdmin } from "@/lib/platform/db";
import { seedDefaultDemoPathsForAgent } from "@/lib/demo/seed-default-paths";
import { seedDefaultPathAssetsForAgent } from "@/lib/demo/seed-default-path-assets";

async function main() {
  const agentId = process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID;
  if (!agentId) {
    console.error("Set NEXT_PUBLIC_PLATFORM_AGENT_ID in .env.local");
    process.exit(1);
  }

  await withPlatformAdmin(async () => {
    const agent = await getAgent(agentId);
    if (!agent) {
      console.error("Agent not found:", agentId);
      process.exit(1);
    }

    const paths = await seedDefaultDemoPathsForAgent({
      organizationId: agent.organization_id,
      agentId: agent.id,
    });
    const assets = await seedDefaultPathAssetsForAgent({
      organizationId: agent.organization_id,
      agentId: agent.id,
    });

    console.log("Paths:", paths);
    console.log("Path assets:", assets);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
