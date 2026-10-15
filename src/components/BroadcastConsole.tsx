import React, { useEffect, useRef, useState } from "react";
import { Terminal, Clock3, ArrowDown, RefreshCw } from "lucide-react";
import { api } from "../api";
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
function ServerClock({
  sample,
}: {
  sample: { time: string; received: number };
}) {
  const [clock, setClock] = useState("—");
  useEffect(() => {
    const tick = () =>
      setClock(
        clockFormat.format(
          new Date(
            Date.parse(sample.time) + performance.now() - sample.received,
          ),
        ),
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [sample]);
  return (
    <span className="broadcast-clock">
      <Clock3 size={14} />
      <time>{clock}</time>
      <span>Lagos · UTC+1</span>
    </span>
  );
}
function NextGroup({
  pacing,
  sample,
  sameGroup,
}: {
  pacing: any;
  sample: { time: string; received: number };
  sameGroup: boolean;
}) {
  const [now, setNow] = useState(Date.parse(sample.time));
  useEffect(() => {
    const tick = () =>
      setNow(Date.parse(sample.time) + performance.now() - sample.received);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [sample]);
  const remaining = pacing.readyAt
    ? Math.max(0, Math.ceil((Date.parse(pacing.readyAt) - now) / 1000))
    : 0;
  const waiting = remaining > 0;
  return (
    <div className="console-next" data-waiting={waiting}>
      <div className="console-next-heading">
        <span>{sameGroup ? "Next post in this group" : "Next group"}</span>
        <span className="console-delay-chip">
          {pacing.delaySeconds}s between groups
        </span>
      </div>
      <strong className="console-next-name">{pacing.nextGroup.name}</strong>
      <span className="console-next-type">
        {pacing.nextGroup.surface === "GROUP_STATUS"
          ? "Group status"
          : "Group chat"}
      </span>
      {pacing.waitingForEarlierPost ? (
        <p>Queued behind your earlier post. It will start automatically.</p>
      ) : (
        <>
          <div className="console-countdown">
            <span>
              {waiting
                ? "Next group in"
                : pacing.readyAt
                  ? "Getting ready"
                  : "Up next"}
            </span>
            <strong
              role="timer"
              aria-live="off"
              aria-label={
                waiting
                  ? `${remaining} seconds until the next group`
                  : "Preparing the next post"
              }
            >
              {waiting ? `${remaining}s` : "Preparing…"}
            </strong>
          </div>
          {waiting && (
            <progress
              aria-label="Group delay elapsed"
              max={pacing.delaySeconds}
              value={Math.max(0, pacing.delaySeconds - remaining)}
            />
          )}
        </>
      )}
    </div>
  );
}
function activityMessage(e: any) {
  return e.message
    .replace(/\. Delivery is not confirmed\.?/g, ".")
    .replace(/ Acceptance is not delivery proof\./g, "");
}
export function BroadcastConsole({
  runId,
  serverNow,
  onCancel,
  busy,
}: {
  runId: string | null;
  serverNow?: string;
  onCancel: (id: string) => void;
  busy: boolean;
}) {
  const [events, setEvents] = useState<any[]>([]),
    [feed, setFeed] = useState<any>(null),
    [error, setError] = useState(""),
    [follow, setFollow] = useState(true),
    [sample, setSample] = useState({
      time: serverNow || new Date().toISOString(),
      received: performance.now(),
    });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (serverNow && !runId) {
      setSample({ time: serverNow, received: performance.now() });
    }
  }, [serverNow, runId]);
  useEffect(() => {
    setEvents([]);
    setFeed(null);
    setError("");
    if (!runId) return;
    let stopped = false,
      cursor = 0,
      timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      const start = performance.now();
      try {
        const next = await api(
          `/personal-posts/${runId}/events?after=${cursor}`,
          { signal: controller.signal },
        );
        if (stopped) return;
        setSample({
          time: new Date(
            Date.parse(next.serverNow) + (performance.now() - start) / 2,
          ).toISOString(),
          received: performance.now(),
        });
        setFeed(next);
        setError("");
        if (next.events.length) {
          cursor = next.events[next.events.length - 1].id;
          setEvents((old) => [...old, ...next.events]);
        }
        timer = setTimeout(
          poll,
          next.hasMore
            ? 50
            : next.summary.pending > 0 ||
                ["RUNNING", "QUEUED"].includes(next.run.status)
              ? 1200
              : 5000,
        );
      } catch (e: any) {
        if (stopped) return;
        setError(
          "Live updates paused. Reconnecting… Your post will not be resent.",
        );
        timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [runId]);
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [events, follow]);
  const last = events[events.length - 1],
    current = [...events]
      .reverse()
      .find((x) => x.group_name && x.kind !== "WAITING"),
    attempts = new Set(
      events.filter((e) => e.kind === "SENDING").map((e) => e.placement_id),
    ).size,
    finished =
      feed &&
      ["FINISHED", "CANCELLED"].includes(feed.run.status) &&
      !feed.summary.pending,
    s = feed?.summary;
  return (
    <section
      className="broadcast-console"
      aria-labelledby="broadcast-console-heading"
    >
      <header className="broadcast-console-head">
        <div>
          <span className="console-symbol">
            <Terminal size={20} />
          </span>
          <div>
            <span className="console-eyebrow">
              REAL ACTIVITY · NOT A SIMULATION
            </span>
            <h2 id="broadcast-console-heading" tabIndex={-1}>
              Live posting console
            </h2>
          </div>
        </div>
        <ServerClock sample={sample} />
      </header>
      <div className="broadcast-console-status">
        <span className={`console-dot ${runId && !finished ? "active" : ""}`} />
        <strong>
          {!runId
            ? "Ready when you are"
            : finished
              ? feed.run.status === "CANCELLED"
                ? "Stopped"
                : s.uncertain || s.failed
                  ? "Finished — please check results"
                  : "Finished"
              : feed?.pacing?.waitingForEarlierPost
                ? "Waiting for your earlier post"
                : feed?.pacing?.remainingSeconds > 0
                  ? "Pausing before the next group"
                  : last?.kind === "SENDING"
                    ? "Sending to WhatsApp"
                    : last?.kind === "CHECKING"
                      ? "Checking the next group"
                      : "Updating your post"}
        </strong>
        {runId && (
          <span>
            {attempts} / {s?.total ?? "—"} post attempts
          </span>
        )}
      </div>
      {current && (
        <div className="console-current">
          <span>
            {finished
              ? "Last group"
              : feed?.pacing?.remainingSeconds > 0
                ? "Last group"
                : last?.kind === "SENDING" || last?.kind === "CHECKING"
                  ? "Current group"
                  : "Last checked"}
          </span>
          <strong>{current.group_name}</strong>
        </div>
      )}
      {!finished &&
        feed?.pacing?.nextGroup &&
        feed.pacing.nextGroup.state !== "SENDING" && (
          <NextGroup
            pacing={feed.pacing}
            sample={sample}
            sameGroup={current?.group_jid === feed.pacing.nextGroup.groupJid}
          />
        )}
      <div
        className="broadcast-console-lines"
        ref={box}
        role="log"
        aria-label="Posting activity"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
      >
        {!events.length && (
          <div className="console-waiting">
            <Terminal size={30} />
            <strong>
              {runId
                ? "Connecting to the activity log…"
                : "Your posting activity will appear here."}
            </strong>
            <p>
              Review your post, confirm, then watch each group as it is checked
              and sent. No messages have been sent by this screen yet.
            </p>
          </div>
        )}
        {events.map((e) => (
          <div
            className={`console-line console-${e.kind === "WAITING" ? "pause" : e.kind.toLowerCase()}`}
            key={e.id}
          >
            <time dateTime={e.created_at} title={e.created_at}>
              {clockFormat.format(new Date(e.created_at))}
            </time>
            <span className="console-kind">
              {e.kind === "ACCEPTED"
                ? "SENT"
                : e.kind === "WAITING"
                  ? "PAUSE"
                  : e.kind}
            </span>
            <div>
              {e.group_name && <strong>{e.group_name}</strong>}
              <p>{activityMessage(e)}</p>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="console-reconnecting" role="status">
          <RefreshCw size={14} />
          {error}
        </p>
      )}
      {s && (
        <div className="console-summary" aria-label="Posting totals">
          <div>
            <strong>{s.accepted || 0}</strong>
            <span>Sent</span>
          </div>
          <div>
            <strong>{s.skippedGroups || 0}</strong>
            <span>Groups skipped</span>
          </div>
          <div>
            <strong>{s.cancelled || 0}</strong>
            <span>Post types skipped</span>
          </div>
          <div>
            <strong>{s.failed || 0}</strong>
            <span>Posts failed</span>
          </div>
          <div>
            <strong>{s.uncertain || 0}</strong>
            <span>Need checking</span>
          </div>
        </div>
      )}
      {!!s?.cancelled && (
        <p className="console-note">
          {s.cancelled} posts stopped or skipped before sending.
        </p>
      )}
      <footer className="console-footer">
        <p>
          Posts are sent in order. Stop only affects posts that have not
          started.
        </p>
        <div>
          <button
            type="button"
            onClick={() => setFollow(!follow)}
            aria-pressed={follow}
          >
            {follow ? "Pause auto-scroll" : "Follow latest"}
            <ArrowDown size={14} />
          </button>
          {runId && !finished && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancel(runId)}
            >
              Stop unsent posts
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
