import {
  recordProviderPairing,
  syncProviderInventory,
} from "../backend/inventory";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { openDatabase } from "../backend/database";
import { createApp } from "../backend/app";
import { WhatsAppManager } from "../backend/whatsapp";
import { saveBroadcastAsset } from "../backend/broadcastAssets";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pappy-broadcast-api-"));
const db = openDatabase(":memory:");
const manager = new WhatsAppManager(db, {
  encryptionKey: "a".repeat(64),
  identityKey: "b".repeat(64),
  loadLibrary: async () => {
    throw Error("No real WhatsApp connections in API tests");
  },
});
const server = createApp(db, {
  secureCookies: false,
  rateMax: 1000,
  whatsapp: manager,
  assetFolder: folder,
}).listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const url = `http://127.0.0.1:${(server.address() as any).port}/api`;
let worker: any, other: any, advertiser: any, asset: any;
async function req(
  endpoint: string,
  method = "GET",
  body?: any,
  auth?: any,
  headers: any = {},
) {
  const response = await fetch(url + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "PappyWeb",
      ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : Buffer.isBuffer(body)
          ? new Uint8Array(body)
          : JSON.stringify(body),
  });
  const type = response.headers.get("content-type") || "";
  return {
    status: response.status,
    headers: response.headers,
    body: type.includes("application/json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer()),
  };
}
async function register(name: string, role = "EARNER") {
  const r = await req("/auth/register", "POST", {
    name,
    email: name + "-broadcast@example.test",
    password: "Synthetic-private-long-password-2026!",
    role,
  });
  assert.equal(r.status, 201);
  return { ...r.body, cookie: r.headers.get("set-cookie")!.split(";")[0] };
}
test("new WhatsApp, history and asset routes require authentication; disabled dispatch is advertised honestly", async () => {
  for (const endpoint of [
    "/whatsapp",
    "/broadcasts",
    "/broadcast-assets/foreign",
  ])
    assert.equal((await req(endpoint)).status, 401);
  const status = await req("/status");
  assert.equal(status.body.whatsapp, true);
  assert.equal(status.body.payments, false);
  worker = await register("worker");
  other = await register("other");
  advertiser = await register("advertiser", "ADVERTISER");
  assert.equal(
    (await req("/whatsapp", "GET", undefined, worker)).body.slots.length,
    0,
  );
  assert.equal(
    (await req("/whatsapp", "GET", undefined, worker)).body.paidDispatchEnabled,
    false,
  );
});
test("only workers can access paired sessions or queue personal broadcasts", async () => {
  assert.equal(
    (await req("/whatsapp", "GET", undefined, advertiser)).status,
    403,
  );
  assert.equal((await req("/broadcasts", "POST", {}, advertiser)).status, 403);
  assert.equal(
    (
      await req("/broadcast-assets", "POST", Buffer.from("bad"), advertiser, {
        "Content-Type": "application/octet-stream",
      })
    ).status,
    403,
  );
});
test("narrow raw-upload exception still requires CSRF, custom header, same origin and a session", async () => {
  const raw = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#507542" },
  })
    .jpeg()
    .toBuffer();
  assert.equal(
    (
      await req("/broadcast-assets", "POST", raw, undefined, {
        "Content-Type": "application/octet-stream",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await req("/broadcast-assets", "POST", raw, worker, {
        "Content-Type": "application/octet-stream",
        "X-CSRF-Token": "wrong",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/broadcast-assets", "POST", raw, worker, {
        "Content-Type": "application/octet-stream",
        "X-Requested-With": "wrong",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/broadcast-assets", "POST", raw, worker, {
        "Content-Type": "application/octet-stream",
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/broadcasts", "POST", raw, worker, {
        "Content-Type": "application/octet-stream",
      })
    ).status,
    403,
  );
});
test("valid media is normalised, privately stored and owner-only; no financial records are added", async () => {
  const raw = await sharp({
    create: { width: 24, height: 32, channels: 4, background: "#507542" },
  })
    .png()
    .withMetadata({ exif: { IFD0: { Artist: "Synthetic private metadata" } } })
    .toBuffer();
  const r = await req("/broadcast-assets", "POST", raw, worker, {
    "Content-Type": "application/octet-stream",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  asset = r.body;
  assert.equal(asset.mime, "image/jpeg");
  const meta = await sharp(
    fs.readFileSync(path.join(folder, asset.id)),
  ).metadata();
  assert.equal(meta.exif, undefined);
  assert.equal(fs.statSync(path.join(folder, asset.id)).mode & 0o777, 0o600);
  assert.equal(
    (await req("/broadcast-assets/" + asset.id, "GET", undefined, other))
      .status,
    404,
  );
  assert.equal(
    (await req("/broadcast-assets/" + asset.id, "GET", undefined, worker))
      .status,
    200,
  );
  const wallet = await req("/workspace", "GET", undefined, worker);
  assert.equal(wallet.body.wallet.earned_milli, 0);
});
test("fake, oversized and unsupported SVG payloads are rejected, never relabelled valid media", async () => {
  for (const b of [
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    ),
    Buffer.from("not-an-image"),
  ])
    assert.equal(
      (
        await req("/broadcast-assets", "POST", b, worker, {
          "Content-Type": "application/octet-stream",
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await req(
        "/broadcast-assets",
        "POST",
        Buffer.alloc(8 * 1024 * 1024 + 1),
        worker,
        { "Content-Type": "application/octet-stream" },
      )
    ).status,
    413,
  );
});
test("owner can remove uploaded media; another owner cannot delete or inspect it", async () => {
  assert.equal(
    (await req("/broadcast-assets/" + asset.id, "DELETE", {}, other)).status,
    404,
  );
  assert.equal(
    (await req("/broadcast-assets/" + asset.id, "DELETE", {}, worker)).status,
    200,
  );
  assert.equal(fs.existsSync(path.join(folder, asset.id)), false);
  assert.equal(
    (await req("/broadcast-assets/" + asset.id, "GET", undefined, worker))
      .status,
    404,
  );
});
test("a malformed pair request or foreign slot never opens a real socket or yields a fabricated code", async () => {
  assert.equal(
    (
      await req(
        "/whatsapp/pair",
        "POST",
        { slot: 3, phone: "0800", authoriseLinkedDevice: true },
        worker,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        "/whatsapp/pair",
        "POST",
        { slot: 1, phone: "2348000000077" },
        worker,
      )
    ).status,
    400,
  );
  assert.equal(
    (await req("/whatsapp/foreign/unlink", "POST", {}, other)).status,
    400,
  );
  assert.equal(
    (await req("/whatsapp", "GET", undefined, worker)).body.slots.length,
    0,
  );
});
test("private MP4 validation and GIF conversion really execute ffprobe/ffmpeg, rejecting unsupported encodings", async () => {
  const id = worker.user.id;
  let available = true;
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
  } catch {
    available = false;
  }
  if (!available) return;
  const mp4 = path.join(folder, "synthetic-input.mp4"),
    gif = path.join(folder, "synthetic-input.gif");
  try {
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=green:s=64x64:d=1",
      "-an",
      "-c:v",
      "libx264",
      "-threads",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4,
    ]);
    const video = await saveBroadcastAsset(
      db,
      folder,
      id,
      fs.readFileSync(mp4),
    );
    assert.equal(video.mime, "video/mp4");
    assert.ok(video.bytes > 0);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=32x32:d=1:r=3",
      "-threads",
      "1",
      gif,
    ]);
    const converted = await saveBroadcastAsset(
      db,
      folder,
      id,
      fs.readFileSync(gif),
    );
    assert.equal(converted.convertedGif, true);
    assert.equal(converted.mime, "video/mp4");
    assert.ok(fs.existsSync(path.join(folder, converted.id)));
  } finally {
    fs.rmSync(mp4, { force: true });
    fs.rmSync(gif, { force: true });
  }
});
test("automatic composer API enforces roles, CSRF, atomic owned ignores, immutable review, idempotency and private event feeds", async () => {
  const group = "120363000000000081@g.us",
    owner = worker.user.id,
    account = recordProviderPairing(db, {
      userId: owner,
      slot: 1,
      providerJid: "2348000000081@s.whatsapp.net",
      hashKey: "a".repeat(64),
    });
  syncProviderInventory(
    db,
    account.id,
    [
      {
        jid: group,
        subject: "SYNTHETIC API group",
        memberCount: 42,
        announce: false,
        userIsAdmin: true,
      },
    ],
    true,
  );
  db.prepare(
    "INSERT INTO broadcast_permissions VALUES(?,?,1,1,1,?,?,?,NULL)",
  ).run(
    account.id,
    group,
    "b".repeat(64),
    "SYNTHETIC admin consent",
    new Date(Date.now() + 86400000).toISOString(),
  );
  const original = manager.resolveIgnoreLink;
  manager.resolveIgnoreLink = async (user, link) => {
    assert.equal(user, owner);
    if (link.includes("invalid")) throw Error("Invalid invite");
    return {
      group_jid: group,
      subject: "SYNTHETIC API group",
      invite_hash: "f".repeat(64),
    };
  };
  try {
    assert.equal(
      (await req("/personal-posts/prepare", "POST", {}, advertiser)).status,
      403,
    );
    assert.equal(
      (
        await req("/personal-posts/prepare", "POST", {}, worker, {
          "X-CSRF-Token": "wrong",
        })
      ).status,
      403,
    );
    assert.equal((await req("/personal-posts/unknown/events")).status, 401);
    const before = db.prepare("SELECT * FROM wallets ORDER BY user_id").all();
    assert.equal(
      (
        await req(
          "/personal-posts/ignores",
          "POST",
          {
            links: [
              "https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV",
              "https://chat.whatsapp.com/invalid",
            ],
          },
          worker,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        db
          .prepare("SELECT COUNT(*) n FROM personal_ignored_groups")
          .get() as any
      ).n,
      0,
    );
    assert.equal(
      (
        await req(
          "/personal-posts/ignores",
          "POST",
          { links: ["https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRSTUV"] },
          worker,
        )
      ).status,
      200,
    );
    await req(
      "/personal-posts/ignores/remove",
      "POST",
      { groupJid: group },
      other,
    );
    assert.equal(
      (
        db
          .prepare(
            "SELECT COUNT(*) n FROM personal_ignored_groups WHERE user_id=?",
          )
          .get(owner) as any
      ).n,
      1,
    );
    const ignored = await req(
      "/personal-posts/prepare",
      "POST",
      { kind: "TEXT", mode: "ALLSTATUS", payload: "SYNTHETIC plain text" },
      worker,
    );
    assert.equal(ignored.status, 200);
    assert.equal(ignored.body.plan.targets.length, 0);
    assert.equal(
      (
        await req(
          "/personal-posts",
          "POST",
          { draftId: ignored.body.draftId, confirmed: true },
          worker,
        )
      ).status,
      400,
    );
    await req(
      "/personal-posts/ignores/remove",
      "POST",
      { groupJid: group },
      worker,
    );
    const draft = await req(
      "/personal-posts/prepare",
      "POST",
      { kind: "TEXT", mode: "ALLSTATUS", payload: "SYNTHETIC plain text" },
      worker,
    );
    assert.equal(draft.status, 200);
    assert.equal(draft.body.plan.targets.length, 1);
    assert.equal(
      (
        await req(
          "/personal-posts",
          "POST",
          { draftId: draft.body.draftId, confirmed: false },
          worker,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "/personal-posts",
          "POST",
          { draftId: draft.body.draftId, confirmed: true },
          other,
        )
      ).status,
      400,
    );
    const first = await req(
        "/personal-posts",
        "POST",
        { draftId: draft.body.draftId, confirmed: true },
        worker,
      ),
      repeat = await req(
        "/personal-posts",
        "POST",
        { draftId: draft.body.draftId, confirmed: true },
        worker,
      );
    assert.equal(first.status, 201);
    assert.equal(first.body.id, repeat.body.id);
    const feed = await req(
      `/personal-posts/${first.body.id}/events?after=0`,
      "GET",
      undefined,
      worker,
    );
    assert.equal(feed.status, 200);
    assert.equal(feed.body.events[0].kind, "QUEUED");
    assert.equal(
      (
        await req(
          `/personal-posts/${first.body.id}/events`,
          "GET",
          undefined,
          other,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await req(
          `/personal-posts/${first.body.id}/events`,
          "GET",
          undefined,
          advertiser,
        )
      ).status,
      403,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM wallets ORDER BY user_id").all(),
      before,
    );
  } finally {
    manager.resolveIgnoreLink = original;
  }
});
test.after(async () => {
  await manager.close();
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
  fs.rmSync(folder, { recursive: true, force: true });
});
