import { WhatsAppManager } from "./backend/whatsapp";
import { startPersonalDispatcher } from "./backend/personalDispatch";
import "dotenv/config";
import path from "node:path";
import express from "express";
import { openDatabase } from "./backend/database";
import { createApp } from "./backend/app";

process.umask(0o077);
const production = process.env.NODE_ENV === "production";
const db = openDatabase(
  process.env.DATABASE_PATH || path.resolve("data/pappy.sqlite"),
);
const assetFolder = path.resolve(
  path.dirname(process.env.DATABASE_PATH || "data/pappy.sqlite"),
  "wa-assets",
);
const whatsapp =
  process.env.WHATSAPP_ENABLED === "true"
    ? new WhatsAppManager(db, {
        encryptionKey: process.env.WA_ENCRYPTION_KEY || "",
        identityKey: process.env.WA_IDENTITY_KEY || "",
      })
    : undefined;
if (whatsapp) await whatsapp.start();
const stopPersonal = whatsapp
  ? startPersonalDispatcher(db, whatsapp, assetFolder)
  : async () => {};
const app = createApp(db, {
  whatsapp,
  assetFolder,
  rateMax:
    !production && process.env.QA_RATE_MAX
      ? Number(process.env.QA_RATE_MAX)
      : undefined,
  secureCookies: process.env.COOKIE_SECURE !== "false",
  development: !production,
  origin: process.env.APP_ORIGIN || undefined,
});
// Enable only behind the dedicated nginx proxy, which overwrites X-Forwarded-For.
// The container's host listener must remain bound to 127.0.0.1.
if (process.env.TRUST_PROXY_HOPS === "1") app.set("trust proxy", 1);
if (production) {
  app.use(express.static(path.resolve("dist"), { index: false, maxAge: "1h" }));
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve("dist/index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      allowedHosts: [".e2b.app", "localhost", "127.0.0.1"],
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3107);
const host = process.env.HOST || "127.0.0.1";
const server = app.listen(port, host, () =>
  console.log(
    `Pappy Earning Hub listening on ${host}:${port} (${production ? "production build" : "development"})`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(async () => {
      await stopPersonal();
      await whatsapp?.close();
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
