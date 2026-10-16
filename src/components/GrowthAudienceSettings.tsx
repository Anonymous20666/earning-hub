import React from "react";
import { Globe2 } from "lucide-react";
import { send } from "../api";
import { GROWTH_COUNTRIES } from "../../shared/growthRules";
export function GrowthAudienceSettings({
  data,
  busy,
  action,
}: {
  data: any;
  busy: boolean;
  action: (fn: () => Promise<any>, message: string) => Promise<void>;
}) {
  const policy = data.audiencePolicy;
  return (
    <details className="gx-panel">
      <summary>
        <Globe2 size={19} /> Country audience evidence & review policy
      </summary>
      <p>
        Country-matched inventory stays unavailable until an administrator sets
        this policy. A permitted phone-prefix sample describes an advertising
        audience—not anyone’s nationality or a channel follower’s location.
        Never collect participants’ phone numbers for this form.
      </p>
      <form
        key={policy.revision}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          action(
            () =>
              send(
                "/admin/growth-audience-policy",
                {
                  minSample: Number(f.get("minSample")),
                  minMatchBps: Math.round(Number(f.get("match")) * 100),
                  maxAgeHours: Number(f.get("maxAgeHours")),
                  revision: policy.revision,
                },
                "PUT",
              ),
            "Audience review policy recorded",
          );
        }}
      >
        <div className="gx-two">
          <div className="gx-field">
            <label htmlFor="gap-min">Minimum permitted sample size</label>
            <input
              id="gap-min"
              name="minSample"
              type="number"
              min="20"
              max="100000"
              step="1"
              required
              defaultValue={policy.min_sample ?? ""}
            />
          </div>
          <div className="gx-field">
            <label htmlFor="gap-match">Minimum matching audience (%)</label>
            <input
              id="gap-match"
              name="match"
              type="number"
              min="50.01"
              max="100"
              step="0.01"
              required
              defaultValue={
                policy.min_match_bps === null ? "" : policy.min_match_bps / 100
              }
            />
          </div>
        </div>
        <div className="gx-field">
          <label htmlFor="gap-age">Maximum evidence age (hours)</label>
          <input
            id="gap-age"
            name="maxAgeHours"
            type="number"
            min="1"
            max="168"
            step="1"
            required
            defaultValue={policy.max_age_hours ?? ""}
          />
        </div>
        <button disabled={busy} className="gx-button secondary small">
          Save audience review policy
        </button>
      </form>
      <h4>Record aggregate evidence</h4>
      <p>
        Only use a sample collected with permission. Declared audiences are
        stored for review but do not qualify country inventory. This records
        evidence now; it does not run a scan or send anything.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const selected = data.audienceInventory[Number(f.get("group"))];
          action(
            () =>
              send("/admin/growth-audiences", {
                accountId: selected.account_id,
                groupJid: selected.group_jid,
                country: f.get("country"),
                sampleTotal: Number(f.get("sampleTotal")),
                matching: Number(f.get("matching")),
                source: f.get("source"),
                evidenceNote: f.get("evidenceNote"),
              }),
            "Aggregate audience evidence saved",
          );
        }}
      >
        <div className="gx-field">
          <label htmlFor="gae-group">Recorded inventory group</label>
          <select id="gae-group" name="group" required defaultValue="">
            <option value="" disabled>
              {data.audienceInventory.length
                ? "Choose a recorded group"
                : "No recorded groups available"}
            </option>
            {data.audienceInventory.map((g: any, i: number) => (
              <option key={g.account_id + g.group_jid} value={i}>
                {g.subject} · {g.phone_label}
              </option>
            ))}
          </select>
        </div>
        <div className="gx-two">
          <div className="gx-field">
            <label htmlFor="gae-country">Sample country region</label>
            <select id="gae-country" name="country">
              {GROWTH_COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="gx-field">
            <label htmlFor="gae-source">Evidence source</label>
            <select id="gae-source" name="source">
              <option value="PERMITTED_PREFIX_SAMPLE">
                Permitted prefix sample
              </option>
              <option value="DECLARED_AUDIENCE">
                Declared audience (review only)
              </option>
            </select>
          </div>
        </div>
        <div className="gx-two">
          <div className="gx-field">
            <label htmlFor="gae-total">Total sampled</label>
            <input
              id="gae-total"
              name="sampleTotal"
              type="number"
              min="1"
              max="100000"
              step="1"
              required
            />
          </div>
          <div className="gx-field">
            <label htmlFor="gae-matching">Matching region</label>
            <input
              id="gae-matching"
              name="matching"
              type="number"
              min="0"
              max="100000"
              step="1"
              required
            />
          </div>
        </div>
        <div className="gx-field">
          <label htmlFor="gae-note">
            Permission and evidence note (no participant details)
          </label>
          <textarea
            id="gae-note"
            name="evidenceNote"
            minLength={12}
            maxLength={500}
            required
          />
        </div>
        <button
          disabled={busy || !data.audienceInventory.length}
          className="gx-button secondary small"
        >
          Record aggregate evidence
        </button>
      </form>
      <p>
        {data.audienceSamples.length} recorded aggregate samples. No sample is a
        delivery or conversion guarantee.
      </p>
    </details>
  );
}
