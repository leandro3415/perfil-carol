import { Octokit } from "@octokit/rest";
import { COOKIE_NAME, parseCookie, verifySession } from "../../lib/session.js";

const PATH = process.env.SITE_DATA_GITHUB_PATH || "vip/site-data.json";
const OWNER = process.env.GITHUB_OWNER || "leandro3415";
const REPO = process.env.GITHUB_REPO || "perfil-carol";
const BRANCH = process.env.GITHUB_BRANCH || "main";

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ ok: false, error: "Use PUT" });
  }

  const token = parseCookie(req.headers.cookie, COOKIE_NAME);
  let okSession = false;
  try {
    okSession = verifySession(token);
  } catch {
    okSession = false;
  }
  if (!okSession) {
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  const gh = process.env.GITHUB_TOKEN;
  if (!gh) {
    return res.status(503).json({
      ok: false,
      error: "Configure GITHUB_TOKEN na Vercel (escopo repo) para salvar pelo admin.",
    });
  }

  let parsed;
  try {
    const raw = await readBody(req);
    parsed = JSON.parse(raw || "{}");
  } catch {
    return res.status(400).json({ ok: false, error: "JSON inválido" });
  }
  if (typeof parsed.version !== "number") {
    return res.status(400).json({ ok: false, error: "Campo version obrigatório" });
  }

  const content = JSON.stringify(parsed, null, 2);
  const b64 = Buffer.from(content, "utf8").toString("base64");

  const octokit = new Octokit({ auth: gh });

  let sha;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: PATH,
      ref: BRANCH,
    });
    if (data && typeof data === "object" && !Array.isArray(data) && data.sha) {
      sha = data.sha;
    }
  } catch (e) {
    if (e.status !== 404) {
      return res.status(502).json({
        ok: false,
        error: `GitHub: ${e.message || e.status || "erro"}`,
      });
    }
  }

  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: PATH,
      message: "chore: site-data.json (admin)",
      content: b64,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: `GitHub: ${e.message || e.status || "falha ao gravar"}`,
    });
  }

  return res.status(200).json({ ok: true });
}
