import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { openDatabase } from "../backend/database";
import { WhatsAppManager } from "../backend/whatsapp";
import { WaVault } from "../backend/waVault";
const phone = "2348000000062",
  jid = "120363000000000062@g.us";
const tick = () => new Promise((r) => setImmediate(r));
function fixture(ownerAdmin = true, loader?: () => Promise<any>) {
  const db = openDatabase(":memory:");
  for (const id of ["owner", "other"])
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
      id,
      id + "@example.test",
      id,
      "synthetic",
      "EARNER",
      0,
      new Date().toISOString(),
    );
  let sockets: any[] = [],
    calls: any[] = [];
  const metadata = () => ({
    id: jid,
    subject: "SYNTHETIC group",
    participants: [
      {
        id: phone + "@s.whatsapp.net",
        admin: ownerAdmin ? "admin" : undefined,
      },
      { id: "2348000000063@s.whatsapp.net", admin: "admin" },
      { id: "2348000000064@s.whatsapp.net" },
    ],
    size: 321,
    announce: false,
  });
  const lib: any = {
    BufferJSON: {
      reviver: (_k: string, v: any) => v,
      replacer: (_k: string, v: any) => v,
    },
    initAuthCreds: () => ({ registered: false }),
    proto: { Message: { AppStateSyncKeyData: { fromObject: (v: any) => v } } },
    jidNormalizedUser: (v: string) => v.replace(/:\d+(?=@)/, ""),
    generateMessageIDV2: () => "synthetic-provider-id",
    default: (config: any) => {
      const sock = {
        config,
        ev: new EventEmitter(),
        user: { id: phone + "@s.whatsapp.net" },
        requestPairingCode: async (p: string, code: string) => {
          calls.push({ p, code });
          return code;
        },
        end: () => {},
        logout: async () => {},
        groupFetchAllParticipating: async () => ({ [jid]: metadata() }),
        groupMetadata: async () => metadata(),
        sendMessage: async () => {
          throw Error("No real sends in synthetic session tests");
        },
      };
      sockets.push(sock);
      return sock;
    },
  };
  const manager = new WhatsAppManager(db, {
    encryptionKey: "a".repeat(64),
    identityKey: "b".repeat(64),
    loadLibrary: loader || (async () => lib),
  });
  return {
    db,
    manager,
    lib,
    sockets,
    calls,
    async open() {
      const r = await manager.pair("owner", 1, phone),
        sock = sockets.at(-1);
      sock.ev.emit("creds.update", { registered: true });
      sock.ev.emit("connection.update", { connection: "open" });
      await tick();
      return {
        id: r.id,
        sock,
        accountId: manager.slots("owner")[0].account_id,
      };
    },
    async close() {
      await manager.close();
      db.close();
    },
  };
}
test("Plogme exact installed module imports without opening a socket", async () => {
  const name = "plogme",
    p = await import(name);
  assert.equal(typeof p.default, "function");
  assert.equal(typeof p.generateMessageIDV2, "function");
});
test("actual PAPPYPAY pairing code exists only after provider readiness; account not credited until matching open", async () => {
  const f = fixture();
  try {
    const r = await f.manager.pair("owner", 1, phone);
    assert.equal(f.manager.slots("owner")[0].code, null);
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM paired_accounts").get() as any).n,
      0,
    );
    const sock = f.sockets[0];
    sock.ev.emit("connection.update", { qr: "SYNTHETIC readiness event" });
    await tick();
    assert.equal(f.manager.slots("owner")[0].code, "PAPPYPAY");
    assert.equal(f.calls[0].code, "PAPPYPAY");
    assert.equal(f.calls[0].p, phone);
    assert.equal(f.calls[0].code, f.manager.slots("owner")[0].code);
    assert.equal(f.manager.slots("other").length, 0);
    await assert.rejects(() => f.manager.unlink("other", r.id), /not found/);
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM paired_accounts").get() as any).n,
      0,
    );
  } finally {
    await f.close();
  }
});
test("registered provider identity opens actual account inventory, checks self admin and removes temporary code", async () => {
  const f = fixture();
  try {
    const r = await f.open();
    assert.equal(f.manager.slots("owner")[0].status, "ONLINE");
    assert.equal(f.manager.slots("owner")[0].code, null);
    const g = f.db.prepare("SELECT * FROM group_inventory").get() as any;
    assert.equal(g.member_count, 321);
    assert.equal(g.user_is_admin, 1);
    assert.equal(g.is_member, 1);
    const grant = await f.manager.requestApproval("owner", r.accountId, jid, {
      status: true,
      chat: true,
      mentions: true,
    });
    assert.equal(grant.approved, true);
    assert.equal(
      (
        f.db
          .prepare("SELECT mentions_allowed FROM broadcast_permissions")
          .get() as any
      ).mentions_allowed,
      1,
    );
  } finally {
    await f.close();
  }
});
test("wrong provider phone is refused without creating a paired account or claiming connection", async () => {
  const f = fixture();
  try {
    await f.manager.pair("owner", 1, phone);
    f.sockets[0].user.id = "2348999999999@s.whatsapp.net";
    f.sockets[0].ev.emit("connection.update", { connection: "open" });
    await tick();
    assert.equal(f.manager.slots("owner")[0].status, "ERROR");
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM paired_accounts").get() as any).n,
      0,
    );
  } finally {
    await f.close();
  }
});
test("only real current group admin command grants scoped approval; token alone or empty author is insufficient", async () => {
  const f = fixture(false);
  try {
    const r = await f.open(),
      request = await f.manager.requestApproval("owner", r.accountId, jid, {
        status: true,
        chat: true,
        mentions: true,
      });
    assert.equal(request.approved, false);
    const cmd = request.instructions!.split("\n").at(-1)!;
    const submit = async (participant?: string, remote = jid) => {
      r.sock.ev.emit("messages.upsert", {
        messages: [
          {
            key: {
              id: "synthetic-admin-message",
              remoteJid: remote,
              participant,
            },
            message: { conversation: cmd },
          },
        ],
      });
      await tick();
    };
    await submit("2348000000064@s.whatsapp.net");
    assert.equal(
      f.db.prepare("SELECT * FROM broadcast_permissions").get(),
      undefined,
    );
    await submit();
    assert.equal(
      f.db.prepare("SELECT * FROM broadcast_permissions").get(),
      undefined,
    );
    await submit("2348000000063@s.whatsapp.net", "120363000000000099@g.us");
    assert.equal(
      f.db.prepare("SELECT * FROM broadcast_permissions").get(),
      undefined,
    );
    await submit("2348000000063@s.whatsapp.net");
    assert.equal(
      (f.db.prepare("SELECT * FROM broadcast_permissions").get() as any)
        .mentions_allowed,
      1,
    );
  } finally {
    await f.close();
  }
});
test("two-slot and same-phone owner guards cannot be bypassed with another slot or owner", async () => {
  const f = fixture();
  try {
    await f.open();
    await assert.rejects(() => f.manager.pair("owner", 3, "2348000000088"));
    await assert.rejects(() => f.manager.pair("owner", 2, phone), /active/);
    await assert.rejects(
      () => f.manager.pair("other", 1, phone),
      /not available/,
    );
    await assert.rejects(() => f.manager.pair("owner", 2, "08000000001"));
  } finally {
    await f.close();
  }
});
test("unlink removes auth, revokes group permission and membership; another owner cannot take number history", async () => {
  const f = fixture();
  try {
    const r = await f.open();
    await f.manager.requestApproval("owner", r.accountId, jid, {
      status: true,
      chat: false,
      mentions: false,
    });
    await f.manager.unlink("owner", r.id);
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM wa_vault").get() as any).n,
      0,
    );
    assert.equal(
      (f.db.prepare("SELECT is_member FROM group_inventory").get() as any)
        .is_member,
      0,
    );
    assert.ok(
      (
        f.db
          .prepare("SELECT revoked_at FROM broadcast_permissions")
          .get() as any
      ).revoked_at,
    );
    await assert.rejects(
      () => f.manager.pair("other", 1, phone),
      /not available/,
    );
  } finally {
    await f.close();
  }
});
test("cancelling during lazy library import prevents any late socket creation", async () => {
  let finish: (v: any) => void;
  const loading = new Promise((r) => (finish = r));
  const f = fixture(true, async () => loading);
  try {
    const pairing = f.manager.pair("owner", 1, phone);
    await tick();
    await f.manager.unlink("owner", f.manager.slots("owner")[0].id);
    finish!(f.lib);
    await pairing;
    assert.equal(f.sockets.length, 0);
    assert.equal(f.manager.slots("owner")[0].status, "LOGGED_OUT");
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM wa_vault").get() as any).n,
      0,
    );
  } finally {
    await f.close();
  }
});
test("AES-GCM vault uses unique nonces and detects ciphertext tampering and slot/key substitution", async () => {
  const f = fixture();
  try {
    const r = await f.manager.pair("owner", 1, phone),
      v = new WaVault(f.db, "a".repeat(64));
    v.write(r.id, "test", "SECRET SYNTHETIC AUTH");
    const a = (
      f.db
        .prepare("SELECT ciphertext FROM wa_vault WHERE entry_key=?")
        .get("test") as any
    ).ciphertext;
    v.write(r.id, "test", "SECRET SYNTHETIC AUTH");
    const b = (
      f.db
        .prepare("SELECT ciphertext FROM wa_vault WHERE entry_key=?")
        .get("test") as any
    ).ciphertext;
    assert.notEqual(a, b);
    assert.equal(b.includes("SECRET"), false);
    assert.equal(v.read(r.id, "test"), "SECRET SYNTHETIC AUTH");
    f.db.prepare("INSERT INTO wa_vault VALUES(?,?,?)").run(r.id, "swapped", b);
    assert.throws(() => v.read(r.id, "swapped"));
    f.db
      .prepare("UPDATE wa_vault SET ciphertext=? WHERE entry_key=?")
      .run(b.slice(0, -4) + "AAAA", "test");
    assert.throws(() => v.read(r.id, "test"));
    assert.throws(() => new WaVault(f.db, "short"));
  } finally {
    await f.close();
  }
});
test("graceful shutdown expires an unfinished pairing, rather than stranding it as a reconnectable session", async () => {
  const f = fixture();
  try {
    await f.manager.pair("owner", 1, phone);
    await f.manager.close();
    assert.equal(f.manager.slots("owner")[0].status, "EXPIRED");
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM wa_vault").get() as any).n,
      0,
    );
  } finally {
    await f.close();
  }
});
test("provider kick creates an owner-level block; scanning/rejoining does not clear it, fresh verified admin approval does", async () => {
  const f = fixture();
  try {
    const r = await f.open();
    await f.manager.requestApproval("owner", r.accountId, jid, {
      status: true,
      chat: true,
      mentions: true,
    });
    r.sock.ev.emit("group-participants.update", {
      id: jid,
      action: "remove",
      participants: [phone + "@s.whatsapp.net"],
    });
    await tick();
    let removal = f.db.prepare("SELECT * FROM broadcast_removals").get() as any;
    assert.ok(removal);
    assert.equal(removal.cleared_at, null);
    assert.ok(
      (
        f.db
          .prepare("SELECT revoked_at FROM broadcast_permissions")
          .get() as any
      ).revoked_at,
    );
    await f.manager.scan("owner", r.id);
    removal = f.db.prepare("SELECT * FROM broadcast_removals").get() as any;
    assert.equal(removal.cleared_at, null);
    await f.manager.requestApproval("owner", r.accountId, jid, {
      status: true,
      chat: true,
      mentions: true,
    });
    assert.ok(
      (f.db.prepare("SELECT * FROM broadcast_removals").get() as any)
        .cleared_at,
    );
  } finally {
    await f.close();
  }
});
test("ignore invite lookup is strict, owner-scoped and never joins or imports a foreign group", async () => {
  const f = fixture();
  try {
    const { id, sock } = await f.open();
    await f.manager.scan("owner", id);
    let lookups = 0,
      joins = 0;
    sock.groupGetInviteInfo = async (code: string) => {
      lookups++;
      assert.equal(code, "ABCDEFGHIJKLMNOPQRSTUV");
      return { id: jid, subject: "SYNTHETIC group" };
    };
    sock.groupAcceptInvite = async () => {
      joins++;
      throw Error("Must never join");
    };
    const found = await f.manager.resolveIgnoreLink(
      "owner",
      "https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV?mode=ems_copy_t",
    );
    assert.equal(found.group_jid, jid);
    assert.match(found.invite_hash, /^[a-f0-9]{64}$/);
    for (const link of [
      "http://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV",
      "https://chat.whatsapp.com.evil.example/ABCDEFGHIJKLMNOPQRSTUV",
      "https://evil@chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV",
      "https://chat.whatsapp.com:444/ABCDEFGHIJKLMNOPQRSTUV",
      "https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV/extra",
    ])
      await assert.rejects(
        () => f.manager.resolveIgnoreLink("owner", link),
        /Use a group invite/,
      );
    await assert.rejects(
      () =>
        f.manager.resolveIgnoreLink(
          "other",
          "https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV",
        ),
      /not found/,
    );
    assert.equal(lookups, 1);
    sock.groupGetInviteInfo = async () => ({ id: "120363000000999999@g.us" });
    await assert.rejects(
      () =>
        f.manager.resolveIgnoreLink(
          "owner",
          "https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV",
        ),
      /not found/,
    );
    assert.equal(joins, 0);
    assert.equal(
      (
        f.db
          .prepare(
            "SELECT COUNT(*) n FROM group_inventory WHERE group_jid='120363000000999999@g.us'",
          )
          .get() as any
      ).n,
      0,
    );
  } finally {
    await f.close();
  }
});
test("native link preview uses real JPEG buffers, thumbnail-link upload, per-socket cache and status options; original payload stays intact", async () => {
  const f = fixture();
  try {
    const { sock, accountId } = await f.open();
    let uploads = 0;
    const messages: any[] = [];
    sock.waUploadToServer = async () => {
      throw Error("Synthetic tests never call a network upload");
    };
    f.lib.prepareWAMessageMedia = async (content: any, options: any) => {
      uploads++;
      assert.ok(Buffer.isBuffer(content.image));
      assert.equal(options.mediaTypeOverride, "thumbnail-link");
      assert.equal(options.upload, sock.waUploadToServer);
      return {
        imageMessage: {
          directPath: "/synthetic",
          width: 640,
          height: 320,
          mediaKey: Buffer.alloc(32),
        },
      };
    };
    f.lib.generateWAMessage = async (j: any, c: any, o: any) => {
      messages.push({ j, c, o });
      delete c.groupStatus;
      return {
        key: { id: o.messageId, remoteJid: j, fromMe: true },
        message: c,
      };
    };
    sock.sendMessage = async () => {
      throw Error("The ID-overwriting wrapper must not be used");
    };
    sock.relayMessage = async (j: any, c: any, o: any) => {
      assert.equal(j, jid);
      assert.match(o.messageId, /^SYNTHETIC-/);
    };
    const body = {
      text: "Title\n\nAttached text https://example.com/",
      groupStatus: true,
      backgroundColor: "#183C32",
      font: 0,
      linkPreview: {
        "matched-text": "https://example.com/",
        canonicalUrl: "https://example.com/",
        title: "Title",
        thumbnailBase64: Buffer.from("SYNTHETIC JPEG bytes").toString("base64"),
        inlineThumbnailBase64: Buffer.from("SYNTHETIC small JPEG").toString(
          "base64",
        ),
        thumbnailWidth: 640,
        thumbnailHeight: 320,
      },
    };
    const original = JSON.stringify(body);
    await f.manager.send(accountId, jid, body, "SYNTHETIC-1");
    await f.manager.send(accountId, jid, body, "SYNTHETIC-2");
    assert.equal(uploads, 1);
    assert.equal(JSON.stringify(body), original);
    assert.equal(messages[0].o.backgroundColor, "#183C32");
    assert.equal(messages[0].o.font, 0);
    assert.ok(Buffer.isBuffer(messages[0].c.linkPreview.jpegThumbnail));
    assert.equal(messages[0].c.linkPreview.previewType, 5);
    assert.equal(
      messages[0].c.linkPreview.highQualityThumbnail.directPath,
      "/synthetic",
    );
    assert.equal(messages[0].c.linkPreview.thumbnailBase64, undefined);
    assert.equal(messages[0].c.text, body.text);
  } finally {
    await f.close();
  }
});
test("installed Plogme 2.1.0 encodes the adapted image preview and status background fields without any connection", async () => {
  const { generateWAMessageContent } = (await import("plogme")) as any;
  const bytes = Buffer.from([255, 216, 255, 217]),
    content = await generateWAMessageContent(
      {
        text: "Caption https://example.com/",
        linkPreview: {
          "matched-text": "https://example.com/",
          title: "Real title",
          description: "Description",
          jpegThumbnail: bytes,
          previewType: 5,
          highQualityThumbnail: {
            directPath: "/SYNTHETIC",
            mediaKey: Buffer.alloc(32),
            fileSha256: Buffer.alloc(32, 1),
            fileEncSha256: Buffer.alloc(32, 2),
            width: 640,
            height: 320,
          },
        },
      } as any,
      { backgroundColor: "#183C32", font: 0 } as any,
    );
  const ext = content.extendedTextMessage!;
  assert.equal(ext.matchedText, "https://example.com/");
  assert.equal(ext.title, "Real title");
  assert.equal(ext.previewType, 5);
  assert.equal(ext.thumbnailDirectPath, "/SYNTHETIC");
  assert.equal(ext.thumbnailWidth, 640);
  assert.equal(ext.thumbnailHeight, 320);
  assert.equal(ext.backgroundArgb! >>> 0, 0xff183c32);
  assert.deepEqual(Buffer.from(ext.jpegThumbnail!), bytes);
});

