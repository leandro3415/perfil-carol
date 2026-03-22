import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import busboy from "busboy";
import { getStats } from "./scripts/count-media.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3333;
const SITE_DATA_PATH = path.join(ROOT, "vip", "site-data.json");
const COOKIE_NAME = "pc_admin";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

/** Troque por variáveis de ambiente em produção: ADMIN_USER, ADMIN_PASSWORD */
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "3415787@#";

const sessions = new Map();

const VIP_MEDIA_DIRS = new Set(["Postagens", "Midias", "Feed teaser"]);

const FOLDER_QUERY_MAP = {
  postagens: "Postagens",
  midias: "Midias",
  "feed-teaser": "Feed teaser",
};

function sanitizeUploadFilename(name) {
  const base = path.basename(name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 160 ? base.slice(-160) : base || "upload.bin";
}

function resolveVipMediaPath(rel) {
  const normalized = String(rel || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return null;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 2 || !VIP_MEDIA_DIRS.has(parts[0])) return null;
  const full = path.join(ROOT, "vip", ...parts);
  const resolved = path.resolve(full);
  const vipRoot = path.resolve(path.join(ROOT, "vip"));
  if (!resolved.startsWith(vipRoot + path.sep) && resolved !== vipRoot) return null;
  return resolved;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
};

function safePath(urlPath) {
  const rel = urlPath === "/" || urlPath === "" ? "index.html" : urlPath.replace(/^\//, "");
  if (rel.includes("..") || path.isAbsolute(rel)) return null;
  return path.join(ROOT, rel);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function pruneSessions() {
  const now = Date.now();
  for (const [t, exp] of sessions) {
    if (exp < now) sessions.delete(t);
  }
}

function getSessionToken(req) {
  const c = parseCookies(req.headers.cookie);
  return c[COOKIE_NAME] || null;
}

function isAuthenticated(req) {
  pruneSessions();
  const token = getSessionToken(req);
  if (!token || !sessions.has(token)) return false;
  if (sessions.get(token) < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}

function json(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const method = req.method || "GET";

  if (url.pathname === "/api/admin/login" && method === "POST") {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body || "{}");
      if (data.username === ADMIN_USER && data.password === ADMIN_PASSWORD) {
        const token = createSession();
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Set-Cookie": `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(SESSION_MS / 1000)}; SameSite=Lax`,
        });
        res.end(JSON.stringify({ ok: true }));
      } else {
        json(res, 401, { ok: false, error: "Usuário ou senha inválidos" });
      }
    } catch {
      json(res, 400, { ok: false, error: "JSON inválido" });
    }
    return;
  }

  if (url.pathname === "/api/admin/logout" && method === "POST") {
    const token = getSessionToken(req);
    if (token) sessions.delete(token);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/api/admin/session" && method === "GET") {
    json(res, 200, { authenticated: isAuthenticated(req) });
    return;
  }

  if (url.pathname === "/api/admin/upload" && method === "POST") {
    if (!isAuthenticated(req)) {
      json(res, 401, { ok: false, error: "Não autorizado" });
      return;
    }
    const ct = req.headers["content-type"] || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      json(res, 400, { ok: false, error: "Use multipart/form-data com campo file" });
      return;
    }
    const fk = (url.searchParams.get("folder") || "postagens").toLowerCase();
    const dirName = FOLDER_QUERY_MAP[fk] || FOLDER_QUERY_MAP.postagens;

    const bb = busboy({
      headers: req.headers,
      limits: { fileSize: 85 * 1024 * 1024 },
    });

    let savedPath = null;
    let fileError = null;
    let sawFile = false;

    bb.on("file", (fieldname, file, info) => {
      if (fieldname !== "file") {
        file.resume();
        return;
      }
      sawFile = true;
      const dir = dirName;
      const fname = sanitizeUploadFilename(info.filename);
      const destDir = path.join(ROOT, "vip", dir);
      const dest = path.join(destDir, fname);
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("limit", () => {
        fileError = "Arquivo muito grande (máx. ~85 MB)";
      });
      file.on("end", () => {
        if (fileError) return;
        try {
          fs.mkdirSync(destDir, { recursive: true });
          fs.writeFileSync(dest, Buffer.concat(chunks));
          savedPath = `${dir}/${fname}`.replace(/\\/g, "/");
        } catch (e) {
          fileError = String(e.message || e);
        }
      });
    });

    bb.on("error", (err) => {
      json(res, 400, { ok: false, error: String(err.message || err) });
    });

    bb.on("finish", () => {
      if (fileError) {
        json(res, 400, { ok: false, error: fileError });
        return;
      }
      if (!sawFile || !savedPath) {
        json(res, 400, { ok: false, error: 'Envie um arquivo no campo "file"' });
        return;
      }
      json(res, 200, { ok: true, path: savedPath });
    });

    req.pipe(bb);
    return;
  }

  if (url.pathname === "/api/admin/media" && method === "DELETE") {
    if (!isAuthenticated(req)) {
      json(res, 401, { ok: false, error: "Não autorizado" });
      return;
    }
    const rel = url.searchParams.get("path") || "";
    const resolved = resolveVipMediaPath(rel);
    if (!resolved) {
      json(res, 400, { ok: false, error: "path inválido (use Postagens/…, Midias/… ou Feed teaser/…)" });
      return;
    }
    try {
      fs.unlinkSync(resolved);
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 404, { ok: false, error: "Arquivo não encontrado" });
    }
    return;
  }

  if (url.pathname === "/api/admin/site-data" && method === "PUT") {
    if (!isAuthenticated(req)) {
      json(res, 401, { ok: false, error: "Não autorizado" });
      return;
    }
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      if (typeof parsed.version !== "number") {
        json(res, 400, { ok: false, error: "Campo version obrigatório" });
        return;
      }
      const tmp = SITE_DATA_PATH + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(parsed, null, 2), "utf8");
      fs.renameSync(tmp, SITE_DATA_PATH);
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 400, { ok: false, error: String(e.message || e) });
    }
    return;
  }

  if (url.pathname === "/vip/media-stats.json" && method === "GET") {
    const stats = getStats();
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(stats));
    return;
  }

  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    const adminPath = path.join(ROOT, "admin", "index.html");
    fs.readFile(adminPath, (err, data) => {
      if (err) {
        res.writeHead(err.code === "ENOENT" ? 404 : 500);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
    return;
  }

  if (url.pathname === "/admin.html") {
    res.writeHead(302, { Location: "/admin/" });
    res.end();
    return;
  }

  const filePath = safePath(url.pathname);
  if (!filePath || !filePath.startsWith(path.resolve(ROOT))) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500);
      res.end();
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Foto (raiz):    http://localhost:${PORT}/`);
  console.log(`Perfil VIP:     http://localhost:${PORT}/vip/`);
  console.log(`Painel admin:   http://localhost:${PORT}/admin/`);
  console.log(`Dados VIP:      vip/site-data.json (PUT via admin)`);
  console.log(`Upload admin:   POST /api/admin/upload?folder=postagens|midias|feed-teaser`);
});
