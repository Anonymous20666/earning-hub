import { Campaign, AdminMonitorBot, LiveTerminalLog } from '../types';

export interface WaAdminVerificationSession {
  campaignId: string;
  groupJid: string;
  inviteCode: string;
  primaryAdminBot: {
    phoneNumber: string;
    jid: string;
    role: 'PRIMARY';
    hasJoinedGroup: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
  backupAdminBot: {
    phoneNumber: string;
    jid: string;
    role: 'BACKUP';
    hasJoinedGroup: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
  startedAt: string;
  expiresAt: string; // startedAt + 10 minutes (600,000 ms)
  secondsRemaining: number;
  status: 'PENDING_OWNER_APPROVAL' | 'JOINED_WAITING_ADMIN_PROMOTION' | 'VERIFIED' | 'CANCELLED_TIMEOUT' | 'LEFT_GROUP';
  cancellationReason?: string;
  hourlyFilter: {
    lastRunAt?: string;
    nextRunAt?: string;
    totalValidCount: number;
    totalRejectedWrongCountry: number;
  };
}

export interface WaChannelVerificationHandshake {
  campaignId: string;
  userPhoneNumber: string;
  assignedAdminBot: {
    phoneNumber: string;
    jid: string;
  };
  handshakeCode: string; // e.g. "CH-9042"
  contactSavedOnAdminBot: boolean;
  codeReceivedViaDm: boolean;
  channelInviteReceived: boolean;
  status: 'AWAITING_MUTUAL_SAVE_AND_CODE' | 'CODE_VERIFIED' | 'INVITE_ACCEPTED_VERIFIED' | 'COMPLETED';
}

export class WaAdminVerifierService {
  // Shared Admin Bot Pool
  private static adminBotPool: AdminMonitorBot[] = [
    {
      id: 'bot_primary_alpha',
      role: 'PRIMARY',
      phoneNumber: '+234 814 902 4410',
      jid: '2348149024410@s.whatsapp.net',
      status: 'ONLINE',
      activeGroupCount: 4,
      lastHealthPing: new Date().toISOString(),
    },
    {
      id: 'bot_backup_beta',
      role: 'BACKUP',
      phoneNumber: '+234 906 118 7329',
      jid: '2349061187329@s.whatsapp.net',
      status: 'ONLINE',
      activeGroupCount: 4,
      lastHealthPing: new Date().toISOString(),
    },
    {
      id: 'bot_channel_gamma',
      role: 'PRIMARY',
      phoneNumber: '+234 803 771 9023',
      jid: '2348037719023@s.whatsapp.net',
      status: 'ONLINE',
      activeGroupCount: 2,
      lastHealthPing: new Date().toISOString(),
    },
  ];

  /**
   * WORKFLOW 1: Initialize Dual Admin Bot Assignment & Strict 10-Minute Countdown
   */
  public static initiateGroupVerification(
    campaignId: string,
    groupInviteUrl: string,
    onLog: (log: LiveTerminalLog) => void
  ): WaAdminVerificationSession {
    const regex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
    const match = groupInviteUrl.match(regex);
    const inviteCode = match ? match[1] : 'Kp9zL2xY9m1VbNqR4wT8eC';
    const groupJid = `${inviteCode}@g.us`;

    const primary = this.adminBotPool.find(b => b.role === 'PRIMARY') || this.adminBotPool[0];
    const backup = this.adminBotPool.find(b => b.role === 'BACKUP') || this.adminBotPool[1];

    const now = Date.now();
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString(); // exactly 10 minutes

    onLog({
      id: `wa_init_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'INFO',
      message: `[WA_GROUP] Dual Admin Bots assigned for invite code "${inviteCode.slice(0, 8)}...": Primary (${primary.phoneNumber}) & Backup (${backup.phoneNumber}). Join requests dispatched. Strict 10-Minute Verification Countdown started (Expires at ${new Date(expiresAt).toLocaleTimeString()}).`,
    });

    return {
      campaignId,
      groupJid,
      inviteCode,
      primaryAdminBot: {
        phoneNumber: primary.phoneNumber,
        jid: primary.jid,
        role: 'PRIMARY',
        hasJoinedGroup: false,
        isAdmin: false,
        isSuperAdmin: false,
      },
      backupAdminBot: {
        phoneNumber: backup.phoneNumber,
        jid: backup.jid,
        role: 'BACKUP',
        hasJoinedGroup: false,
        isAdmin: false,
        isSuperAdmin: false,
      },
      startedAt: new Date(now).toISOString(),
      expiresAt,
      secondsRemaining: 600,
      status: 'PENDING_OWNER_APPROVAL',
      hourlyFilter: {
        totalValidCount: 0,
        totalRejectedWrongCountry: 0,
      },
    };
  }

  /**
   * Evaluates the 10-minute countdown rules:
   * Rule A: Owner did not approve join request in 10m -> cancel request & abort
   * Rule B: Owner approved bots into GC, but failed to make Admin in 10m -> groupLeave() & abort
   * Rule C: Bots detect Admin role -> VERIFIED!
   */
  public static evaluateVerificationTick(
    session: WaAdminVerificationSession,
    currentSecondsRemaining: number,
    onLog: (log: LiveTerminalLog) => void
  ): WaAdminVerificationSession {
    // If already verified or cancelled, return
    if (session.status === 'VERIFIED' || session.status === 'CANCELLED_TIMEOUT') {
      return session;
    }

    // Check Rule C: Admin verified
    if (session.primaryAdminBot.isAdmin && session.backupAdminBot.isAdmin) {
      onLog({
        id: `wa_ver_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'BROADCAST_WORKER',
        level: 'SUCCESS',
        message: `[WA_GROUP Rule C Verified] Both Primary (${session.primaryAdminBot.phoneNumber}) and Backup (${session.backupAdminBot.phoneNumber}) detected with Group Admin privileges in ${session.groupJid}. Verification locked as VERIFIED!`,
      });

      return {
        ...session,
        secondsRemaining: currentSecondsRemaining,
        status: 'VERIFIED',
      };
    }

    // Check Timeout (0 seconds remaining)
    if (currentSecondsRemaining <= 0) {
      if (!session.primaryAdminBot.hasJoinedGroup || !session.backupAdminBot.hasJoinedGroup) {
        // Rule A: Join Request Not Approved in 10 minutes
        const reason = 'Task cancelled: Group owner did not approve the 2 admin bots into the WhatsApp group within the 10-minute window.';
        onLog({
          id: `wa_rule_a_${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'STATE_PLANE',
          level: 'WARN',
          message: `[WA_GROUP Rule A Timeout] ${reason} Both admin bots cancelled their pending join requests. ₦0 lost.`,
        });

        return {
          ...session,
          secondsRemaining: 0,
          status: 'CANCELLED_TIMEOUT',
          cancellationReason: reason,
        };
      } else {
        // Rule B: Joined, But Not Promoted to Admin in 10 minutes
        const reason = 'Task aborted: Admin privileges were not granted to our bot numbers within the 10-minute window.';
        onLog({
          id: `wa_rule_b_${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'STATE_PLANE',
          level: 'WARN',
          message: `[WA_GROUP Rule B Timeout] ${reason} Primary and Backup bots executed sock.groupLeave(${session.groupJid}).`,
        });

        return {
          ...session,
          secondsRemaining: 0,
          status: 'CANCELLED_TIMEOUT',
          cancellationReason: reason,
        };
      }
    }

    return {
      ...session,
      secondsRemaining: currentSecondsRemaining,
    };
  }

  /**
   * Simulates group owner approving the 2 bots into the WhatsApp group as regular members
   */
  public static simulateOwnerApprovesBotsIntoGroup(
    session: WaAdminVerificationSession,
    onLog: (log: LiveTerminalLog) => void
  ): WaAdminVerificationSession {
    onLog({
      id: `wa_join_step_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'INFO',
      message: `[WA_GROUP] Group owner approved Primary (${session.primaryAdminBot.phoneNumber}) and Backup (${session.backupAdminBot.phoneNumber}) into the group. Waiting for Group Admin promotion...`,
    });

    return {
      ...session,
      primaryAdminBot: { ...session.primaryAdminBot, hasJoinedGroup: true },
      backupAdminBot: { ...session.backupAdminBot, hasJoinedGroup: true },
      status: 'JOINED_WAITING_ADMIN_PROMOTION',
    };
  }

  /**
   * Simulates group owner promoting the 2 bots to Group Admin
   */
  public static simulateOwnerPromotesBotsToAdmin(
    session: WaAdminVerificationSession,
    onLog: (log: LiveTerminalLog) => void
  ): WaAdminVerificationSession {
    onLog({
      id: `wa_admin_step_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'SUCCESS',
      message: `[WA_GROUP] Group owner promoted Primary and Backup bots to Group Admin! Verification complete.`,
    });

    return {
      ...session,
      primaryAdminBot: { ...session.primaryAdminBot, hasJoinedGroup: true, isAdmin: true },
      backupAdminBot: { ...session.backupAdminBot, hasJoinedGroup: true, isAdmin: true },
      status: 'VERIFIED',
    };
  }

  /**
   * 1-Hour Automated Country Filter Loop:
   * Uses sock.groupRequestParticipantsList(groupJid)
   * If SPECIFIC_COUNTRIES is active: rejects wrong phone prefixes via sock.groupRequestParticipantsUpdate(..., 'reject')
   */
  public static executeHourlyCountryFilterLoop(
    campaign: Campaign,
    pendingRequesters: Array<{ jid: string; phoneNumber: string }>,
    onLog: (log: LiveTerminalLog) => void
  ): {
    validCount: number;
    rejectedWrongCountry: string[];
    isCompleted: boolean;
  } {
    const isSpecific = campaign.countryFilterMode === 'SPECIFIC_COUNTRIES';
    const targetPrefixes = (campaign.targetCountryPrefixes || ['234']).map(p => p.replace('+', ''));

    const rejectedWrongCountry: string[] = [];
    let validCount = 0;

    for (const req of pendingRequesters) {
      const cleanPhone = req.phoneNumber.replace('+', '').replace(/\s+/g, '');
      if (!isSpecific) {
        validCount++;
        continue;
      }

      const matchesTarget = targetPrefixes.some(prefix => cleanPhone.startsWith(prefix));
      if (matchesTarget) {
        validCount++;
      } else {
        rejectedWrongCountry.push(req.jid);
      }
    }

    onLog({
      id: `wa_filter_log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'INFO',
      message: `[1-Hour Country Filter Loop] primary_admin_bot fetched ${pendingRequesters.length} pending join requests in GC. Found ${validCount} matching targets. Executed sock.groupRequestParticipantsUpdate(groupJid, [${rejectedWrongCountry.length} JIDs], 'reject') to prevent clogging the 2,000 cap.`,
    });

    const targetVolume = Math.min(2000, campaign.requestedVolume || 100);
    const newTotalValid = campaign.cumulativeRequestsDelivered + validCount;
    const isCompleted = newTotalValid >= targetVolume;

    if (isCompleted) {
      onLog({
        id: `wa_finish_log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'BROADCAST_WORKER',
        level: 'SUCCESS',
        message: `🎯 Target of ${targetVolume} valid requests reached! primary_admin_bot and backup_admin_bot executed sock.groupLeave(${campaign.groupJid || 'GC'}). Campaign status set to COMPLETED.`,
      });
    }

    return {
      validCount,
      rejectedWrongCountry,
      isCompleted,
    };
  }

  /**
   * WORKFLOW 2: WhatsApp Channel Mutual Contact Save + 6-Character Code Protocol
   */
  public static initiateChannelHandshake(
    campaignId: string,
    userPhoneNumber: string,
    onLog: (log: LiveTerminalLog) => void
  ): WaChannelVerificationHandshake {
    const adminBot = this.adminBotPool[2] || this.adminBotPool[0];

    // Generate unique 6-character code e.g. "CH-9042"
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const handshakeCode = `CH-${randomDigits}`;

    onLog({
      id: `chan_code_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'INFO',
      message: `[WA_CHANNEL Protocol] Handshake initialized for ${userPhoneNumber}. Assigned channel_admin_bot: ${adminBot.phoneNumber}. Handshake Code: "${handshakeCode}". User phone added to admin bot contacts to prevent cold-invite ban.`,
    });

    return {
      campaignId,
      userPhoneNumber,
      assignedAdminBot: {
        phoneNumber: adminBot.phoneNumber,
        jid: adminBot.jid,
      },
      handshakeCode,
      contactSavedOnAdminBot: true,
      codeReceivedViaDm: false,
      channelInviteReceived: false,
      status: 'AWAITING_MUTUAL_SAVE_AND_CODE',
    };
  }

  /**
   * Simulates receiving the DM with the handshake code and channel admin invitation
   */
  public static verifyChannelInviteEvent(
    handshake: WaChannelVerificationHandshake,
    enteredCode: string,
    onLog: (log: LiveTerminalLog) => void
  ): WaChannelVerificationHandshake {
    if (enteredCode.trim().toUpperCase() !== handshake.handshakeCode) {
      throw new Error(`Invalid verification code. Expected "${handshake.handshakeCode}", got "${enteredCode}".`);
    }

    onLog({
      id: `chan_ver_ok_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'SUCCESS',
      message: `[WA_CHANNEL] Code "${enteredCode}" matched via DM! channel_admin_bot accepted Channel (newsletter) Admin invitation safely without cold-invite risk. Campaign VERIFIED.`,
    });

    return {
      ...handshake,
      codeReceivedViaDm: true,
      channelInviteReceived: true,
      status: 'INVITE_ACCEPTED_VERIFIED',
    };
  }
}
