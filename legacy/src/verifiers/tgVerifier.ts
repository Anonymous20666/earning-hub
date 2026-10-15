import { Campaign, LiveTerminalLog } from '../types';

export interface TelegramWebhookEvent {
  update_id: number;
  chat_id: string | number;
  chat_title: string;
  is_channel: boolean;
  event_type: 'chat_join_request' | 'chat_member_joined' | 'chat_join_request_approved_by_owner' | 'chat_join_request_declined_by_owner';
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  date: number;
}

export interface TelegramCampaignSession {
  campaignId: string;
  chatId: string;
  chatTitle: string;
  isChannel: boolean;
  botUsername: string; // "@OurGrowthBot"
  requestedVolume: number;
  cumulativeRequestsReceived: number; // Strict monotonic counter
  deliveredUserIds: Set<number>;
  status: 'AWAITING_BOT_ADMIN' | 'VERIFIED_RUNNING' | 'COMPLETED';
  startedAt: string;
  completedAt?: string;
}

export class TelegramVerifierService {
  public static readonly OFFICIAL_BOT_USERNAME = '@OurGrowthBot';
  // Persistent in-memory ledger of delivered (campaignId_telegramUserId) to guarantee idempotency & zero double-counting
  private static deliveredUserRegistry = new Set<string>();

  /**
   * Initializes Telegram Group or Channel Campaign Session
   */
  public static initiateTelegramVerification(
    campaign: Campaign,
    chatIdOrUsername: string,
    chatTitle: string,
    isChannel: boolean,
    onLog: (log: LiveTerminalLog) => void
  ): TelegramCampaignSession {
    onLog({
      id: `tg_init_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'TELEGRAM_BRIDGE',
      level: 'INFO',
      message: `[${isChannel ? 'TG_CHANNEL' : 'TG_GROUP'}] Handshake started for "${chatTitle}" (${chatIdOrUsername}). Add ${this.OFFICIAL_BOT_USERNAME} as Administrator with "Invite Users via Link" / "Manage Join Requests" permission.`,
    });

    return {
      campaignId: campaign.id,
      chatId: chatIdOrUsername,
      chatTitle,
      isChannel,
      botUsername: this.OFFICIAL_BOT_USERNAME,
      requestedVolume: campaign.requestedVolume || 100,
      cumulativeRequestsReceived: 0,
      deliveredUserIds: new Set<number>(),
      status: 'AWAITING_BOT_ADMIN',
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Simulates bot added as Admin in the Telegram Group or Channel
   */
  public static verifyBotAdminRights(
    session: TelegramCampaignSession,
    onLog: (log: LiveTerminalLog) => void
  ): TelegramCampaignSession {
    onLog({
      id: `tg_admin_ok_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'TELEGRAM_BRIDGE',
      level: 'SUCCESS',
      message: `[${this.OFFICIAL_BOT_USERNAME}] Administrator rights confirmed in "${session.chatTitle}"! Monotonic request counter initialized to 0. Broadcast unlocked.`,
    });

    return {
      ...session,
      status: 'VERIFIED_RUNNING',
    };
  }

  /**
   * Webhook Listener for chat_join_request & chat_member events
   * ENFORCES THE STRICT MONOTONIC COUNTING INVARIANT:
   * 1. Monotonically increments per unique telegram_user_id.
   * 2. If the owner approves or declines a join request, DO NOT decrement and DO NOT backfill!
   *    An approved request is a successfully delivered conversion.
   */
  public static processTelegramWebhookEvent(
    session: TelegramCampaignSession,
    event: TelegramWebhookEvent,
    onLog: (log: LiveTerminalLog) => void
  ): {
    updatedSession: TelegramCampaignSession;
    wasCounted: boolean;
    reason: string;
  } {
    const registryKey = `${session.campaignId}_${event.from.id}`;

    // RULE 1: Owner approves or declines an existing request while broadcast runs
    if (
      event.event_type === 'chat_join_request_approved_by_owner' ||
      event.event_type === 'chat_join_request_declined_by_owner'
    ) {
      onLog({
        id: `tg_owner_action_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'TELEGRAM_BRIDGE',
        level: 'INFO',
        message: `[CRITICAL ACCOUNTING RULE] Group/Channel Owner ${event.event_type === 'chat_join_request_approved_by_owner' ? 'APPROVED' : 'DECLINED'} request for user @${event.from.username || event.from.id} in "${session.chatTitle}". Counter remains locked at ${session.cumulativeRequestsReceived}/${session.requestedVolume}. Zero backfill triggered.`,
      });

      return {
        updatedSession: session,
        wasCounted: false,
        reason: 'Owner approval or decline does NOT alter monotonic counter or trigger backfill.',
      };
    }

    // RULE 2: Deduplicate unique telegram user id
    if (this.deliveredUserRegistry.has(registryKey) || session.deliveredUserIds.has(event.from.id)) {
      onLog({
        id: `tg_dup_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'TELEGRAM_BRIDGE',
        level: 'WARN',
        message: `[@OurGrowthBot] Duplicate join request from TG user @${event.from.username || event.from.id} in "${session.chatTitle}". Deduplicated (0 count added).`,
      });

      return {
        updatedSession: session,
        wasCounted: false,
        reason: 'User ID was already delivered and recorded.',
      };
    }

    // RULE 3: Increment monotonic counter
    this.deliveredUserRegistry.add(registryKey);
    const newDeliveredSet = new Set(session.deliveredUserIds);
    newDeliveredSet.add(event.from.id);

    const newCumulative = session.cumulativeRequestsReceived + 1;
    const isCompleted = newCumulative >= session.requestedVolume;

    onLog({
      id: `tg_counted_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'TELEGRAM_BRIDGE',
      level: 'SUCCESS',
      message: `[@OurGrowthBot Webhook] Verified incoming ${event.event_type} from @${event.from.username || event.from.id}. Monotonic counter: ${newCumulative}/${session.requestedVolume} delivered.`,
    });

    // RULE 4: Once target reached, call leaveChat() and mark COMPLETED
    if (isCompleted) {
      onLog({
        id: `tg_leave_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'TELEGRAM_BRIDGE',
        level: 'SUCCESS',
        message: `🎯 Target of ${session.requestedVolume} requests delivered for "${session.chatTitle}"! @OurGrowthBot executed bot.telegram.leaveChat(${session.chatId}). Campaign marked COMPLETED!`,
      });
    }

    const updatedSession: TelegramCampaignSession = {
      ...session,
      cumulativeRequestsReceived: newCumulative,
      deliveredUserIds: newDeliveredSet,
      status: isCompleted ? 'COMPLETED' : session.status,
      completedAt: isCompleted ? new Date().toISOString() : undefined,
    };

    return {
      updatedSession,
      wasCounted: true,
      reason: `Monotonic counter incremented to ${newCumulative}/${session.requestedVolume}.`,
    };
  }
}
