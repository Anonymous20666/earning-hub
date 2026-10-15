import React, { useState, useEffect } from "react";
import {
  Link2,
  Copy,
  RefreshCw,
  ShieldCheck,
  Send,
  Lock,
  AlertCircle,
} from "lucide-react";
import { api, send, date } from "../api";
import { EarningHub } from "./EarningHub";
export function WhatsAppConnections({ revision = 0 }: { revision?: number }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [counter, setCounter] = useState(0);
  async function load() {
    try {
      setData(await api("/whatsapp"));
      setCounter((n) => n + 1);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [revision]);
  async function action(id: string, what: string) {
    setError("");
    setBusy(true);
    try {
      const r = await send(`/whatsapp/${id}/${what}`, {});
      setNotice(
        what === "unlink"
          ? r.remoteUnlinked
            ? "Session unlinked."
            : "Disconnected locally. Check WhatsApp → Linked devices and remove any remaining device."
          : what === "scan"
            ? `${r.scanned} actual groups scanned.`
            : "Connection attempt started.",
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function pair(e: React.FormEvent<HTMLFormElement>, slot: number) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await send("/whatsapp/pair", {
        slot,
        phone: form.get("phone"),
        authoriseLinkedDevice: form.get("authorise") === "on",
      });
      setNotice(
        "Pairing attempt started. A private code appears only when WhatsApp supplies it.",
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(
        "Private pairing code copied. Only enter it in your own WhatsApp app.",
      );
    } catch {
      setNotice(
        "Clipboard unavailable. Select and copy the displayed private code.",
      );
    }
  }
  return (
    <div className="earning-hub">
      {error && (
        <div className="notice warning" role="alert">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <p>{notice}</p>
        </div>
      )}
      <section className="panel wa-connections">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              PAPPYPAY · PRIVATE LINKED-DEVICE PAIRING
            </span>
            <h2>Room for two connections.</h2>
            <p>
              Your own numbers. Private, per-attempt codes. No shared public
              pairing secret.
            </p>
          </div>
          <Link2 />
        </div>
        {!data ? (
          <p role="status">Loading connection state…</p>
        ) : (
          <>
            <div className="notice warning">
              <ShieldCheck size={19} />
              <p>
                {data.configured
                  ? "Plogme owner-testing pilot. Pair only a number you control. Real-device group-status, previews and receipts still require validation. Paid campaigns and payouts remain off."
                  : "WhatsApp is not configured on this server. No code or connected account is simulated."}{" "}
                Never share your WhatsApp registration OTP or two-step
                verification PIN.
              </p>
            </div>
            <div className="wa-slot-grid">
              {[1, 2].map((slot) => {
                const s = data.slots.find((v: any) => v.slot === slot),
                  active =
                    s &&
                    (["PAIRING", "ONLINE", "OFFLINE"].includes(s.status) ||
                      (s.status === "ERROR" && s.account_id));
                return (
                  <section
                    className="number-slot wa-slot"
                    key={slot}
                    aria-label={`WhatsApp number ${slot}`}
                  >
                    <span className="eyebrow">NUMBER {slot}</span>
                    <h3>{s?.phone_label || "Not connected"}</h3>
                    <span className="badge neutral">
                      {s?.status || "NOT PAIRED"}
                    </span>
                    {s?.last_error && (
                      <p className="field-help">{s.last_error}</p>
                    )}
                    {s?.status === "PAIRING" && (
                      <div className="wa-pair-code">
                        {s.code ? (
                          <>
                            <label>
                              Private pairing code
                              <input
                                readOnly
                                aria-label={`Private pairing code ${slot}`}
                                value={s.code}
                                onFocus={(e) => e.target.select()}
                              />
                            </label>
                            <button
                              className="button small"
                              onClick={() => copy(s.code)}
                            >
                              <Copy size={14} />
                              Copy code
                            </button>
                            <p>
                              WhatsApp → Linked devices → Link a device → Link
                              with phone number. This app cancels the attempt
                              after three minutes; no successful connection is
                              claimed until WhatsApp confirms.
                            </p>
                          </>
                        ) : (
                          <p role="status">
                            Connecting to WhatsApp to request your private code…
                          </p>
                        )}
                      </div>
                    )}
                    {!active && (
                      <form
                        onSubmit={(e) => pair(e, slot)}
                        className="form-stack"
                      >
                        <label>
                          Phone number {slot}
                          <input
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            pattern="[1-9][0-9]{6,14}"
                            autoComplete="tel"
                            required
                            placeholder="Country code + number, digits only"
                            disabled={!data.configured || busy}
                          />
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            name="authorise"
                            required
                            disabled={!data.configured || busy}
                          />
                          <span>
                            I own this number and authorise linked-device
                            access. Group permission is still required before
                            broadcasting.
                          </span>
                        </label>
                        <button
                          className="button small"
                          disabled={!data.configured || busy}
                        >
                          Generate private code
                        </button>
                      </form>
                    )}
                    {s?.status === "ONLINE" && (
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={!!s.paid_opt_in}
                          disabled={busy}
                          onChange={async (e) => {
                            const enabled = e.target.checked;
                            setBusy(true);
                            try {
                              await send(`/whatsapp/${s.id}/paid-opt-in`, {
                                enabled,
                                authorisePaid: enabled,
                              });
                              setNotice(
                                "Future paid-campaign preference saved. No paid dispatch is enabled and no earnings created.",
                              );
                              await load();
                            } catch (err: any) {
                              setError(err.message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        />
                        <span>
                          Allow future funded campaigns on this number. Paid
                          dispatch is currently off.
                        </span>
                      </label>
                    )}
                    {s && active && (
                      <div className="wa-slot-actions">
                        {s.status === "ONLINE" && (
                          <button
                            className="button button-outline small"
                            disabled={busy}
                            onClick={() => action(s.id, "scan")}
                          >
                            <RefreshCw size={14} />
                            Scan groups
                          </button>
                        )}
                        {["OFFLINE", "ERROR"].includes(s.status) && (
                          <button
                            className="button button-outline small"
                            disabled={busy}
                            onClick={() => action(s.id, "reconnect")}
                          >
                            Reconnect
                          </button>
                        )}
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Disconnect this linked device and erase its stored credentials?",
                              )
                            )
                              action(s.id, "unlink");
                          }}
                        >
                          {s.status === "PAIRING"
                            ? "Cancel pairing"
                            : "Unlink number"}
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
            <p className="wa-attribution">
              Based on @crysnovax/baileys by Crysnovax · Plogme.{" "}
              <a href="#/plogme-license" target="_blank" rel="noreferrer">
                Library licence and attribution
              </a>
            </p>
          </>
        )}
      </section>
      <EarningHub
        view="connections"
        hideNumberSlots
        revision={counter + revision}
      />
    </div>
  );
}
export function PersonalBroadcasts({ revision = 0 }: { revision?: number }) {
  const [data, setData] = useState<any>(null),
    [mode, setMode] = useState("ALLSTATUS"),
    [chosen, setChosen] = useState<Record<string, any>>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [approval, setApproval] = useState(""),
    [asset, setAsset] = useState<any>(null),
    [details, setDetails] = useState<any[] | null>(null),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function load() {
    try {
      setData(await api("/broadcasts"));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [revision]);
  async function approve(g: any) {
    setBusy(true);
    setError("");
    try {
      const result = await send("/whatsapp/groups/approval", {
        accountId: g.account_id,
        groupJid: g.group_jid,
        status: mode !== "ALLCHAT",
        chat: mode !== "ALLSTATUS",
        mentions: mode !== "ALLSTATUS",
      });
      if (result.approved) {
        setNotice(
          "Current group-admin authority verified; scoped permission recorded for 30 days or until revoked.",
        );
        await load();
      } else {
        setApproval(result.instructions);
        setNotice(
          "Ask a current group admin to send the approval command in that group. No permission is claimed until the real provider verifies it.",
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function permitted(g: any) {
    return (
      !g.revoked_at &&
      g.expires_at > new Date().toISOString() &&
      (mode === "ALLSTATUS"
        ? g.status_allowed
        : mode === "ALLCHAT"
          ? g.chat_allowed && g.mentions_allowed
          : g.status_allowed && g.chat_allowed && g.mentions_allowed)
    );
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 8 * 1024 * 1024) throw Error("Maximum upload: 8 MiB");
      setAsset(
        await api("/broadcast-assets", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        }),
      );
      await load();
      setNotice(
        "Media validated and privately stored. Images/video carry the visible link in their caption; a separate preview card is not guaranteed.",
      );
      setRequestId(crypto.randomUUID());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function queue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const result = await send("/broadcasts", {
        purpose: "PERSONAL",
        mode,
        caption: f.get("caption"),
        targetUrl: f.get("targetUrl"),
        requirePreview: !asset && f.get("requirePreview") === "on",
        assetId: asset?.id,
        targets: Object.values(chosen),
        requestId,
      });
      setNotice(
        `Personal broadcast queued for ${result.uniqueGroups ?? Object.keys(chosen).length} unique groups. No charge, earning or referral activation.`,
      );
      setRequestId(crypto.randomUUID());
      setChosen({});
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    setBusy(true);
    setError("");
    try {
      await send(`/broadcasts/${id}/cancel`, {});
      setNotice(
        "Unsent placements cancelled. Already-started or uncertain sends are not falsely labelled unsent.",
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="earning-hub personal-broadcasts">
      {error && (
        <div className="notice warning" role="alert">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <p>{notice}</p>
        </div>
      )}
      <div className="workspace-banner">
        <Send size={22} />
        <div>
          <strong>Your session. Your authorised broadcasts.</strong>
          <p>
            Personal benefit: no charge, no earnings and no referral
            qualification. Paid campaign accounting is separate.
          </p>
        </div>
        <a href="#/app/connections">Manage numbers →</a>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PERSONAL BROADCAST COMPOSER</span>
            <h2>Choose where your message goes.</h2>
          </div>
          <span className="badge neutral">Free · no reward</span>
        </div>
        <div className="wa-mode-grid">
          {[
            ["ALLSTATUS", "allstatus", "Group status only"],
            ["ALLCHAT", "allchat", "Group chat + authorised mention-all"],
            ["DOUBLE", "2x", "Group status first, then group chat"],
          ].map(([id, name, note]) => (
            <button
              type="button"
              aria-pressed={mode === id}
              key={id}
              className={`wa-mode ${mode === id ? "selected" : ""}`}
              onClick={() => {
                setMode(id);
                setChosen({});
                setRequestId(crypto.randomUUID());
              }}
            >
              <strong>{name}</strong>
              <span>{note}</span>
            </button>
          ))}
        </div>
        {!data ? (
          <p role="status">Loading your real group inventory…</p>
        ) : (
          <form
            className="form-stack"
            onSubmit={queue}
            onChange={() => setRequestId(crypto.randomUUID())}
          >
            <label>
              Message / caption
              <textarea
                name="caption"
                rows={4}
                maxLength={2000}
                placeholder="Write the message your communities agreed to receive"
              />
            </label>
            <label>
              Destination link (required)
              <input
                type="url"
                name="targetUrl"
                required
                maxLength={1500}
                placeholder="https://"
              />
            </label>
            <label>
              Optional media · up to 8 MiB
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
                disabled={busy || !data.configured}
                onChange={upload}
              />
              <span className="field-help">
                JPEG/PNG/WebP, H.264/AAC MP4, or GIF converted to MP4.
                Video/GIF: up to 90 seconds and 1920px. Audio, stickers and
                documents are not enabled; unsupported payloads are rejected,
                never silently dropped.
              </span>
            </label>
            <label>
              Saved private media
              <select
                value={asset?.id || ""}
                onChange={(e) => {
                  const a = data.assets?.find(
                    (v: any) => v.id === e.target.value,
                  );
                  setAsset(
                    a
                      ? {
                          ...a,
                          notice:
                            a.mime === "image/jpeg"
                              ? "Saved image"
                              : "Saved MP4",
                        }
                      : null,
                  );
                  setRequestId(crypto.randomUUID());
                }}
              >
                <option value="">Text only — no attached media</option>
                {(data.assets || []).map((a: any) => (
                  <option value={a.id} key={a.id}>
                    {a.mime === "image/jpeg" ? "Image" : "MP4"} ·{" "}
                    {(a.bytes / 1024).toFixed(0)} KiB · {date(a.created_at)} ·{" "}
                    {a.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <span className="field-help">
                50 MiB / 100 stored files per owner. Select a file to preview or
                remove it. Removing media from an active broadcast is blocked.
              </span>
            </label>
            {asset && (
              <div className="wa-uploaded">
                {asset.mime === "image/jpeg" && (
                  <img
                    src={`/api/broadcast-assets/${asset.id}`}
                    alt="Your uploaded broadcast image"
                  />
                )}
                <p>
                  {asset.notice} · {(asset.bytes / 1024).toFixed(0)} KiB
                </p>
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await send(`/broadcast-assets/${asset.id}`, {}, "DELETE");
                      setAsset(null);
                      setRequestId(crypto.randomUUID());
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  Remove uploaded media
                </button>
              </div>
            )}
            <label className="checkbox-label">
              <input type="checkbox" name="requirePreview" disabled={!!asset} />
              <span>
                Require a safely generated link preview before sending (text
                only). Otherwise a visible link is always included, with a
                preview when available.
              </span>
            </label>
            <div className="wa-target-heading">
              <h3>Select approved groups</h3>
              <span>{Object.keys(chosen).length} unique groups selected</span>
            </div>
            {!data.groups.length ? (
              <div className="earning-empty">
                <Link2 />
                <h3>No connected group inventory yet.</h3>
                <p>
                  Pair your own number, scan groups and obtain current
                  group-admin permission before sending.
                </p>
                <a href="#/app/connections" className="text-link">
                  Open Connections →
                </a>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">
                    Personal broadcast targets and required group approval
                  </caption>
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Group</th>
                      <th>Number</th>
                      <th>Members</th>
                      <th>Permission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups.map((g: any) => {
                      const ok =
                          permitted(g) &&
                          g.status === "ONLINE" &&
                          !g.excluded &&
                          !(
                            mode !== "ALLSTATUS" &&
                            g.announce &&
                            !g.user_is_admin
                          ),
                        selected =
                          chosen[g.group_jid]?.accountId === g.account_id;
                      return (
                        <tr key={g.account_id + g.group_jid}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${g.subject} on number ${g.slot}`}
                              disabled={!ok || busy}
                              checked={selected}
                              onChange={() => {
                                setChosen((prev) => {
                                  const next = { ...prev };
                                  if (selected) delete next[g.group_jid];
                                  else
                                    next[g.group_jid] = {
                                      accountId: g.account_id,
                                      groupJid: g.group_jid,
                                    };
                                  return next;
                                });
                                setRequestId(crypto.randomUUID());
                              }}
                            />
                          </td>
                          <td>
                            <strong>{g.subject || "Unnamed group"}</strong>
                            <small>
                              {g.status}
                              {g.excluded ? " · excluded" : ""}
                            </small>
                          </td>
                          <td>{g.slot}</td>
                          <td>{g.member_count}</td>
                          <td>
                            {permitted(g) ? (
                              <>
                                <span>Approved</span>
                                <button
                                  type="button"
                                  className="text-link"
                                  disabled={busy}
                                  onClick={async () => {
                                    try {
                                      await send("/whatsapp/groups/revoke", {
                                        accountId: g.account_id,
                                        groupJid: g.group_jid,
                                      });
                                      await load();
                                      setChosen({});
                                    } catch (e: any) {
                                      setError(e.message);
                                    }
                                  }}
                                >
                                  Revoke
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="text-link"
                                disabled={busy || g.status !== "ONLINE"}
                                onClick={() => approve(g)}
                              >
                                Obtain admin approval
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {approval && (
              <div className="wa-approval">
                <label>
                  Group-admin approval instructions
                  <textarea
                    readOnly
                    rows={5}
                    value={approval}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button
                  type="button"
                  className="button button-outline small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(approval);
                      setNotice(
                        "Approval instructions copied. A real group admin must approve in that group.",
                      );
                    } catch {
                      setNotice("Select and copy the instructions manually.");
                    }
                  }}
                >
                  <Copy size={15} />
                  Copy approval instructions
                </button>
              </div>
            )}
            <div className="notice warning">
              <Lock size={18} />
              <p>
                Beta resource limits: {data.limits.maxGroups} memberships per
                personal run, {data.limits.dailyRuns} runs per UTC day, at least
                one minute apart. These are personal-use limits—not a 100-group
                earning cap. Mention-all must be authorised; notifications,
                views and new members are not guaranteed.
              </p>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" required />
              <span>
                I confirm this content and destination are appropriate for the
                selected communities, and understand this is a personal
                broadcast with no earnings.
              </span>
            </label>
            <button
              className="button"
              disabled={busy || !data.configured || !Object.keys(chosen).length}
            >
              <Send size={16} />
              {busy
                ? "Working…"
                : `Queue personal ${mode === "DOUBLE" ? "2x" : mode.toLowerCase()} broadcast`}
            </button>
          </form>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Personal broadcast history</h2>
            <p>
              “Submitted” means provider acceptance, not proof that everybody
              received or viewed it.
            </p>
          </div>
          <button className="button button-outline small" onClick={load}>
            <RefreshCw size={14} />
            Refresh history
          </button>
        </div>
        {!data?.runs.length ? (
          <div className="earning-empty">
            <Send />
            <h3>No personal broadcasts yet.</h3>
            <p>Only your real queued runs appear here.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Mode</th>
                  <th>State</th>
                  <th>Submitted</th>
                  <th>Attention</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r: any) => (
                  <tr key={r.id}>
                    <td>{date(r.created_at)}</td>
                    <td>{r.mode === "DOUBLE" ? "2x" : r.mode.toLowerCase()}</td>
                    <td>{r.status}</td>
                    <td>
                      {r.submitted} / {r.placements}
                    </td>
                    <td>{r.needs_attention}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={async () => {
                          try {
                            setDetails(
                              (await api(`/broadcasts/${r.id}`)).placements,
                            );
                          } catch (e: any) {
                            setError(e.message);
                          }
                        }}
                      >
                        Details
                      </button>
                      {["QUEUED", "RUNNING"].includes(r.status) && (
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() => cancel(r.id)}
                        >
                          Cancel unsent
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {details && (
          <div className="wa-run-details">
            <h3>Placement-by-placement results</h3>
            <button className="text-link" onClick={() => setDetails(null)}>
              Close details
            </button>
            {details.map((p) => (
              <p key={p.id}>
                <strong>
                  {p.surface === "GROUP_STATUS" ? "Group status" : "Group chat"}{" "}
                  ·{" "}
                  {p.status === "ACCEPTED"
                    ? "Submitted — delivery unverified"
                    : p.status}
                </strong>
                <span>{p.failure_reason || "No failure recorded"}</span>
              </p>
            ))}
          </div>
        )}
      </section>
      <p className="wa-attribution">
        Based on @crysnovax/baileys by Crysnovax · Plogme.{" "}
        <a href="#/plogme-license" target="_blank" rel="noreferrer">
          Library licence and attribution
        </a>
      </p>
    </div>
  );
}
