const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = path.join(ROOT, "data", "db.json");
const sessions = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = stored.split(":");
  const hash = createPasswordHash(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
}

function ensureSeedUser() {
  const db = readDb();
  if (!db.users.length) {
    db.users.push({
      id: "usr_1",
      name: "Lucas Soares",
      email: "admin@demo.com",
      passwordHash: createPasswordHash("admin123"),
      role: "admin",
      createdAt: new Date().toISOString()
    });
    writeDb(db);
  }
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((item) => {
        const [key, ...value] = item.trim().split("=");
        return [key, decodeURIComponent(value.join("="))];
      })
  );
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload muito grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
  });
}

function getSessionUser(req) {
  const token = parseCookies(req).session;
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

function requireAuth(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Acesso nao autorizado." });
    return null;
  }
  return user;
}

function validateRequired(payload, fields) {
  const missing = fields.filter((field) => !String(payload[field] || "").trim());
  if (missing.length) {
    return `Campos obrigatorios: ${missing.join(", ")}.`;
  }
  return null;
}

function sanitizeText(value) {
  return String(value || "").trim().slice(0, 160);
}

function buildDashboard(db) {
  const openTickets = db.tickets.filter((ticket) => ticket.status !== "Concluido");
  const highPriority = db.tickets.filter((ticket) => ticket.priority === "Alta" && ticket.status !== "Concluido");
  const ticketsByStatus = db.tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {});

  return {
    clients: db.clients.length,
    activeClients: db.clients.filter((client) => client.status === "Ativo").length,
    openTickets: openTickets.length,
    highPriority: highPriority.length,
    ticketsByStatus
  };
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/login" && req.method === "POST") {
    const payload = await readBody(req);
    const db = readDb();
    const user = db.users.find((item) => item.email === sanitizeText(payload.email).toLowerCase());

    if (!user || !verifyPassword(String(payload.password || ""), user.passwordHash)) {
      sendJson(res, 401, { error: "E-mail ou senha invalidos." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      expiresAt: Date.now() + 1000 * 60 * 60 * 8
    });

    sendJson(res, 200, { user: { name: user.name, email: user.email, role: user.role } }, {
      "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`
    });
    return;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const token = parseCookies(req).session;
    if (token) sessions.delete(token);
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    return;
  }

  const user = requireAuth(req, res);
  if (!user) return;

  if (pathname === "/api/me" && req.method === "GET") {
    sendJson(res, 200, { user });
    return;
  }

  if (pathname === "/api/dashboard" && req.method === "GET") {
    sendJson(res, 200, buildDashboard(readDb()));
    return;
  }

  if (pathname === "/api/clients" && req.method === "GET") {
    sendJson(res, 200, { clients: readDb().clients });
    return;
  }

  if (pathname === "/api/clients" && req.method === "POST") {
    const payload = await readBody(req);
    const error = validateRequired(payload, ["name", "email", "segment"]);
    if (error) return sendJson(res, 400, { error });

    const db = readDb();
    const client = {
      id: `cli_${crypto.randomUUID()}`,
      name: sanitizeText(payload.name),
      email: sanitizeText(payload.email).toLowerCase(),
      phone: sanitizeText(payload.phone),
      segment: sanitizeText(payload.segment),
      status: sanitizeText(payload.status) || "Ativo",
      createdAt: new Date().toISOString()
    };
    db.clients.unshift(client);
    writeDb(db);
    sendJson(res, 201, { client });
    return;
  }

  if (pathname.startsWith("/api/clients/") && req.method === "PUT") {
    const id = pathname.split("/").pop();
    const payload = await readBody(req);
    const db = readDb();
    const client = db.clients.find((item) => item.id === id);
    if (!client) return sendJson(res, 404, { error: "Cliente nao encontrado." });

    Object.assign(client, {
      name: sanitizeText(payload.name) || client.name,
      email: sanitizeText(payload.email).toLowerCase() || client.email,
      phone: sanitizeText(payload.phone),
      segment: sanitizeText(payload.segment) || client.segment,
      status: sanitizeText(payload.status) || client.status
    });
    writeDb(db);
    sendJson(res, 200, { client });
    return;
  }

  if (pathname.startsWith("/api/clients/") && req.method === "DELETE") {
    const id = pathname.split("/").pop();
    const db = readDb();
    db.clients = db.clients.filter((client) => client.id !== id);
    db.tickets = db.tickets.filter((ticket) => ticket.clientId !== id);
    writeDb(db);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/tickets" && req.method === "GET") {
    const db = readDb();
    const tickets = db.tickets.map((ticket) => ({
      ...ticket,
      clientName: db.clients.find((client) => client.id === ticket.clientId)?.name || "Cliente removido"
    }));
    sendJson(res, 200, { tickets });
    return;
  }

  if (pathname === "/api/tickets" && req.method === "POST") {
    const payload = await readBody(req);
    const error = validateRequired(payload, ["clientId", "title", "priority"]);
    if (error) return sendJson(res, 400, { error });

    const db = readDb();
    const ticket = {
      id: `att_${crypto.randomUUID()}`,
      clientId: sanitizeText(payload.clientId),
      title: sanitizeText(payload.title),
      priority: sanitizeText(payload.priority),
      status: sanitizeText(payload.status) || "Aberto",
      description: sanitizeText(payload.description),
      createdAt: new Date().toISOString()
    };
    db.tickets.unshift(ticket);
    writeDb(db);
    sendJson(res, 201, { ticket });
    return;
  }

  if (pathname.startsWith("/api/tickets/") && req.method === "PUT") {
    const id = pathname.split("/").pop();
    const payload = await readBody(req);
    const db = readDb();
    const ticket = db.tickets.find((item) => item.id === id);
    if (!ticket) return sendJson(res, 404, { error: "Atendimento nao encontrado." });

    Object.assign(ticket, {
      title: sanitizeText(payload.title) || ticket.title,
      priority: sanitizeText(payload.priority) || ticket.priority,
      status: sanitizeText(payload.status) || ticket.status,
      description: sanitizeText(payload.description)
    });
    writeDb(db);
    sendJson(res, 200, { ticket });
    return;
  }

  if (pathname.startsWith("/api/tickets/") && req.method === "DELETE") {
    const id = pathname.split("/").pop();
    const db = readDb();
    db.tickets = db.tickets.filter((ticket) => ticket.id !== id);
    writeDb(db);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Rota nao encontrada." });
}

function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Acesso negado.");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Arquivo nao encontrado.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(content);
  });
}

ensureSeedUser();

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }
    serveStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erro interno." });
  }
});

server.listen(PORT, () => {
  console.log(`Sistema rodando em http://localhost:${PORT}`);
  console.log("Login demo: admin@demo.com | senha: admin123");
});
