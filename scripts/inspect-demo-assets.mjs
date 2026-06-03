import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agent = process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID;
const h = { apikey: key, Authorization: `Bearer ${key}` };

const paths = await fetch(
  `${url}/rest/v1/demo_paths?agent_id=eq.${agent}&select=id,title,path_key,demo_asset_sequence`,
  { headers: h }
).then((r) => r.json());

const assets = await fetch(
  `${url}/rest/v1/demo_assets?attached_agent_id=eq.${agent}&select=id,title,demo_path_id,sort_order&order=sort_order`,
  { headers: h }
).then((r) => r.json());

if (assets.message) {
  console.log("assets error:", assets);
} else {
  console.log("assets total", assets.length, "with demo_path_id", assets.filter((a) => a.demo_path_id).length);
  console.log("sample titles", assets.slice(0, 8).map((a) => `${a.title} path=${a.demo_path_id ?? "null"}`));
}

const social = paths.find((p) => p.path_key === "social_media");
console.log("social sequence", social?.demo_asset_sequence);
if (social) {
  console.log(
    "social linked",
    assets.filter((a) => a.demo_path_id === social.id).map((a) => a.title)
  );
}
