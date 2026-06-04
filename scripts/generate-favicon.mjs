/**
 * One-off: writes public/favicon.ico (16px PNG-in-ICO browsers accept) from brand SVG.
 * Run: node scripts/generate-favicon.mjs
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="9" fill="#141418" stroke="rgba(201,169,110,0.45)" stroke-width="1"/>
  <rect x="11" y="11" width="10" height="10" rx="2" fill="#c9a96e"/>
</svg>`;

const png = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
writeFileSync(join(root, "public", "favicon.ico"), png);
console.log("Wrote public/favicon.ico");
