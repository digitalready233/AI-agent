import { listDemoAssets, saveDemoAsset } from "./demo-data";
import { listDemoPaths, saveDemoPath } from "./demo-paths-data";
import { PATH_SLIDE_SPECS } from "./path-asset-specs";
import { buildDefaultSlideBrandingForSpec } from "./slide-branding";
import type { DemoAsset, DemoPath } from "./types";

/** Creates path-scoped demo assets and syncs each path's demo_asset_sequence. */
export async function seedDefaultPathAssetsForAgent(params: {
  organizationId: string;
  agentId: string;
}): Promise<{ created: number; updatedPaths: number; skipped: number }> {
  const paths = await listDemoPaths(params.organizationId, params.agentId, "all");
  const assets = await listDemoAssets(params.organizationId, params.agentId, {
    includeAllStatuses: true,
  });

  let created = 0;
  let updatedPaths = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const path of paths) {
    const pathKey = (path.path_key ?? "").toLowerCase();
    const slides = PATH_SLIDE_SPECS[pathKey];
    if (!slides?.length) continue;

    const sequence = slides.map((s) => s.title);
    const needsSequenceUpdate =
      JSON.stringify(path.demo_asset_sequence) !== JSON.stringify(sequence);

    for (const slide of slides) {
      const byOrder = assets.find(
        (a) => a.demo_path_id === path.id && a.sort_order === slide.sort_order
      );
      const byTitle = assets.find(
        (a) =>
          a.demo_path_id === path.id &&
          a.title.toLowerCase() === slide.title.toLowerCase()
      );
      const existing = byTitle ?? byOrder;

      if (existing) {
        const needsUpdate =
          existing.title !== slide.title ||
          existing.content !== slide.content ||
          existing.asset_type !== slide.asset_type ||
          existing.sort_order !== slide.sort_order;
        if (needsUpdate) {
          const updated: DemoAsset = {
            ...existing,
            title: slide.title,
            content: slide.content,
            asset_type: slide.asset_type,
            sort_order: slide.sort_order,
            updated_at: now,
          };
          const saved = await saveDemoAsset(updated);
          const idx = assets.findIndex((a) => a.id === existing.id);
          if (idx >= 0) assets[idx] = saved;
        } else {
          skipped++;
        }
        continue;
      }

      const row: DemoAsset = {
        id: crypto.randomUUID(),
        organization_id: params.organizationId,
        demo_path_id: path.id,
        title: slide.title,
        content: slide.content,
        asset_type: slide.asset_type,
        sort_order: slide.sort_order,
        attached_agent_id: params.agentId,
        attached_knowledge_base_id: null,
        status: "active",
        metadata: { seeded: "path_linked_assets", path_key: pathKey },
        created_at: now,
        updated_at: now,
      };
      const saved = await saveDemoAsset(row);
      assets.push(saved);
      created++;
    }

    if (needsSequenceUpdate || !path.metadata?.slide_branding) {
      const specLike = {
        path_key: pathKey,
        title: path.title,
        description: path.description ?? "",
        recommended_cta: path.recommended_cta ?? "Book a consultation",
        demo_asset_sequence: sequence,
      };
      const updated: DemoPath = {
        ...path,
        demo_asset_sequence: sequence,
        metadata: {
          ...(path.metadata ?? {}),
          slide_branding:
            (path.metadata as { slide_branding?: unknown })?.slide_branding ??
            buildDefaultSlideBrandingForSpec(specLike),
        },
        updated_at: now,
      };
      await saveDemoPath(updated);
      updatedPaths++;
    }
  }

  return { created, updatedPaths, skipped };
}
