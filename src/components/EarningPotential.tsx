import React from "react";
import { ArrowUpRight, Coins } from "lucide-react";
export function EarningPotential() {
  return (
    <section
      className="earning-potential opportunity-teaser"
      aria-labelledby="earning-potential-title"
    >
      <div className="potential-copy">
        <span className="eyebrow">THINK BIGGER WITH YOUR COMMUNITIES</span>
        <h2 id="earning-potential-title">
          A small start.
          <br />
          <em>A bigger possibility.</em>
        </h2>
        <p>
          Your groups could do more than carry conversations. Explore what
          consistent, confirmed paid work could look like—then check the numbers
          for your own groups.
        </p>
        <a href="#/earnings">
          See the earning guide <ArrowUpRight size={18} />
        </a>
      </div>
      <div className="opportunity-scenarios">
        <span className="potential-label">
          CONDITIONAL DAILY EXAMPLES · NOT GUARANTEED
        </span>
        {["1,000+", "5,000"].map((n) => (
          <a href="#/calculator" className="opportunity-card" key={n}>
            <Coins size={22} />
            <span>
              <strong>
                {n}
                <small> Coins / day</small>
              </strong>
              <small>Explore what this would require</small>
            </span>
            <ArrowUpRight size={21} />
          </a>
        ))}
        <p>
          These larger examples need many eligible groups and enough funded,
          confirmed work. They are not typical earnings or promised jobs. Paid
          work is not open yet.
        </p>
      </div>
    </section>
  );
}
