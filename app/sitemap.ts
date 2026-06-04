import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

const PUBLIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }[] =
  [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/demo", priority: 0.9, changeFrequency: "weekly" },
    { path: "/live-agent", priority: 0.9, changeFrequency: "weekly" },
    { path: "/privacy", priority: 0.4, changeFrequency: "yearly" },
    { path: "/meet", priority: 0.5, changeFrequency: "monthly" },
    { path: "/chat", priority: 0.6, changeFrequency: "monthly" },
    { path: "/agent", priority: 0.6, changeFrequency: "monthly" },
  ];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();

  return PUBLIC_PATHS.map(({ path, priority, changeFrequency }) => ({
    url: path ? `${base}${path}` : base,
    lastModified,
    changeFrequency,
    priority,
  }));
}
