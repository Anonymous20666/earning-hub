import { openDatabase } from "../backend/database";
import {
  saveGrowth,
  submitGrowth,
  addGrowthAdmin,
  assignGrowthAdmins,
  recordGrowthVerification,
  setGrowthPrice,
  createGrowthQuote,
  acceptGrowthQuote,
  setGrowthWorkerShift,
} from "../backend/growth";
import {
  recordProviderPairing,
  syncProviderInventory,
  recordVerifiedGroupPermission,
} from "../backend/inventory";
import type { GrowthInput } from "../shared/growthRules";
export const iso = (offset = 0) => new Date(Date.now() + offset).toISOString();
export function input(patch: Partial<GrowthInput> = {}): GrowthInput {
  return {
    title: "SYNTHETIC growth plan",
    product: "WA_GROUP",
    destination: "https://chat.whatsapp.com/SyntheticInvite123",
    quantity: 200,
    countries: [],
    lane: "NORMAL",
    service: "SELF_SERVICE",
    expectedAt: iso(86400000),
    contactPhone: "",
    termsVersion: 1,
    acknowledged: true,
    ...patch,
  };
}
export function fixture(filename = ":memory:") {
  const db = openDatabase(filename);
  for (const [id, role] of [
    ["admin", "ADMIN"],
    ["buyer", "ADVERTISER"],
    ["other", "ADVERTISER"],
    ["worker", "EARNER"],
    ["worker2", "EARNER"],
  ]) {
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
      id,
      id + "@example.test",
      "SYNTHETIC " + id,
      "not-a-password",
      role,
      0,
      iso(),
    );
    if (role === "EARNER")
      db.prepare("INSERT INTO wallets(user_id) VALUES(?)").run(id);
  }
  return db;
}
export type DB = ReturnType<typeof fixture>;
let key = 0;
export function draft(db: DB, patch: Partial<GrowthInput> = {}) {
  return saveGrowth(db, "buyer", input(patch), "synthetic-key-" + ++key);
}
export function verified(db: DB, patch: Partial<GrowthInput> = {}) {
  let o = draft(db, patch);
  submitGrowth(db, "buyer", o.id, o.revision);
  const ids = ["Primary", "Backup"].map(
    (label, i) =>
      addGrowthAdmin(db, "admin", {
        label,
        phone: "+23480000000" + i,
        platform: patch.product?.startsWith("TG") ? "TG" : "WA",
      }).id,
  );
  o = assignGrowthAdmins(db, "admin", o.id, ids);
  return recordGrowthVerification(db, "admin", o.id, {
    code: o.verificationCode,
    permissionsChecked: true,
    note: "SYNTHETIC attestation only, not provider evidence.",
  });
}
export function inventory(
  db: DB,
  user = "worker",
  slot: 1 | 2 = 1,
  jids = ["120363000000000001@g.us"],
  counts?: number[],
) {
  const account = recordProviderPairing(db, {
    userId: user,
    slot,
    providerJid:
      (user === "worker" ? "23480000000" : "23481111111") +
      slot +
      "@s.whatsapp.net",
    hashKey: "SYNTHETIC identity hash key of more than 32 characters",
  }).id;
  syncProviderInventory(
    db,
    account,
    jids.map((jid, i) => ({
      jid,
      subject: "SYNTHETIC " + i,
      memberCount: counts?.[i] ?? 1000,
      announce: false,
      userIsAdmin: false,
    })),
    true,
  );
  for (const jid of jids)
    recordVerifiedGroupPermission(db, {
      groupJid: jid,
      consentReference: "SYNTHETIC permitted group reference",
      approverHash: "a".repeat(64),
      expiresAt: iso(86400000),
    });
  db.prepare(
    "INSERT INTO wa_slots(id,user_id,slot,phone_hash,phone_label,account_id,status,paid_opt_in,created_at,updated_at) VALUES(?,?,?,?,?,?,'ONLINE',1,?,?)",
  ).run(
    account + "slot",
    user,
    slot,
    account,
    "SYNTHETIC",
    account,
    iso(),
    iso(),
  );
  setGrowthWorkerShift(db, user, 60);
  return account;
}
export function accepted(db: DB) {
  const o = verified(db);
  inventory(db);
  setGrowthPrice(db, "admin", "WA_GROUP", {
    unitKobo: 100,
    baseKobo: 0,
    urgentBps: 12500,
    revision: 1,
  });
  const q = createGrowthQuote(db, "admin", o.id, {
    plannedGroups: 1,
    workerBudgetMilli: 1000,
    feeKobo: 0,
  });
  return acceptGrowthQuote(db, "buyer", o.id, q.quote!.id);
}
// Only tests may manufacture RUNNING. No HTTP route or commercial authorization does this.
export function running(db: DB, patch: Partial<GrowthInput> = {}) {
  const o = draft(db, patch);
  db.prepare(
    "UPDATE growth_orders SET status='RUNNING',started_at=?,deadline_at=?,baseline_count=? WHERE id=?",
  ).run(iso(-120000), iso(3600000), 1000, o.id);
  return o.id;
}
