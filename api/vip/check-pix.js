/**
 * Consulta o status do PIX na Pushin Pay e, se `paid`, grava o cookie VIP (mesmo fluxo do /api/vip/grant).
 *
 * Env (Vercel):
 *   PUSHINPAY_BEARER_TOKEN — mesmo Bearer do n8n
 *   VIP_UNLOCK_SECRET — obrigatório para assinar o cookie
 *   PUSHINPAY_API_BASE — opcional, padrão https://api.pushinpay.com.br/api
 *
 * A documentação pública às vezes cita `/transaction/{id}`; o SDK oficial usa `/transactions/{id}` (plural).
 * Consultamos o plural primeiro; se 404, tentamos o singular.
 *
 * No máximo 1 consulta por minuto por transação na Pushin; o checkout faz polling a ~61s.
 */
import { getVipSecret, signVipPass, setVipPassCookie } from "../../lib/vip-access.js";

function pushinPayBase() {
  return (process.env.PUSHINPAY_API_BASE || "https://api.pushinpay.com.br/api").replace(/\/+$/, "");
}

function bearerToken() {
  return String(process.env.PUSHINPAY_BEARER_TOKEN || "").trim();
}

/** id vindo da criação do PIX (Pushin pode usar UUID, números ou token com |) */
function sanitizeTxId(raw) {
  const s = String(raw || "").trim();
  if (!s || s.length > 160) return null;
  if (!/^[a-zA-Z0-9._|:-]+$/.test(s)) return null;
  return s;
}

/** Normaliza status da consulta GET /transaction/:id (variações de campo e capitalização). */
function transactionPaidStatus(data, depth = 0) {
  if (!data || typeof data !== "object" || depth > 4) return "";
  if (data.paid === true || data.is_paid === true) return "paid";
  const tryKeys = ["status", "payment_status", "state", "transaction_status"];
  for (const k of tryKeys) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }
  const inner = data.data || data.transaction || data.pix;
  if (inner && typeof inner === "object" && inner !== data) {
    return transactionPaidStatus(inner, depth + 1);
  }
  return "";
}

const PAID_ALIASES = new Set(["paid", "pago", "approved", "completed", "confirmado", "confirmed", "success", "succeeded"]);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end(JSON.stringify({ ok: false, error: "Método não permitido" }));
  }

  if (!getVipSecret()) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: "VIP_UNLOCK_SECRET não configurado" }));
  }

  const token = bearerToken();
  if (!token) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: "PUSHINPAY_BEARER_TOKEN não configurado" }));
  }

  const host = req.headers.host || "localhost";
  const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const url = new URL(req.url || "/", `${proto}://${host}`);
  const id = sanitizeTxId(url.searchParams.get("id"));
  if (!id) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "Parâmetro id inválido" }));
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const base = pushinPayBase();
  const paths = [
    `${base}/transactions/${encodeURIComponent(id)}`,
    `${base}/transaction/${encodeURIComponent(id)}`,
  ];

  let r;
  let text = "";
  try {
    for (let i = 0; i < paths.length; i++) {
      r = await fetch(paths[i], { method: "GET", headers });
      text = await r.text();
      if (r.status !== 404 || i === paths.length - 1) break;
    }
  } catch (e) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "Falha ao consultar Pushin Pay" }));
  }
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "Resposta inválida da Pushin Pay" }));
  }

  if (r.status === 404 || (Array.isArray(data) && data.length === 0)) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, unlocked: false, status: "not_found" }));
  }

  if (!r.ok) {
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        ok: false,
        unlocked: false,
        status: "consult_error",
        httpStatus: r.status,
      })
    );
  }

  if (Array.isArray(data) && data.length > 0) {
    data = data[0];
  }

  const st = transactionPaidStatus(data);
  if (PAID_ALIASES.has(st)) {
    let cookieToken;
    try {
      cookieToken = signVipPass();
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    setVipPassCookie(res, cookieToken, 30 * 24 * 60 * 60);
    res.statusCode = 200;
    /* vipPass: alguns browsers ignoram Set-Cookie em resposta a fetch — o cliente grava também via document.cookie */
    return res.end(
      JSON.stringify({ ok: true, unlocked: true, vipPass: cookieToken })
    );
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, unlocked: false, status: st || "unknown" }));
}
