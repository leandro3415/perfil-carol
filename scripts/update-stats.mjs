import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStats } from "./count-media.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const VIP = path.join(ROOT, "vip");

const stats = getStats();
fs.writeFileSync(path.join(VIP, "media-stats.json"), JSON.stringify(stats, null, 2), "utf8");

let html = fs.readFileSync(path.join(VIP, "index.html"), "utf8");
html = html.replace(
  /(<div class="stat__value" id="stat-postagens">)\s*[\d\s]*\s*(<\/div>)/,
  `$1${stats.postagens}$2`
);
html = html.replace(
  /(<div class="stat__value" id="stat-midias">)\s*[\d\s]*\s*(<\/div>)/,
  `$1${stats.midias}$2`
);
fs.writeFileSync(path.join(VIP, "index.html"), html, "utf8");

console.log("Atualizado:", stats);
console.log("  vip/media-stats.json");
console.log("  vip/index.html (números nas estatísticas)");
