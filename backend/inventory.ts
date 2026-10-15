import { createHmac, randomUUID } from "node:crypto";
import { type Database, transaction } from "./database";
// Internal adapter functions only. Web clients cannot declare a number paired or a group approved.
export function recordProviderPairing(
  db: Database,
  input: { userId: string; slot: 1 | 2; providerJid: string; hashKey: string },
) {
  return transaction(db, () => {
    if (
      ![1, 2].includes(input.slot) ||
      !/^\d{7,16}@s\.whatsapp\.net$/.test(input.providerJid) ||
      input.hashKey.length < 32
    )
      throw Error(
        "A verified provider account, slot 1/2 and persistent hashing key are required",
      );
    if (
      (db.prepare("SELECT role FROM users WHERE id=?").get(input.userId) as any)
        ?.role !== "EARNER"
    )
      throw Error("Worker required");
    const jidHash = createHmac("sha256", input.hashKey)
      .update(input.providerJid)
      .digest("hex");
    const prior = db
      .prepare("SELECT * FROM paired_numbers_history WHERE jid_hash=?")
      .get(jidHash) as any;
    if (prior && prior.original_user_id !== input.userId)
      throw Error("This number already belongs to another owner account");
    const date = new Date().toISOString();
    db.prepare(
      "INSERT OR IGNORE INTO paired_numbers_history VALUES(?,?,?)",
    ).run(jidHash, input.userId, date);
    const existing = db
      .prepare("SELECT id FROM paired_accounts WHERE user_id=? AND slot=?")
      .get(input.userId, input.slot) as any;
    const id = existing?.id || randomUUID();
    const account = db
      .prepare("SELECT jid_hash FROM paired_accounts WHERE id=?")
      .get(id) as any;
    if (account && account.jid_hash !== jidHash)
      db.prepare(
        "UPDATE group_inventory SET is_member=0 WHERE account_id=?",
      ).run(id);
    db.prepare(
      `INSERT INTO paired_accounts(id,user_id,slot,jid_hash,phone_label,status,connected_at) VALUES(?,?,?,?,?,'ONLINE',?)
 ON CONFLICT(user_id,slot) DO UPDATE SET jid_hash=excluded.jid_hash,phone_label=excluded.phone_label,status='ONLINE',connected_at=excluded.connected_at,scanner_at=NULL`,
    ).run(
      id,
      input.userId,
      input.slot,
      jidHash,
      "•••• " + input.providerJid.split("@")[0].slice(-4),
      date,
    );
    return { id };
  });
}
export type ScannedGroup = {
  jid: string;
  subject: string;
  memberCount: number;
  announce: boolean;
  userIsAdmin: boolean;
};
export function syncProviderInventory(
  db: Database,
  accountId: string,
  groups: ScannedGroup[],
  completeSnapshot: boolean,
) {
  return transaction(db, () => {
    if (!completeSnapshot || !Array.isArray(groups))
      throw Error("A complete provider group snapshot is required");
    if (
      !db
        .prepare(
          "SELECT id FROM paired_accounts WHERE id=? AND status='ONLINE'",
        )
        .get(accountId)
    )
      throw Error("Connected provider account required");
    const date = new Date().toISOString();
    const seen = new Set<string>();
    for (const g of groups) {
      if (
        !/^\d{5,30}(?:-\d{5,30})?@g\.us$/.test(g.jid) ||
        seen.has(g.jid) ||
        !Number.isSafeInteger(g.memberCount) ||
        g.memberCount < 0 ||
        typeof g.subject !== "string" ||
        g.subject.length > 250 ||
        typeof g.announce !== "boolean" ||
        typeof g.userIsAdmin !== "boolean"
      )
        throw Error("Invalid group snapshot");
      seen.add(g.jid);
    }
    db.prepare("UPDATE group_inventory SET is_member=0 WHERE account_id=?").run(
      accountId,
    );
    for (const g of groups)
      db.prepare(
        `INSERT INTO group_inventory(account_id,group_jid,subject,member_count,announce,user_is_admin,is_member,synced_at) VALUES(?,?,?,?,?,?,1,?)
 ON CONFLICT(account_id,group_jid) DO UPDATE SET subject=excluded.subject,member_count=excluded.member_count,announce=excluded.announce,user_is_admin=excluded.user_is_admin,is_member=1,synced_at=excluded.synced_at`,
      ).run(
        accountId,
        g.jid,
        g.subject,
        g.memberCount,
        Number(g.announce),
        Number(g.userIsAdmin),
        date,
      );
    db.prepare("UPDATE paired_accounts SET scanner_at=? WHERE id=?").run(
      date,
      accountId,
    );
  });
}
export function recordVerifiedGroupPermission(
  db: Database,
  input: {
    groupJid: string;
    consentReference: string;
    approverHash: string;
    expiresAt: string;
  },
) {
  if (
    !/^\d{5,30}(?:-\d{5,30})?@g\.us$/.test(input.groupJid) ||
    input.consentReference.trim().length < 10 ||
    input.consentReference.length > 500 ||
    !/^[a-f0-9]{64}$/.test(input.approverHash) ||
    !Number.isFinite(Date.parse(input.expiresAt)) ||
    Date.parse(input.expiresAt) <= Date.now()
  )
    throw Error("Verified current admin consent evidence and expiry required");
  db.prepare(
    `INSERT INTO group_permissions VALUES(?,?,?,?,?,NULL) ON CONFLICT(group_jid) DO UPDATE SET consent_reference=excluded.consent_reference,approved_by_hash=excluded.approved_by_hash,approved_at=excluded.approved_at,expires_at=excluded.expires_at,revoked_at=NULL`,
  ).run(
    input.groupJid,
    input.consentReference,
    input.approverHash,
    new Date().toISOString(),
    new Date(input.expiresAt).toISOString(),
  );
}
