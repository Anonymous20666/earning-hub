import { QuickStart } from "./QuickStart";
import { WhatsAppConnections, PersonalBroadcasts } from "./WhatsApp";
import { EarningHub, TreasuryPanel } from "./EarningHub";
import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Wallet,
  MessageCircle,
  Send,
  LifeBuoy,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  LogOut,
  ChevronRight,
  Coins,
  Lock,
  Check,
  Clock,
  Link2,
  FileText,
  RefreshCw,
  AlertCircle,
  X,
  Menu,
  Download,
  ShieldCheck,
  Activity,
  Trash2,
  Pencil,
  LoaderCircle,
  Globe2,
} from "lucide-react";
import { Brand } from "./Brand";
import { api, send, coins, money, coinValue, date, User, go } from "../api";
import type { LucideIcon } from "lucide-react";
import { DraftInput } from "../../shared/rules";

type WorkspaceData = {
  wallet: any;
  campaigns: any[];
  tickets: any[];
  ledger: any[];
  sessions: any[];
  deliveries: any[];
};
const emptyDraft: DraftInput = {
  title: "",
  targetUrl: "",
  caption: "",
  pathway: "SMART_VERIFIED",
  platform: "WA_GROUP",
  mode: "ALLSTATUS_1X",
  tier: "BRONZE",
  sessionCount: 1,
  volume: 100,
  countryFilter: "RANDOM",
  countries: [],
};
function Empty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const el = ref.current;
    el?.showModal();
    return () => {
      el?.close();
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
const services = [
  [
    "Accounts & sign-in",
    "Available",
    "Create an account, sign in, and update your profile.",
  ],
  [
    "Campaign planning",
    "Available",
    "Save, edit and estimate campaign drafts. No charges.",
  ],
  [
    "Earning plans & referrals",
    "Available",
    "Exact group-reward calculator, real referral links and pending-reward records. Paid delivery is off.",
  ],
  [
    "Support tickets",
    "Available",
    "Save requests and read staff replies in your workspace.",
  ],
  [
    "WhatsApp pairing & delivery",
    "Not configured",
    "No real pairing codes, broadcasts or verified delivery events.",
  ],
  [
    "Telegram delivery",
    "Not configured",
    "Bot credentials, webhook validation and delivery processing are required.",
  ],
  [
    "Payments & payouts",
    "Not configured",
    "No deposits, charges or withdrawals are processed.",
  ],
  [
    "Email & social sign-in",
    "Not configured",
    "Email verification, password reset delivery and Google sign-in are not enabled.",
  ],
  [
    "AI assistant",
    "Not configured",
    "No AI credentials are installed. Financial decisions do not depend on AI.",
  ],
];
export function ServiceStatus() {
  const [state, setState] = useState<any>(null);
  useEffect(() => {
    api("/status")
      .then(setState)
      .catch(() => {});
  }, []);
  const visible = services.map((item) =>
    item[0] === "WhatsApp pairing & delivery" && state?.whatsapp
      ? [
          item[0],
          "Owner-testing pilot",
          "Plogme pairing and authorised personal broadcasts are configured. Real-device behaviour needs validation; paid broadcasts remain off.",
        ]
      : item,
  );
  return (
    <div className="status-list">
      {visible.map(([title, status, body]) => (
        <div key={title}>
          <span
            className={`service-indicator ${status === "Available" ? "available" : ""}`}
          />
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
          <span
            className={`badge ${status === "Available" ? "green" : "neutral"}`}
          >
            {status}
          </span>
        </div>
      ))}
    </div>
  );
}
export function Workspace({
  user,
  path,
  onUser,
  onLogout,
}: {
  user: User;
  path: string;
  onUser: (u: User) => void;
  onLogout: () => Promise<void>;
}) {
  const page = path.split("/")[2] || "overview";
  const [data, setData] = useState<WorkspaceData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState(""),
    [navigationOpen, setNavigationOpen] = useState(false),
    [modal, setModal] = useState<"campaign" | "ticket" | null>(null),
    [editing, setEditing] = useState<any>(null),
    [deleting, setDeleting] = useState<string | null>(null),
    [logoutBusy, setLogoutBusy] = useState(false);
  const [earningRevision, setEarningRevision] = useState(0);
  const navigationRef = useRef<HTMLElement>(null),
    menuButtonRef = useRef<HTMLButtonElement>(null),
    closeMenuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!navigationOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      navigationRef.current?.getBoundingClientRect();
      closeMenuRef.current?.focus({ preventScroll: true });
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setNavigationOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        navigationRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [navigationOpen]);
  const worker = user.role === "EARNER",
    admin = user.role === "ADMIN";
  const nav: Array<[string, string, LucideIcon]> = [
    ["overview", "Overview", LayoutDashboard],
    ...(worker
      ? [
          ["wallet", "Wallet & rewards", Wallet],
          ["connections", "My WhatsApp", Link2],
          ["broadcasts", "Send a post", Send],
          ["calculator", "Earning calculator", Coins],
          ["referrals", "Referrals", Link2],
        ]
      : [["campaigns", "Campaigns", Send]]),
    ["support", "Support", LifeBuoy],
    ["settings", "Account settings", Settings],
    ...(admin
      ? [
          ["treasury", "Funding & campaigns", Wallet],
          ["admin", "Administration", ShieldCheck],
        ]
      : []),
  ] as Array<[string, string, LucideIcon]>;
  const currentNav = nav.find((x) => x[0] === page);
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api("/workspace"));
      setEarningRevision((n) => n + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, [user.id]);
  useEffect(() => {
    setNavigationOpen(false);
    setToast("");
    document.title = `${currentNav?.[1] || "Service status"} · Pappy Earning Hub`;
  }, [page]);
  const notify = (message: string) => {
    setToast(message);
  };
  const openCampaign = (c: any = null) => {
    setEditing(c);
    setModal("campaign");
  };
  const saveDone = async (message: string) => {
    setModal(null);
    notify(message);
    await refresh();
  };
  const wallet = data?.wallet;
  const titles: Record<string, [string, string]> = {
    overview: [
      `Welcome to Pappy.`,
      worker
        ? "Connect WhatsApp, write a post and share with all permitted groups."
        : "Turn a clear idea into a thoughtfully planned campaign.",
    ],
    wallet: [
      "My money.",
      "Your earned Coins and welcome bonus are shown separately.",
    ],
    connections: [
      "My WhatsApp.",
      "Connect your number here. You can use up to two numbers.",
    ],
    broadcasts: [
      "Send a post.",
      "Post to groups that have given permission. Your own posts are free.",
    ],
    calculator: [
      "Check group rewards.",
      "Try an example. This does not add Coins to your account.",
    ],
    referrals: [
      "Invite a friend.",
      "Share your link. See which rewards are waiting and which are earned.",
    ],
    treasury: [
      "Funding before promises.",
      "Verified cash, reserved budgets and earned obligations.",
    ],
    campaigns: [
      "Good growth starts with a plan.",
      "Create a campaign draft. Refine it. Come back when you’re ready.",
    ],
    support: [
      "My help requests.",
      "Ask a question here. Replies will show on this page.",
    ],
    settings: ["My account.", "Change your details and check your account."],
    status: ["What is ready?", "Check what you can use now."],
    admin: [
      "A clear view of the platform.",
      "Real users, support requests and recorded operations.",
    ],
  };
  const heading = titles[page];
  return (
    <div className={`app-shell ${worker ? "easy-workspace" : ""}`}>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside
        id="workspace-navigation"
        ref={navigationRef}
        className={`sidebar ${navigationOpen ? "sidebar-open" : ""}`}
        aria-hidden={!navigationOpen}
        inert={!navigationOpen}
        role={navigationOpen ? "dialog" : undefined}
        aria-modal={navigationOpen ? true : undefined}
        aria-label="Workspace menu"
        onTransitionEnd={(event) => {
          if (
            navigationOpen &&
            event.target === navigationRef.current &&
            !navigationRef.current?.contains(document.activeElement)
          )
            closeMenuRef.current?.focus({ preventScroll: true });
        }}
      >
        <div className="sidebar-brand">
          <Brand light />
          <button
            ref={closeMenuRef}
            className="icon-button mobile-close"
            onClick={() => setNavigationOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <div className="workspace-picker">
          <span className="workspace-avatar">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>
              {worker
                ? "Worker workspace"
                : admin
                  ? "Admin workspace"
                  : "Advertiser workspace"}
            </strong>
            <small>Personal account</small>
          </div>
          <span className="badge-dark">{worker ? "W" : admin ? "A" : "B"}</span>
        </div>
        <span className="sidebar-label">YOUR WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {nav.map(([id, label, Icon]) => (
            <a
              key={id}
              href={`#/app/${id}`}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {id === page && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="launch-note">
            <span>
              <span className="status-dot" />
              PRE-LAUNCH
            </span>
            <p>
              A real foundation.
              <br />
              More connections to come.
            </p>
            <a href="#/app/status">
              See what’s available
              <ArrowUpRight size={14} />
            </a>
          </div>
          <a className="status-nav" href="#/app/status">
            <Activity size={17} />
            Service status
          </a>
          <div className="sidebar-user">
            <span className="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              disabled={logoutBusy}
              onClick={async () => {
                setLogoutBusy(true);
                try {
                  await onLogout();
                } catch (e: any) {
                  notify(e.message);
                } finally {
                  setLogoutBusy(false);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {navigationOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation backdrop"
          tabIndex={-1}
          onClick={() => setNavigationOpen(false)}
        />
      )}
      <div className="app-content" inert={navigationOpen}>
        <header className="workspace-header">
          <div>
            <button
              ref={menuButtonRef}
              className="icon-button mobile-toggle"
              aria-controls="workspace-navigation"
              aria-label="Open navigation"
              aria-expanded={navigationOpen}
              onClick={() => setNavigationOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Workspace
              <ChevronRight size={14} />
              <strong>{currentNav?.[1] || "Service status"}</strong>
            </span>
          </div>
          <div>
            <span className="header-date">
              {new Date().toLocaleDateString("en-NG", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <span className="workspace-divider" />
            <a href="#/" className="text-link">
              Visit website
              <ArrowUpRight size={15} />
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="workspace-main">
          <div className="page-eyebrow">
            {page === "overview"
              ? `WELCOME BACK, ${user.name.split(" ")[0].toUpperCase()}`
              : "YOUR PAPPY WORKSPACE"}
            <span className="badge neutral">Pre-launch</span>
          </div>
          <div className="page-heading">
            <div>
              <h1>{heading?.[0] || "Page not found."}</h1>
              <p>
                {heading?.[1] ||
                  "Choose a page from your workspace navigation."}
              </p>
            </div>
            {page === "campaigns" || (page === "overview" && !worker) ? (
              <button className="button small" onClick={() => openCampaign()}>
                <Plus size={17} />
                New campaign
              </button>
            ) : page === "support" ? (
              <button
                className="button small"
                onClick={() => setModal("ticket")}
              >
                <Plus size={17} />
                New request
              </button>
            ) : (
              <button
                className="button button-white small"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? "spin" : ""} />
                Refresh
              </button>
            )}
          </div>
          {toast && (
            <div className="notice toast" role="status">
              <Check size={17} />
              {toast}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setToast("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button onClick={refresh}>Try again</button>
            </div>
          )}
          {loading && !data ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" />
              Loading your workspace…
            </div>
          ) : (
            data && (
              <>
                {page === "overview" && (
                  <>
                    {worker && <QuickStart revision={earningRevision} />}
                    <div className="workspace-banner">
                      <Lock size={21} />
                      <div>
                        <strong>
                          Paid jobs and withdrawals are not open yet.
                        </strong>
                        <p>
                          You can use your own WhatsApp to send free personal
                          posts. These posts do not earn money.
                        </p>
                      </div>
                      <a href="#/app/status">
                        What is available?
                        <ArrowRight size={16} />
                      </a>
                    </div>
                    {worker ? (
                      <div className="metric-grid">
                        <Metric
                          label="Earned balance"
                          value={coins(wallet?.earned_milli || 0)}
                          unit="Coins"
                          note="From confirmed paid posts only"
                          icon={Coins}
                          featured
                        />
                        <Metric
                          label="Locked welcome bonus"
                          value={coins(wallet?.locked_milli || 0)}
                          unit="Coins"
                          note="Not ready to withdraw"
                          icon={Lock}
                        />
                        <Metric
                          label="Total withdrawn"
                          value={coins(wallet?.withdrawn_milli || 0)}
                          unit="Coins"
                          note="Withdrawals are not open yet"
                          icon={ArrowUpRight}
                        />
                      </div>
                    ) : (
                      <div className="metric-grid">
                        <Metric
                          label="Campaign drafts"
                          value={String(data.campaigns.length).padStart(2, "0")}
                          note="Saved in your workspace"
                          icon={FileText}
                          featured
                        />
                        <Metric
                          label="Live campaigns"
                          value="00"
                          note="Delivery is not enabled"
                          icon={Send}
                        />
                        <Metric
                          label="Total charged"
                          value={coinValue(0)}
                          note="No payments processed"
                          icon={Wallet}
                        />
                      </div>
                    )}
                    {worker && (
                      <a className="earning-link" href="#/app/calculator">
                        <Coins size={20} />
                        <div>
                          <strong>How would my groups earn Coins?</strong>
                          <span>
                            Groups with 100+ members can earn from paid posts.
                            Smaller groups can receive posts for no reward.
                          </span>
                        </div>
                        <ArrowRight size={18} />
                      </a>
                    )}
                    {!worker && (
                      <>
                        {" "}
                        <div className="overview-grid">
                          <section className="panel next-steps">
                            <div className="panel-heading">
                              <div>
                                <span className="eyebrow">
                                  YOUR NEXT CHAPTER
                                </span>
                                <h2>
                                  {worker
                                    ? "A good place to begin."
                                    : "From idea to intention."}
                                </h2>
                              </div>
                              <span className="outlined-icon">
                                <ArrowUpRight />
                              </span>
                            </div>
                            <div className="checklist-row">
                              <span className="checklist-number done">
                                <Check size={15} />
                              </span>
                              <div>
                                <strong>Your account is ready</strong>
                                <p>
                                  Your {worker ? "worker" : "advertiser"}{" "}
                                  workspace is set up.
                                </p>
                              </div>
                              <span className="badge green">Done</span>
                            </div>
                            <a
                              className="checklist-row"
                              href={worker ? "#/app/wallet" : "#/app/campaigns"}
                            >
                              <span className="checklist-number">02</span>
                              <div>
                                <strong>
                                  {worker
                                    ? "Understand your reward rules"
                                    : "Build your first campaign draft"}
                                </strong>
                                <p>
                                  {worker
                                    ? "Know what is earned, locked and withdrawable."
                                    : "Choose a destination, a message and an audience."}
                                </p>
                              </div>
                              <ChevronRight size={18} />
                            </a>
                            <a className="checklist-row" href="#/app/status">
                              <span className="checklist-number">03</span>
                              <div>
                                <strong>
                                  {worker
                                    ? "Explore connection availability"
                                    : "Check launch availability"}
                                </strong>
                                <p>
                                  See which integrations are still being
                                  prepared.
                                </p>
                              </div>
                              <ChevronRight size={18} />
                            </a>
                          </section>
                          <section className="panel activity-panel">
                            <div className="panel-heading">
                              <h2>
                                {worker
                                  ? "The first milestone"
                                  : "Your campaign workspace"}
                              </h2>
                              <span className="badge neutral">
                                {worker ? "FIRST PAYOUT" : "DRAFTS"}
                              </span>
                            </div>
                            {worker ? (
                              <>
                                <div className="milestone-number">
                                  {coins(wallet?.earned_milli || 0)}
                                  <span> / 300.000 Coins earned</span>
                                </div>
                                <progress
                                  max={300000}
                                  value={wallet?.earned_milli || 0}
                                  aria-label="Earned progress towards first withdrawal"
                                />
                                <p>
                                  Earn 300.000 Coins to meet the first earned
                                  threshold. Add the 200.000 locked bonus for a
                                  minimum 500.000 Coin first cashout.
                                </p>
                                <a href="#/app/wallet" className="inline-link">
                                  Understand your wallet
                                  <ArrowRight size={16} />
                                </a>
                              </>
                            ) : (
                              <Empty
                                icon={FileText}
                                title={
                                  data.campaigns.length
                                    ? `${data.campaigns.length} saved draft${data.campaigns.length === 1 ? "" : "s"}`
                                    : "A blank page. A new opportunity."
                                }
                                action={
                                  <button
                                    className="inline-link"
                                    onClick={() =>
                                      data.campaigns.length
                                        ? go("/app/campaigns")
                                        : openCampaign()
                                    }
                                  >
                                    {data.campaigns.length
                                      ? "View your campaigns"
                                      : "Create your first draft"}
                                    <ArrowRight size={15} />
                                  </button>
                                }
                              >
                                Your campaign planning lives here. Nothing is
                                charged when you save a draft.
                              </Empty>
                            )}
                          </section>
                        </div>
                      </>
                    )}
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            {worker
                              ? "Recent wallet activity"
                              : "Recent campaign drafts"}
                          </h2>
                          <p>
                            {worker
                              ? "Your account’s Coin history."
                              : "Your most recently saved plans."}
                          </p>
                        </div>
                        <a
                          className="inline-link"
                          href={worker ? "#/app/wallet" : "#/app/campaigns"}
                        >
                          View all
                          <ArrowRight size={15} />
                        </a>
                      </div>
                      {worker ? (
                        <Ledger entries={data.ledger} />
                      ) : (
                        <CampaignList
                          items={data.campaigns.slice(0, 3)}
                          onEdit={openCampaign}
                          onDelete={setDeleting}
                        />
                      )}
                    </section>
                  </>
                )}
                {page === "wallet" && worker && (
                  <>
                    <div className="metric-grid">
                      <Metric
                        label="Earned balance"
                        value={coins(wallet?.earned_milli || 0)}
                        unit="Coins"
                        note="Your earned platform rewards"
                        icon={Coins}
                        featured
                      />
                      <Metric
                        label="Locked welcome bonus"
                        value={coins(wallet?.locked_milli || 0)}
                        unit="Coins"
                        note="Separate from your earned funds"
                        icon={Lock}
                      />
                      <Metric
                        label="Total withdrawn"
                        value={coins(wallet?.withdrawn_milli || 0)}
                        unit="Coins"
                        note="Recorded payouts only"
                        icon={ArrowUpRight}
                      />
                    </div>
                    <div className="overview-grid">
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>Before your first payout</h2>
                          <Lock size={20} />
                        </div>
                        <div className="milestone-number">
                          {coins(wallet?.earned_milli || 0)}
                          <span> / 300.000 earned Coins</span>
                        </div>
                        <progress
                          max={300000}
                          value={wallet?.earned_milli || 0}
                          aria-label="First withdrawal progress"
                        />
                        <p className="muted">
                          Your first withdrawal requires at least 300.000 earned
                          Coins and a minimum total of 500.000 Coins, including
                          the locked bonus. Later withdrawals require 500.000
                          earned Coins.
                        </p>
                        <div className="notice warning">
                          <AlertCircle size={18} />
                          <div>
                            <strong>Payouts are not enabled.</strong>
                            <p>
                              No payment provider is connected. No withdrawal
                              requests are accepted and no balance is debited.
                            </p>
                          </div>
                        </div>
                        <a className="inline-link" href="#/app/status">
                          View service availability
                          <ArrowRight size={16} />
                        </a>
                      </section>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>How rewards are calculated</h2>
                          <Coins size={20} />
                        </div>
                        <div className="formula-box">
                          min(group members, 1,000) ÷ 1,000
                        </div>
                        <p className="muted">
                          Each unique qualifying successful group uses this Coin
                          formula. There is no 100-group earning ceiling.
                          Cashout availability and conversion quotes will be
                          shown before any withdrawal.
                        </p>
                        <ul className="plain-list">
                          <li>
                            <Check />
                            At least 100 members, posting allowed & current
                            consent
                          </li>
                          <li>
                            <Check />
                            Verified delivery is required before credit
                          </li>
                          <li>
                            <X />
                            No rewards where posting is blocked or you are no
                            longer a member
                          </li>
                        </ul>
                        <a href="#/rules" className="inline-link">
                          Read all platform rules
                          <ArrowUpRight size={16} />
                        </a>
                      </section>
                    </div>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Wallet ledger</h2>
                          <p>Registration and real account activity.</p>
                        </div>
                        <button
                          className="button button-white small"
                          onClick={() => {
                            const csv =
                              "Date,Type,Coins\n" +
                              data.ledger
                                .map(
                                  (e) =>
                                    `${e.created_at},${e.kind},${(e.amount_milli / 1000).toFixed(3)}`,
                                )
                                .join("\n");
                            const url = URL.createObjectURL(
                              new Blob([csv], { type: "text/csv" }),
                            );
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "pappy-wallet-ledger.csv";
                            a.click();
                            URL.revokeObjectURL(url);
                            notify("Wallet ledger exported.");
                          }}
                        >
                          <Download size={15} />
                          Export CSV
                        </button>
                      </div>
                      <Ledger entries={data.ledger} />
                    </section>
                  </>
                )}
                {page === "connections" && worker && (
                  <WhatsAppConnections revision={earningRevision} />
                )}
                {page === "broadcasts" && worker && (
                  <PersonalBroadcasts revision={earningRevision} />
                )}
                {page === "calculator" && worker && (
                  <EarningHub revision={earningRevision} view="calculator" />
                )}
                {page === "referrals" && worker && (
                  <EarningHub revision={earningRevision} view="referrals" />
                )}
                {page === "treasury" && admin && (
                  <TreasuryPanel revision={earningRevision} />
                )}
                {page === "campaigns" && !worker && (
                  <>
                    <div className="workspace-banner">
                      <Lock size={20} />
                      <div>
                        <strong>
                          Plan now. Launch only when the service is ready.
                        </strong>
                        <p>
                          Drafts are saved securely to your account. Estimates
                          are not charges or delivery guarantees.
                        </p>
                      </div>
                    </div>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>
                          Your campaigns{" "}
                          <span className="count">{data.campaigns.length}</span>
                        </h2>
                        <span className="badge neutral">Drafts only</span>
                      </div>
                      {data.campaigns.length ? (
                        <CampaignList
                          items={data.campaigns}
                          onEdit={openCampaign}
                          onDelete={setDeleting}
                        />
                      ) : (
                        <Empty
                          icon={Send}
                          title="Your next campaign starts here."
                          action={
                            <button
                              className="button small"
                              onClick={() => openCampaign()}
                            >
                              <Plus size={17} />
                              Create a campaign draft
                            </button>
                          }
                        >
                          Choose your platform, destination and message. Save
                          your plan without making a payment.
                        </Empty>
                      )}
                    </section>
                  </>
                )}
                {page === "support" && (
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Your support requests</h2>
                        <p>
                          Requests are stored here. Email and Telegram alerts
                          are not enabled.
                        </p>
                      </div>
                      <span className="badge neutral">
                        {data.tickets.length} requests
                      </span>
                    </div>
                    {data.tickets.length ? (
                      <div className="ticket-list">
                        {data.tickets.map((t) => (
                          <details key={t.id}>
                            <summary>
                              <LifeBuoy size={18} />
                              <span>
                                <strong>{t.subject}</strong>
                                <small>
                                  {date(t.created_at)} · #{t.id.slice(0, 8)}
                                </small>
                              </span>
                              <span
                                className={`badge ${t.status === "REPLIED" ? "green" : "neutral"}`}
                              >
                                {t.status}
                              </span>
                              <ChevronRight size={17} />
                            </summary>
                            <div className="ticket-body">
                              <p>{t.message}</p>
                              {t.reply ? (
                                <div className="ticket-reply">
                                  <strong>Staff reply</strong>
                                  <p>{t.reply}</p>
                                </div>
                              ) : (
                                <p className="muted">
                                  No staff reply yet. Check back here for
                                  updates.
                                </p>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        icon={LifeBuoy}
                        title="No open conversations yet."
                        action={
                          <button
                            className="button button-outline small"
                            onClick={() => setModal("ticket")}
                          >
                            Ask a question
                            <ArrowUpRight size={16} />
                          </button>
                        }
                      >
                        Need clarity on your account or the platform rules?
                        Start a request and keep track of the response here.
                      </Empty>
                    )}
                  </section>
                )}
                {page === "settings" && (
                  <SettingsPanel user={user} onUser={onUser} notify={notify} />
                )}
                {page === "status" && (
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>What’s available today</h2>
                        <p>
                          Honest service availability, not simulated health
                          checks for external providers.
                        </p>
                      </div>
                    </div>
                    <ServiceStatus />
                  </section>
                )}
                {page === "admin" && admin && <AdminPanel notify={notify} />}
                {!heading && (
                  <Empty
                    icon={FileText}
                    title="This page isn’t in your workspace."
                    action={
                      <a className="button small" href="#/app">
                        Back to overview
                      </a>
                    }
                  >
                    Use the navigation to find what you need.
                  </Empty>
                )}
              </>
            )
          )}
          <footer className="workspace-footer">
            <span>© {new Date().getFullYear()} Pappy Earning Hub</span>
            <div>
              <a href="#/rules">Platform rules</a>
              <a href="#/privacy">Privacy notice</a>
              <span>
                <span className="status-dot" />
                Pre-launch workspace
              </span>
            </div>
          </footer>
        </main>
      </div>
      {modal === "campaign" && (
        <Modal
          title={editing ? "Edit your campaign" : "Plan a new campaign"}
          onClose={() => setModal(null)}
        >
          <CampaignForm initial={editing} onDone={saveDone} />
        </Modal>
      )}
      {modal === "ticket" && (
        <Modal title="How can we help?" onClose={() => setModal(null)}>
          <TicketForm onDone={saveDone} />
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete this draft?" onClose={() => setDeleting(null)}>
          <p className="muted">
            This removes the saved campaign plan from your account. No charges
            or live deliveries are affected.
          </p>
          <div className="modal-actions">
            <button
              className="button button-white"
              onClick={() => setDeleting(null)}
            >
              Keep draft
            </button>
            <button
              className="button button-danger"
              onClick={async () => {
                try {
                  await send(`/campaigns/${deleting}`, {}, "DELETE");
                  setDeleting(null);
                  await refresh();
                  notify("Campaign draft deleted.");
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              Delete draft
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  unit,
  note,
  icon: Icon,
  featured = false,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  icon: any;
  featured?: boolean;
}) {
  return (
    <article className={`metric ${featured ? "metric-featured" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <p>{note}</p>
    </article>
  );
}
function Ledger({ entries }: { entries: any[] }) {
  return entries.length ? (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Scrollable data table"
    >
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>
                <span className="table-activity">
                  <span className="table-icon">
                    <Lock size={16} />
                  </span>
                  <span>
                    <strong>
                      {e.kind === "LOCKED_REGISTRATION_BONUS"
                        ? "Welcome bonus"
                        : e.kind}
                    </strong>
                    <small>Welcome bonus · locked</small>
                  </span>
                </span>
              </td>
              <td>{date(e.created_at)}</td>
              <td className="numeric">
                +{coins(e.amount_milli)} <small>Coins</small>
              </td>
              <td>
                <span className="badge amber">Locked</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty icon={Clock} title="No wallet entries yet.">
      Real transactions will appear here as they are recorded.
    </Empty>
  );
}
function CampaignList({
  items,
  onEdit,
  onDelete,
}: {
  items: any[];
  onEdit: (c: any) => void;
  onDelete: (id: string) => void;
}) {
  return items.length ? (
    <div className="campaign-list">
      {items.map((c) => (
        <article key={c.id}>
          <span
            className={`campaign-platform ${c.payload.platform.startsWith("TG") ? "telegram" : ""}`}
          >
            {c.payload.platform.startsWith("TG") ? (
              <Send size={21} />
            ) : (
              <MessageCircle size={21} />
            )}
          </span>
          <div className="campaign-info">
            <h3>{c.title}</h3>
            <p>
              {c.payload.platform.replace("_", " ")} ·{" "}
              {c.payload.pathway === "DIRECT_SESSION"
                ? "Direct session"
                : "Smart verified"}{" "}
              · {date(c.updated_at)}
            </p>
            <span className="campaign-url">{c.payload.targetUrl}</span>
          </div>
          <span className="badge neutral">Draft</span>
          <button
            className="icon-button"
            onClick={() => onEdit(c)}
            aria-label={`Edit ${c.title}`}
          >
            <Pencil size={17} />
          </button>
          <button
            className="icon-button danger-icon"
            onClick={() => onDelete(c.id)}
            aria-label={`Delete ${c.title}`}
          >
            <Trash2 size={17} />
          </button>
        </article>
      ))}
    </div>
  ) : (
    <Empty icon={FileText} title="No campaigns yet.">
      Save a draft to start planning.
    </Empty>
  );
}
function CampaignForm({
  initial,
  onDone,
}: {
  initial: any;
  onDone: (message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftInput>(
      initial?.payload || emptyDraft,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<any>(null);
  const update = (key: keyof DraftInput, value: any) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setQuote(null);
    setError("");
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        initial ? `/campaigns/${initial.id}` : "/campaigns",
        draft,
        initial ? "PUT" : "POST",
      );
      await onDone(
        initial
          ? "Campaign draft updated."
          : "Campaign draft saved. No funds charged.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <p className="muted form-intro">
        A saved plan, not a live campaign. No payment or messaging takes place.
      </p>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      <label>
        Campaign name
        <input
          value={draft.title}
          onChange={(e) => update("title", e.target.value)}
          minLength={3}
          maxLength={120}
          required
          placeholder="Give your campaign a clear name"
        />
      </label>
      <div className="form-grid">
        <label>
          Delivery pathway
          <select
            value={draft.pathway}
            onChange={(e) => update("pathway", e.target.value)}
          >
            <option value="SMART_VERIFIED">Smart verified</option>
            <option value="DIRECT_SESSION">Direct session</option>
          </select>
        </label>
        <label>
          Platform
          <select
            value={draft.platform}
            onChange={(e) => update("platform", e.target.value)}
          >
            <option value="WA_GROUP">WhatsApp group</option>
            <option value="WA_CHANNEL">WhatsApp channel</option>
            <option value="TG_GROUP">Telegram group</option>
            <option value="TG_CHANNEL">Telegram channel</option>
          </select>
        </label>
      </div>
      <label>
        Destination URL
        <input
          value={draft.targetUrl}
          onChange={(e) => update("targetUrl", e.target.value)}
          type="url"
          maxLength={1000}
          required
          placeholder={
            draft.platform.startsWith("WA")
              ? "https://chat.whatsapp.com/…"
              : "https://t.me/…"
          }
        />
      </label>
      <label>
        Your campaign message
        <textarea
          value={draft.caption}
          onChange={(e) => update("caption", e.target.value)}
          minLength={5}
          maxLength={2000}
          required
          rows={3}
          placeholder="What would you like your audience to know?"
        />
      </label>
      <div className="form-grid">
        <label>
          Broadcast mode
          <select
            value={draft.mode}
            onChange={(e) => update("mode", e.target.value)}
          >
            <option value="ALLSTATUS_1X">Standard · 1×</option>
            <option value="ALLCHAT_2X_VIP">VIP · 2×</option>
          </select>
        </label>
        {draft.pathway === "SMART_VERIFIED" ? (
          <label>
            Requested joins
            <input
              type="number"
              value={draft.volume}
              onChange={(e) => update("volume", Number(e.target.value))}
              min={50}
              max={2000}
              step={1}
              required
            />
          </label>
        ) : (
          <label>
            Number of sessions
            <input
              type="number"
              value={draft.sessionCount}
              onChange={(e) => update("sessionCount", Number(e.target.value))}
              min={1}
              max={100}
              step={1}
              required
            />
          </label>
        )}
      </div>
      {draft.pathway === "DIRECT_SESSION" && (
        <label>
          Session tier
          <select
            value={draft.tier}
            onChange={(e) => update("tier", e.target.value)}
          >
            <option>BRONZE</option>
            <option>SILVER</option>
            <option>GOLD</option>
          </select>
        </label>
      )}
      <label>
        Country targeting
        <select
          value={draft.countryFilter}
          onChange={(e) => update("countryFilter", e.target.value)}
        >
          <option value="RANDOM">No country filter</option>
          <option value="SPECIFIC_COUNTRIES">Specific countries</option>
        </select>
      </label>
      {draft.countryFilter === "SPECIFIC_COUNTRIES" && (
        <fieldset className="countries">
          <legend>Target countries (choose at least one)</legend>
          {[
            ["+234", "Nigeria"],
            ["+233", "Ghana"],
            ["+254", "Kenya"],
            ["+1", "North America (+1)"],
          ].map(([code, label]) => (
            <label className="checkbox-label" key={code}>
              <input
                type="checkbox"
                checked={draft.countries.includes(code)}
                onChange={(e) =>
                  update(
                    "countries",
                    e.target.checked
                      ? [...draft.countries, code]
                      : draft.countries.filter((c) => c !== code),
                  )
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}
      {draft.pathway === "DIRECT_SESSION" &&
        draft.countryFilter === "SPECIFIC_COUNTRIES" && (
          <div className="notice warning">
            The inherited direct-session calculator does not price country
            filtering. Estimate excludes any country-targeting premium; launch
            remains disabled.
          </div>
        )}
      {quote && (
        <div className="quote-panel" role="status">
          <span className="eyebrow">PLANNING ESTIMATE · NOT A CHARGE</span>
          <strong>{coinValue(quote.estimatedNgn)}</strong>
          <div className="quote-breakdown">
            <span>Modelled worker cost</span>
            <span>{coinValue(quote.workerCoins)}</span>
          </div>
          <div className="quote-breakdown">
            <span>Modelled worker budget cap</span>
            <span>{quote.maxWorkerCoins.toFixed(3)} Coins</span>
          </div>
          <p>{quote.notice}</p>
        </div>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="button button-white"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setQuote(await send("/campaigns/quote", draft));
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Check estimate
        </button>
        <button className="button" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Check size={17} />
          )}
          Save draft
        </button>
      </div>
    </form>
  );
}
function TicketForm({
  onDone,
}: {
  onDone: (message: string) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await send("/support", {
            subject: f.get("subject"),
            message: f.get("message"),
          });
          await onDone(
            "Support request saved. Check this workspace for replies.",
          );
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted">
        We’ll keep your request in your account. No email or Telegram
        notification is sent. Do not include passwords, payment details or
        security codes.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <label>
        Subject
        <input
          name="subject"
          required
          minLength={3}
          maxLength={120}
          placeholder="What do you need help with?"
        />
      </label>
      <label>
        Message
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          placeholder="Tell us what happened and what you need."
        />
      </label>
      <button className="button submit-button" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <Send size={17} />
        )}
        Save support request
      </button>
    </form>
  );
}
function SettingsPanel({
  user,
  onUser,
  notify,
}: {
  user: User;
  onUser: (u: User) => void;
  notify: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-heading">
          <h2>Personal details</h2>
          <span className="user-avatar">{user.name.charAt(0)}</span>
        </div>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const result = await send(
                "/profile",
                { name: f.get("name") },
                "PATCH",
              );
              onUser(result.user);
              notify("Your profile has been updated.");
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <label>
            Full name
            <input
              name="name"
              defaultValue={user.name}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label>
            Email address
            <input value={user.email} readOnly />
            <span className="field-help">
              Email changes are not supported yet.
            </span>
          </label>
          <button className="button small" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
            <Check size={16} />
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Account information</h2>
          <ShieldCheck size={20} />
        </div>
        <dl className="account-details">
          <div>
            <dt>Account role</dt>
            <dd>
              {user.role === "EARNER"
                ? "Worker"
                : user.role === "ADMIN"
                  ? "Administrator"
                  : "Advertiser"}
            </dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{date(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Email status</dt>
            <dd>
              <span className="badge amber">
                {user.isEmailVerified ? "Verified" : "Unverified"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Sign-in method</dt>
            <dd>Email & password</dd>
          </div>
        </dl>
        <div className="notice warning">
          <AlertCircle size={17} />
          <p>
            Email verification and password reset delivery are not configured.
            Account roles cannot be changed in the browser.
          </p>
        </div>
        <a href="#/app/support" className="inline-link">
          Ask about your account
          <ArrowRight size={15} />
        </a>
      </section>
    </div>
  );
}
function AdminPanel({ notify }: { notify: (m: string) => void }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  const load = () =>
    api("/admin/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {!data ? (
        <div role="status">Loading administrative records…</div>
      ) : (
        <>
          <div className="metric-grid">
            <Metric
              label="Recent accounts"
              value={String(data.users.length)}
              note="Latest 100 accounts"
              icon={ShieldCheck}
            />
            <Metric
              label="Locked bonus liability"
              value={money(data.bonusLiability.milli / 1000)}
              note="Conditional obligation, not revenue"
              icon={Lock}
            />
            <Metric
              label="Recent support requests"
              value={String(data.tickets.length)}
              note="Latest 100 requests"
              icon={LifeBuoy}
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Support inbox</h2>
            </div>
            {data.tickets.length ? (
              data.tickets.map((t: any) => (
                <article className="admin-ticket" key={t.id}>
                  <h3>{t.subject}</h3>
                  <p>{t.message}</p>
                  <small>
                    {date(t.created_at)} · {t.status}
                  </small>
                  {t.reply && <blockquote>{t.reply}</blockquote>}
                  <form
                    className="form-stack"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      try {
                        await send(`/admin/tickets/${t.id}/reply`, {
                          reply: f.get("reply"),
                        });
                        notify("Reply saved in the user’s workspace.");
                        await load();
                      } catch (e: any) {
                        notify(e.message);
                      }
                    }}
                  >
                    <label>
                      Staff reply
                      <textarea
                        name="reply"
                        required
                        minLength={2}
                        maxLength={4000}
                        rows={2}
                      />
                    </label>
                    <button className="button small">Save reply</button>
                  </form>
                </article>
              ))
            ) : (
              <p className="muted">No support requests.</p>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Recent accounts</h2>
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Scrollable data table"
            >
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u: any) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{date(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Audit trail</h2>
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Scrollable data table"
            >
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.map((e: any) => (
                    <tr key={e.id}>
                      <td>{e.action}</td>
                      <td>{e.entity_id}</td>
                      <td>{e.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
