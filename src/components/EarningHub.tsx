import { CoinValue } from "./CoinValue";
import {
  EARNING_RULES,
  DAILY_EARNING_EXAMPLE,
} from "../../shared/earningRules";
import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Link2,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  Calculator,
  Lock,
  AlertCircle,
} from "lucide-react";
import { api, send, coins, date } from "../api";
import { placementRewardMilli } from "../../shared/earningRules";
export function EarningHub({
  view,
  revision = 0,
  hideNumberSlots = false,
}: {
  view: "connections" | "referrals" | "calculator";
  revision?: number;
  hideNumberSlots?: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await api("/earnings"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [revision]);
  async function exclude(g: any) {
    setBusy(true);
    setError("");
    try {
      await send(
        "/earnings/groups/exclusion",
        { accountId: g.accountId, groupJid: g.groupJid, excluded: !g.excluded },
        "PATCH",
      );
      await load();
      setNotice(
        g.excluded
          ? "Group restored to your inventory."
          : "Group excluded from future selection. It has not been left.",
      );
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  const referralUrl = data
    ? `${window.location.origin}/#/join/worker?ref=${data.referrals.code}`
    : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setNotice("Referral link copied.");
    } catch {
      setNotice(
        "Copy is unavailable in this browser. Select and copy the link below.",
      );
    }
  }
  return (
    <div className="earning-hub">
      {error && (
        <div className="notice warning" role="alert">
          <AlertCircle size={18} />
          <p>{error}</p>
          <button className="text-link" onClick={load}>
            Try again
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <Check size={18} />
          <p>{notice}</p>
        </div>
      )}
      {!data && !error && <p role="status">Loading your earning records…</p>}
      {view === "calculator" && (
        <EarningCalculator ownedGroups={data?.groups || []} />
      )}
      {data && view === "connections" && (
        <>
          <div className="workspace-banner">
            <ShieldCheck size={22} />
            <div>
              <strong>Two numbers. One owner. No double counting.</strong>
              <p>
                If both numbers are in the same group, the post goes there once.
                Hiding a group here does not make you leave it in WhatsApp.
              </p>
            </div>
            <button
              className="button button-outline small"
              disabled={busy}
              onClick={load}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
          <div className="earning-stats">
            <Stat
              label="Groups found"
              value={
                new Set(
                  data.groups
                    .filter((g: any) => g.isMember)
                    .map((g: any) => g.groupJid),
                ).size
              }
              note="All sizes are included"
            />
            <Stat
              label="Groups with 100+ members"
              value={
                new Set(
                  data.groups
                    .filter((g: any) => g.isMember && g.memberCount >= 100)
                    .map((g: any) => g.groupJid),
                ).size
              }
              note="May earn from paid posts"
            />
            <Stat
              label="Groups on both numbers"
              value={
                data.groups.filter((g: any) => g.isMember).length -
                new Set(
                  data.groups
                    .filter((g: any) => g.isMember)
                    .map((g: any) => g.groupJid),
                ).size
              }
              note="We only send to them once"
            />
            <Stat
              label="Open group chats"
              value={
                new Set(
                  data.groups
                    .filter(
                      (g: any) =>
                        g.isMember &&
                        (!g.announce || g.userIsAdmin) &&
                        !g.excluded,
                    )
                    .map((g: any) => g.groupJid),
                ).size
              }
              note="Status is checked separately by WhatsApp"
            />
          </div>
          {!hideNumberSlots && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">YOUR WHATSAPP ACCOUNTS</span>
                  <h2>Room for two connections.</h2>
                </div>
                <span className="badge neutral">
                  {
                    data.accounts.filter((a: any) => a.status === "ONLINE")
                      .length
                  }{" "}
                  / 2 online
                </span>
              </div>
              <div className="number-slots">
                {[1, 2].map((slot) => {
                  const a = data.accounts.find((x: any) => x.slot === slot);
                  return (
                    <div className="number-slot" key={slot}>
                      <span className="outlined-icon">
                        <Link2 size={21} />
                      </span>
                      <div>
                        <span className="eyebrow">NUMBER {slot}</span>
                        <h3>{a ? a.phone_label : "Not connected"}</h3>
                        <p>
                          {a
                            ? `${a.status} · ${a.scanner_at ? "Last scanned " + date(a.scanner_at) : "Not scanned yet"}`
                            : "A real provider-confirmed connection will appear here."}
                        </p>
                      </div>
                      <span className="badge neutral">
                        {a ? a.status : "Pairing unavailable"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="notice warning">
                <Lock size={18} />
                <p>
                  Messaging is not configured. No pairing code is generated and
                  no account access is requested.{" "}
                  <a href="#/app/status">See service status.</a>
                </p>
              </div>
            </section>
          )}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR GROUPS</span>
                <h2>All your groups. Small ones too.</h2>
                <p>
                  Small groups can receive posts. They just do not earn paid
                  rewards until they reach 100 members.
                </p>
              </div>
            </div>
            {!data.groups.some((g: any) => g.isMember) ? (
              <div className="earning-empty">
                <Users size={30} />
                <h3>No groups found yet.</h3>
                <p>
                  Connect your number above, then tap Find my groups. You will
                  must follow WhatsApp’s native posting rules. No extra admin
                  command is required.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">Your group inventory</caption>
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Members</th>
                      <th>Paid reward</th>
                      <th>WhatsApp posting rules</th>
                      <th>Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups
                      .filter((g: any) => g.isMember)
                      .map((g: any) => {
                        const q = {
                          qualified: g.isMember && g.memberCount >= 100,
                          rewardMilli: placementRewardMilli(g.memberCount),
                          reason: "Not available",
                        };
                        return (
                          <tr key={g.accountId + g.groupJid}>
                            <td>
                              <strong>{g.subject || "Unnamed group"}</strong>
                              <small>
                                Number{" "}
                                {
                                  data.accounts.find(
                                    (a: any) => a.id === g.accountId,
                                  )?.slot
                                }
                              </small>
                            </td>
                            <td>{g.memberCount.toLocaleString()}</td>
                            <td>
                              {g.excluded
                                ? "Excluded"
                                : q.qualified
                                  ? `${coins(q.rewardMilli)} Coins`
                                  : g.memberCount < 100
                                    ? "Can get posts · 0 Coins (under 100 members)"
                                    : q.reason}
                            </td>
                            <td>
                              Group status: checked by WhatsApp at send
                              <br />
                              Chat:{" "}
                              {g.announce && !g.userIsAdmin
                                ? "Admins only — skipped"
                                : "Open to your number"}
                            </td>
                            <td>
                              <button
                                className="text-link"
                                disabled={busy}
                                onClick={() => exclude(g)}
                              >
                                {g.excluded ? "Restore" : "Exclude"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="earning-footnote">
              Your own posts are free and never earn Coins. Paid jobs are not
              open yet. When they open, only confirmed posts in groups with 100+
              members can earn.
            </div>
          </section>
          <a className="earning-link" href="#/app/calculator">
            <Calculator size={20} />
            <div>
              <strong>Understand your earning calculation</strong>
              <span>Exact member-based rewards, with no 100-group cap.</span>
            </div>
            <ArrowRight size={18} />
          </a>
        </>
      )}
      {data && view === "referrals" && (
        <>
          <div className="workspace-banner">
            <Users size={22} />
            <div>
              <strong>
                Invite a friend. Earn 100 Coins when they qualify.
              </strong>
              <p>
                100 Coins per qualifying friend. A signup alone does not create
                an earned reward.
              </p>
            </div>
          </div>
          <div className="earning-stats three">
            <Stat
              label="Workers referred"
              value={data.referrals.total}
              note="Registered with your code"
            />
            <Stat
              label="Pending referral rewards"
              value={coins(data.referrals.pending_milli)}
              note="Conditional Coins · not withdrawable"
            />
            <Stat
              label="Earned referral rewards"
              value={coins(data.referrals.earned_milli)}
              note="Coins credited to your earned wallet"
            />
          </div>
          <section className="panel referral-share">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR PERSONAL INVITE</span>
                <h2>A link worth sharing responsibly.</h2>
              </div>
              <Users size={25} />
            </div>
            <label htmlFor="referral-link">Your referral link</label>
            <div className="referral-input">
              <input
                id="referral-link"
                readOnly
                value={referralUrl}
                onFocus={(e) => e.target.select()}
              />
              <button className="button button-primary" onClick={copy}>
                <Copy size={16} />
                Copy link
              </button>
            </div>
            <p>
              Share with people who want to join. Do not send unsolicited bulk
              invitations.
            </p>
            <ol className="referral-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>Your friend creates a worker account</strong>
                  <p>Your code is attached once at registration.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>
                    They pair a number and complete a qualifying delivery
                  </strong>
                  <p>
                    A funded, approved campaign must produce verified delivery
                    confirmation.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>100 Coins becomes earned</strong>
                  <p>
                    Credited once. The standard withdrawal rules still apply.
                  </p>
                </div>
              </li>
            </ol>
            <div className="notice warning">
              <Lock size={18} />
              <p>
                Paid broadcasts and payouts are not live. Pending rewards are
                conditional and do not represent received cash or a guaranteed
                payment date.
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Referral history</h2>
              <span className="badge neutral">Latest 100</span>
            </div>
            {data.referrals.referrals.length === 0 ? (
              <div className="earning-empty">
                <Users size={28} />
                <h3>Your first invitation starts here.</h3>
                <p>
                  No referred workers yet. We show actual registrations, not
                  sample activity.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Registration</th>
                      <th>Reward</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrals.referrals.map((r: any) => (
                      <tr key={r.id}>
                        <td>{date(r.created_at)}</td>
                        <td>{coins(r.reward_milli)} Coins</td>
                        <td>
                          {r.status === "RESERVED" ? "PENDING" : r.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="earning-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export function EarningCalculator({
  ownedGroups = [],
}: {
  ownedGroups?: any[];
}) {
  const [members, setMembers] = useState(""),
    [broadcasts, setBroadcasts] = useState(1),
    [mode, setMode] = useState("ALLSTATUS");
  const tokens = members.trim() ? members.trim().split(/[\s,;]+/) : [];
  const valid = tokens.every(
    (t) => /^\d{1,7}$/.test(t) && Number.isSafeInteger(Number(t)),
  );
  const counts = valid ? tokens.map(Number) : [],
    qualifying = counts.filter((n) => n >= 100),
    total =
      qualifying.reduce((sum, n) => sum + Math.min(n, 1000), 0) *
      (mode === "DOUBLE" ? 2 : 1);
  return (
    <div className="earning-hub earning-calculator">
      <div className="workspace-banner">
        <Calculator size={23} />
        <div>
          <strong>Exact maths. No income promises.</strong>
          <p>
            One qualifying group is enough. Every unique qualifying group can
            count; there is no 100-group earning ceiling.
          </p>
        </div>
      </div>
      <div className="earning-calc-grid">
        <section className="panel calculator-input-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PLAN, DON’T GUESS</span>
              <h2>What would a broadcast earn?</h2>
            </div>
          </div>
          <div className="calculator-field calculator-groups-field">
            <label htmlFor="member-counts">
              Members in each unique qualifying group
            </label>
            <p className="field-help" id="member-counts-help">
              Enter one count per line or separate with commas. Assume posting
              is allowed and remove shared groups first.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!ownedGroups.some((g) => g.isMember && !g.excluded)}
              onClick={() => {
                const unique = [
                  ...new Map<string, any>(
                    ownedGroups
                      .filter((g) => g.isMember && !g.excluded)
                      .map((g) => [g.groupJid, g]),
                  ).values(),
                ];
                setMembers(unique.map((g) => String(g.memberCount)).join("\n"));
              }}
            >
              Use my connected groups
            </button>
            {!ownedGroups.length && (
              <p className="field-help">
                Enter your groups manually, or{" "}
                <a href="#/app/connections">connect WhatsApp</a> to import real
                group counts. Shared groups are imported once.
              </p>
            )}
            <textarea
              id="member-counts"
              rows={7}
              maxLength={100000}
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              aria-describedby="member-counts-help"
              placeholder={"For example:\n100\n742\n1000"}
            />
            <button
              className="button button-outline calculator-small-example"
              onClick={() => setMembers("256\n290\n466\n278")}
            >
              Try a four-group example
            </button>
            {!valid && (
              <p role="alert" className="field-error">
                Use whole member counts only, up to seven digits each.
              </p>
            )}
          </div>
          <div className="calculator-field">
            <label htmlFor="earning-surface">Post type</label>
            <select
              id="earning-surface"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="ALLSTATUS">Group status</option>
              <option value="ALLCHAT">Group chat</option>
              <option value="DOUBLE">Both — status and chat confirmed</option>
            </select>
          </div>
          <div className="calculator-field">
            <label htmlFor="daily-broadcasts">
              Hypothetical broadcasts in one day
            </label>
            <select
              id="daily-broadcasts"
              value={broadcasts}
              onChange={(e) => setBroadcasts(Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <p className="field-help">
              Up to 10 is a capacity limit, not a promised schedule or
              guaranteed demand.
            </p>
          </div>
          <fieldset className="calculator-examples">
            <legend>Try a daily example</legend>
            <p className="field-help">
              These examples fill in the calculator. They are not promised jobs
              or income.
            </p>
            <button
              type="button"
              className="button button-outline potential-preset"
              onClick={() => {
                setMembers(
                  Array(DAILY_EARNING_EXAMPLE.groups)
                    .fill(String(DAILY_EARNING_EXAMPLE.members))
                    .join("\n"),
                );
                setBroadcasts(DAILY_EARNING_EXAMPLE.campaigns);
                setMode("DOUBLE");
              }}
            >
              Try the 1,000-Coin daily example
            </button>
            <button
              type="button"
              className="button button-outline potential-preset"
              onClick={() => {
                setMembers(Array(250).fill("1000").join("\n"));
                setBroadcasts(10);
                setMode("DOUBLE");
              }}
            >
              Try the 5,000-Coin daily example
            </button>
          </fieldset>
        </section>
        <section className="panel earning-result">
          <span className="eyebrow">ILLUSTRATION ONLY</span>
          <div className="earning-result-amount">
            <strong>{coins(valid ? total : 0)}</strong>
            <span>Coins per successful broadcast</span>
          </div>
          <div className="earning-result-rows">
            <p>
              <span>Qualifying unique groups</span>
              <strong>{qualifying.length}</strong>
            </p>
            <p>
              <span>Below 100 members</span>
              <strong>{counts.length - qualifying.length}</strong>
            </p>
            <p>
              <span>
                {broadcasts} hypothetical broadcast{broadcasts === 1 ? "" : "s"}
              </span>
              <strong>{coins(valid ? total * broadcasts : 0)} Coins</strong>
            </p>
          </div>
          <p className="earning-formula">
            Reward = min(members, 1,000) ÷ 1,000 Coins per confirmed post type.
            Both mode needs both status and chat to succeed for the full result.
            The 1,000/day example needs 50 unique 1,000+ member groups × 10
            funded campaigns × 2 confirmed post types. The 5,000/day example
            needs 250 such groups × 10 × 2. These are theoretical workloads, not
            typical earnings. Imported counts are an upper-bound illustration:
            offline numbers, locked chats, restricted status, removed groups and
            missing funded work reduce actual earnings. Paid work and cashout
            are not open yet.
          </p>
          <CoinValue amount={valid ? (total * broadcasts) / 1000 : 0} />
          <div className="notice">
            <ShieldCheck size={18} />
            <p>
              Nothing here is added to your wallet. Real rewards require
              cash-backed campaigns, current group permission and verified
              delivery. Member counts are not views or conversions.
            </p>
          </div>
        </section>
      </div>
      <section className="panel earning-rules">
        <h2>The rules stay consistent.</h2>
        <div>
          <p>
            <strong>Your balance is measured in Coins.</strong>
            <br />
            Coins are platform reward units, not your local currency. Supported
            cashout locations, conversion quotes and fees will be shown before
            you confirm a withdrawal. Cashout is not live yet.
          </p>
          <p>
            <strong>Your welcome bonus stays locked.</strong>
            <br />
            First withdrawal needs at least 300 earned Coins plus the one-time
            200 bonus, reaching 500 total. Later minimum: 500 earned Coins.
          </p>
          <p>
            <strong>No peer-to-peer transfers.</strong>
            <br />
            Payouts remain unavailable until a verified provider is integrated.
            Promised investment or expected ad revenue never counts as cash.
          </p>
        </div>
      </section>
    </div>
  );
}
export function TreasuryPanel({ revision = 0 }: { revision?: number }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setData(await api("/admin/treasury"));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [revision]);
  async function action(url: string) {
    setBusy(true);
    setError("");
    try {
      await send(url, {});
      await load();
      setNotice("Operation saved. No message was sent.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await send("/admin/house-campaigns", Object.fromEntries(f));
      form.reset();
      await load();
      setNotice(
        "House campaign draft saved. No funds reserved and no message sent.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="earning-hub">
      {error && (
        <div role="alert" className="notice warning">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {data ? (
        <>
          <div className="workspace-banner">
            <Wallet size={22} />
            <div>
              <strong>Cash first. Obligations always visible.</strong>
              <p>
                Funding records are operator-verified cleared funds, not a live
                bank balance feed. No funding has been invented.
              </p>
            </div>
            <button className="button button-outline small" onClick={load}>
              Refresh
            </button>
          </div>
          <div className="earning-stats">
            <Stat
              label="Recorded cash"
              value={coins(data.treasury.cash_milli)}
              note="NGN-backed Coins"
            />
            <Stat
              label="Available for allocation"
              value={coins(data.treasury.available_milli)}
              note="After all existing reservations"
            />
            <Stat
              label="Reserved delivery funds"
              value={coins(data.treasury.reserved_milli)}
              note="Campaigns & referrals"
            />
            <Stat
              label="Earned obligations"
              value={coins(data.treasury.payable_milli)}
              note="Not withdrawable until payout setup"
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Funding control centre</h2>
                <p>
                  {coins(data.treasury.bonus_backing_milli)} Coins separately
                  held to back conditional bonuses.
                </p>
              </div>
              <span className={`badge ${data.ok ? "green" : "neutral"}`}>
                {data.ok ? "Reconciled" : "Reconciliation required"}
              </span>
            </div>
            <div className="notice warning">
              <Lock size={18} />
              <p>
                Dispatch is {data.settings.dispatch_enabled ? "enabled" : "off"}
                . Messaging and payouts are not configured. New workers’ full
                conditional welcome bonuses and any referral rewards must be
                backed before a delivery can be reserved. That cash is
                additional to the campaign’s worker-reward budget.
              </p>
            </div>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => action("/admin/dispatch/stop")}
            >
              Keep dispatch stopped
            </button>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Plan a house campaign</h2>
              <span className="badge neutral">No fixed-price checkout</span>
            </div>
            <form className="earning-campaign-form" onSubmit={create}>
              <label>
                Campaign title
                <input required name="title" minLength={3} maxLength={120} />
              </label>
              <label>
                Destination URL
                <input
                  required
                  type="url"
                  name="targetUrl"
                  placeholder="https://"
                  maxLength={1000}
                />
              </label>
              <label>
                Worker-reward budget in Coins
                <input
                  required
                  name="rewardBudget"
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,3})?"
                  placeholder="0.000"
                />
              </label>
              <label>
                Message
                <textarea
                  required
                  name="message"
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                />
              </label>
              <button className="button button-primary" disabled={busy}>
                Save unfunded draft
              </button>
            </form>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>House campaign budgets</h2>
              <span className="badge neutral">Latest 100</span>
            </div>
            {data.campaigns.length === 0 ? (
              <div className="earning-empty">
                <Wallet />
                <h3>No campaign budgets yet.</h3>
                <p>Saving a draft does not create money or reserve funds.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Budget</th>
                      <th>Remaining / in flight</th>
                      <th>Paid</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c: any) => (
                      <tr key={c.id}>
                        <td>{c.title}</td>
                        <td>{c.status}</td>
                        <td>{coins(c.reward_budget_milli)}</td>
                        <td>
                          {coins(c.remaining_milli)} /{" "}
                          {coins(c.allocated_milli)}
                        </td>
                        <td>{coins(c.paid_milli)}</td>
                        <td>
                          {c.status === "DRAFT" && (
                            <button
                              className="text-link"
                              disabled={busy}
                              onClick={() =>
                                action(`/admin/house-campaigns/${c.id}/fund`)
                              }
                            >
                              Reserve verified funds
                            </button>
                          )}
                          {!["CANCELLED", "COMPLETED"].includes(c.status) && (
                            <button
                              className="text-link"
                              disabled={busy || c.allocated_milli > 0}
                              onClick={() =>
                                action(`/admin/house-campaigns/${c.id}/close`)
                              }
                            >
                              Cancel & release unused rewards
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        !error && <p role="status">Loading treasury…</p>
      )}
    </div>
  );
}
