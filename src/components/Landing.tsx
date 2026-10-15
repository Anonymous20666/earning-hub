import { EarningRates } from "./EarningRates";
import { EarningPotential } from "./EarningPotential";
import { LiveScene } from "./LiveScene";
import React, { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Plus,
  Minus,
  Menu,
  X,
  Send,
  ShieldCheck,
  Coins,
  Lock,
  Users,
} from "lucide-react";
import { Brand, ArrowLink } from "./Brand";
import { User } from "../api";

const faqs = [
  [
    "What is Pappy Earning Hub?",
    "Pappy is built to help group owners earn Coins from approved, funded posts in their WhatsApp groups. Start by connecting your own number and checking group eligibility. Pairing alone does not pay. Paid jobs and withdrawals are not open yet; free personal broadcasting is available separately.",
  ],
  [
    "What is the referral reward?",
    "Invite a friend. You can earn 100 Coins only after they connect their number and complete their first confirmed paid post in a group with 100+ members. Signing up or sending their own posts does not count. Paid jobs are not open yet.",
  ],
  [
    "Can I earn or withdraw money right now?",
    "No. Paid jobs and withdrawals are not open yet. You can still connect your WhatsApp and send your own posts for free. Those posts do not earn Coins.",
  ],
  [
    "How does the 200 Coin welcome bonus work?",
    "You start with 200 locked Coins. You cannot withdraw them now. For your first withdrawal, you need 300 earned Coins plus the 200 bonus, making at least 500 Coins. For later withdrawals, you need at least 500 earned Coins. Withdrawals are not open yet.",
  ],
  [
    "How are group rewards calculated?",
    "Small groups can receive posts, but groups below 100 members earn no paid reward. For paid work, 100 members earn 0.100 Coins, 742 earn 0.742 Coins and 1,000 or more earn 1 Coin per confirmed post. A status post and a chat post are checked separately. Shared groups count once per post type. Your own posts never earn Coins. Paid jobs are not open yet.",
  ],
  [
    "What does a campaign estimate include?",
    "It uses the project’s existing pricing model to help plan your campaign. Conversion rates and operating costs have not been validated. An estimate is not a final price, a charge, or a guarantee of reach or joins.",
  ],
  [
    "Will you send messages without permission?",
    "No post is queued without your choice. Your groups must allow it, and you need the admin’s permission. Never share your WhatsApp login code or PIN. Only enter the connection code from this website inside your own WhatsApp app.",
  ],
];
export function Landing({ user }: { user: User | null }) {
  const [menu, setMenu] = useState(false),
    [audience, setAudience] = useState<"worker" | "advertiser">("worker");
  const worker = user?.role === "EARNER";
  const connectHref = !user
    ? "#/join/worker"
    : worker
      ? "#/app/connections"
      : "#/app";
  const connectLabel =
    user && !worker ? "Open my workspace" : "Connect my WhatsApp";
  const personalHref = !user
    ? "#/join/worker"
    : worker
      ? "#/app/broadcasts"
      : "#/app";
  const scroll = (id: string) => {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  return (
    <div className="landing landing-v4 landing-v5">
      <div className="announcement">
        <span className="status-dot" /> YOUR WHATSAPP. YOUR GROUPS. YOUR EARNING
        POTENTIAL. <span className="announcement-tag">Pre-launch</span>
      </div>
      <header className="public-header wrap">
        <Brand />
        <nav
          aria-label="Main navigation"
          className={menu ? "public-nav open" : "public-nav"}
        >
          <button onClick={() => scroll("earning-rates")}>Reward rates</button>
          <button onClick={() => scroll("how-it-works")}>How to earn</button>
          <button onClick={() => scroll("free-broadcasts")}>
            Free broadcasting
          </button>
          <button onClick={() => scroll("business-tools")}>
            For businesses
          </button>
          <button onClick={() => scroll("faq")}>FAQs</button>
        </nav>
        <div className="header-actions">
          <a className="text-link" href={user ? "#/app" : "#/login"}>
            {user ? "My workspace" : "Log in"}
            <ArrowUpRight size={15} />
          </a>
          <ArrowLink href={user ? "#/app" : "#/join/worker"} className="small">
            Get started
          </ArrowLink>
          <button
            className="icon-button mobile-toggle"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main-content">
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="little-line" /> CONNECT YOUR NUMBER. PREPARE YOUR
              GROUPS.
            </div>
            <h1>
              Connect your
              <br />
              WhatsApp.
              <br />
              <span className="serif-word">Get ready to earn.</span>
            </h1>
            <p className="hero-description">
              Earn Coins from approved, funded posts in your WhatsApp groups.
              Start by pairing your own number and checking which groups
              qualify.
            </p>
            <div className="hero-actions">
              <ArrowLink href={connectHref}>{connectLabel}</ArrowLink>
              <button
                className="button button-outline"
                onClick={() => scroll("earning-rates")}
              >
                See what I could earn
                <ArrowRight size={18} />
              </button>
            </div>
            <p className="hero-availability">
              Paid jobs and withdrawals are not open yet. Pairing your number
              does not earn Coins.
            </p>
            <div className="hero-footnote">
              <Users size={16} />
              <span>
                100+ members for paid group rewards. One qualifying group is
                enough.
              </span>
            </div>
          </div>
          <LiveScene />
        </section>
        <div className="principle-strip">
          <div className="wrap">
            <span>
              <Coins size={18} />
              Paid per confirmed post
            </span>
            <span>
              <Users size={18} />
              One eligible group is enough
            </span>
            <span>
              <ShieldCheck size={18} />
              Permission and funding first
            </span>
            <span>
              <Lock size={18} />
              Pairing alone does not pay
            </span>
          </div>
        </div>
        <EarningRates
          calculatorHref={
            !user ? "#/join/worker" : worker ? "#/app/calculator" : "#/app"
          }
        />
        <section className="how-section" id="how-it-works">
          <div className="wrap section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">YOUR PATH TO PAID WORK</div>
                <h2>
                  Three steps.
                  <br />
                  We’ll guide you.
                </h2>
              </div>
              <div className="segmented" aria-label="Choose a journey">
                <button
                  className={audience === "worker" ? "selected" : ""}
                  onClick={() => setAudience("worker")}
                  aria-pressed={audience === "worker"}
                >
                  I want to earn
                </button>
                <button
                  className={audience === "advertiser" ? "selected" : ""}
                  onClick={() => setAudience("advertiser")}
                  aria-pressed={audience === "advertiser"}
                >
                  I want to plan an ad
                </button>
              </div>
            </div>
            <div className="steps-grid">
              {(audience === "worker"
                ? [
                    [
                      "Pair your own WhatsApp",
                      "Create an account. Open My WhatsApp and get a connection code. Enter it in your own WhatsApp app.",
                    ],
                    [
                      "Check group permission",
                      "Tap Find my groups and get the admin’s permission. Groups need at least 100 members to earn from paid work. Pairing and permission alone do not create earnings.",
                    ],
                    [
                      "Earn from confirmed paid posts",
                      "When funded jobs open, approved campaign posts can earn Coins in eligible groups. Each successful status or chat post is confirmed separately. Paid jobs and cashout are not open yet.",
                    ],
                  ]
                : [
                    [
                      "Set your direction",
                      "Choose WhatsApp or Telegram, your campaign destination and your intended audience.",
                    ],
                    [
                      "Build your campaign",
                      "Write your message, explore a planning estimate and save your campaign as a draft.",
                    ],
                    [
                      "Launch when ready",
                      "Paid campaign launch is not open yet. Your draft is saved without a charge or a delivery promise.",
                    ],
                  ]
              ).map(([title, body], i) => (
                <article className="step" key={title}>
                  <span className="step-number">0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <div className="wrap">
          <EarningPotential />
        </div>
        <section className="section wrap" id="the-rules">
          <div className="rules-layout">
            <div>
              <div className="eyebrow">
                YOUR REFERRALS, BONUS & FUTURE CASHOUT
              </div>
              <h2>
                Understand the value.
                <br />
                <span className="serif-word">Know the conditions.</span>
              </h2>
              <p className="section-description">
                Earn 100 Coins for each qualifying referral, after their first
                eligible funded delivery—not just signup. Your 200-Coin welcome
                bonus starts locked. Cashout is not open yet.
              </p>
              <a href="#/rules" className="inline-link">
                Read the full platform rules
                <ArrowRight size={17} />
              </a>
            </div>
            <div className="rules-panel">
              <div className="rule-row">
                <span>
                  Referral reward
                  <small>
                    After a friend’s first qualifying funded delivery
                  </small>
                </span>
                <strong>100 Coins</strong>
              </div>
              <div className="rule-row">
                <span>
                  Worker welcome bonus
                  <small>Locked, not immediately withdrawable</small>
                </span>
                <strong>
                  200<small>Coins</small>
                </strong>
              </div>
              <div className="rule-row">
                <span>
                  Future first cashout threshold
                  <small>300 earned + 200 locked bonus</small>
                </span>
                <strong>
                  500<small>Coins minimum</small>
                </strong>
              </div>
              <div className="rule-row">
                <span>
                  Later cashout threshold<small>From earned balance only</small>
                </span>
                <strong>
                  500<small>Coins minimum</small>
                </strong>
              </div>
              <div className="rule-note">
                <Lock size={16} />
                <p>
                  Earning, payments and payouts are not live. These are platform
                  rules, not a guarantee of income.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="section wrap" id="two-sides">
          <div className="section-heading">
            <div>
              <div className="eyebrow">MORE YOU CAN DO WITH PAPPY</div>
              <h2>
                Here to share a post too?
                <br />
                You can do that for free.
              </h2>
            </div>
            <p>
              Share your own announcements, links and media at no cost. Personal
              posts earn no Coins and stay separate from paid campaigns.
              Businesses can prepare campaign drafts too.
            </p>
          </div>
          <div className="audience-grid">
            <article className="audience-card worker-card" id="free-broadcasts">
              <span className="card-index">FREE PERSONAL BROADCASTING</span>
              <div className="audience-icon">
                <Send size={28} />
              </div>
              <h3>
                Your message.
                <br />
                All permitted groups.
              </h3>
              <p>
                Connect your WhatsApp and send your own posts for free. Small
                groups are welcome too. You need the group admin’s permission.
              </p>
              <ul>
                <li>
                  <Check />
                  Text, links or media with your own caption
                </li>
                <li>
                  <Check />
                  Your own posts are always separate from paid work
                </li>
                <li>
                  <Check />
                  Groups under 100 members can get posts, but earn no paid
                  reward
                </li>
              </ul>
              <a href={personalHref} className="card-link">
                {user && !worker
                  ? "Open my workspace"
                  : "Start a free personal post"}
                <ArrowUpRight />
              </a>
            </article>
            <article
              className="audience-card advertiser-card"
              id="business-tools"
            >
              <span className="card-index">
                FOR BUSINESSES · CAMPAIGN PLANNING
              </span>
              <div className="audience-icon">
                <ArrowUpRight size={28} />
              </div>
              <h3>
                Reach people.
                <br />
                Not just impressions.
              </h3>
              <p>
                Plan community-first campaigns across WhatsApp and Telegram,
                with your destination, message and audience in one place.
              </p>
              <ul>
                <li>
                  <Check />
                  Save and revisit campaign drafts
                </li>
                <li>
                  <Check />
                  Explore transparent planning estimates
                </li>
                <li>
                  <Check />
                  Choose your platform and target countries
                </li>
              </ul>
              <a
                href={
                  user?.role === "ADVERTISER"
                    ? "#/app/campaigns"
                    : "#/join/advertiser"
                }
                className="card-link"
              >
                {user?.role === "ADVERTISER"
                  ? "Open my campaigns"
                  : "Create an advertiser account"}
                <ArrowUpRight />
              </a>
            </article>
          </div>
        </section>
        <section className="faq-section wrap" id="faq">
          <div>
            <div className="eyebrow">BEFORE YOU GET STARTED</div>
            <h2>
              Let’s make
              <br />
              things clear.
            </h2>
            <p>
              Know what’s available.
              <br />
              Know what comes next.
            </p>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus size={18} className="faq-plus" />
                  <Minus size={18} className="faq-minus" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="wrap closing">
          <div>
            <div className="eyebrow">BUILD YOUR NEXT CHAPTER</div>
            <h2>
              Your next step?
              <br />
              Connect your WhatsApp.
            </h2>
          </div>
          <div>
            <ArrowLink href={connectHref}>{connectLabel}</ArrowLink>
            <p>
              Free account. Pairing alone does not pay. Paid jobs are not open
              yet.
            </p>
          </div>
        </section>
      </main>
      <footer className="public-footer wrap">
        <div>
          <Brand />
          <p>Connect your WhatsApp. Prepare to earn.</p>
        </div>
        <div className="footer-links">
          <a href="#/rules">Platform rules</a>
          <a href="#/privacy">Privacy notice</a>
          <a href="#/status">Service status</a>
          <a href="#/login">Account & support</a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Pappy Earning Hub</span>
          <span>Pre-launch · Paid jobs not open yet</span>
        </div>
      </footer>
    </div>
  );
}
