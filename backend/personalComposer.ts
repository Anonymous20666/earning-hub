import { appendBroadcastEvent } from "./broadcastEvents";
export { appendBroadcastEvent } from "./broadcastEvents";
import { createHash, randomUUID } from "node:crypto";
import { type Database, transaction } from "./database";
import {
  createPersonalRun,
  PERSONAL_LIMITS,
  surfaces,
  validPermission,
  type Mode,
} from "./broadcasts";
import { safePreview, destination, type SafePreview } from "./safePreview";
const now = () => new Date().toISOString();
const get = (db: Database, sql: string, ...args: any[]): any =>
  db.prepare(sql).get(...args);
const rows = (db: Database, sql: string, ...args: any[]): any[] =>
  db.prepare(sql).all(...args) as any[];
export const STATUS_COLORS = [
  "#183C32",
  "#4338CA",
  "#9F1239",
  "#0F766E",
  "#6B21A8",
  "#1E40AF",
  "#7C2D12",
  "#374151",
];
export function allPersonalPlan(db: Database, user: string, mode: Mode) {
  surfaces(mode);
  const memberships = rows(
      db,
      `SELECT g.*,a.slot,a.status,p.status_allowed,p.chat_allowed,p.mentions_allowed,p.expires_at,p.revoked_at FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id LEFT JOIN broadcast_permissions p ON p.account_id=g.account_id AND p.group_jid=g.group_jid WHERE a.user_id=? AND g.is_member=1 ORDER BY g.group_jid,a.slot`,
      user,
    ),
    byGroup = new Map<string, any[]>();
  for (const g of memberships) {
    const list = byGroup.get(g.group_jid) || [];
    list.push(g);
    byGroup.set(g.group_jid, list);
  }
  const targets: any[] = [],
    skips: any[] = [];
  for (const [jid, list] of byGroup) {
    const first = list[0];
    let reason = "";
    if (
      get(
        db,
        "SELECT 1 FROM personal_ignored_groups WHERE user_id=? AND group_jid=?",
        user,
        jid,
      )
    )
      reason = "On your ignore list";
    else if (
      get(
        db,
        "SELECT 1 FROM broadcast_removals WHERE user_id=? AND group_jid=? AND cleared_at IS NULL",
        user,
        jid,
      )
    )
      reason = "Removed from this group — fresh admin permission is required";
    const ready = list.find(
      (g) =>
        g.status === "ONLINE" &&
        !g.excluded &&
        g.synced_at >= new Date(Date.now() - 15 * 60000).toISOString() &&
        !(mode !== "ALLSTATUS" && g.announce && !g.user_is_admin) &&
        surfaces(mode).every((s) => validPermission(g, s)),
    );
    if (!reason && !ready)
      reason = list.every((g) => g.excluded)
        ? "Hidden in My WhatsApp"
        : list.every((g) => g.status !== "ONLINE")
          ? "WhatsApp number is offline"
          : list.every(
                (g) =>
                  g.synced_at < new Date(Date.now() - 15 * 60000).toISOString(),
              )
            ? "Group list needs a fresh scan"
            : mode !== "ALLSTATUS" &&
                list.every((g) => g.announce && !g.user_is_admin)
              ? "Only admins can post in this group chat"
              : "Group-admin permission is missing or expired";
    if (reason) skips.push({ groupJid: jid, subject: first.subject, reason });
    else
      targets.push({
        accountId: ready.account_id,
        groupJid: jid,
        subject: ready.subject,
        members: ready.member_count,
      });
  }
  if (targets.length > PERSONAL_LIMITS.maxGroups)
    throw Error(
      `All-mode supports ${PERSONAL_LIMITS.maxGroups} groups in this beta. Add more groups to your ignore list before posting; no group was silently left out`,
    );
  return {
    targets,
    skips,
    totalGroups: byGroup.size,
    sharedMemberships: memberships.length - byGroup.size,
  };
}
const hash = (x: any) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
function planHash(plan: ReturnType<typeof allPersonalPlan>) {
  return hash({ targets: plan.targets, skips: plan.skips });
}
export async function preparePersonalDraft(
  db: Database,
  user: string,
  input: any,
  previewer: typeof safePreview = safePreview,
) {
  if (get(db, "SELECT role FROM users WHERE id=?", user)?.role !== "EARNER")
    throw Error("Worker account required");
  if (
    !["TEXT", "MEDIA"].includes(input.kind) ||
    typeof input.payload !== "string" ||
    input.payload.length > 2000
  )
    throw Error("Choose Text or Media and use up to 2,000 characters");
  surfaces(input.mode);
  if (
    input.kind === "MEDIA" &&
    !get(
      db,
      "SELECT 1 FROM broadcast_assets WHERE id=? AND user_id=? AND bytes>0",
      input.assetId || "",
      user,
    )
  )
    throw Error("Choose and upload your media first");
  if (input.kind === "TEXT" && input.assetId)
    throw Error("Choose Media to attach a file");
  const payload = input.payload.trim();
  if (!payload && input.kind === "TEXT")
    throw Error("Paste a link or write your text first");
  const rawUrl =
    payload.match(/https?:\/\/[^\s<>]+/i)?.[0].replace(/[.,!?;:)\]}]+$/, "") ||
    "";
  const url = rawUrl.startsWith("https://") ? rawUrl : "";
  let preview: SafePreview | null = null;
  if (url) destination(url);
  if (url)
    try {
      preview = await previewer(url);
    } catch (e: any) {
      if (e?.code === "UNSAFE_DESTINATION") throw e;
    }
  const plan = allPersonalPlan(db, user, input.mode),
    text =
      preview?.title &&
      !payload.toLowerCase().includes(preview.title.toLowerCase())
        ? `${preview.title}\n\n${payload}`
        : payload,
    id = randomUUID();
  if (text.length > 2000)
    throw Error(
      "Please shorten your text a little so the link title can fit too",
    );
  const record = {
    kind: input.kind,
    mode: input.mode,
    caption: text,
    targetUrl: url,
    originalPayload: payload,
    assetId: input.kind === "MEDIA" ? input.assetId : null,
    preview,
  };
  transaction(db, () => {
    db.prepare(
      "DELETE FROM personal_drafts WHERE user_id=? AND consumed_run IS NULL AND expires_at<?",
    ).run(user, now());
    if (
      get(
        db,
        "SELECT COUNT(*) n FROM personal_drafts WHERE user_id=? AND consumed_run IS NULL",
        user,
      ).n >= 10
    )
      throw Error(
        "Too many open drafts. Wait ten minutes or finish an existing post",
      );
    db.prepare("INSERT INTO personal_drafts VALUES(?,?,?,?,?,?,NULL)").run(
      id,
      user,
      JSON.stringify(record),
      JSON.stringify(plan),
      now(),
      new Date(Date.now() + 10 * 60000).toISOString(),
    );
  });
  return {
    draftId: id,
    kind: input.kind,
    mode: input.mode,
    text,
    preview: preview
      ? {
          title: preview.title,
          description: preview.description,
          image: preview.thumbnailBase64
            ? `data:image/jpeg;base64,${preview.thumbnailBase64}`
            : null,
        }
      : null,
    plan,
    serverNow: now(),
    expiresMinutes: 10,
  };
}
export async function submitPersonalDraft(
  db: Database,
  user: string,
  id: string,
  confirmed: unknown,
) {
  if (confirmed !== true)
    throw Error("Confirm the post and permissions before posting");
  const d = get(
    db,
    "SELECT * FROM personal_drafts WHERE id=? AND user_id=?",
    id,
    user,
  );
  if (!d) throw Error("Draft not found");
  if (d.consumed_run) return { id: d.consumed_run, idempotent: true };
  if (d.expires_at < now())
    throw Error("This review has expired. Review the post again");
  const payload = JSON.parse(d.payload_json),
    plan = allPersonalPlan(db, user, payload.mode),
    oldPlan = JSON.parse(d.plan_json);
  if (planHash(plan) !== planHash(oldPlan))
    throw Error(
      "Your groups or permissions changed. Review the post again before posting",
    );
  if (!plan.targets.length)
    throw Error(
      "No groups are ready. Check permission, connection or your ignore list",
    );
  return createPersonalRun(
    db,
    user,
    {
      purpose: "PERSONAL",
      mode: payload.mode,
      caption: payload.caption,
      targetUrl: payload.targetUrl,
      assetId: payload.assetId,
      requirePreview: false,
      targets: plan.targets.map((t: any) => ({
        accountId: t.accountId,
        groupJid: t.groupJid,
      })),
      requestId: id,
    },
    async () => payload.preview,
    (run) => {
      const current = allPersonalPlan(db, user, payload.mode);
      if (planHash(current) !== planHash(oldPlan))
        throw Error("Your groups changed. Review again");
      const previous =
          get(
            db,
            "SELECT COUNT(*) n FROM broadcast_runs WHERE user_id=? AND purpose='PERSONAL'",
            user,
          ).n - 1,
        color = STATUS_COLORS[previous % STATUS_COLORS.length];
      db.prepare("INSERT INTO personal_run_options VALUES(?,?,0,?)").run(
        run,
        color,
        JSON.stringify(current.skips),
      );
      db.prepare(
        "UPDATE personal_drafts SET consumed_run=?,payload_json='{}',plan_json='{}' WHERE id=?",
      ).run(run, id);
      appendBroadcastEvent(
        db,
        run,
        "queued",
        "QUEUED",
        `${current.targets.length} groups queued. Personal post — no earnings.`,
      );
      for (const s of current.skips)
        appendBroadcastEvent(
          db,
          run,
          `skip:${s.groupJid}`,
          "SKIPPED",
          s.reason,
          { group_jid: s.groupJid, subject: s.subject },
        );
    },
  );
}
export function personalRunFeed(
  db: Database,
  user: string,
  run: string,
  after = 0,
) {
  const r = get(
    db,
    "SELECT r.*,o.skips_json FROM broadcast_runs r LEFT JOIN personal_run_options o ON o.run_id=r.id WHERE r.id=? AND r.user_id=? AND r.purpose='PERSONAL'",
    run,
    user,
  );
  if (!r) throw Error("Post not found");
  const summary = get(
    db,
    `SELECT COUNT(*) total,SUM(CASE WHEN p.status IN('ACCEPTED','CONFIRMED') THEN 1 ELSE 0 END) accepted,SUM(CASE WHEN p.status='FAILED' THEN 1 ELSE 0 END) failed,SUM(CASE WHEN p.status='UNKNOWN' THEN 1 ELSE 0 END) uncertain,SUM(CASE WHEN p.status='CANCELLED' THEN 1 ELSE 0 END) cancelled,SUM(CASE WHEN p.status IN('RESERVED','SENDING') THEN 1 ELSE 0 END) pending FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id WHERE t.run_id=?`,
    run,
  );
  const skippedGroups = JSON.parse(r.skips_json || "[]").length;
  const events = rows(
    db,
    "SELECT id,placement_id,group_jid,group_name,kind,message,created_at FROM broadcast_events WHERE run_id=? AND id>? ORDER BY id LIMIT 200",
    run,
    Math.max(0, Number.isSafeInteger(after) ? after : 0),
  );
  return {
    run: { id: r.id, status: r.status, mode: r.mode, createdAt: r.created_at },
    summary: { ...summary, skippedGroups },
    events,
    hasMore: events.length === 200,
    serverNow: now(),
  };
}
