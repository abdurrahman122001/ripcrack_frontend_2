import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { z } from "zod";

const app = express();

const PORT = Number(process.env.PORT || 3003);
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:8080";
const DIRECTUS_URL = process.env.DIRECTUS_URL || "http://directus:8055";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";
const DIRECTUS_CUSTOMER_ROLE_ID = process.env.DIRECTUS_CUSTOMER_ROLE_ID || "";
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

app.use(
  cors({
    origin: APP_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

function assertEnv(name, value) {
  if (!value) throw new Error(`${name} is required`);
}

async function directus(path, init = {}) {
  const url = `${DIRECTUS_URL}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (DIRECTUS_TOKEN) headers.set("Authorization", `Bearer ${DIRECTUS_TOKEN}`);
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || json?.error || text || `Directus error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge,
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/_debug/session", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  res.json({
    ok: true,
    hasSessionCookie: Boolean(token),
    cookieName: COOKIE_NAME,
    origin: req.headers?.origin || null,
  });
});

async function getMeFromSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  const me = await directus("/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return { token, user: me.data };
}

async function requireAuth(req, res, next) {
  try {
    const session = await getMeFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Unauthorized" });
    req.session = session;
    next();
  } catch (e) {
    next(e);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const session = req.session || (await getMeFromSession(req));
    if (!session) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const roleId = session.user?.role;
    if (!roleId) return res.status(403).json({ ok: false, error: "Forbidden" });

    const role = await directus(`/roles/${roleId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    const isAdmin = Boolean(role?.data?.admin_access);
    if (!isAdmin) return res.status(403).json({ ok: false, error: "Forbidden" });

    req.session = session;
    next();
  } catch (e) {
    next(e);
  }
}

app.post("/auth/register", async (req, res, next) => {
  try {
    assertEnv("DIRECTUS_TOKEN", DIRECTUS_TOKEN);
    assertEnv("DIRECTUS_CUSTOMER_ROLE_ID", DIRECTUS_CUSTOMER_ROLE_ID);

    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      first_name: z.string().min(1).max(80).optional(),
      last_name: z.string().min(1).max(80).optional(),
    });

    const body = schema.parse(req.body);

    await directus("/users", {
      method: "POST",
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        first_name: body.first_name,
        last_name: body.last_name,
        role: DIRECTUS_CUSTOMER_ROLE_ID,
        status: "active",
      }),
    });

    const loginResp = await directus("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: body.email, password: body.password }),
    });

    setSessionCookie(res, loginResp.data?.access_token);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.get("/admin/users", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    assertEnv("DIRECTUS_TOKEN", DIRECTUS_TOKEN);

    const limit = Math.min(Number(req.query?.limit || 50), 200);
    const page = Math.max(Number(req.query?.page || 1), 1);

    const qs = new URLSearchParams({
      limit: String(limit),
      page: String(page),
      sort: "-date_created",
      fields: "id,email,first_name,last_name,status,role,date_created",
    });

    const out = await directus(`/users?${qs.toString()}`, { method: "GET" });
    res.json({ ok: true, data: out.data, meta: out.meta });
  } catch (e) {
    next(e);
  }
});

app.patch("/admin/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    assertEnv("DIRECTUS_TOKEN", DIRECTUS_TOKEN);

    const schema = z
      .object({
        status: z.enum(["active", "inactive", "suspended"]).optional(),
        role: z.string().min(1).optional(),
        first_name: z.string().min(1).max(80).optional(),
        last_name: z.string().min(1).max(80).optional(),
      })
      .refine((v) => Object.keys(v).length > 0);

    const body = schema.parse(req.body);
    const userId = String(req.params.id);

    const out = await directus(`/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    res.json({ ok: true, data: out.data });
  } catch (e) {
    next(e);
  }
});

app.get("/admin/orders", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    assertEnv("DIRECTUS_TOKEN", DIRECTUS_TOKEN);

    const limit = Math.min(Number(req.query?.limit || 50), 200);
    const page = Math.max(Number(req.query?.page || 1), 1);

    const qs = new URLSearchParams({
      limit: String(limit),
      page: String(page),
      sort: "-date_created",
    });

    const out = await directus(`/items/orders?${qs.toString()}`, { method: "GET" });
    res.json({ ok: true, data: out.data, meta: out.meta });
  } catch (e) {
    next(e);
  }
});

app.patch("/admin/orders/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    assertEnv("DIRECTUS_TOKEN", DIRECTUS_TOKEN);

    const schema = z
      .object({
        status: z.string().min(1).max(50).optional(),
        notes: z.string().max(2000).optional(),
      })
      .refine((v) => Object.keys(v).length > 0);

    const body = schema.parse(req.body);
    const orderId = String(req.params.id);

    const out = await directus(`/items/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    res.json({ ok: true, data: out.data });
  } catch (e) {
    next(e);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
    const body = schema.parse(req.body);

    const loginResp = await directus("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: body.email, password: body.password }),
    });

    setSessionCookie(res, loginResp.data?.access_token);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.post("/auth/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/auth/me", async (req, res, next) => {
  try {
    const session = await getMeFromSession(req);
    if (!session) return res.status(401).json({ ok: false });

    const roleId = session.user?.role;
    let roleName = null;
    let isAdmin = false;

    if (roleId) {
      const role = await directus(`/roles/${roleId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });
      roleName = role?.data?.name || null;
      isAdmin = Boolean(role?.data?.admin_access);
    }

    res.json({
      ok: true,
      user: {
        ...session.user,
        role_name: roleName,
        is_admin: isAdmin,
      },
    });
  } catch (e) {
    next(e);
  }
});

app.post("/orders", async (req, res, next) => {
  try {
    assertEnv("DIRECTUS_TOKEN", DIRECTUS_TOKEN);

    const schema = z.object({
      fullName: z.string().min(1).max(120),
      email: z.string().email(),
      phone: z.string().max(60).optional(),
      notes: z.string().max(2000).optional(),
      productId: z.number().int().positive().optional(),
      productTitle: z.string().max(200).optional(),
      purchaseTerm: z.string().max(50).optional(),
      selectedType: z.string().max(50).optional(),
    });

    const body = schema.parse(req.body);

    await directus("/items/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.post("/chat", async (req, res, next) => {
  try {
    assertEnv("OPENAI_API_KEY", OPENAI_API_KEY);

    const schema = z.object({
      message: z.string().min(1).max(4000),
    });

    const body = schema.parse(req.body);

    const aiRes = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful support assistant for a catalog website. Answer briefly and clearly. If unsure, ask a clarifying question.",
          },
          { role: "user", content: body.message },
        ],
        temperature: 0.4,
      }),
    });

    const json = await aiRes.json();
    if (!aiRes.ok) {
      const msg = json?.error?.message || "AI provider error";
      return res.status(502).json({ ok: false, error: msg });
    }

    const reply = json?.choices?.[0]?.message?.content || "";

    res.json({ ok: true, reply });
  } catch (e) {
    next(e);
  }
});

app.use((err, req, res, next) => {
  const status = err?.status && Number.isFinite(err.status) ? err.status : 500;
  const message = err?.message || "Server error";
  res.status(status).json({ ok: false, error: message });
});

app.listen(PORT, () => {
  console.log(`gateway listening on :${PORT}`);
});
