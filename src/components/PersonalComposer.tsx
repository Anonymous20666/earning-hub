import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  ImagePlus,
  Link2,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { api, send, date } from "../api";
import { BroadcastConsole } from "./BroadcastConsole";
const modes = [
  ["ALLSTATUS", "Group status", "allstatus · Post to the group’s status"],
  ["ALLCHAT", "Group chat", "allchat · Send a chat message and notify members"],
  ["DOUBLE", "Both", "2x · Group status first, then group chat"],
];
const modeName = (m: string) => modes.find((x) => x[0] === m)?.[1] || m;
export function PersonalBroadcasts({ revision = 0 }: { revision?: number }) {
  const [data, setData] = useState<any>(null),
    [kind, setKind] = useState("TEXT"),
    [mode, setMode] = useState("ALLSTATUS"),
    [delaySeconds, setDelaySeconds] = useState("10"),
    [payload, setPayload] = useState(""),
    [asset, setAsset] = useState<any>(null),
    [links, setLinks] = useState([""]),
    [draft, setDraft] = useState<any>(null),
    [confirmed, setConfirmed] = useState(false),
    [active, setActive] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [accountIds, setAccountIds] = useState<string[] | null>(null),
    [groupSearch, setGroupSearch] = useState(""),
    [ignoreOverrides, setIgnoreOverrides] = useState<Record<string, boolean>>(
      {},
    );
  const loadSequence = useRef(0),
    savingIgnores = useRef(new Set<string>());
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  // Focus only after React has committed the review. A pre-commit animation
  // frame can run before this heading exists under concurrent rendering.
  useEffect(() => {
    if (draft?.draftId) reviewHeading.current?.focus();
  }, [draft?.draftId]);
  async function load() {
    try {
      const sequence = ++loadSequence.current;
      const next = await api("/broadcasts");
      if (sequence !== loadSequence.current) return;
      setData(next);
      setIgnoreOverrides((old) =>
        Object.fromEntries(
          Object.entries(old).filter(([jid]) => savingIgnores.current.has(jid)),
        ),
      );
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [revision]);
  useEffect(() => {
    if (!active) {
      const running =
        data?.runs?.find((r: any) =>
          ["QUEUED", "RUNNING"].includes(r.status),
        ) || data?.runs?.[0];
      if (running) setActive(running.id);
    }
  }, [data, active]);
  async function work(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await work(async () => {
      if (file.size > 8 * 1024 * 1024) throw Error("Maximum upload: 8 MiB");
      setAsset(
        await api("/broadcast-assets", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        }),
      );
      setNotice(
        "Media checked and privately stored. Add an optional caption, then review your post.",
      );
      await load();
    });
  }
  async function review(e: React.FormEvent) {
    e.preventDefault();
    await work(async () => {
      const pending = links.map((s) => s.trim()).filter(Boolean);
      if (pending.length) {
        await send("/personal-posts/ignores", { links: pending });
        setLinks([""]);
        await load();
      }
      const result = await send("/personal-posts/prepare", {
        kind,
        mode,
        delaySeconds: Number(delaySeconds),
        accountIds: chosenIds,
        payload,
        assetId: kind === "MEDIA" ? asset?.id : null,
      });
      setDraft(result);
      setConfirmed(false);
    });
  }
  async function post() {
    if (!confirmed) return;
    await work(async () => {
      const result = await send("/personal-posts", {
        draftId: draft.draftId,
        confirmed: true,
      });
      setActive(result.id);
      requestAnimationFrame(() => {
        const heading = document.getElementById("broadcast-console-heading");
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      });
      setDraft(null);
      setConfirmed(false);
      setPayload("");
      setAsset(null);
      setNotice(
        "Your post is queued. Watch the real activity below. Refreshing this page will not send it again.",
      );
      await load();
    });
  }
  const accounts: any[] = data?.accounts || [
    ...new Map<string, any>(
      (data?.groups || []).map((g: any) => [
        g.account_id,
        { id: g.account_id, slot: g.slot, status: g.status },
      ]),
    ).values(),
  ];
  const chosenIds =
    accountIds === null ? accounts.map((a) => a.id) : accountIds;
  const ignoredIds = new Set(
    (data?.ignoredGroups || []).map((g: any) => g.group_jid),
  );
  for (const [jid, ignored] of Object.entries(ignoreOverrides)) {
    if (ignored) ignoredIds.add(jid);
    else ignoredIds.delete(jid);
  }
  const ownedGroups: any[] = [
    ...new Map<string, any>(
      (data?.groups || []).map((g: any) => [g.group_jid, g]),
    ).values(),
  ];
  const visibleGroups = ownedGroups.filter((g) =>
    g.subject
      .normalize("NFKC")
      .toLocaleLowerCase()
      .includes(groupSearch.normalize("NFKC").toLocaleLowerCase()),
  );
  return (
    <div className="earning-hub personal-broadcasts">
      <div className="workspace-banner">
        <Send size={23} />
        <div>
          <strong>Your own posts. Your own WhatsApp numbers.</strong>
          <p>
            Choose a number, write your post, and tick any groups to skip. This
            free tool is separate from paid work and never earns Coins.
          </p>
        </div>
        <span className="badge neutral">Free · no earnings</span>
      </div>
      <section
        className="panel composer-panel"
        aria-labelledby="personal-composer-title"
      >
        <div className="panel-heading">
          <div>
            <span className="eyebrow">YOUR PERSONAL BROADCAST</span>
            <h2 id="personal-composer-title">Send a post to your groups.</h2>
          </div>
          <a href="#/app/connections">My WhatsApp →</a>
        </div>
        <ol className="composer-steps" aria-label="Posting steps">
          <li className={!draft ? "current" : "complete"}>
            <span>{draft ? <Check size={14} /> : "1"}</span>Write or upload
          </li>
          <li className={draft ? "current" : ""}>
            <span>2</span>Review & confirm
          </li>
          <li>
            <span>3</span>Watch it post
          </li>
        </ol>
        {error && (
          <div className="notice warning" role="alert">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <CheckCircle2 size={20} />
            <p>{notice}</p>
          </div>
        )}
        {!draft ? (
          <form onSubmit={review}>
            <fieldset className="composer-fieldset" disabled={busy}>
              <legend className="plain-step-title">
                What would you like to post?
              </legend>
              <fieldset className="composer-account-picker">
                <legend>1. Which WhatsApp number should post?</legend>
                <p>
                  Both numbers use the same Pappy wallet. Shared groups get one
                  copy per post type.
                </p>
                <div className="composer-account-options">
                  {accounts.map((a) => (
                    <label
                      key={a.id}
                      className={chosenIds.includes(a.id) ? "is-selected" : ""}
                    >
                      <input
                        type="checkbox"
                        checked={chosenIds.includes(a.id)}
                        onChange={(e) =>
                          setAccountIds(
                            e.target.checked
                              ? [...chosenIds, a.id]
                              : chosenIds.filter((id) => id !== a.id),
                          )
                        }
                      />
                      <span>
                        <strong>Number {a.slot}</strong>
                        <small>
                          {a.phone_label || "Your WhatsApp"} ·{" "}
                          {a.status === "ONLINE"
                            ? "Connected"
                            : "Offline — skipped until reconnected"}
                        </small>
                      </span>
                    </label>
                  ))}
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setAccountIds(accounts.map((a) => a.id))}
                    >
                      Use both numbers
                    </button>
                  )}
                </div>
                {!accounts.length && (
                  <a className="btn btn-primary" href="#/app/connections">
                    Connect my WhatsApp first <ArrowRight size={17} />
                  </a>
                )}
                {!!accounts.length && !chosenIds.length && (
                  <p role="status">Choose at least one number to continue.</p>
                )}
              </fieldset>
              <div className="composer-kind">
                <button
                  type="button"
                  aria-pressed={kind === "TEXT"}
                  className={kind === "TEXT" ? "selected" : ""}
                  onClick={() => setKind("TEXT")}
                >
                  <FileText size={25} />
                  <span>
                    <strong>Text</strong>
                    <small>Write a message or paste a link</small>
                  </span>
                  {kind === "TEXT" && <CheckCircle2 size={18} />}
                </button>
                <button
                  type="button"
                  aria-pressed={kind === "MEDIA"}
                  className={kind === "MEDIA" ? "selected" : ""}
                  onClick={() => setKind("MEDIA")}
                >
                  <ImagePlus size={25} />
                  <span>
                    <strong>Media</strong>
                    <small>Upload a photo or video</small>
                  </span>
                  {kind === "MEDIA" && <CheckCircle2 size={18} />}
                </button>
              </div>
              {kind === "MEDIA" && (
                <div className="composer-upload">
                  <label htmlFor="personal-media">
                    <ImagePlus size={20} />
                    <strong>
                      {asset
                        ? "Choose a different file"
                        : "Upload your photo or video"}
                    </strong>
                    <span>JPEG, PNG, WebP or MP4 · up to 8 MiB</span>
                  </label>
                  <input
                    id="personal-media"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    onChange={upload}
                  />
                  <p className="media-quality-note">
                    Higher-quality images and clearer previews. WhatsApp may
                    still compress your post.
                  </p>
                  {asset && (
                    <div className="uploaded-media">
                      {asset.mime === "video/mp4" ? (
                        <video
                          src={`/api/broadcast-assets/${asset.id}`}
                          controls
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={`/api/broadcast-assets/${asset.id}`}
                          alt="Your uploaded post"
                        />
                      )}
                      <span>
                        <CheckCircle2 size={16} /> Ready ·{" "}
                        {(asset.bytes / 1048576).toFixed(2)} MiB
                      </span>
                      <button type="button" onClick={() => setAsset(null)}>
                        Remove from post
                      </button>
                    </div>
                  )}
                </div>
              )}
              <label
                className="composer-payload-label"
                htmlFor="personal-payload"
              >
                {kind === "MEDIA" ? "Caption (optional)" : "Your text or link"}
              </label>
              <textarea
                id="personal-payload"
                name="payload"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={6}
                maxLength={1800}
                required={kind === "TEXT"}
                placeholder={
                  kind === "MEDIA"
                    ? "Add your message or a link here…"
                    : "Paste your link, write your message, or use both…"
                }
                aria-describedby="personal-payload-help"
              />
              <div className="composer-input-hint">
                <p id="personal-payload-help">
                  Your attached text stays in the post. For a public HTTPS link,
                  we try to add its real title and image.
                </p>
                <span>{payload.length}/1,800</span>
              </div>
              <h3 className="plain-step-title">Where should it appear?</h3>
              <div className="wa-mode-grid">
                {modes.map(([id, name, note]) => (
                  <button
                    type="button"
                    className={`wa-mode ${mode === id ? "selected" : ""}`}
                    aria-pressed={mode === id}
                    key={id}
                    onClick={() => setMode(id)}
                  >
                    <strong>{name}</strong>
                    <small>{note}</small>
                  </button>
                ))}
              </div>
              <p className="plain-help">
                Groups from your selected numbers are included unless you skip
                them or WhatsApp restricts posting. Small groups are welcome.
                Personal posts never earn Coins.
              </p>
              <details className="composer-ignore">
                <summary>
                  <span>
                    <Link2 size={18} />
                    Ignore groups{" "}
                    <small>
                      Optional · {data?.ignoredGroups?.length || 0} saved
                    </small>
                  </span>
                  <Plus size={16} />
                </summary>
                <div>
                  <p>
                    Tick a group to keep it out of your personal posts. Your
                    choices are saved. You can also paste invite links below. We
                    never join groups for you.
                  </p>
                  <label htmlFor="ignore-group-search">
                    Search your groups
                  </label>
                  <input
                    id="ignore-group-search"
                    type="search"
                    placeholder="Type a group name…"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                  />
                  <div
                    className="ignore-group-checklist"
                    aria-label="Choose groups to skip"
                  >
                    {visibleGroups.map((g) => (
                      <label key={g.group_jid}>
                        <input
                          type="checkbox"
                          aria-label={`Skip ${g.subject}`}
                          checked={ignoredIds.has(g.group_jid)}
                          onChange={(e) => {
                            const ignored = e.target.checked;
                            savingIgnores.current.add(g.group_jid);
                            setIgnoreOverrides((old) => ({
                              ...old,
                              [g.group_jid]: ignored,
                            }));
                            work(async () => {
                              try {
                                await send("/personal-posts/ignores/select", {
                                  groupJid: g.group_jid,
                                  ignored,
                                });
                              } finally {
                                savingIgnores.current.delete(g.group_jid);
                                await load();
                              }
                            });
                          }}
                        />
                        <span>
                          <strong>{g.subject}</strong>
                          <small>
                            {g.member_count} members ·{" "}
                            {[
                              ...new Set(
                                (data.groups || [])
                                  .filter(
                                    (x: any) => x.group_jid === g.group_jid,
                                  )
                                  .map((x: any) => `Number ${x.slot}`),
                              ),
                            ].join(" + ")}
                          </small>
                        </span>
                      </label>
                    ))}
                    {!visibleGroups.length && (
                      <p>
                        {ownedGroups.length
                          ? "No matching groups. Try another name."
                          : "Connect WhatsApp and find your groups to see them here."}
                      </p>
                    )}
                  </div>
                  <p className="microcopy">
                    {ignoredIds.size} saved groups will be skipped. Tick = skip;
                    untick = include when WhatsApp allows it.
                  </p>
                  <strong>Or add a group invite link</strong>
                  {(data?.ignoredGroups || []).map((g: any) => (
                    <div className="ignored-group" key={g.group_jid}>
                      <span>
                        <ShieldCheck size={16} />
                        {g.subject}
                      </span>
                      <button
                        type="button"
                        aria-label={`Stop ignoring ${g.subject}`}
                        onClick={() =>
                          work(async () => {
                            await send("/personal-posts/ignores/remove", {
                              groupJid: g.group_jid,
                            });
                            await load();
                          })
                        }
                      >
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </div>
                  ))}
                  {links.map((link, i) => (
                    <div className="composer-ignore-input" key={i}>
                      <label className="sr-only" htmlFor={`ignore-link-${i}`}>
                        Ignore group invite link {i + 1}
                      </label>
                      <input
                        id={`ignore-link-${i}`}
                        type="url"
                        placeholder="https://chat.whatsapp.com/…"
                        value={link}
                        maxLength={300}
                        onChange={(e) =>
                          setLinks((old) =>
                            old.map((x, j) => (i === j ? e.target.value : x)),
                          )
                        }
                      />
                      {links.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove invite link ${i + 1}`}
                          onClick={() =>
                            setLinks((old) => old.filter((_, j) => i !== j))
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={links.length >= 50}
                    onClick={() => setLinks((old) => [...old, ""])}
                  >
                    <Plus size={16} />
                    Add another group link
                  </button>
                  <p className="microcopy">
                    Ignore lists are saved to your account. Permission checks
                    and group removals still apply.
                  </p>
                </div>
              </details>
              <div className="composer-delay">
                <label htmlFor="personal-group-delay">
                  Pause between groups
                </label>
                <div className="composer-delay-value">
                  <input
                    id="personal-group-delay"
                    type="number"
                    min={10}
                    max={60}
                    step={1}
                    required
                    value={delaySeconds}
                    aria-describedby="personal-group-delay-help"
                    inputMode="numeric"
                    onChange={(e) => setDelaySeconds(e.target.value)}
                  />
                  <span>seconds</span>
                </div>
                <p id="personal-group-delay-help">
                  10 seconds by default. Choose 10–60 seconds. Both post types
                  finish in one group before the pause starts.
                </p>
              </div>
              <div className="composer-actions">
                <p>
                  <ShieldCheck size={17} />
                  Nothing posts until you review and confirm.
                </p>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={
                    busy ||
                    !data?.configured ||
                    !chosenIds.length ||
                    (!payload.trim() && kind === "TEXT") ||
                    (kind === "MEDIA" && !asset)
                  }
                >
                  {busy ? "Checking your post…" : "Review & continue"}
                  <ArrowRight size={18} />
                </button>
              </div>
            </fieldset>
          </form>
        ) : (
          <div className="composer-review">
            <div className="review-heading">
              <ShieldCheck size={24} />
              <div>
                <span className="eyebrow">CHECK BEFORE POSTING</span>
                <h3 id="post-review-title" ref={reviewHeading} tabIndex={-1}>
                  Is everything correct?
                </h3>
              </div>
              <span className="badge neutral">{modeName(draft.mode)}</span>
            </div>
            <div className="review-delay">
              <Clock3 size={18} />
              <span>
                <strong>{draft.delaySeconds ?? 10} seconds</strong> between
                groups.{" "}
                {draft.mode === "DOUBLE"
                  ? "Status and chat post to each group before the countdown."
                  : "The next group appears in the live countdown."}
              </span>
            </div>
            <div className="review-post">
              {kind === "MEDIA" &&
                asset &&
                (asset.mime === "video/mp4" ? (
                  <video src={`/api/broadcast-assets/${asset.id}`} controls />
                ) : (
                  <img
                    className="review-upload"
                    src={`/api/broadcast-assets/${asset.id}`}
                    alt="Media to be posted"
                  />
                ))}
              <p className="review-message">
                {draft.text || "Media only — no caption"}
              </p>
              {kind === "TEXT" && draft.preview && (
                <div className="review-link-card">
                  {draft.preview.image && (
                    <img
                      src={draft.preview.image}
                      alt="Image supplied by the linked website"
                    />
                  )}
                  <div>
                    <strong>{draft.preview.title}</strong>
                    <p>{draft.preview.description}</p>
                    {!draft.preview.image && (
                      <p role="status">
                        A thumbnail could not be prepared this time. Your link
                        and text will still be sent. You can go back and review
                        again before posting.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {kind === "TEXT" &&
              /https:\/\//i.test(payload) &&
              !draft.preview && (
                <p className="plain-help">
                  This website did not provide a usable preview. Your original
                  link and message will still be sent.
                </p>
              )}
            {kind === "MEDIA" && (
              <p className="plain-help">
                The media and caption are sent together. A separate link-preview
                card inside a media caption is not guaranteed.
              </p>
            )}
            <div className="review-counts">
              <div>
                <strong>{draft.plan.targets.length}</strong>
                <span>Groups ready</span>
              </div>
              <div>
                <strong>{draft.plan.skips.length}</strong>
                <span>Groups skipped</span>
              </div>
              <div>
                <strong>{draft.plan.sharedMemberships}</strong>
                <span>Shared copies avoided</span>
              </div>
            </div>
            <p className="plain-help">
              {draft.mode === "DOUBLE"
                ? "Status first, then chat for each group. If status is not safely accepted, that group’s chat is skipped."
                : "One post per unique group."}{" "}
              WhatsApp membership and native posting rights are checked again
              before sending. No extra admin command is required.
            </p>
            <details className="review-group-details">
              <summary>See the automatic group check</summary>
              <ul>
                {draft.plan.targets.map((g: any) => (
                  <li key={g.groupJid}>
                    <CheckCircle2 size={17} />
                    <span>
                      <strong>{g.subject}</strong>
                      <small>
                        Number {g.slot || "—"} · {g.members} members ·{" "}
                        {g.chatLocked ? "Status only; chat locked" : "Ready"} ·
                        no earnings
                      </small>
                    </span>
                  </li>
                ))}
                {[
                  ...draft.plan.skips,
                  ...(draft.plan.skippedSurfaces || []),
                ].map((g: any) => (
                  <li key={g.groupJid}>
                    <AlertCircle size={17} />
                    <span>
                      <strong>{g.subject}</strong>
                      <small>Skipped — {g.reason}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
            <label className="review-confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy}
              />
              <span>
                I checked this post and have permission to share it with these
                groups.
              </span>
            </label>
            {!draft.plan.targets.length && (
              <div className="notice warning">
                <p>
                  No groups are ready. Check your selected number, connection,
                  group locks and ignore list, then review again.
                </p>
              </div>
            )}
            <div className="composer-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  setConfirmed(false);
                }}
              >
                Back to edit
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={post}
                disabled={busy || !confirmed || !draft.plan.targets.length}
              >
                <Send size={18} />
                {busy
                  ? "Queueing…"
                  : draft.plan.targets.length === 1
                    ? "Post to 1 group"
                    : `Post to all ${draft.plan.targets.length} groups`}
              </button>
            </div>
            <p className="microcopy">
              Review expires in 10 minutes. No money, Coins or referral rewards
              are involved.
            </p>
          </div>
        )}
        <p className="composer-limit-note">
          No daily posting cap or group-count limit. You choose the pause
          between groups. Sending is paced safely; WhatsApp’s own limits still
          apply.
        </p>
        {data && !data.configured && (
          <div className="notice warning">
            <p>
              WhatsApp sending is not configured on this server. No posts can be
              sent.
            </p>
          </div>
        )}
        {data && !data.groups?.length && (
          <p className="plain-help">
            No groups found yet.{" "}
            <a href="#/app/connections">
              Connect WhatsApp and find your groups →
            </a>
          </p>
        )}
      </section>
      <BroadcastConsole
        runId={active}
        serverNow={data?.serverNow}
        onCancel={(id) =>
          work(async () => {
            const stopped = await send(`/broadcasts/${id}/cancel`, {});
            setNotice(
              stopped.stopped
                ? "Stopped the posts that had not started. Already-started sends cannot be recalled."
                : "This post had already finished or stopped. Nothing was sent again.",
            );
            await load();
          })
        }
        busy={busy}
      />
      <div className="notice">
        <ShieldCheck size={21} />
        <p>
          <strong>WhatsApp’s rules apply.</strong> No separate admin-approval
          command is needed for personal posting. Locked chats are skipped
          unless your number is an admin. WhatsApp may reject an unavailable or
          restricted group status. Removed or banned groups stay blocked. The
          console shows what actually happened; uncertain sends are never
          automatically retried.
        </p>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">YOUR POST HISTORY</span>
            <h2>Recent personal posts</h2>
          </div>
        </div>
        {!data?.runs?.length ? (
          <div className="empty-state">
            <Send size={27} />
            <h3>You have not sent a post yet.</h3>
            <p>
              Your real posting history appears here after you confirm a post.
            </p>
          </div>
        ) : (
          <div className="personal-history">
            {data.runs.map((r: any) => (
              <div key={r.id}>
                <span>
                  <strong>{modeName(r.mode)}</strong>
                  <small>
                    {date(r.created_at)} ·{" "}
                    {r.status.toLowerCase().replace("_", " ")} ·{" "}
                    {r.submitted || 0}/{r.placements} sent to WhatsApp
                  </small>
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setActive(r.id)}
                  disabled={active === r.id}
                >
                  {active === r.id ? "Console open" : "View activity"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="wa-attribution">
        Powered by Plogme · Based on @crysnovax/baileys by Crysnovax.{" "}
        <a href="#/plogme-license" target="_blank" rel="noreferrer">
          Library licence and attribution
        </a>
      </p>
    </div>
  );
}