test("installed native encoder and adapter preserve each durable wire ID for status, mentions, preview and media without a socket send", async () => {
  const f = fixture();
  try {
    const { sock, accountId } = await f.open();
    const real: any = await import("plogme");
    assert.equal(real.proto.WebMessageInfo.Status.ERROR, 0);
    f.lib.generateWAMessage = real.generateWAMessage;
    let wrapperCalls = 0;
    const relays: any[] = [];
    sock.sendMessage = async () => {
      wrapperCalls++;
      throw Error("The wrapper replaces durable IDs");
    };
    sock.relayMessage = async (j: any, m: any, o: any) => {
      relays.push({ j, m, o });
      return o.messageId;
    };
    sock.waUploadToServer = async () => ({
      mediaUrl: "https://synthetic.invalid/media",
      directPath: "/SYNTHETIC-no-network",
    });
    const image = await (
      await import("sharp")
    )
      .default({
        create: {
          width: 1280,
          height: 640,
          channels: 3,
          background: "#234533",
        },
      })
      .jpeg()
      .toBuffer();
    const inputs = [
      {
        text: "SYNTHETIC native status",
        groupStatus: true,
        backgroundColor: "#183C32",
        font: 0,
      },
      { text: "SYNTHETIC chat", mentions: ["2348000000099@s.whatsapp.net"] },
      {
        text: "SYNTHETIC https://example.com/",
        groupStatus: true,
        linkPreview: {
          "matched-text": "https://example.com/",
          title: "SYNTHETIC",
          description: "No network",
          previewType: 0,
        },
      },
      {
        image,
        mimetype: "image/jpeg",
        caption: "SYNTHETIC attached media",
        groupStatus: true,
      },
    ];
    for (let i = 0; i < inputs.length; i++) {
      const id = `SYNTHETIC-DURABLE-${i}`;
      const result = await f.manager.send(accountId, jid, inputs[i], id);
      assert.equal(result.key.id, id);
      assert.equal(result.key.remoteJid, jid);
      assert.equal(result.key.fromMe, true);
      assert.equal(relays[i].o.messageId, id);
    }
    assert.equal(wrapperCalls, 0);
    assert.equal(relays.length, 4);
    assert.equal(
      relays[0].m.groupStatusMessageV2.message.extendedTextMessage.text,
      inputs[0].text,
    );
    assert.equal(
      relays[0].m.groupStatusMessageV2.message.extendedTextMessage
        .backgroundArgb >>> 0,
      0xff183c32,
    );
    assert.deepEqual(
      relays[1].m.extendedTextMessage.contextInfo.mentionedJid,
      inputs[1].mentions,
    );
    assert.equal(
      relays[2].m.groupStatusMessageV2.message.extendedTextMessage.title,
      "SYNTHETIC",
    );
    assert.equal(
      relays[3].m.groupStatusMessageV2.message.imageMessage.caption,
      "SYNTHETIC attached media",
    );
    const sentImage = relays[3].m.groupStatusMessageV2.message.imageMessage;
    assert.equal(sentImage.width, 1280);
    assert.equal(sentImage.height, 640);
    assert.equal(Number(sentImage.fileLength), image.length);
    assert.deepEqual(
      Buffer.from(sentImage.fileSha256),
      createHash("sha256").update(image).digest(),
    );
    const thumb = await (await import("sharp"))
      .default(Buffer.from(sentImage.jpegThumbnail))
      .metadata();
    assert.equal(thumb.width, 320);
    assert.equal(thumb.height, 160);
  } finally {
    await f.close();
  }
});
test("adapter refuses malformed generated identity before any relay instead of accepting or replaying a different message", async () => {
  const f = fixture();
  try {
    const { sock, accountId } = await f.open();
    let relays = 0;
    sock.relayMessage = async () => {
      relays++;
    };
    for (const key of [
      { id: "SYNTHETIC-wrong", remoteJid: jid, fromMe: true },
      { id: "SYNTHETIC-fixed", remoteJid: "other@g.us", fromMe: true },
      { id: "SYNTHETIC-fixed", remoteJid: jid, fromMe: false },
    ]) {
      f.lib.generateWAMessage = async () => ({
        key,
        message: { conversation: "SYNTHETIC" },
      });
      await assert.rejects(
        () =>
          f.manager.send(
            accountId,
            jid,
            { text: "SYNTHETIC" },
            "SYNTHETIC-fixed",
          ),
        /identity could not be preserved/,
      );
    }
    assert.equal(relays, 0);
  } finally {
    await f.close();
  }
});

