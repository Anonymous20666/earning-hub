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
  MessageCircle,
  Send,
  ShieldCheck,
  Coins,
  Layers,
  Lock,
  Eye,
  Globe2,
} from "lucide-react";
import { Brand, ArrowLink } from "./Brand";
import { User } from "../api";

const faqs = [
  [
    "What is the referral reward?",
    "Invite a friend. You get 5 Coins (₦5) only after they connect their number and complete their first confirmed paid post in a group with 100+ members. Signing up or sending their own posts does not count. Paid jobs are not open yet.",
  ],
  [
    "What is Pappy Earning Hub?",
    "Pappy helps you connect your own WhatsApp and share posts with groups that allow them. Your own posts are free. Businesses can save ad plans. Paid jobs and withdrawals are not open yet.",
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
    "Small groups can receive posts, but groups below 100 members earn no paid reward. For paid work, 100 members earn 0.100 Coins, 742 earn 0.742 Coins and 1,000 or more earn 1 Coin per confirmed post. A status post and a chat post are checked separately. Shared groups count once per post type. Your own posts never earn Coins. 1 Coin = ₦1. Paid jobs are not open yet.",
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
  const scroll = (id: string) => {
    setMenu(false);
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  };
  return (
    <div className="landing landing-v4">
      <div className="announcement">
        <span className="status-dot" /> YOUR WHATSAPP. YOUR GROUPS. YOUR CHOICE.{" "}
        <span className="announcement-tag">Pre-launch</span>
      </div>
      <header className="public-header wrap">
        <Brand />
        <nav
          aria-label="Main navigation"
          className={menu ? "public-nav open" : "public-nav"}
        >
          <button onClick={() => scroll("how-it-works")}>How it works</button>
          <button onClick={() => scroll("two-sides")}>
            For you & businesses
          </button>
          <button onClick={() => scroll("the-rules")}>The rules</button>
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
              <span className="little-line" /> SIMPLE STEPS. YOUR OWN WHATSAPP.
            </div>
            <h1>
              One post.
              <br />
              <span className="serif-word">Your WhatsApp</span>
              <br />
              groups.
            </h1>
            <p className="hero-description">
              Connect your number. Choose your groups.
              <br className="desktop-break" /> Share your message—with
              permission.
            </p>
            <div className="hero-actions">
              <ArrowLink href={user ? "#/app/connections" : "#/join/worker"}>
                Connect my WhatsApp
              </ArrowLink>
              <button
                className="button button-outline"
                onClick={() => scroll("how-it-works")}
              >
                Show me how
                <ArrowRight size={18} />
              </button>
            </div>
            <p className="hero-availability">
              Your own posts are free. Paid jobs and withdrawals are not open
              yet.
            </p>
            <div className="hero-footnote">
              <Lock size={14} />
              <span>
                200 Coin locked worker bonus.{" "}
                <button onClick={() => scroll("the-rules")}>
                  See the conditions
                </button>
              </span>
            </div>
          </div>
          <LiveScene />
        </section>
        <div className="principle-strip">
          <div className="wrap">
            <span>
              <Eye size={18} /> Clear rules, up front
            </span>
            <span>
              <ShieldCheck size={18} /> No invented earnings
            </span>
            <span>
              <Layers size={18} /> Built for both sides
            </span>
            <span>
              <Globe2 size={18} /> WhatsApp & Telegram focus
            </span>
          </div>
        </div>
        <section className="section wrap" id="two-sides">
          <div className="section-heading">
            <div>
              <div className="eyebrow">01 / SHARED VALUE</div>
              <h2>
                For you. For businesses.
                <br />
                Made for real people.
              </h2>
            </div>
            <p>
              Use your own WhatsApp to share posts with your groups. Businesses
              can plan ads for when paid campaigns open.
            </p>
          </div>
          <div className="audience-grid">
            <article className="audience-card worker-card">
              <span className="card-index">FOR THE COMMUNITY BUILDERS</span>
              <div className="audience-icon">
                <Coins size={28} />
              </div>
              <h3>
                Your groups.
                <br />
                Your message.
              </h3>
              <p>
                Connect your WhatsApp and send your own posts for free. Small
                groups are welcome too. You need the group admin’s permission.
              </p>
              <ul>
                <li>
                  <Check />
                  200.000 Coin locked welcome bonus
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
              <a href="#/join/worker" className="card-link">
                Create a worker account
                <ArrowUpRight />
              </a>
            </article>
            <article className="audience-card advertiser-card">
              <span className="card-index">FOR THE BRANDS WITH AMBITION</span>
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
              <a href="#/join/advertiser" className="card-link">
                Create an advertiser account
                <ArrowUpRight />
              </a>
            </article>
          </div>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="wrap section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">02 / YOUR FIRST STEPS</div>
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
                  I want to post
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
                      "Connect your WhatsApp",
                      "Create an account. Open My WhatsApp and get a connection code. Enter it in your own WhatsApp app.",
                    ],
                    [
                      "Choose your groups",
                      "Tap Find my groups. Small groups are welcome. Ask the group admin for permission before posting.",
                    ],
                    [
                      "Send your post",
                      "Open Send a post. Write your message, add a link and choose group status, group chat or both. Your own posts are free and do not earn Coins.",
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
                      "Live delivery is not enabled yet. Your draft is saved without a charge or a delivery promise.",
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
        <section className="section wrap" id="the-rules">
          <div className="rules-layout">
            <div>
              <div className="eyebrow">03 / CLARITY IS THE STANDARD</div>
              <h2>
                Understand the value.
                <br />
                <span className="serif-word">Know the conditions.</span>
              </h2>
              <p className="section-description">
                No instant-cash promises. No made-up results. Here are the
                documented worker rules, before you create an account.
              </p>
              <a href="#/rules" className="inline-link">
                Read the full platform rules
                <ArrowRight size={17} />
              </a>
            </div>
            <div className="rules-panel">
              <div className="rule-row">
                <span>Coin reference value</span>
                <strong>1 Coin = ₦1</strong>
              </div>
              <div className="rule-row">
                <span>
                  Worker welcome bonus
                  <small>Locked, not immediately withdrawable</small>
                </span>
                <strong>
                  200.000<small>Coins</small>
                </strong>
              </div>
              <div className="rule-row">
                <span>
                  First payout threshold
                  <small>300 earned + 200 locked bonus</small>
                </span>
                <strong>
                  500.000<small>Coins minimum</small>
                </strong>
              </div>
              <div className="rule-row">
                <span>
                  Later payouts<small>From earned balance only</small>
                </span>
                <strong>
                  500.000<small>Coins minimum</small>
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
        <section className="faq-section wrap" id="faq">
          <div>
            <div className="eyebrow">04 / GOOD QUESTIONS</div>
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
              Start with a connection.
              <br />
              Build toward more.
            </h2>
          </div>
          <div>
            <ArrowLink href="#/join/worker">Find your place</ArrowLink>
            <p>Free account. Clear conditions. No income guarantees.</p>
          </div>
        </section>
      </main>
      <footer className="public-footer wrap">
        <div>
          <Brand />
          <p>Community. Contribution. Possibility.</p>
        </div>
        <div className="footer-links">
          <a href="#/rules">Platform rules</a>
          <a href="#/privacy">Privacy notice</a>
          <a href="#/status">Service status</a>
          <a href="#/login">Account & support</a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Pappy Earning Hub</span>
          <span>Pre-launch · Built with intention</span>
        </div>
      </footer>
    </div>
  );
}
