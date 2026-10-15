import { PairedSession, SessionGroup, ValidatedGroupPoolItem, LiveTerminalLog } from '../types';
import { ValidatorHubService } from './validatorHub';

export interface JoinManagerConfig {
  targetOpenGcs: number; // e.g. 100 for Gold VIP speed
  jitterMinMins: number; // 15
  jitterMaxMins: number; // 35
  dailyMaxJoins: number; // 12 for old, 5 for new
  autoMuteAndArchive: boolean;
}

export class JoinManagerService {
  /**
   * Executes a safe simulated state-plane join cycle
   */
  public static async executeAutomatedJoinStep(
    session: PairedSession,
    existingGroups: SessionGroup[],
    config: JoinManagerConfig,
    onLog: (log: LiveTerminalLog) => void
  ): Promise<{ updatedSession: PairedSession; newGroup?: SessionGroup; reachedTarget: boolean }> {
    const pool = ValidatorHubService.getPool();
    const joinedCodes = new Set(existingGroups.map(g => g.groupJid.split('@')[0]));

    // Find candidate from pool that user has not joined yet
    const candidate = pool.find(item => !joinedCodes.has(item.inviteCode));

    if (!candidate) {
      onLog({
        id: `log_${Date.now()}_noop`,
        timestamp: new Date().toISOString(),
        source: 'JOIN_MANAGER',
        level: 'WARN',
        message: `ValidatedGroupPool exhausted! All available groups already joined. Admin please ingest more links in Validator Hub.`,
      });
      return { updatedSession: session, reachedTarget: false };
    }

    // Human jitter interval calculation
    const jitterMins = Math.floor(Math.random() * (config.jitterMaxMins - config.jitterMinMins + 1)) + config.jitterMinMins;
    
    onLog({
      id: `log_${Date.now()}_inspect`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'INFO',
      message: `[State-Plane] Session ${session.phoneNumber} (${session.status}) inspecting invite code "${candidate.inviteCode.slice(0, 8)}..."`,
    });

    onLog({
      id: `log_${Date.now()}_join`,
      timestamp: new Date().toISOString(),
      source: 'JOIN_MANAGER',
      level: 'INFO',
      message: `Calling sock.groupAcceptInvite('${candidate.inviteCode}'). Group: "${candidate.subject}" (${candidate.memberCount} members, ${candidate.inferredPrefix})...`,
    });

    // Simulated successful group join
    const newGroupJid = `${candidate.inviteCode}@g.us`;
    const newGroup: SessionGroup = {
      id: `sg_${Date.now()}`,
      sessionId: session.id,
      groupJid: newGroupJid,
      subject: candidate.subject,
      memberCount: candidate.memberCount,
      status: 'OPEN',
      isWorkerAdmin: false,
      oneXCoins: Number((Math.min(candidate.memberCount, 1000) / 1000).toFixed(3)),
      twoXCoins: Number((2 * (Math.min(candidate.memberCount, 1000) / 1000)).toFixed(3)),
    };

    if (config.autoMuteAndArchive) {
      onLog({
        id: `log_${Date.now()}_mute`,
        timestamp: new Date().toISOString(),
        source: 'STATE_PLANE',
        level: 'INFO',
        message: `Auto-muted notifications (forever) and archived chat [${candidate.subject}] to preserve worker phone battery & UX.`,
      });
    }

    const newOpenCount = session.openGcCount + 1;
    const reachedTarget = newOpenCount >= config.targetOpenGcs;
    
    // Determine dynamic tier
    let newTier = session.tier;
    if (newOpenCount >= 100) newTier = 'GOLD';
    else if (newOpenCount >= 26) newTier = 'SILVER';
    else newTier = 'BRONZE';

    const updatedSession: PairedSession = {
      ...session,
      openGcCount: newOpenCount,
      totalGcCount: session.totalGcCount + 1,
      tier: newTier,
      virtualGoldUnits: Math.floor(newOpenCount / 100),
      status: reachedTarget ? 'ONLINE' : 'INCUBATING',
    };

    onLog({
      id: `log_${Date.now()}_success`,
      timestamp: new Date().toISOString(),
      source: 'JOIN_MANAGER',
      level: 'SUCCESS',
      message: `Successfully joined [${candidate.subject}]! Added +${newGroup.oneXCoins.toFixed(3)} Coins/broadcast capacity. Total Open GCs: ${newOpenCount} (${newTier} Tier). Next join scheduled in ~${jitterMins}m.`,
    });

    if (reachedTarget) {
      onLog({
        id: `log_${Date.now()}_turbo`,
        timestamp: new Date().toISOString(),
        source: 'STATE_PLANE',
        level: 'SUCCESS',
        message: `🎯 Target Goal of ${config.targetOpenGcs} Open GCs reached! Switched session status from INCUBATING -> ONLINE (GOLD TURBO SPEED UNLOCKED).`,
      });
    }

    return {
      updatedSession,
      newGroup,
      reachedTarget,
    };
  }
}
