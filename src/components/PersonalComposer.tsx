import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
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
    [payload, setPayload] = useState(""),
    [asset, setAsset] = useState<any>(null),
    [links, setLinks] = useState([""]),
    [draft, setDraft] = useState<any>(null),
    [confirmed, setConfirmed] = useState(false),
    [active, setActive] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [approval, setApproval] = useState("");
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  // Focus only after React has committed the review. A pre-commit animation
  // frame can run before this heading exists under concurrent rendering.
  useEffect(() => {
    if (draft?.draftId) reviewHeading.current?.focus();
  }, [draft?.draftId]);
  async function load() {
    try {
      setData(await api("/broadcasts"));
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
  async function approve(g: any) {
    await work(async () => {
      const result = await send("/whatsapp/groups/approval", {
        accountId: g.account_id,
        groupJid: g.group_jid,
        status: mode !== "ALLCHAT",
        chat: mode !== "ALLSTATUS",
        mentions: mode !== "ALLSTATUS",
      });
      if (result.approved) {
        setNotice(
          "Admin permission confirmed for 30 days, unless it is removed sooner. Review your post again to update the group list.",
        );
        await load();
        setDraft(null);
      } else {
        setApproval(result.instructions);
        setNotice(
          "Ask a group admin to send this permission command inside that group.",
        );
      }
    });
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
  const permissionGroups = (data?.groups || []).filter(
    (g: any, i: number, all: any[]) =>
      all.findIndex((x) => x.group_jid === g.group_jid) === i &&
      !all.some((x) => x.group_jid === g.group_jid && permitted(x)),
  );
  return (
    <div className="earning-hub personal-broadcasts">
      <div className="workspace-banner">
        <Send size={23} />
        <div>
          <strong>One post. All your permitted groups.</strong>
          <p>
            No picking groups. We use your connected numbers, skip your ignore
            list, and avoid shared-group duplicates.
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
                All connected groups with the right admin permission are
                included automatically, even small groups. Your own posts never
                earn Coins.
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
                    Paste invite links for groups that must not get your post.
                    Add more below. We only check groups you already belong to —
                    we never join a group.
                  </p>
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
              Groups and permissions are checked again before sending.
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
                        Ready · {g.members} members · personal post, no earnings
                      </small>
                    </span>
                  </li>
                ))}
                {draft.plan.skips.map((g: any) => (
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
                  No groups are ready. Check your connection and group-admin
                  permissions below, then review again.
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
          Personal beta: {data?.limits?.dailyRuns ?? 3} posts per UTC day · wait{" "}
          {data?.limits?.minGapSeconds ?? 60} seconds between posts · up to{" "}
          {data?.limits?.maxGroups ?? 200} groups per post.
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
      {!!permissionGroups.length && (
        <details className="panel composer-permissions">
          <summary>
            <ShieldCheck size={20} />
            <strong>Group permission help</strong>
            <span>{permissionGroups.length} need checking</span>
          </summary>
          <p>
            We cannot post to a group without the right admin permission. If you
            are an admin, you can approve it here. Otherwise, ask an admin to
            send the permission command.
          </p>
          <div className="permission-list">
            {permissionGroups.map((g: any) => (
              <div key={g.group_jid}>
                <span>
                  <strong>{g.subject}</strong>
                  <small>{g.member_count} members</small>
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => approve(g)}
                >
                  {g.user_is_admin
                    ? "Allow posts here"
                    : "Ask admin permission"}
                </button>
              </div>
            ))}
          </div>
          {approval && (
            <div className="permission-command">
              <label htmlFor="permission-command">
                Ask an admin to send this inside the group
              </label>
              <textarea
                id="permission-command"
                readOnly
                value={approval}
                rows={3}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  work(async () => {
                    await navigator.clipboard.writeText(approval);
                    setNotice("Permission command copied.");
                  })
                }
              >
                <Copy size={16} />
                Copy command
              </button>
            </div>
          )}
        </details>
      )}
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
