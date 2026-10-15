import type { Database } from "./database";
import { appendBroadcastEvent } from "./broadcastEvents";
export function personalDelay(value: unknown = 10): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 10 ||
    value > 60
  )
    throw Error("Choose a whole-number delay from 10 to 60 seconds");
  return value;
}
export function migratePersonalPacing(db: Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS personal_run_pacing(run_id TEXT PRIMARY KEY REFERENCES broadcast_runs(id),delay_seconds INTEGER NOT NULL CHECK(delay_seconds BETWEEN 10 AND 60));
 CREATE TRIGGER IF NOT EXISTS personal_pacing_immutable BEFORE UPDATE ON personal_run_pacing BEGIN SELECT RAISE(ABORT,'Reviewed delay is immutable');END;
 CREATE TABLE IF NOT EXISTS personal_owner_queue(user_id TEXT PRIMARY KEY REFERENCES users(id),next_group_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS personal_completed_groups(target_id TEXT PRIMARY KEY REFERENCES broadcast_targets(id),finished_at TEXT NOT NULL);
 `);
  db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(7,?)").run(
    new Date().toISOString(),
  );
}
// Call inside the same transaction as the outcome. One checkpoint for both legs,
// including late rejections/restart recovery; never sleep while holding SQLite.
export function settlePersonalGroup(
  db: Database,
  targetId: string,
  atMs = Date.now(),
) {
  const t = db
    .prepare(
      `SELECT t.*,r.user_id,COALESCE(o.delay_seconds,10) delay_seconds FROM broadcast_targets t JOIN broadcast_runs r ON r.id=t.run_id LEFT JOIN personal_run_pacing o ON o.run_id=r.id WHERE t.id=? AND r.purpose='PERSONAL' AND NOT EXISTS(SELECT 1 FROM broadcast_placements p WHERE p.target_id=t.id AND p.status IN('RESERVED','SENDING'))`,
    )
    .get(targetId) as any;
  if (!t) return;
  const changed = db
    .prepare("INSERT OR IGNORE INTO personal_completed_groups VALUES(?,?)")
    .run(targetId, new Date(atMs).toISOString());
  if (!changed.changes) return;
  // A failed preflight did not send anything. Do not impose a post-send pause.
  if (
    !db
      .prepare(
        "SELECT 1 FROM broadcast_placements WHERE target_id=? AND sent_at IS NOT NULL",
      )
      .get(targetId)
  )
    return;
  const readyAt = new Date(atMs + t.delay_seconds * 1000).toISOString();
  db.prepare(
    `INSERT INTO personal_owner_queue VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET next_group_at=MAX(next_group_at,excluded.next_group_at)`,
  ).run(t.user_id, readyAt);
  const next = db
    .prepare(
      `SELECT p.id,t.group_jid,g.subject FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id LEFT JOIN group_inventory g ON g.account_id=t.account_id AND g.group_jid=t.group_jid WHERE t.run_id=? AND p.status='RESERVED' ORDER BY t.rowid,CASE p.surface WHEN 'GROUP_STATUS' THEN 0 ELSE 1 END LIMIT 1`,
    )
    .get(t.run_id) as any;
  if (next)
    appendBroadcastEvent(
      db,
      t.run_id,
      `${targetId}:pause`,
      "WAITING",
      `Pausing ${t.delay_seconds} seconds before the next group.`,
      { group_jid: next.group_jid, subject: next.subject },
    );
}
export function personalPacingFeed(
  db: Database,
  user: string,
  run: string,
  atMs = Date.now(),
) {
  const delay =
    (
      db
        .prepare("SELECT delay_seconds FROM personal_run_pacing WHERE run_id=?")
        .get(run) as any
    )?.delay_seconds ?? 10;
  const next = db
    .prepare(
      `SELECT t.group_jid,g.subject,p.surface,p.status FROM broadcast_targets t JOIN broadcast_placements p ON p.target_id=t.id LEFT JOIN group_inventory g ON g.account_id=t.account_id AND g.group_jid=t.group_jid WHERE t.run_id=? AND p.status IN('RESERVED','SENDING') ORDER BY t.rowid,CASE p.surface WHEN 'GROUP_STATUS' THEN 0 ELSE 1 END LIMIT 1`,
    )
    .get(run) as any;
  const earlier = !!db
    .prepare(
      `SELECT 1 FROM broadcast_runs older JOIN broadcast_runs current ON current.id=? WHERE older.user_id=? AND older.purpose='PERSONAL' AND older.rowid<current.rowid AND older.status IN('QUEUED','RUNNING') AND EXISTS(SELECT 1 FROM broadcast_targets t JOIN broadcast_placements p ON p.target_id=t.id WHERE t.run_id=older.id AND p.status IN('RESERVED','SENDING'))`,
    )
    .get(run, user);
  const readyAt =
    (
      db
        .prepare(
          "SELECT next_group_at FROM personal_owner_queue WHERE user_id=?",
        )
        .get(user) as any
    )?.next_group_at ?? null;
  return {
    delaySeconds: delay,
    readyAt: next?.status === "RESERVED" && !earlier ? readyAt : null,
    remainingSeconds:
      next?.status === "RESERVED" && !earlier && readyAt
        ? Math.max(0, Math.ceil((Date.parse(readyAt) - atMs) / 1000))
        : 0,
    waitingForEarlierPost: !!next && earlier,
    nextGroup: next
      ? {
          name: next.subject || "Your group",
          groupJid: next.group_jid,
          surface: next.surface,
          state: next.status,
        }
      : null,
  };
}
