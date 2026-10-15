import { 
  UserRole, 
  Wallet, 
  PairedSession, 
  SessionGroup, 
  Campaign, 
  ValidatedGroupPoolItem, 
  AdminMonitorBot, 
  SupportTicket, 
  LiveTerminalLog,
  SystemPricingConfig 
} from '../types';
import { WalletLedgerService } from './walletLedger';
import { ValidatorHubService } from '../whatsapp/validatorHub';
import { WaGroupVerifierService } from '../verifiers/waGroupVerifier';
import { TelegramBotBridgeService } from '../verifiers/telegramBotBridge';
import { DEFAULT_PRICING_CONFIG } from './accountantAi';

export interface AppState {
  currentRole: UserRole;
  user: {
    id: string;
    email: string;
    name: string;
    deviceHash: string;
  };
  wallet: Wallet;
  sessions: PairedSession[];
  activeSessionId: string | null;
  groups: SessionGroup[];
  campaigns: Campaign[];
  validatedPool: ValidatedGroupPoolItem[];
  adminBots: AdminMonitorBot[];
  supportTickets: SupportTicket[];
  terminalLogs: LiveTerminalLog[];
  pricingConfig: SystemPricingConfig;
  pairedJidHistory: Set<string>;
}

// Initial dummy seed groups for the user's paired WhatsApp account
const INITIAL_GROUPS: SessionGroup[] = [
  {
    id: 'grp_1',
    sessionId: 'sess_1',
    groupJid: '120363024891029384@g.us',
    subject: 'Crypto Traders & Arbitrage West Africa',
    memberCount: 742,
    status: 'OPEN',
    isWorkerAdmin: false,
    oneXCoins: 0.742,
    twoXCoins: 1.484,
  },
  {
    id: 'grp_2',
    sessionId: 'sess_1',
    groupJid: '120363028392019482@g.us',
    subject: 'Naija E-Commerce Sellers Hub',
    memberCount: 980,
    status: 'OPEN',
    isWorkerAdmin: true,
    oneXCoins: 0.980,
    twoXCoins: 1.960,
  },
  {
    id: 'grp_3',
    sessionId: 'sess_1',
    groupJid: '120363039485728192@g.us',
    subject: 'Lekki Business Networking Circle',
    memberCount: 420,
    status: 'OPEN',
    isWorkerAdmin: false,
    oneXCoins: 0.420,
    twoXCoins: 0.840,
  },
  {
    id: 'grp_4',
    sessionId: 'sess_1',
    groupJid: '120363048596019283@g.us',
    subject: 'Tech Jobs & Freelance Gigs Only',
    memberCount: 88, // < 100 members -> 0 coins!
    status: 'OPEN',
    isWorkerAdmin: false,
    oneXCoins: 0.000,
    twoXCoins: 0.000,
  },
  {
    id: 'grp_5',
    sessionId: 'sess_1',
    groupJid: '120363059684738291@g.us',
    subject: 'Announcements Only - Forex Signals VIP',
    memberCount: 650,
    status: 'LOCKED', // locked -> 0 coins!
    isWorkerAdmin: false,
    oneXCoins: 0.000,
    twoXCoins: 0.000,
  },
  {
    id: 'grp_6',
    sessionId: 'sess_1',
    groupJid: '120363068574635241@g.us',
    subject: 'Ghana & Nigeria Import Merchants',
    memberCount: 1024, // Capped at 1,000 for math
    status: 'OPEN',
    isWorkerAdmin: false,
    oneXCoins: 1.000,
    twoXCoins: 2.000,
  },
];

const INITIAL_SESSIONS: PairedSession[] = [
  {
    id: 'sess_1',
    userId: 'usr_main',
    phoneNumber: '+234 808 349 9201',
    jid: '2348083499201@s.whatsapp.net',
    deviceHash: 'fp_a982fbc78921e03',
    tier: 'BRONZE',
    status: 'ONLINE',
    openGcCount: 4, // 4 open GCs with >=100 members
    totalGcCount: 6,
    virtualGoldUnits: 0,
    isOldNumber: true,
    pairedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    lastBroadcastAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    autoJoinEnabled: false,
  },
  {
    id: 'sess_2',
    userId: 'usr_main',
    phoneNumber: '+234 905 442 8119',
    jid: '2349054428119@s.whatsapp.net',
    deviceHash: 'fp_a982fbc78921e03',
    tier: 'GOLD',
    status: 'ONLINE',
    openGcCount: 142,
    totalGcCount: 160,
    virtualGoldUnits: 1, // 142 GCs = 1 virtual gold unit (100 GCs)
    isOldNumber: true,
    pairedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    lastBroadcastAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    autoJoinEnabled: true,
  },
];

