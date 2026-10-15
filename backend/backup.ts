import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
process.umask(0o077);
const filename = process.env.DATABASE_PATH || path.resolve("data/pappy.sqlite");
const folder = path.join(path.dirname(filename), "backups");
mkdirSync(folder, { recursive: true, mode: 0o700 });
const destination = path.join(
  folder,
  `pappy-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
const db = new DatabaseSync(filename, { readOnly: true });
db.prepare("VACUUM INTO ?").run(destination);
db.close();
chmodSync(destination, 0o600);
const check = new DatabaseSync(destination, { readOnly: true });
const integrity = check.prepare("PRAGMA integrity_check").get();
check.close();
if (Object.values(integrity || {})[0] !== "ok")
  throw new Error("Backup integrity check failed");
console.log(`Backup verified: ${destination}`);
