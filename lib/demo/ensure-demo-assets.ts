import { listDemoAssets } from "./demo-data";
import { listDemoPaths } from "./demo-paths-data";
import { seedDefaultDemoAssetsForAgent } from "./seed-default-assets";

/** Ensures legacy global demo slides exist only when no path-linked assets are present. */
export async function ensureDemoAssetsForAgent(params: {
  organizationId: string;
  agentId: string;
}): Promise<{ hadAssets: boolean; seeded: number }> {
  const existing = await listDemoAssets(params.organizationId, params.agentId);
  const pathLinked = existing.some((a) => a.demo_path_id);
  if (pathLinked || existing.length > 0) {
    return { hadAssets: true, seeded: 0 };
  }
  const paths = await listDemoPaths(params.organizationId, params.agentId);
  if (paths.length > 0) {
    return { hadAssets: true, seeded: 0 };
  }
  const result = await seedDefaultDemoAssetsForAgent({
    organizationId: params.organizationId,
    agentId: params.agentId,
  });
  return { hadAssets: false, seeded: result.created };
}
