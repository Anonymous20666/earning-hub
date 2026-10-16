import React, { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { api, send } from "../api";
import "../growth.css";
export function GrowthAvailability() {
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    api("/growth-availability")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="gx" aria-labelledby="growth-availability-heading">
      <div className="gx-panel">
        <div className="gx-list-heading">
          <h3 id="growth-availability-heading">
            Choose your growth-work availability
          </h3>
          <Clock3 size={22} />
        </div>
        <p>
          This is optional planning availability for future advertiser growth
          campaigns. It does not change your existing paid-broadcast choice or
          start a post. Live growth dispatch is off; availability does not
          guarantee work or earnings.
        </p>
        {error && (
          <p role="alert" className="gx-alert">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="gx-notice">
            {notice}
          </p>
        )}
        {data && (
          <>
            <p className="gx-muted">
              {data.availableUntil &&
              new Date(data.availableUntil).getTime() > Date.now()
                ? "Available until " +
                  new Date(data.availableUntil).toLocaleString()
                : "Not currently available for growth planning."}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const minutes = Number(
                  new FormData(e.currentTarget).get("minutes"),
                );
                setBusy(true);
                setError("");
                setNotice("");
                try {
                  setData(
                    await send("/growth-availability", { minutes }, "PUT"),
                  );
                  setNotice(
                    minutes
                      ? "Your voluntary availability was saved. No post started."
                      : "Growth planning availability is off.",
                  );
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="gx-field">
                <label htmlFor="growth-shift">
                  How long are you available?
                </label>
                <select name="minutes" id="growth-shift" defaultValue="0">
                  <option value="0">Off — do not include me</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                </select>
              </div>
              <button disabled={busy} className="gx-button secondary">
                {busy ? "Saving…" : "Save availability"}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
