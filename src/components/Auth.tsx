import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { Brand } from "./Brand";
import { api, send, User, setCsrf, go } from "../api";
export function Auth({
  path,
  onSuccess,
}: {
  path: string;
  onSuccess: (user: User) => void;
}) {
  const signup = path.startsWith("/join");
  const role = path.split("?")[0].endsWith("advertiser")
    ? "ADVERTISER"
    : "EARNER";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false),
    [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(e.currentTarget);
    try {
      const result = await send(signup ? "/auth/register" : "/auth/login", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role,
        referralCode:
          signup && role === "EARNER"
            ? form.get("referralCode") || undefined
            : undefined,
      });
      setCsrf(result.csrf);
      onSuccess(result.user);
      go("/app");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand light />
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>
            {signup && role === "ADVERTISER" ? (
              <>
                Great brands.
                <br />
                Real communities.
                <br />
                <em>Better connections.</em>
              </>
            ) : (
              <>
                Your community.
                <br />
                Your contribution.
                <br />
                <em>New possibilities.</em>
              </>
            )}
          </h1>
          <p>
            A platform for the people who bring communities together—and the
            brands who want to reach them responsibly.
          </p>
          <div className="auth-points">
            <span>
              <Check />
              Clear rules before you begin
            </span>
            <span>
              <Check />
              Real records, not simulated results
            </span>
            <span>
              <Check />A workspace built around you
            </span>
          </div>
        </div>
        <span className="auth-story-footer">
          PAPPY EARNING HUB / BUILT AROUND CONNECTIONS
        </span>
      </aside>
      <main className="auth-main" id="main-content">
        <a className="back-link" href="#/">
          <ArrowLeft size={16} />
          Back to home
        </a>
        <div className="auth-form-wrap">
          <div className="eyebrow">
            {signup ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}
          </div>
          <h2>
            {signup
              ? role === "EARNER"
                ? "Start your worker journey."
                : "Make room for growth."
              : "A little closer to possibility."}
          </h2>
          <p>
            {signup
              ? "A clear starting point. No payments required."
              : "Sign in to your Pappy workspace."}
          </p>
          {signup && (
            <div className="role-options">
              <a
                className={role === "EARNER" ? "active" : ""}
                href="#/join/worker"
              >
                I’m a worker
              </a>
              <a
                className={role === "ADVERTISER" ? "active" : ""}
                href="#/join/advertiser"
              >
                I’m an advertiser
              </a>
            </div>
          )}
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
          <form onSubmit={submit} className="form-stack">
            {signup && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="How should we call you?"
                />
              </label>
            )}
            {signup && role === "EARNER" && (
              <label>
                Referral code (optional)
                <input
                  name="referralCode"
                  maxLength={20}
                  pattern="[a-f0-9]{20}"
                  defaultValue={
                    new URLSearchParams(path.split("?")[1] || "").get("ref") ||
                    ""
                  }
                  autoComplete="off"
                />
                <span className="field-help">
                  An invited worker’s first verified qualifying delivery unlocks
                  a 5.000 Coin reward for their referrer. Signup alone does not
                  earn it.
                </span>
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <div className="auth-password-field">
              <span className="label-row">
                <label htmlFor="auth-password">Password</label>
                {!signup && (
                  <button
                    type="button"
                    aria-label="Forgot password?"
                    className="field-link"
                    onClick={async () => {
                      setNotice("");
                      try {
                        await api("/auth/password-reset", {
                          method: "POST",
                          body: "{}",
                        });
                      } catch (e: any) {
                        setNotice(e.message);
                      }
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </span>
              <span className="password-input">
                <input
                  id="auth-password"
                  aria-label="Password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  minLength={signup ? 12 : 1}
                  maxLength={128}
                  placeholder={
                    signup ? "At least 12 characters" : "Your password"
                  }
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </div>
            {signup && (
              <>
                <div className="field-help">
                  Use a long, unique password. Passwords are never stored in
                  your browser.
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" required />{" "}
                  <span>
                    I’ve read the{" "}
                    <a href="#/rules" target="_blank" rel="noreferrer">
                      platform rules
                    </a>{" "}
                    and{" "}
                    <a href="#/privacy" target="_blank" rel="noreferrer">
                      privacy notice
                    </a>
                    . I understand earning and payouts are not live.
                  </span>
                </label>
              </>
            )}
            <button className="button submit-button" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  Please wait…
                </>
              ) : (
                <>
                  {signup ? "Create account" : "Sign in"}
                  <ArrowUpRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to Pappy?"}{" "}
            <a href={signup ? "#/login" : "#/join/worker"}>
              {signup ? "Sign in" : "Create an account"}
            </a>
          </p>
          <div className="auth-disclosure">
            <Lock size={16} />
            <p>
              {signup && role === "EARNER"
                ? "Worker accounts receive a 200.000 Coin locked bonus. It is conditional, not instant cash."
                : "Server-validated sign-in. No public demo or admin accounts."}{" "}
              Email verification and social sign-in are not configured yet.
            </p>
          </div>
        </div>
        <div className="auth-bottom">
          <ShieldCheck size={15} />
          Your workspace, with clear expectations.
        </div>
      </main>
    </div>
  );
}
