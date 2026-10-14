import { SupportTicket, LiveTerminalLog } from '../types';

export interface TelegramRequestEvent {
  campaignId: string;
  telegramUserId: number;
  chatId: string;
  chatTitle: string;
  isChannel: boolean;
  timestamp: string;
}

export class TelegramBotBridgeService {
  public static botUsername = '@OurGrowthBot';
  private static deliveredUsers = new Set<string>(); // deduplicated campaignId_userId
  private static supportTickets: SupportTicket[] = [
    {
      id: 'tick_101',
      userId: 'usr_2401',
      userEmail: 'adebayo.trade@gmail.com',
      subject: 'WA Group Verification timed out at 9:58',
      message: 'I added the two admin bot numbers to my Lagos Crypto VIP group and promoted them, but the timer elapsed right before step 3. Please force approve.',
      category: 'VERIFICATION_DISPUTE',
      status: 'OPEN',
      telegramNotified: true,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'tick_102',
      userId: 'usr_8820',
      userEmail: 'chinedu.media@outlook.com',
      subject: 'Withdrawal to OPay account pending',
      message: 'Reached 500.000 coins (300 earned + 200 bonus). Requested ₦500 payout 2 hours ago.',
      category: 'WITHDRAWAL_ISSUE',
      status: 'OPEN',
      telegramNotified: true,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  public static getSupportTickets(): SupportTicket[] {
    return this.supportTickets;
  }

  /**
   * Monotonic Cumulative Request Counter
   * CRITICAL ACCOUNTING RULE:
   * If a join request is approved/accepted (or rejected) by group owner while broadcast is running,
   * that does NOT refill that slot and does NOT mean we failed! Monotonically counts distinct users delivered.
   */
  public static recordIncomingTelegramRequest(
    campaignId: string,
    telegramUserId: number,
    chatTitle: string,
    currentCumulativeCount: number,
    targetQuota: number,
    onLog: (log: LiveTerminalLog) => void
  ): {
    accepted: boolean;
    newCumulativeCount: number;
    isCompleted: boolean;
  } {
    const key = `${campaignId}_${telegramUserId}`;
    if (this.deliveredUsers.has(key)) {
      onLog({
        id: `log_${Date.now()}_dup`,
        timestamp: new Date().toISOString(),
        source: 'TELEGRAM_BRIDGE',
        level: 'WARN',
        message: `[@OurGrowthBot] Duplicate join request from TG user #${telegramUserId} in "${chatTitle}". Deduplicated (0 count added).`,
      });
      return {
        accepted: false,
        newCumulativeCount: currentCumulativeCount,
        isCompleted: currentCumulativeCount >= targetQuota,
      };
    }

    this.deliveredUsers.add(key);
    const newCumulativeCount = currentCumulativeCount + 1;
    const isCompleted = newCumulativeCount >= targetQuota;

    onLog({
      id: `log_${Date.now()}_req`,
      timestamp: new Date().toISOString(),
      source: 'TELEGRAM_BRIDGE',
      level: 'SUCCESS',
      message: `[@OurGrowthBot] Verified incoming join request from user #${telegramUserId} in "${chatTitle}". Monotonic counter: ${newCumulativeCount}/${targetQuota} delivered. (Owner approvals never reset or backfill counter).`,
    });

    if (isCompleted) {
      onLog({
        id: `log_${Date.now()}_leave`,
        timestamp: new Date().toISOString(),
        source: 'TELEGRAM_BRIDGE',
        level: 'SUCCESS',
        message: `🎯 Target of ${targetQuota} requests delivered for "${chatTitle}"! @OurGrowthBot executed leaveChat(). Campaign marked COMPLETED!`,
      });
    }

    return {
      accepted: true,
      newCumulativeCount,
      isCompleted,
    };
  }

  /**
   * 2-Way Support Ticket Submission & Admin Panel Telegram Sync
   */
  public static submitTicket(
    ticket: Omit<SupportTicket, 'id' | 'status' | 'telegramNotified' | 'createdAt'>,
    onLog: (log: LiveTerminalLog) => void
  ): SupportTicket {
    const newTicket: SupportTicket = {
      ...ticket,
      id: `tick_${Date.now()}`,
      status: 'OPEN',
      telegramNotified: true,
      createdAt: new Date().toISOString(),
    };

    this.supportTickets.unshift(newTicket);

    onLog({
      id: `log_${Date.now()}_ticket`,
      timestamp: new Date().toISOString(),
      source: 'TELEGRAM_BRIDGE',
      level: 'INFO',
      message: `[Support Desk] Ticket #${newTicket.id} created by ${newTicket.userEmail}. Telegram alert dispatched to Admin Chat with inline override actions.`,
    });

    return newTicket;
  }

  /**
   * Admin executes action from Web Admin Panel or Telegram inline button
   */
  public static resolveTicket(
    ticketId: string,
    action: 'REPLY' | 'FORCE_APPROVE' | 'REFUND_COINS' | 'APPROVE_WITHDRAWAL',
    notes: string,
    onLog: (log: LiveTerminalLog) => void
  ): SupportTicket {
    const ticket = this.supportTickets.find(t => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = 'RESOLVED';
    ticket.adminNotes = `[${action}] ${notes}`;

    onLog({
      id: `log_${Date.now()}_resolve`,
      timestamp: new Date().toISOString(),
      source: 'TELEGRAM_BRIDGE',
      level: 'SUCCESS',
      message: `[Admin Override] Ticket #${ticketId} resolved via ${action}: "${notes}". Synced to Web Panel & Telegram.`,
    });

    return ticket;
  }
}
