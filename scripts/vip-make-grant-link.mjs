/**
 * Gera um link de desbloqueio VIP (para colar no n8n / WhatsApp após pagamento).
 *
 * Uso:
 *   VIP_UNLOCK_SECRET="seu_segredo" node scripts/vip-make-grant-link.mjs
 *   VIP_UNLOCK_SECRET="seu_segredo" node scripts/vip-make-grant-link.mjs https://perfilcarol.vercel.app
 */
import crypto from "node:crypto";

const secret = String(process.env.VIP_UNLOCK_SECRET || "").trim();
const base = (process.argv[2] || "https://perfilcarol.vercel.app").replace(/\/+$/, "");

if (!secret) {
  console.error("Defina a variável de ambiente VIP_UNLOCK_SECRET.");
  process.exit(1);
}

const ttlMs = Number(process.env.VIP_GRANT_TTL_MS) || 30 * 24 * 60 * 60 * 1000;
const exp = Date.now() + ttlMs;
const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
const token = `${payload}.${sig}`;
const link = `${base}/api/vip/grant?t=${encodeURIComponent(token)}`;

console.log(link);
