import { createHmac, createHash, randomBytes, randomUUID } from "node:crypto";
import { type Database, transaction } from "./database";
import { WaVault } from "./waVault";
import {
  recordProviderPairing,
  syncProviderInventory,
  type ScannedGroup,
} from "./inventory";
const stamp = () => new Date().toISOString();
export type WaOptions = {
  encryptionKey: string;
  identityKey: string;
  loadLibrary?: () => Promise<any>;
};
export class WhatsAppManager {
  readonly enabled = true;
  private vault: WaVault;
  private live = new Map<string, any>();
  private closing = false;
  private library: any;
  constructor(
    private db: Database,
    private options: WaOptions,
  ) {
    this.vault = new WaVault(db, options.encryptionKey);
    if (!/^[a-f0-9]{64}$/.test(options.identityKey))
      throw Error("Persistent WhatsApp identity key is required");
  }
  private hash(s: string) {
    return createHmac("sha256", this.options.identityKey)
      .update(s)
      .digest("hex");
  }
  private async lib() {
    if (!this.library) {
      const name = "plogme";
      this.library = await (this.options.loadLibrary
        ? this.options.loadLibrary()
        : import(name));
    }
    return this.library;
  }
  private owned(user: string, id: string) {
    const s = this.db
      .prepare("SELECT * FROM wa_slots WHERE id=? AND user_id=?")
      .get(id, user) as any;
    if (!s) throw Error("WhatsApp slot not found");
    return s;
  }
  slots(user: string) {
    return (
      this.db
        .prepare(
          "SELECT id,slot,phone_label,status,account_id,attempt_expires_at,paid_opt_in,last_error,updated_at FROM wa_slots WHERE user_id=? ORDER BY slot",
        )
        .all(user) as any[]
    ).map((s) => ({
      ...s,
      code:
        s.status === "PAIRING" && s.attempt_expires_at > stamp()
          ? this.vault.read(s.id, "pairing-code")
          : null,
    }));
  }
  async pair(user: string, slot: number, phone: unknown) {
    if (
      ![1, 2].includes(slot) ||
      typeof phone !== "string" ||
      !/^\d{7,15}$/.test(phone) ||
      phone.startsWith("0")
    )
      throw Error(
        "Choose slot 1 or 2 and enter an international number without + or spaces",
      );
    const old = this.db
      .prepare("SELECT * FROM wa_slots WHERE user_id=? AND slot=?")
      .get(user, slot) as any;
    if (
      old &&
      (["ONLINE", "PAIRING", "OFFLINE"].includes(old.status) ||
        (old.account_id && old.status === "ERROR"))
    )
      throw Error("Cancel or unlink this slot before pairing again");
    const jid = phone + "@s.whatsapp.net",
      h = this.hash(jid),
      prior = this.db
        .prepare(
          "SELECT original_user_id FROM paired_numbers_history WHERE jid_hash=?",
        )
        .get(h) as any;
    if (prior && prior.original_user_id !== user)
      throw Error("This number is not available for this owner account");
    if (
      this.db
        .prepare(
          "SELECT 1 FROM wa_slots WHERE phone_hash=? AND status IN('ONLINE','PAIRING','OFFLINE')",
        )
        .get(h)
    )
      throw Error(
        "This number already has an active connection or pairing attempt",
      );
    const id = old?.id || randomUUID(),
      now = stamp();
    if (old) this.vault.remove(id);
    this.db
      .prepare(
        `INSERT INTO wa_slots(id,user_id,slot,phone_hash,phone_label,status,attempt_expires_at,created_at,updated_at) VALUES(?,?,?,?,?,'PAIRING',?,?,?)
 ON CONFLICT(user_id,slot) DO UPDATE SET phone_hash=excluded.phone_hash,phone_label=excluded.phone_label,status='PAIRING',account_id=NULL,paid_opt_in=0,attempt_expires_at=excluded.attempt_expires_at,last_error=NULL,updated_at=excluded.updated_at`,
      )
      .run(
        id,
        user,
        slot,
        h,
        "•••• " + phone.slice(-4),
        new Date(Date.now() + 180000).toISOString(),
        now,
        now,
      );
    const attempt = randomUUID();
    this.vault.write(id, "attempt-id", attempt);
    this.vault.write(id, "requested-phone", phone);
    try {
      await this.connect(id);
    } catch {
      if (this.vault.read(id, "attempt-id") === attempt) {
        this.update(
          id,
          "ERROR",
          "WhatsApp could not start a connection. Retry after cancelling this attempt.",
        );
        this.vault.remove(id);
      }
      throw Error("WhatsApp connection could not be started");
    }
    return { id };
  }
  private update(id: string, status: string, error: string | null = null) {
    this.db
      .prepare(
        "UPDATE wa_slots SET status=?,last_error=?,updated_at=? WHERE id=?",
      )
      .run(status, error, stamp(), id);
    const s = this.db
      .prepare("SELECT account_id FROM wa_slots WHERE id=?")
      .get(id) as any;
    if (s?.account_id)
      this.db
        .prepare("UPDATE paired_accounts SET status=? WHERE id=?")
        .run(
          status === "ONLINE"
            ? "ONLINE"
            : status === "LOGGED_OUT"
              ? "DISCONNECTED"
              : "OFFLINE",
          s.account_id,
        );
  }
  private async connect(id: string, retry = 0) {
    if (this.closing || this.live.has(id)) return;
    const row = this.db
      .prepare("SELECT * FROM wa_slots WHERE id=?")
      .get(id) as any;
    if (!row) return;
    const runtime: any = { socket: null, retry, requested: false, timer: null };
    this.live.set(id, runtime);
    const current = () => !this.closing && this.live.get(id) === runtime;
    let p: any;
    try {
      p = await this.lib();
    } catch (e) {
      if (this.live.get(id) === runtime) this.live.delete(id);
      throw e;
    }
    if (!current()) return;
    const saved = this.vault.read(id, "creds"),
      creds = saved
        ? JSON.parse(saved, p.BufferJSON.reviver)
        : p.initAuthCreds();
    const auth = {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const out: any = {};
          for (const key of ids) {
            const value = this.vault.read(id, `key:${type}:${key}`);
            let parsed = value ? JSON.parse(value, p.BufferJSON.reviver) : null;
            if (parsed && type === "app-state-sync-key")
              parsed = p.proto.Message.AppStateSyncKeyData.fromObject(parsed);
            out[key] = parsed;
          }
          return out;
        },
        set: async (data: any) => {
          if (!current()) return;
          transaction(this.db, () => {
            for (const type of Object.keys(data))
              for (const key of Object.keys(data[type])) {
                const value = data[type][key];
                if (value == null) this.vault.remove(id, `key:${type}:${key}`);
                else
                  this.vault.write(
                    id,
                    `key:${type}:${key}`,
                    JSON.stringify(value, p.BufferJSON.replacer),
                  );
              }
          });
        },
      },
    };
    const logger: any = {
      level: "silent",
      trace() {},
      debug() {},
      info() {},
      warn() {},
      error() {},
      fatal() {},
      child() {
        return logger;
      },
    };
    try {
      runtime.socket = p.default({
        auth,
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        shouldSyncHistoryMessage: () => false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined,
      });
    } catch (e) {
      this.live.delete(id);
      throw e;
    }
    const sock = runtime.socket;
    sock.ev.on("creds.update", (update: any) => {
      Object.assign(creds, update);
      if (current())
        this.vault.write(
          id,
          "creds",
          JSON.stringify(creds, p.BufferJSON.replacer),
        );
    });
    if (!creds.registered)
      runtime.timer = setTimeout(
        () => {
          if (current()) {
            this.live.delete(id);
            sock.end(new Error("Pairing attempt expired"));
            this.update(
              id,
              "EXPIRED",
              "Pairing attempt expired. Generate a new private code.",
            );
            this.vault.remove(id);
          }
        },
        Math.max(1, Date.parse(row.attempt_expires_at) - Date.now()),
      );
    sock.ev.on("connection.update", (event: any) => {
      void (async () => {
        if (!current()) return;
        if (event.qr && !creds.registered && !runtime.requested) {
          runtime.requested = true;
          const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ",
            secret = [...randomBytes(8)].map((n) => alphabet[n & 31]).join("");
          const code = await sock.requestPairingCode(
            this.vault.read(id, "requested-phone"),
            secret,
          );
          if (current()) this.vault.write(id, "pairing-code", String(code));
        }
        if (event.connection === "open") {
          const normalized = p.jidNormalizedUser(
            sock.user?.id || creds.me?.id || "",
          );
          if (
            !/^\d{7,15}@s\.whatsapp\.net$/.test(normalized) ||
            this.hash(normalized) !== row.phone_hash
          )
            throw Error("Provider account did not match requested phone");
          const a = recordProviderPairing(this.db, {
            userId: row.user_id,
            slot: row.slot,
            providerJid: normalized,
            hashKey: this.options.identityKey,
          });
          this.db
            .prepare(
              "UPDATE wa_slots SET account_id=?,attempt_expires_at=NULL WHERE id=?",
            )
            .run(a.id, id);
          this.vault.remove(id, "pairing-code");
          if (runtime.timer) clearTimeout(runtime.timer);
          this.update(id, "ONLINE");
          await this.scanAccount(a.id);
        }
        if (event.connection === "close") {
          this.live.delete(id);
          if (runtime.timer) clearTimeout(runtime.timer);
          const status = event.lastDisconnect?.error?.output?.statusCode;
          if (status === 401 || status === 403) {
            this.update(
              id,
              "LOGGED_OUT",
              "WhatsApp ended this linked-device session. Pair again.",
            );
            this.vault.remove(id);
          } else {
            this.update(
              id,
              creds.registered ? "OFFLINE" : "ERROR",
              "Connection closed. Reconnect or generate a new pairing attempt.",
            );
            if (creds.registered && retry < 3 && !this.closing)
              setTimeout(
                () => {
                  void this.connect(id, retry + 1).catch(() =>
                    this.update(
                      id,
                      "OFFLINE",
                      "Reconnect failed. Use Reconnect.",
                    ),
                  );
                },
                Math.min(60000, 5000 * 2 ** retry),
              ).unref();
          }
        }
      })().catch(() => {
        if (current()) {
          this.live.delete(id);
          if (runtime.timer) clearTimeout(runtime.timer);
          sock.end(new Error("Session validation stopped"));
          this.update(
            id,
            "ERROR",
            "Session validation or sync failed. No connection is claimed.",
          );
        }
      });
    });
    sock.ev.on("messages.upsert", (data: any) => {
      if (current())
        for (const message of data.messages || [])
          void this.approveFromMessage(id, message).catch(() => {});
    });
    sock.ev.on("group-participants.update", (event: any) => {
      if (!current()) return;
      void (async () => {
        const s = this.db
          .prepare("SELECT account_id FROM wa_slots WHERE id=?")
          .get(id) as any;
        if (!s?.account_id) return;
        const p = await this.lib(),
          own = this.identities(sock, p);
        if (
          event.action === "remove" &&
          (event.participants || []).some((v: any) =>
            own.has(p.jidNormalizedUser(typeof v === "string" ? v : v.id)),
          )
        ) {
          this.recordRemoval(s.account_id, event.id);
        } else await this.refreshGroup(s.account_id, event.id);
      })().catch(() => {});
    });
    sock.ev.on("groups.update", (groups: any[]) => {
      if (current())
        for (const g of groups)
          if (g.id)
            void this.refreshGroup(this.accountForSlot(id), g.id).catch(
              () => {},
            );
    });
  }
  private recordRemoval(accountId: string, jid: string) {
    const a = this.db
      .prepare("SELECT user_id FROM paired_accounts WHERE id=?")
      .get(accountId) as any;
    if (!a) return;
    transaction(this.db, () => {
      this.db
        .prepare(
          "INSERT INTO broadcast_removals VALUES(?,?,?,?,NULL) ON CONFLICT(user_id,group_jid) DO UPDATE SET source_account_id=excluded.source_account_id,removed_at=excluded.removed_at,cleared_at=NULL",
        )
        .run(a.user_id, jid, accountId, stamp());
      this.db
        .prepare(
          "UPDATE broadcast_permissions SET revoked_at=? WHERE group_jid=? AND account_id IN(SELECT id FROM paired_accounts WHERE user_id=?)",
        )
        .run(stamp(), jid, a.user_id);
      this.db
        .prepare(
          "UPDATE group_inventory SET is_member=0 WHERE account_id=? AND group_jid=?",
        )
        .run(accountId, jid);
    });
  }
  private accountForSlot(id: string) {
    return (
      this.db
        .prepare("SELECT account_id FROM wa_slots WHERE id=?")
        .get(id) as any
    )?.account_id;
  }
  private identities(sock: any, p: any) {
    return new Set(
      [sock.user?.id, sock.user?.lid]
        .filter(Boolean)
        .map((j: string) => p.jidNormalizedUser(j)),
    );
  }
  private socket(accountId: string) {
    const s = this.db
      .prepare("SELECT * FROM wa_slots WHERE account_id=? AND status='ONLINE'")
      .get(accountId) as any;
    const sock = s && this.live.get(s.id)?.socket;
    if (!sock) throw Error("Number is offline. Reconnect before continuing");
    return sock;
  }
  private async snapshot(
    sock: any,
    metadata: any,
  ): Promise<ScannedGroup & { isMember: boolean; adminIds: Set<string> }> {
    const p = await this.lib(),
      own = this.identities(sock, p),
      participants = metadata.participants || [],
      me = participants.find(
        (v: any) =>
          own.has(p.jidNormalizedUser(v.id)) ||
          own.has(p.jidNormalizedUser(v.phoneNumber || "")),
      );
    return {
      jid: metadata.id,
      subject: String(metadata.subject || "").slice(0, 250),
      memberCount: Number.isSafeInteger(metadata.size)
        ? metadata.size
        : participants.length,
      announce: !!metadata.announce,
      userIsAdmin: !!me?.admin,
      isMember: !!me,
      adminIds: new Set(
        participants
          .filter((v: any) => !!v.admin)
          .flatMap((v: any) => [
            p.jidNormalizedUser(v.id),
            p.jidNormalizedUser(v.phoneNumber || ""),
          ])
          .filter(Boolean),
      ),
    };
  }
  async scanAccount(accountId: string) {
    const sock = this.socket(accountId),
      all = await sock.groupFetchAllParticipating();
    const groups = [];
    for (const metadata of Object.values(all))
      groups.push(await this.snapshot(sock, metadata));
    if (this.socket(accountId) !== sock)
      throw Error("Session changed during scan");
    const currentGroups = new Set(
      groups.filter((g) => g.isMember).map((g) => g.jid),
    );
    for (const old of this.db
      .prepare(
        "SELECT group_jid FROM group_inventory WHERE account_id=? AND is_member=1",
      )
      .all(accountId) as any[])
      if (!currentGroups.has(old.group_jid))
        this.recordRemoval(accountId, old.group_jid);
    syncProviderInventory(
      this.db,
      accountId,
      groups.filter((g) => g.isMember),
      true,
    );
    return { scanned: groups.length };
  }
  async scan(user: string, id: string) {
    const s = this.owned(user, id);
    if (!s.account_id) throw Error("Pair this number first");
    return this.scanAccount(s.account_id);
  }
  async refreshGroup(accountId: string, jid: string) {
    const sock = this.socket(accountId);
    try {
      const g = await this.snapshot(sock, await sock.groupMetadata(jid));
      if (this.socket(accountId) !== sock) throw Error("Session changed");
      if (!g.isMember) this.recordRemoval(accountId, jid);
      this.db
        .prepare(
          "UPDATE group_inventory SET member_count=?,announce=?,user_is_admin=?,is_member=?,subject=?,synced_at=? WHERE account_id=? AND group_jid=?",
        )
        .run(
          g.memberCount,
          Number(g.announce),
          Number(g.userIsAdmin),
          Number(g.isMember),
          g.subject,
          stamp(),
          accountId,
          jid,
        );
      return g;
    } catch {
      throw Error("Current group membership/permissions could not be verified");
    }
  }
  async reconnect(user: string, id: string) {
    const s = this.owned(user, id);
    if (
      !["OFFLINE", "ERROR"].includes(s.status) ||
      !this.vault.read(id, "creds")
    )
      throw Error("This slot needs a new pairing attempt");
    if (this.live.has(id))
      throw Error("A connection attempt is already active");
    await this.connect(id);
    return { success: true };
  }
  async unlink(user: string, id: string) {
    const s = this.owned(user, id),
      live = this.live.get(id);
    this.live.delete(id);
    if (live?.timer) clearTimeout(live.timer);
    let remoteUnlinked = false;
    if (live?.socket) {
      try {
        await live.socket.logout();
        remoteUnlinked = true;
      } catch {
        live.socket.end(new Error("Owner disconnected locally"));
      }
    }
    transaction(this.db, () => {
      this.vault.remove(id);
      this.update(
        id,
        "LOGGED_OUT",
        remoteUnlinked
          ? null
          : "Locally disconnected. Also remove this linked device in WhatsApp if it remains listed.",
      );
      this.db.prepare("UPDATE wa_slots SET paid_opt_in=0 WHERE id=?").run(id);
      if (s.account_id) {
        this.db
          .prepare(
            "UPDATE group_approval_requests SET expires_at=? WHERE account_id=? AND approved_at IS NULL",
          )
          .run(stamp(), s.account_id);
        this.db
          .prepare(
            "UPDATE broadcast_permissions SET revoked_at=? WHERE account_id=?",
          )
          .run(stamp(), s.account_id);
        this.db
          .prepare("UPDATE group_inventory SET is_member=0 WHERE account_id=?")
          .run(s.account_id);
      }
    });
    return { success: true, remoteUnlinked };
  }
  async requestApproval(
    user: string,
    accountId: string,
    jid: string,
    scopes: { status: boolean; chat: boolean; mentions: boolean },
  ) {
    const a = this.db
      .prepare("SELECT 1 FROM paired_accounts WHERE id=? AND user_id=?")
      .get(accountId, user);
    if (!a) throw Error("Group not found");
    if ((!scopes.status && !scopes.chat) || (scopes.mentions && !scopes.chat))
      throw Error("Choose valid placement permissions");
    const originalSocket = this.socket(accountId),
      g = await this.refreshGroup(accountId, jid);
    if (this.socket(accountId) !== originalSocket)
      throw Error("Session changed during approval");
    if (!g.isMember) throw Error("Not a current group member");
    if (g.userIsAdmin) {
      transaction(this.db, () => {
        this.grant(
          accountId,
          jid,
          scopes,
          this.hash("self-admin:" + accountId),
          "owner-admin:" + randomUUID(),
        );
      });
      return { approved: true };
    }
    const token = randomBytes(24).toString("hex"),
      id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO group_approval_requests VALUES(?,?,?,?,?,?,?,?,?,NULL)",
      )
      .run(
        id,
        user,
        accountId,
        jid,
        createHash("sha256").update(token).digest("hex"),
        Number(scopes.status),
        Number(scopes.chat),
        Number(scopes.mentions),
        new Date(Date.now() + 15 * 60000).toISOString(),
      );
    return {
      approved: false,
      expiresMinutes: 15,
      instructions: `PappyPay permission request: approve ${scopes.status ? "group-status posts; " : ""}${scopes.chat ? "group-chat posts; " : ""}${scopes.mentions ? "mention-all notifications; " : ""}from this account for approved broadcasts for 30 days, or until revoked. Only approve if you administer this group and agree. To approve, send this exact command IN THIS GROUP within 15 minutes:\n!pappypay approve ${token}`,
    };
  }
  private grant(
    accountId: string,
    jid: string,
    scopes: { status: boolean; chat: boolean; mentions: boolean },
    actor: string,
    evidence: string,
  ) {
    this.db
      .prepare(
        "UPDATE broadcast_removals SET cleared_at=? WHERE group_jid=? AND user_id=(SELECT user_id FROM paired_accounts WHERE id=?)",
      )
      .run(stamp(), jid, accountId);
    this.db
      .prepare(
        `INSERT INTO broadcast_permissions VALUES(?,?,?,?,?,?,?, ?,NULL) ON CONFLICT(account_id,group_jid) DO UPDATE SET status_allowed=excluded.status_allowed,chat_allowed=excluded.chat_allowed,mentions_allowed=excluded.mentions_allowed,approved_by_hash=excluded.approved_by_hash,evidence_reference=excluded.evidence_reference,expires_at=excluded.expires_at,revoked_at=NULL`,
      )
      .run(
        accountId,
        jid,
        Number(scopes.status),
        Number(scopes.chat),
        Number(scopes.mentions),
        actor,
        evidence,
        new Date(Date.now() + 30 * 86400000).toISOString(),
      );
  }
  private async approveFromMessage(id: string, m: any) {
    const text =
        m.message?.conversation || m.message?.extendedTextMessage?.text || "",
      match = text.trim().match(/^!pappypay approve ([a-f0-9]{48})$/);
    if (!match || !m.key?.remoteJid?.endsWith("@g.us")) return;
    const accountId = this.accountForSlot(id);
    const r = this.db
      .prepare(
        "SELECT * FROM group_approval_requests WHERE token_hash=? AND account_id=? AND group_jid=? AND approved_at IS NULL AND expires_at>?",
      )
      .get(
        createHash("sha256").update(match[1]).digest("hex"),
        accountId,
        m.key.remoteJid,
        stamp(),
      ) as any;
    if (!r) return;
    const sock = this.socket(accountId),
      g = await this.refreshGroup(accountId, r.group_jid),
      p = await this.lib(),
      author = p.jidNormalizedUser(
        m.key.fromMe ? sock.user.id : m.key.participant || "",
      );
    if (
      !g.isMember ||
      !g.adminIds.has(author) ||
      this.live.get(id)?.socket !== sock
    )
      return;
    transaction(this.db, () => {
      if (
        !this.db
          .prepare(
            "SELECT 1 FROM group_approval_requests WHERE id=? AND approved_at IS NULL AND expires_at>?",
          )
          .get(r.id, stamp())
      )
        return;
      this.grant(
        accountId,
        r.group_jid,
        {
          status: !!r.status_allowed,
          chat: !!r.chat_allowed,
          mentions: !!r.mentions_allowed,
        },
        this.hash(author),
        "provider-admin-message:" + m.key.id,
      );
      this.db
        .prepare("UPDATE group_approval_requests SET approved_at=? WHERE id=?")
        .run(stamp(), r.id);
    });
  }
  async send(accountId: string, jid: string, content: any, messageId: string) {
    return this.socket(accountId).sendMessage(jid, content, { messageId });
  }
  async messageId(accountId: string) {
    const p = await this.lib();
    return p.generateMessageIDV2(this.socket(accountId).user.id);
  }
  async start() {
    for (const s of this.db
      .prepare("SELECT id FROM wa_slots WHERE status='PAIRING'")
      .all() as any[]) {
      this.update(
        s.id,
        "EXPIRED",
        "Service restarted before pairing completed; generate a new code",
      );
      this.vault.remove(s.id);
    }
    for (const s of this.db
      .prepare("SELECT id FROM wa_slots WHERE status IN('ONLINE','OFFLINE')")
      .all() as any[]) {
      this.update(s.id, "OFFLINE");
      void this.connect(s.id).catch(() => {
        if (!this.closing)
          this.update(s.id, "OFFLINE", "Reconnect requires attention");
      });
    }
  }
  async close() {
    this.closing = true;
    for (const [id, r] of this.live) {
      if (r.timer) clearTimeout(r.timer);
      r.socket?.end(new Error("Service stopping"));
      const slot = this.db
        .prepare("SELECT status FROM wa_slots WHERE id=?")
        .get(id) as any;
      if (slot?.status === "PAIRING") {
        this.update(
          id,
          "EXPIRED",
          "Service stopped before pairing completed. Generate a new private code.",
        );
        this.vault.remove(id);
      } else this.update(id, "OFFLINE");
    }
    this.live.clear();
  }
}
