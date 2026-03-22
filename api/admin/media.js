import { Octokit } from "@octokit/rest";
import { COOKIE_NAME, parseCookie, verifySession } from "../../lib/session.js";

const VIP_MEDIA_DIRS = new Set(["Postagens", "Midias", "Feed teaser"]);
const OWNER = process.env.GITHUB_OWNER || "leandro3415";
const REPO = process.env.GITHUB_REPO || "perfil-carol";
const BRANCH = process.env.GITHUB_BRANCH || "main";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ ok: false, error: "Use DELETE" });
  }

  const token = parseCookie(req.headers.cookie, COOKIE_NAME);
  if (!verifySession(token)) {
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  const gh = process.env.GITHUB_TOKEN;
  if (!gh) {
    return res.status(503).json({
      ok: false,
      error: "GITHUB_TOKEN não configurado — necessário para excluir na nuvem.",
    });
  }

  const url = new URL(req.url || "/", "http://localhost");
  const rel = (url.searchParams.get("path") || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = rel.split("/").filter(Boolean);
  if (parts.length < 2 || !VIP_MEDIA_DIRS.has(parts[0])) {
    return res.status(400).json({
      ok: false,
      error: "path inválido (ex.: Postagens/foto.jpg ou Feed teaser/x.mp4)",
    });
  }

  const repoPath = `vip/${parts.join("/")}`;
  const octokit = new Octokit({ auth: gh });

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: repoPath,
      ref: BRANCH,
    });
    if (!data || typeof data !== "object" || Array.isArray(data) || !data.sha) {
      return res.status(404).json({ ok: false, error: "Arquivo não encontrado" });
    }
    await octokit.rest.repos.deleteFile({
      owner: OWNER,
      repo: REPO,
      path: repoPath,
      message: `chore(vip): remove ${parts.join("/")} (admin)`,
      sha: data.sha,
      branch: BRANCH,
    });
    return res.status(200).json({
      ok: true,
      via: "github",
      note: "Aguarde o deploy da Vercel (~1–2 min) para o arquivo sumir para todos no /vip.",
    });
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).json({ ok: false, error: "Arquivo não encontrado" });
    }
    return res.status(502).json({ ok: false, error: String(e.message || e) });
  }
}
