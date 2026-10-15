import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Link2,
  Users,
  Send,
  HelpCircle,
} from "lucide-react";
import { api } from "../api";
export function QuickStart({ revision = 0 }: { revision?: number }) {
  const [state, setState] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    Promise.all([api("/whatsapp"), api("/broadcasts")])
      .then(([wa, posts]) => {
        if (current) setState({ wa, posts });
      })
      .catch(() => {
        if (current)
          setError(
            "We could not check your WhatsApp. Open My WhatsApp to try again.",
          );
      });
    return () => {
      current = false;
    };
  }, [revision]);
  const online = state?.wa.slots.some((s: any) => s.status === "ONLINE"),
    saved = state?.wa.slots.some((s: any) => s.account_id),
    groups = state?.posts.groups || [],
    unique = new Set(groups.map((g: any) => g.group_jid)).size;
  const approved = groups.some(
    (g: any) =>
      g.status === "ONLINE" &&
      !g.excluded &&
      !g.revoked_at &&
      g.expires_at > new Date().toISOString() &&
      (g.status_allowed || (g.chat_allowed && g.mentions_allowed)),
  );
  const action = !online
    ? saved
      ? "Reconnect WhatsApp"
      : "Connect my WhatsApp"
    : !unique
      ? "Find my groups"
      : approved
        ? "Explore earning rates"
        : "Check group permission";
  const link =
    !online || !unique
      ? "#/app/connections"
      : approved
        ? "#/app/calculator"
        : "#/app/broadcasts";
  return (
    <section className="quick-start" aria-labelledby="quick-start-title">
      <div className="quick-start-top">
        <div>
          <span className="eyebrow">START HERE</span>
          <h2 id="quick-start-title">
            {!state
              ? "Let’s get you ready."
              : online
                ? "Your WhatsApp is connected."
                : "Connect WhatsApp to start."}
          </h2>
          <p>
            {!state
              ? error || "Checking your connection…"
              : online
                ? `${unique} ${unique === 1 ? "group found" : "groups found"}. Check which groups qualify for future paid work.`
                : "Start with your own number. Then check group eligibility for future paid work. Pairing alone does not pay."}
          </p>
        </div>
        <span className={`quick-status ${online ? "connected" : ""}`}>
          <span />
          {!state ? "Checking" : online ? "Connected" : "Not connected"}
        </span>
      </div>
      <div className="quick-steps">
        {[
          {
            n: 1,
            icon: Link2,
            title: "Connect WhatsApp",
            text: online
              ? "Your number is ready."
              : "Get a code here. Enter it in WhatsApp.",
            href: "#/app/connections",
            done: online,
          },
          {
            n: 2,
            icon: Users,
            title: "Check group permission",
            text: unique
              ? `${unique} found. Ask the group admin for permission.`
              : "Find your groups and get the admin’s permission.",
            href: unique ? "#/app/broadcasts" : "#/app/connections",
            done: approved,
          },
          {
            n: 3,
            icon: Send,
            title: "Understand your earning potential",
            text: "See exact reward rates. Paid jobs and cashout are not open yet.",
            href: "#/app/calculator",
            done: false,
          },
        ].map((step) => (
          <a
            href={step.href}
            className={`quick-step ${step.done ? "done" : ""}`}
            key={step.n}
          >
            <span className="quick-step-number">
              {step.done ? <Check size={19} /> : step.n}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
            <ArrowRight size={20} />
          </a>
        ))}
      </div>
      <div className="quick-start-bottom">
        <a className="button" href={link}>
          {state ? action : "Open My WhatsApp"}
          <ArrowRight size={19} />
        </a>
        <p>
          <HelpCircle size={18} />
          <span>
            Groups need 100+ members and permission for paid rewards. One
            eligible group is enough. Pairing and your own posts never earn
            Coins.
          </span>
        </p>
      </div>
      <div className="quick-free-extra">
        <Send size={18} />
        <p>
          <strong>Want to send your own post too?</strong> Personal broadcasts
          are free and separate from paid work.
        </p>
        <a href="#/app/broadcasts">
          Send a free personal post
          <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}
