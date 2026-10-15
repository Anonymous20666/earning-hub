export const EARNING_RULES = Object.freeze({
  coinToNgn: 1,
  referralMilli: 5000,
  maxAccounts: 2,
  maxCampaignsPerDay: 10,
  minMembers: 100,
  maxPaidMembers: 1000,
});
export type GroupSnapshot = {
  accountId: string;
  groupJid: string;
  subject: string;
  memberCount: number;
  announce: boolean;
  userIsAdmin: boolean;
  isMember: boolean;
  excluded?: boolean;
  approved?: boolean;
  online?: boolean;
};
export function groupEligibility(
  g: Pick<
    GroupSnapshot,
    "memberCount" | "announce" | "userIsAdmin" | "isMember"
  >,
) {
  if (!Number.isSafeInteger(g.memberCount) || g.memberCount < 100)
    return {
      qualified: false,
      rewardMilli: 0,
      reason: "Fewer than 100 members",
    };
  if (!g.isMember)
    return {
      qualified: false,
      rewardMilli: 0,
      reason: "Account is no longer a member",
    };
  if (g.announce && !g.userIsAdmin)
    return {
      qualified: false,
      rewardMilli: 0,
      reason: "Only admins may post in this group",
    };
  return {
    qualified: true,
    rewardMilli: Math.min(g.memberCount, 1000),
    reason: "Qualified membership; group consent is still required",
  };
}
export function inventorySummary(groups: GroupSnapshot[]) {
  const eligible = groups.filter(
    (g) => groupEligibility(g).qualified && !g.excluded,
  );
  const unique = new Map<string, GroupSnapshot>();
  for (const g of eligible) {
    const old = unique.get(g.groupJid);
    if (!old || (!!g.online && !old.online)) unique.set(g.groupJid, g);
  }
  const uniqueGroups = [...unique.values()];
  return {
    memberships: groups.filter((g) => g.isMember).length,
    qualifiedMemberships: eligible.length,
    uniqueQualified: unique.size,
    duplicateMemberships: eligible.length - unique.size,
    approvedUnique: uniqueGroups.filter((g) => g.approved).length,
    estimatedRewardMilli: uniqueGroups.reduce(
      (s, g) => s + groupEligibility(g).rewardMilli,
      0,
    ),
  };
}
export function sessionTier(qualifiedGroups: number) {
  if (!Number.isSafeInteger(qualifiedGroups) || qualifiedGroups < 0)
    throw Error("Invalid group count");
  return {
    tier:
      qualifiedGroups === 0
        ? "UNQUALIFIED"
        : qualifiedGroups <= 25
          ? "BRONZE"
          : qualifiedGroups <= 99
            ? "SILVER"
            : "GOLD",
    goldUnits: Math.floor(qualifiedGroups / 100),
    remainderGroups: qualifiedGroups % 100,
  };
}
export function parseNgnMilli(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,9}(?:\.\d{1,3})?$/.test(value))
    throw Error("Enter a positive amount with at most 3 decimal places");
  const [whole, fraction = ""] = value.split(".");
  const milli = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  if (!Number.isSafeInteger(milli) || milli <= 0 || milli > 999999999999)
    throw Error("Amount outside supported DECIMAL(12,3) range");
  return milli;
}
