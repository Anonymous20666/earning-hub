import { PlogmeLicense } from "./components/PlogmeLicense";
import React, { useState, useEffect, lazy, Suspense } from "react";
import { ArrowLeft, ArrowUpRight, LoaderCircle } from "lucide-react";
import { api, send, setCsrf, User, go } from "./api";
import { Landing } from "./components/Landing";
import { Brand } from "./components/Brand";
const Auth = lazy(() =>
  import("./components/Auth").then((m) => ({ default: m.Auth })),
);
const Workspace = lazy(() =>
  import("./components/Workspace").then((m) => ({ default: m.Workspace })),
);
const Status = lazy(() =>
  import("./components/Workspace").then((m) => ({ default: m.ServiceStatus })),
);
function Loading() {
  return (
    <div className="boot-loading" role="status">
      <LoaderCircle size={25} className="spin" />
      <span>Opening your Pappy workspace…</span>
    </div>
  );
}
export default function App() {
  const [path, setPath] = useState(window.location.hash.slice(1) || "/"),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [connectionError, setConnectionError] = useState(false);
  const boot = async () => {
    setConnectionError(false);
    try {
      const r = await fetch("/api/auth/session", {
        credentials: "same-origin",
      });
      if (r.status === 401) {
        setUser(null);
      } else if (r.ok) {
        const result = await r.json();
        setCsrf(result.csrf);
        setUser(result.user);
      } else {
        setConnectionError(true);
      }
    } catch {
      setConnectionError(true);
    } finally {
      setReady(true);
    }
  };
  useEffect(() => {
    try {
      for (const key of ["pappy_auth_session", "pappy_registered_users"])
        localStorage.removeItem(key);
    } catch {
      /* Sign-in remains server-backed even if browser storage is disabled. */
    }
    boot();
    const handler = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", handler);
    const expired = () => {
      setUser(null);
      go("/login");
    };
    window.addEventListener("pappy-session-expired", expired);
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("pappy-session-expired", expired);
    };
  }, []);
  useEffect(() => {
    if (!path.startsWith("/app"))
      document.title =
        "Pappy Earning Hub — Community. Contribution. Possibility.";
  }, [path]);
  const logout = async () => {
    await send("/auth/logout", {});
    setCsrf("");
    setUser(null);
    go("/");
  };
  if (!ready) return <Loading />;
  if (connectionError && path.startsWith("/app"))
    return (
      <div className="boot-loading">
        <h1>We couldn’t reach your workspace.</h1>
        <p>Your account data has not been changed.</p>
        <button className="button" onClick={boot}>
          Try again
        </button>
        <a href="#/">Back to home</a>
      </div>
    );
  return (
    <Suspense fallback={<Loading />}>
      {path === "/" ? (
        <Landing user={user} />
      ) : path.startsWith("/join/") || path === "/login" ? (
        <Auth key={path} path={path} onSuccess={setUser} />
      ) : path.startsWith("/app") ? (
        user ? (
          <Workspace
            user={user}
            path={path}
            onUser={setUser}
            onLogout={logout}
          />
        ) : (
          <Auth key="login" path="/login" onSuccess={setUser} />
        )
      ) : path === "/plogme-license" ? (
        <PlogmeLicense />
      ) : ["/rules", "/privacy", "/status"].includes(path) ? (
        <InfoPage path={path} />
      ) : (
        <div className="not-found">
          <Brand />
          <h1>A different kind of detour.</h1>
          <p>This page doesn’t exist. Let’s get you back to the right place.</p>
          <a href="#/" className="button">
            Back to Pappy
            <ArrowUpRight size={18} />
          </a>
        </div>
      )}
    </Suspense>
  );
}
function InfoPage({ path }: { path: string }) {
  return (
    <div className="info-page">
      <header className="wrap public-header">
        <Brand />
        <a className="back-link" href="#/">
          <ArrowLeft size={17} />
          Back to home
        </a>
      </header>
      <main id="main-content" className="info-content">
        <div className="eyebrow">PAPPY / CLARITY FIRST</div>
        <h1>
          {path === "/rules"
            ? "Platform rules."
            : path === "/privacy"
              ? "Your information. Clearly."
              : "What’s available today."}
        </h1>
        <p className="info-lede">
          {path === "/status"
            ? "A pre-launch platform with real account records—not simulated delivery results."
            : "Pre-launch notice · Updated 15 October 2026"}
        </p>
        {path === "/status" ? (
          <Status />
        ) : path === "/rules" ? (
          <>
            <section>
              <h2>1. What is available</h2>
              <p>
                You can register, manage your profile, save advertiser campaign
                drafts and submit support requests. Personal WhatsApp posting is
                an owner-linked-device pilot where configured. Paid earning,
                checkout, withdrawals, email delivery, social sign-in and AI are
                not live. Creating an account does not guarantee income, reach,
                campaign delivery or a launch date.
              </p>
            </section>
            <section>
              <h2>2. Coins and conditional bonuses</h2>
              <p>
                Coins track your platform rewards; they are not the same as your
                local currency. A worker account receives a 200.000 Coin locked
                registration bonus. It is not immediately withdrawable and is
                not an earned balance. The first payout requires at least
                300.000 earned Coins and a minimum cashout of 500.000 Coins.
                When used, the locked bonus is consumed once. Subsequent payouts
                require at least 500.000 earned Coins.
              </p>
              <p>
                If a reused messaging account is disqualified from a bonus, the
                minimum 500.000 Coin cashout still applies. No payout can exceed
                the available eligible balance. Live payouts remain disabled.
                Before cashout becomes available, supported countries, payout
                currencies, the conversion quote and any fees will be shown
                before confirmation. No global payout availability is promised.
              </p>
            </section>
            <section>
              <h2>3. Group reward rules</h2>
              <p>
                A group needs at least 100 members, permitted posting and
                current verified community consent. Each unique successful group
                earns min(member count, 1,000) ÷ 1,000 Coins. One qualifying
                group is enough; there is no 100-group earning cap. Two numbers
                may belong to one owner, but a shared group counts once per
                campaign. Up to ten campaign participations per worker per UTC
                day is a capacity limit, not a promise of work. Groups below 100
                members, accounts no longer in the group and groups where the
                account cannot post earn zero. Paid campaigns require cleared
                funding, bonus backing and verified delivery. A calculation is
                not a delivery or payment. The old draft calculator’s VIP
                estimate is not an active worker reward mode.
              </p>
              <p>
                New qualifying referrals award 100.000 Coins once, after the
                invited worker pairs and completes their first qualifying
                verified campaign delivery. Previously earned or
                already-reserved rewards keep their recorded amounts. Pending
                referral amounts are conditional, not earned or withdrawable.
                Signup alone does not qualify. Referral codes must be attached
                at registration. Self-referrals and multiple owner accounts for
                the same paired phone number are not permitted. Shared or
                dynamic IP addresses do not, by themselves, establish someone’s
                identity.
              </p>
            </section>
            <section>
              <h2>4. Advertiser planning estimates</h2>
              <p>
                Campaign estimates preserve the original pricing model but use
                unverified conversion assumptions. They exclude unconfirmed
                operating costs, gateway fees, taxes, refunds, bonus funding and
                acquisition costs. They are not binding prices, charges or
                profit guarantees. Saving a draft does not reserve inventory or
                launch delivery. Delivery counters must be based on distinct
                verified events; owner approvals must not reset quotas.
              </p>
            </section>
            <section>
              <h2>5. Responsible community activity</h2>
              <p>
                Respect consent, community rules, privacy and WhatsApp or
                Telegram policies. Do not use the platform for spam, deceptive
                promotions, fraud or unauthorised account access. No integration
                may be enabled merely to evade a platform’s controls. Never
                provide registration codes or two-step verification PINs in
                support tickets.
              </p>
            </section>
            <section>
              <h2>6. Before a commercial launch</h2>
              <p>
                Final commercial terms, operator and contact details, supported
                jurisdictions, eligibility requirements, refunds, payout
                schedules and provider fees require founder approval and
                appropriate professional review. This pre-launch explanation is
                not a substitute for final legal terms. Contact staff through
                your account’s Support page for questions.
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2>What this deployment stores</h2>
              <p>
                Your name, email, server-hashed password, account role, creation
                time and account verification status; hashed session identifiers
                and expiry times; conditional bonus ledger entries; saved
                campaign plans; support messages and staff replies; and audit
                records of account operations. Referral relationships and
                pending reward records are stored when a referral code is used.
                When a messaging integration is approved, masked number labels,
                keyed account hashes, group inventory and permission records
                will be used for eligibility and deduplication. Group member
                lists are not stored by the current application.
              </p>
              <p>
                Passwords are derived with a unique salt using scrypt. They are
                not stored in plaintext. A session cookie is used to keep you
                signed in. No advertising analytics, device fingerprinting,
                canvas collection or marketing cookies are enabled by this
                application.
              </p>
            </section>
            <section>
              <h2>Why this information is used</h2>
              <p>
                To authenticate you, separate records between accounts, save
                your work, show your balances accurately, respond to support
                questions and investigate operational issues. We do not send
                your campaign or support content to AI providers in this
                deployment.
              </p>
            </section>
            <section>
              <h2>Where records live</h2>
              <p>
                Records are stored in the application’s server database and its
                operational backups. Authorised administrators can review
                support requests and account records. Payment, email and Google
                sign-in providers are not connected. WhatsApp owner-testing may
                be enabled separately: linked-device credentials and Signal keys
                are encrypted in the server database using a separately held
                key. Private pairing codes are not logged. Group metadata and
                scoped admin approvals support permitted personal broadcasts;
                message content is processed to recognise approval commands, not
                saved as a general chat archive. Hosting infrastructure may
                separately keep access or security logs.
              </p>
            </section>
            <section>
              <h2>Your choices</h2>
              <p>
                You can update your display name and sign out from the
                workspace. Ask staff through Support to request account
                deletion, correction or a copy of your records. An automated
                account-deletion workflow is not available. Do not put
                passwords, bank details or identity documents in campaign drafts
                or support messages.
              </p>
            </section>
            <section>
              <h2>Outstanding policy decisions</h2>
              <p>
                The operator’s legal identity, privacy contact, retention
                schedule, hosting jurisdiction, legal bases, deletion procedure
                and applicable privacy obligations must be finalised before
                public commercial launch. Retention is not yet automated. This
                is a factual pre-launch notice, not a claim of regulatory
                certification.
              </p>
            </section>
          </>
        )}
        <div className="info-bottom">
          <a href="#/" className="inline-link">
            Back to home
            <ArrowUpRight size={16} />
          </a>
          <a href="#/login" className="inline-link">
            Account & support
            <ArrowUpRight size={16} />
          </a>
        </div>
      </main>
    </div>
  );
}
