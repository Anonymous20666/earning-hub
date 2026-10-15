import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Check, Link2, Users } from "lucide-react";
type MotionPreference = "system" | "on" | "off";
const MOTION_PREFERENCE_KEY = "pappy.scene-motion.v1";
function readMotionPreference(): MotionPreference {
  const requested = new URLSearchParams(window.location.search).get("motion");
  if (requested === "on" || requested === "off" || requested === "system") {
    try {
      if (requested === "system")
        localStorage.removeItem(MOTION_PREFERENCE_KEY);
      else localStorage.setItem(MOTION_PREFERENCE_KEY, requested);
    } catch {
      /* The explicit URL still works when browser storage is blocked. */
    }
    return requested;
  }
  try {
    const saved = localStorage.getItem(MOTION_PREFERENCE_KEY);
    if (saved === "on" || saved === "off") return saved;
  } catch {
    /* No stored preference: follow the device. */
  }
  return "system";
}
export function LiveScene() {
  const root = useRef<HTMLDivElement>(null);
  const [preference] = useState(readMotionPreference);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  // CSS motion downloads nothing: network data-saving must not disable this scene.
  const moving =
    preference === "on" || (preference === "system" && !reducedMotion);
  const [visible, setVisible] = useState(() => !document.hidden),
    [inView, setInView] = useState(true);
  useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    changed();
    document.addEventListener("visibilitychange", changed);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onReduced = () => setReducedMotion(reduced?.matches ?? false);
    if (reduced?.addEventListener)
      reduced.addEventListener("change", onReduced);
    else reduced?.addListener(onReduced);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
        : null;
    if (root.current) observer?.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", changed);
      if (reduced?.removeEventListener)
        reduced.removeEventListener("change", onReduced);
      else reduced?.removeListener(onReduced);
      observer?.disconnect();
    };
  }, []);
  return (
    <div
      className={`live-hero-scene ${moving && visible && inView ? "is-playing" : "is-paused"}`}
      ref={root}
      data-motion-preference={preference}
      aria-hidden="true"
    >
      <div className="scene-label">
        <span />A LITTLE CONNECTION. A NEW POSSIBILITY.
      </div>
      <div className="scene-world" aria-hidden="true">
        <div className="scene-glow" />
        <div className="scene-ground" />
        <div className="scene-orbit orbit-one" />
        <div className="scene-orbit orbit-two" />
        <div className="scene-phone">
          <div className="phone-side" />
          <div className="phone-front">
            <div className="phone-top">
              <span>pappy</span>
              <span className="phone-camera" />
            </div>
            <div className="phone-greeting">
              Ready to
              <br />
              earn?
            </div>
            <div className="phone-message">
              <span className="phone-message-icon">
                <MessageCircle size={22} />
              </span>
              <div>
                <strong>Paid campaigns</strong>
                <span>Confirmed posts earn Coins.</span>
              </div>
            </div>
            <div className="phone-groups">
              <Users size={19} />
              <span>Your groups. Your opportunity.</span>
            </div>
            <div className="phone-send">
              <span>Your number. Your choice.</span>
              <Send size={19} />
            </div>
            <div className="phone-home" />
          </div>
        </div>
        <div className="scene-float float-link">
          <span>
            <Link2 size={23} />
          </span>
          <strong>Connect your number</strong>
          <Check size={17} />
        </div>
        <div className="scene-float float-post">
          <span>
            <MessageCircle size={23} />
          </span>
          <div>
            <strong>Earn per confirmed post</strong>
            <small>Paid jobs are not open yet</small>
          </div>
        </div>
        <div className="scene-coin-stack">
          <i />
          <i />
          <i />
          <span>
            P<span>✦</span>
          </span>
        </div>
        <div className="scene-pebble pebble-one" />
        <div className="scene-pebble pebble-two" />
      </div>
    </div>
  );
}
