import { transaction, type Database } from "./database";
import { appendBroadcastEvent } from "./broadcastEvents";
import { finishPersonalRun, skipDependentChat } from "./personalDispatch";
// Plogme 2.1.0 emits status=0 + a numeric messageStubParameters[0] from
// handleBadAck. Ordinary receipt statuses are NOT verified delivery evidence.
export function recordPersonalProviderErrors(
  db: Database,
  accountId: string,
  updates: unknown,
) {
  if (!Array.isArray(updates)) return 0;
  let changed = 0;
  for (const value of updates.slice(0, 500)) {
    const key = value?.key,
      update = value?.update,
      code = update?.messageStubParameters?.[0];
    if (
      update?.status !== 0 ||
      key?.fromMe !== true ||
      typeof key?.id !== "string" ||
      typeof key?.remoteJid !== "string" ||
      typeof code !== "string" ||
      !/^\d{3}$/.test(code)
    )
      continue;
    changed += transaction(db, () => {
      const p = db
        .prepare(
          `SELECT p.*,t.run_id,t.group_jid,g.subject FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id LEFT JOIN group_inventory g ON g.account_id=t.account_id AND g.group_jid=t.group_jid WHERE r.purpose='PERSONAL' AND t.account_id=? AND t.group_jid=? AND p.provider_message_id=? AND p.status IN('SENDING','ACCEPTED','UNKNOWN')`,
        )
        .get(accountId, key.remoteJid, key.id) as any;
      if (!p) return 0;
      const reason = `WhatsApp reported an error for this post (${code}). ${code === "403" ? "Posting is restricted." : code === "404" || code === "410" ? "The group is unavailable." : "Check this number and its posting rights."} Check WhatsApp before starting a new post; some recipients may already have seen it. Nothing was retried.`;
      db.prepare(
        "UPDATE broadcast_placements SET status='FAILED',failure_reason=? WHERE id=?",
      ).run(reason, p.id);
      appendBroadcastEvent(
        db,
        p.run_id,
        `${p.id}:provider-error`,
        "FAILED",
        reason,
        p,
      );
      skipDependentChat(db, p);
      finishPersonalRun(db, p.run_id);
      return 1;
    });
  }
  return changed;
}
