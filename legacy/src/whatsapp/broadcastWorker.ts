import { SessionGroup, Campaign, BroadcastMode, LiveTerminalLog } from '../types';
import { WalletLedgerService } from '../services/walletLedger';
import { LinkPreviewEngine } from './linkPreviewEngine';
import { AccountantAiService } from '../services/accountantAi';

export interface BroadcastDeliveryEvent {
  campaignId: string;
  sessionId: string;
  groupId: string;
  groupSubject: string;
  memberCount: number;
  mode: BroadcastMode;
  stepOneSuccess: boolean;
  stepTwoSuccess?: boolean;
  coinsEarned: number;
  deliveryTimestamp: string;
  wasKicked: boolean;
}

export class BroadcastWorker {
  /**
   * Executes a safe simulated plogme broadcast cycle with anti-ban delay,
   * rich link preview cards, spin tags, and strict decimal coin crediting.
   */
  public static async broadcastToGroup(
    campaign: Campaign,
    group: SessionGroup,
    onLog: (log: LiveTerminalLog) => void
  ): Promise<BroadcastDeliveryEvent> {
    const isVip = campaign.broadcastMode === 'ALLCHAT_2X_VIP';
    const spinTag = LinkPreviewEngine.generateAntiBanSpinTag();
    const finalPayload = `${campaign.messagePayload.caption}\n\n${campaign.targetUrl}${spinTag}`;

    // 1. Audit Qualification: 100+ members, open group
    const qualification = WalletLedgerService.calculateGcPayout(group, campaign.broadcastMode);
    if (!qualification.qualified) {
      onLog({
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toISOString(),
        source: 'BROADCAST_WORKER',
        level: 'WARN',
        message: `Group [${group.subject}] disqualified: ${qualification.reason}`,
      });
      return {
        campaignId: campaign.id,
        sessionId: group.sessionId,
        groupId: group.id,
        groupSubject: group.subject,
        memberCount: group.memberCount,
        mode: campaign.broadcastMode,
        stepOneSuccess: false,
        coinsEarned: 0.000,
        deliveryTimestamp: new Date().toISOString(),
        wasKicked: false,
      };
    }

    // 2. Escrow Budget Check
    const allowedByBudget = AccountantAiService.verifyEscrowBudget(
      campaign.coinsPaidToWorkers,
      qualification.totalCoins,
      campaign.maxWorkerCoinBudget
    );

    if (!allowedByBudget) {
      onLog({
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toISOString(),
        source: 'AI_ACCOUNTANT',
        level: 'LOCK',
        message: `Escrow Stop! Campaign #${campaign.id.slice(0, 6)} hit budget cap (${campaign.maxWorkerCoinBudget} Coins). Halted further group dispatches.`,
      });
      throw new Error('CAMPAIGN_BUDGET_REACHED');
    }

    // 3. Step 1: Send to Group Status (groupStatusMessageV2)
    onLog({
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
      source: 'BROADCAST_WORKER',
      level: 'INFO',
      message: `[plogme] Dispatching groupStatusMessageV2 to [${group.subject}] (${group.memberCount} members) with Rich Link Preview card...`,
      metadata: { spinTag, url: campaign.targetUrl },
    });

    const stepOneReward = qualification.stepOneStatusCoins;

    if (!isVip) {
      // 1x Standard complete
      onLog({
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toISOString(),
        source: 'BROADCAST_WORKER',
        level: 'SUCCESS',
        message: `[200 OK] Status delivered to [${group.subject}]. +${stepOneReward.toFixed(3)} Coins credited to worker.`,
      });

      return {
        campaignId: campaign.id,
        sessionId: group.sessionId,
        groupId: group.id,
        groupSubject: group.subject,
        memberCount: group.memberCount,
        mode: campaign.broadcastMode,
        stepOneSuccess: true,
        coinsEarned: stepOneReward,
        deliveryTimestamp: new Date().toISOString(),
        wasKicked: false,
      };
    }

    // 4. Step 2 (VIP Mode): Wait 3-6s and execute Hidetag in Group Chat
    onLog({
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
      source: 'BROADCAST_WORKER',
      level: 'INFO',
      message: `[VIP allchat] Step 1 OK (+${stepOneReward.toFixed(3)} Coins). Waiting 4s jitter before Step 2 Hidetag Chat blast...`,
    });

    // Simulate Hidetag chat blast: mentions all participants
    const stepTwoReward = qualification.stepTwoHidetagCoins;
    const totalVipCoins = qualification.totalCoins;

    // Simulate kick risk: small ~3% chance on aggressive hidetag blast in unmoderated group
    const kickRoll = Math.random();
    const wasKicked = kickRoll < 0.03 && !group.isWorkerAdmin;

    if (wasKicked) {
      onLog({
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toISOString(),
        source: 'STATE_PLANE',
        level: 'WARN',
        message: `[Kick Alert] Worker removed from [${group.subject}] after hidetag ping. Session group status set to KICKED. Queueing replacement link from Validator Hub!`,
      });
    } else {
      onLog({
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toISOString(),
        source: 'BROADCAST_WORKER',
        level: 'SUCCESS',
        message: `[VIP 200 OK] Hidetag chat delivered to ${group.memberCount} members in [${group.subject}]. +${totalVipCoins.toFixed(3)} Total Coins credited (2x Double Work).`,
      });
    }

    return {
      campaignId: campaign.id,
      sessionId: group.sessionId,
      groupId: group.id,
      groupSubject: group.subject,
      memberCount: group.memberCount,
      mode: campaign.broadcastMode,
      stepOneSuccess: true,
      stepTwoSuccess: !wasKicked,
      coinsEarned: totalVipCoins,
      deliveryTimestamp: new Date().toISOString(),
      wasKicked,
    };
  }
}
