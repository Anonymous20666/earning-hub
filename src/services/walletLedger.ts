import {
  toMilli,
  validateWithdrawal,
  withdrawalEligibility,
} from "../../shared/rules";
import { Wallet, SessionGroup, BroadcastMode } from "../types";

export interface MultiCurrencyRate {
  currency: "NGN" | "USDT" | "KES" | "GHS" | "XOF";
  rateAgainstNgn: number; // e.g. 1 USDT = 1480 NGN
  safetySpreadPct: number; // 0.05 (5%)
}

export const FX_RATES: Record<string, MultiCurrencyRate> = {
  NGN: { currency: "NGN", rateAgainstNgn: 1.0, safetySpreadPct: 0.0 },
  USDT: { currency: "USDT", rateAgainstNgn: 1480.0, safetySpreadPct: 0.05 },
  KES: { currency: "KES", rateAgainstNgn: 11.45, safetySpreadPct: 0.05 },
  GHS: { currency: "GHS", rateAgainstNgn: 96.5, safetySpreadPct: 0.05 },
  XOF: { currency: "XOF", rateAgainstNgn: 2.45, safetySpreadPct: 0.05 },
};

export class WalletLedgerService {
  /**
   * Initializes a brand-new user wallet with the endowed 200.000 locked bonus
   */
  public static createInitialWallet(userId: string): Wallet {
    return {
      id: `w_${userId}`,
      userId,
      locked_bonus: 200.0,
      earned_balance: 0.0,
      pending_referral_balance: 0.0,
      bonus_claimed: false,
      total_withdrawn: 0.0,
    };
  }

  /**
   * Per-GC Strict Decimal Payout Formula (100+ Members Minimum)
   * Math.min(members, 1000) / 1000
   * Any GC < 100 members pays exactly 0.000
   */
  public static calculateGcPayout(
    group: { memberCount: number; status: string; isWorkerAdmin: boolean },
    mode: BroadcastMode,
  ): {
    qualified: boolean;
    reason?: string;
    stepOneStatusCoins: number;
    stepTwoHidetagCoins: number;
    totalCoins: number;
  } {
    if (!Number.isSafeInteger(group.memberCount) || group.memberCount < 100) {
      return {
        qualified: false,
        reason: `Group has ${group.memberCount} members (minimum 100 required). 0.000 coins awarded.`,
        stepOneStatusCoins: 0.0,
        stepTwoHidetagCoins: 0.0,
        totalCoins: 0.0,
      };
    }

    if (group.status !== "OPEN") {
      return {
        qualified: false,
        reason:
          "Group messaging locked to admins and worker is not an admin. 0.000 coins awarded.",
        stepOneStatusCoins: 0.0,
        stepTwoHidetagCoins: 0.0,
        totalCoins: 0.0,
      };
    }

    // Strict 1,000 member cap for math
    const effectiveMembers = Math.min(group.memberCount, 1000);
    // 0.001 Coin per member
    const baseCoins = Number((effectiveMembers / 1000).toFixed(3));

    if (mode === "ALLSTATUS_1X") {
      return {
        qualified: true,
        stepOneStatusCoins: baseCoins,
        stepTwoHidetagCoins: 0.0,
        totalCoins: baseCoins,
      };
    } else {
      // ALLCHAT_2X_VIP: Double work = Group Status + Hidetag Chat ping
      return {
        qualified: true,
        stepOneStatusCoins: baseCoins,
        stepTwoHidetagCoins: baseCoins,
        totalCoins: Number((baseCoins * 2).toFixed(3)),
      };
    }
  }

  /**
   * Evaluates withdrawal eligibility under the Ironclad Lock
   * - Minimum cashout: 500.000 Coins
   * - Unlocks ONLY when: earned_balance >= 300.000 Coins
   * - First withdrawal combines 300.000 earned + 200.000 locked bonus = 500.000 Coins,
   *   then permanently sets locked_bonus = 0.000 and bonus_claimed = true.
   * - Subsequent withdrawals require earned_balance >= 500.000.
   */
  public static evaluateWithdrawalLock(wallet: Wallet): {
    canWithdraw: boolean;
    availableCashoutCoins: number;
    coinsNeededToUnlock: number;
    reason: string;
    isFirstWithdrawal: boolean;
  } {
    const check = withdrawalEligibility(
      toMilli(wallet.earned_balance),
      toMilli(wallet.locked_bonus),
      wallet.bonus_claimed,
    );
    return {
      canWithdraw: check.canWithdraw,
      availableCashoutCoins: check.canWithdraw
        ? check.availableMilli / 1000
        : 0,
      coinsNeededToUnlock: check.neededMilli / 1000,
      reason: check.canWithdraw
        ? "Eligible under the documented rules. Payout provider still required."
        : `Earn ${(check.neededMilli / 1000).toFixed(3)} more Coins to meet the withdrawal requirements.`,
      isFirstWithdrawal: !wallet.bonus_claimed,
    };
  }

  /**
   * Pure withdrawal calculation ONLY. Not a database transaction or payment execution.
   */
  public static executeWithdrawal(
    wallet: Wallet,
    coinsToCashout: number,
  ): {
    updatedWallet: Wallet;
    cashedOutCoins: number;
    cashedOutNgn: number;
  } {
    const amountMilli = toMilli(coinsToCashout);
    const result = validateWithdrawal(
      toMilli(wallet.earned_balance),
      toMilli(wallet.locked_bonus),
      wallet.bonus_claimed,
      amountMilli,
    );
    return {
      updatedWallet: {
        ...wallet,
        earned_balance: result.earnedMilli / 1000,
        locked_bonus: result.lockedMilli / 1000,
        bonus_claimed: result.bonusClaimed,
        total_withdrawn: (toMilli(wallet.total_withdrawn) + amountMilli) / 1000,
      },
      cashedOutCoins: amountMilli / 1000,
      cashedOutNgn: amountMilli / 1000,
    };
  }

  /**
   * Multi-Currency Withdrawal Converter with 5% Safety Spread
   */
  public static convertCoinsToCurrency(
    coins: number,
    currency: "NGN" | "USDT" | "KES" | "GHS" | "XOF",
  ): {
    amount: number;
    currency: string;
    rateUsed: number;
    safetySpreadDeduction: number;
  } {
    const ngnValue = coins * 1.0;
    const fx = FX_RATES[currency] || FX_RATES.NGN;

    if (currency === "NGN") {
      return {
        amount: Number(ngnValue.toFixed(2)),
        currency: "NGN",
        rateUsed: 1.0,
        safetySpreadDeduction: 0,
      };
    }

    // Safety spread calculation
    const rawForeign = ngnValue / fx.rateAgainstNgn;
    const spreadDeduction = rawForeign * fx.safetySpreadPct;
    const finalAmount = rawForeign - spreadDeduction;

    return {
      amount: Number(finalAmount.toFixed(currency === "USDT" ? 2 : 2)),
      currency,
      rateUsed: fx.rateAgainstNgn,
      safetySpreadDeduction: Number(spreadDeduction.toFixed(2)),
    };
  }

  /**
   * Anti-Re-Pair JID Check
   * If a WhatsApp JID was previously paired and cashed out on another account,
   * zero out the 200.000 bonus on the second account.
   */
  public static applyAntiRePairCheck(
    wallet: Wallet,
    jid: string,
    historyLedger: Set<string>,
  ): { wallet: Wallet; wasRePaired: boolean } {
    if (historyLedger.has(jid)) {
      const updated = {
        ...wallet,
        locked_bonus: 0.0,
      };
      return { wallet: updated, wasRePaired: true };
    }
    return { wallet, wasRePaired: false };
  }
}
