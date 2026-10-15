export type UserRole = "EARNER" | "ADVERTISER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  isEmailVerified: boolean;
  authProvider: "google" | "email";
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

export interface TaskOpportunity {
  id: string;
  title: string;
  category:
    | "WHATSAPP_BROADCAST"
    | "TELEGRAM_COMMUNITY"
    | "APP_TESTING"
    | "SURVEY";
  platform: "WHATSAPP" | "TELEGRAM" | "WEB";
  rewardCoins: number;
  rewardNgn: number;
  estimatedMinutes: number;
  remainingSlots: number;
  instructions: string;
  requirements: string[];
  status: "OPEN" | "COMPLETED" | "IN_REVIEW";
}

export type SessionTier = "BRONZE" | "SILVER" | "GOLD";

export type SessionStatus =
  | "ONLINE"
  | "OFFLINE"
  | "INCUBATING"
  | "PAIRING"
  | "BANNED";

export type GroupStatus = "OPEN" | "LOCKED" | "KICKED";

export type CampaignPathway = "DIRECT_SESSION" | "SMART_VERIFIED";

export type SmartSystemType =
  | "WA_GROUP"
  | "WA_CHANNEL"
  | "TG_GROUP"
  | "TG_CHANNEL";

export type BroadcastMode = "ALLSTATUS_1X" | "ALLCHAT_2X_VIP";

export type CountryFilterMode = "RANDOM" | "SPECIFIC_COUNTRIES";

export type CampaignStatus =
  | "PENDING_ADMIN_VERIFICATION"
  | "VERIFIED_ACTIVE"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED_TIMEOUT";

export interface Wallet {
  id: string;
  userId: string;
  locked_bonus: number; // strictly 200.000 upon registration
  earned_balance: number; // starts at 0.000, requires >= 300.000 for first payout
  pending_referral_balance: number; // 5.000 per invited friend
  bonus_claimed: boolean;
  total_withdrawn: number;
}

export interface PairedSession {
  id: string;
  userId: string;
  phoneNumber: string; // e.g. 2348012345678
  jid: string; // 2348012345678@s.whatsapp.net
  deviceHash: string;
  tier: SessionTier; // Bronze (1-25), Silver (26-99), Gold (100+)
  status: SessionStatus;
  openGcCount: number;
  totalGcCount: number;
  virtualGoldUnits: number; // 300 GCs = 3 virtual gold units
  isOldNumber: boolean;
  pairedAt: string;
  lastBroadcastAt?: string;
  autoJoinEnabled: boolean;
}

export interface SessionGroup {
  id: string;
  sessionId: string;
  groupJid: string;
  subject: string;
  memberCount: number;
  status: GroupStatus; // OPEN, LOCKED (announce=true), KICKED
  isWorkerAdmin: boolean;
  oneXCoins: number; // Math.min(members, 1000) / 1000
  twoXCoins: number; // 2 * (Math.min(members, 1000) / 1000)
  lastBroadcastDeliveredAt?: string;
  kickedAt?: string;
}

export interface ValidatedGroupPoolItem {
  id: string;
  inviteCode: string;
  url: string;
  subject: string;
  memberCount: number;
  creatorCountryCode: string; // e.g. "NG", "GH", "KE", "US"
  inferredPrefix: string; // e.g. "+234"
  validatedAt: string;
  assignedUsersCount: number;
}

export interface AdminMonitorBot {
  id: string;
  role: "PRIMARY" | "BACKUP";
  phoneNumber: string;
  jid: string;
  status: "ONLINE" | "ACTIVE_IN_GC" | "OFFLINE";
  activeGroupCount: number;
  lastHealthPing: string;
}

export interface RichLinkPreview {
  url: string;
  title: string;
  description: string;
  jpegThumbnailBase64?: string;
  matchedText?: string;
  sourceUrl?: string;
  isWaGroupInvite?: boolean;
  memberCount?: number;
}

export interface Campaign {
  id: string;
  advertiserId: string;
  title: string;
  pathway: CampaignPathway;
  smartSystemType?: SmartSystemType;
  broadcastMode: BroadcastMode;
  targetUrl: string;
  messagePayload: {
    type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
    caption: string;
    mediaUrl?: string;
  };
  linkPreview: RichLinkPreview;
  // Pathway A specifics
  requestedTier?: SessionTier;
  sessionCountRequested?: number;
  // Pathway B specifics
  requestedVolume?: number; // e.g. 50 to 2000 requests
  countryFilterMode?: CountryFilterMode;
  targetCountryPrefixes?: string[]; // e.g. ["+234", "+233"]
  // Admin Verification state for WA Group
  assignedPrimaryBot?: string;
  assignedBackupBot?: string;
  groupJid?: string;
  verificationTimerSecondsLeft?: number; // 10 minutes (600s) countdown
  verificationTimerExpiresAt?: string;
  verifiedAsAdmin?: boolean;
  verificationTimedOut?: boolean;
  // Channel Specifics
  channelVerificationCode?: string; // e.g. "CH-9042"
  channelUserPhone?: string;
  channelContactSaved?: boolean;
  channelInviteAccepted?: boolean;
  // Telegram Specifics
  telegramChatId?: string;
  // Monotonic Counters
  cumulativeRequestsDelivered: number;
  lastHourlyFilterAt?: string;
  rejectedWrongCountryCount: number;
  // Financial Locks
  costCoins: number;
  costNgn: number;
  maxWorkerCoinBudget: number; // approved by AI Accountant
  coinsPaidToWorkers: number;
  status: CampaignStatus;
  createdAt: string;
  completedAt?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  category: "VERIFICATION_DISPUTE" | "WITHDRAWAL_ISSUE" | "PAIRING" | "GENERAL";
  status: "OPEN" | "REPLIED" | "RESOLVED";
  adminNotes?: string;
  telegramNotified: boolean;
  createdAt: string;
}

export interface SystemPricingConfig {
  coinToNgnRate: number; // 1.000
  minimumMarginPct: number; // 0.75 (75%)
  bronzeSessionBaseNgn: number;
  silverSessionBaseNgn: number;
  goldSessionBaseNgn: number;
  vipAllChatMultiplier: number; // 2.0x
  specificCountryMultiplier: number; // 1.4x
  minBroadcastDelayMs: number; // 3000
  maxBroadcastDelayMs: number; // 6000
  joinManagerJitterMinMins: number; // 15
  joinManagerJitterMaxMins: number; // 35
  fastMembersSurgeMultiplier: number; // 1.6x
}

export interface LiveTerminalLog {
  id: string;
  timestamp: string;
  source:
    | "STATE_PLANE"
    | "AI_ACCOUNTANT"
    | "VALIDATOR_HUB"
    | "BROADCAST_WORKER"
    | "TELEGRAM_BRIDGE"
    | "JOIN_MANAGER";
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR" | "LOCK";
  message: string;
  metadata?: Record<string, any>;
}
