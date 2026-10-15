import React from "react";
import { ArrowRight, Coins, Users, Check, Lock } from "lucide-react";
import { EARNING_RULES, placementRewardMilli } from "../../shared/earningRules";
const examples = [EARNING_RULES.minMembers, 742, EARNING_RULES.maxPaidMembers];
export function EarningRates({
  calculatorHref = "#/join/worker",
}: {
  calculatorHref?: string;
}) {
  const value = (milli: number) =>
    (milli / 1000).toLocaleString("en", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  return (
    <section
      id="earning-rates"
      className="earning-rates section wrap"
      aria-labelledby="earning-rates-title"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow">WHAT YOUR GROUPS COULD EARN</div>
          <h2 id="earning-rates-title">
            Know the reward.
            <br />
            <span className="serif-word">Before you connect.</span>
          </h2>
        </div>
        <p>
          You earn Coins for confirmed, funded campaign posts in approved
          groups. Your reward depends on the group’s member count—not on how
          many people click or join.
        </p>
      </div>
      <div className="reward-rate-grid">
        {examples.map((members) => (
          <article
            className="reward-rate-card"
            key={members}
            data-members={members}
          >
            <span className="reward-members">
              <Users size={19} />
              {members.toLocaleString("en")}
              {members === 1000 ? "+" : ""} members
            </span>
            <div className="reward-rate">
              <strong>{value(placementRewardMilli(members))}</strong>
              <span>Coins</span>
            </div>
            <p>for one confirmed paid status or chat post</p>
            <span className="reward-rate-note">
              <Check size={16} />
              {members === 100
                ? "Minimum group size for earning"
                : members === 1000
                  ? "Reward stops increasing above 1,000 members"
                  : "Each eligible member counts toward the reward"}
            </span>
          </article>
        ))}
      </div>
      <div className="reward-explainer">
        <Coins size={23} />
        <p>
          <strong>Both post types confirmed? Both can earn.</strong> A{" "}
          {examples[1]}-member group earns{" "}
          {value(placementRewardMilli(examples[1]))} Coins for status +{" "}
          {value(placementRewardMilli(examples[1]))} for chat ={" "}
          <strong>{value(placementRewardMilli(examples[1]) * 2)} Coins</strong>.
          Each post needs its own confirmation.
        </p>
      </div>
      <div className="reward-details">
        <p>
          One qualifying group is enough—there is no 100-group requirement.
          Groups below {EARNING_RULES.minMembers} members earn 0 Coins. Shared
          groups count once per post type. Up to{" "}
          {EARNING_RULES.maxCampaignsPerDay} distinct paid campaigns per day,
          only if funded work is available.
        </p>
        <a className="inline-link" href={calculatorHref}>
          {calculatorHref.includes("/join/")
            ? "Create a free worker account"
            : calculatorHref === "#/app"
              ? "Open my workspace"
              : "Try the earning calculator"}
          <ArrowRight size={17} />
        </a>
      </div>
      <p className="reward-availability">
        <Lock size={17} />
        <span>
          Paid jobs and cashout are not open yet. Pairing alone does not earn
          Coins. These are the reward rules for qualifying funded work—not money
          available today.
        </span>
      </p>
    </section>
  );
}