test("current owned socket records late personal post errors, not delivery credit, from SDK messages.update", async () => {
  const f = fixture();
  try {
    f.db.prepare("INSERT INTO wallets(user_id) VALUES('owner')").run();
    const { sock, accountId } = await f.open();
    const { preparePersonalDraft, submitPersonalDraft } = await import(
      "../backend/personalComposer"
    );
    const d = await preparePersonalDraft(f.db, "owner", {
      kind: "TEXT",
      mode: "ALLSTATUS",
      payload: "SYNTHETIC ACK routing",
      accountIds: [accountId],
    });
    const r = await submitPersonalDraft(f.db, "owner", d.draftId, true);
    f.db
      .prepare(
        "UPDATE broadcast_placements SET status='SENDING',provider_message_id='SYNTHETIC-EVENT-ID' WHERE target_id IN(SELECT id FROM broadcast_targets WHERE run_id=?)",
      )
      .run(r.id);
    const update = {
      key: { id: "SYNTHETIC-EVENT-ID", remoteJid: jid, fromMe: true },
      update: { status: 0, messageStubParameters: ["403"] },
    };
    sock.ev.emit("messages.update", [update]);
    assert.equal(
      (f.db.prepare("SELECT status FROM broadcast_placements").get() as any)
        .status,
      "FAILED",
    );
    sock.ev.emit("messages.update", [update]);
    sock.ev.emit("messages.update", [{ ...update, update: { status: 3 } }]);
    assert.equal(
      (
        f.db
          .prepare(
            "SELECT COUNT(*) n FROM broadcast_events WHERE kind='FAILED'",
          )
          .get() as any
      ).n,
      1,
    );
    assert.equal(
      (
        f.db
          .prepare("SELECT earned_milli FROM wallets WHERE user_id='owner'")
          .get() as any
      ).earned_milli,
      0,
    );
  } finally {
    await f.close();
  }
});
