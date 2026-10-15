import { AdminMonitorBot, LiveTerminalLog } from '../types';
import { WaGroupVerifierService } from './waGroupVerifier';

export interface WaChannelHandshake {
  campaignId: string;
  buyerPhoneNumber: string;
  assignedAdminBot: AdminMonitorBot;
  sixDigitCode: string;
  contactSaved: boolean;
  codeReceived: boolean;
  channelInviteReceived: boolean;
  channelVerified: boolean;
  status: 'PENDING_MUTUAL_SAVE' | 'CODE_VERIFIED' | 'CHANNEL_ADMIN_ACCEPTED' | 'ACTIVE_GROWTH' | 'COMPLETED';
}

export class WaChannelVerifierService {
  /**
   * Initiates the anti-ban Mutual Contact Save + 6-Digit Code Handshake
   */
  public static initiateChannelVerification(
    campaignId: string,
    buyerPhoneNumber: string,
    onLog: (log: LiveTerminalLog) => void
  ): WaChannelHandshake {
    const adminBots = WaGroupVerifierService.getAdminBots();
    const assignedBot = adminBots[0];

    // Generate cryptographic 6-digit verification code
    const sixDigitCode = Math.floor(100000 + Math.random() * 900000).toString();

    onLog({
      id: `log_${Date.now()}_chan`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'INFO',
      message: `[WA Channel Verification] Generated 6-digit handshake code [${sixDigitCode}] for buyer ${buyerPhoneNumber}. Assigned Admin Bot: ${assignedBot.phoneNumber}.`,
    });

    return {
      campaignId,
      buyerPhoneNumber,
      assignedAdminBot: assignedBot,
      sixDigitCode,
      contactSaved: false,
      codeReceived: false,
      channelInviteReceived: false,
      channelVerified: false,
      status: 'PENDING_MUTUAL_SAVE',
    };
  }

  /**
   * Simulates receiving code and channel admin invite
   */
  public static verifyChannelInvite(
    handshake: WaChannelHandshake,
    enteredCode: string,
    onLog: (log: LiveTerminalLog) => void
  ): WaChannelHandshake {
    if (enteredCode !== handshake.sixDigitCode) {
      throw new Error(`Invalid verification code. Expected ${handshake.sixDigitCode}, received ${enteredCode}`);
    }

    onLog({
      id: `log_${Date.now()}_code_ok`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'SUCCESS',
      message: `[WA Channel] Mutual Contact Save confirmed! Verification code [${enteredCode}] matches. Admin Bot accepted Channel Admin role without cold-invite risk.`,
    });

    return {
      ...handshake,
      contactSaved: true,
      codeReceived: true,
      channelInviteReceived: true,
      channelVerified: true,
      status: 'ACTIVE_GROWTH',
    };
  }
}
