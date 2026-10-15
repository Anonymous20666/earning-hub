import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { Database, transaction } from "./database";
import {
  RULES,
  validateDraft,
  estimateQuote,
  withdrawalEligibility,
} from "../shared/rules";

const derive = (password: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
async function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  const key = await derive(password, salt);
  return `${salt}:${key.toString("hex")}`;
}
async function passwordMatches(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  const actual = (await passwordHash(password, salt)).split(":")[1];
  return timingSafeEqual(
    Buffer.from(actual, "hex"),
    Buffer.from(expected, "hex"),
  );
}
export function createApp(
  db: Database,
  options: {
    secureCookies?: boolean;
    origin?: string;
    rateMax?: number;
    development?: boolean;
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      xFrameOptions: false,
      contentSecurityPolicy: options.development
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:"],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: [
                "'self'",
                "https://arena.ai",
                "https://*.arena.ai",
              ],
              upgradeInsecureRequests: options.secureCookies ? [] : null,
            },
          },
    }),
  );
  // Explicit origin and custom-header checks prevent cross-site state changes. No CORS is enabled.
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        !req.is("application/json") ||
        req.get("X-Requested-With") !== "PappyWeb"
      ) {
        res.status(403).json({ error: "Request rejected" });
        return;
      }
      const origin = req.get("origin");
      if (origin) {
        try {
          const valid = options.origin
            ? origin === options.origin
            : new URL(origin).host === req.get("host");
          if (!valid) {
            res.status(403).json({ error: "Origin rejected" });
            return;
          }
        } catch {
          res.status(403).json({ error: "Origin rejected" });
          return;
        }
      }
    }
    next();
  });
  app.use(express.json({ limit: "24kb" }));
  app.use(cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: options.rateMax ?? 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please wait a minute." },
    }),
  );
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: options.rateMax ?? 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  const audit = (user: string, action: string, entity = user) =>
    db
      .prepare(
        "INSERT INTO audit(user_id, action, entity_id, created_at) VALUES(?,?,?,?)",
      )
      .run(user, action, entity, new Date().toISOString());
  const publicUser = (row: any) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isEmailVerified: !!row.email_verified,
    createdAt: row.created_at,
  });
  function newSession(res: express.Response, id: string) {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
      sha(token),
      id,
      csrf,
      Date.now() + 7 * 86400_000,
    );
    res.cookie("pappy_session", token, {
      httpOnly: true,
      secure: options.secureCookies ?? true,
      sameSite: "lax",
      maxAge: 7 * 86400_000,
      path: "/",
    });
    return csrf;
  }
  app.use("/api", (req: any, _res, next) => {
    if (typeof req.cookies.pappy_session === "string") {
      const row = db
        .prepare(
          "SELECT users.*, sessions.csrf FROM sessions JOIN users ON sessions.user_id=users.id WHERE token_hash=? AND expires_at>?",
        )
        .get(sha(req.cookies.pappy_session), Date.now());
      if (row) req.account = row;
    }
    next();
  });
  const protectedRoute = (
    req: any,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!req.account) {
      res.status(401).json({ error: "Please sign in to continue" });
      return;
    }
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.get("X-CSRF-Token") !== req.account.csrf
    ) {
      res
        .status(403)
        .json({ error: "Session check failed. Refresh and try again." });
      return;
    }
    next();
  };
  const role =
    (expected: string) =>
    (req: any, res: express.Response, next: express.NextFunction) => {
      if (req.account.role !== expected && req.account.role !== "ADMIN") {
        res
          .status(403)
          .json({ error: "You do not have permission for this action" });
        return;
      }
      next();
    };
  const asyncRoute =
    (fn: any): express.RequestHandler =>
    (req, res, next) =>
      Promise.resolve(fn(req, res, next)).catch(next);
  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", version: "0.1.0", mode: "pre-launch" });
  });
  app.get("/api/status", (_req, res) =>
    res.json({
      mode: "pre-launch",
      registration: true,
      emailDelivery: false,
      googleAuth: false,
      whatsapp: false,
      telegram: false,
      payments: false,
      payouts: false,
      ai: false,
    }),
  );
  app.post(
    "/api/auth/register",
    authLimiter,
    asyncRoute(async (req: any, res: express.Response) => {
      const { email, password, name, role: requestedRole } = req.body || {};
      if (
        typeof email !== "string" ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128 ||
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 80 ||
        !["EARNER", "ADVERTISER"].includes(requestedRole)
      ) {
        res.status(400).json({
          error:
            "Enter a valid email, a name (2–80 characters), a password (12–128 characters), and a worker or advertiser role.",
        });
        return;
      }
      const cleanEmail = email.trim().toLowerCase();
      const hash = await passwordHash(password);
      const id = randomUUID(),
        now = new Date().toISOString();
      try {
        transaction(db, () => {
          db.prepare(
            "INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)",
          ).run(id, cleanEmail, name.trim(), hash, requestedRole, now);
          if (requestedRole === "EARNER") {
            db.prepare(
              "INSERT INTO wallets(user_id,locked_milli) VALUES(?,?)",
            ).run(id, RULES.bonusMilli);
            db.prepare("INSERT INTO ledger VALUES(?,?,?,?,?,?)").run(
              randomUUID(),
              id,
              "LOCKED_REGISTRATION_BONUS",
              RULES.bonusMilli,
              `registration:${id}`,
              now,
            );
          }
          audit(id, "ACCOUNT_CREATED");
        });
      } catch (error: any) {
        if (String(error.message).includes("UNIQUE")) {
          res.status(409).json({
            error:
              "Unable to register with these details. Try signing in instead.",
          });
          return;
        }
        throw error;
      }
      const csrf = newSession(res, id);
      res.status(201).json({
        user: publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(id)),
        csrf,
      });
    }),
  );
  app.post(
    "/api/auth/login",
    authLimiter,
    asyncRoute(async (req: any, res: express.Response) => {
      const { email, password } = req.body || {};
      if (
        typeof email !== "string" ||
        email.length > 254 ||
        typeof password !== "string" ||
        password.length > 128
      ) {
        res.status(400).json({ error: "Enter your email and password" });
        return;
      }
      const user: any = db
        .prepare("SELECT * FROM users WHERE email=?")
        .get(email.trim().toLowerCase());
      const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
      const matches = await passwordMatches(
        password,
        user?.password_hash || dummy,
      );
      if (!user || !matches) {
        res.status(401).json({ error: "Email or password is incorrect" });
        return;
      }
      const csrf = newSession(res, user.id);
      audit(user.id, "SIGNED_IN");
      res.json({ user: publicUser(user), csrf });
    }),
  );
  app.get("/api/auth/session", protectedRoute, (req: any, res) =>
    res.json({ user: publicUser(req.account), csrf: req.account.csrf }),
  );
  app.post("/api/auth/logout", protectedRoute, (req: any, res) => {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      sha(req.cookies.pappy_session),
    );
    res.clearCookie("pappy_session", {
      path: "/",
      httpOnly: true,
      secure: options.secureCookies ?? true,
      sameSite: "lax",
    });
    res.json({ success: true });
  });
  app.post("/api/auth/password-reset", authLimiter, (_req, res) =>
    res.status(503).json({
      error: "Password reset email is not configured. No email has been sent.",
    }),
  );
  app.get("/api/workspace", protectedRoute, (req: any, res) => {
    const id = req.account.id;
    const wallet: any = db
      .prepare("SELECT * FROM wallets WHERE user_id=?")
      .get(id);
    const campaigns = db
      .prepare(
        "SELECT * FROM campaigns WHERE user_id=? ORDER BY created_at DESC",
      )
      .all(id)
      .map((c: any) => ({ ...c, payload: JSON.parse(c.payload) }));
    const tickets = db
      .prepare(
        "SELECT id,subject,message,status,reply,created_at FROM tickets WHERE user_id=? ORDER BY created_at DESC",
      )
      .all(id);
    const ledger = db
      .prepare(
        "SELECT id,kind,amount_milli,created_at FROM ledger WHERE user_id=? ORDER BY created_at DESC",
      )
      .all(id);
    res.json({
      wallet: wallet
        ? {
            ...wallet,
            eligibility: withdrawalEligibility(
              wallet.earned_milli,
              wallet.locked_milli,
              !!wallet.bonus_claimed,
            ),
          }
        : null,
      campaigns,
      tickets,
      ledger,
      sessions: [],
      deliveries: [],
    });
  });
  app.patch("/api/profile", protectedRoute, (req: any, res) => {
    if (
      typeof req.body.name !== "string" ||
      req.body.name.trim().length < 2 ||
      req.body.name.trim().length > 80
    ) {
      res.status(400).json({ error: "Name must be 2–80 characters" });
      return;
    }
    db.prepare("UPDATE users SET name=? WHERE id=?").run(
      req.body.name.trim(),
      req.account.id,
    );
    audit(req.account.id, "PROFILE_UPDATED");
    res.json({
      user: publicUser(
        db.prepare("SELECT * FROM users WHERE id=?").get(req.account.id),
      ),
    });
  });
  app.post(
    "/api/campaigns/quote",
    protectedRoute,
    role("ADVERTISER"),
    (req, res) => {
      try {
        res.json(estimateQuote(validateDraft(req.body)));
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.post(
    "/api/campaigns",
    protectedRoute,
    role("ADVERTISER"),
    (req: any, res) => {
      try {
        const payload = validateDraft(req.body),
          id = randomUUID(),
          now = new Date().toISOString();
        transaction(db, () => {
          db.prepare(
            "INSERT INTO campaigns(id,user_id,title,payload,created_at,updated_at) VALUES(?,?,?,?,?,?)",
          ).run(
            id,
            req.account.id,
            payload.title,
            JSON.stringify(payload),
            now,
            now,
          );
          audit(req.account.id, "DRAFT_CREATED", id);
        });
        res.status(201).json({
          id,
          status: "DRAFT",
          payload,
          quote: estimateQuote(payload),
        });
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.put(
    "/api/campaigns/:id",
    protectedRoute,
    role("ADVERTISER"),
    (req: any, res) => {
      try {
        const payload = validateDraft(req.body);
        const result = db
          .prepare(
            "UPDATE campaigns SET title=?,payload=?,updated_at=? WHERE id=? AND user_id=?",
          )
          .run(
            payload.title,
            JSON.stringify(payload),
            new Date().toISOString(),
            req.params.id,
            req.account.id,
          );
        if (!result.changes) {
          res.status(404).json({ error: "Draft not found" });
          return;
        }
        audit(req.account.id, "DRAFT_UPDATED", req.params.id);
        res.json({ success: true });
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.delete(
    "/api/campaigns/:id",
    protectedRoute,
    role("ADVERTISER"),
    (req: any, res) => {
      const result = db
        .prepare("DELETE FROM campaigns WHERE id=? AND user_id=?")
        .run(req.params.id, req.account.id);
      if (!result.changes) {
        res.status(404).json({ error: "Draft not found" });
        return;
      }
      audit(req.account.id, "DRAFT_DELETED", req.params.id);
      res.json({ success: true });
    },
  );
  app.post("/api/support", protectedRoute, (req: any, res) => {
    const { subject, message } = req.body || {};
    if (
      typeof subject !== "string" ||
      subject.trim().length < 3 ||
      subject.length > 120 ||
      typeof message !== "string" ||
      message.trim().length < 10 ||
      message.length > 4000
    ) {
      res.status(400).json({
        error:
          "Enter a subject (3–120 characters) and message (10–4,000 characters)",
      });
      return;
    }
    const id = randomUUID();
    db.prepare(
      "INSERT INTO tickets(id,user_id,subject,message,created_at) VALUES(?,?,?,?,?)",
    ).run(
      id,
      req.account.id,
      subject.trim(),
      message.trim(),
      new Date().toISOString(),
    );
    audit(req.account.id, "TICKET_CREATED", id);
    res.status(201).json({
      id,
      message:
        "Ticket saved. Email and Telegram notifications are not configured.",
    });
  });
  for (const endpoint of [
    "/api/pairing",
    "/api/withdrawals",
    "/api/payments",
    "/api/chat",
    "/api/campaigns/:id/launch",
  ]) {
    app.post(endpoint, protectedRoute, (_req, res) =>
      res.status(503).json({
        error:
          "This integration is not configured. No funds were moved and no message was sent.",
      }),
    );
  }
  // No public admin provisioning. Read/reply operations require a server-provisioned ADMIN account.
  app.get("/api/admin/overview", protectedRoute, role("ADMIN"), (_req, res) =>
    res.json({
      users: db
        .prepare(
          "SELECT id,email,name,role,email_verified,created_at FROM users ORDER BY created_at DESC LIMIT 100",
        )
        .all(),
      tickets: db
        .prepare(
          "SELECT id,user_id,subject,message,status,reply,created_at FROM tickets ORDER BY created_at DESC LIMIT 100",
        )
        .all(),
      bonusLiability: db
        .prepare("SELECT COALESCE(SUM(locked_milli),0) AS milli FROM wallets")
        .get(),
      audit: db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 50").all(),
    }),
  );
  app.post(
    "/api/admin/tickets/:id/reply",
    protectedRoute,
    role("ADMIN"),
    (req: any, res) => {
      const reply = req.body.reply;
      if (
        typeof reply !== "string" ||
        reply.trim().length < 2 ||
        reply.length > 4000
      ) {
        res.status(400).json({ error: "Reply must be 2–4,000 characters" });
        return;
      }
      const result = db
        .prepare("UPDATE tickets SET reply=?,status='REPLIED' WHERE id=?")
        .run(reply.trim(), req.params.id);
      if (!result.changes) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }
      audit(req.account.id, "TICKET_REPLIED", req.params.id);
      res.json({ success: true });
    },
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found" }),
  );
  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error.type === "entity.too.large") {
        res.status(413).json({ error: "Request too large" });
        return;
      }
      if (error instanceof SyntaxError) {
        res.status(400).json({ error: "Invalid JSON" });
        return;
      }
      console.error("Request failed:", error.code || error.name);
      res
        .status(500)
        .json({ error: "Something went wrong. Please try again." });
    },
  );
  return app;
}
