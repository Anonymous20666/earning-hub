import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Check, Link2, Users } from "lucide-react";
export function LiveScene() {
  const root = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(
    () =>
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !(navigator as any).connection?.saveData,
  );
  // A brief decorative entrance settles automatically; no playback controls or consent prompts.
  useEffect(() => {
    if (!moving) return;
    const timer = setTimeout(() => setMoving(false), 4500);
    return () => clearTimeout(timer);
  }, [moving]);
  const [visible, setVisible] = useState(true),
    [inView, setInView] = useState(true);
  useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", changed);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
      onReduced = () => {
        setMoving(!reduced.matches && !(navigator as any).connection?.saveData);
      };
    reduced.addEventListener("change", onReduced);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
        : null;
    if (root.current) observer?.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", changed);
      reduced.removeEventListener("change", onReduced);
      observer?.disconnect();
    };
  }, []);
  return (
    <div
      className={`live-hero-scene ${moving && visible && inView ? "is-playing" : "is-paused"}`}
      ref={root}
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
              Ready when
              <br />
              you are.
            </div>
            <div className="phone-message">
              <span className="phone-message-icon">
                <MessageCircle size={22} />
              </span>
              <div>
                <strong>Your next post</strong>
                <span>A message worth sharing.</span>
              </div>
            </div>
            <div className="phone-groups">
              <Users size={19} />
              <span>Your groups. One message.</span>
            </div>
            <div className="phone-send">
              <span>Share with permission</span>
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
            <strong>Small groups welcome</strong>
            <small>Posts for every group size</small>
          </div>
        </div>
        <div className="scene-pebble pebble-one" />
        <div className="scene-pebble pebble-two" />
      </div>
    </div>
  );
}
