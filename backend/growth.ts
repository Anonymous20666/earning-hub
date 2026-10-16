import { buildGrowthUrlPost } from "../shared/growthPost";
import { randomBytes, randomUUID, createHash, createHmac } from "node:crypto";
import { transaction, type Database } from "./database";
import {
  GROWTH_PRODUCTS,
  GROWTH_COUNTRIES,
  growthTerms,
  requestRegion,
  validateGrowthInput,
  type GrowthInput,
  type GrowthProduct,
} from "../shared/growthRules";
const stamp = () => new Date().toISOString();
const get = (db: Database, sql: string, ...args: any[]): any =>
  db.prepare(sql).get(...args);
const all = (db: Database, sql: string, ...args: any[]): any[] =>
  db.prepare(sql).all(...args) as any[];
function event(
  db: Database,
  id: string,
  key: string,
  kind: string,
  message: string,
  actor?: string,
) {
  db.prepare(
    "INSERT OR IGNORE INTO growth_events(order_id,event_key,kind,message,actor_id,created_at) VALUES(?,?,?,?,?,?)",
  ).run(id, key, kind, message, actor || null, stamp());
}
function staff(db: Database, id: string) {
  if (get(db, "SELECT role FROM users WHERE id=?", id)?.role !== "ADMIN")
    throw Error("Administrator access required");
}
export function ownedGrowth(
  db: Database,
  id: string,
  user: string,
  admin = false,
) {
  if (admin) staff(db, user);
  const row = get(
    db,
    `SELECT * FROM growth_orders WHERE id=? ${admin ? "" : "AND user_id=?"}`,
    ...(admin ? [id] : [id, user]),
  );
  if (!row) throw Error("Campaign not found");
  return row;
}
export function growthReadiness() {
  return {
    livePayments: false,
    liveDispatch: false,
    telegramConfigured: false,
    telegramCredentialsPresent: !!process.env.TELEGRAM_BOT_TOKEN,
    providers: {
      SQUAD: {
        role: "PRIMARY",
        mode: "SANDBOX",
        configured: /^sandbox_sk_.{8,}$/.test(
          process.env.SQUAD_SANDBOX_SECRET || "",
        ),
      },
      KORA: {
        role: "BACKUP",
        mode: "SANDBOX",
        configured: /^sk_test_.{11,}$/.test(
          process.env.KORA_SANDBOX_SECRET || "",
        ),
      },
    },
    blockers: [
      "Live prices and merchant approval must be confirmed.",
      "Provider-backed destination verification and counting must pass controlled tests.",
      "Paid dispatch requires funded reservations and verified delivery evidence.",
    ],
    note: "Planning, review and configuration are available. No live payment, payout or campaign send is enabled.",
  };
}
export function growthInventory(
  db: Database,
  product: GrowthProduct,
  countries: string[],
  orderId?: string,
  now = Date.now(),
) {
  if (
    !GROWTH_PRODUCTS[product].channel &&
    countries.some((code) => !GROWTH_COUNTRIES.find((c) => c[0] === code)?.[2])
  )
    return {
      groups: [],
      distinctGroups: 0,
      estimatedWorkerMilli: 0,
      evidence:
        "Selected requester regions cannot be unambiguously classified from supported phone prefixes; review or choose a supported region",
      availability: "UNAVAILABLE",
    };
  if (product.startsWith("TG"))
    return {
      groups: [],
      distinctGroups: 0,
      estimatedWorkerMilli: 0,
      evidence: "Telegram inventory is not connected",
      availability: "UNAVAILABLE",
    };
  const policy = get(db, "SELECT * FROM growth_policy WHERE id=1");
  if (
    countries.length &&
    (!policy?.min_sample || !policy?.min_match_bps || !policy?.max_age_hours)
  )
    return {
      groups: [],
      distinctGroups: 0,
      estimatedWorkerMilli: 0,
      evidence:
        "Country audience review policy has not been set by an administrator",
      availability: "UNAVAILABLE",
    };
  const fresh = new Date(now - 15 * 60000).toISOString(),
    audienceFresh = new Date(
      now - (policy?.max_age_hours || 1) * 3600000,
    ).toISOString();
  const rows = all(
    db,
    `SELECT g.*,a.user_id,a.last_selected_at FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id JOIN group_permissions p ON p.group_jid=g.group_jid WHERE EXISTS(SELECT 1 FROM growth_worker_shifts ws WHERE ws.user_id=a.user_id AND ws.available_until>?) AND (SELECT COUNT(*) FROM campaign_participation cp WHERE cp.user_id=a.user_id AND cp.day_utc=?)<(SELECT daily_limit FROM broadcast_settings WHERE id=1) AND a.status='ONLINE' AND g.is_member=1 AND g.excluded=0 AND g.member_count>=100 AND (g.announce=0 OR g.user_is_admin=1) AND g.synced_at>=? AND p.revoked_at IS NULL AND p.expires_at>? AND EXISTS(SELECT 1 FROM wa_slots s WHERE s.account_id=a.id AND s.status='ONLINE' AND s.paid_opt_in=1) AND NOT EXISTS(SELECT 1 FROM broadcast_removals br WHERE br.user_id=a.user_id AND br.group_jid=g.group_jid AND br.cleared_at IS NULL) AND NOT EXISTS(SELECT 1 FROM growth_batch_groups bg WHERE bg.order_id=? AND bg.group_jid=g.group_jid) ORDER BY COALESCE(a.last_selected_at,''),a.user_id,g.group_jid`,
    new Date(now).toISOString(),
    new Date(now).toISOString().slice(0, 10),
    fresh,
    new Date(now).toISOString(),
    orderId || "",
  );
  const groups: any[] = [],
    seen = new Set<string>();
  for (const r of rows) {
    let score = 0,
      source = "UNRESTRICTED";
    if (countries.length) {
      const samples = all(
        db,
        "SELECT * FROM growth_audiences WHERE account_id=? AND group_jid=? AND observed_at>=?",
        r.account_id,
        r.group_jid,
        audienceFresh,
      ).filter(
        (s) =>
          countries.includes(s.country) &&
          s.source === "PERMITTED_PREFIX_SAMPLE" &&
          s.sample_total >= policy.min_sample &&
          s.matching * 10000 >= s.sample_total * policy.min_match_bps,
      );
      if (!samples.length) continue;
      const best = samples.sort(
        (a, b) => b.matching / b.sample_total - a.matching / a.sample_total,
      )[0];
      score = best.matching / best.sample_total;
      source = "RECORDED_SAMPLE_NOT_LOCATION_PROOF";
    }
    if (seen.has(r.group_jid)) continue;
    seen.add(r.group_jid);
    groups.push({
      accountId: r.account_id,
      ownerId: r.user_id,
      groupJid: r.group_jid,
      members: r.member_count,
      workerMilli: Math.min(r.member_count, 1000),
      score,
      evidence: source,
    });
  }
  // The query is oldest-selected first. Round-robin across owners prevents an
  // account with many groups from consuming an entire first wave.
  const byOwner = new Map<string, any[]>();
  for (const group of groups) {
    const queue = byOwner.get(group.ownerId) || [];
    queue.push(group);
    byOwner.set(group.ownerId, queue);
  }
  const fair: any[] = [];
  while (fair.length < groups.length)
    for (const queue of byOwner.values()) {
      const group = queue.shift();
      if (group) fair.push(group);
    }
  groups.splice(0, groups.length, ...fair);
  return {
    groups,
    distinctGroups: groups.length,
    estimatedWorkerMilli: groups.reduce((s, g) => s + g.workerMilli, 0),
    evidence:
      "Fresh, opted-in accounts and permitted groups. Audience samples are not verified follower countries.",
    availability: groups.length ? "LIMITED" : "UNAVAILABLE",
  };
}
export function growthWorkspace(db: Database, user: string, admin = false) {
  if (admin) staff(db, user);
  maintenanceGrowth(db);
  const rows = all(
    db,
    `SELECT id,title FROM (SELECT id,json_extract(input_json,'$.title') title,created_at,user_id FROM growth_orders) ${admin ? "" : "WHERE user_id=?"} ORDER BY created_at DESC LIMIT 100`,
    ...(admin ? [] : [user]),
  );
  return {
    products: GROWTH_PRODUCTS,
    countries: GROWTH_COUNTRIES.map(([code, name]) => ({ code, name })),
    readiness: growthReadiness(),
    prices: all(db, "SELECT * FROM growth_prices"),
    orders: rows.map((r) => growthDetail(db, r.id, user, admin)),
    ...(admin
      ? {
          audiencePolicy: get(db, "SELECT * FROM growth_policy WHERE id=1"),
          audienceInventory: all(
            db,
            "SELECT g.account_id,g.group_jid,g.subject,a.phone_label FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id WHERE g.is_member=1 ORDER BY g.subject LIMIT 300",
          ),
          audienceSamples: all(
            db,
            "SELECT * FROM growth_audiences ORDER BY observed_at DESC LIMIT 300",
          ),
          serviceAdmins: all(
            db,
            "SELECT * FROM growth_service_admins ORDER BY created_at DESC",
          ),
          inventorySummary: {
            eligibleWhatsAppGroups: growthInventory(db, "WA_GROUP", [])
              .distinctGroups,
          },
        }
      : {}),
  };
}
export function growthDetail(
  db: Database,
  id: string,
  user: string,
  admin = false,
) {
  const row = ownedGrowth(db, id, user, admin),
    input = JSON.parse(row.input_json),
    quote = row.quote_id
      ? get(db, "SELECT * FROM growth_quotes WHERE id=?", row.quote_id)
      : null;
  const assignments = all(
    db,
    `SELECT a.id,a.role,a.state,a.expires_at,a.verified_at,s.label,s.phone,s.platform FROM growth_assignments a JOIN growth_service_admins s ON s.id=a.service_admin_id WHERE a.order_id=? ORDER BY a.assigned_at`,
    id,
  );
  const {message: _legacyMessage, caption: _legacyCaption, ...urlOnlyInput} = input;
  return {
    id: row.id,
    status: row.status,
    revision: row.revision,
    input: urlOnlyInput,
    post: buildGrowthUrlPost(input),
    terms: growthTerms(input.product),
    verificationCode: assignments.some((a) => a.state === "INVITED")
      ? row.verification_code
      : null,
    verificationExpiresAt: row.verification_expires_at,
    assignments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    baseline: row.baseline_count,
    latestCount: row.observed_count,
    delivered: row.delivered,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    completedAt: row.completed_at,
    quote: quote
      ? {
          id: quote.id,
          amountKobo: quote.amount_kobo,
          workerBudgetMilli: quote.worker_budget_milli,
          feeKobo: quote.fee_kobo,
          expiresAt: quote.expires_at,
          plan: JSON.parse(quote.plan_json),
        }
      : null,
    extensions: all(
      db,
      "SELECT id,proposed_deadline,note,status,created_at FROM growth_extensions WHERE order_id=? ORDER BY created_at DESC",
      id,
    ),
    events: all(
      db,
      "SELECT id,kind,message,created_at FROM growth_events WHERE order_id=? ORDER BY id DESC LIMIT 100",
      id,
    ),
    sandboxPayments: all(
      db,
      "SELECT reference,provider,status,created_at FROM growth_payment_intents WHERE order_id=? ORDER BY created_at DESC",
      id,
    ),
    ...(admin
      ? {
          userId: row.user_id,
          accessEvidence: all(
            db,
            "SELECT note,actor_id,created_at FROM growth_access_evidence WHERE order_id=?",
            id,
          ),
        }
      : {}),
  };
}
export function saveGrowth(
  db: Database,
  user: string,
  body: any,
  key: string,
  id?: string,
) {
  const role = get(db, "SELECT role FROM users WHERE id=?", user)?.role;
  if (!["ADVERTISER", "ADMIN"].includes(role))
    throw Error("Advertiser account required");
  const input = validateGrowthInput(body);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key))
    throw Error("A valid request key is required");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return transaction(db, () => {
    if (!id) {
      const prior = get(
        db,
        "SELECT * FROM growth_idempotency WHERE user_id=? AND request_key=?",
        user,
        key,
      );
      if (prior) {
        if (prior.input_hash !== hash)
          throw Error("This request key was used for different details");
        return growthDetail(db, prior.order_id, user);
      }
    }
    if (id) {
      const row = ownedGrowth(db, id, user);
      if (row.status !== "DRAFT")
        throw Error(
          "Submitted campaign details are locked; create a new draft",
        );
      const changed = db
        .prepare(
          "UPDATE growth_orders SET input_json=?,revision=revision+1,updated_at=? WHERE id=? AND status='DRAFT' AND revision=?",
        )
        .run(JSON.stringify(input), stamp(), id, body.revision);
      if (!changed.changes)
        throw Error("This draft changed. Refresh before saving");
    } else {
      id = randomUUID();
      db.prepare(
        "INSERT INTO growth_orders(id,user_id,input_json,verification_code,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      ).run(
        id,
        user,
        JSON.stringify(input),
        randomBytes(4).toString("hex").toUpperCase(),
        stamp(),
        stamp(),
      );
      db.prepare("INSERT INTO growth_idempotency VALUES(?,?,?,?)").run(
        user,
        key,
        hash,
        id,
      );
    }
    event(
      db,
      id!,
      randomUUID(),
      "DRAFT",
      "Campaign details saved. No charge or broadcast.",
      user,
    );
    return growthDetail(db, id!, user);
  });
}
export function submitGrowth(
  db: Database,
  user: string,
  id: string,
  revision: number,
) {
  return transaction(db, () => {
    const r = ownedGrowth(db, id, user);
    if (r.status === "REVIEW") return growthDetail(db, id, user);
    if (r.status !== "DRAFT" || r.revision !== revision)
      throw Error("Refresh and review the current draft");
    const input = validateGrowthInput(JSON.parse(r.input_json));
    if (!input.acknowledged)
      throw Error(
        "Read and accept the counting and targeting terms before submitting",
      );
    db.prepare(
      "UPDATE growth_orders SET status='REVIEW',updated_at=? WHERE id=?",
    ).run(stamp(), id);
    event(
      db,
      id,
      "submitted",
      "REVIEW",
      "Sent for review. This is not a purchase; no funds moved.",
      user,
    );
    return growthDetail(db, id, user);
  });
}
export function setGrowthPrice(
  db: Database,
  admin: string,
  product: GrowthProduct,
  body: any,
) {
  staff(db, admin);
  if (!Object.hasOwn(GROWTH_PRODUCTS, product)) throw Error("Unknown service");
  const { unitKobo, baseKobo, urgentBps, revision } = body;
  if (
    !(
      unitKobo === null ||
      (Number.isSafeInteger(unitKobo) && unitKobo >= 1 && unitKobo <= 1000000)
    ) ||
    !Number.isSafeInteger(baseKobo) ||
    baseKobo < 0 ||
    baseKobo > 100000000 ||
    !Number.isSafeInteger(urgentBps) ||
    urgentBps < 10000 ||
    urgentBps > 50000
  )
    throw Error("Use valid whole-kobo prices and urgency basis points");
  return transaction(db, () => {
    const changed = db
      .prepare(
        "UPDATE growth_prices SET unit_kobo=?,base_kobo=?,urgent_bps=?,revision=revision+1,updated_by=?,updated_at=? WHERE product=? AND revision=?",
      )
      .run(unitKobo, baseKobo, urgentBps, admin, stamp(), product, revision);
    if (!changed.changes) throw Error("Price settings changed. Refresh first");
    db.prepare(
      "INSERT INTO audit(user_id,action,entity_id,created_at) VALUES(?,?,?,?)",
    ).run(admin, "GROWTH_PRICE_CHANGED", product, stamp());
    return get(db, "SELECT * FROM growth_prices WHERE product=?", product);
  });
}
export function addGrowthAdmin(db: Database, admin: string, body: any) {
  staff(db, admin);
  if (
    typeof body.label !== "string" ||
    body.label.trim().length < 2 ||
    body.label.length > 60 ||
    !/^\+[1-9]\d{6,14}$/.test(body.phone) ||
    !["WA", "TG"].includes(body.platform)
  )
    throw Error(
      "Enter a label, platform and international service contact number",
    );
  if (
    get(
      db,
      "SELECT 1 FROM growth_service_admins WHERE platform=? AND phone=?",
      body.platform,
      body.phone,
    )
  )
    throw Error("This service contact is already registered for this platform");
  const id = randomUUID();
  db.prepare(
    "INSERT INTO growth_service_admins(id,label,phone,platform,enabled,created_at) VALUES(?,?,?,?,1,?)",
  ).run(id, body.label.trim(), body.phone, body.platform, stamp());
  return { id };
}
export function assignGrowthAdmins(
  db: Database,
  admin: string,
  id: string,
  ids: string[],
) {
  staff(db, admin);
  return transaction(db, () => {
    maintenanceGrowth(db, false);
    const r = ownedGrowth(db, id, admin, true),
      input = JSON.parse(r.input_json);
    if (!["REVIEW", "VERIFYING"].includes(r.status))
      throw Error("Campaign is not awaiting verification");
    if (!Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2)
      throw Error("Choose a primary and a different backup service admin");
    if (
      get(
        db,
        "SELECT 1 FROM growth_assignments WHERE order_id=? AND state IN('INVITED','VERIFIED','LEAVE_REQUIRED')",
        id,
      )
    )
      throw Error("An assignment already exists; resolve or remove it first");
    const now = stamp(),
      expires = new Date(Date.now() + 10 * 60000).toISOString();
    for (let n = 0; n < ids.length; n++) {
      const account = get(
        db,
        "SELECT * FROM growth_service_admins WHERE id=? AND enabled=1",
        ids[n],
      );
      if (
        !account ||
        account.platform !== (input.product.startsWith("WA") ? "WA" : "TG") ||
        (account.rest_until && account.rest_until > now)
      )
        throw Error("Service admin unavailable or resting");
      db.prepare(
        "INSERT INTO growth_assignments(id,order_id,service_admin_id,role,state,assigned_at,expires_at) VALUES(?,?,?,?,'INVITED',?,?)",
      ).run(randomUUID(), id, ids[n], n ? "BACKUP" : "PRIMARY", now, expires);
    }
    db.prepare(
      "UPDATE growth_orders SET status='VERIFYING',verification_expires_at=?,updated_at=? WHERE id=?",
    ).run(expires, now, id);
    event(
      db,
      id,
      randomUUID(),
      "VERIFYING",
      "Service contacts assigned. Approve access and required admin permissions within 10 minutes. Channel owners must send the admin invitation; no ownership transfer is needed.",
      admin,
    );
    return growthDetail(db, id, admin, true);
  });
}
export function recordGrowthVerification(
  db: Database,
  admin: string,
  id: string,
  body: any,
) {
  staff(db, admin);
  return transaction(db, () => {
    const r = ownedGrowth(db, id, admin, true);
    if (
      r.status !== "VERIFYING" ||
      !r.verification_expires_at ||
      r.verification_expires_at < stamp()
    )
      throw Error("Verification window expired or not active");
    if (
      body.code !== r.verification_code ||
      body.permissionsChecked !== true ||
      typeof body.note !== "string" ||
      body.note.trim().length < 12 ||
      body.note.length > 500
    )
      throw Error(
        "Confirm the matching code, actual permissions and an evidence note",
      );
    const assignments = all(
      db,
      "SELECT * FROM growth_assignments WHERE order_id=? AND state='INVITED'",
      id,
    );
    if (assignments.length !== 2)
      throw Error("Both service assignments must be present");
    db.prepare("INSERT INTO growth_access_evidence VALUES(?,?,?,?,?)").run(
      randomUUID(),
      id,
      body.note.trim(),
      admin,
      stamp(),
    );
    db.prepare(
      "UPDATE growth_assignments SET state='VERIFIED',verified_at=? WHERE order_id=? AND state='INVITED'",
    ).run(stamp(), id);
    db.prepare(
      "UPDATE growth_orders SET status='VERIFIED',updated_at=? WHERE id=?",
    ).run(stamp(), id);
    event(
      db,
      id,
      "verification",
      "VERIFIED",
      "Staff-attested access check recorded. Automated provider counting is not yet certified; no charge or broadcast started.",
      admin,
    );
    db.prepare(
      "INSERT INTO audit(user_id,action,entity_id,created_at) VALUES(?,?,?,?)",
    ).run(admin, "GROWTH_ACCESS_ATTESTED", id, stamp());
    return growthDetail(db, id, admin, true);
  });
}
export function createGrowthQuote(
  db: Database,
  admin: string,
  id: string,
  body: any,
) {
  staff(db, admin);
  return transaction(db, () => {
    const r = ownedGrowth(db, id, admin, true);
    if (!["VERIFIED", "QUOTED"].includes(r.status))
      throw Error("Verify destination access before quoting");
    const input = JSON.parse(r.input_json) as GrowthInput,
      p = get(db, "SELECT * FROM growth_prices WHERE product=?", input.product);
    if (!p?.unit_kobo) throw Error("Set this service price first");
    const inventory = growthInventory(db, input.product, input.countries, id);
    if (
      !Number.isSafeInteger(body.plannedGroups) ||
      body.plannedGroups < 1 ||
      body.plannedGroups > inventory.distinctGroups
    )
      throw Error(
        "There is not enough eligible, country-matched inventory for this plan",
      );
    const groups = inventory.groups.slice(0, body.plannedGroups),
      minimumWorker = groups.reduce((s, g) => s + g.workerMilli, 0);
    if (
      !Number.isSafeInteger(body.workerBudgetMilli) ||
      body.workerBudgetMilli < minimumWorker ||
      body.workerBudgetMilli > 999999999999 ||
      !Number.isSafeInteger(body.feeKobo) ||
      body.feeKobo < 0 ||
      body.feeKobo > 100000000
    )
      throw Error("Reserve the full planned worker cost and valid fees");
    const amount = Math.ceil(
      ((p.base_kobo + p.unit_kobo * input.quantity) *
        (input.lane === "URGENT" ? p.urgent_bps : 10000)) /
        10000,
    );
    if (
      !Number.isSafeInteger(amount) ||
      amount > 10000000000 ||
      amount < 4 * (Math.ceil(body.workerBudgetMilli / 10) + body.feeKobo)
    )
      throw Error(
        "Quote does not cover the existing minimum margin, full worker reserve and fees",
      );
    if (Date.parse(input.expectedAt) <= Date.now() + 30 * 60000)
      throw Error(
        "Requested deadline needs advertiser revision before a quote",
      );
    const quoteId = randomUUID(),
      expires = new Date(
        Math.min(Date.now() + 24 * 3600000, Date.parse(input.expectedAt)),
      ).toISOString();
    const plan = {
      post: buildGrowthUrlPost(input),
      distinctGroups: groups.length,
      workerReserveMilli: body.workerBudgetMilli,
      evidence: inventory.evidence,
      countryMeaning: GROWTH_PRODUCTS[input.product].channel
        ? "Advertising audience only; individual follower countries are not verifiable"
        : "Supported requester phone-number regions",
      deliveryPromise:
        "Estimate only; advertiser acceptance required for any deadline extension",
      mode: "ONE_FUNDED_LEG",
      automaticDispatchReady: false,
    };
    db.prepare("INSERT INTO growth_quotes VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
      quoteId,
      id,
      r.revision,
      p.revision,
      amount,
      body.workerBudgetMilli,
      body.feeKobo,
      JSON.stringify(plan),
      expires,
      admin,
      stamp(),
    );
    db.prepare(
      "UPDATE growth_orders SET status='QUOTED',quote_id=?,updated_at=? WHERE id=?",
    ).run(quoteId, stamp(), id);
    event(
      db,
      id,
      quoteId,
      "QUOTED",
      "A fixed quote is ready for review. Payment and live dispatch remain disabled until integration approval.",
      admin,
    );
    return growthDetail(db, id, admin, true);
  });
}
export function acceptGrowthQuote(
  db: Database,
  user: string,
  id: string,
  quoteId: string,
) {
  return transaction(db, () => {
    const r = ownedGrowth(db, id, user),
      q = get(
        db,
        "SELECT * FROM growth_quotes WHERE id=? AND order_id=?",
        quoteId,
        id,
      );
    if (r.status === "ACCEPTED" && r.quote_id === quoteId)
      return growthDetail(db, id, user);
    if (
      r.status !== "QUOTED" ||
      r.quote_id !== quoteId ||
      !q ||
      q.expires_at < stamp() ||
      q.order_revision !== r.revision
    )
      throw Error("Quote expired or changed. Request a fresh quote");
    db.prepare(
      "UPDATE growth_orders SET status='ACCEPTED',updated_at=? WHERE id=?",
    ).run(stamp(), id);
    event(
      db,
      id,
      "quote-accepted:" + quoteId,
      "ACCEPTED",
      "Quote accepted. Awaiting payment/provider setup; no money moved and no campaign started.",
      user,
    );
    return growthDetail(db, id, user);
  });
}
export function cancelGrowth(db: Database, user: string, id: string) {
  return transaction(db, () => {
    const r = ownedGrowth(db, id, user);
    if (r.status === "CANCELLED") return growthDetail(db, id, user);
    if (
      ![
        "DRAFT",
        "REVIEW",
        "VERIFYING",
        "VERIFIED",
        "QUOTED",
        "ACCEPTED",
      ].includes(r.status)
    )
      throw Error(
        "An active campaign needs support resolution; no automatic refund or replay",
      );
    if (
      get(
        db,
        "SELECT 1 FROM growth_payment_intents WHERE order_id=? AND status IN('CREATING','PENDING','VERIFIED','UNKNOWN')",
        id,
      )
    )
      throw Error("A payment needs reconciliation before cancellation");
    db.prepare(
      "UPDATE growth_orders SET status='CANCELLED',updated_at=? WHERE id=?",
    ).run(stamp(), id);
    db.prepare(
      "UPDATE growth_assignments SET state='LEAVE_REQUIRED' WHERE order_id=? AND state IN('INVITED','VERIFIED')",
    ).run(id);
    event(
      db,
      id,
      "cancelled",
      "CANCELLED",
      "Campaign cancelled before live work. Assigned service admins must remove their access.",
      user,
    );
    return growthDetail(db, id, user);
  });
}
export function maintenanceGrowth(db: Database, wrap = true, now = Date.now()) {
  const run = () => {
    const time = new Date(now).toISOString();
    for (const r of all(
      db,
      "SELECT id FROM growth_orders WHERE status='VERIFYING' AND verification_expires_at<=?",
      time,
    )) {
      db.prepare(
        "UPDATE growth_orders SET status='REVIEW',verification_expires_at=NULL,updated_at=? WHERE id=?",
      ).run(time, r.id);
      db.prepare(
        "UPDATE growth_assignments SET state='LEAVE_REQUIRED' WHERE order_id=? AND state='INVITED'",
      ).run(r.id);
      event(
        db,
        r.id,
        randomUUID(),
        "VERIFICATION_EXPIRED",
        "The 10-minute verification window expired. Do not proceed; service admins must cancel requests or leave through the supported process.",
      );
    }
    for (const r of all(
      db,
      "SELECT id FROM growth_orders WHERE status='RUNNING' AND deadline_at<=?",
      time,
    )) {
      db.prepare(
        "UPDATE growth_orders SET status='EXTENSION_REQUIRED',updated_at=? WHERE id=?",
      ).run(time, r.id);
      db.prepare(
        "UPDATE growth_batches SET status='CANCELLED' WHERE order_id=? AND status IN('PLANNED','RESERVED')",
      ).run(r.id);
      event(
        db,
        r.id,
        "deadline:" + time,
        "EXTENSION_REQUIRED",
        "Deadline reached. Further work is paused. An extension requires the advertiser’s acceptance; no extra spending is authorized.",
      );
    }
  };
  if (wrap) transaction(db, run);
  else run();
}
export function confirmGrowthLeave(
  db: Database,
  admin: string,
  assignment: string,
) {
  staff(db, admin);
  return transaction(db, () => {
    const a = get(
      db,
      "SELECT * FROM growth_assignments WHERE id=? AND state='LEAVE_REQUIRED'",
      assignment,
    );
    if (!a) throw Error("No outstanding removal assignment");
    db.prepare(
      "UPDATE growth_assignments SET state='LEFT',left_at=? WHERE id=?",
    ).run(stamp(), assignment);
    db.prepare("UPDATE growth_service_admins SET rest_until=? WHERE id=?").run(
      new Date(Date.now() + 10 * 60000).toISOString(),
      a.service_admin_id,
    );
    event(
      db,
      a.order_id,
      "left:" + assignment,
      "ACCESS_REMOVED",
      "Staff confirmed service access was removed. Service number resting for 10 minutes; this is not a ban-prevention guarantee.",
      admin,
    );
    if (
      !get(
        db,
        "SELECT 1 FROM growth_assignments WHERE order_id=? AND state<>'LEFT'",
        a.order_id,
      )
    )
      db.prepare(
        "UPDATE growth_orders SET status='COMPLETED',completed_at=?,updated_at=? WHERE id=? AND status='COMPLETING'",
      ).run(stamp(), stamp(), a.order_id);
    return { ok: true };
  });
}
export function proposeGrowthExtension(
  db: Database,
  admin: string,
  id: string,
  body: any,
) {
  staff(db, admin);
  return transaction(db, () => {
    const r = ownedGrowth(db, id, admin, true),
      time = Date.parse(body.expectedAt);
    if (
      r.status !== "EXTENSION_REQUIRED" ||
      !Number.isFinite(time) ||
      time < Date.now() + 30 * 60000 ||
      time > Date.now() + 90 * 86400000 ||
      typeof body.note !== "string" ||
      body.note.trim().length < 10 ||
      body.note.length > 500
    )
      throw Error("Choose a future extension and explain it");
    const eid = randomUUID();
    db.prepare(
      "INSERT INTO growth_extensions(id,order_id,previous_deadline,proposed_deadline,note,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
    ).run(
      eid,
      id,
      r.deadline_at,
      new Date(time).toISOString(),
      body.note.trim(),
      admin,
      stamp(),
    );
    event(
      db,
      id,
      eid,
      "EXTENSION_OFFERED",
      "A deadline extension is available for your approval. Target and price are unchanged.",
      admin,
    );
    return { id: eid };
  });
}
export function decideGrowthExtension(
  db: Database,
  user: string,
  id: string,
  extension: string,
  accept: boolean,
) {
  return transaction(db, () => {
    const r = ownedGrowth(db, id, user),
      e = get(
        db,
        "SELECT * FROM growth_extensions WHERE id=? AND order_id=? AND status='OFFERED'",
        extension,
        id,
      );
    if (
      r.status !== "EXTENSION_REQUIRED" ||
      !e ||
      e.proposed_deadline <= stamp()
    )
      throw Error("Extension is no longer available");
    db.prepare(
      "UPDATE growth_extensions SET status=?,decided_at=? WHERE id=?",
    ).run(accept ? "ACCEPTED" : "DECLINED", stamp(), extension);
    if (accept)
      db.prepare(
        "UPDATE growth_orders SET status='RUNNING',deadline_at=?,updated_at=? WHERE id=?",
      ).run(e.proposed_deadline, stamp(), id);
    event(
      db,
      id,
      "extension:" + extension,
      accept ? "EXTENSION_ACCEPTED" : "EXTENSION_DECLINED",
      accept
        ? "Advertiser accepted the new deadline. No additional charge or target reset."
        : "Advertiser declined. Campaign remains paused for support resolution.",
      user,
    );
    return growthDetail(db, id, user);
  });
}
// Provider-observer entrypoints only. Never expose participant input or counts as an advertiser-controlled API.
export function participantDigest(identityKey: string, participant: string) {
  if (
    identityKey.length < 32 ||
    typeof participant !== "string" ||
    participant.length > 200 ||
    !participant
  )
    throw Error("Trusted identity key and participant required");
  return createHmac("sha256", identityKey).update(participant).digest("hex");
}
export function recordGrowthRequest(
  db: Database,
  id: string,
  data: {
    participantHash: string;
    phone?: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    observedAt: string;
    baseline?: boolean;
  },
) {
  return transaction(db, () => {
    const r = get(db, "SELECT * FROM growth_orders WHERE id=?", id);
    if (!r) throw Error("Campaign not found");
    const input = JSON.parse(r.input_json) as GrowthInput;
    if (GROWTH_PRODUCTS[input.product].channel)
      throw Error("Channel orders use count observations");
    if (
      !/^[a-f0-9]{64}$/.test(data.participantHash) ||
      !["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(data.status) ||
      !Number.isFinite(Date.parse(data.observedAt)) ||
      Date.parse(data.observedAt) > Date.now() + 30000
    )
      throw Error("Invalid provider observation");
    data = { ...data, observedAt: new Date(data.observedAt).toISOString() };
    const prior = get(
      db,
      "SELECT * FROM growth_requests WHERE order_id=? AND participant_hash=?",
      id,
      data.participantHash,
    );
    if (prior) {
      if (data.observedAt <= prior.last_seen_at)
        return { counted: false, delivered: r.delivered };
      const region =
        prior.region || (data.phone ? requestRegion(data.phone) : undefined);
      const qualifies =
        !prior.qualified &&
        !prior.baseline &&
        r.status === "RUNNING" &&
        r.started_at &&
        prior.first_seen_at >= r.started_at &&
        data.observedAt <= r.deadline_at &&
        ["PENDING", "APPROVED"].includes(data.status) &&
        (!input.countries.length ||
          (!!region && input.countries.includes(region)));
      db.prepare(
        "UPDATE growth_requests SET status=?,last_seen_at=?,region=COALESCE(region,?),qualified=MAX(qualified,?) WHERE order_id=? AND participant_hash=?",
      ).run(
        data.status,
        data.observedAt,
        region || null,
        qualifies ? 1 : 0,
        id,
        data.participantHash,
      );
      if (qualifies)
        db.prepare(
          "UPDATE growth_orders SET delivered=delivered+1,updated_at=? WHERE id=?",
        ).run(stamp(), id);
      completeGrowthIfReady(db, id);
      return {
        counted: !!qualifies,
        delivered: get(db, "SELECT delivered FROM growth_orders WHERE id=?", id)
          .delivered,
        rejectSuggested:
          r.status === "RUNNING" &&
          !!input.countries.length &&
          !prior.qualified &&
          !qualifies,
      };
    }
    const baseline = data.baseline === true;
    if (baseline && r.started_at) throw Error("Baseline is already closed");
    if (
      !baseline &&
      (r.status !== "RUNNING" ||
        !r.started_at ||
        data.observedAt < r.started_at ||
        data.observedAt > r.deadline_at)
    )
      return { counted: false, delivered: r.delivered };
    const region = data.phone ? requestRegion(data.phone) : undefined,
      qualified =
        !baseline &&
        (data.status === "PENDING" || data.status === "APPROVED") &&
        (!input.countries.length ||
          (!!region && input.countries.includes(region)));
    db.prepare("INSERT INTO growth_requests VALUES(?,?,?,?,?,?,?,?)").run(
      id,
      data.participantHash,
      baseline ? 1 : 0,
      qualified ? 1 : 0,
      region || null,
      data.status,
      data.observedAt,
      data.observedAt,
    );
    if (qualified)
      db.prepare(
        "UPDATE growth_orders SET delivered=delivered+1,updated_at=? WHERE id=?",
      ).run(stamp(), id);
    completeGrowthIfReady(db, id);
    return {
      counted: qualified,
      delivered: get(db, "SELECT delivered FROM growth_orders WHERE id=?", id)
        .delivered,
      rejectSuggested: !baseline && !!input.countries.length && !qualified,
    };
  });
}
export function recordGrowthCount(
  db: Database,
  id: string,
  data: { providerEvent: string; count: number; observedAt: string },
) {
  return transaction(db, () => {
    const r = get(db, "SELECT * FROM growth_orders WHERE id=?", id);
    if (!r) throw Error("Campaign not found");
    const input = JSON.parse(r.input_json) as GrowthInput;
    if (!GROWTH_PRODUCTS[input.product].channel || r.status !== "RUNNING")
      throw Error("An active channel campaign is required");
    const time = Date.parse(data.observedAt);
    if (
      !Number.isSafeInteger(r.baseline_count) ||
      r.baseline_count < 0 ||
      !r.started_at ||
      !r.deadline_at
    )
      throw Error(
        "An exact provider baseline and measurement window are required",
      );
    if (
      !Number.isSafeInteger(data.count) ||
      data.count < 0 ||
      data.count > 1000000000 ||
      !Number.isFinite(time) ||
      time < Date.parse(r.started_at) ||
      time > Date.now() + 30000 ||
      time > Date.parse(r.deadline_at) ||
      typeof data.providerEvent !== "string" ||
      data.providerEvent.length < 1 ||
      data.providerEvent.length > 150
    )
      throw Error("Use an exact, in-window provider count");
    data = { ...data, observedAt: new Date(time).toISOString() };
    const last = get(
      db,
      "SELECT observed_at FROM growth_observations WHERE order_id=? ORDER BY observed_at DESC LIMIT 1",
      id,
    );
    const inserted = db
      .prepare("INSERT OR IGNORE INTO growth_observations VALUES(?,?,?,?,?,?)")
      .run(
        randomUUID(),
        id,
        data.providerEvent,
        data.count,
        data.observedAt,
        stamp(),
      );
    if (!inserted.changes || (last && last.observed_at >= data.observedAt))
      return { ignored: true };
    const delivered = Math.max(0, data.count - r.baseline_count);
    db.prepare(
      "UPDATE growth_orders SET observed_count=?,delivered=?,updated_at=? WHERE id=?",
    ).run(data.count, delivered, stamp(), id);
    completeGrowthIfReady(db, id);
    return { delivered };
  });
}
function completeGrowthIfReady(db: Database, id: string) {
  const r = get(
    db,
    "SELECT * FROM growth_orders WHERE id=? AND status='RUNNING'",
    id,
  );
  if (!r) return;
  const input = JSON.parse(r.input_json);
  if (r.delivered < input.quantity) return;
  db.prepare(
    "UPDATE growth_orders SET status='COMPLETING',completed_at=?,updated_at=? WHERE id=?",
  ).run(stamp(), stamp(), id);
  db.prepare(
    "UPDATE growth_batches SET status='CANCELLED' WHERE order_id=? AND status IN('PLANNED','RESERVED')",
  ).run(id);
  db.prepare(
    "UPDATE growth_assignments SET state='LEAVE_REQUIRED' WHERE order_id=? AND state IN('INVITED','VERIFIED')",
  ).run(id);
  event(
    db,
    id,
    "target-reached",
    "TARGET_REACHED",
    "Target reached. Unstarted batches stopped; service admins must promptly remove access. Later arrivals do not create extra charges.",
  );
}
export function recordGrowthAudience(db: Database, admin: string, body: any) {
  staff(db, admin);
  if (
    !GROWTH_COUNTRIES.some((c) => c[0] === body.country) ||
    !Number.isSafeInteger(body.sampleTotal) ||
    body.sampleTotal < 1 ||
    body.sampleTotal > 100000 ||
    !Number.isSafeInteger(body.matching) ||
    body.matching < 0 ||
    body.matching > body.sampleTotal ||
    !["PERMITTED_PREFIX_SAMPLE", "DECLARED_AUDIENCE"].includes(body.source) ||
    typeof body.evidenceNote !== "string" ||
    body.evidenceNote.trim().length < 12 ||
    body.evidenceNote.length > 500
  )
    throw Error("Valid aggregate sample and evidence are required");
  if (
    body.source === "PERMITTED_PREFIX_SAMPLE" &&
    !GROWTH_COUNTRIES.find((c) => c[0] === body.country)?.[2]
  )
    throw Error(
      "This region cannot be unambiguously classified by the supported prefix sampler. Record as declared for review only",
    );
  if (
    !get(
      db,
      "SELECT 1 FROM group_inventory WHERE account_id=? AND group_jid=?",
      body.accountId,
      body.groupJid,
    )
  )
    throw Error("Owned inventory group not found");
  db.prepare(
    "INSERT INTO growth_audiences VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(account_id,group_jid,country) DO UPDATE SET sample_total=excluded.sample_total,matching=excluded.matching,source=excluded.source,evidence_note=excluded.evidence_note,observed_at=excluded.observed_at,recorded_by=excluded.recorded_by",
  ).run(
    body.accountId,
    body.groupJid,
    body.country,
    body.sampleTotal,
    body.matching,
    body.source,
    body.evidenceNote.trim(),
    stamp(),
    admin,
  );
  return { ok: true };
}

export function setGrowthAudiencePolicy(
  db: Database,
  admin: string,
  body: any,
) {
  staff(db, admin);
  if (
    !Number.isSafeInteger(body.minSample) ||
    body.minSample < 20 ||
    body.minSample > 100000 ||
    !Number.isSafeInteger(body.minMatchBps) ||
    body.minMatchBps < 5001 ||
    body.minMatchBps > 10000 ||
    !Number.isSafeInteger(body.maxAgeHours) ||
    body.maxAgeHours < 1 ||
    body.maxAgeHours > 168
  )
    throw Error(
      "Choose a sample of at least 20, more than 50% match, and freshness from 1–168 hours",
    );
  return transaction(db, () => {
    const changed = db
      .prepare(
        "UPDATE growth_policy SET min_sample=?,min_match_bps=?,max_age_hours=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=1 AND revision=?",
      )
      .run(
        body.minSample,
        body.minMatchBps,
        body.maxAgeHours,
        admin,
        stamp(),
        body.revision,
      );
    if (!changed.changes) throw Error("Audience policy changed. Refresh first");
    db.prepare(
      "INSERT INTO audit(user_id,action,entity_id,created_at) VALUES(?,?,?,?)",
    ).run(admin, "GROWTH_AUDIENCE_POLICY_CHANGED", "growth_policy", stamp());
    return get(db, "SELECT * FROM growth_policy WHERE id=1");
  });
}
export function growthWorkerShift(db: Database, user: string) {
  if (get(db, "SELECT role FROM users WHERE id=?", user)?.role !== "EARNER")
    throw Error("Worker account required");
  const row = get(
    db,
    "SELECT available_until FROM growth_worker_shifts WHERE user_id=?",
    user,
  );
  return {
    availableUntil: row?.available_until || null,
    available: !!row && row.available_until > stamp(),
    liveDispatch: false,
    note: "Voluntary planning availability only. No earnings or work are guaranteed. Existing paid-broadcast settings are unchanged.",
  };
}
export function setGrowthWorkerShift(
  db: Database,
  user: string,
  minutes: number,
) {
  growthWorkerShift(db, user);
  if (
    !Number.isSafeInteger(minutes) ||
    ![0, 30, 60, 120, 240].includes(minutes)
  )
    throw Error("Choose off, 30 minutes, 1 hour, 2 hours or 4 hours");
  const now = stamp();
  db.prepare(
    "INSERT INTO growth_worker_shifts VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET available_until=excluded.available_until,updated_at=excluded.updated_at",
  ).run(user, new Date(Date.now() + minutes * 60000).toISOString(), now);
  return growthWorkerShift(db, user);
}