export const initialAppState: AppState = {
  currentRole: 'EARNER',
  user: {
    id: 'usr_main',
    email: 'anonymoustechgodfather@gmail.com',
    name: 'TechGodfather Chief',
    deviceHash: 'fp_a982fbc78921e03',
  },
  // STRICT RULE: 200.000 locked bonus granted immediately upon registration BEFORE pairing!
  wallet: WalletLedgerService.createInitialWallet('usr_main'),
  sessions: INITIAL_SESSIONS,
  activeSessionId: 'sess_1',
  groups: INITIAL_GROUPS,
  campaigns: [
    {
      id: 'cmp_1001',
      advertiserId: 'adv_890',
      title: 'Solana Africa Summit 2026 Registration',
      pathway: 'DIRECT_SESSION',
      broadcastMode: 'ALLCHAT_2X_VIP',
      targetUrl: 'https://chat.whatsapp.com/Kp9zL2xY9m1VbNqR4wT8eC',
      messagePayload: {
        type: 'TEXT',
        caption: '🚀 Exclusive Solana Africa Web3 Developer Grants announced! Over $250k in builder prizes. Join the WhatsApp community to RSVP.',
      },
      linkPreview: {
        url: 'https://chat.whatsapp.com/Kp9zL2xY9m1VbNqR4wT8eC',
        title: 'Solana Africa Summit — Official Community',
        description: 'Join 684 builders and developers. Grants, workshops, and hackathons.',
        isWaGroupInvite: true,
        memberCount: 684,
      },
      requestedTier: 'GOLD',
      sessionCountRequested: 2,
      cumulativeRequestsDelivered: 120,
      rejectedWrongCountryCount: 0,
      costCoins: 400.0,
      costNgn: 400.0,
      maxWorkerCoinBudget: 420.0,
      coinsPaidToWorkers: 184.250,
      status: 'RUNNING',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'cmp_1002',
      advertiserId: 'adv_992',
      title: 'Abuja Crypto Whales VIP WhatsApp Group',
      pathway: 'SMART_VERIFIED',
      smartSystemType: 'WA_GROUP',
      broadcastMode: 'ALLCHAT_2X_VIP',
      targetUrl: 'https://chat.whatsapp.com/Ab7cD8eF9gH1iJ2kL3mN4P',
      messagePayload: {
        type: 'TEXT',
        caption: '⚡ Daily high-accuracy arbitrage signals and P2P merchant alerts. Tap below to request entry.',
      },
      linkPreview: {
        url: 'https://chat.whatsapp.com/Ab7cD8eF9gH1iJ2kL3mN4P',
        title: 'Abuja Crypto Whales VIP',
        description: '420 verified traders. Approve new participants enabled.',
        isWaGroupInvite: true,
        memberCount: 420,
      },
      requestedVolume: 500, // 500 requests requested
      countryFilterMode: 'SPECIFIC_COUNTRIES',
      targetCountryPrefixes: ['+234', '+233'],
      assignedPrimaryBot: '+234 814 902 4410',
      assignedBackupBot: '+234 906 118 7329',
      verificationTimerSecondsLeft: 420, // 7 mins left in 10-min countdown
      verifiedAsAdmin: true,
      verificationTimedOut: false,
      cumulativeRequestsDelivered: 312,
      rejectedWrongCountryCount: 46,
      costCoins: 650.0,
      costNgn: 650.0,
      maxWorkerCoinBudget: 680.0,
      coinsPaidToWorkers: 290.500,
      status: 'RUNNING',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'cmp_1003',
      advertiserId: 'adv_344',
      title: 'Global FX Insider Telegram Channel',
      pathway: 'SMART_VERIFIED',
      smartSystemType: 'TG_CHANNEL',
      broadcastMode: 'ALLSTATUS_1X',
      targetUrl: 'https://t.me/GlobalFxInsiders',
      messagePayload: {
        type: 'TEXT',
        caption: 'Institutional FX forecasts & CPI breakdown. Subscribe now.',
      },
      linkPreview: {
        url: 'https://t.me/GlobalFxInsiders',
        title: 'Global FX Insiders Channel',
        description: 'Verified Telegram channel with live institutional calls.',
      },
      requestedVolume: 300,
      cumulativeRequestsDelivered: 298,
      rejectedWrongCountryCount: 0,
      costCoins: 280.0,
      costNgn: 280.0,
      maxWorkerCoinBudget: 300.0,
      coinsPaidToWorkers: 278.400,
      status: 'RUNNING',
      createdAt: new Date(Date.now() - 14400000).toISOString(),
    },
  ],
  validatedPool: ValidatorHubService.getPool(),
  adminBots: WaGroupVerifierService.getAdminBots(),
  supportTickets: TelegramBotBridgeService.getSupportTickets(),
  pricingConfig: DEFAULT_PRICING_CONFIG,
  pairedJidHistory: new Set(['2347011928374@s.whatsapp.net']),
  terminalLogs: [
    {
      id: 'init_log_1',
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'INFO',
      message: 'Pappy Earning Hub State-Plane Shard Cluster initialized on Port 3000.',
    },
    {
      id: 'init_log_2',
      timestamp: new Date().toISOString(),
      source: 'AI_ACCOUNTANT',
      level: 'INFO',
      message: 'Accountant AI Guardrail loaded: 75% minimum gross margin locked. 1 Coin = ₦1.000 NGN.',
    },
    {
      id: 'init_log_3',
      timestamp: new Date().toISOString(),
      source: 'BROADCAST_WORKER',
      level: 'SUCCESS',
      message: 'plogme^2.0.0 engine pinned. Multi-device 8-digit pairing ready.',
    },
  ],
};
