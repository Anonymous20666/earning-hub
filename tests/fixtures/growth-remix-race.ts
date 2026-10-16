// Synthetic-only cross-process allocation fixture. Never accepts production data.
import { openDatabase } from "../../backend/database";
import { GrowthCreativeEngine } from "../../backend/growthCreative";
const [file, order, asset, group, at] = process.argv.slice(2);
if (!file.includes("pappy-remix-race-"))
  throw Error("Isolated remix fixture path required");
const db = openDatabase(file);
await new Promise((r) => setTimeout(r, Math.max(0, Number(at) - Date.now())));
try {
  const engine = new GrowthCreativeEngine(db, {
    get: async () => {
      throw Error("No network in race fixture");
    },
  });
  console.log(JSON.stringify(engine.allocate(order, group, asset)));
} finally {
  db.close();
}
