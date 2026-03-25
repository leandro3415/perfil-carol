import crypto from "node:crypto";

export const COOKIE_NAME = "pc_admin";

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
  if (!s) throw new Error("Defina ADMIN_SESSION_SECRET ou ADMIN_PASSWORD nas variáveis de ambiente");
  return s;
}

/**
 * Cookie assinado (HMAC), sem armazenamento no servidor — compatível com serverless.
 */
export function signSession(ttlMs = 7 * 24 * 60 * 60 * 1000) {
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token) {
  if (!token || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
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

export function parseCookie(header, name) {
  if (!header) return null;
  const parts = header.split(";");
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) continue;
    const k = p.slice(0, i).trim();
    if (k !== name) continue;
    return decodeURIComponent(p.slice(i + 1).trim());
  }
  return null;
}

export function cookieFlags() {
  const secure =
    process.env.VERCEL === "1" ||
    process.env.FORCE_SECURE_COOKIE === "1" ||
    process.env.NODE_ENV === "production";
  return { secure, sameSite: "Lax", path: "/", httpOnly: true };
}

export function setSessionCookie(res, token, maxAgeSec) {
  const { secure, sameSite, path, httpOnly } = cookieFlags();
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSec}`,
    `SameSite=${sameSite}`,
  ];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res) {
  const { secure, sameSite, path, httpOnly } = cookieFlags();
  const parts = [`${COOKIE_NAME}=`, `Path=${path}`, "Max-Age=0", `SameSite=${sameSite}`];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}
