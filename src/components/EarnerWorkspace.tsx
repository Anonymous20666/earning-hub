import React, { useState } from 'react';
import { 
  Wallet, 
  PairedSession, 
  SessionGroup, 
  ValidatedGroupPoolItem, 
  LiveTerminalLog,
  SessionTier
} from '../types';
import { WalletLedgerService, FX_RATES } from '../services/walletLedger';
import { JoinManagerService } from '../whatsapp/joinManager';
import { HistoricalEarningsChart } from './HistoricalEarningsChart';
import { 
  ShieldCheck, 
  Coins, 
  Lock, 
  Unlock, 
  ArrowUpRight, 
  QrCode, 
  Sparkles, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  ExternalLink, 
  RefreshCw, 
  UserPlus, 
  Play, 
  Pause 
} from 'lucide-react';

interface EarnerWorkspaceProps {
  wallet: Wallet;
  sessions: PairedSession[];
  groups: SessionGroup[];
  validatedPool: ValidatedGroupPoolItem[];
  onUpdateWallet: (wallet: Wallet) => void;
  onUpdateSessions: (sessions: PairedSession[]) => void;
  onUpdateGroups: (groups: SessionGroup[]) => void;
  onAddLog: (log: LiveTerminalLog) => void;
}

export const EarnerWorkspace: React.FC<EarnerWorkspaceProps> = ({
  wallet,
  sessions,
  groups,
  validatedPool,
  onUpdateWallet,
  onUpdateSessions,
  onUpdateGroups,
  onAddLog,
}) => {
  // Modal states
  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  
  // Pairing workflow state
  const [phoneInput, setPhoneInput] = useState('+234 ');
  const [isOldNumber, setIsOldNumber] = useState(true);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isPairingActive, setIsPairingActive] = useState(false);

  // Withdrawal state
  const [selectedCurrency, setSelectedCurrency] = useState<'NGN' | 'USDT' | 'KES' | 'GHS' | 'XOF'>('NGN');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);

  // Join manager auto-step runner
  const [autoJoinRunning, setAutoJoinRunning] = useState(false);

  // Active session
  const activeSession = sessions[0] || null;

  // Withdrawal evaluation
  const lockEval = WalletLedgerService.evaluateWithdrawalLock(wallet);
  const progressToUnlock = Math.min(100, (wallet.earned_balance / 300.0) * 100);

  // Currency conversion calculation
  const cashoutQuote = WalletLedgerService.convertCoinsToCurrency(
    Math.max(500, lockEval.availableCashoutCoins || 500),
    selectedCurrency
  );

  // Start 8-digit pairing simulation
  const handleStartPairing = () => {
    if (!phoneInput || phoneInput.length < 9) return;
    setIsPairingActive(true);
    setPairingCode('Generating...');

    setTimeout(() => {
      // Generate standard 8-character Baileys pairing code e.g. "72K8-XP9M"
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = '';
      for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      setPairingCode(code);

      onAddLog({
        id: `pair_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'STATE_PLANE',
        level: 'INFO',
        message: `[plogme] 8-digit Multi-Device pairing code [${code}] generated for ${phoneInput}. Enter on WhatsApp -> Linked Devices -> Link with phone number.`,
      });
    }, 1200);
  };

  // Complete pairing simulation
  const handleConfirmPairing = () => {
    if (!pairingCode) return;
    const cleanPhone = phoneInput.replace(/\s+/g, '');
    const cleanJid = `${cleanPhone.replace('+', '')}@s.whatsapp.net`;

    const newSession: PairedSession = {
      id: `sess_${Date.now()}`,
      userId: wallet.userId,
      phoneNumber: cleanPhone,
      jid: cleanJid,
      deviceHash: `fp_${Math.random().toString(36).substring(2, 9)}`,
      tier: 'BRONZE',
      status: 'ONLINE',
      openGcCount: 5,
      totalGcCount: 7,
      virtualGoldUnits: 0,
      isOldNumber,
      pairedAt: new Date().toISOString(),
      autoJoinEnabled: false,
    };

    onUpdateSessions([newSession, ...sessions]);
    setShowPairModal(false);
    setIsPairingActive(false);
    setPairingCode(null);

    onAddLog({
      id: `pair_ok_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'BROADCAST_WORKER',
      level: 'SUCCESS',
      message: `WhatsApp Multi-Device paired successfully (${cleanPhone})! Synchronized 5 open groups. Ready for broadcast queue.`,
    });
  };

  // Execute withdrawal
  const handleExecuteWithdrawal = () => {
    try {
      const coinsToCashout = lockEval.availableCashoutCoins;
      const result = WalletLedgerService.executeWithdrawal(wallet, coinsToCashout);
      onUpdateWallet(result.updatedWallet);
      setWithdrawSuccessMsg(
        `Dispatched ${cashoutQuote.amount} ${selectedCurrency} (₦${result.cashedOutNgn.toFixed(2)} / ${coinsToCashout.toFixed(3)} Coins) to ${withdrawAddress}.`
      );

      onAddLog({
        id: `wd_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'AI_ACCOUNTANT',
        level: 'SUCCESS',
        message: `Cashout verified: ${coinsToCashout.toFixed(3)} Coins debited. Locked bonus consumed. Zero loss invariant preserved.`,
      });

      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Run single automated join manager step
  const handleRunJoinStep = async () => {
    if (!activeSession) return;
    setAutoJoinRunning(true);

    try {
      const result = await JoinManagerService.executeAutomatedJoinStep(
        activeSession,
        groups,
        {
          targetOpenGcs: 100,
          jitterMinMins: 15,
          jitterMaxMins: 35,
          dailyMaxJoins: activeSession.isOldNumber ? 12 : 5,
          autoMuteAndArchive: true,
        },
        onAddLog
      );

      const updatedSessions = sessions.map(s => s.id === activeSession.id ? result.updatedSession : s);
      onUpdateSessions(updatedSessions);

      if (result.newGroup) {
        onUpdateGroups([result.newGroup, ...groups]);
      }
    } finally {
      setAutoJoinRunning(false);
    }
  };

  // Manual 1-click join simulation
  const handleManualJoin = (item: ValidatedGroupPoolItem) => {
    if (!activeSession) return;
    const newGroupJid = `${item.inviteCode}@g.us`;
    const newG: SessionGroup = {
      id: `sg_man_${Date.now()}`,
      sessionId: activeSession.id,
      groupJid: newGroupJid,
      subject: item.subject,
      memberCount: item.memberCount,
      status: 'OPEN',
      isWorkerAdmin: false,
      oneXCoins: Number((Math.min(item.memberCount, 1000) / 1000).toFixed(3)),
      twoXCoins: Number((2 * (Math.min(item.memberCount, 1000) / 1000)).toFixed(3)),
    };

    onUpdateGroups([newG, ...groups]);
    const updatedSess = {
      ...activeSession,
      openGcCount: activeSession.openGcCount + 1,
      totalGcCount: activeSession.totalGcCount + 1,
    };
    onUpdateSessions(sessions.map(s => s.id === activeSession.id ? updatedSess : s));

    onAddLog({
      id: `man_join_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'SUCCESS',
      message: `Manual 1-Click joined [${item.subject}] (${item.memberCount} members). Capacity increased by +${newG.oneXCoins.toFixed(3)} Coins per broadcast.`,
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. HERO COIN VAULT & DUAL-WALLET PROGRESS */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>ENDOWED PROGRESS DUAL-WALLET LEDGER</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Pair-to-Earn Vault &amp; Cashout Center
            </h2>
            <p className="text-sm text-slate-400 max-w-xl">
              1.000 Coin is pegged 1:1 with ₦1.00 NGN. Minimum cashout is strictly 500.000 Coins (₦500.00). Earn with every qualified open group delivered.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSafetyModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 border border-white/10 transition-colors flex items-center gap-2"
            >
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Safety &amp; Earning Advisory</span>
            </button>

            <button
              onClick={() => setShowPairModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <QrCode className="w-4 h-4" />
              <span>Pair WhatsApp Account</span>
            </button>
          </div>
        </div>

        {/* 3D Glass Financial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Card 1: 200.000 Locked Bonus */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">LOCKED REGISTRATION BONUS</span>
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-300 font-mono">
                {wallet.locked_bonus.toFixed(3)}
              </span>
              <span className="text-xs text-amber-500 font-mono">Coins (₦{wallet.locked_bonus.toFixed(2)})</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {wallet.bonus_claimed 
                ? 'Bonus claimed and paid out on first withdrawal!' 
                : 'Granted upon registration. Unlocks at 300.000 earned coins.'}
            </p>
          </div>

          {/* Card 2: Earned Balance */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">EARNED BALANCE (BROADCASTS)</span>
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-300 font-mono">
                {wallet.earned_balance.toFixed(3)}
              </span>
              <span className="text-xs text-emerald-500 font-mono">Coins (₦{wallet.earned_balance.toFixed(2)})</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Increases only from verified 200 OK broadcast deliveries and active referrals.
            </p>
          </div>

          {/* Card 3: Total Withdrawable & Unlock Button */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">WITHDRAWABLE AMOUNT</span>
                {lockEval.canWithdraw ? (
                  <Unlock className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white font-mono">
                  {lockEval.availableCashoutCoins > 0 
                    ? lockEval.availableCashoutCoins.toFixed(3) 
                    : (wallet.earned_balance + wallet.locked_bonus).toFixed(3)}
                </span>
                <span className="text-xs text-slate-400 font-mono">Coins</span>
              </div>
            </div>

            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!lockEval.canWithdraw}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                lockEval.canWithdraw
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/60 cursor-pointer'
                  : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
              }`}
            >
              {lockEval.canWithdraw ? (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Withdraw ₦{lockEval.availableCashoutCoins.toFixed(2)}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Unlock at 300 Earned ({progressToUnlock.toFixed(0)}%)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* The Ironclad Unlock Progress Bar */}
        {!wallet.bonus_claimed && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">
                Unlock 200.000 Bonus: {wallet.earned_balance.toFixed(3)} / 300.000 Earned
              </span>
              <span className={lockEval.canWithdraw ? 'text-emerald-400' : 'text-amber-400'}>
                {lockEval.canWithdraw ? 'Unlocked (500.000 Coins Ready)' : `${lockEval.coinsNeededToUnlock.toFixed(3)} Coins Needed`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressToUnlock}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. HISTORICAL 7-DAY EARNINGS LINE CHART */}
      <HistoricalEarningsChart currentEarnedBalance={wallet.earned_balance} />

      {/* 3. LIVE PAIRED SESSIONS & TIER BREAKDOWN */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Paired WhatsApp Sessions</h3>
            <p className="text-xs text-slate-400">
              Sessions are dynamically tiered by Qualified Open GCs (100+ members). 100+ GCs unlocks Gold Turbo Mode.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500">Total: {sessions.length} sessions</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map(session => (
            <div 
              key={session.id}
              className="p-5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white font-mono">
                      {session.phoneNumber}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                      session.tier === 'GOLD' 
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                        : session.tier === 'SILVER'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {session.tier} SESSION
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    JID: {session.jid} · Device Hash: {session.deviceHash}
                  </p>
                </div>

                <span className={`text-xs px-2.5 py-1 rounded font-mono font-medium ${
                  session.status === 'ONLINE'
                    ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                    : 'text-amber-400 bg-amber-950/40 border border-amber-800/40'
                }`}>
                  {session.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-center font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">OPEN GCs (&gt;=100)</span>
                  <span className="text-base font-bold text-white">{session.openGcCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">TOTAL GCs</span>
                  <span className="text-base font-bold text-slate-300">{session.totalGcCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">GOLD UNITS (100x)</span>
                  <span className="text-base font-bold text-amber-400">{session.virtualGoldUnits}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {session.tier === 'GOLD' 
                    ? '⚡ Turbo Speed Active (High Advertiser Demand)' 
                    : `${100 - session.openGcCount} more open GCs needed for Gold Turbo Speed`}
                </span>
                <span className="text-slate-500 text-[11px]">
                  Paired {new Date(session.pairedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. LIVE GC INVENTORY TABLE */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-white">Live WhatsApp Group Inventory &amp; Coin Rates</h3>
            <p className="text-xs text-slate-400">
              Only Open groups with &gt;= 100 members earn coins. 1,000+ members earn max 1.000 Coin (1x) or 2.000 Coins (2x VIP).
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400">
            {groups.filter(g => g.status === 'OPEN' && g.memberCount >= 100).length} Qualified Open Groups
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.01]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-black/60 text-slate-400 border-b border-white/10">
              <tr>
                <th className="p-3.5 font-medium">Group Subject</th>
                <th className="p-3.5 font-medium">Members</th>
                <th className="p-3.5 font-medium">Messaging Status</th>
                <th className="p-3.5 font-medium">1x AllStatus Rate</th>
                <th className="p-3.5 font-medium">2x VIP AllChat Rate</th>
                <th className="p-3.5 font-medium">Qualification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {groups.map(group => {
                const isQualified = group.status === 'OPEN' && group.memberCount >= 100;
                return (
                  <tr key={group.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 text-slate-200 font-sans font-medium">
                      {group.subject}
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {group.memberCount} members
                      {group.memberCount > 1000 && <span className="text-[10px] text-slate-500 block">(capped at 1,000)</span>}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        group.status === 'OPEN'
                          ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                          : group.status === 'LOCKED'
                          ? 'text-amber-400 bg-amber-950/40 border border-amber-800/40'
                          : 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
                      }`}>
                        {group.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-emerald-400 font-semibold">
                      +{group.oneXCoins.toFixed(3)} Coins
                    </td>
                    <td className="p-3.5 text-amber-400 font-semibold">
                      +{group.twoXCoins.toFixed(3)} Coins
                    </td>
                    <td className="p-3.5">
                      {isQualified ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Qualified</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{group.memberCount < 100 ? '&lt; 100 members (0.000)' : 'Locked Group'}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. WEB JOIN MANAGER & VERIFIED GROUP DIRECTORY */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Layers className="w-4 h-4" />
              <span>WEB JOIN MANAGER (STATE-PLANE INCUBATION)</span>
            </div>
            <h3 className="text-xl font-bold text-white">Grow Open Groups to 100+ (Gold Turbo)</h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Join verified open groups from our sanitized pool. Choose manual 1-click joining or hands-free automated incubation with human jitter delays.
            </p>
          </div>

          <button
            onClick={handleRunJoinStep}
            disabled={autoJoinRunning}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
          >
            {autoJoinRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>State-Plane Joining...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Simulate Automated Join Step</span>
              </>
            )}
          </button>
        </div>

        {/* Advisory Banner */}
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 flex items-start gap-3">
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-cyan-300">Account Safety Directive:</span>
            <p className="leading-relaxed text-slate-300">
              For maximum safety on newer WhatsApp numbers, we advise joining groups manually or allowing our automated joiner to space invites by 15–35 minutes with automatic muting &amp; chat archiving. While incubating, broadcast tasks are paused.
            </p>
          </div>
        </div>

        {/* Directory List of Verified Open Groups */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono font-semibold text-slate-300">
            Verified Group Directory (1-Click Manual Join):
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {validatedPool.slice(0, 4).map(item => (
              <div 
                key={item.id}
                className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-white block">
                    {item.subject}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>{item.memberCount} members</span>
                    <span>·</span>
                    <span className="text-emerald-400">+{item.inferredPrefix}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleManualJoin(item)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-slate-200 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3 text-cyan-400" />
                  <span>Join Group</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SAFETY & TRANSPARENCY MODAL */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0c0e14] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-semibold">
                <ShieldCheck className="w-5 h-5" />
                <span>Onboarding Safety &amp; Earning Rules</span>
              </div>
              <button onClick={() => setShowSafetyModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="font-semibold text-white block">1. Group-Only Operations:</span>
                <p>Your WhatsApp account is strictly used to post verified broadcasts into your groups—never private chats. We never read or touch your personal DMs.</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="font-semibold text-white block">2. Old Numbers vs Brand-New SIMs:</span>
                <p>We strongly recommend pairing an older WhatsApp account (3+ months active). If pairing a brand-new number, please avoid heavy manual chatting while our system warms up your account.</p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="font-semibold text-white block">3. Earning Speed &amp; 100+ GCs:</span>
                <p>Having 100+ Open GCs (100+ members each) unlocks immediate Gold Turbo Speed. Having fewer GCs simply takes more broadcasts to reach the 300.000 earned unlock milestone.</p>
              </div>
            </div>

            <button
              onClick={() => setShowSafetyModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
            >
              I Understand &amp; Agree
            </button>
          </div>
        </div>
      )}

      {/* PAIRING MODAL */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0c0e14] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-semibold">
                <QrCode className="w-5 h-5" />
                <span>WhatsApp Multi-Device Pairing</span>
              </div>
              <button onClick={() => setShowPairModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {!pairingCode ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">WhatsApp Phone Number</label>
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    placeholder="+234 801 234 5678"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500">Include country dial code (e.g., +234, +254, +233, +1)</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    id="oldNumberCheck"
                    checked={isOldNumber}
                    onChange={e => setIsOldNumber(e.target.checked)}
                    className="rounded bg-white/10 text-emerald-500"
                  />
                  <label htmlFor="oldNumberCheck">This is an old WhatsApp account (&gt; 3 months old)</label>
                </div>

                <button
                  onClick={handleStartPairing}
                  disabled={isPairingActive}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  {isPairingActive ? 'Generating Pairing Code...' : 'Generate 8-Digit Pairing Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30 space-y-2">
                  <span className="text-xs text-slate-400 font-mono">YOUR 8-DIGIT PAIRING CODE</span>
                  <div className="text-3xl font-extrabold text-emerald-400 font-mono tracking-widest select-all">
                    {pairingCode}
                  </div>
                  <span className="text-[11px] text-slate-500 block">Code expires in 120 seconds</span>
                </div>

                <div className="text-xs text-slate-300 text-left space-y-1.5 bg-white/[0.02] p-3 rounded-lg border border-white/5">
                  <span className="font-semibold text-white block">Instructions:</span>
                  <p>1. Open WhatsApp on your phone</p>
                  <p>2. Tap Settings / 3-Dots &gt; Linked Devices</p>
                  <p>3. Tap "Link a device" &gt; "Link with phone number instead"</p>
                  <p>4. Enter the 8-digit code shown above</p>
                </div>

                <button
                  onClick={handleConfirmPairing}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  I Entered Code (Confirm Link)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0c0e14] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-semibold">
                <Coins className="w-5 h-5" />
                <span>Multi-Currency Cashout Converter</span>
              </div>
              <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {withdrawSuccessMsg ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <span className="text-sm font-semibold text-emerald-300 block">Payout Dispatched!</span>
                <p className="text-xs text-slate-300">{withdrawSuccessMsg}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Available Cashout:</span>
                    <span className="text-white font-bold">{lockEval.availableCashoutCoins.toFixed(3)} Coins</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>NGN Value:</span>
                    <span className="text-emerald-400 font-bold">₦{lockEval.availableCashoutCoins.toFixed(2)}</span>
                  </div>
                </div>

                {/* Currency Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Select Payout Currency</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['NGN', 'USDT', 'KES', 'GHS', 'XOF'] as const).map(curr => (
                      <button
                        key={curr}
                        onClick={() => setSelectedCurrency(curr)}
                        className={`py-2 rounded-lg text-xs font-mono font-medium transition-colors ${
                          selectedCurrency === curr
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversion breakdown */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Target Payout:</span>
                    <span className="text-white font-bold text-sm">
                      {cashoutQuote.amount} {cashoutQuote.currency}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>FX Rate:</span>
                    <span>1 {cashoutQuote.currency} = {cashoutQuote.rateUsed} NGN</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Safety Spread:</span>
                    <span>-{cashoutQuote.safetySpreadDeduction} {cashoutQuote.currency} (5%)</span>
                  </div>
                </div>

                {/* Destination input */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">
                    {selectedCurrency === 'NGN' ? 'Bank Account / OPay Number' : `${selectedCurrency} Wallet Address`}
                  </label>
                  <input
                    type="text"
                    value={withdrawAddress}
                    onChange={e => setWithdrawAddress(e.target.value)}
                    placeholder={selectedCurrency === 'NGN' ? 'e.g. 8083499201 OPay' : '0x... or T...'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  onClick={handleExecuteWithdrawal}
                  disabled={!withdrawAddress || !lockEval.canWithdraw}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Confirm Cashout ({cashoutQuote.amount} {cashoutQuote.currency})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
