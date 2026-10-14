import React, { useState, useEffect } from 'react';
import { 
  Campaign, 
  CampaignPathway, 
  SmartSystemType, 
  SessionTier, 
  BroadcastMode, 
  CountryFilterMode,
  SessionGroup,
  LiveTerminalLog,
  AdminMonitorBot
} from '../types';
import { accountantAi } from '../services/accountantAi';
import { LinkPreviewEngine } from '../whatsapp/linkPreviewEngine';
import { BroadcastWorker } from '../whatsapp/broadcastWorker';
import { WaAdminVerifierService, WaAdminVerificationSession, WaChannelVerificationHandshake } from '../verifiers/waAdminVerifier';
import { TelegramVerifierService, TelegramCampaignSession } from '../verifiers/tgVerifier';
import { 
  Send, 
  ShieldCheck, 
  Clock, 
  Sliders, 
  Globe, 
  Bot, 
  MessageSquare, 
  Users, 
  Radio, 
  CheckCircle, 
  Zap, 
  Flame, 
  ExternalLink, 
  AlertCircle,
  Play,
  Copy,
  Check,
  UserCheck,
  XCircle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface AdvertiserStudioProps {
  campaigns: Campaign[];
  groups: SessionGroup[];
  adminBots: AdminMonitorBot[];
  onAddCampaign: (campaign: Campaign) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
  onAddLog: (log: LiveTerminalLog) => void;
}

export const AdvertiserStudio: React.FC<AdvertiserStudioProps> = ({
  campaigns,
  groups,
  adminBots,
  onAddCampaign,
  onUpdateCampaign,
  onAddLog,
}) => {
  // Pathway toggle
  const [selectedPathway, setSelectedPathway] = useState<CampaignPathway>('SMART_VERIFIED');
  
  // Platform selection (The 4 Target Platforms)
  const [selectedSmartSystem, setSelectedSmartSystem] = useState<SmartSystemType>('WA_GROUP');
  
  // Broadcast Sessions Config
  const [selectedTier, setSelectedTier] = useState<SessionTier>('GOLD');
  const [sessionCount, setSessionCount] = useState<number>(25);
  const [broadcastMode, setBroadcastMode] = useState<BroadcastMode>('ALLCHAT_2X_VIP');
  
  // Targeting & Volume Config
  const [requestVolume, setRequestVolume] = useState<number>(500); // Max 2,000 for WA_GROUP
  const [countryFilterMode, setCountryFilterMode] = useState<CountryFilterMode>('SPECIFIC_COUNTRIES');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['234', '233']); // dial codes without '+'

  // Shared Payload State
  const [campaignTitle, setCampaignTitle] = useState('');
  const [targetUrl, setTargetUrl] = useState('https://chat.whatsapp.com/Kp9zL2xY9m1VbNqR4wT8eC');
  const [caption, setCaption] = useState('🔥 Join our exclusive WhatsApp network for daily verified updates, alpha signals, and builder grants.');
  const [customPreviewTitle, setCustomPreviewTitle] = useState('');
  const [customPreviewDesc, setCustomPreviewDesc] = useState('');

  // Active Verification Wizard State for new campaign
  const [activeWaGroupSession, setActiveWaGroupSession] = useState<WaAdminVerificationSession | null>(null);
  const [activeWaChannelHandshake, setActiveWaChannelHandshake] = useState<WaChannelVerificationHandshake | null>(null);
  const [activeTgSession, setActiveTgSession] = useState<TelegramCampaignSession | null>(null);
  const [channelDmInput, setChannelDmInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Live ticking timer for WA Group 10-minute countdown
  useEffect(() => {
    if (!activeWaGroupSession || activeWaGroupSession.status === 'VERIFIED' || activeWaGroupSession.status === 'CANCELLED_TIMEOUT') {
      return;
    }

    const interval = setInterval(() => {
      setActiveWaGroupSession(prev => {
        if (!prev) return null;
        const newSec = Math.max(0, prev.secondsRemaining - 1);
        const evaluated = WaAdminVerifierService.evaluateVerificationTick(prev, newSec, onAddLog);
        return evaluated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWaGroupSession]);

  // Live Link Preview Generation
  let livePreview;
  try {
    livePreview = LinkPreviewEngine.buildRichLinkPreview(targetUrl, customPreviewTitle || undefined, customPreviewDesc || undefined);
  } catch {
    livePreview = {
      url: targetUrl,
      title: 'Valid URL Required',
      description: 'Enter an HTTP or WhatsApp group link to generate preview.',
      isWaGroupInvite: false,
    };
  }

  // Country prefix options
  const countryOptions = [
    { code: '234', name: 'Nigeria', flag: '🇳🇬' },
    { code: '233', name: 'Ghana', flag: '🇬🇭' },
    { code: '254', name: 'Kenya', flag: '🇰🇪' },
    { code: '1', name: 'USA / Canada', flag: '🇺🇸' },
    { code: '44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '27', name: 'South Africa', flag: '🇿🇦' },
  ];

  const toggleCountry = (code: string) => {
    if (selectedCountries.includes(code)) {
      if (selectedCountries.length > 1) {
        setSelectedCountries(selectedCountries.filter(c => c !== code));
      }
    } else {
      setSelectedCountries([...selectedCountries, code]);
    }
  };

  // Live Deterministic Pricing Quote from AI Accountant
  const deterministicQuote = accountantAi.calculateDeterministicQuote({
    pathway: selectedPathway,
    smartSystemType: selectedSmartSystem,
    tier: selectedTier,
    sessionCount,
    volume: requestVolume,
    mode: broadcastMode,
    countryFilter: countryFilterMode,
    selectedCountryCount: selectedCountries.length,
  });

  // Step 1: Start 4-Platform Verification
  const handleInitiateVerification = () => {
    if (!targetUrl || !targetUrl.startsWith('http')) {
      alert('Please enter a valid target URL.');
      return;
    }

    const tempCampaignId = `cmp_${Date.now()}`;

    if (selectedSmartSystem === 'WA_GROUP') {
      const session = WaAdminVerifierService.initiateGroupVerification(tempCampaignId, targetUrl, onAddLog);
      setActiveWaGroupSession(session);
      setActiveWaChannelHandshake(null);
      setActiveTgSession(null);
    } else if (selectedSmartSystem === 'WA_CHANNEL') {
      const handshake = WaAdminVerifierService.initiateChannelHandshake(tempCampaignId, '+234 808 349 9201', onAddLog);
      setActiveWaChannelHandshake(handshake);
      setActiveWaGroupSession(null);
      setActiveTgSession(null);
    } else {
      // TG_GROUP or TG_CHANNEL
      const isChannel = selectedSmartSystem === 'TG_CHANNEL';
      const dummyCampaign: Campaign = {
        id: tempCampaignId,
        advertiserId: 'adv_current',
        title: campaignTitle || `${isChannel ? 'Telegram Channel' : 'Telegram Group'} Growth`,
        pathway: 'SMART_VERIFIED',
        smartSystemType: selectedSmartSystem,
        broadcastMode,
        targetUrl,
        messagePayload: { type: 'TEXT', caption },
        linkPreview: livePreview,
        requestedVolume: requestVolume,
        costCoins: deterministicQuote.finalRecommendedPriceNgn,
        costNgn: deterministicQuote.finalRecommendedPriceNgn,
        maxWorkerCoinBudget: deterministicQuote.maxWorkerCoinBudget,
        coinsPaidToWorkers: 0,
        cumulativeRequestsDelivered: 0,
        rejectedWrongCountryCount: 0,
        status: 'PENDING_ADMIN_VERIFICATION',
        createdAt: new Date().toISOString(),
      };
      const tgSess = TelegramVerifierService.initiateTelegramVerification(
        dummyCampaign,
        '@OurCommunityHub',
        campaignTitle || 'Solana Africa VIP',
        isChannel,
        onAddLog
      );
      setActiveTgSession(tgSess);
      setActiveWaGroupSession(null);
      setActiveWaChannelHandshake(null);
    }
  };

  // Launch and Save Campaign
  const handleFinalizeAndLaunch = () => {
    const isWaGroupVerified = activeWaGroupSession?.status === 'VERIFIED';
    const isWaChannelVerified = activeWaChannelHandshake?.status === 'INVITE_ACCEPTED_VERIFIED';
    const isTgVerified = activeTgSession?.status === 'VERIFIED_RUNNING';
    const isDirect = selectedPathway === 'DIRECT_SESSION';

    const newCampaign: Campaign = {
      id: `cmp_${Date.now()}`,
      advertiserId: 'adv_current',
      title: campaignTitle || (isDirect ? `Direct Session Blast (${sessionCount} ${selectedTier}s)` : `Verified Growth: ${selectedSmartSystem}`),
      pathway: selectedPathway,
      smartSystemType: isDirect ? undefined : selectedSmartSystem,
      broadcastMode,
      targetUrl,
      messagePayload: {
        type: 'TEXT',
        caption,
      },
      linkPreview: livePreview,
      requestedTier: selectedTier,
      sessionCountRequested: sessionCount,
      requestedVolume: isDirect ? undefined : requestVolume,
      countryFilterMode: isDirect ? undefined : countryFilterMode,
      targetCountryPrefixes: isDirect ? undefined : selectedCountries,
      assignedPrimaryBot: activeWaGroupSession?.primaryAdminBot.phoneNumber || '+234 814 902 4410',
      assignedBackupBot: activeWaGroupSession?.backupAdminBot.phoneNumber || '+234 906 118 7329',
      groupJid: activeWaGroupSession?.groupJid,
      verificationTimerSecondsLeft: activeWaGroupSession?.secondsRemaining,
      verificationTimerExpiresAt: activeWaGroupSession?.expiresAt,
      verifiedAsAdmin: isDirect || isWaGroupVerified || isWaChannelVerified || isTgVerified,
      verificationTimedOut: false,
      channelVerificationCode: activeWaChannelHandshake?.handshakeCode,
      channelUserPhone: activeWaChannelHandshake?.userPhoneNumber,
      channelContactSaved: activeWaChannelHandshake?.contactSavedOnAdminBot,
      channelInviteAccepted: isWaChannelVerified,
      telegramChatId: activeTgSession?.chatId,
      cumulativeRequestsDelivered: 0,
      rejectedWrongCountryCount: 0,
      costCoins: deterministicQuote.finalRecommendedPriceNgn,
      costNgn: deterministicQuote.finalRecommendedPriceNgn,
      maxWorkerCoinBudget: deterministicQuote.maxWorkerCoinBudget,
      coinsPaidToWorkers: 0.000,
      status: (isDirect || isWaGroupVerified || isWaChannelVerified || isTgVerified) ? 'RUNNING' : 'PENDING_ADMIN_VERIFICATION',
      createdAt: new Date().toISOString(),
    };

    onAddCampaign(newCampaign);

    onAddLog({
      id: `cmp_launch_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'AI_ACCOUNTANT',
      level: 'LOCK',
      message: `Campaign #${newCampaign.id.slice(0, 7)} initialized. AI Escrow budget locked: ${deterministicQuote.maxWorkerCoinBudget} Coins. Realized margin: ${deterministicQuote.marginPct}%. Floor price: ₦${deterministicQuote.finalRecommendedPriceNgn.toFixed(2)}.`,
    });

    // Reset wizard
    setActiveWaGroupSession(null);
    setActiveWaChannelHandshake(null);
    setActiveTgSession(null);
    setCampaignTitle('');
  };

  // Helper formatting mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* 1. TOP HEADER & CAMPAIGN PATHWAY */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Zap className="w-4 h-4" />
              <span>4-PLATFORM VERIFICATION &amp; BROADCAST ENGINE</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Advertiser Campaign &amp; Bot Verifier Studio
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Connect to our paired broadcast session pool (Bronze, Silver, Gold). Choose between Direct Sessions or the 4 Automated Bot Verification Workflows.
            </p>
          </div>

          {/* Pathway Segmented Control */}
          <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/10 text-xs font-mono">
            <button
              onClick={() => setSelectedPathway('SMART_VERIFIED')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedPathway === 'SMART_VERIFIED'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              The 4 Smart Platforms
            </button>
            <button
              onClick={() => setSelectedPathway('DIRECT_SESSION')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedPathway === 'DIRECT_SESSION'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Direct Session Rentals
            </button>
          </div>
        </div>

        {/* 2. THE 4 PLATFORM SELECTION CARDS */}
        {selectedPathway === 'SMART_VERIFIED' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-300 font-semibold uppercase">
                Select 1 of 4 Target Platforms:
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                Automated Bot Handshake &amp; State Machines Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* WA_GROUP */}
              <div
                onClick={() => { setSelectedSmartSystem('WA_GROUP'); setActiveWaGroupSession(null); }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedSmartSystem === 'WA_GROUP'
                    ? 'bg-emerald-950/40 border-emerald-500/70 shadow-lg shadow-emerald-950/50'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                    MAX 2,000 CAP
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">WhatsApp Group</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Dual Admin Bot assignment, strict 10-minute countdown, and 1-hour automated country filter loop.
                </p>
              </div>

              {/* WA_CHANNEL */}
              <div
                onClick={() => { setSelectedSmartSystem('WA_CHANNEL'); setActiveWaChannelHandshake(null); }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedSmartSystem === 'WA_CHANNEL'
                    ? 'bg-emerald-950/40 border-emerald-500/70 shadow-lg shadow-emerald-950/50'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Radio className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                    ANTI-BAN MUTUAL
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">WhatsApp Channel</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Mutual contact save protocol, unique 6-character code (`CH-9042`) DM, and channel invite listener.
                </p>
              </div>

              {/* TG_GROUP */}
              <div
                onClick={() => { setSelectedSmartSystem('TG_GROUP'); setActiveTgSession(null); }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedSmartSystem === 'TG_GROUP'
                    ? 'bg-cyan-950/40 border-cyan-500/70 shadow-lg shadow-cyan-950/50'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                    MONOTONIC
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Telegram Group</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  `@OurGrowthBot` listener. Monotonic counter where owner approvals/declines never backfill or decrease count.
                </p>
              </div>

              {/* TG_CHANNEL */}
              <div
                onClick={() => { setSelectedSmartSystem('TG_CHANNEL'); setActiveTgSession(null); }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedSmartSystem === 'TG_CHANNEL'
                    ? 'bg-cyan-950/40 border-cyan-500/70 shadow-lg shadow-cyan-950/50'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                    AUTO LEAVE
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">Telegram Channel</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Subscriber &amp; request verification via `@OurGrowthBot`. Auto `leaveChat()` on target volume reach.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. BROADCAST SESSION SELECTION (Bronze, Silver, Gold Marketplace Units) */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-300 font-semibold uppercase">
              Configure Worker Broadcast Sessions:
            </span>
            <span className="text-[11px] font-mono text-amber-400">
              Gold Sessions = 100 Qualified Open GCs per unit
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['BRONZE', 'SILVER', 'GOLD'] as SessionTier[]).map(tier => (
              <div
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedTier === tier
                    ? 'bg-amber-950/30 border-amber-500/60 shadow-md shadow-amber-950/40'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-mono">{tier} TIER</span>
                  {tier === 'GOLD' && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">
                  {tier === 'BRONZE' && '1–25 Open GCs per worker'}
                  {tier === 'SILVER' && '26–99 Open GCs per worker'}
                  {tier === 'GOLD' && '100+ Open GCs (Turbo Speed)'}
                </span>
              </div>
            ))}
          </div>

          {/* Session Count Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Paired Broadcast Sessions to Rent:</span>
              <span className="text-amber-400 font-bold">{sessionCount} {selectedTier} Sessions</span>
            </div>
            <input
              type="range"
              min="1"
              max="200"
              value={sessionCount}
              onChange={e => setSessionCount(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* 1x allstatus vs 2x VIP allchat mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              onClick={() => setBroadcastMode('ALLSTATUS_1X')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                broadcastMode === 'ALLSTATUS_1X'
                  ? 'bg-teal-950/40 border-teal-500/50'
                  : 'bg-white/[0.02] border-white/5'
              }`}
            >
              <div className="flex justify-between items-center text-xs font-bold text-white">
                <span>1x Normal Mode (allstatus)</span>
                <span className="text-teal-400">1x Base</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Dispatches to Group Status via Baileys/plogme groupStatusMessageV2.
              </p>
            </div>

            <div
              onClick={() => setBroadcastMode('ALLCHAT_2X_VIP')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                broadcastMode === 'ALLCHAT_2X_VIP'
                  ? 'bg-amber-950/40 border-amber-500/50'
                  : 'bg-white/[0.02] border-white/5'
              }`}
            >
              <div className="flex justify-between items-center text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>2x VIP Fast-Track (allchat)</span>
                </span>
                <span className="text-amber-400">2x Double Work</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Posts to Group Status, then tags all participants with Hidetag in Group Chat.
              </p>
            </div>
          </div>
        </div>

        {/* 4. COUNTRY & VOLUME CONFIGURATOR (Max 2,000 Cap for WA_GROUP) */}
        {selectedPathway === 'SMART_VERIFIED' && (
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-300 font-semibold uppercase">
                Target Volume &amp; Country Filter Settings:
              </span>
              <span className="text-[11px] font-mono text-cyan-400">
                1-Hour Recurring Scrub Active
              </span>
            </div>

            {/* Country Mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Country Filtering Mode:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCountryFilterMode('RANDOM')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    countryFilterMode === 'RANDOM'
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Random (All Countries)
                </button>
                <button
                  onClick={() => setCountryFilterMode('SPECIFIC_COUNTRIES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    countryFilterMode === 'SPECIFIC_COUNTRIES'
                      ? 'bg-emerald-600 text-white font-semibold shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Specific Countries (1-Hr Auto Scrub)
                </button>
              </div>
            </div>

            {/* Country Prefix Multi-Select */}
            {countryFilterMode === 'SPECIFIC_COUNTRIES' && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <span className="text-[11px] text-slate-400 block font-mono">
                  Multi-Select Allowed Dial Prefixes (Pending requests from other prefixes will be rejected automatically every hour):
                </span>
                <div className="flex flex-wrap gap-2">
                  {countryOptions.map(c => {
                    const isSelected = selectedCountries.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        onClick={() => toggleCountry(c.code)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/60 font-semibold'
                            : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span>{c.name} (+{c.code})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Request Volume Slider (Strictly Capped at 2,000 for WA_GROUP) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">
                  Target Request Volume ({selectedSmartSystem === 'WA_GROUP' ? 'Capped at 2,000 Max' : 'Package Size'}):
                </span>
                <span className="text-emerald-400 font-bold">{requestVolume} Requests</span>
              </div>
              <input
                type="range"
                min="50"
                max={selectedSmartSystem === 'WA_GROUP' ? 2000 : 5000}
                step="50"
                value={requestVolume}
                onChange={e => setRequestVolume(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>50 min</span>
                <span>{selectedSmartSystem === 'WA_GROUP' ? '2,000 Max Cap (WhatsApp Group Pending Limit)' : '5,000 Max'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. URL & CONTENT PAYLOAD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Campaign Reference Name</label>
              <input
                type="text"
                value={campaignTitle}
                onChange={e => setCampaignTitle(e.target.value)}
                placeholder="e.g. Lagos Crypto Whales Launch"
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">
                {selectedSmartSystem === 'WA_GROUP' ? 'WhatsApp Group Invite URL' : 'Target Destination URL'}
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Broadcast Caption</label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
          </div>

          {/* Live Link Card Preview */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>MANDATORY RICH LINK CARD PREVIEW</span>
            </span>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <div className="rounded-lg overflow-hidden border border-white/5 bg-[#171b26]">
                <div className="h-24 bg-gradient-to-br from-emerald-950/60 to-slate-900 flex items-center justify-center border-b border-white/5">
                  <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                    {livePreview.isWaGroupInvite ? 'WhatsApp Group Invite Card' : 'Rich Destination Card'}
                  </span>
                </div>
                <div className="p-2.5 space-y-1">
                  <span className="text-xs font-bold text-white line-clamp-1">{livePreview.title}</span>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{livePreview.description}</p>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>Anti-Ban Hash Tag:</span>
                <span className="text-cyan-400">\n\n_Ref: #8F2A_</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. VERIFICATION WIZARD CONTROLLER BUTTON */}
        {!activeWaGroupSession && !activeWaChannelHandshake && !activeTgSession && (
          <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">AI Accountant Guaranteed Floor:</span>
                <span className="text-emerald-400 font-bold text-base font-mono">
                  ₦{deterministicQuote.finalRecommendedPriceNgn.toFixed(2)} NGN
                </span>
                <span className="text-slate-500">({deterministicQuote.finalRecommendedPriceNgn} Coins)</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {deterministicQuote.aiExplanation}
              </p>
            </div>

            {selectedPathway === 'SMART_VERIFIED' ? (
              <button
                onClick={handleInitiateVerification}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs tracking-wide shadow-lg shadow-emerald-950/60 transition-all cursor-pointer whitespace-nowrap"
              >
                Start Automated Bot Verification ({selectedSmartSystem})
              </button>
            ) : (
              <button
                onClick={handleFinalizeAndLaunch}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-semibold text-xs tracking-wide shadow-lg shadow-cyan-950/60 transition-all cursor-pointer whitespace-nowrap"
              >
                Deploy Direct Session Blast
              </button>
            )}
          </div>
        )}
      </div>

      {/* 7. ACTIVE VERIFICATION STATE MACHINE DASHBOARD */}

      {/* WORKFLOW 1: WA_GROUP DUAL ADMIN BOT + 10-MIN TIMER */}
      {activeWaGroupSession && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-emerald-500/30 backdrop-blur-xl space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>WORKFLOW 1: DUAL ADMIN BOT VERIFICATION</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                WhatsApp Group Join &amp; Admin Rights Handshake
              </h3>
              <p className="text-xs text-slate-400">
                Target Group: {activeWaGroupSession.groupJid} · Invite Code: {activeWaGroupSession.inviteCode}
              </p>
            </div>

            {/* Live 10-Minute Countdown Box */}
            <div className={`p-3.5 rounded-xl border font-mono text-center min-w-[180px] ${
              activeWaGroupSession.status === 'VERIFIED'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : activeWaGroupSession.status === 'CANCELLED_TIMEOUT'
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                : 'bg-black/60 border-amber-500/50 text-amber-300'
            }`}>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                {activeWaGroupSession.status === 'VERIFIED' ? 'STATUS' : '10-MINUTE VERIFICATION TIMER'}
              </span>
              <div className="text-2xl font-extrabold mt-0.5 tracking-wider">
                {activeWaGroupSession.status === 'VERIFIED'
                  ? 'VERIFIED'
                  : activeWaGroupSession.status === 'CANCELLED_TIMEOUT'
                  ? 'TIMED OUT'
                  : formatTime(activeWaGroupSession.secondsRemaining)}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {activeWaGroupSession.status === 'VERIFIED'
                  ? 'Admin Rights Confirmed'
                  : `Expires at ${new Date(activeWaGroupSession.expiresAt).toLocaleTimeString()}`}
              </span>
            </div>
          </div>

          {/* Dual Admin Bot Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Bot */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-white font-mono">PRIMARY ADMIN BOT</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                  WORKER
                </span>
              </div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {activeWaGroupSession.primaryAdminBot.phoneNumber}
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-slate-400 font-mono">
                <span>In Group: {activeWaGroupSession.primaryAdminBot.hasJoinedGroup ? 'YES' : 'PENDING'}</span>
                <span className={activeWaGroupSession.primaryAdminBot.isAdmin ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  Admin: {activeWaGroupSession.primaryAdminBot.isAdmin ? 'CONFIRMED' : 'AWAITING PROMOTION'}
                </span>
              </div>
            </div>

            {/* Backup Bot */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-xs font-bold text-white font-mono">BACKUP ADMIN BOT</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">
                  FAILOVER
                </span>
              </div>
              <div className="text-sm font-bold text-slate-200 font-mono">
                {activeWaGroupSession.backupAdminBot.phoneNumber}
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 text-slate-400 font-mono">
                <span>In Group: {activeWaGroupSession.backupAdminBot.hasJoinedGroup ? 'YES' : 'PENDING'}</span>
                <span className={activeWaGroupSession.backupAdminBot.isAdmin ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  Admin: {activeWaGroupSession.backupAdminBot.isAdmin ? 'CONFIRMED' : 'AWAITING PROMOTION'}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Rules Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 space-y-1.5 leading-relaxed">
            <span className="font-bold text-white font-mono block">10-Minute Rule Directives:</span>
            <p>• <strong className="text-amber-300">Rule A:</strong> If join requests are not approved into the GC in 10 minutes, both bots cancel request &amp; task cancels with ₦0 loss.</p>
            <p>• <strong className="text-amber-300">Rule B:</strong> If approved into group but not promoted to Admin in 10 minutes, both bots call <code className="text-slate-300">sock.groupLeave()</code> and notify user.</p>
            <p>• <strong className="text-emerald-300">Rule C:</strong> When both bots detect Group Admin status, verification is marked <code className="text-emerald-300">VERIFIED</code> and broadcast commences.</p>
          </div>

          {/* Interactive State Machine Simulation Triggers */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <span className="text-xs font-mono text-slate-400 block font-semibold">
              Live State Machine Testing Controls:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const updated = WaAdminVerifierService.simulateOwnerApprovesBotsIntoGroup(activeWaGroupSession, onAddLog);
                  setActiveWaGroupSession(updated);
                }}
                disabled={activeWaGroupSession.primaryAdminBot.hasJoinedGroup || activeWaGroupSession.status === 'CANCELLED_TIMEOUT'}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs text-slate-200 border border-white/10 font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Simulate Owner Approves Bots Into GC</span>
              </button>

              <button
                onClick={() => {
                  const updated = WaAdminVerifierService.simulateOwnerPromotesBotsToAdmin(activeWaGroupSession, onAddLog);
                  setActiveWaGroupSession(updated);
                }}
                disabled={activeWaGroupSession.status === 'VERIFIED' || activeWaGroupSession.status === 'CANCELLED_TIMEOUT'}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 text-xs text-emerald-300 border border-emerald-500/40 font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simulate Owner Promotes Both to Admin (Rule C)</span>
              </button>

              <button
                onClick={() => {
                  const updated = WaAdminVerifierService.evaluateVerificationTick(activeWaGroupSession, 0, onAddLog);
                  setActiveWaGroupSession(updated);
                }}
                disabled={activeWaGroupSession.status === 'VERIFIED' || activeWaGroupSession.status === 'CANCELLED_TIMEOUT'}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-xs text-rose-300 border border-rose-500/30 font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>Simulate 10-Minute Timeout Expiry</span>
              </button>
            </div>
          </div>

          {/* Unlock Deploy Button */}
          {activeWaGroupSession.status === 'VERIFIED' && (
            <div className="pt-2">
              <button
                onClick={handleFinalizeAndLaunch}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wider font-mono shadow-lg shadow-emerald-950/60 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                <span>VERIFIED! Launch Broadcast with 1-Hour Country Scrub Loop</span>
              </button>
            </div>
          )}

          {activeWaGroupSession.status === 'CANCELLED_TIMEOUT' && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs font-mono text-rose-300 flex items-center justify-between">
              <span>{activeWaGroupSession.cancellationReason}</span>
              <button
                onClick={() => setActiveWaGroupSession(null)}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {/* WORKFLOW 2: WA_CHANNEL MUTUAL CONTACT SAVE & CODE HANDSHAKE */}
      {activeWaChannelHandshake && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-cyan-500/30 backdrop-blur-xl space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <Radio className="w-4 h-4" />
                <span>WORKFLOW 2: WHATSAPP CHANNEL ANTI-BAN PROTOCOL</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Mutual Contact Save &amp; 6-Character Handshake
              </h3>
              <p className="text-xs text-slate-400">
                Cold channel admin invitations cause automated bans. Follow the 3-step mutual save protocol below:
              </p>
            </div>

            <span className={`text-xs px-3 py-1 rounded-full font-mono font-semibold ${
              activeWaChannelHandshake.status === 'INVITE_ACCEPTED_VERIFIED'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
            }`}>
              {activeWaChannelHandshake.status}
            </span>
          </div>

          {/* 3 Step Protocol Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <span className="text-[10px] text-slate-500 block">STEP 1: SAVE ADMIN CONTACT</span>
              <span className="text-sm font-bold text-white block">
                {activeWaChannelHandshake.assignedAdminBot.phoneNumber}
              </span>
              <p className="text-[11px] text-slate-400 font-sans">
                Save this number to your phone contacts. Our admin bot has already saved your number (+234...).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <span className="text-[10px] text-slate-500 block">STEP 2: SEND CODE VIA DM</span>
              <div className="flex items-center justify-between bg-white/[0.04] p-2 rounded-lg border border-white/5">
                <span className="text-base font-extrabold text-cyan-400 select-all">
                  {activeWaChannelHandshake.handshakeCode}
                </span>
                <button
                  onClick={() => handleCopyCode(activeWaChannelHandshake.handshakeCode)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Send this 6-character code as a WhatsApp DM to our admin bot number.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <span className="text-[10px] text-slate-500 block">STEP 3: INVITE AS CHANNEL ADMIN</span>
              <span className="text-sm font-bold text-amber-300 block">Channel Admin Invite</span>
              <p className="text-[11px] text-slate-400 font-sans">
                In WhatsApp &gt; Channel Settings &gt; Admins &gt; Invite Admin &gt; Select our saved number.
              </p>
            </div>
          </div>

          {/* Verification Code Submission Simulator */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
            <span className="text-xs font-mono text-slate-300 block">
              Simulate Code DM &amp; Channel Invitation Receipt:
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={channelDmInput}
                onChange={e => setChannelDmInput(e.target.value)}
                placeholder={`Enter code (e.g. ${activeWaChannelHandshake.handshakeCode})`}
                className="flex-1 px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => {
                  try {
                    const verified = WaAdminVerifierService.verifyChannelInviteEvent(
                      activeWaChannelHandshake,
                      channelDmInput || activeWaChannelHandshake.handshakeCode,
                      onAddLog
                    );
                    setActiveWaChannelHandshake(verified);
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white font-mono cursor-pointer"
              >
                Verify Channel Invite
              </button>
            </div>
          </div>

          {activeWaChannelHandshake.status === 'INVITE_ACCEPTED_VERIFIED' && (
            <button
              onClick={handleFinalizeAndLaunch}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wider font-mono shadow-lg shadow-emerald-950/60 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>CHANNEL VERIFIED! Deploy Earner Broadcast Sessions</span>
            </button>
          )}
        </div>
      )}

      {/* WORKFLOW 3 & 4: TELEGRAM GROUP & CHANNEL MONOTONIC EVENT COUNTER */}
      {activeTgSession && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-cyan-500/30 backdrop-blur-xl space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <Bot className="w-4 h-4" />
                <span>WORKFLOW 3 &amp; 4: @OurGrowthBot MONOTONIC EVENT COUNTER</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Telegram {activeTgSession.isChannel ? 'Channel' : 'Group'} Join Request Pipeline
              </h3>
              <p className="text-xs text-slate-400">
                Target: {activeTgSession.chatTitle} · Monotonic Counter: {activeTgSession.cumulativeRequestsReceived} / {activeTgSession.requestedVolume}
              </p>
            </div>

            <button
              onClick={() => {
                const verified = TelegramVerifierService.verifyBotAdminRights(activeTgSession, onAddLog);
                setActiveTgSession(verified);
              }}
              disabled={activeTgSession.status === 'VERIFIED_RUNNING' || activeTgSession.status === 'COMPLETED'}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-xs font-semibold text-white font-mono cursor-pointer"
            >
              {activeTgSession.status === 'AWAITING_BOT_ADMIN' ? 'Confirm @OurGrowthBot Added as Admin' : 'Admin Confirmed'}
            </button>
          </div>

          {/* The Critical Accounting Invariant Banner */}
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 space-y-1.5 leading-relaxed font-mono">
            <span className="font-bold text-cyan-300 block">Strict Monotonic Counter Invariant:</span>
            <p>
              If the Telegram group/channel owner approves or declines a join request while broadcast runs, <strong>DO NOT subtract from the counter and DO NOT send extra traffic to backfill</strong>. An approved join request is a successfully delivered conversion!
            </p>
          </div>

          {/* Interactive Webhook Simulator */}
          {activeTgSession.status === 'VERIFIED_RUNNING' && (
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 font-mono">
              <span className="text-xs font-semibold text-white block">
                Simulate Telegram Webhook Updates:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const randomUserId = Math.floor(100000000 + Math.random() * 900000000);
                    const result = TelegramVerifierService.processTelegramWebhookEvent(
                      activeTgSession,
                      {
                        update_id: Date.now(),
                        chat_id: activeTgSession.chatId,
                        chat_title: activeTgSession.chatTitle,
                        is_channel: activeTgSession.isChannel,
                        event_type: 'chat_join_request',
                        from: { id: randomUserId, first_name: 'Solana Trader', username: `trader_${randomUserId.toString().slice(-4)}` },
                        date: Math.floor(Date.now() / 1000),
                      },
                      onAddLog
                    );
                    setActiveTgSession(result.updatedSession);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 text-xs border border-emerald-500/40 cursor-pointer"
                >
                  + Simulate Incoming User `chat_join_request`
                </button>

                <button
                  onClick={() => {
                    const result = TelegramVerifierService.processTelegramWebhookEvent(
                      activeTgSession,
                      {
                        update_id: Date.now(),
                        chat_id: activeTgSession.chatId,
                        chat_title: activeTgSession.chatTitle,
                        is_channel: activeTgSession.isChannel,
                        event_type: 'chat_join_request_approved_by_owner',
                        from: { id: 999111222, first_name: 'Existing Member', username: 'vip_buyer' },
                        date: Math.floor(Date.now() / 1000),
                      },
                      onAddLog
                    );
                    setActiveTgSession(result.updatedSession);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs border border-amber-500/30 cursor-pointer"
                >
                  Simulate Owner Approves Request (Verify Non-Backfill)
                </button>
              </div>
            </div>
          )}

          {activeTgSession.status === 'VERIFIED_RUNNING' && (
            <button
              onClick={handleFinalizeAndLaunch}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs tracking-wider font-mono shadow-lg shadow-cyan-950/60 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Launch TG Campaign with Monotonic Ledger</span>
            </button>
          )}
        </div>
      )}

      {/* 8. ACTIVE CAMPAIGNS INVENTORY & RECURRING HOURLY FILTER MONITOR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Active Campaigns &amp; Automated Filter Hub</h3>
            <p className="text-xs text-slate-400">
              Live broadcast dispatches, admin verification status, 1-hour country filters, and monotonic counters.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400">
            {campaigns.length} Total Campaigns
          </span>
        </div>

        <div className="space-y-4">
          {campaigns.map(campaign => {
            const isSmart = campaign.pathway === 'SMART_VERIFIED';
            const targetTotal = isSmart ? (campaign.requestedVolume || 100) : (campaign.maxWorkerCoinBudget);
            const currentProgress = isSmart ? campaign.cumulativeRequestsDelivered : campaign.coinsPaidToWorkers;
            const pct = Math.min(100, (currentProgress / (targetTotal || 1)) * 100);

            return (
              <div
                key={campaign.id}
                className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">
                        {campaign.title}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                        campaign.pathway === 'DIRECT_SESSION'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {campaign.pathway === 'DIRECT_SESSION' ? 'DIRECT SESSION' : campaign.smartSystemType}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono">
                        {campaign.broadcastMode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      Target: {campaign.targetUrl}
                    </p>
                  </div>

                  <span className={`text-xs px-2.5 py-1 rounded font-mono font-medium ${
                    campaign.status === 'RUNNING'
                      ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                      : campaign.status === 'COMPLETED'
                      ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/40'
                      : 'text-amber-400 bg-amber-950/40 border border-amber-800/40'
                  }`}>
                    {campaign.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>
                      {isSmart 
                        ? `Monotonic Join Requests Delivered: ${campaign.cumulativeRequestsDelivered} / ${campaign.requestedVolume}`
                        : `Escrow Coins Paid to Workers: ${campaign.coinsPaidToWorkers.toFixed(3)} / ${campaign.maxWorkerCoinBudget.toFixed(3)} Coins`}
                    </span>
                    <span className="text-white font-bold">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Specific 10-Minute Timer Box for WA Group */}
                {campaign.smartSystemType === 'WA_GROUP' && !campaign.verifiedAsAdmin && (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="space-y-0.5">
                      <span className="text-amber-300 font-bold block">
                        Dual Admin Bots Assigned: {campaign.assignedPrimaryBot} (Primary) &amp; {campaign.assignedBackupBot} (Backup)
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Approve join request &amp; promote to Admin. 10-Minute timer active before auto-leave.
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        const updated: Campaign = { ...campaign, verifiedAsAdmin: true, status: 'RUNNING' };
                        onUpdateCampaign(updated);
                        onAddLog({
                          id: `adm_conf_${Date.now()}`,
                          timestamp: new Date().toISOString(),
                          source: 'BROADCAST_WORKER',
                          level: 'SUCCESS',
                          message: `Admin verified for campaign #${campaign.id.slice(0, 6)}!`,
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] cursor-pointer"
                    >
                      Confirm Bot Promoted
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
                  {campaign.status === 'RUNNING' && (
                    <button
                      onClick={async () => {
                        const qualifiedGroups = groups.filter(g => g.status === 'OPEN' && g.memberCount >= 100);
                        if (qualifiedGroups.length === 0) return;
                        const targetGroup = qualifiedGroups[Math.floor(Math.random() * qualifiedGroups.length)];
                        try {
                          const event = await BroadcastWorker.broadcastToGroup(campaign, targetGroup, onAddLog);
                          const updatedCampaign: Campaign = {
                            ...campaign,
                            coinsPaidToWorkers: Number((campaign.coinsPaidToWorkers + event.coinsEarned).toFixed(3)),
                            cumulativeRequestsDelivered: campaign.cumulativeRequestsDelivered + Math.floor(Math.random() * 3) + 1,
                          };
                          onUpdateCampaign(updatedCampaign);
                        } catch (err: any) {
                          if (err.message === 'CAMPAIGN_BUDGET_REACHED') {
                            onUpdateCampaign({ ...campaign, status: 'COMPLETED' });
                          }
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Simulate Broadcast Dispatch (1 Open GC)</span>
                    </button>
                  )}

                  {campaign.smartSystemType === 'WA_GROUP' && campaign.status === 'RUNNING' && (
                    <button
                      onClick={() => {
                        const simulatedRequests = Array.from({ length: 20 }).map((_, i) => ({
                          jid: `req_${i}@s.whatsapp.net`,
                          phoneNumber: Math.random() > 0.35 ? '234808392019' : '447911123456',
                        }));
                        const result = WaAdminVerifierService.executeHourlyCountryFilterLoop(
                          campaign,
                          simulatedRequests,
                          onAddLog
                        );
                        const updated: Campaign = {
                          ...campaign,
                          cumulativeRequestsDelivered: campaign.cumulativeRequestsDelivered + result.validCount,
                          rejectedWrongCountryCount: campaign.rejectedWrongCountryCount + result.rejectedWrongCountry.length,
                          status: result.isCompleted ? 'COMPLETED' : campaign.status,
                        };
                        onUpdateCampaign(updated);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Run 1-Hour Country Scrub ({campaign.rejectedWrongCountryCount} rejected so far)</span>
                    </button>
                  )}

                  {(campaign.smartSystemType === 'TG_GROUP' || campaign.smartSystemType === 'TG_CHANNEL') && campaign.status === 'RUNNING' && (
                    <button
                      onClick={() => {
                        const randomUserId = Math.floor(100000000 + Math.random() * 900000000);
                        const dummySess: TelegramCampaignSession = {
                          campaignId: campaign.id,
                          chatId: campaign.telegramChatId || '@CommunityChat',
                          chatTitle: campaign.title,
                          isChannel: campaign.smartSystemType === 'TG_CHANNEL',
                          botUsername: '@OurGrowthBot',
                          requestedVolume: campaign.requestedVolume || 100,
                          cumulativeRequestsReceived: campaign.cumulativeRequestsDelivered,
                          deliveredUserIds: new Set<number>(),
                          status: 'VERIFIED_RUNNING',
                          startedAt: campaign.createdAt,
                        };
                        const res = TelegramVerifierService.processTelegramWebhookEvent(
                          dummySess,
                          {
                            update_id: Date.now(),
                            chat_id: dummySess.chatId,
                            chat_title: dummySess.chatTitle,
                            is_channel: dummySess.isChannel,
                            event_type: 'chat_join_request',
                            from: { id: randomUserId, first_name: 'Member', username: `user_${randomUserId.toString().slice(-4)}` },
                            date: Math.floor(Date.now() / 1000),
                          },
                          onAddLog
                        );
                        const updated: Campaign = {
                          ...campaign,
                          cumulativeRequestsDelivered: res.updatedSession.cumulativeRequestsReceived,
                          status: res.updatedSession.status === 'COMPLETED' ? 'COMPLETED' : campaign.status,
                        };
                        onUpdateCampaign(updated);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 border border-white/10 flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Simulate Incoming TG Join Request</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
