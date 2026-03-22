import { clearSessionCookie } from "../../lib/session.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
