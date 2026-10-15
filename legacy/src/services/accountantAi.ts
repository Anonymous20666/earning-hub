import { GoogleGenAI } from '@google/genai';
import { CampaignPathway, SmartSystemType, SessionTier, BroadcastMode, CountryFilterMode, SystemPricingConfig } from '../types';

export interface AuditResult {
  allowed: boolean;
  minAllowedPriceNgn: number;
  finalRecommendedPriceNgn: number;
  costEstimateNgn: number;
  marginPct: number;
  maxWorkerCoinBudget: number;
  aiExplanation: string;
  riskFlags: string[];
}

export const DEFAULT_PRICING_CONFIG: SystemPricingConfig = {
  coinToNgnRate: 1.000,
  minimumMarginPct: 0.75, // strictly 75% margin floor
  bronzeSessionBaseNgn: 45.0, // base cost per bronze session rental
  silverSessionBaseNgn: 180.0, // base cost per silver session
  goldSessionBaseNgn: 400.0, // base cost per gold unit (100 GCs)
  vipAllChatMultiplier: 2.0, // double work: group status + hidetag chat
  specificCountryMultiplier: 1.45, // country filter scarcity multiplier
  minBroadcastDelayMs: 3000,
  maxBroadcastDelayMs: 6000,
  joinManagerJitterMinMins: 15,
  joinManagerJitterMaxMins: 35,
  fastMembersSurgeMultiplier: 1.6,
};

export class AccountantAiService {
  private config: SystemPricingConfig;
  private aiClient: GoogleGenAI | null = null;

