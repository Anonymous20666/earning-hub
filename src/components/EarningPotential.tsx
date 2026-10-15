import React from "react";
import { ArrowUpRight, Users, Coins } from "lucide-react";
import {
  DAILY_EARNING_EXAMPLE,
  EARNING_RULES,
} from "../../shared/earningRules";
export function EarningPotential() {
  return (
    <section
      className="earning-potential"
      aria-labelledby="earning-potential-title"
    >
      <div className="potential-copy">
        <span className="eyebrow">BIGGER COMMUNITIES. MORE POSSIBILITIES.</span>
        <h2 id="earning-potential-title">
          What could a{" "}
          <em>
            {(DAILY_EARNING_EXAMPLE.dailyMilli / 1000).toLocaleString("en")}
            -Coin day
          </em>{" "}
          look like?
        </h2>
        <p>
          Grow your eligible groups and see how the rewards could add up. Your
          personal posts stay free.
        </p>
        <a href="#/rules">
          See how earning works <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="potential-example">
        <span className="potential-label">
          ILLUSTRATION · NOT A GUARANTEED INCOME
        </span>
        <div className="potential-equation">
          <span>
            <strong>{DAILY_EARNING_EXAMPLE.groups}</strong>eligible groups
          </span>
          <b>×</b>
          <span>
            <strong>{DAILY_EARNING_EXAMPLE.campaigns}</strong>funded campaigns
          </span>
          <b>×</b>
          <span>
            <strong>{DAILY_EARNING_EXAMPLE.surfaces}</strong>confirmed post
            types
          </span>
        </div>
        <div className="potential-total">
          <Coins size={25} />
          <strong>
            {(DAILY_EARNING_EXAMPLE.dailyMilli / 1000).toLocaleString("en")}{" "}
            Coins
          </strong>
          <span>in this daily example</span>
        </div>
        <p>
          Each group has 1,000+ members. Both status and chat must have
          permission and verified delivery. Smaller groups, fewer jobs or failed
          posts reduce the result. Ten campaigns is a daily capacity limit, not
          promised work.
        </p>
        <div className="potential-referral">
          <Users size={18} />
          <span>
            <strong>
              {EARNING_RULES.referralMilli / 1000} Coins per qualifying friend.
            </strong>{" "}
            Paid once after their first eligible funded delivery—not just
            signup.
          </span>
        </div>
        <p className="potential-availability">
          Paid jobs and cashout are not open yet. These are conditional
          opportunities, not money already earned.
        </p>
      </div>
    </section>
  );
}
