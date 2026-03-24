/**
 * Desbloqueia o feed VIP no navegador (cookie HttpOnly assinado).
 *
 * Variável de ambiente (Vercel / Easypanel):
 *   VIP_UNLOCK_SECRET — mesmo segredo usado para gerar o token no n8n / automação.
 *
 * Uso após pagamento confirmado (ex.: n8n envia link no WhatsApp):
 *   https://SEU_DOMINIO/api/vip/grant?t=PAYLOAD.SIGNATURE
 *   O token é gerado com o mesmo algoritmo que lib/vip-access.js (veja scripts/vip-make-grant-link.mjs).
 *
 * Modo teste (evite em produção — segredo na URL):
 *   /api/vip/grant?key=MESMO_VALOR_DE_VIP_UNLOCK_SECRET
 */
import {
  getVipSecret,
  signVipPass,
  verifyVipPass,
  timingSafeEqualStr,
  setVipPassCookie,
} from "../../lib/vip-access.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Method not allowed");
  }

  const secret = getVipSecret();
  if (!secret) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("VIP_UNLOCK_SECRET não configurado no servidor.");
  }

  const host = req.headers.host || "localhost";
  const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const base = proto && host ? `${proto}://${host}` : "http://localhost";
  const url = new URL(req.url || "/", base);
  const tParam = (url.searchParams.get("t") || url.searchParams.get("token") || "").trim();
  const keyParam = (url.searchParams.get("key") || "").trim();

  let cookieToken = null;
  if (tParam && verifyVipPass(tParam)) {
    cookieToken = tParam;
  } else if (keyParam && timingSafeEqualStr(keyParam, secret)) {
    try {
      cookieToken = signVipPass();
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end(String(e.message || e));
    }
  }

  if (!cookieToken) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      "<!DOCTYPE html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><title>Acesso</title><body><p>Link inválido ou expirado.</p></body></html>"
    );
  }

  const maxAge = 30 * 24 * 60 * 60;
  setVipPassCookie(res, cookieToken, maxAge);

  res.statusCode = 302;
  res.setHeader("Location", "/vip/");
  return res.end();
}
