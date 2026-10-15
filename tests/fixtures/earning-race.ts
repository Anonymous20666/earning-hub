// Synthetic subprocess fixture. Never pointed at a production database.
import { openDatabase } from "../../backend/database";
import {
  reserveNextDelivery,
  settleConfirmedDelivery,
  fundHouseCampaign,
} from "../../backend/earning";
const [file, mode, id, at] = process.argv.slice(2);
if (!file.includes("pappy-race-"))
  throw Error("Isolated race fixture path required");
const db = openDatabase(file);
await new Promise((r) => setTimeout(r, Math.max(0, Number(at) - Date.now())));
try {
  let result: any;
  if (mode === "reserve") result = reserveNextDelivery(db, id);
  else if (mode === "fund") result = fundHouseCampaign(db, id, "admin");
  else {
    const j = db
      .prepare("SELECT * FROM delivery_jobs WHERE id=?")
      .get(id) as any;
    result = settleConfirmedDelivery(db, {
      jobId: id,
      groupJid: j.group_jid,
      messageId: j.provider_message_id,
      receiptId: "synthetic-receipt-" + id,
      status: "DELIVERY_CONFIRMED",
    });
  }
  console.log(JSON.stringify({ ok: true, result }));
} catch (e: any) {
  console.log(JSON.stringify({ ok: false, error: e.message }));
} finally {
  db.close();
}
