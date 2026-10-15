import { appendBroadcastEvent } from "./broadcastEvents";
import { placementRewardMilli } from "../shared/earningRules";
import { createHash, randomUUID } from "node:crypto";
import { type Database, transaction } from "./database";
import { destination, safePreview } from "./safePreview";
import {
  ensureBonusBacking,
  reconcileTreasury,
  currentPendingReferral,
} from "./earning";
const now = () => new Date().toISOString();
const get = (db: Database, sql: string, ...args: any[]): any =>
  db.prepare(sql).get(...args);
const rows = (db: Database, sql: string, ...args: any[]): any[] =>
  db.prepare(sql).all(...args) as any[];
export const PERSONAL_LIMITS = {
  maxGroups: 200,
  dailyRuns: 3,
  minGapSeconds: 60,
};
export type Mode = "ALLSTATUS" | "ALLCHAT" | "DOUBLE";
export function surfaces(mode: Mode) {
  if (!["ALLSTATUS", "ALLCHAT", "DOUBLE"].includes(mode))
    throw Error("Choose allstatus, allchat or 2x");
  return mode === "DOUBLE"
    ? ["GROUP_STATUS", "GROUP_CHAT"]
    : mode === "ALLSTATUS"
      ? ["GROUP_STATUS"]
      : ["GROUP_CHAT"];
}
export function validPermission(p: any, surface: string) {
  return (
    !!p &&
    !p.revoked_at &&
    p.expires_at > now() &&
    (surface === "GROUP_STATUS"
      ? !!p.status_allowed
      : !!p.chat_allowed && !!p.mentions_allowed)
  );
}
function event(
  db: Database,
  kind: string,
  reference: string,
  amount: number,
  detail: any,
) {
  db.prepare("INSERT INTO money_events VALUES(?,?,?,?,?,?,?)").run(
    randomUUID(),
    kind,
    reference,
    amount,
    null,
    JSON.stringify(detail),
    now(),
  );
}
function treasury(
  db: Database,
  available: number,
  reserved: number,
  payable: number,
) {
  db.prepare(
    "UPDATE treasury SET available_milli=available_milli+?,reserved_milli=reserved_milli+?,payable_milli=payable_milli+? WHERE id=1",
  ).run(available, reserved, payable);
}
export function broadcastWorkspace(db: Database, userId: string) {
  return {
    limits: PERSONAL_LIMITS,
    accounts: rows(
      db,
      "SELECT id,slot,status,phone_label FROM paired_accounts WHERE user_id=? ORDER BY slot",
      userId,
    ),
    serverNow: now(),
    ignoredGroups: rows(
      db,
      "SELECT group_jid,subject FROM personal_ignored_groups WHERE user_id=? ORDER BY subject",
      userId,
    ),
    assets: rows(
      db,
      "SELECT id,mime,bytes,created_at FROM broadcast_assets WHERE user_id=? AND bytes>0 ORDER BY created_at DESC",
      userId,
    ),
    groups: rows(
      db,
      `SELECT g.account_id,g.group_jid,g.subject,g.member_count,g.announce,g.user_is_admin,g.excluded,g.synced_at,a.slot,a.status,
 p.status_allowed,p.chat_allowed,p.mentions_allowed,p.expires_at,p.revoked_at FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id LEFT JOIN broadcast_permissions p ON p.account_id=g.account_id AND p.group_jid=g.group_jid WHERE a.user_id=? AND g.is_member=1 ORDER BY a.slot,g.subject`,
      userId,
    ),
    runs: rows(
      db,
      `SELECT r.id,r.mode,r.purpose,r.caption,r.target_url,r.status,r.created_at,COUNT(p.id) placements,
 SUM(CASE WHEN p.status IN('ACCEPTED','CONFIRMED') THEN 1 ELSE 0 END) submitted,
 SUM(CASE WHEN p.status='CONFIRMED' THEN 1 ELSE 0 END) confirmed,
 SUM(CASE WHEN p.status IN('FAILED','UNKNOWN','CANCELLED') THEN 1 ELSE 0 END) needs_attention
 FROM broadcast_runs r JOIN broadcast_targets t ON t.run_id=r.id JOIN broadcast_placements p ON p.target_id=t.id WHERE r.user_id=? AND r.purpose='PERSONAL' GROUP BY r.id ORDER BY r.created_at DESC LIMIT 30`,
      userId,
    ),
  };
}
function selected(
  db: Database,
  user: string,
  targets: any[],
  mode: Mode,
  paid = false,
  native = false,
) {
  if (
    !Array.isArray(targets) ||
    !targets.length ||
    (!paid && targets.length > PERSONAL_LIMITS.maxGroups)
  )
    throw Error(
      `Select 1–${PERSONAL_LIMITS.maxGroups} group memberships per personal run`,
    );
  const unique = new Map<string, any>();
  for (const t of targets) {
    if (typeof t?.accountId !== "string" || typeof t?.groupJid !== "string")
      throw Error("Invalid target");
    const g = get(
      db,
      `SELECT g.*,a.user_id,a.status,a.slot FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id WHERE g.account_id=? AND g.group_jid=? AND a.user_id=?`,
      t.accountId,
      t.groupJid,
      user,
    );
    if (
      get(
        db,
        "SELECT 1 FROM broadcast_removals WHERE user_id=? AND group_jid=? AND cleared_at IS NULL",
        user,
        t.groupJid,
      )
    )
      throw Error(
        "A number was removed from this group. Fresh group-admin approval is required; switching numbers or rejoining does not bypass removal",
      );
    if (
      !g ||
      !g.is_member ||
      g.excluded ||
      g.status !== "ONLINE" ||
      g.synced_at < new Date(Date.now() - 15 * 60000).toISOString()
    )
      throw Error(
        "A selected group is unavailable, excluded or needs a fresh scan",
      );
    if (
      (mode === "ALLCHAT" || (!native && mode === "DOUBLE")) &&
      g.announce &&
      !g.user_is_admin
    )
      throw Error("Chat posting is restricted to group admins");
    const p = get(
      db,
      "SELECT * FROM broadcast_permissions WHERE account_id=? AND group_jid=?",
      g.account_id,
      g.group_jid,
    );
    for (const surface of surfaces(mode))
      if (!native && !validPermission(p, surface))
        throw Error(
          "Current group-admin approval for every selected surface and mention-all is required",
        );
    if (!unique.has(g.group_jid)) unique.set(g.group_jid, g);
  }
  return [...unique.values()];
}
function insertTargets(
  db: Database,
  runId: string,
  groups: any[],
  mode: Mode,
  paid: boolean,
  campaignId?: string,
  native = false,
) {
  for (const g of groups) {
    const target = randomUUID();
    const reward = paid ? placementRewardMilli(g.member_count) : 0;
    db.prepare("INSERT INTO broadcast_targets VALUES(?,?,?,?,?,?)").run(
      target,
      runId,
      g.account_id,
      g.group_jid,
      g.member_count,
      reward,
    );
    if (paid)
      db.prepare("INSERT INTO paid_group_claims VALUES(?,?,?)").run(
        campaignId!,
        g.group_jid,
        target,
      );
    for (const surface of surfaces(mode)) {
      const locked =
        native && surface === "GROUP_CHAT" && g.announce && !g.user_is_admin;
      db.prepare(
        "INSERT INTO broadcast_placements(id,target_id,surface,status,reward_milli,failure_reason,created_at) VALUES(?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        target,
        surface,
        locked ? "CANCELLED" : "RESERVED",
        locked ? 0 : reward,
        locked ? "Skipped locked chat: only admins can post here" : null,
        now(),
      );
    }
  }
}
export async function createPersonalRun(
  db: Database,
  user: string,
  input: any,
  previewer: typeof safePreview = safePreview,
  onCreated?: (id: string) => void,
  native = false,
) {
  if (get(db, "SELECT role FROM users WHERE id=?", user)?.role !== "EARNER")
    throw Error("Worker account required");
  const mode = input.mode as Mode;
  surfaces(mode);
  if (
    (input.purpose && input.purpose !== "PERSONAL") ||
    input.campaignId ||
    input.rewardMilli !== undefined
  )
    throw Error("Personal broadcasts cannot create paid earnings");
  if (
    typeof input.caption !== "string" ||
    input.caption.trim().length > 2000 ||
    typeof input.requirePreview !== "boolean"
  )
    throw Error("Use a caption up to 2,000 characters and a preview policy");
  const url = input.targetUrl ? destination(input.targetUrl).href : "";
  if (!url && !input.caption.trim() && !input.assetId)
    throw Error("Write some text, paste a link or add media first");
  if (!url && input.requirePreview)
    throw Error("A link is needed for a link preview");
  const asset = input.assetId
    ? get(
        db,
        "SELECT * FROM broadcast_assets WHERE id=? AND user_id=?",
        input.assetId,
        user,
      )
    : null;
  if (input.assetId && (!asset || asset.bytes === 0))
    throw Error("Uploaded media not found");
  if (asset && input.requirePreview)
    throw Error(
      "Media captions include a visible link but cannot promise a separate preview card. Use a text-only broadcast for required previews",
    );
  const requestId = input.requestId;
  if (typeof requestId !== "string" || !/^[-a-f0-9]{36}$/.test(requestId))
    throw Error("A unique request ID is required");
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        mode,
        ...(native ? { nativePostingPolicy: 1 } : {}),
        caption: input.caption.trim(),
        url,
        asset: asset?.id,
        targets: input.targets,
        requirePreview: input.requirePreview,
      }),
    )
    .digest("hex");
  const prior = get(
    db,
    "SELECT * FROM broadcast_request_keys WHERE user_id=? AND request_key=?",
    user,
    requestId,
  );
  if (prior) {
    if (prior.payload_hash !== digest)
      throw Error("Request ID already used for different content");
    return { id: prior.run_id, idempotent: true };
  }
  selected(db, user, input.targets, mode, false, native);
  let preview: any = null;
  try {
    if (url) preview = await previewer(url);
  } catch (e: any) {
    if (e?.code === "UNSAFE_DESTINATION") throw e;
    if (input.requirePreview)
      throw Error(
        "A safe preview could not be generated. Change the link or explicitly allow visible-link-only sending",
      );
  }
  return transaction(db, () => {
    const again = get(
      db,
      "SELECT * FROM broadcast_request_keys WHERE user_id=? AND request_key=?",
      user,
      requestId,
    );
    if (again) {
      if (again.payload_hash !== digest) throw Error("Request ID already used");
      return { id: again.run_id, idempotent: true };
    }
    const last = get(
      db,
      "SELECT created_at FROM broadcast_runs WHERE user_id=? AND purpose='PERSONAL' ORDER BY created_at DESC LIMIT 1",
      user,
    );
    if (
      last &&
      Date.parse(last.created_at) >
        Date.now() - PERSONAL_LIMITS.minGapSeconds * 1000
    )
      throw Error("Wait at least one minute between personal broadcasts");
    const count = get(
      db,
      "SELECT COUNT(*) n FROM broadcast_runs WHERE user_id=? AND purpose='PERSONAL' AND substr(created_at,1,10)=?",
      user,
      now().slice(0, 10),
    ).n;
    if (count >= PERSONAL_LIMITS.dailyRuns)
      throw Error("Personal beta limit reached: three runs per UTC day");
    if (
      asset &&
      !get(
        db,
        "SELECT 1 FROM broadcast_assets WHERE id=? AND user_id=? AND bytes>0",
        asset.id,
        user,
      )
    )
      throw Error(
        "Uploaded media was removed before this broadcast could be queued",
      );
    const groups = selected(db, user, input.targets, mode, false, native),
      id = randomUUID();
    db.prepare(
      "INSERT INTO broadcast_runs(id,user_id,purpose,mode,caption,target_url,asset_id,preview_json,status,created_at) VALUES(?,?,'PERSONAL',?,?,?,?,?,'QUEUED',?)",
    ).run(
      id,
      user,
      mode,
      input.caption.trim(),
      url,
      asset?.id || null,
      JSON.stringify(preview),
      now(),
    );
    insertTargets(db, id, groups, mode, false, undefined, native);
    onCreated?.(id);
    db.prepare("INSERT INTO broadcast_request_keys VALUES(?,?,?,?)").run(
      user,
      requestId,
      digest,
      id,
    );
    return {
      id,
      uniqueGroups: groups.length,
      placements: groups.length * surfaces(mode).length,
      previewAvailable: !!preview,
    };
  });
}
// Internal funded path. No public endpoint enables paid dispatch or manufactures receipts.
export function reservePaidRun(
  db: Database,
  adminId: string,
  campaignId: string,
  user: string,
  mode: Mode,
  targets: any[],
) {
  return transaction(db, () => {
    if (get(db, "SELECT role FROM users WHERE id=?", adminId)?.role !== "ADMIN")
      throw Error("Administrator required");
    if (
      !get(db, "SELECT dispatch_enabled FROM broadcast_settings WHERE id=1")
        .dispatch_enabled
    )
      throw Error("Paid dispatch is disabled");
    if (!reconcileTreasury(db).ok)
      throw Error("Treasury reconciliation required");
    const c = get(
      db,
      "SELECT * FROM house_campaigns WHERE id=? AND status IN('FUNDED','RUNNING')",
      campaignId,
    );
    if (!c) throw Error("Funded active campaign required");
    const groups = selected(db, user, targets, mode, true, true);
    for (const g of groups) {
      if (
        !get(
          db,
          "SELECT 1 FROM wa_slots WHERE account_id=? AND paid_opt_in=1",
          g.account_id,
        )
      )
        throw Error("Worker has not opted into paid campaigns");
      if (
        get(
          db,
          "SELECT 1 FROM paid_group_claims WHERE campaign_id=? AND group_jid=?",
          c.id,
          g.group_jid,
        ) ||
        get(
          db,
          "SELECT 1 FROM delivery_jobs WHERE campaign_id=? AND group_jid=?",
          c.id,
          g.group_jid,
        )
      )
        throw Error("Group already assigned in this campaign");
    }
    const participated = get(
      db,
      "SELECT 1 FROM campaign_participation WHERE campaign_id=? AND user_id=?",
      c.id,
      user,
    );
    if (
      !participated &&
      get(
        db,
        "SELECT COUNT(*) n FROM campaign_participation WHERE user_id=? AND day_utc=?",
        user,
        now().slice(0, 10),
      ).n >= 10
    )
      throw Error("Daily paid campaign capacity reached");
    const total = groups.reduce(
      (sum, g) =>
        sum +
        placementRewardMilli(g.member_count) *
          surfaces(mode).filter(
            (surface) =>
              !(surface === "GROUP_CHAT" && g.announce && !g.user_is_admin),
          ).length,
      0,
    );
    if (total > c.remaining_milli)
      throw Error("Insufficient full-placement campaign reward budget");
    if (total > 0) ensureBonusBacking(db, user);
    const ref = total > 0 ? currentPendingReferral(db, user) : null;
    if (ref) {
      ensureBonusBacking(db, ref.referrer_id);
      treasury(db, -ref.reward_milli, ref.reward_milli, 0);
    }
    const id = randomUUID();
    db.prepare(
      "INSERT INTO broadcast_runs(id,user_id,purpose,mode,campaign_id,caption,target_url,status,created_at) VALUES(?,?,'PAID_CAMPAIGN',?,?,?,?,'QUEUED',?)",
    ).run(id, user, mode, c.id, c.message, c.target_url, now());
    insertTargets(db, id, groups, mode, true, c.id, true);
    db.prepare("INSERT INTO broadcast_native_policy VALUES(?,1,?)").run(
      id,
      JSON.stringify([...new Set(groups.map((g) => g.account_id))]),
    );
    if (ref)
      db.prepare(
        "UPDATE referrals SET status='RESERVED',reserved_job_id=? WHERE id=?",
      ).run(id, ref.id);
    db.prepare(
      "UPDATE house_campaigns SET remaining_milli=remaining_milli-?,allocated_milli=allocated_milli+?,status='RUNNING' WHERE id=?",
    ).run(total, total, c.id);
    db.prepare(
      "INSERT OR IGNORE INTO campaign_participation VALUES(?,?,?)",
    ).run(c.id, user, now().slice(0, 10));
    event(db, "PLACEMENTS_RESERVED", `placements:${id}`, total, {
      campaignId: c.id,
    });
    return { id, totalMilli: total };
  });
}
export function confirmPlacement(
  db: Database,
  proof: {
    placementId: string;
    messageId: string;
    groupJid: string;
    receiptId: string;
    kind: "DELIVERY_CONFIRMED";
  },
) {
  return transaction(db, () => {
    if (
      get(
        db,
        "SELECT 1 FROM delivery_jobs WHERE provider_receipt_id=?",
        proof.receiptId,
      )
    )
      throw Error("Receipt already belongs to another delivery");
    const p = get(
      db,
      `SELECT p.*,t.group_jid,r.user_id,r.purpose,r.campaign_id,r.id run_id FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id WHERE p.id=?`,
      proof.placementId,
    );
    if (
      proof.kind !== "DELIVERY_CONFIRMED" ||
      !p ||
      p.provider_message_id !== proof.messageId ||
      p.group_jid !== proof.groupJid ||
      typeof proof.receiptId !== "string" ||
      proof.receiptId.length < 5
    )
      throw Error("Provider evidence does not match placement");
    if (p.status === "CONFIRMED") {
      if (p.receipt_id !== proof.receiptId)
        throw Error("Receipt conflicts with confirmed placement");
      return { idempotent: true };
    }
    if (!["SENDING", "ACCEPTED", "UNKNOWN"].includes(p.status))
      throw Error("Placement is not awaiting confirmation");
    db.prepare(
      "UPDATE broadcast_placements SET status='CONFIRMED',receipt_id=?,confirmed_at=? WHERE id=?",
    ).run(proof.receiptId, now(), p.id);
    if (p.purpose === "PAID_CAMPAIGN" && p.reward_milli > 0) {
      treasury(db, 0, -p.reward_milli, p.reward_milli);
      db.prepare(
        "UPDATE wallets SET earned_milli=earned_milli+? WHERE user_id=?",
      ).run(p.reward_milli, p.user_id);
      db.prepare("INSERT INTO ledger VALUES(?,?,?,?,?,?)").run(
        randomUUID(),
        p.user_id,
        p.surface === "GROUP_STATUS"
          ? "VERIFIED_STATUS_DELIVERY"
          : "VERIFIED_CHAT_DELIVERY",
        p.reward_milli,
        `placement:${p.id}`,
        now(),
      );
      db.prepare(
        "UPDATE house_campaigns SET allocated_milli=allocated_milli-?,paid_milli=paid_milli+? WHERE id=?",
      ).run(p.reward_milli, p.reward_milli, p.campaign_id);
      const ref = get(
        db,
        "SELECT * FROM referrals WHERE referred_id=? AND status='RESERVED'",
        p.user_id,
      );
      if (ref) {
        treasury(db, 0, -ref.reward_milli, ref.reward_milli);
        db.prepare(
          "UPDATE wallets SET earned_milli=earned_milli+? WHERE user_id=?",
        ).run(ref.reward_milli, ref.referrer_id);
        db.prepare("INSERT INTO ledger VALUES(?,?,?,?,?,?)").run(
          randomUUID(),
          ref.referrer_id,
          "QUALIFIED_REFERRAL",
          ref.reward_milli,
          `referral:${ref.id}`,
          now(),
        );
        db.prepare(
          "UPDATE referrals SET status='EARNED',earned_at=? WHERE id=?",
        ).run(now(), ref.id);
      }
      event(db, "PLACEMENT_SETTLED", `placement:${p.id}`, p.reward_milli, {
        runId: p.run_id,
        surface: p.surface,
      });
    }
    return { idempotent: false };
  });
}
export function cancelUnsentPlacement(
  db: Database,
  id: string,
  reason = "Cancelled before send",
) {
  return transaction(db, () => {
    const p = get(
      db,
      `SELECT p.*,r.purpose,r.campaign_id,r.id run_id,r.user_id FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id WHERE p.id=?`,
      id,
    );
    if (!p) throw Error("Placement not found");
    if (p.status === "CANCELLED") return;
    if (p.status !== "RESERVED")
      throw Error("Cannot cancel a placement that may already have been sent");
    db.prepare(
      "UPDATE broadcast_placements SET status='CANCELLED',failure_reason=? WHERE id=?",
    ).run(reason.slice(0, 250), id);
    if (p.purpose === "PAID_CAMPAIGN") {
      db.prepare(
        "UPDATE house_campaigns SET allocated_milli=allocated_milli-?,remaining_milli=remaining_milli+? WHERE id=?",
      ).run(p.reward_milli, p.reward_milli, p.campaign_id);
      event(
        db,
        "UNSENT_PLACEMENT_RELEASED",
        `placement-release:${id}`,
        p.reward_milli,
        { reason },
      );
      const ref = get(
        db,
        "SELECT * FROM referrals WHERE referred_id=? AND status='RESERVED'",
        p.user_id,
      );
      if (ref) {
        const next = get(
          db,
          `SELECT r.id FROM broadcast_runs r JOIN broadcast_targets t ON t.run_id=r.id JOIN broadcast_placements bp ON bp.target_id=t.id WHERE r.user_id=? AND r.purpose='PAID_CAMPAIGN' AND bp.reward_milli>0 AND bp.status IN('RESERVED','SENDING','ACCEPTED','UNKNOWN') LIMIT 1`,
          p.user_id,
        );
        const old = get(
          db,
          "SELECT id FROM delivery_jobs WHERE user_id=? AND status IN('RESERVED','SENDING','UNKNOWN') LIMIT 1",
          p.user_id,
        );
        if (next || old)
          db.prepare("UPDATE referrals SET reserved_job_id=? WHERE id=?").run(
            next?.id || old.id,
            ref.id,
          );
        else {
          treasury(db, ref.reward_milli, -ref.reward_milli, 0);
          db.prepare(
            "UPDATE referrals SET status='PENDING',reserved_job_id=NULL WHERE id=?",
          ).run(ref.id);
          currentPendingReferral(db, ref.referred_id);
        }
      }
    }
  });
}
export function cancelPersonalRun(db: Database, user: string, id: string) {
  const run = get(
    db,
    "SELECT * FROM broadcast_runs WHERE id=? AND user_id=? AND purpose='PERSONAL'",
    id,
    user,
  );
  if (!run) throw Error("Personal broadcast not found");
  const stopped = transaction(db, () => {
    const changed = db
      .prepare(
        "UPDATE broadcast_runs SET status='CANCELLED' WHERE id=? AND status IN('QUEUED','RUNNING')",
      )
      .run(id);
    if (!changed.changes) return false;
    db.prepare(
      "UPDATE broadcast_placements SET status='CANCELLED',failure_reason='Owner cancelled before send' WHERE status='RESERVED' AND target_id IN(SELECT id FROM broadcast_targets WHERE run_id=?)",
    ).run(id);
    appendBroadcastEvent(
      db,
      id,
      "cancelled",
      "CANCELLED",
      "Stopped unsent posts. Already-started or uncertain sends are not labelled unsent.",
    );
    return true;
  });
  return { success: true, stopped };
}
export function textPlacement(
  surface: string,
  caption: string,
  url: string,
  preview: any,
) {
  const existing = (caption.match(/https?:\/\/[^\s<>]+/gi) || []).some(
    (raw) => {
      try {
        return new URL(raw.replace(/[.,!?;:)\]}]+$/, "")).href === url;
      } catch {
        return false;
      }
    },
  );
  return {
    text: [caption.trim(), url && !existing ? url : ""]
      .filter(Boolean)
      .join("\n\n"),
    linkPreview: preview
      ? { ...preview, "matched-text": preview["matched-text"] || url }
      : null,
    ...(surface === "GROUP_STATUS"
      ? { groupStatus: true }
      : { mentionAll: true }),
  };
}
export function placementDetails(db: Database, user: string, id: string) {
  if (
    !get(db, "SELECT 1 FROM broadcast_runs WHERE id=? AND user_id=?", id, user)
  )
    throw Error("Broadcast not found");
  return rows(
    db,
    `SELECT p.id,t.group_jid,COALESCE(g.subject,t.group_jid) subject,p.surface,p.status,p.reward_milli,p.sent_at,p.confirmed_at,p.failure_reason FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id LEFT JOIN group_inventory g ON g.account_id=t.account_id AND g.group_jid=t.group_jid WHERE t.run_id=? ORDER BY t.group_jid,p.surface DESC`,
    id,
  );
}

