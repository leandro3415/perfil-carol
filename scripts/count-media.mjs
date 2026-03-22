import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const VIP = path.join(ROOT, "vip");

/** Se true, soma também os arquivos da pasta "Feed teaser" em "mídias". */
const MIDIAS_INCLUI_FEED_TEASER = true;

function countFilesInDir(relDir) {
  const dir = path.join(VIP, relDir);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((name) => {
    if (name === ".gitkeep" || name.startsWith(".")) return false;
    const full = path.join(dir, name);
    try {
      return fs.statSync(full).isFile();
    } catch {
      return false;
    }
  }).length;
}

export function getStats() {
  const postagens = countFilesInDir("Postagens");
  let midias = countFilesInDir("Midias");
  if (MIDIAS_INCLUI_FEED_TEASER) {
    midias += countFilesInDir("Feed teaser");
  }
  return {
    postagens,
    midias,
    updatedAt: new Date().toISOString(),
  };
}
