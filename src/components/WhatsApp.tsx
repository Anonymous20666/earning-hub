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
    return "This older queued post needs its original approval. Start a fresh personal review for native posting rules; removed groups remain blocked.";
  if (/safe preview/.test(text))
    return "We could not make a preview for this link. Try another link, or turn off the preview option to send the plain link.";
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
      setNotice("Requesting PAPPYPAY from WhatsApp. Please wait here.");
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
              Use a number you own. We request PAPPYPAY as your WhatsApp linking
              code. Start your own request below before entering it in WhatsApp.
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
                            will respect each group’s rules and WhatsApp’s
                            native posting restrictions.
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
export { PersonalBroadcasts } from "./PersonalComposer";