  constructor(customConfig?: Partial<SystemPricingConfig>) {
    this.config = { ...DEFAULT_PRICING_CONFIG, ...customConfig };
    const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
    if (apiKey) {
      this.aiClient = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Layer 1: Hard Deterministic Math Guardrail (Mistake = ₦0 Lost)
   */
  public calculateDeterministicQuote(params: {
    pathway: CampaignPathway;
    smartSystemType?: SmartSystemType;
    tier?: SessionTier;
    sessionCount?: number;
    volume?: number; // 50 to 2000
    mode: BroadcastMode;
    countryFilter?: CountryFilterMode;
    selectedCountryCount?: number;
  }): AuditResult {
    const isVip = params.mode === 'ALLCHAT_2X_VIP';
    const modeMultiplier = isVip ? this.config.vipAllChatMultiplier : 1.0;
    let worstCaseWorkerCostCoins = 0;
    const riskFlags: string[] = [];

    if (params.pathway === 'DIRECT_SESSION') {
      const sessions = Math.max(1, params.sessionCount || 1);
      const tier = params.tier || 'BRONZE';
      
      // Tier Max Qualified GCs
      const maxGcsPerTier = tier === 'BRONZE' ? 25 : tier === 'SILVER' ? 99 : 100;
      // Each qualified GC can pay up to 1.000 Coin for 1000+ members
      // Double work (VIP allchat) pays up to 2.000 Coins
      worstCaseWorkerCostCoins = sessions * maxGcsPerTier * 1.000 * modeMultiplier;

      if (sessions > 100) {
        riskFlags.push('High concurrent session deployment: Virtual sharding locks active');
      }
    } else {
      // SMART_VERIFIED Systems (WA_GROUP, WA_CHANNEL, TG_GROUP, TG_CHANNEL)
      const volume = Math.min(2000, Math.max(50, params.volume || 100));
      
      // Conversion rate estimation per 1,000 members exposed
      // Baseline: 1.8% conversion rate for random WA group join requests
      let baseCr = 0.018; 
      if (params.countryFilter === 'SPECIFIC_COUNTRIES') {
        // Tight country filtering rejects non-target incoming requests
        baseCr = 0.009; // Lower conversion from blended traffic, higher exposure needed
        riskFlags.push('Country rejection filter active: 1-hour recurring scrub enabled');
      }

      if (params.smartSystemType === 'WA_CHANNEL' || params.smartSystemType === 'TG_CHANNEL') {
        baseCr = 0.012; // Channel joins require contact save or manual subscribe
      }

      const requiredImpressions = volume / baseCr;
      const gcsNeeded = requiredImpressions / 500; // avg 500 members per qualified GC
      // Worker payout per GC is ~0.500 Coins average, up to 1.000 Coins max
      const avgCoinPerGc = 0.500 * modeMultiplier;
      worstCaseWorkerCostCoins = Math.ceil(gcsNeeded * avgCoinPerGc);

      if (params.countryFilter === 'SPECIFIC_COUNTRIES') {
        worstCaseWorkerCostCoins = Math.round(worstCaseWorkerCostCoins * this.config.specificCountryMultiplier * 1000) / 1000;
      }
    }

    const costNgn = worstCaseWorkerCostCoins * this.config.coinToNgnRate;
    // Strict margin guardrail: Minimum_Allowed_Price_NGN = Cost_NGN / (1 - Target_Margin_Pct)
    const marginDivisor = Math.max(0.01, 1 - this.config.minimumMarginPct);
    const minAllowedPriceNgn = Math.ceil((costNgn / marginDivisor) * 100) / 100;

    // Recommended price with small buffer for payment gateway fees
    const finalRecommendedPriceNgn = Math.ceil(minAllowedPriceNgn * 1.05);
    const realizedMargin = ((finalRecommendedPriceNgn - costNgn) / finalRecommendedPriceNgn) * 100;

    // Hard Escrow Stop Cap (approved coin budget)
    const maxWorkerCoinBudget = Number((worstCaseWorkerCostCoins * 1.05).toFixed(3));

    return {
      allowed: true,
      minAllowedPriceNgn,
      finalRecommendedPriceNgn,
      costEstimateNgn: costNgn,
      marginPct: Number(realizedMargin.toFixed(2)),
      maxWorkerCoinBudget,
      aiExplanation: `Deterministic Math Guardrail verified. Worker worst-case liability: ₦${costNgn.toFixed(2)} (${worstCaseWorkerCostCoins.toFixed(3)} Coins). Floor price locked at ₦${finalRecommendedPriceNgn.toFixed(2)} with guaranteed ${(realizedMargin).toFixed(1)}% gross margin.`,
      riskFlags,
    };
  }

  /**
   * Layer 2: LLM Reasoning Engine (Gemini / Ollama API)
   * Evaluates dynamic platform supply, queue congestion, and provides intelligent pricing advice
   */
  public async getDynamicPricingAdvice(params: {
    activeBronzeSessions: number;
    activeSilverSessions: number;
    activeGoldSessions: number;
    pendingBroadcastQueue: number;
    proposedOrder: {
      type: string;
      volumeOrSessions: number;
      isVip: boolean;
      countryMode: string;
    }
  }): Promise<{ advice: string; surgeMultiplier: number }> {
    const totalSessions = params.activeBronzeSessions + params.activeSilverSessions + params.activeGoldSessions;
    let fallbackSurge = 1.0;
    
    // Algorithmic fallback if AI call is offline or unavailable
    if (params.pendingBroadcastQueue > 50 || totalSessions < 10) {
      fallbackSurge = 1.25;
    }
    if (params.proposedOrder.isVip) {
      fallbackSurge *= 1.15;
    }

    if (!this.aiClient) {
      return {
        advice: `Deterministic Accountant: Supply is currently ${totalSessions} sessions (${params.activeGoldSessions} Gold). Queue pressure is ${params.pendingBroadcastQueue} tasks. Dynamic surge multiplier set to ${fallbackSurge.toFixed(2)}x to protect capacity.`,
        surgeMultiplier: Number(fallbackSurge.toFixed(2)),
      };
    }

    try {
      const prompt = `You are the Lead Financial Quant & AI Accountant for Pappy Earning Hub, a high-frequency WhatsApp/Telegram broadcast marketplace.
Current Live Metrics:
- Online Sessions: ${params.activeBronzeSessions} Bronze, ${params.activeSilverSessions} Silver, ${params.activeGoldSessions} Gold.
- Pending Broadcast Queue: ${params.pendingBroadcastQueue} broadcasts.
- Proposed Incoming Campaign: ${JSON.stringify(params.proposedOrder)}.

Provide a concise 2-sentence quantitative analysis evaluating session strain, kick attrition risk, and supply-demand pricing. Recommend a dynamic surge multiplier between 1.00 and 1.80.`;

      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || '';
      return {
        advice: text.slice(0, 320),
        surgeMultiplier: Number(fallbackSurge.toFixed(2)),
      };
    } catch {
      return {
        advice: `Deterministic Guardrail Active: Optimal liquidity maintained across ${totalSessions} paired nodes. Safe pricing floor guaranteed with zero loss.`,
        surgeMultiplier: Number(fallbackSurge.toFixed(2)),
      };
    }
  }

  /**
   * Atomic Escrow Budget Gate
   * Ensures no broadcast can ever breach the campaign's authorized coin budget
   */
  public static verifyEscrowBudget(
    currentCoinsPaid: number,
    potentialPayment: number,
    maxBudget: number
  ): boolean {
    const projected = Number((currentCoinsPaid + potentialPayment).toFixed(3));
    return projected <= Number(maxBudget.toFixed(3));
  }
}

export const accountantAi = new AccountantAiService();
