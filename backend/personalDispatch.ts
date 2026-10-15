import fs from "node:fs";
import path from "node:path";
import type { Database } from "./database";
import { transaction } from "./database";
import { textPlacement, validPermission } from "./broadcasts";
import type { WhatsAppManager } from "./whatsapp";
export type PersonalTransport = Pick<
  WhatsAppManager,
  "refreshGroup" | "messageId" | "send"
>;
const stamp = () => new Date().toISOString();
export async function dispatchPersonalPlacement(
  db: Database,
  transport: PersonalTransport,
  assetFolder: string,
) {
  const p = db
    .prepare(
      `SELECT p.*,t.account_id,t.group_jid,t.run_id,r.user_id,r.mode,r.caption,r.target_url,r.preview_json,r.asset_id FROM broadcast_placements p
 JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id
 WHERE r.purpose='PERSONAL' AND r.status IN('QUEUED','RUNNING') AND p.status='RESERVED'
 AND (p.surface='GROUP_STATUS' OR r.mode<>'DOUBLE' OR EXISTS(SELECT 1 FROM broadcast_placements s WHERE s.target_id=t.id AND s.surface='GROUP_STATUS' AND s.status IN('ACCEPTED','CONFIRMED')))
 ORDER BY r.created_at,t.id,CASE p.surface WHEN 'GROUP_STATUS' THEN 0 ELSE 1 END LIMIT 1`,
    )
    .get() as any;
  if (!p) return null;
  let started = false;
  try {
    const group = await transport.refreshGroup(p.account_id, p.group_jid);
    if (
      !group?.isMember ||
      (p.surface === "GROUP_CHAT" && group.announce && !group.userIsAdmin)
    )
      throw Error("Membership or chat permission changed");
    const permission = db
      .prepare(
        "SELECT * FROM broadcast_permissions WHERE account_id=? AND group_jid=?",
      )
      .get(p.account_id, p.group_jid);
    if (!validPermission(permission, p.surface))
      throw Error("Group-admin permission is missing, expired or revoked");
    const id = await transport.messageId(p.account_id);
    const content: any = textPlacement(
      p.surface,
      p.caption,
      p.target_url,
      JSON.parse(p.preview_json || "null"),
    );
    if (p.asset_id) {
      const a = db
        .prepare("SELECT * FROM broadcast_assets WHERE id=?")
        .get(p.asset_id) as any;
      if (!a) throw Error("Uploaded media is unavailable");
      const bytes = fs.readFileSync(path.join(assetFolder, a.id));
      const caption = content.text;
      delete content.text;
      delete content.linkPreview;
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
            "SELECT 1 FROM broadcast_removals WHERE user_id=? AND group_jid=? AND cleared_at IS NULL",
          )
          .get(p.user_id, p.group_jid) ||
        !validPermission(
          db
            .prepare(
              "SELECT * FROM broadcast_permissions WHERE account_id=? AND group_jid=?",
            )
            .get(p.account_id, p.group_jid),
          p.surface,
        ) ||
        !db
          .prepare(
            "SELECT 1 FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id WHERE g.account_id=? AND g.group_jid=? AND g.is_member=1 AND g.excluded=0 AND a.status='ONLINE'",
          )
          .get(p.account_id, p.group_jid)
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
    db.prepare(
      "UPDATE broadcast_placements SET status='ACCEPTED' WHERE id=? AND status='SENDING'",
    ).run(p.id);
  } catch {
    db.prepare(
      `UPDATE broadcast_placements SET status=?,failure_reason=? WHERE id=? AND status=?`,
    ).run(
      started ? "UNKNOWN" : "FAILED",
      started
        ? "Sending began but the outcome is uncertain. Do not resend blindly."
        : "Pre-send validation failed: check connection, group permissions and media.",
      p.id,
      started ? "SENDING" : "RESERVED",
    );
    if (!started && p.surface === "GROUP_STATUS")
      db.prepare(
        "UPDATE broadcast_placements SET status='CANCELLED',failure_reason='Status did not submit; chat skipped' WHERE target_id=? AND surface='GROUP_CHAT' AND status='RESERVED'",
      ).run(p.target_id);
  }
  db.prepare(
    `UPDATE broadcast_runs SET status='FINISHED' WHERE id=? AND status<>'CANCELLED' AND NOT EXISTS(SELECT 1 FROM broadcast_targets t JOIN broadcast_placements bp ON bp.target_id=t.id WHERE t.run_id=? AND bp.status IN('RESERVED','SENDING'))`,
  ).run(p.run_id, p.run_id);
  return p.id;
}
export function startPersonalDispatcher(
  db: Database,
  transport: PersonalTransport,
  assetFolder: string,
) {
  // Restart recovery never resends a message whose transport may have started.
  db.prepare(
    `UPDATE broadcast_placements SET status='UNKNOWN',failure_reason='Service restarted during send; reconciliation required' WHERE status='SENDING' AND target_id IN(SELECT t.id FROM broadcast_targets t JOIN broadcast_runs r ON r.id=t.run_id WHERE r.purpose='PERSONAL')`,
  ).run();
  let busy = false,
    stopped = false;
  let running: Promise<any> | null = null;
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
