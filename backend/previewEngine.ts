import { createHash } from "node:crypto";
import type { Database } from "./database";
import { destination, safePreview, type SafePreview } from "./safePreview";
export function completePreview(p: SafePreview): boolean {
  if (
    !p ||
    !p.title?.trim() ||
    !p.description?.trim() ||
    p.previewType !== 5 ||
    !p.thumbnailBase64 ||
    !p.inlineThumbnailBase64
  )
    return false;
  if (
    p.thumbnailBase64.length > 466672 ||
    p.inlineThumbnailBase64.length > 43692 ||
    !Number.isInteger(p.thumbnailWidth) ||
    !Number.isInteger(p.thumbnailHeight) ||
    p.thumbnailWidth! < 48 ||
    p.thumbnailHeight! < 48 ||
    p.thumbnailWidth! > 1000 ||
    p.thumbnailHeight! > 1000
  )
    return false;
  for (const text of [p.thumbnailBase64, p.inlineThumbnailBase64]) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return false;
    const b = Buffer.from(text, "base64");
    if (!b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return false;
  }
  return true;
}
export function migratePreviewCache(db: Database) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS link_preview_cache(cache_key TEXT PRIMARY KEY,payload_json TEXT NOT NULL,bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 600000),expires_at INTEGER NOT NULL,last_used_at INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS link_preview_expiry ON link_preview_cache(expires_at);`,
  );
  db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(8,?)").run(
    new Date().toISOString(),
  );
}
type Entry = { value: SafePreview; expires: number; bytes: number };
type Waiter = {
  start: () => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
export class PreviewEngine {
  private memory = new Map<string, Entry>();
  private used = 0;
  private flights = new Map<string, Promise<SafePreview>>();
  private waiting: Waiter[] = [];
  private active = 0;
  private closed = false;
  readonly metrics = {
    hits: 0,
    misses: 0,
    joined: 0,
    stored: 0,
    partial: 0,
    busy: 0,
    peakActive: 0,
  };
  constructor(
    private options: {
      db?: Database;
      fetcher?: (url: string) => Promise<SafePreview>;
      now?: () => number;
      ttlMs?: number;
      maxActive?: number;
      maxQueued?: number;
      memoryBytes?: number;
      diskBytes?: number;
    } = {},
  ) {}
  private now() {
    return this.options.now?.() ?? Date.now();
  }
  private remember(key: string, value: SafePreview, expires: number) {
    const bytes = Buffer.byteLength(JSON.stringify(value));
    const previous = this.memory.get(key);
    if (previous) {
      this.used -= previous.bytes;
      this.memory.delete(key);
    }
    while (
      this.memory.size >= 64 ||
      this.used + bytes > (this.options.memoryBytes ?? 8 * 1024 * 1024)
    ) {
      const first = this.memory.keys().next().value;
      if (!first) break;
      this.used -= this.memory.get(first)!.bytes;
      this.memory.delete(first);
    }
    if (bytes <= (this.options.memoryBytes ?? 8 * 1024 * 1024)) {
      this.memory.set(key, {
        value: Object.freeze({ ...value }),
        expires,
        bytes,
      });
      this.used += bytes;
    }
  }
  private read(key: string): SafePreview | undefined {
    const memory = this.memory.get(key);
    if (memory && memory.expires > this.now()) {
      this.memory.delete(key);
      this.memory.set(key, memory);
      return memory.value;
    }
    if (memory) {
      this.used -= memory.bytes;
      this.memory.delete(key);
    }
    const db = this.options.db;
    if (!db) return;
    try {
      const row = db
        .prepare(
          "SELECT payload_json,expires_at FROM link_preview_cache WHERE cache_key=? AND expires_at>? AND bytes<=600000",
        )
        .get(key, this.now()) as any;
      if (!row) return;
      const value = JSON.parse(row.payload_json);
      if (!completePreview(value)) {
        db.prepare("DELETE FROM link_preview_cache WHERE cache_key=?").run(key);
        return;
      }
      db.prepare(
        "UPDATE link_preview_cache SET last_used_at=? WHERE cache_key=?",
      ).run(this.now(), key);
      this.remember(key, value, row.expires_at);
      return value;
    } catch {
      /* Cache failure is not a reason to fabricate or block a usable preview. */
    }
  }
  private store(key: string, value: SafePreview) {
    const expires = this.now() + (this.options.ttlMs ?? 6 * 60 * 60 * 1000);
    this.remember(key, value, expires);
    this.metrics.stored++;
    const db = this.options.db;
    if (!db) return;
    try {
      const payload = JSON.stringify(value),
        bytes = Buffer.byteLength(payload);
      if (bytes > 600000) return;
      db.prepare("DELETE FROM link_preview_cache WHERE expires_at<=?").run(
        this.now(),
      );
      db.prepare(
        "INSERT INTO link_preview_cache VALUES(?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,bytes=excluded.bytes,expires_at=excluded.expires_at,last_used_at=excluded.last_used_at",
      ).run(key, payload, bytes, expires, this.now());
      for (;;) {
        const stat = db
          .prepare(
            "SELECT COUNT(*) n,COALESCE(SUM(bytes),0) bytes FROM link_preview_cache",
          )
          .get() as any;
        if (
          stat.n <= 256 &&
          stat.bytes <= (this.options.diskBytes ?? 32 * 1024 * 1024)
        )
          break;
        db.prepare(
          "DELETE FROM link_preview_cache WHERE cache_key=(SELECT cache_key FROM link_preview_cache ORDER BY last_used_at,cache_key LIMIT 1)",
        ).run();
      }
    } catch {
      /* A cache write failure must not change the prepared content. */
    }
  }
  async get(input: string): Promise<SafePreview> {
    if (this.closed) throw Error("Preview engine closed");
    const url = destination(input);
    url.hash = "";
    const key = createHash("sha256").update(url.href).digest("hex"),
      cached = this.read(key);
    if (cached) {
      this.metrics.hits++;
      return { ...cached, "matched-text": input };
    }
    const existing = this.flights.get(key);
    if (existing) {
      this.metrics.joined++;
      return { ...(await existing), "matched-text": input };
    }
    if (
      this.flights.size >=
      (this.options.maxQueued ?? 48) + (this.options.maxActive ?? 4)
    ) {
      this.metrics.busy++;
      throw Error("Preview service is busy. Review again shortly");
    }
    this.metrics.misses++;
    const job = this.schedule(async () => {
      const p = await (this.options.fetcher ?? safePreview)(url.href);
      if (completePreview(p)) this.store(key, p);
      else this.metrics.partial++;
      return p;
    });
    this.flights.set(key, job);
    try {
      return { ...(await job), "matched-text": input };
    } finally {
      if (this.flights.get(key) === job) this.flights.delete(key);
    }
  }
  private schedule(fn: () => Promise<SafePreview>): Promise<SafePreview> {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.active++;
        this.metrics.peakActive = Math.max(
          this.metrics.peakActive,
          this.active,
        );
        fn()
          .then(resolve, reject)
          .finally(() => {
            this.active--;
            const next = this.waiting.shift();
            if (next) {
              clearTimeout(next.timer);
              next.start();
            }
          });
      };
      if (this.active < (this.options.maxActive ?? 4)) {
        run();
        return;
      }
      if (this.waiting.length >= (this.options.maxQueued ?? 48)) {
        this.metrics.busy++;
        reject(Error("Preview service is busy. Review again shortly"));
        return;
      }
      const waiter: Waiter = {
        start: run,
        reject,
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(waiter);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(Error("Preview queue timed out. Review again shortly"));
        }, 16000),
      };
      this.waiting.push(waiter);
    });
  }
  close() {
    this.closed = true;
    for (const item of this.waiting) {
      clearTimeout(item.timer);
      item.reject(Error("Preview engine closed"));
    }
    this.waiting = [];
    this.memory.clear();
    this.used = 0;
  }
}
