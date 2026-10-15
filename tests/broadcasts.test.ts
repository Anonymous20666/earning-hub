import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../backend/database";
import {
  recordProviderPairing,
  syncProviderInventory,
  recordVerifiedGroupPermission,
} from "../backend/inventory";
import {
  recordVerifiedFunding,
  createHouseCampaign,
  fundHouseCampaign,
  reconcileTreasury,
  referralCode,
  registerReferral,
  reserveNextDelivery,
  failUnsentDelivery,
} from "../backend/earning";
import {
  createPersonalRun,
  reservePaidRun,
  beginPaidPlacement,
  confirmPlacement,
  cancelUnsentPlacement,
  paidPlacementUnknown,
  textPlacement,
  cancelPersonalRun,
} from "../backend/broadcasts";
import { dispatchPersonalPlacement } from "../backend/personalDispatch";
import {
  publicAddress,
  destination,
  previewFromHtml,
} from "../backend/safePreview";
const jid = "120363000000000061@g.us";
function user(
  db: ReturnType<typeof openDatabase>,
  id: string,
  role = "EARNER",
) {
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
    id,
    id + "@example.test",
    id,
    "synthetic",
    role,
    0,
    new Date().toISOString(),
  );
  if (role === "EARNER")
    db.prepare("INSERT INTO wallets(user_id) VALUES(?)").run(id);
}
function fixture(members = 742) {
  const db = openDatabase(":memory:");
  user(db, "worker");
  user(db, "admin", "ADMIN");
  const a = recordProviderPairing(db, {
    userId: "worker",
    slot: 1,
    providerJid: "2348000000061@s.whatsapp.net",
    hashKey: "a".repeat(64),
  });
  syncProviderInventory(
    db,
    a.id,
    [
      {
        jid,
        subject: "SYNTHETIC permitted group",
        memberCount: members,
        announce: false,
        userIsAdmin: true,
      },
    ],
    true,
  );
  db.prepare(
    "INSERT INTO wa_slots(id,user_id,slot,phone_hash,phone_label,account_id,status,paid_opt_in,created_at,updated_at) VALUES('slot','worker',1,'hash','TEST',?,'ONLINE',1,?,?)",
  ).run(a.id, new Date().toISOString(), new Date().toISOString());
  db.prepare(
    "INSERT INTO broadcast_permissions VALUES(?,?,1,1,1,?,?,?,NULL)",
  ).run(
    a.id,
    jid,
    "b".repeat(64),
    "SYNTHETIC verified admin consent",
    new Date(Date.now() + 86400000).toISOString(),
  );
  return { db, a: a.id };
}
function input(a: string, mode = "DOUBLE") {
  return {
    purpose: "PERSONAL",
    mode,
    caption: "Synthetic payload",
    targetUrl: "https://example.com/",
    requirePreview: true,
    targets: [{ accountId: a, groupJid: jid }],
    requestId: randomUUID(),
  };
}
const preview = async (url: string) => ({
  "matched-text": url,
  title: "SYNTHETIC preview",
  description: "Synthetic, no network fetch",
});
function funded(db: ReturnType<typeof openDatabase>, budget = 10000) {
  if (!db.prepare("SELECT 1 FROM funding_receipts").get())
    recordVerifiedFunding(db, {
      adminId: "admin",
      amountMilli: 1000000,
      source: "OWNER_CAPITAL",
      reference: "synthetic-placements-funding",
      evidenceNote: "SYNTHETIC funding for isolated placement tests only.",
    });
  const c = createHouseCampaign(db, {
    adminId: "admin",
    title: "Synthetic dual campaign",
    message: "Synthetic content only",
    targetUrl: "https://example.com/",
    rewardBudgetMilli: budget,
  });
  fundHouseCampaign(db, c.id, "admin");
  db.prepare("UPDATE broadcast_settings SET dispatch_enabled=1").run();
  return c.id;
}
function placements(db: ReturnType<typeof openDatabase>) {
  return db
    .prepare(
      "SELECT * FROM broadcast_placements ORDER BY CASE surface WHEN 'GROUP_STATUS' THEN 0 ELSE 1 END",
    )
    .all() as any[];
}
function start(db: ReturnType<typeof openDatabase>, p: any) {
  return beginPaidPlacement(db, p.id, "synthetic-message-" + p.id, {
    statusReceiptsVerified: true,
    chatReceiptsVerified: true,
  });
}
function confirm(db: ReturnType<typeof openDatabase>, p: any) {
  return confirmPlacement(db, {
    placementId: p.id,
    messageId: "synthetic-message-" + p.id,
    groupJid: jid,
    receiptId: "synthetic-receipt-" + p.id,
    kind: "DELIVERY_CONFIRMED",
  });
}
function balance(db: ReturnType<typeof openDatabase>) {
  return (
    db
      .prepare("SELECT earned_milli FROM wallets WHERE user_id='worker'")
      .get() as any
  ).earned_milli;
}
function check(db: ReturnType<typeof openDatabase>) {
  assert.equal(
    reconcileTreasury(db).ok,
    true,
    JSON.stringify(reconcileTreasury(db)),
  );
}
test("safe URL policy blocks private, metadata, reserved, mapped and NAT64 addresses", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "100.64.1.1",
    "192.168.1.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "64:ff9b::a00:1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  for (const ip of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])
    assert.equal(publicAddress(ip), true, ip);
  for (const url of [
    "http://example.com",
    "https://127.0.0.1",
    "https://user:pass@example.com",
    "https://example.com:8443",
    "https://thing.internal",
    "file:///etc/passwd",
    "https://[::1]/",
  ])
    assert.throws(() => destination(url));
  assert.equal(destination("https://example.com/path").protocol, "https:");
});
test("preview extraction sanitises bounded metadata and uses explicit destination", () => {
  const p = previewFromHtml(
    '<title> A &amp; B </title><meta name="description" content="Plain description">',
    "https://example.com/",
  );
  assert.equal(p.title, "A & B");
  assert.equal(p["matched-text"], "https://example.com/");
  assert.throws(() =>
    previewFromHtml("<html>none</html>", "https://example.com"),
  );
});
test("fresh status/chat payloads do not leak mutable flags between surfaces and null disables auto-fetch", () => {
  const a = textPlacement(
      "GROUP_STATUS",
      "Caption",
      "https://example.com",
      null,
    ),
    b = textPlacement("GROUP_CHAT", "Caption", "https://example.com", null);
  delete (a as any).groupStatus;
  assert.equal((b as any).mentionAll, true);
  assert.equal((b as any).groupStatus, undefined);
  assert.equal(b.linkPreview, null);
  assert.match(b.text, /https:\/\//);
});
test("personal 2x creates two zero-reward placements and never touches cash, bonuses or referral qualification", async () => {
  const f = fixture(40);
  user(f.db, "referrer");
  registerReferral(f.db, "worker", referralCode(f.db, "referrer"));
  try {
    const r = await createPersonalRun(f.db, "worker", input(f.a), preview);
    assert.equal(r.placements, 2);
    assert.equal(placements(f.db).length, 2);
    assert.equal(balance(f.db), 0);
    assert.equal(
      (f.db.prepare("SELECT status FROM referrals").get() as any).status,
      "PENDING",
    );
    assert.equal(
      (f.db.prepare("SELECT bonus_backing_milli FROM treasury").get() as any)
        .bonus_backing_milli,
      0,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("personal request replay is idempotent; changing content under the same key is rejected", async () => {
  const f = fixture();
  try {
    const i = input(f.a),
      a = await createPersonalRun(f.db, "worker", i, preview),
      b = await createPersonalRun(f.db, "worker", i, preview);
    assert.equal(a.id, b.id);
    assert.equal(b.idempotent, true);
    await assert.rejects(
      () =>
        createPersonalRun(
          f.db,
          "worker",
          { ...i, caption: "Changed" },
          preview,
        ),
      /different content/,
    );
  } finally {
    f.db.close();
  }
});
test("browser cannot switch personal purpose, claim rewards, borrow another owner or bypass preview requirement", async () => {
  const f = fixture();
  try {
    for (const i of [
      { ...input(f.a), purpose: "PAID_CAMPAIGN" },
      { ...input(f.a), rewardMilli: 100 },
      { ...input(f.a), targets: [{ accountId: "foreign", groupJid: jid }] },
    ])
      await assert.rejects(() => createPersonalRun(f.db, "worker", i, preview));
    await assert.rejects(
      () =>
        createPersonalRun(f.db, "worker", input(f.a), async () => {
          throw Error("Synthetic preview failure");
        }),
      /safe preview/,
    );
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM broadcast_runs").get() as any).n,
      0,
    );
  } finally {
    f.db.close();
  }
});
test("status/chat scoped permission is required; no hidden mention fallback or active targets without approval", async () => {
  const f = fixture();
  try {
    f.db.prepare("UPDATE broadcast_permissions SET mentions_allowed=0").run();
    await assert.rejects(
      () => createPersonalRun(f.db, "worker", input(f.a), preview),
      /approval/,
    );
    await createPersonalRun(f.db, "worker", input(f.a, "ALLSTATUS"), preview);
  } finally {
    f.db.close();
  }
});
test("personal dispatcher posts status before chat, labels acceptance honestly and never creates earnings", async () => {
  const f = fixture();
  let sends: any[] = [];
  const transport = {
    refreshGroup: async () => ({
      isMember: true,
      announce: false,
      userIsAdmin: true,
    }),
    messageId: async () => randomUUID(),
    send: async (_a: string, _g: string, content: any, id: string) => {
      sends.push({ ...content });
      return { key: { id } };
    },
  } as any;
  try {
    await createPersonalRun(f.db, "worker", input(f.a), preview);
    await dispatchPersonalPlacement(f.db, transport, "/unused");
    assert.equal(sends[0].groupStatus, true);
    assert.equal(placements(f.db)[0].status, "ACCEPTED");
    await dispatchPersonalPlacement(f.db, transport, "/unused");
    assert.equal(sends[1].mentionAll, true);
    assert.equal(sends[1].groupStatus, undefined);
    assert.equal(balance(f.db), 0);
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM ledger").get() as any).n,
      0,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("uncertain personal send is not retried, chat does not follow an unknown status, cancellation keeps unknown evidence", async () => {
  const f = fixture();
  let calls = 0;
  const transport = {
    refreshGroup: async () => ({
      isMember: true,
      announce: false,
      userIsAdmin: true,
    }),
    messageId: async () => randomUUID(),
    send: async () => {
      calls++;
      throw Error("Synthetic timeout");
    },
  } as any;
  try {
    const r = await createPersonalRun(f.db, "worker", input(f.a), preview);
    await dispatchPersonalPlacement(f.db, transport, "/unused");
    assert.equal(placements(f.db)[0].status, "UNKNOWN");
    assert.equal(
      await dispatchPersonalPlacement(f.db, transport, "/unused"),
      null,
    );
    assert.equal(calls, 1);
    cancelPersonalRun(f.db, "worker", r.id);
    assert.equal(placements(f.db)[0].status, "UNKNOWN");
    assert.equal(placements(f.db)[1].status, "CANCELLED");
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("personal database rows cannot be assigned rewards or relabelled paid", async () => {
  const f = fixture();
  try {
    const r = await createPersonalRun(f.db, "worker", input(f.a), preview);
    assert.throws(
      () =>
        f.db
          .prepare(
            "UPDATE broadcast_runs SET purpose='PAID_CAMPAIGN' WHERE id=?",
          )
          .run(r.id),
      /immutable/,
    );
    const t = (f.db.prepare("SELECT id FROM broadcast_targets").get() as any)
      .id;
    f.db.prepare("DELETE FROM broadcast_placements WHERE target_id=?").run(t);
    assert.throws(
      () =>
        f.db
          .prepare(
            "INSERT INTO broadcast_placements(id,target_id,surface,status,reward_milli,created_at) VALUES('bad',?,'GROUP_STATUS','RESERVED',100,?)",
          )
          .run(t, new Date().toISOString()),
      /never earn/,
    );
  } finally {
    f.db.close();
  }
});
test("paid 2x fully succeeds at exactly 1.484 Coins, with status confirmed before chat and idempotent receipts", () => {
  const f = fixture();
  try {
    recordVerifiedGroupPermission(f.db, {
      groupJid: jid,
      consentReference: "SYNTHETIC verified legacy consent",
      approverHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const c = funded(f.db);
    reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
      { accountId: f.a, groupJid: jid },
    ]);
    const [s, ch] = placements(f.db);
    assert.throws(() => start(f.db, ch), /Confirm group status/);
    start(f.db, s);
    assert.equal(balance(f.db), 0);
    confirm(f.db, s);
    assert.equal(balance(f.db), 742);
    assert.equal(confirm(f.db, s).idempotent, true);
    start(f.db, ch);
    confirm(f.db, ch);
    assert.equal(balance(f.db), 1484);
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("status success then kick credits 1x, cancels unsent chat and releases only its reward reservation", () => {
  const f = fixture();
  try {
    recordVerifiedGroupPermission(f.db, {
      groupJid: jid,
      consentReference: "SYNTHETIC verified legacy consent",
      approverHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const c = funded(f.db);
    reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
      { accountId: f.a, groupJid: jid },
    ]);
    const [s, ch] = placements(f.db);
    start(f.db, s);
    confirm(f.db, s);
    f.db.prepare("UPDATE group_inventory SET is_member=0").run();
    assert.throws(() => start(f.db, ch), /eligibility changed/);
    cancelUnsentPlacement(f.db, ch.id, "Worker kicked before chat");
    assert.equal(balance(f.db), 742);
    assert.equal(
      (f.db.prepare("SELECT allocated_milli FROM house_campaigns").get() as any)
        .allocated_milli,
      0,
    );
    assert.equal(
      (f.db.prepare("SELECT paid_milli FROM house_campaigns").get() as any)
        .paid_milli,
      742,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("confirmed status and unknown chat keep 1x earned and 1x reserved until later verified receipt", () => {
  const f = fixture();
  try {
    recordVerifiedGroupPermission(f.db, {
      groupJid: jid,
      consentReference: "SYNTHETIC verified legacy consent",
      approverHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const c = funded(f.db);
    reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
      { accountId: f.a, groupJid: jid },
    ]);
    const [s, ch] = placements(f.db);
    start(f.db, s);
    confirm(f.db, s);
    start(f.db, ch);
    paidPlacementUnknown(f.db, ch.id);
    assert.equal(balance(f.db), 742);
    assert.throws(() => cancelUnsentPlacement(f.db, ch.id), /may already/);
    assert.equal(
      (f.db.prepare("SELECT allocated_milli FROM house_campaigns").get() as any)
        .allocated_milli,
      742,
    );
    confirm(f.db, ch);
    assert.equal(balance(f.db), 1484);
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("funding and real surface-evidence capability are mandatory; no default paid sending", () => {
  const f = fixture();
  try {
    assert.throws(
      () =>
        reservePaidRun(f.db, "admin", "missing", "worker", "DOUBLE", [
          { accountId: f.a, groupJid: jid },
        ]),
      /disabled/,
    );
    const c = funded(f.db, 742);
    assert.throws(
      () =>
        reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
          { accountId: f.a, groupJid: jid },
        ]),
      /full-placement/,
    );
    reservePaidRun(f.db, "admin", c, "worker", "ALLSTATUS", [
      { accountId: f.a, groupJid: jid },
    ]);
    const [s] = placements(f.db);
    assert.throws(
      () =>
        beginPaidPlacement(f.db, s.id, "synthetic-message", {
          statusReceiptsVerified: false,
          chatReceiptsVerified: false,
        }),
      /not been verified/,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("same group on two numbers has only one paid status/chat pair and cannot enter the legacy path too", () => {
  const f = fixture();
  try {
    recordVerifiedGroupPermission(f.db, {
      groupJid: jid,
      consentReference: "SYNTHETIC verified legacy consent",
      approverHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const c = funded(f.db);
    reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
      { accountId: f.a, groupJid: jid },
      { accountId: f.a, groupJid: jid },
    ]);
    assert.equal(placements(f.db).length, 2);
    assert.throws(
      () =>
        reservePaidRun(f.db, "admin", c, "worker", "ALLSTATUS", [
          { accountId: f.a, groupJid: jid },
        ]),
      /already assigned/,
    );
    assert.equal(reserveNextDelivery(f.db, c).job, null);
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("new paid placement activates the backed ₦5 referral once; second placement never doubles it", () => {
  const f = fixture();
  try {
    user(f.db, "referrer");
    registerReferral(f.db, "worker", referralCode(f.db, "referrer"));
    recordVerifiedGroupPermission(f.db, {
      groupJid: jid,
      consentReference: "SYNTHETIC verified legacy consent",
      approverHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const c = funded(f.db);
    reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
      { accountId: f.a, groupJid: jid },
    ]);
    for (const p of placements(f.db)) {
      start(f.db, p);
      confirm(f.db, p);
    }
    assert.equal(
      (
        f.db
          .prepare("SELECT earned_milli FROM wallets WHERE user_id='referrer'")
          .get() as any
      ).earned_milli,
      5000,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("two actual slots sharing a group deduplicate to a single chosen account and placement pair", () => {
  const f = fixture();
  try {
    const b = recordProviderPairing(f.db, {
      userId: "worker",
      slot: 2,
      providerJid: "2348000000071@s.whatsapp.net",
      hashKey: "a".repeat(64),
    });
    syncProviderInventory(
      f.db,
      b.id,
      [
        {
          jid,
          subject: "SYNTHETIC shared group",
          memberCount: 742,
          announce: false,
          userIsAdmin: true,
        },
      ],
      true,
    );
    f.db
      .prepare(
        "INSERT INTO wa_slots(id,user_id,slot,phone_hash,phone_label,account_id,status,paid_opt_in,created_at,updated_at) VALUES('slot2','worker',2,'hash2','TEST',?,'ONLINE',1,?,?)",
      )
      .run(b.id, new Date().toISOString(), new Date().toISOString());
    f.db
      .prepare("INSERT INTO broadcast_permissions VALUES(?,?,1,1,1,?,?,?,NULL)")
      .run(
        b.id,
        jid,
        "hash",
        "synthetic",
        new Date(Date.now() + 86400000).toISOString(),
      );
    recordVerifiedGroupPermission(f.db, {
      groupJid: jid,
      consentReference: "SYNTHETIC verified legacy consent",
      approverHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const c = funded(f.db);
    reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
      { accountId: f.a, groupJid: jid },
      { accountId: b.id, groupJid: jid },
    ]);
    assert.equal(placements(f.db).length, 2);
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM broadcast_targets").get() as any).n,
      1,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("ten paid campaigns count independently from their two legs; eleventh campaign cannot reserve", () => {
  const f = fixture();
  try {
    for (let i = 0; i < 10; i++) {
      const c = funded(f.db);
      reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
        { accountId: f.a, groupJid: jid },
      ]);
    }
    assert.equal(placements(f.db).length, 20);
    const c = funded(f.db);
    assert.throws(
      () =>
        reservePaidRun(f.db, "admin", c, "worker", "ALLSTATUS", [
          { accountId: f.a, groupJid: jid },
        ]),
      /Daily paid campaign capacity/,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("paid eligibility works above 100 groups and above the personal 200-membership resource limit", () => {
  const f = fixture(100);
  try {
    const groups = Array.from({ length: 205 }, (_, i) => ({
      jid: `1203630000001${String(i).padStart(4, "0")}@g.us`,
      subject: "SYNTHETIC " + i,
      memberCount: 100,
      announce: false,
      userIsAdmin: true,
    }));
    syncProviderInventory(f.db, f.a, groups, true);
    for (const g of groups)
      f.db
        .prepare(
          "INSERT INTO broadcast_permissions VALUES(?,?,1,1,1,?,?,?,NULL)",
        )
        .run(
          f.a,
          g.jid,
          "hash",
          "synthetic",
          new Date(Date.now() + 86400000).toISOString(),
        );
    const c = funded(f.db, 30000);
    reservePaidRun(
      f.db,
      "admin",
      c,
      "worker",
      "ALLSTATUS",
      groups.map((g) => ({ accountId: f.a, groupJid: g.jid })),
    );
    assert.equal(placements(f.db).length, 205);
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("personal reward and target identity remain immutable on UPDATE, not only INSERT", async () => {
  const f = fixture();
  try {
    await createPersonalRun(f.db, "worker", input(f.a), preview);
    assert.throws(
      () =>
        f.db.prepare("UPDATE broadcast_placements SET reward_milli=742").run(),
      /immutable/,
    );
    assert.throws(
      () =>
        f.db.prepare("UPDATE broadcast_targets SET account_id='other'").run(),
      /immutable/,
    );
    assert.throws(
      () => f.db.prepare("UPDATE broadcast_runs SET preview_json='{}'").run(),
      /immutable/,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("personal submissions do not consume the ten funded-campaign participation slots", async () => {
  const f = fixture();
  try {
    await createPersonalRun(f.db, "worker", input(f.a), preview);
    assert.equal(
      (
        f.db
          .prepare("SELECT COUNT(*) n FROM campaign_participation")
          .get() as any
      ).n,
      0,
    );
    recordVerifiedGroupPermission(f.db, {
      groupJid: jid,
      consentReference: "SYNTHETIC verified legacy consent",
      approverHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const c = funded(f.db);
    reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
      { accountId: f.a, groupJid: jid },
    ]);
    assert.equal(
      (
        f.db
          .prepare("SELECT COUNT(*) n FROM campaign_participation")
          .get() as any
      ).n,
      1,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("cancelling a legacy reservation transfers the ₦5 referral hold to outstanding new paid work", () => {
  const f = fixture();
  try {
    user(f.db, "referrer");
    registerReferral(f.db, "worker", referralCode(f.db, "referrer"));
    recordVerifiedGroupPermission(f.db, {
      groupJid: jid,
      consentReference: "SYNTHETIC verified legacy consent",
      approverHash: "b".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    const legacy = funded(f.db);
    const job = reserveNextDelivery(f.db, legacy).job;
    assert.ok(job);
    const campaign = funded(f.db);
    const run = reservePaidRun(f.db, "admin", campaign, "worker", "ALLSTATUS", [
      { accountId: f.a, groupJid: jid },
    ]);
    failUnsentDelivery(f.db, job.id, "CANCELLED_BEFORE_SEND");
    const ref = f.db.prepare("SELECT * FROM referrals").get() as any;
    assert.equal(ref.status, "RESERVED");
    assert.equal(ref.reserved_job_id, run.id);
    check(f.db);
    const p = placements(f.db)[0];
    start(f.db, p);
    confirm(f.db, p);
    assert.equal(
      (
        f.db
          .prepare("SELECT earned_milli FROM wallets WHERE user_id='referrer'")
          .get() as any
      ).earned_milli,
      5000,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("media removal during asynchronous preview cannot leave a newly queued run referencing a deleted file", async () => {
  const f = fixture();
  try {
    const asset = randomUUID();
    f.db
      .prepare("INSERT INTO broadcast_assets VALUES(?,?,?,?,?,?)")
      .run(
        asset,
        "worker",
        "image/jpeg",
        123,
        "synthetic-hash",
        new Date().toISOString(),
      );
    await assert.rejects(
      () =>
        createPersonalRun(
          f.db,
          "worker",
          { ...input(f.a), assetId: asset, requirePreview: false },
          async (url) => {
            f.db
              .prepare("UPDATE broadcast_assets SET bytes=0 WHERE id=?")
              .run(asset);
            return preview(url);
          },
        ),
      /removed before/,
    );
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM broadcast_runs").get() as any).n,
      0,
    );
  } finally {
    f.db.close();
  }
});
test("a persisted owner-level removal blocks an otherwise online and approved personal or funded target", async () => {
  const f = fixture();
  try {
    f.db
      .prepare("INSERT INTO broadcast_removals VALUES(?,?,?,?,NULL)")
      .run("worker", jid, f.a, new Date().toISOString());
    await assert.rejects(
      () => createPersonalRun(f.db, "worker", input(f.a), preview),
      /switching numbers or rejoining/,
    );
    const c = funded(f.db);
    assert.throws(
      () =>
        reservePaidRun(f.db, "admin", c, "worker", "ALLSTATUS", [
          { accountId: f.a, groupJid: jid },
        ]),
      /switching numbers or rejoining/,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});

test("small groups receive funded-campaign placements at zero reward, with no referral or bonus progress", () => {
  const f = fixture(42);
  try {
    user(f.db, "referrer");
    registerReferral(f.db, "worker", referralCode(f.db, "referrer"));
    const c = funded(f.db);
    const run = reservePaidRun(f.db, "admin", c, "worker", "DOUBLE", [
      { accountId: f.a, groupJid: jid },
    ]);
    assert.equal(run.totalMilli, 0);
    assert.equal(placements(f.db).length, 2);
    assert.equal(
      (f.db.prepare("SELECT bonus_backing_milli FROM treasury").get() as any)
        .bonus_backing_milli,
      0,
    );
    for (const p of placements(f.db)) {
      assert.equal(p.reward_milli, 0);
      start(f.db, p);
      confirm(f.db, p);
    }
    assert.equal(balance(f.db), 0);
    assert.equal(
      (f.db.prepare("SELECT status FROM referrals").get() as any).status,
      "PENDING",
    );
    assert.equal(
      (
        f.db
          .prepare(
            "SELECT COUNT(*) n FROM ledger WHERE kind IN('VERIFIED_STATUS_DELIVERY','VERIFIED_CHAT_DELIVERY','QUALIFIED_REFERRAL')",
          )
          .get() as any
      ).n,
      0,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("member threshold changes pay, not post eligibility: 99 pays zero, 100 pays exactly 0.100 Coins", () => {
  for (const [members, reward] of [
    [99, 0],
    [100, 100],
  ]) {
    const f = fixture(members);
    try {
      const c = funded(f.db),
        run = reservePaidRun(f.db, "admin", c, "worker", "ALLSTATUS", [
          { accountId: f.a, groupJid: jid },
        ]);
      assert.equal(run.totalMilli, reward);
      const p = placements(f.db)[0];
      start(f.db, p);
      confirm(f.db, p);
      assert.equal(balance(f.db), reward);
      check(f.db);
    } finally {
      f.db.close();
    }
  }
});
test("a small-group success cannot consume a referral hold belonging to qualifying paid work", () => {
  const f = fixture(42);
  try {
    user(f.db, "referrer");
    registerReferral(f.db, "worker", referralCode(f.db, "referrer"));
    const smallCampaign = funded(f.db);
    reservePaidRun(f.db, "admin", smallCampaign, "worker", "ALLSTATUS", [
      { accountId: f.a, groupJid: jid },
    ]);
    const small = placements(f.db)[0];
    f.db.prepare("UPDATE group_inventory SET member_count=742").run();
    const bigCampaign = funded(f.db);
    reservePaidRun(f.db, "admin", bigCampaign, "worker", "ALLSTATUS", [
      { accountId: f.a, groupJid: jid },
    ]);
    const big = placements(f.db).find((p) => p.reward_milli === 742);
    assert.equal(
      (f.db.prepare("SELECT status FROM referrals").get() as any).status,
      "RESERVED",
    );
    f.db.prepare("UPDATE group_inventory SET member_count=42").run();
    start(f.db, small);
    confirm(f.db, small);
    assert.equal(
      (f.db.prepare("SELECT status FROM referrals").get() as any).status,
      "RESERVED",
    );
    assert.equal(
      (
        f.db
          .prepare("SELECT earned_milli FROM wallets WHERE user_id='referrer'")
          .get() as any
      ).earned_milli,
      0,
    );
    f.db.prepare("UPDATE group_inventory SET member_count=742").run();
    start(f.db, big);
    confirm(f.db, big);
    assert.equal(balance(f.db), 742);
    assert.equal(
      (
        f.db
          .prepare("SELECT earned_milli FROM wallets WHERE user_id='referrer'")
          .get() as any
      ).earned_milli,
      5000,
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
test("cancelling the last qualifying placement releases referral cash even if zero-reward work remains", () => {
  const f = fixture(42);
  try {
    user(f.db, "referrer");
    registerReferral(f.db, "worker", referralCode(f.db, "referrer"));
    const small = funded(f.db);
    reservePaidRun(f.db, "admin", small, "worker", "ALLSTATUS", [
      { accountId: f.a, groupJid: jid },
    ]);
    f.db.prepare("UPDATE group_inventory SET member_count=742").run();
    const big = funded(f.db);
    reservePaidRun(f.db, "admin", big, "worker", "ALLSTATUS", [
      { accountId: f.a, groupJid: jid },
    ]);
    cancelUnsentPlacement(
      f.db,
      placements(f.db).find((p) => p.reward_milli === 742).id,
    );
    assert.equal(
      (f.db.prepare("SELECT status FROM referrals").get() as any).status,
      "PENDING",
    );
    check(f.db);
  } finally {
    f.db.close();
  }
});
