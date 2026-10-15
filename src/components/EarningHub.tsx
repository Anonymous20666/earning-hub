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
import { groupEligibility } from "../../shared/earningRules";
export function EarningHub({
  view,
  revision = 0,
}: {
  view: "connections" | "referrals" | "calculator";
  revision?: number;
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
      {view === "calculator" && <EarningCalculator />}
      {data && view === "connections" && (
        <>
          <div className="workspace-banner">
            <ShieldCheck size={22} />
            <div>
              <strong>Two numbers. One owner. No double counting.</strong>
              <p>
                A shared group counts once per campaign. Excluding a group never
                makes your number leave it.
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
              label="Group memberships"
              value={data.summary.memberships}
              note="Across both numbers"
            />
            <Stat
              label="Unique qualifying groups"
              value={data.summary.uniqueQualified}
              note="100+ members & posting allowed"
            />
            <Stat
              label="Duplicate memberships"
              value={data.summary.duplicateMemberships}
              note="Qualifying overlaps removed"
            />
            <Stat
              label="Consent-approved groups"
              value={data.summary.approvedUnique}
              note="Current permission on record"
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR WHATSAPP ACCOUNTS</span>
                <h2>Room for two connections.</h2>
              </div>
              <span className="badge neutral">
                {data.accounts.filter((a: any) => a.status === "ONLINE").length}{" "}
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
                Messaging is not configured. No pairing code is generated and no
                account access is requested.{" "}
                <a href="#/app/status">See service status.</a>
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR REAL INVENTORY</span>
                <h2>Groups, without the guesswork.</h2>
                <p>
                  Tier: {data.tier.tier.toLowerCase()} · {data.tier.goldUnits}{" "}
                  full 100-group units · {data.tier.remainderGroups} remainder.
                  Tiers do not cap earnings.
                </p>
              </div>
            </div>
            {!data.groups.some((g: any) => g.isMember) ? (
              <div className="earning-empty">
                <Users size={30} />
                <h3>No groups scanned yet.</h3>
                <p>
                  Only groups returned by a connected provider will appear.
                  Having a group is not the same as having permission to
                  advertise in it.
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
                      <th>Qualification</th>
                      <th>Permission</th>
                      <th>Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups
                      .filter((g: any) => g.isMember)
                      .map((g: any) => {
                        const q = groupEligibility(g);
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
                                  : q.reason}
                            </td>
                            <td>{g.approved ? "Approved" : "Not approved"}</td>
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
              Qualified membership value is an estimate, not an available
              balance. Paid delivery also requires current consent, fresh
              metadata, allocated funds and verified provider confirmation.
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
              <strong>Invite someone. Keep the reward transparent.</strong>
              <p>
                ₦5 = 5.000 Coins. A signup alone does not create an earned
                reward.
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
                  <strong>5.000 Coins becomes earned</strong>
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
function EarningCalculator() {
  const [members, setMembers] = useState(""),
    [broadcasts, setBroadcasts] = useState(1);
  const tokens = members.trim() ? members.trim().split(/[\s,;]+/) : [];
  const valid = tokens.every(
    (t) => /^\d{1,7}$/.test(t) && Number.isSafeInteger(Number(t)),
  );
  const counts = valid ? tokens.map(Number) : [],
    qualifying = counts.filter((n) => n >= 100),
    total = qualifying.reduce((sum, n) => sum + Math.min(n, 1000), 0);
  return (
    <>
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
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PLAN, DON’T GUESS</span>
              <h2>What would a broadcast earn?</h2>
            </div>
          </div>
          <label htmlFor="member-counts">
            Members in each unique qualifying group
          </label>
          <p className="field-help">
            Enter one count per line or separate with commas. Assume posting is
            allowed and remove shared groups first.
          </p>
          <textarea
            id="member-counts"
            rows={7}
            maxLength={100000}
            value={members}
            onChange={(e) => setMembers(e.target.value)}
            placeholder="Enter your group member counts"
          />
          <button
            className="text-link"
            onClick={() => setMembers("256\n290\n466\n278")}
          >
            Try the agreed four-group example
          </button>
          {!valid && (
            <p role="alert" className="field-error">
              Use whole member counts only, up to seven digits each.
            </p>
          )}
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
            Up to 10 is a capacity limit, not a promised schedule or guaranteed
            demand.
          </p>
        </section>
        <section className="panel earning-result">
          <span className="eyebrow">ILLUSTRATION ONLY</span>
          <div className="earning-result-amount">
            <strong>{coins(total)}</strong>
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
              <strong>{coins(total * broadcasts)} Coins</strong>
            </p>
            <p>
              <span>NGN reference value</span>
              <strong>₦{coins(total * broadcasts)}</strong>
            </p>
          </div>
          <p className="earning-formula">
            Reward = min(members, 1,000) ÷ 1,000 Coins per successful group.
          </p>
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
            <strong>1 Coin = ₦1 worldwide.</strong>
            <br />
            500 Coins means ₦500 value, not 500 units of another currency. FX
            and fees require a real quote.
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
    </>
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
