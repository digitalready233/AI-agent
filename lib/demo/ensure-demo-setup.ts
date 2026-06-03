import { ensureDemoAssetsForAgent } from "./ensure-demo-assets";
import { seedDefaultDemoPathsForAgent } from "./seed-default-paths";
import { seedDefaultPathAssetsForAgent } from "./seed-default-path-assets";

/** Seeds guided demo paths and path-linked presentation assets for an agent if missing. */
export async function ensureDemoExperienceForAgent(params: {
  organizationId: string;
  agentId: string;
}) {
  const paths = await seedDefaultDemoPathsForAgent(params);
  const pathAssets = await seedDefaultPathAssetsForAgent(params);
  const assets = await ensureDemoAssetsForAgent(params);
  return { assets, paths, pathAssets };
}
