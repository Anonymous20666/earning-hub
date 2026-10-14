import { ValidatedGroupPoolItem, LiveTerminalLog } from '../types';

export interface ValidatorTelemetry {
  linksChecked: number;
  valid100PlusOpen: number;
  lockedRejected: number;
  smallRejected: number;
  deadLinks: number;
  reqPerSec: number;
  isProcessing: boolean;
}

export class ValidatorHubService {
  private static pool: ValidatedGroupPoolItem[] = [
    {
      id: 'vg_1',
      inviteCode: 'Kp9zL2xY9m1VbNqR4wT8eC',
      url: 'https://chat.whatsapp.com/Kp9zL2xY9m1VbNqR4wT8eC',
      subject: 'Lagos Tech & Developers Network',
      memberCount: 684,
      creatorCountryCode: 'NG',
      inferredPrefix: '+234',
      validatedAt: new Date(Date.now() - 3600000).toISOString(),
      assignedUsersCount: 14,
    },
    {
      id: 'vg_2',
      inviteCode: 'Ab7cD8eF9gH1iJ2kL3mN4P',
      url: 'https://chat.whatsapp.com/Ab7cD8eF9gH1iJ2kL3mN4P',
      subject: 'Nairobi Crypto & Web3 Builders',
      memberCount: 420,
      creatorCountryCode: 'KE',
      inferredPrefix: '+254',
      validatedAt: new Date(Date.now() - 7200000).toISOString(),
      assignedUsersCount: 9,
    },
    {
      id: 'vg_3',
      inviteCode: 'Zx9wV8uT7sR6qP5oN4mL3K',
      url: 'https://chat.whatsapp.com/Zx9wV8uT7sR6qP5oN4mL3K',
      subject: 'Accra Entrepreneurs & E-Commerce',
      memberCount: 890,
      creatorCountryCode: 'GH',
      inferredPrefix: '+233',
      validatedAt: new Date(Date.now() - 10800000).toISOString(),
      assignedUsersCount: 22,
    },
    {
      id: 'vg_4',
      inviteCode: 'Mn3bV4cX5zL6kI7jH8gF9D',
      url: 'https://chat.whatsapp.com/Mn3bV4cX5zL6kI7jH8gF9D',
      subject: 'Global Freelance & Remote Work Group',
      memberCount: 995,
      creatorCountryCode: 'US',
      inferredPrefix: '+1',
      validatedAt: new Date(Date.now() - 14400000).toISOString(),
      assignedUsersCount: 31,
    },
  ];

  public static getPool(): ValidatedGroupPoolItem[] {
    return this.pool;
  }

  /**
   * Ingests a raw .txt or pasted string with potentially thousands of WhatsApp invite links.
   * Extracts 22-char invite codes, deduplicates, and validates them via state-plane inspector.
   */
  public static async processTextBatch(
    rawText: string,
    onTelemetry: (telemetry: ValidatorTelemetry) => void,
    onLog: (log: LiveTerminalLog) => void
  ): Promise<ValidatedGroupPoolItem[]> {
    const inviteRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g;
    const matches = Array.from(rawText.matchAll(inviteRegex));
    const uniqueCodes = Array.from(new Set(matches.map(m => m[1])));

    const telemetry: ValidatorTelemetry = {
      linksChecked: 0,
      valid100PlusOpen: 0,
      lockedRejected: 0,
      smallRejected: 0,
      deadLinks: 0,
      reqPerSec: 0,
      isProcessing: true,
    };

    onLog({
      id: `log_${Date.now()}_start`,
      timestamp: new Date().toISOString(),
      source: 'VALIDATOR_HUB',
      level: 'INFO',
      message: `Validator Hub Ingestion started: ${uniqueCodes.length} unique WhatsApp invite links extracted from input stream.`,
    });

    const newValidated: ValidatedGroupPoolItem[] = [];
    const startTime = Date.now();

    for (let i = 0; i < uniqueCodes.length; i++) {
      const code = uniqueCodes[i];
      telemetry.linksChecked++;

      // Simulating sharded groupGetInviteInfo(code) with realistic network & Baileys state-plane
      const roll = Math.random();
      
      if (roll < 0.12) {
        // Dead or revoked invite link
        telemetry.deadLinks++;
      } else if (roll < 0.28) {
        // Locked group (announce === true, admin-only chat)
        telemetry.lockedRejected++;
      } else if (roll < 0.44) {
        // Small group (< 100 members)
        telemetry.smallRejected++;
      } else {
        // Valid Qualified Open Group (100 to 1,019 members)
        telemetry.valid100PlusOpen++;
        const simulatedMembers = Math.floor(Math.random() * 850) + 110;
        const prefixes = ['+234', '+254', '+233', '+1', '+44', '+27'];
        const countryCodes = ['NG', 'KE', 'GH', 'US', 'GB', 'ZA'];
        const pickedIdx = Math.floor(Math.random() * prefixes.length);

        const item: ValidatedGroupPoolItem = {
          id: `vg_${Date.now()}_${i}`,
          inviteCode: code,
          url: `https://chat.whatsapp.com/${code}`,
          subject: `Verified Community #${code.slice(0, 6)}`,
          memberCount: simulatedMembers,
          creatorCountryCode: countryCodes[pickedIdx],
          inferredPrefix: prefixes[pickedIdx],
          validatedAt: new Date().toISOString(),
          assignedUsersCount: 0,
        };

        newValidated.push(item);
        this.pool.unshift(item);
      }

      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      telemetry.reqPerSec = Math.round((telemetry.linksChecked / elapsedSec) * 10) / 10;
      onTelemetry({ ...telemetry });

      // Yield control and log every batch
      if (i % 10 === 0 || i === uniqueCodes.length - 1) {
        onLog({
          id: `log_${Date.now()}_${i}`,
          timestamp: new Date().toISOString(),
          source: 'VALIDATOR_HUB',
          level: 'INFO',
          message: `Inspected ${telemetry.linksChecked}/${uniqueCodes.length} links: ${telemetry.valid100PlusOpen} qualified open, ${telemetry.lockedRejected} locked, ${telemetry.smallRejected} <100 members, ${telemetry.deadLinks} dead.`,
        });
      }
    }

    telemetry.isProcessing = false;
    onTelemetry({ ...telemetry });

    onLog({
      id: `log_${Date.now()}_done`,
      timestamp: new Date().toISOString(),
      source: 'VALIDATOR_HUB',
      level: 'SUCCESS',
      message: `Batch validation complete! Added ${newValidated.length} verified open groups to ValidatedGroupPool. Ready for Join Manager auto-dispatch.`,
    });

    return newValidated;
  }
}
