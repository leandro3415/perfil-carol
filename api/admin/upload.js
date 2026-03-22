import path from "node:path";
import busboy from "busboy";
import { Octokit } from "@octokit/rest";
import { COOKIE_NAME, parseCookie, verifySession } from "../../lib/session.js";

const FOLDER_QUERY_MAP = {
  postagens: "Postagens",
  midias: "Midias",
  "feed-teaser": "Feed teaser",
};

const OWNER = process.env.GITHUB_OWNER || "leandro3415";
const REPO = process.env.GITHUB_REPO || "perfil-carol";
const BRANCH = process.env.GITHUB_BRANCH || "main";

function sanitizeName(name) {
  const base = path.basename(name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 160 ? base.slice(-160) : base || "upload.bin";
}

async function putFileInRepo(octokit, repoPath, base64, message) {
  let sha;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: repoPath,
      ref: BRANCH,
    });
    if (data && typeof data === "object" && !Array.isArray(data) && data.sha) sha = data.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  await octokit.rest.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path: repoPath,
    message,
    content: base64,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const token = parseCookie(req.headers.cookie, COOKIE_NAME);
  if (!verifySession(token)) {
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  const gh = process.env.GITHUB_TOKEN;
  if (!gh) {
    return res.status(503).json({
      ok: false,
      error: "GITHUB_TOKEN não configurado — necessário para upload na nuvem.",
    });
  }

  const url = new URL(req.url || "/", "http://localhost");
  const fk = (url.searchParams.get("folder") || "postagens").toLowerCase();
  const dirName = FOLDER_QUERY_MAP[fk] || FOLDER_QUERY_MAP.postagens;

  const ct = req.headers["content-type"] || "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return res.status(400).json({ ok: false, error: "Use multipart/form-data" });
  }

  const octokit = new Octokit({ auth: gh });

  try {
    const result = await new Promise((resolve, reject) => {
      const bb = busboy({
        headers: req.headers,
        limits: { fileSize: 95 * 1024 * 1024 },
      });
      const chunks = [];
      let fname = "upload.bin";
      let sawFile = false;
      let limitErr = null;

      bb.on("file", (fieldname, file, info) => {
        if (fieldname !== "file") {
          file.resume();
          return;
        }
        sawFile = true;
        fname = info.filename || "upload.bin";
        file.on("data", (c) => chunks.push(c));
        file.on("limit", () => {
          limitErr = "Arquivo muito grande";
        });
      });

      bb.on("error", reject);
      bb.on("finish", () => resolve({ chunks, fname, sawFile, limitErr }));
      req.pipe(bb);
    });

    if (result.limitErr) {
      return res.status(400).json({ ok: false, error: result.limitErr });
    }
    if (!result.sawFile || !result.chunks.length) {
      return res.status(400).json({ ok: false, error: 'Envie um arquivo no campo "file"' });
    }

    const safeName = sanitizeName(result.fname);
    const buffer = Buffer.concat(result.chunks);
    const repoPath = `vip/${dirName}/${safeName}`.replace(/\\/g, "/");
    const b64 = buffer.toString("base64");

    await putFileInRepo(
      octokit,
      repoPath,
      b64,
      `chore(vip): upload ${dirName}/${safeName} (admin)`
    );

    const publicPath = `${dirName}/${safeName}`;
    return res.status(200).json({
      ok: true,
      path: publicPath,
      via: "github",
      note: "Aguarde o deploy da Vercel (~1–2 min) para todos verem o arquivo no /vip.",
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: String(e.message || e.status || "Falha no GitHub"),
    });
  }
}
