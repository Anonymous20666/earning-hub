import "dotenv/config";
import fs from "node:fs";
import { openDatabase } from "./database";
import { recordVerifiedFunding, reconcileTreasury } from "./earning";
// Deliberately no web deposit endpoint and no administrator auto-provisioning.
const [command, file, confirmation] = process.argv.slice(2);
if (!process.env.DATABASE_PATH || !fs.existsSync(process.env.DATABASE_PATH)) {
  console.error(
    "Set DATABASE_PATH to an existing authorised app database. No file was created.",
  );
  process.exit(1);
}
const db = openDatabase(process.env.DATABASE_PATH);
try {
  if (command === "reconcile")
    console.log(JSON.stringify(reconcileTreasury(db), null, 2));
  else if (command === "record-cleared-funding") {
    if (!file || confirmation !== "--confirm-cleared-funds")
      throw Error(
        "Usage: npm run treasury -- record-cleared-funding /private/verified-receipt.json --confirm-cleared-funds. This only books an independently verified receipt; it does not receive money.",
      );
    const input = JSON.parse(fs.readFileSync(file, "utf8"));
    const result = recordVerifiedFunding(db, input);
    console.log(
      JSON.stringify(
        { recorded: result.id, reconciliation: reconcileTreasury(db) },
        null,
        2,
      ),
    );
  } else
    throw Error(
      "Supported commands: reconcile; record-cleared-funding. No payout or dispatch command exists.",
    );
} catch (e: any) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
