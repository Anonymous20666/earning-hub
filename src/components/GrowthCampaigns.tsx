import React, { useEffect, useRef, useState } from "react";
import {
  Link2,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Globe2,
  MessageCircle,
  Radio,
  Send,
  ShieldCheck,
  Plus,
  RefreshCw,
  Download,
  Copy,
  AlertCircle,
  Wallet,
  Users,
  Settings2,
} from "lucide-react";
import { api, send } from "../api";
import {
  GROWTH_PRODUCTS,
  GROWTH_COUNTRIES,
  GROWTH_TERMS_VERSION,
  growthTerms,
  growthMoney,
  type GrowthInput,
  type GrowthProduct,
} from "../../shared/growthRules";
import "../growth.css";
import { GrowthSandboxCheckout } from "./GrowthSandboxCheckout";
import { GrowthCreativeGallery } from "./GrowthCreativeGallery";
import { GrowthAudienceSettings } from "./GrowthAudienceSettings";
const nice = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
const when = (value: string) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not started";
const localTime = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const initial = (): GrowthInput => ({
  title: "",
  product: "WA_GROUP",
  destination: "",
  quantity: 200,
  countries: [],
  lane: "NORMAL",
  service: "SELF_SERVICE",
  expectedAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  contactPhone: "",
  termsVersion: GROWTH_TERMS_VERSION,
  acknowledged: false,
});
async function downloadReport(order: any) {
  const report = await api(`/growth/${order.id}/report`),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
  const link = document.createElement("a");
  link.href = url;
  link.download = `campaign-${order.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function GrowthCampaigns({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState<GrowthInput>(initial),
    [step, setStep] = useState(1),
    [draft, setDraft] = useState<any>(null);
  const requestKey = useRef(crypto.randomUUID());
  const refresh = async () => {
    try {
      setData(await api(admin ? "/admin/growth" : "/growth"));
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    refresh();
  }, [admin]);
  useEffect(() => {
    if (
      !data?.orders.some((o: any) =>
        ["VERIFYING", "RUNNING", "COMPLETING"].includes(o.status),
      )
    )
      return;
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [data?.orders?.map((o: any) => o.status).join(","), admin]);
  const action = async (fn: () => Promise<any>, message = "Saved") => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      setNotice(message);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const change = (patch: Partial<GrowthInput>) => {
    setInput((v) => ({ ...v, acknowledged: false, ...patch }));
    setError("");
  };
  const start = (order?: any) => {
    setDraft(order || null);
    setInput(order?.input || initial());
    setStep(1);
    setEditing(true);
    requestKey.current = crypto.randomUUID();
    setError("");
    setNotice("");
  };
  const persist = async (submit: boolean) => {
    await action(
      async () => {
        const result = await api(draft ? `/growth/${draft.id}` : "/growth", {
          method: draft ? "PUT" : "POST",
          headers: { "Idempotency-Key": requestKey.current },
          body: JSON.stringify({
            ...input,
            ...(draft ? { revision: draft.revision } : {}),
          }),
        });
        setDraft(result);
        if (submit)
          await send(`/growth/${result.id}/submit`, {
            revision: result.revision,
          });
        setSelected(result.id);
        setEditing(false);
      },
      submit
        ? "Sent for review. No payment or broadcast started."
        : "Draft saved. You can return to it later.",
    );
  };
  const current = data?.orders.find((o: any) => o.id === selected),
    rule = GROWTH_PRODUCTS[input.product];
  return (
    <section
      className="gx"
      aria-label={admin ? "Growth administration" : "Growth campaigns"}
    >
      <header className="gx-hero">
        <div>
          <span className="gx-eyebrow">
            {admin ? "OPERATIONS / GROWTH" : "YOUR NEXT AUDIENCE"}
          </span>
          <h2>
            {admin
              ? "A clear desk for every campaign."
              : "Grow your community. Keep control."}
          </h2>
          <p>
            {admin
              ? "Review access, set real prices and plan only against eligible inventory. All actions are recorded."
              : "Choose your platform, audience and target. Review a clear plan before any paid work begins."}
          </p>
        </div>
        {!admin && !editing && (
          <button className="gx-button" onClick={() => start()}>
            <Plus size={18} /> Plan a growth campaign
          </button>
        )}
      </header>
      <div className="gx-setup">
        <ShieldCheck size={22} />
        <div>
          <strong>Planning is open. Live spending is not.</strong>
          <p>
            Save campaigns and request a staff review now. Prices start unset.
            Payments and automated campaign sending remain disabled until
            merchant setup and provider checks are approved.
          </p>
        </div>
        <span className="gx-badge">No charges</span>
      </div>
      {error && (
        <div className="gx-alert" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {notice && (
        <p className="gx-notice" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <p role="status">Loading campaign records…</p>
      ) : (
        <>
          {admin ? (
            <GrowthAdmin
              data={data}
              busy={busy}
              action={action}
              refresh={refresh}
            />
          ) : (
            <>
              {editing ? (
                <div className="gx-builder">
                  <div className="gx-main">
                    <nav
                      className="gx-steps"
                      aria-label="Campaign planning steps"
                    >
                      {[
                        "Service",
                        "Your campaign",
                        "Audience & timing",
                        "Review",
                      ].map((label, i) => (
                        <span
                          key={label}
                          aria-current={step === i + 1 ? "step" : undefined}
                          className={
                            step === i + 1
                              ? "active"
                              : step > i + 1
                                ? "done"
                                : ""
                          }
                        >
                          <b>{step > i + 1 ? <Check size={14} /> : i + 1}</b>
                          {label}
                        </span>
                      ))}
                    </nav>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (step < 4) setStep((s) => s + 1);
                      }}
                    >
                      {step === 1 && (
                        <>
                          <h3>Where do you want to grow?</h3>
                          <p className="gx-muted">
                            Four services. Different counting rules. One clear
                            order.
                          </p>
                          <div className="gx-products">
                            {Object.entries(GROWTH_PRODUCTS).map(([key, p]) => {
                              const Icon = p.channel ? Radio : MessageCircle;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  aria-pressed={input.product === key}
                                  className={`gx-product ${input.product === key ? "selected" : ""}`}
                                  onClick={() =>
                                    change({
                                      product: key as GrowthProduct,
                                      quantity: p.min,
                                      countries: p.country
                                        ? input.countries
                                        : [],
                                      acknowledged: false,
                                    })
                                  }
                                >
                                  <span
                                    className={key.startsWith("TG") ? "tg" : ""}
                                  >
                                    <Icon size={24} />
                                  </span>
                                  <strong>{p.name}</strong>
                                  <small>
                                    {p.min.toLocaleString()}–
                                    {p.max.toLocaleString()} {p.unit}
                                  </small>
                                  <em>
                                    {p.channel
                                      ? "Measured net growth"
                                      : "Unique qualifying requests"}
                                  </em>
                                  {input.product === key && (
                                    <CheckCircle2
                                      className="gx-selected"
                                      size={19}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <div className="gx-field">
                            <label htmlFor="gx-service">
                              How would you like to work?
                            </label>
                            <select
                              id="gx-service"
                              value={input.service}
                              onChange={(e) =>
                                change({ service: e.target.value as any })
                              }
                            >
                              <option value="SELF_SERVICE">
                                Self-service — I prepare the details
                              </option>
                              <option value="MANAGED">
                                Managed help — staff helps review my plan
                              </option>
                            </select>
                            <small>
                              Managed help is a review path, not a free or
                              guaranteed delivery promise. Any fee must appear
                              in your quote.
                            </small>
                          </div>
                        </>
                      )}
                      {step === 2 && (
                        <>
                          <h3>Tell us about your campaign.</h3>
                          <div className="gx-field">
                            <label htmlFor="gx-title">Campaign name</label>
                            <input
                              id="gx-title"
                              required
                              minLength={3}
                              maxLength={120}
                              value={input.title}
                              onChange={(e) =>
                                change({ title: e.target.value })
                              }
                              placeholder="For example, October community launch"
                            />
                          </div>
                          <div className="gx-field">
                            <label htmlFor="gx-link">
                              {rule.name} invitation or destination link
                            </label>
                            <input
                              id="gx-link"
                              required
                              type="url"
                              maxLength={1000}
                              value={input.destination}
                              onChange={(e) =>
                                change({ destination: e.target.value })
                              }
                              placeholder={
                                input.product === "WA_GROUP"
                                  ? "https://chat.whatsapp.com/…"
                                  : input.product === "WA_CHANNEL"
                                    ? "https://whatsapp.com/channel/…"
                                    : "https://t.me/…"
                              }
                            />
                            <small>
                              No passwords or ownership transfer. Staff will
                              verify the correct destination and required admin
                              access.
                            </small>
                          </div>
                          <div className="gx-explain">
                            <Link2 size={21} />
                            <p>
                              <strong>
                                Your destination link is the post.
                              </strong>
                              <br />
                              No promotional caption is needed. The compact
                              link-card design will be generated for the URL;
                              the campaign name is only a private label.
                            </p>
                          </div>
                          <div className="gx-two">
                            <div className="gx-field">
                              <label htmlFor="gx-quantity">
                                Additional{" "}
                                {rule.channel
                                  ? "followers / subscribers"
                                  : "qualifying requests"}
                              </label>
                              <input
                                id="gx-quantity"
                                type="number"
                                required
                                min={rule.min}
                                max={rule.max}
                                step={1}
                                value={input.quantity}
                                onChange={(e) =>
                                  change({ quantity: e.target.valueAsNumber })
                                }
                              />
                              <small>
                                {rule.min.toLocaleString()}–
                                {rule.max.toLocaleString()}. This is additional
                                growth, not the final group size.
                              </small>
                            </div>
                            <div className="gx-field">
                              <label htmlFor="gx-contact">
                                Contact number{" "}
                                {input.product === "WA_CHANNEL"
                                  ? "(required for admin invitation)"
                                  : "(optional)"}
                              </label>
                              <input
                                id="gx-contact"
                                type="tel"
                                required={input.product === "WA_CHANNEL"}
                                value={input.contactPhone}
                                maxLength={16}
                                pattern="\+[1-9][0-9]{6,14}"
                                onChange={(e) =>
                                  change({ contactPhone: e.target.value })
                                }
                                placeholder="+234…"
                              />
                              <small>
                                Used privately for verification. Saving contacts
                                does not guarantee protection from platform
                                restrictions.
                              </small>
                            </div>
                          </div>
                        </>
                      )}
                      {step === 3 && (
                        <>
                          <h3>Choose your audience and timing.</h3>
                          {rule.country ? (
                            <fieldset className="gx-country">
                              <legend>Country / region preferences</legend>
                              <p>
                                {rule.channel
                                  ? "These select advertising-group audiences. Individual followers’ country or nationality cannot be verified."
                                  : "Request filtering uses supported phone-number regions, not nationality or current location. Shared or unavailable prefixes cannot be guessed."}
                              </p>
                              <label className="gx-check">
                                <input
                                  type="checkbox"
                                  checked={!input.countries.length}
                                  onChange={() => change({ countries: [] })}
                                />
                                Any country / region
                              </label>
                              <div className="gx-country-grid">
                                {GROWTH_COUNTRIES.map(([code, name]) => (
                                  <label className="gx-check" key={code}>
                                    <input
                                      type="checkbox"
                                      checked={input.countries.includes(code)}
                                      disabled={
                                        !input.countries.includes(code) &&
                                        input.countries.length >= 8
                                      }
                                      onChange={(e) =>
                                        change({
                                          countries: e.target.checked
                                            ? [...input.countries, code]
                                            : input.countries.filter(
                                                (c) => c !== code,
                                              ),
                                        })
                                      }
                                    />
                                    {name}
                                  </label>
                                ))}
                              </div>
                              <small>
                                Choose up to eight regions. United States and
                                Canada are planning-only where +1 cannot be
                                resolved. Country availability is checked before
                                a quote. No suitable inventory means no paid
                                order—not a switch to random targeting.
                              </small>
                            </fieldset>
                          ) : (
                            <div className="gx-explain">
                              <Globe2 size={22} />
                              <p>
                                Telegram starts without country targeting. A bot
                                and the required destination permissions must be
                                configured before live work.
                              </p>
                            </div>
                          )}
                          <div className="gx-two">
                            <div className="gx-field">
                              <label htmlFor="gx-lane">Campaign lane</label>
                              <select
                                id="gx-lane"
                                value={input.lane}
                                onChange={(e) =>
                                  change({ lane: e.target.value as any })
                                }
                              >
                                <option value="NORMAL">
                                  Normal — scheduled waves
                                </option>
                                <option value="URGENT">
                                  Urgent — request priority capacity
                                </option>
                              </select>
                              <small>
                                Urgent does not bypass platform restrictions or
                                guarantee instant growth.
                              </small>
                            </div>
                            <div className="gx-field">
                              <label htmlFor="gx-deadline">
                                Expected completion date and time
                              </label>
                              <input
                                id="gx-deadline"
                                type="datetime-local"
                                required
                                min={localTime(
                                  new Date(
                                    Date.now() + 31 * 60000,
                                  ).toISOString(),
                                )}
                                max={localTime(
                                  new Date(
                                    Date.now() + 90 * 86400000,
                                  ).toISOString(),
                                )}
                                value={localTime(input.expectedAt)}
                                onChange={(e) => {
                                  if (e.target.value)
                                    change({
                                      expectedAt: new Date(
                                        e.target.value,
                                      ).toISOString(),
                                    });
                                }}
                              />
                              <small>
                                Your local time. Staff must assess feasibility.
                                If short at the deadline, work pauses and you
                                must approve any extension.
                              </small>
                            </div>
                          </div>
                        </>
                      )}
                      {step === 4 && (
                        <>
                          <h3>Your campaign, before you commit.</h3>
                          <dl className="gx-review">
                            <div>
                              <dt>Service</dt>
                              <dd>{rule.name}</dd>
                            </div>
                            <div>
                              <dt>Additional target</dt>
                              <dd>
                                {input.quantity.toLocaleString()} {rule.unit}
                              </dd>
                            </div>
                            <div>
                              <dt>Audience preference</dt>
                              <dd>
                                {input.countries.length
                                  ? input.countries
                                      .map(
                                        (c) =>
                                          GROWTH_COUNTRIES.find(
                                            (x) => x[0] === c,
                                          )?.[1],
                                      )
                                      .join(", ")
                                  : "Any country / region"}
                              </dd>
                            </div>
                            <div>
                              <dt>Lane / support</dt>
                              <dd>
                                {nice(input.lane)} · {nice(input.service)}
                              </dd>
                            </div>
                            <div>
                              <dt>Requested deadline</dt>
                              <dd>{when(input.expectedAt)}</dd>
                            </div>
                            <div>
                              <dt>Price</dt>
                              <dd>Staff quote required · no payment now</dd>
                            </div>
                          </dl>
                          <div className="gx-post">
                            <strong>Destination URL post</strong>
                            <p>
                              No advertiser-written caption. Fresh URL
                              typography and native status styles can be
                              previewed after saving.
                            </p>
                            <span>{input.destination}</span>
                          </div>
                          <div className="gx-terms">
                            <ShieldCheck size={22} />
                            <div>
                              <strong>
                                Understand how this order is counted
                              </strong>
                              <p>{growthTerms(input.product)}</p>
                              <p>
                                At the deadline, further work pauses. An
                                extension needs your approval; no automatic
                                extra charge. A declined extension needs support
                                resolution—not an undisclosed forfeiture.
                              </p>
                              <label className="gx-check">
                                <input
                                  type="checkbox"
                                  checked={input.acknowledged}
                                  onChange={(e) =>
                                    change({ acknowledged: e.target.checked })
                                  }
                                />
                                I have read and accept these counting and
                                targeting instructions.
                              </label>
                            </div>
                          </div>
                        </>
                      )}
                      <div className="gx-actions">
                        <button
                          className="gx-button secondary"
                          type="button"
                          onClick={() =>
                            step > 1 ? setStep((s) => s - 1) : setEditing(false)
                          }
                        >
                          <ArrowLeft size={17} />
                          {step > 1 ? "Back" : "Close planner"}
                        </button>
                        {step < 4 ? (
                          <button className="gx-button" type="submit">
                            Continue
                            <ArrowRight size={17} />
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              className="gx-button secondary"
                              onClick={() => persist(false)}
                            >
                              Save draft
                            </button>
                            <button
                              type="button"
                              disabled={busy || !input.acknowledged}
                              className="gx-button"
                              onClick={() => persist(true)}
                            >
                              {busy ? "Saving…" : "Submit for review"}
                              <ArrowRight size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </form>
                  </div>
                  <aside className="gx-aside">
                    <span className="gx-eyebrow">HOW IT WORKS</span>
                    <h3>A clear path. No blind spending.</h3>
                    {[
                      [
                        "01",
                        "Plan your growth",
                        "Choose a destination, quantity and realistic timing.",
                      ],
                      [
                        "02",
                        "Verify access",
                        "Use assigned service contacts. Telegram provider setup is still required.",
                      ],
                      [
                        "03",
                        "Review a fixed quote",
                        "Prices, worker reserves and the agreed terms are recorded.",
                      ],
                      [
                        "04",
                        "Measure and reconcile",
                        "Group requests and channel net growth use different evidence.",
                      ],
                    ].map(([n, t, b]) => (
                      <div className="gx-aside-step" key={n}>
                        <b>{n}</b>
                        <div>
                          <strong>{t}</strong>
                          <p>{b}</p>
                        </div>
                      </div>
                    ))}
                    <p className="gx-muted">
                      No paid work starts just because a draft or quote is
                      accepted. Live provider setup is still required.
                    </p>
                  </aside>
                </div>
              ) : (
                <>
                  <div className="gx-summary">
                    <div>
                      <span>YOUR PLANS</span>
                      <strong>{data.orders.length}</strong>
                    </div>
                    <div>
                      <span>NEED YOUR REVIEW</span>
                      <strong>
                        {
                          data.orders.filter((o: any) =>
                            ["QUOTED", "EXTENSION_REQUIRED"].includes(o.status),
                          ).length
                        }
                      </strong>
                    </div>
                    <div>
                      <span>PAYMENT STATUS</span>
                      <strong className="gx-text-value">
                        Live checkout off
                      </strong>
                    </div>
                  </div>
                  <div className="gx-list-heading">
                    <h3>Your growth campaigns</h3>
                    <button
                      className="gx-button secondary small"
                      onClick={refresh}
                    >
                      <RefreshCw size={16} />
                      Refresh
                    </button>
                  </div>
                  {!data.orders.length ? (
                    <div className="gx-empty">
                      <Users size={32} />
                      <h3>Your first community starts here.</h3>
                      <p>
                        Prepare a real saved plan. You will not be charged for
                        creating a draft.
                      </p>
                      <button className="gx-button" onClick={() => start()}>
                        Plan a growth campaign
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  ) : (
                    <div className="gx-orders">
                      {data.orders.map((o: any) => (
                        <article
                          key={o.id}
                          className={`gx-order ${selected === o.id ? "selected" : ""}`}
                        >
                          <div>
                            <span className="gx-badge">
                              {
                                GROWTH_PRODUCTS[
                                  o.input.product as GrowthProduct
                                ].name
                              }
                            </span>
                            <h3>{o.input.title}</h3>
                            <p>
                              {o.input.quantity.toLocaleString()}{" "}
                              {
                                GROWTH_PRODUCTS[
                                  o.input.product as GrowthProduct
                                ].unit
                              }{" "}
                              · {nice(o.input.lane)}
                            </p>
                          </div>
                          <div>
                            <span className="gx-badge status">
                              {nice(o.status)}
                            </span>
                            <small>Updated {when(o.updatedAt)}</small>
                            <div className="gx-inline-actions">
                              <button
                                className="gx-button secondary small"
                                onClick={() =>
                                  setSelected(selected === o.id ? null : o.id)
                                }
                              >
                                {selected === o.id
                                  ? "Close details"
                                  : "View details"}
                              </button>
                              {o.status === "DRAFT" && (
                                <button
                                  className="gx-button secondary small"
                                  onClick={() => start(o)}
                                >
                                  Edit draft
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {current && (
                    <GrowthOrderDetail
                      order={current}
                      readiness={data.readiness}
                      busy={busy}
                      action={action}
                    />
                  )}
                </>
              )}
            </>
          )}
          <div className="gx-provider-strip">
            <Wallet size={20} />
            <div>
              <strong>
                Payment routing planned: Squad first, Kora backup.
              </strong>
              <p>
                Sandbox adapters are separate from live balances. An uncertain
                payment must be reconciled before another provider is used.
                Worker rewards remain tied to successful funded work, not growth
                results.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
function GrowthOrderDetail({
  order: o,
  readiness,
  busy,
  action,
}: {
  order: any;
  readiness: any;
  busy: boolean;
  action: any;
}) {
  const [copied, setCopied] = useState(false);
  const p = GROWTH_PRODUCTS[o.input.product as GrowthProduct];
  return (
    <section className="gx-detail" aria-label="Campaign details">
      <div className="gx-list-heading">
        <div>
          <span className="gx-eyebrow">SAVED CAMPAIGN</span>
          <h3>{o.input.title}</h3>
        </div>
        <button
          className="gx-button secondary small"
          onClick={() =>
            action(() => downloadReport(o), "Private report downloaded")
          }
        >
          <Download size={16} />
          Download report
        </button>
      </div>
      <GrowthCreativeGallery key={o.id} orderId={o.id} />
      <dl className="gx-review">
        <div>
          <dt>Target</dt>
          <dd>
            {o.input.quantity.toLocaleString()} {p.unit}
          </dd>
        </div>
        <div>
          <dt>Delivered</dt>
          <dd>
            {o.delivered.toLocaleString()}{" "}
            {o.startedAt ? "recorded" : "— not started"}
          </dd>
        </div>
        <div>
          <dt>Starting / latest count</dt>
          <dd>
            {o.baseline ?? "Not recorded"} / {o.latestCount ?? "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Requested deadline</dt>
          <dd>{when(o.deadlineAt || o.input.expectedAt)}</dd>
        </div>
      </dl>
      {o.verificationCode && (
        <div className="gx-terms">
          <ShieldCheck size={22} />
          <div>
            <strong>Complete access verification within 10 minutes</strong>
            <p>
              Provide the required permissions to both assigned service
              contacts. For a channel, send the channel-admin invitation. Never
              transfer channel ownership.
            </p>
            <p>
              Matching code: <b className="gx-code">{o.verificationCode}</b>{" "}
              <button
                className="gx-button secondary small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(o.verificationCode);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy code"}
              </button>
            </p>
            <small>Window ends {when(o.verificationExpiresAt)}</small>
          </div>
        </div>
      )}
      {!!o.assignments.length && (
        <div className="gx-assigned">
          {o.assignments.map((a: any) => (
            <div key={a.id}>
              <strong>
                {nice(a.role)} · {a.label}
              </strong>
              <span>{a.phone}</span>
              <small>{nice(a.state)}</small>
            </div>
          ))}
        </div>
      )}
      {o.quote && (
        <div className="gx-quote">
          <span className="gx-eyebrow">FIXED QUOTE</span>
          <strong>{growthMoney(o.quote.amountKobo)}</strong>
          <p>
            NGN settlement currency. Includes the disclosed plan and fees. Valid
            until {when(o.quote.expiresAt)}.
          </p>
          <p>
            {o.quote.plan.distinctGroups} planned distinct groups · country
            meaning: {o.quote.plan.countryMeaning}.
          </p>
          {o.status === "QUOTED" && (
            <button
              disabled={busy}
              className="gx-button"
              onClick={() =>
                action(
                  () => send(`/growth/${o.id}/accept`, { quoteId: o.quote.id }),
                  "Quote accepted. No payment or broadcast started.",
                )
              }
            >
              Accept quote — no payment now
            </button>
          )}
          {o.status === "ACCEPTED" && (
            <p className="gx-notice">
              Awaiting provider setup. Live payment and dispatch are disabled.
            </p>
          )}
        </div>
      )}
      <GrowthSandboxCheckout
        key={o.id}
        order={o}
        readiness={readiness}
        busy={busy}
        action={action}
      />
      {o.extensions
        .filter((e: any) => e.status === "OFFERED")
        .map((e: any) => (
          <div className="gx-terms" key={e.id}>
            <Clock3 size={22} />
            <div>
              <strong>Review a deadline extension</strong>
              <p>Proposed deadline: {when(e.proposed_deadline)}</p>
              <p>{e.note}</p>
              <p>
                Target and agreed price stay unchanged. Declining keeps work
                paused for support resolution.
              </p>
              <div className="gx-inline-actions">
                <button
                  disabled={busy}
                  className="gx-button"
                  onClick={() =>
                    action(
                      () =>
                        send(`/growth/${o.id}/extensions/${e.id}`, {
                          accept: true,
                        }),
                      "Extension accepted",
                    )
                  }
                >
                  Accept extension
                </button>
                <button
                  disabled={busy}
                  className="gx-button secondary"
                  onClick={() =>
                    action(
                      () =>
                        send(`/growth/${o.id}/extensions/${e.id}`, {
                          accept: false,
                        }),
                      "Extension declined; work remains paused",
                    )
                  }
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        ))}
      <h4>Activity record</h4>
      <ol className="gx-timeline">
        {[...o.events].reverse().map((e: any) => (
          <li key={e.id}>
            <span />
            <div>
              <strong>{nice(e.kind)}</strong>
              <p>{e.message}</p>
              <time>{when(e.created_at)}</time>
            </div>
          </li>
        ))}
      </ol>
      {[
        "DRAFT",
        "REVIEW",
        "VERIFYING",
        "VERIFIED",
        "QUOTED",
        "ACCEPTED",
      ].includes(o.status) && (
        <button
          disabled={busy}
          className="gx-button secondary"
          onClick={() =>
            action(
              () => send(`/growth/${o.id}/cancel`, {}),
              "Campaign cancelled before live work",
            )
          }
        >
          Cancel before live work
        </button>
      )}
    </section>
  );
}
function GrowthAdmin({
  data,
  busy,
  action,
  refresh,
}: {
  data: any;
  busy: boolean;
  action: any;
  refresh: any;
}) {
  const [selected, setSelected] = useState(""),
    [inventory, setInventory] = useState<any>(null);
  const o = data.orders.find((r: any) => r.id === selected);
  const formData = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };
  return (
    <>
      <div className="gx-summary">
        <div>
          <span>REVIEW QUEUE</span>
          <strong>
            {data.orders.filter((o: any) => o.status === "REVIEW").length}
          </strong>
        </div>
        <div>
          <span>ELIGIBLE WA GROUPS</span>
          <strong>{data.inventorySummary.eligibleWhatsAppGroups}</strong>
          <small>
            Distinct, fresh, permitted and opted-in—not guaranteed growth.
          </small>
        </div>
        <div>
          <span>PAYMENT / DISPATCH</span>
          <strong className="gx-text-value">Live gates off</strong>
        </div>
      </div>
      <GrowthAudienceSettings data={data} busy={busy} action={action} />
      <details className="gx-panel">
        <summary>
          <Settings2 size={19} />
          Service prices — nothing is pre-priced
        </summary>
        <p>
          Whole kobo values: 100 kobo = NGN 1. Quotes must cover the existing
          minimum margin, fees and full worker reserve. Existing accepted quotes
          are immutable.
        </p>
        <div className="gx-admin-prices">
          {data.prices.map((p: any) => (
            <form
              key={p.product + ":" + p.revision}
              onSubmit={(e) => {
                const f = formData(e);
                action(
                  () =>
                    send(
                      `/admin/growth-prices/${p.product}`,
                      {
                        unitKobo: f.unit === "" ? null : Number(f.unit),
                        baseKobo: Number(f.base),
                        urgentBps: Number(f.urgent),
                        revision: p.revision,
                      },
                      "PUT",
                    ),
                  "Price settings saved; existing quotes unchanged",
                );
              }}
            >
              <h4>{GROWTH_PRODUCTS[p.product as GrowthProduct].name}</h4>
              <div className="gx-field">
                <label htmlFor={"price-unit-" + p.product}>
                  Kobo per requested unit (blank = unset)
                </label>
                <input
                  id={"price-unit-" + p.product}
                  name="unit"
                  type="number"
                  min={1}
                  max={1000000}
                  step={1}
                  defaultValue={p.unit_kobo ?? ""}
                />
              </div>
              <div className="gx-two">
                <div className="gx-field">
                  <label htmlFor={"price-base-" + p.product}>
                    Base fee, kobo
                  </label>
                  <input
                    id={"price-base-" + p.product}
                    name="base"
                    type="number"
                    required
                    min={0}
                    max={100000000}
                    defaultValue={p.base_kobo}
                  />
                </div>
                <div className="gx-field">
                  <label htmlFor={"price-urgent-" + p.product}>
                    Urgent multiplier, basis points
                  </label>
                  <input
                    id={"price-urgent-" + p.product}
                    name="urgent"
                    type="number"
                    required
                    min={10000}
                    max={50000}
                    defaultValue={p.urgent_bps}
                  />
                  <small>10000 = 1×. No hidden urgency price.</small>
                </div>
              </div>
              <button disabled={busy} className="gx-button secondary small">
                Save {GROWTH_PRODUCTS[p.product as GrowthProduct].name} prices
              </button>
            </form>
          ))}
        </div>
      </details>
      <details className="gx-panel">
        <summary>
          <Users size={19} />
          Dedicated service-admin contacts
        </summary>
        <p>
          These are service contacts, not worker accounts chosen without
          consent. Numbers rest for 10 minutes after confirmed removal; this
          does not guarantee protection from bans.
        </p>
        <div className="gx-assigned">
          {data.serviceAdmins.map((a: any) => (
            <div key={a.id}>
              <strong>
                {a.label} · {a.platform}
              </strong>
              <span>{a.phone}</span>
              <small>
                {a.rest_until
                  ? "Rest until " + when(a.rest_until)
                  : "No recorded rest period"}
              </small>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            const f = formData(e);
            action(
              () => send("/admin/growth-service-admins", f),
              "Service contact added",
            );
          }}
        >
          <div className="gx-two">
            <div className="gx-field">
              <label htmlFor="ga-label">Service label</label>
              <input
                id="ga-label"
                name="label"
                minLength={2}
                maxLength={60}
                required
              />
            </div>
            <div className="gx-field">
              <label htmlFor="ga-phone">International contact number</label>
              <input
                id="ga-phone"
                name="phone"
                type="tel"
                pattern="\+[1-9][0-9]{6,14}"
                required
                placeholder="+234…"
              />
            </div>
          </div>
          <div className="gx-field">
            <label htmlFor="ga-platform">Platform</label>
            <select id="ga-platform" name="platform">
              <option value="WA">WhatsApp</option>
              <option value="TG">Telegram</option>
            </select>
          </div>
          <button disabled={busy} className="gx-button secondary small">
            Add service contact
          </button>
        </form>
      </details>
      <div className="gx-list-heading">
        <h3>Campaign review desk</h3>
        <button className="gx-button secondary small" onClick={refresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      <div className="gx-field">
        <label htmlFor="ga-order">Choose a campaign</label>
        <select
          id="ga-order"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setInventory(null);
          }}
        >
          <option value="">
            {data.orders.length
              ? "Select a saved order"
              : "No campaigns submitted yet"}
          </option>
          {data.orders.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.input.title} — {nice(r.status)}
            </option>
          ))}
        </select>
      </div>
      {o && (
        <section className="gx-detail">
          <div className="gx-list-heading">
            <h3>{o.input.title}</h3>
            <span className="gx-badge">{nice(o.status)}</span>
          </div>
          <p>
            {GROWTH_PRODUCTS[o.input.product as GrowthProduct].name} ·{" "}
            {o.input.quantity.toLocaleString()} additional units ·{" "}
            {when(o.input.expectedAt)}
          </p>
          <p className="gx-muted">Destination: {o.input.destination}</p>
          <p>
            Private verification contact:{" "}
            {o.input.contactPhone || "Not provided"}
          </p>
          {["REVIEW", "VERIFYING"].includes(o.status) &&
            !o.assignments.some((a: any) => a.state !== "LEFT") && (
              <form
                onSubmit={(e) => {
                  const f = formData(e);
                  action(
                    () =>
                      send(`/admin/growth/${o.id}/assign`, {
                        serviceAdminIds: [f.primary, f.backup],
                      }),
                    "10-minute access window opened",
                  );
                }}
              >
                <div className="gx-two">
                  {["primary", "backup"].map((name) => (
                    <div className="gx-field" key={name}>
                      <label htmlFor={"ga-" + name}>
                        {nice(name)} service admin
                      </label>
                      <select
                        id={"ga-" + name}
                        name={name}
                        required
                        defaultValue=""
                      >
                        <option value="">Select an available contact</option>
                        {data.serviceAdmins
                          .filter(
                            (a: any) =>
                              a.platform ===
                              (o.input.product.startsWith("WA") ? "WA" : "TG"),
                          )
                          .map((a: any) => (
                            <option value={a.id} key={a.id}>
                              {a.label} · {a.phone}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button disabled={busy} className="gx-button">
                  Assign primary and backup
                </button>
              </form>
            )}
          {o.status === "VERIFYING" && (
            <form
              onSubmit={(e) => {
                const f = formData(e);
                action(
                  () =>
                    send(`/admin/growth/${o.id}/verify`, {
                      code: f.code,
                      note: f.note,
                      permissionsChecked: f.permissions === "on",
                    }),
                  "Staff access attestation recorded; automatic counting remains uncertified",
                );
              }}
            >
              <h4>Record an actual access check</h4>
              <p>
                This is a staff attestation, not fabricated provider evidence.
                Confirm both contacts have the required access. Never request
                ownership transfer.
              </p>
              <div className="gx-field">
                <label htmlFor="ga-code">
                  Matching code supplied by the advertiser
                </label>
                <input id="ga-code" name="code" required maxLength={8} />
              </div>
              <div className="gx-field">
                <label htmlFor="ga-note">Private evidence note</label>
                <textarea
                  id="ga-note"
                  name="note"
                  required
                  minLength={12}
                  maxLength={500}
                />
              </div>
              <label className="gx-check">
                <input type="checkbox" required name="permissions" />I checked
                the correct destination and actual required permissions for both
                contacts.
              </label>
              <button disabled={busy} className="gx-button">
                Record access check
              </button>
            </form>
          )}
          {o.assignments
            .filter((a: any) => a.state === "LEAVE_REQUIRED")
            .map((a: any) => (
              <div className="gx-terms" key={a.id}>
                <AlertCircle size={20} />
                <div>
                  <strong>Remove access: {a.label}</strong>
                  <p>
                    Cancel the outstanding join request, leave the group or
                    remove channel-admin access through the supported process.
                    This button records confirmation; it does not itself call
                    WhatsApp.
                  </p>
                  <button
                    disabled={busy}
                    className="gx-button secondary small"
                    onClick={() =>
                      action(
                        () =>
                          send(`/admin/growth-assignments/${a.id}/left`, {}),
                        "Access removal recorded; 10-minute rest started",
                      )
                    }
                  >
                    I verified this contact has left
                  </button>
                </div>
              </div>
            ))}
          {["VERIFIED", "QUOTED"].includes(o.status) && (
            <>
              <button
                className="gx-button secondary"
                disabled={busy}
                onClick={() =>
                  action(
                    async () =>
                      setInventory(
                        await api(`/admin/growth/${o.id}/inventory`),
                      ),
                    "Inventory checked without sending or joining",
                  )
                }
              >
                Check eligible inventory
              </button>
              {inventory && (
                <p>
                  {inventory.distinctGroups} eligible distinct groups for this
                  order. {inventory.evidence}
                </p>
              )}
              <form
                onSubmit={(e) => {
                  const f = formData(e);
                  action(
                    () =>
                      send(`/admin/growth/${o.id}/quote`, {
                        plannedGroups: Number(f.groups),
                        workerBudgetMilli: Number(f.worker),
                        feeKobo: Number(f.fees),
                      }),
                    "Immutable quote created",
                  );
                }}
              >
                <h4>Prepare a funded-cost plan</h4>
                <div className="gx-field">
                  <label htmlFor="ga-groups">
                    Distinct groups in this first plan
                  </label>
                  <input
                    id="ga-groups"
                    name="groups"
                    type="number"
                    required
                    min={1}
                    step={1}
                  />
                </div>
                <div className="gx-two">
                  <div className="gx-field">
                    <label htmlFor="ga-worker">
                      Worker budget, milli-Coins
                    </label>
                    <input
                      id="ga-worker"
                      name="worker"
                      type="number"
                      required
                      min={1}
                      step={1}
                    />
                    <small>
                      1000 milli-Coins = 1 Coin. Existing worker rates do not
                      change.
                    </small>
                  </div>
                  <div className="gx-field">
                    <label htmlFor="ga-fees">
                      Disclosed provider / operating cost, kobo
                    </label>
                    <input
                      id="ga-fees"
                      name="fees"
                      type="number"
                      required
                      min={0}
                      step={1}
                      defaultValue={0}
                    />
                  </div>
                </div>
                <button disabled={busy} className="gx-button">
                  Create fixed quote
                </button>
              </form>
            </>
          )}
          {o.status === "EXTENSION_REQUIRED" &&
            !o.extensions.some((e: any) => e.status === "OFFERED") && (
              <form
                onSubmit={(e) => {
                  const f = formData(e);
                  action(
                    () =>
                      send(`/admin/growth/${o.id}/extensions`, {
                        expectedAt: new Date(String(f.deadline)).toISOString(),
                        note: f.note,
                      }),
                    "Extension offered; no work resumed without advertiser acceptance",
                  );
                }}
              >
                <h4>Offer an extension, never impose one</h4>
                <div className="gx-field">
                  <label htmlFor="ga-extension">Proposed local deadline</label>
                  <input
                    id="ga-extension"
                    name="deadline"
                    type="datetime-local"
                    required
                  />
                </div>
                <div className="gx-field">
                  <label htmlFor="ga-reason">Reason and plan</label>
                  <textarea
                    id="ga-reason"
                    name="note"
                    required
                    minLength={10}
                    maxLength={500}
                  />
                </div>
                <button disabled={busy} className="gx-button">
                  Send extension offer
                </button>
              </form>
            )}
          <h4>Recorded activity</h4>
          <ol className="gx-timeline">
            {[...o.events].reverse().map((e: any) => (
              <li key={e.id}>
                <span />
                <div>
                  <strong>{nice(e.kind)}</strong>
                  <p>{e.message}</p>
                  <time>{when(e.created_at)}</time>
                </div>
              </li>
            ))}
          </ol>
          <p className="gx-muted">
            Live launch is intentionally unavailable until real funding and
            certified provider counting/delivery are connected. Do not represent
            staff notes as automated proof.
          </p>
        </section>
      )}
    </>
  );
}
