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
const plainError = (text: string) => {
  if (/fresh scan|needs a fresh|fresh metadata/.test(text))
    return "Your group list needs an update. Open My WhatsApp and tap Find my groups.";
  if (/group-admin approval|Surface permission/.test(text))
    return "Please get the group admin’s permission first. Use the permission button beside the group.";
  if (/Wait at least one minute/.test(text))
    return "Please wait 1 minute before sending another post.";
  if (/safe preview/.test(text))
    return "We could not make a preview for this link. Try another link, or turn off the preview option to send the plain link.";
  if (/Daily|three runs per UTC/.test(text))
    return "You have used today’s personal posts. Try again after midnight UTC (1am in Nigeria).";
  return text;
};
const friendlyState = (s: string) =>
  ({
    ONLINE: "Connected",
    OFFLINE: "Not connected",
    PAIRING: "Waiting for you",
    ERROR: "Needs attention",
    EXPIRED: "Code expired",
    LOGGED_OUT: "Disconnected",
    QUEUED: "Waiting",
    RUNNING: "Sending",
    FINISHED: "Finished",
    CANCELLED: "Stopped",
    UNKNOWN: "Not sure — check WhatsApp",
    FAILED: "Not sent",
    RESERVED: "Waiting",
    SENDING: "Sending",
    ACCEPTED: "Sent to WhatsApp — delivery not checked",
    CONFIRMED: "Delivery checked",
  })[s] || s;
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
      setError(plainError(e.message));
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
            ? "Your WhatsApp is disconnected."
            : "Disconnected here. Open WhatsApp → Linked devices and remove this device if it is still listed."
          : what === "scan"
            ? `${r.scanned} groups found. Open Send a post to choose which ones can receive your message.`
            : "Trying to connect your WhatsApp. Please wait.",
      );
      await load();
    } catch (e: any) {
      setError(plainError(e.message));
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
      setNotice("Getting your connection code. Please wait here.");
      await load();
    } catch (e: any) {
      setError(plainError(e.message));
    } finally {
      setBusy(false);
    }
  }
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Code copied. Open your own WhatsApp to enter it.");
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
            <span className="eyebrow">PAPPYPAY · CONNECT YOUR WHATSAPP</span>
            <h2>My WhatsApp numbers.</h2>
            <p>
              Use a number you own. We give you a new private code each time.
            </p>
          </div>
          <Link2 />
        </div>
        {!data ? (
          <p role="status">Checking your WhatsApp…</p>
        ) : (
          <>
            <div className="notice warning">
              <ShieldCheck size={19} />
              <p>
                {data.configured
                  ? "This feature is still being tested. Use only your own number. Paid jobs and withdrawals are not open."
                  : "WhatsApp connection is not available right now. Please try again later."}{" "}
                Never enter a WhatsApp login code or PIN here. Only use the
                connection code shown on this page.
              </p>
            </div>
            <details
              className="connect-help"
              open={!data.slots.some((s: any) => s.status === "ONLINE")}
            >
              <summary>How do I connect my WhatsApp?</summary>
              <ol>
                <li>
                  Enter your number below, with the country code. Leave out the
                  + sign.
                </li>
                <li>
                  Tap <strong>Get my connection code</strong>. Keep this page
                  open.
                </li>
                <li>
                  Open WhatsApp on your phone. Tap <strong>Settings</strong> or
                  the <strong>⋮ menu</strong>, then{" "}
                  <strong>
                    Linked devices → Link a device → Link with phone number
                  </strong>
                  .
                </li>
                <li>
                  Enter the code from this page in WhatsApp. Come back here when
                  it says Connected.
                </li>
              </ol>
              <p>Example: a Nigerian number starting with 080 becomes 23480…</p>
            </details>
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
                      {s ? friendlyState(s.status) : "Not connected"}
                    </span>
                    {s?.last_error && (
                      <p className="field-help">{s.last_error}</p>
                    )}
                    {s?.status === "PAIRING" && (
                      <div className="wa-pair-code">
                        {s.code ? (
                          <>
                            <label>
                              Your connection code
                              <input
                                readOnly
                                aria-label={`Your connection code ${slot}`}
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
                            Getting your code from WhatsApp. Please wait…
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
                            placeholder="Example: 2348012345678"
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
                            This is my number. I allow Pappy to connect it. I
                            still need permission from each group before
                            posting.
                          </span>
                        </label>
                        <button
                          className="button small"
                          disabled={!data.configured || busy}
                        >
                          Get my connection code
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
                              setError(plainError(err.message));
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
                            Find my groups
                          </button>
                        )}
                        {["OFFLINE", "ERROR"].includes(s.status) && (
                          <button
                            className="button button-outline small"
                            disabled={busy}
                            onClick={() => action(s.id, "reconnect")}
                          >
                            Connect again
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
                            ? "Cancel connection"
                            : "Disconnect number"}
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
      setError(plainError(e.message));
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
          "You are an admin in this group. Posting is allowed for 30 days, unless you remove permission.",
        );
        await load();
      } else {
        setApproval(result.instructions);
        setNotice(
          "Copy the request below. Ask a group admin to send the command inside that group. Then come back here.",
        );
      }
    } catch (e: any) {
      setError(plainError(e.message));
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
      setError(plainError(e.message));
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
        `Your post is ready for ${result.uniqueGroups ?? Object.keys(chosen).length} unique groups. It is free to send. No Coins or referral rewards are earned.`,
      );
      setRequestId(crypto.randomUUID());
      setChosen({});
      await load();
    } catch (e: any) {
      setError(plainError(e.message));
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
      setError(plainError(e.message));
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
          <strong>Your own post. Sent from your WhatsApp.</strong>
          <p>
            Sending your own post is free. It does not earn Coins or referral
            rewards.
          </p>
        </div>
        <a href="#/app/connections">My WhatsApp →</a>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">SEND YOUR OWN POST</span>
            <h2>Send a post to your groups.</h2>
          </div>
          <span className="badge neutral">Free to send · no earnings</span>
        </div>
        <h3 className="plain-step-title">1. Where should the post go?</h3>
        <p className="plain-help">
          Small groups can get posts too. Groups below 100 members do not earn
          paid rewards. Your own posts never earn Coins, whatever the group
          size.
        </p>
        <div className="wa-mode-grid">
          {[
            [
              "ALLSTATUS",
              "Group status",
              "allstatus · Post to the group’s status",
            ],
            [
              "ALLCHAT",
              "Group chat",
              "allchat · Send a chat message and notify members",
            ],
            ["DOUBLE", "Both", "2x · Group status first, then group chat"],
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
          <p role="status">Finding your groups…</p>
        ) : (
          <form
            className="form-stack"
            onSubmit={queue}
            onChange={() => setRequestId(crypto.randomUUID())}
          >
            <label>
              2. Write your message
              <textarea
                name="caption"
                rows={4}
                maxLength={2000}
                placeholder="What do you want to share with your groups?"
              />
            </label>
            <label>
              Add a link (needed for every post)
              <input
                type="url"
                name="targetUrl"
                required
                maxLength={1500}
                placeholder="https://your-website.com"
              />
            </label>
            <details className="post-extra-options">
              <summary>Add a picture, video or link preview (optional)</summary>
              <label>
                Add a picture or video (optional)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
                  disabled={busy || !data.configured}
                  onChange={upload}
                />
                <span className="field-help">
                  Choose a picture, GIF or MP4 video up to 8 MiB. Videos can be
                  up to 90 seconds. Audio, stickers and documents are not
                  supported yet.
                </span>
              </label>
              <label>
                Pictures and videos you saved
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
                  <option value="">No picture or video</option>
                  {(data.assets || []).map((a: any) => (
                    <option value={a.id} key={a.id}>
                      {a.mime === "image/jpeg" ? "Image" : "MP4"} ·{" "}
                      {(a.bytes / 1024).toFixed(0)} KiB · {date(a.created_at)} ·{" "}
                      {a.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <span className="field-help">
                  You can save up to 100 files, using 50 MiB altogether. You
                  cannot delete a file while it is being sent.
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
                        await send(
                          `/broadcast-assets/${asset.id}`,
                          {},
                          "DELETE",
                        );
                        setAsset(null);
                        setRequestId(crypto.randomUUID());
                      } catch (e: any) {
                        setError(plainError(e.message));
                      }
                    }}
                  >
                    Delete this picture or video
                  </button>
                </div>
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="requirePreview"
                  disabled={!!asset}
                />
                <span>
                  Only send if we can make a link preview. Leave this off to
                  send a plain link if a preview is unavailable. Pictures and
                  videos always carry the link in their caption.
                </span>
              </label>
            </details>
            <div className="wa-target-heading">
              <h3>3. Choose your groups</h3>
              <span>
                {Object.keys(chosen).length} groups selected (shared groups
                count once)
              </span>
            </div>
            <p className="plain-help">
              Can’t tick a group? Use the permission button beside it first. If
              you are an admin, tap Allow posts in this group. Otherwise ask a
              group admin to approve.
            </p>
            {!data.groups.length ? (
              <div className="earning-empty">
                <Link2 />
                <h3>No groups found yet.</h3>
                <p>
                  First connect your WhatsApp and tap Find my groups. Then ask
                  the group admin for permission to post.
                </p>
                <a href="#/app/connections" className="text-link">
                  Open My WhatsApp →
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
                              {friendlyState(g.status)}
                              {g.excluded ? " · excluded" : ""}
                            </small>
                          </td>
                          <td>{g.slot}</td>
                          <td>
                            {g.member_count}
                            <small>
                              {g.member_count < 100
                                ? "Can get posts · no paid reward"
                                : "Can get posts · 100+ members"}
                            </small>
                          </td>
                          <td>
                            {permitted(g) ? (
                              <>
                                <span>Allowed</span>
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
                                      setError(plainError(e.message));
                                    }
                                  }}
                                >
                                  Remove permission
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="text-link"
                                disabled={busy || g.status !== "ONLINE"}
                                onClick={() => approve(g)}
                              >
                                {g.user_is_admin
                                  ? "Allow posts in this group"
                                  : "Ask admin for permission"}
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
                  Send this request to your group admin
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
                        "Request copied. Send it to the group admin and ask them to approve it inside the group.",
                      );
                    } catch {
                      setNotice("Select and copy the instructions manually.");
                    }
                  }}
                >
                  <Copy size={15} />
                  Copy the admin request
                </button>
              </div>
            )}
            <div className="notice warning">
              <Lock size={18} />
              <p>
                While we test this feature, you can send {data.limits.dailyRuns}{" "}
                personal posts per day (resets at midnight UTC, 1am in Nigeria).
                Choose up to {data.limits.maxGroups} groups each time and wait 1
                minute between posts. Not everyone may see the post or get a
                notification.
              </p>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" required />
              <span>
                These groups allow this kind of post. I understand that sending
                my own post does not earn Coins.
              </span>
            </label>
            <button
              className="button"
              disabled={busy || !data.configured || !Object.keys(chosen).length}
            >
              <Send size={16} />
              {busy
                ? "Please wait…"
                : `Send my post to ${Object.keys(chosen).length} ${Object.keys(chosen).length === 1 ? "group" : "groups"}`}
            </button>
          </form>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Your recent posts</h2>
            <p>
              “Sent to WhatsApp” does not mean everyone received or read your
              post. Check your groups in WhatsApp if you are unsure.
            </p>
          </div>
          <button className="button button-outline small" onClick={load}>
            <RefreshCw size={14} />
            Check again
          </button>
        </div>
        {!data?.runs.length ? (
          <div className="earning-empty">
            <Send />
            <h3>You have not sent a post yet.</h3>
            <p>Your posts will show here after you send one.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Where</th>
                  <th>Progress</th>
                  <th>Sent to WhatsApp</th>
                  <th>Needs checking</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r: any) => (
                  <tr key={r.id}>
                    <td>{date(r.created_at)}</td>
                    <td>
                      {r.mode === "DOUBLE"
                        ? "Both (2x)"
                        : r.mode === "ALLSTATUS"
                          ? "Group status"
                          : "Group chat"}
                    </td>
                    <td>{friendlyState(r.status)}</td>
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
                            setError(plainError(e.message));
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
                          Stop posts not sent yet
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
            <h3>What happened in each group</h3>
            <button className="text-link" onClick={() => setDetails(null)}>
              Close
            </button>
            {details.map((p) => (
              <p key={p.id}>
                <strong>
                  {p.surface === "GROUP_STATUS" ? "Group status" : "Group chat"}{" "}
                  · {friendlyState(p.status)}
                </strong>
                <span>{p.failure_reason || "No problem reported"}</span>
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
