import { signSession, setSessionCookie } from "../../lib/session.js";

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  let data;
  try {
    const raw = await readBody(req);
    data = JSON.parse(raw || "{}");
  } catch {
    return res.status(400).json({ ok: false, error: "JSON inválido" });
  }

  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASSWORD || "";
  if (!pass) {
    return res.status(500).json({ ok: false, error: "ADMIN_PASSWORD não configurada na Vercel" });
  }
  if (data.username !== user || data.password !== pass) {
    return res.status(401).json({ ok: false, error: "Usuário ou senha inválidos" });
  }

  try {
    const token = signSession();
    const maxAge = 7 * 24 * 60 * 60;
    setSessionCookie(res, token, maxAge);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
