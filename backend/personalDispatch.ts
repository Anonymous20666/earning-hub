import { settlePersonalGroup } from "./personalPacing";
import fs from "node:fs";
import path from "node:path";
import { transaction, type Database } from "./database";
import { STATUS_COLORS } from "./personalComposer";
import { textPlacement, validPermission } from "./broadcasts";
import { appendBroadcastEvent } from "./personalComposer";
import type { WhatsAppManager } from "./whatsapp";
export type PersonalTransport = Pick<
  WhatsAppManager,
  "refreshGroup" | "messageId" | "send"
>;
const stamp = () => new Date().toISOString();
export function finishPersonalRun(db: Database, run: string) {
  const changed = db
    .prepare(
      `UPDATE broadcast_runs SET status='FINISHED' WHERE id=? AND status IN('RUNNING','QUEUED') AND NOT EXISTS(SELECT 1 FROM broadcast_targets t JOIN broadcast_placements p ON p.target_id=t.id WHERE t.run_id=? AND p.status IN('RESERVED','SENDING'))`,
    )
    .run(run, run);
  if (changed.changes) {
    const c = db
      .prepare(
        `SELECT SUM(p.status IN('ACCEPTED','CONFIRMED')) accepted,SUM(p.status='FAILED') failed,SUM(p.status='UNKNOWN') uncertain,SUM(p.status='CANCELLED') skipped FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id WHERE t.run_id=?`,
      )
      .get(run) as any;
    appendBroadcastEvent(
      db,
      run,
      "done",
      "DONE",
      `Finished: ${c.accepted || 0} sent; ${c.skipped || 0} posts skipped; ${c.failed || 0} failed; ${c.uncertain || 0} uncertain.`,
    );
  }
}
export function skipDependentChat(db: Database, p: any) {
  if (p.surface !== "GROUP_STATUS") return;
  const chat = db
    .prepare(
      "SELECT id FROM broadcast_placements WHERE target_id=? AND surface='GROUP_CHAT' AND status='RESERVED'",
    )
    .get(p.target_id) as any;
  if (!chat) return;
  const reason = "Status was not safely accepted; chat was not sent";
  db.prepare(
    "UPDATE broadcast_placements SET status='CANCELLED',failure_reason=? WHERE id=? AND status='RESERVED'",
  ).run(reason, chat.id);
  appendBroadcastEvent(db, p.run_id, `${chat.id}:skipped`, "SKIPPED", reason, {
    ...p,
    id: chat.id,
  });
}
export async function dispatchPersonalPlacement(
  db: Database,
  transport: PersonalTransport,
  assetFolder: string,
  clock: () => number = Date.now,
) {
  const p = db
    .prepare(
      `SELECT p.*,t.account_id,t.group_jid,t.run_id,r.user_id,r.mode,r.caption,r.target_url,r.preview_json,r.asset_id,EXISTS(SELECT 1 FROM broadcast_native_policy np WHERE np.run_id=r.id AND np.policy_version=1) native_policy,g.subject,o.background_color,o.font,(SELECT COUNT(*) FROM broadcast_targets st WHERE st.run_id=t.run_id AND st.rowid<t.rowid) status_index FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id LEFT JOIN group_inventory g ON g.account_id=t.account_id AND g.group_jid=t.group_jid LEFT JOIN personal_run_options o ON o.run_id=r.id WHERE r.purpose='PERSONAL' AND r.status IN('QUEUED','RUNNING') AND p.status='RESERVED' AND (p.surface='GROUP_STATUS' OR r.mode<>'DOUBLE' OR EXISTS(SELECT 1 FROM broadcast_placements s WHERE s.target_id=t.id AND s.surface='GROUP_STATUS' AND s.status IN('ACCEPTED','CONFIRMED'))) AND NOT EXISTS(SELECT 1 FROM broadcast_targets prior JOIN broadcast_placements pp ON pp.target_id=prior.id WHERE prior.run_id=t.run_id AND prior.rowid<t.rowid AND pp.status IN('RESERVED','SENDING')) AND NOT EXISTS(SELECT 1 FROM personal_owner_queue q WHERE q.user_id=r.user_id AND q.next_group_at>?) AND NOT EXISTS(SELECT 1 FROM broadcast_runs older WHERE older.user_id=r.user_id AND older.purpose='PERSONAL' AND older.rowid<r.rowid AND older.status IN('QUEUED','RUNNING') AND EXISTS(SELECT 1 FROM broadcast_targets ot JOIN broadcast_placements op ON op.target_id=ot.id WHERE ot.run_id=older.id AND op.status IN('RESERVED','SENDING'))) ORDER BY r.rowid,t.rowid,CASE p.surface WHEN 'GROUP_STATUS' THEN 0 ELSE 1 END LIMIT 1`,
    )
    .get(new Date(clock()).toISOString()) as any;
  if (!p) return null;
  let started = false;
  const surface = p.surface === "GROUP_STATUS" ? "Group status" : "Group chat";
  appendBroadcastEvent(
    db,
    p.run_id,
    `${p.id}:checking`,
    "CHECKING",
    `${surface} · checking current membership and permission`,
    p,
  );
  try {
    const group = await transport.refreshGroup(p.account_id, p.group_jid);
    if (!group?.isMember)
      throw Error(
        "Banned / removed: your number is no longer a member of this group",
      );
    if (p.surface === "GROUP_CHAT" && group.announce && !group.userIsAdmin)
      throw Object.assign(
        Error("Skipped locked chat: only admins can post here"),
        { personalOutcome: "SKIPPED" },
      );
    const permission = db
      .prepare(
        "SELECT * FROM broadcast_permissions WHERE account_id=? AND group_jid=?",
      )
      .get(p.account_id, p.group_jid);
    if (!p.native_policy && !validPermission(permission, p.surface))
      throw Error("Group-admin permission is missing, expired or revoked");
    const id = await transport.messageId(p.account_id),
      content: any = textPlacement(
        p.surface,
        p.caption,
        p.target_url,
        JSON.parse(p.preview_json || "null"),
      );
    if (p.surface === "GROUP_STATUS" && p.background_color) {
      content.backgroundColor =
        STATUS_COLORS[
          (STATUS_COLORS.indexOf(p.background_color) + p.status_index) %
            STATUS_COLORS.length
        ];
      content.font = p.font;
    }
    if (p.asset_id) {
      const a = db
        .prepare("SELECT * FROM broadcast_assets WHERE id=? AND user_id=?")
        .get(p.asset_id, p.user_id) as any;
      if (!a) throw Error("Uploaded media is unavailable");
      const bytes = fs.readFileSync(path.join(assetFolder, a.id)),
        caption = content.text;
      delete content.text;
      delete content.linkPreview;
      delete content.backgroundColor;
      delete content.font;
      if (a.mime === "video/mp4") {
        content.video = bytes;
        content.mimetype = "video/mp4";
      } else {
        content.image = bytes;
        content.mimetype = a.mime;
      }
      content.caption = caption;
    }
    transaction(db, () => {
      const current = db
        .prepare("SELECT status FROM broadcast_runs WHERE id=?")
        .get(p.run_id) as any;
      if (!["QUEUED", "RUNNING"].includes(current?.status))
        throw Error("Broadcast was cancelled");
      if (
        db
          .prepare(
            "SELECT 1 FROM personal_ignored_groups WHERE user_id=? AND group_jid=?",
          )
          .get(p.user_id, p.group_jid) ||
        db
          .prepare(
            "SELECT 1 FROM broadcast_removals WHERE user_id=? AND group_jid=? AND cleared_at IS NULL",
          )
          .get(p.user_id, p.group_jid) ||
        (!p.native_policy &&
          !validPermission(
            db
              .prepare(
                "SELECT * FROM broadcast_permissions WHERE account_id=? AND group_jid=?",
              )
              .get(p.account_id, p.group_jid),
            p.surface,
          )) ||
        !db
          .prepare(
            "SELECT 1 FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id WHERE g.account_id=? AND g.group_jid=? AND g.is_member=1 AND g.excluded=0 AND a.status='ONLINE' AND (g.announce=0 OR g.user_is_admin=1 OR ?='GROUP_STATUS')",
          )
          .get(p.account_id, p.group_jid, p.surface)
      )
        throw Error("Connection, membership or approval changed before send");
      const result = db
        .prepare(
          "UPDATE broadcast_placements SET status='SENDING',provider_message_id=?,sent_at=? WHERE id=? AND status='RESERVED'",
        )
        .run(id, stamp(), p.id);
      if (!result.changes) throw Error("Placement already claimed");
      db.prepare("UPDATE broadcast_runs SET status='RUNNING' WHERE id=?").run(
        p.run_id,
      );
      appendBroadcastEvent(
        db,
        p.run_id,
        `${p.id}:sending`,
        "SENDING",
        `${surface} · attempting to send`,
        p,
      );
    });
    started = true;
    let timeout: ReturnType<typeof setTimeout>;
    const result: any = await Promise.race([
      transport.send(p.account_id, p.group_jid, content, id),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(Error("Provider send timed out")),
          45000,
        );
      }),
    ]).finally(() => clearTimeout(timeout));
    if (result?.key?.id !== id)
      throw Error("Provider returned a different message identifier");
    transaction(db, () => {
      const changed = db
        .prepare(
          "UPDATE broadcast_placements SET status='ACCEPTED' WHERE id=? AND status='SENDING'",
        )
        .run(p.id);
      if (changed.changes)
        appendBroadcastEvent(
          db,
          p.run_id,
          `${p.id}:accepted`,
          "ACCEPTED",
          `${surface} · Sent`,
          p,
        );
      settlePersonalGroup(db, p.target_id, clock());
    });
  } catch (e: any) {
    const known = [
      "Membership or chat permission changed",
      "Group-admin permission is missing, expired or revoked",
      "Uploaded media is unavailable",
      "Broadcast was cancelled",
      "Connection, membership or approval changed before send",
    ];
    // Plogme assertNodeErrorFree produces Boom(data=numeric WhatsApp error).
    // A network timeout, a generic Error or an unknown code never proves rejection.
    const rejection =
      e?.isBoom === true && [401, 403, 404, 405, 406, 410].includes(e?.data)
        ? e.data
        : null;
    const skipped = !started && e?.personalOutcome === "SKIPPED";
    const uncertain = started && !rejection;
    const reason = uncertain
      ? "Sending began but the outcome is uncertain. Check WhatsApp before starting another post."
      : rejection
        ? `Failed: WhatsApp rejected the post (${rejection}). ${rejection === 403 ? "Posting is not allowed in this group." : rejection === 404 || rejection === 410 ? "The group is no longer available." : "Check the selected number and its posting rights."}`
        : skipped ||
            known.includes(e?.message) ||
            e?.message ===
              "Banned / removed: your number is no longer a member of this group"
          ? e.message
          : "Could not prepare this post: the group is unavailable or connection / posting rights could not be verified.";
    const outcome = uncertain ? "UNKNOWN" : skipped ? "CANCELLED" : "FAILED";
    transaction(db, () => {
      const changed = db
        .prepare(
          "UPDATE broadcast_placements SET status=?,failure_reason=? WHERE id=? AND status=?",
        )
        .run(outcome, reason, p.id, started ? "SENDING" : "RESERVED");
      if (changed.changes) {
        appendBroadcastEvent(
          db,
          p.run_id,
          `${p.id}:result`,
          uncertain ? "UNCERTAIN" : skipped ? "SKIPPED" : "FAILED",
          `${surface} · ${reason}`,
          p,
        );
        skipDependentChat(db, p);
      }
      settlePersonalGroup(db, p.target_id, clock());
    });
  }
  transaction(db, () => {
    settlePersonalGroup(db, p.target_id, clock());
    finishPersonalRun(db, p.run_id);
  });
  return p.id;
}
export function startPersonalDispatcher(
  db: Database,
  transport: PersonalTransport,
  assetFolder: string,
) {
  transaction(db, () => {
    const stale = db
      .prepare(
        `SELECT p.*,t.run_id,t.group_jid,g.subject FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id LEFT JOIN group_inventory g ON g.account_id=t.account_id AND g.group_jid=t.group_jid WHERE r.purpose='PERSONAL' AND p.status='SENDING'`,
      )
      .all() as any[];
    for (const p of stale) {
      db.prepare(
        "UPDATE broadcast_placements SET status='UNKNOWN',failure_reason='Service restarted during send; check WhatsApp before another post' WHERE id=?",
      ).run(p.id);
      appendBroadcastEvent(
        db,
        p.run_id,
        `${p.id}:restart`,
        "UNCERTAIN",
        "Service restarted during send. It will not be automatically resent",
        p,
      );
      skipDependentChat(db, p);
      settlePersonalGroup(db, p.target_id);
    }
    const blocked = db
      .prepare(
        `SELECT p.*,t.run_id,t.group_jid,g.subject FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id LEFT JOIN group_inventory g ON g.account_id=t.account_id AND g.group_jid=t.group_jid WHERE r.purpose='PERSONAL' AND p.surface='GROUP_STATUS' AND p.status IN('UNKNOWN','FAILED')`,
      )
      .all() as any[];
    for (const p of blocked) skipDependentChat(db, p);
    for (const r of db
      .prepare(
        "SELECT id FROM broadcast_runs WHERE purpose='PERSONAL' AND status IN('QUEUED','RUNNING')",
      )
      .all() as any[])
      finishPersonalRun(db, r.id);
  });
  let busy = false,
    stopped = false,
    running: Promise<any> | null = null;
  const timer = setInterval(() => {
    if (stopped || busy) return;
    busy = true;
    running = dispatchPersonalPlacement(db, transport, assetFolder)
      .catch(() => null)
      .finally(() => {
        busy = false;
      });
  }, 2000);
  return async () => {
    stopped = true;
    clearInterval(timer);
    if (running) await running;
  };
}
