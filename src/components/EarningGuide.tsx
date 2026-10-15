import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Brand } from "./Brand";
import { CoinValue } from "./CoinValue";
import { EarningRates } from "./EarningRates";
import { EarningCalculator } from "./EarningHub";
import { api, type User } from "../api";
export function EarningGuide({
  path,
  user,
}: {
  path: string;
  user: User | null;
}) {
  const [ownedGroups, setOwnedGroups] = useState<any[]>([]);
  useEffect(() => {
    let current = true;
    if (user?.role === "EARNER")
      api("/earnings")
        .then((d) => {
          if (current) setOwnedGroups(d.groups);
        })
        .catch(() => {});
    return () => {
      current = false;
    };
  }, [user?.id]);
  const calculator = path === "/calculator",
    value = path === "/coin-value";
  return (
    <div className="earning-guide-page">
      <header className="wrap public-header">
        <Brand />
        <a className="btn btn-outline" href={user ? "#/app" : "#/"}>
          <ArrowLeft size={17} />
          {user ? "My workspace" : "Back to home"}
        </a>
      </header>
      <main id="main-content" className="wrap section">
        <nav aria-label="Earning guide" className="guide-tabs">
          {[
            ["/earnings", "How earning works"],
            ["/coin-value", "Coin value"],
            ["/calculator", "My group calculator"],
          ].map(([href, label]) => (
            <a
              className={path === href ? "active" : ""}
              aria-current={path === href ? "page" : undefined}
              key={href}
              href={"#" + href}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="guide-intro">
          <span className="eyebrow">REAL RULES. CLEAR NUMBERS.</span>
          <h1>
            {calculator
              ? "What could your groups earn?"
              : value
                ? "Your Coins, in your currency."
                : "Your groups. Your earning potential."}
          </h1>
          <p>
            {calculator
              ? "Use your actual group sizes or explore a daily example. This is planning, not money already earned."
              : value
                ? "Start with the US-dollar equivalent, then see naira and other currencies. Displaying dollars does not change what a Coin is backed by."
                : "Pair your own WhatsApp. Check the groups you can post to. When verified funded work opens, confirmed campaign posts can earn Coins—even when nobody clicks or joins."}
          </p>
        </div>
        <div className="notice warning">
          <p>
            <strong>Paid work and cashout are not open yet.</strong> Pairing,
            personal posts and calculator examples do not create earnings. Group
            status and chat permissions are decided by WhatsApp; no separate
            admin-approval command is required for new native posts. Banned or
            removed groups stay blocked.
          </p>
        </div>
        {calculator ? (
          <EarningCalculator ownedGroups={ownedGroups} />
        ) : (
          <>
            <CoinValue />
            <EarningRates calculatorHref="#/calculator" />
            <section className="panel guide-conditions">
              <h2>Before you count it as income</h2>
              <p>
                Only confirmed posts in funded paid campaigns earn. Groups below
                100 members earn zero. Two connected numbers share one wallet,
                and shared groups count once per post type. Ten distinct paid
                campaigns per day is a capacity limit, not promised work; there
                is no 100-group earning ceiling. Native WhatsApp restrictions
                still apply. Uncertain sends are not automatically retried.
              </p>
              <p>
                Referral reward: 100 Coins once after a friend’s first
                qualifying funded delivery. The welcome bonus is 200 locked
                Coins. First cashout requires at least 300 earned + 200 bonus =
                500 Coins. Later cashouts require 500 earned Coins. Payout
                methods, supported countries, final conversion quotes and fees
                are not live or promised.
              </p>
              <a className="btn btn-primary" href="#/calculator">
                Calculate with my groups <ArrowRight size={18} />
              </a>
            </section>
          </>
        )}
      </main>
      <footer className="wrap guide-footer">
        <a href="#/rules">Full platform rules</a>
        <a href="#/privacy">Privacy</a>
        <a href="#/status">What is available now?</a>
      </footer>
    </div>
  );
}
