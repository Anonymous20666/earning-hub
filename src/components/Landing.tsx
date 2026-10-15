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
    "₦5 = 5.000 Coins. It stays pending until the referred worker pairs a number and completes their first verified qualifying campaign delivery. Paid broadcasting is not enabled yet.",
  ],
  [
    "What is Pappy Earning Hub?",
    "A marketplace being built to connect advertisers with workers who distribute approved WhatsApp and Telegram campaigns. Accounts, campaign planning and support are available. Live delivery and payouts are not yet enabled.",
  ],
  [
    "Can I earn or withdraw money right now?",
    "Not yet. Messaging and payout integrations are not connected. Your dashboard shows only actual account records. We do not generate simulated earnings or promise a launch date.",
  ],
  [
    "How does the 200 Coin welcome bonus work?",
    "Worker registration adds 200.000 locked Coins. It is not cash you can withdraw immediately. Your first payout requires at least 300.000 earned Coins and a minimum total of 500.000 Coins. Later payouts require 500.000 earned Coins. Payouts remain unavailable until the payment service is configured.",
  ],
  [
    "How are group rewards calculated?",
    "A group needs at least 100 members and permission to post. Each unique successful group earns min(members, 1,000) ÷ 1,000 Coins. One group is enough and there is no 100-group earning cap. Up to two numbers may belong to one owner; shared groups count once per campaign. Real rewards require verified delivery and cash-backed campaigns. 1 Coin = ₦1 worldwide.",
  ],
  [
    "What does a campaign estimate include?",
    "It uses the project’s existing pricing model to help plan your campaign. Conversion rates and operating costs have not been validated. An estimate is not a final price, a charge, or a guarantee of reach or joins.",
  ],
  [
    "Will you send messages without permission?",
    "Campaigns must respect community rules, recipient consent and the relevant platform policies. Messaging automation is disabled pending a supported, reviewed integration. Never share your WhatsApp security code or password.",
  ],
];
export function Landing({ user }: { user: User | null }) {
  const [menu, setMenu] = useState(false),
    [audience, setAudience] = useState<"worker" | "advertiser">("worker");
  const scroll = (id: string) => {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <div className="landing">
      <div className="announcement">
        <span className="status-dot" /> THE NEXT CHAPTER OF COMMUNITY GROWTH{" "}
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
            For workers & brands
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
              <span className="little-line" /> BUILT AROUND REAL CONNECTIONS
            </div>
            <h1>
              Good communities.
              <br />
              Greater <span className="serif-word">possibilities.</span>
            </h1>
            <p className="hero-description">
              A better way for brands to reach communities.
              <br className="desktop-break" /> A clearer path for workers to
              share in the value.
            </p>
            <div className="hero-actions">
              <ArrowLink href="#/join/worker">Join as a worker</ArrowLink>
              <a href="#/join/advertiser" className="button button-outline">
                Plan a campaign
                <ArrowUpRight size={18} />
              </a>
            </div>
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
          <div
            className="hero-visual"
            aria-label="Illustration of how brands and communities connect, not live performance data"
          >
            <div className="diagram-label">
              <span className="status-dot" /> THE COMMUNITY CONNECTION
            </div>
            <svg
              className="network-lines"
              viewBox="0 0 520 470"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M260 230C260 140 120 170 100 105M260 230C350 230 390 160 428 125M260 230C240 310 130 300 108 365M260 230C330 230 380 310 410 360"
                stroke="#bfd3be"
                strokeWidth="1.5"
              />
              <circle
                cx="260"
                cy="230"
                r="106"
                stroke="#dce5d9"
                strokeDasharray="3 8"
              />
              <circle cx="260" cy="230" r="166" stroke="#e5ebe0" />
              <path
                d="M100 105L108 365M428 125L410 360"
                stroke="#e5ebe0"
                strokeDasharray="4 8"
              />
            </svg>
            <div className="connection-node node-brand">
              <span className="node-icon">
                <Layers />
              </span>
              <div>
                <strong>Ambitious brands</strong>
                <small>Find your audience</small>
              </div>
              <ArrowUpRight size={15} />
            </div>
            <div className="connection-node node-wa">
              <span className="node-icon wa">
                <MessageCircle />
              </span>
              <div>
                <strong>WhatsApp</strong>
                <small>Community campaigns</small>
              </div>
            </div>
            <div className="connection-center">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 19V5h7a4 4 0 0 1 0 8h-3M10 9h3M10 15v4"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
              <span>pappy</span>
            </div>
            <div className="connection-node node-worker">
              <span className="node-icon">
                <Coins />
              </span>
              <div>
                <strong>Community workers</strong>
                <small>Value for your contribution</small>
              </div>
            </div>
            <div className="connection-node node-tg">
              <span className="node-icon tg">
                <Send />
              </span>
              <div>
                <strong>Telegram</strong>
                <small>Grow with intention</small>
              </div>
            </div>
            <span className="diagram-caption">
              One ecosystem. Shared opportunity.
            </span>
            <span className="illustration-tag">
              PLATFORM CONCEPT · NOT LIVE DATA
            </span>
          </div>
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
                Two sides.
                <br />
                One better ecosystem.
              </h2>
            </div>
            <p>
              Communities aren’t just numbers. We’re building a marketplace that
              makes the contribution—and the conditions—clear for everyone.
            </p>
          </div>
          <div className="audience-grid">
            <article className="audience-card worker-card">
              <span className="card-index">FOR THE COMMUNITY BUILDERS</span>
              <div className="audience-icon">
                <Coins size={28} />
              </div>
              <h3>
                Your contribution
                <br />
                should count.
              </h3>
              <p>
                Create your worker account, understand the reward rules, and get
                ready for approved community campaigns.
              </p>
              <ul>
                <li>
                  <Check />
                  200.000 Coin locked welcome bonus
                </li>
                <li>
                  <Check />
                  Separate earned and locked balances
                </li>
                <li>
                  <Check />
                  Clear qualification and payout conditions
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
                  Less guesswork.
                  <br />A clearer way forward.
                </h2>
              </div>
              <div className="segmented" aria-label="Choose a journey">
                <button
                  className={audience === "worker" ? "selected" : ""}
                  onClick={() => setAudience("worker")}
                  aria-pressed={audience === "worker"}
                >
                  I’m a worker
                </button>
                <button
                  className={audience === "advertiser" ? "selected" : ""}
                  onClick={() => setAudience("advertiser")}
                  aria-pressed={audience === "advertiser"}
                >
                  I’m an advertiser
                </button>
              </div>
            </div>
            <div className="steps-grid">
              {(audience === "worker"
                ? [
                    [
                      "Make it yours",
                      "Create your account. Your locked bonus and earned balance stay separate from day one.",
                    ],
                    [
                      "Know the conditions",
                      "Understand qualified groups, delivery requirements and withdrawal thresholds before taking part.",
                    ],
                    [
                      "Be ready for launch",
                      "Pairing and earning will open only when real integrations are ready. No simulated activity.",
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
