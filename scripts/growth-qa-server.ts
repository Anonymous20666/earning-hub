// Isolated, access-gated browser QA. Never points at production data or providers.
import express from "express";
import path from "node:path";
import { readFileSync } from "node:fs";
import { openDatabase } from "../backend/database";
import { createApp } from "../backend/app";
const folder = process.env.GROWTH_QA_FOLDER;
if (
  !folder ||
  !path.isAbsolute(folder) ||
  process.env.WHATSAPP_ENABLED === "true"
)
  throw Error(
    "An isolated absolute QA directory and WhatsApp disabled are required",
  );
const secret = readFileSync(path.join(folder, "access-token"), "utf8").trim();
if (secret.length < 32) throw Error("QA access gate required");
const db = openDatabase(path.join(folder, "pappy.sqlite"));
const app = express();
app.use((req, res, next) => {
  if (req.get("X-Pappy-QA") !== secret) {
    res
      .status(200)
      .type("text")
      .send(
        "Isolated QA server. Access is restricted; this is not the live Pappy website.",
      );
    return;
  }
  next();
});
const core = createApp(db, {
  secureCookies: false,
  development: true,
  rateMax: 100000,
});
app.use(core);
app.use(express.static(path.resolve("dist"), { index: false }));
app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
const server = app.listen(Number(process.env.PORT || 3108), "0.0.0.0", () =>
  console.log(
    "Isolated growth QA ready; real providers and all live dispatch disabled.",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      core.locals.previewEngine?.close();
      db.close();
      process.exit(0);
    }),
  );
