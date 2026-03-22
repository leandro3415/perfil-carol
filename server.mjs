import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
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
});
