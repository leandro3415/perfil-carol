import { COOKIE_NAME, parseCookie, verifySession } from "../../lib/session.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false });
  }

  const token = parseCookie(req.headers.cookie, COOKIE_NAME);
  let authenticated = false;
  try {
    authenticated = verifySession(token);
  } catch {
    authenticated = false;
  }
  return res.status(200).json({ authenticated });
}
