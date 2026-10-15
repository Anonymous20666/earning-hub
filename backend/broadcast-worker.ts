import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase } from "./database";
import {
  reserveNextDelivery,
  markDeliveryUnknown,
  reconcileTreasury,
} from "./earning";
import {
  createDispatchQueue,
  createDispatchWorker,
  publishDispatchOutbox,
  type DeliveryProvider,
} from "./dispatch";
// This process is deliberately NOT started by the web server or production release script.
if (process.env.BROADCAST_WORKER_ENABLED !== "true")
  throw Error(
    "Broadcast worker is disabled. No queue connection or messages were started.",
  );
if (!process.env.DATABASE_PATH || !fs.existsSync(process.env.DATABASE_PATH))
  throw Error("An existing authorised SQLite database is required");
if (!process.env.REDIS_URL)
  throw Error("Private Redis configuration is required");
const moduleName = process.env.BROADCAST_PROVIDER_MODULE || "";
if (!/^[a-z0-9-]+$/.test(moduleName))
  throw Error(
    "An approved real provider adapter is required. No production messaging adapter is bundled yet.",
  );
const providerFile = path.resolve("backend/providers", moduleName + ".ts");
if (!fs.existsSync(providerFile))
  throw Error("Provider adapter is not installed. No message was sent.");
const { createProvider } = await import(pathToFileURL(providerFile).href);
const db = openDatabase(process.env.DATABASE_PATH);
const provider: DeliveryProvider = await createProvider();
if (!provider || !(await provider.ready()))
  throw Error("Configured provider is not ready; no worker started");
if (!reconcileTreasury(db).ok)
  throw Error("Treasury does not reconcile; no worker started");
const { queue, connection } = createDispatchQueue(process.env.REDIS_URL);
const consumer = createDispatchWorker(db, process.env.REDIS_URL, provider);
for (const j of db
  .prepare("SELECT id FROM delivery_jobs WHERE status='SENDING'")
  .all() as any[])
  markDeliveryUnknown(
    db,
    j.id,
    "Worker restart requires provider reconciliation; never blindly resend",
  );
// Rebuild Redis work only for jobs known not to have started sending. SQLite remains the money authority.
db.prepare(
  "UPDATE dispatch_outbox SET enqueued_at=NULL WHERE job_id IN(SELECT id FROM delivery_jobs WHERE status='RESERVED')",
).run();
let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    if (
      (await provider.ready()) &&
      (
        db
          .prepare("SELECT dispatch_enabled FROM broadcast_settings WHERE id=1")
          .get() as any
      ).dispatch_enabled
    ) {
      for (const c of db
        .prepare(
          "SELECT id FROM house_campaigns WHERE status IN('FUNDED','RUNNING') AND remaining_milli>0 ORDER BY created_at,id LIMIT 20",
        )
        .all() as any[]) {
        for (let n = 0; n < 20; n++) {
          if (!reserveNextDelivery(db, c.id).job) break;
        }
      }
    }
    await publishDispatchOutbox(db, queue);
  } catch {
    console.error(
      "Dispatch cycle stopped safely. Inspect private queue/provider health and treasury reconciliation.",
    );
  } finally {
    ticking = false;
  }
}
const timer = setInterval(tick, 1000);
await tick();
console.log(
  "Funded dispatch coordinator started with an operator-configured provider. Acceptance alone never credits wallets.",
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    clearInterval(timer);
    await consumer.close();
    await queue.close();
    await connection.quit();
    db.close();
    process.exit(0);
  });
