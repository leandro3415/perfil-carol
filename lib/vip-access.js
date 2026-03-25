import crypto from "node:crypto";
import { parseCookie, cookieFlags } from "./session.js";

export const VIP_COOKIE_NAME = "pc_vip";

export function getVipSecret() {
  return String(process.env.VIP_UNLOCK_SECRET || "").trim();
}

export function signVipPass(ttlMs = 30 * 24 * 60 * 60 * 1000) {
  const s = getVipSecret();
  if (!s) throw new Error("VIP_UNLOCK_SECRET obrigatório");
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", s).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyVipPass(token) {
  const s = getVipSecret();
  if (!s || !token || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = crypto.createHmac("sha256", s).update(payload).digest("base64url");
  const a = Buffer.from(expect, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return false;
  try {
    if (!crypto.timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof exp !== "number" || exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function setVipPassCookie(res, token, maxAgeSec) {
  const { secure, sameSite, path, httpOnly } = cookieFlags();
  const parts = [
    `${VIP_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSec}`,
    `SameSite=${sameSite}`,
  ];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  const line = parts.join("; ");
  if (typeof res.appendHeader === "function") {
    res.appendHeader("Set-Cookie", line);
  } else {
    res.setHeader("Set-Cookie", line);
  }
}

export function isVipUnlockedFromCookieHeader(cookieHeader) {
  const raw = parseCookie(cookieHeader || "", VIP_COOKIE_NAME);
  return Boolean(raw && verifyVipPass(raw));
}