export function beginPaidPlacement(
  db: Database,
  id: string,
  messageId: string,
  capabilities: {
    statusReceiptsVerified: boolean;
    chatReceiptsVerified: boolean;
  },
) {
  return transaction(db, () => {
    const p = get(
      db,
      `SELECT p.*,t.run_id,t.account_id,t.group_jid,t.member_snapshot,r.purpose,r.user_id,r.status run_status,r.mode,r.campaign_id FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id WHERE p.id=?`,
      id,
    );
    if (!p || p.purpose !== "PAID_CAMPAIGN" || p.status !== "RESERVED")
      throw Error("Unsent paid placement required");
    if (
      !get(db, "SELECT dispatch_enabled FROM broadcast_settings WHERE id=1")
        .dispatch_enabled
    )
      throw Error("Paid dispatch is disabled");
    if (
      (p.surface === "GROUP_STATUS" && !capabilities.statusReceiptsVerified) ||
      (p.surface === "GROUP_CHAT" && !capabilities.chatReceiptsVerified)
    )
      throw Error(
        "Real provider receipt behaviour has not been verified for this surface",
      );
    if (
      !["QUEUED", "RUNNING"].includes(p.run_status) ||
      !["FUNDED", "RUNNING"].includes(
        get(db, "SELECT status FROM house_campaigns WHERE id=?", p.campaign_id)
          ?.status,
      )
    )
      throw Error("Campaign or broadcast is stopped");
    if (
      p.mode === "DOUBLE" &&
      p.surface === "GROUP_CHAT" &&
      !get(
        db,
        "SELECT 1 FROM broadcast_placements WHERE target_id=? AND surface='GROUP_STATUS' AND status='CONFIRMED'",
        p.target_id,
      )
    )
      throw Error("Confirm group status before the paid chat placement");
    if (
      get(
        db,
        "SELECT 1 FROM broadcast_removals WHERE user_id=? AND group_jid=? AND cleared_at IS NULL",
        p.user_id,
        p.group_jid,
      )
    )
      throw Error(
        "Group removal requires fresh admin approval, not a different number",
      );
    const g = get(
      db,
      `SELECT g.*,a.status FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id WHERE g.account_id=? AND g.group_jid=?`,
      p.account_id,
      p.group_jid,
    );
    if (
      !g ||
      g.status !== "ONLINE" ||
      !g.is_member ||
      g.excluded ||
      g.member_count !== p.member_snapshot ||
      g.synced_at < new Date(Date.now() - 15 * 60000).toISOString() ||
      (p.surface === "GROUP_CHAT" && g.announce && !g.user_is_admin)
    )
      throw Error("Group eligibility changed before send");
    if (
      !get(
        db,
        "SELECT 1 FROM broadcast_native_policy WHERE run_id=? AND policy_version=1",
        p.run_id,
      ) &&
      !validPermission(
        get(
          db,
          "SELECT * FROM broadcast_permissions WHERE account_id=? AND group_jid=?",
          p.account_id,
          p.group_jid,
        ),
        p.surface,
      )
    )
      throw Error("Surface permission changed");
    if (
      !get(
        db,
        "SELECT 1 FROM wa_slots WHERE account_id=? AND paid_opt_in=1 AND status=?",
        p.account_id,
        "ONLINE",
      )
    )
      throw Error("Worker is offline or no longer opted in");
    if (
      typeof messageId !== "string" ||
      messageId.length < 5 ||
      messageId.length > 250 ||
      get(
        db,
        "SELECT 1 FROM delivery_jobs WHERE provider_message_id=?",
        messageId,
      )
    )
      throw Error("Unique provider message ID required");
    if (!reconcileTreasury(db).ok)
      throw Error("Treasury reconciliation required");
    db.prepare(
      "UPDATE broadcast_placements SET status='SENDING',provider_message_id=?,sent_at=? WHERE id=?",
    ).run(messageId, now(), id);
    return p;
  });
}
export function paidPlacementUnknown(db: Database, id: string) {
  db.prepare(
    "UPDATE broadcast_placements SET status='UNKNOWN',failure_reason='Provider outcome uncertain; retain funds and reconcile, never blindly resend' WHERE id=? AND status IN('SENDING','ACCEPTED')",
  ).run(id);
}
