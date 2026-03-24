import { isVipUnlockedFromCookieHeader } from "../../lib/vip-access.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end(JSON.stringify({ ok: false, error: "Método não permitido" }));
  }

  const unlocked = isVipUnlockedFromCookieHeader(req.headers.cookie);
  res.statusCode = 200;
  return res.end(JSON.stringify({ unlocked: Boolean(unlocked) }));
}
