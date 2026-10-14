import React, { useState } from 'react';
import { 
  AdminMonitorBot, 
  SupportTicket, 
  SystemPricingConfig, 
  ValidatedGroupPoolItem, 
  LiveTerminalLog,
  Campaign 
} from '../types';
import { ValidatorHubService, ValidatorTelemetry } from '../whatsapp/validatorHub';
import { TelegramBotBridgeService } from '../verifiers/telegramBotBridge';
import { accountantAi } from '../services/accountantAi';
import { 
  ShieldCheck, 
  UploadCloud, 
  Activity, 
  Sliders, 
  MessageSquare, 
  Bot, 
  Lock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  DollarSign, 
  BrainCircuit, 
  Coins 
} from 'lucide-react';

interface AdminCommandCenterProps {
  adminBots: AdminMonitorBot[];
  supportTickets: SupportTicket[];
  pricingConfig: SystemPricingConfig;
  validatedPool: ValidatedGroupPoolItem[];
  campaigns: Campaign[];
  onUpdatePricing: (pricing: SystemPricingConfig) => void;
  onUpdateTickets: (tickets: SupportTicket[]) => void;
  onAddLog: (log: LiveTerminalLog) => void;
}

export const AdminCommandCenter: React.FC<AdminCommandCenterProps> = ({
  adminBots,
  supportTickets,
  pricingConfig,
  validatedPool,
  campaigns,
  onUpdatePricing,
  onUpdateTickets,
  onAddLog,
}) => {
  // Validator Hub text upload state
  const [rawLinksInput, setRawLinksInput] = useState('');
  const [telemetry, setTelemetry] = useState<ValidatorTelemetry>({
    linksChecked: 0,
    valid100PlusOpen: 0,
    lockedRejected: 0,
    smallRejected: 0,
    deadLinks: 0,
    reqPerSec: 0,
    isProcessing: false,
  });

  // AI Accountant dynamic advice state
  const [aiAdviceText, setAiAdviceText] = useState<string | null>(null);
  const [isAiConsulting, setIsAiConsulting] = useState(false);

  // House Campaign State
  const [houseUrl, setHouseUrl] = useState('https://chat.whatsapp.com/Kp9zL2xY9m1VbNqR4wT8eC');
  const [houseBudget, setHouseBudget] = useState(250);

  // Admin Bot Pairing state
  const [newBotPhone, setNewBotPhone] = useState('+234 ');
  const [newBotRole, setNewBotRole] = useState<'PRIMARY' | 'BACKUP'>('PRIMARY');

  // Trigger Validator Hub Text Batch
  const handleProcessLinksBatch = async () => {
    if (!rawLinksInput) {
      alert('Please paste or enter WhatsApp invite links.');
      return;
    }

    try {
      await ValidatorHubService.processTextBatch(
        rawLinksInput,
        t => setTelemetry(t),
        onAddLog
      );
      setRawLinksInput('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Generate Sample 500-Link Batch
  const handleLoadSampleLinks = () => {
    let sample = '';
    for (let i = 0; i < 50; i++) {
      const code = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 14);
      sample += `https://chat.whatsapp.com/${code}\n`;
    }
    setRawLinksInput(sample);
  };

  // Consult AI Accountant
  const handleConsultAiAccountant = async () => {
    setIsAiConsulting(true);
    try {
      const result = await accountantAi.getDynamicPricingAdvice({
        activeBronzeSessions: 14,
        activeSilverSessions: 22,
        activeGoldSessions: 8,
        pendingBroadcastQueue: 18,
        proposedOrder: {
          type: 'DIRECT_SESSION_ALLCHAT_VIP',
          volumeOrSessions: 5,
          isVip: true,
          countryMode: 'SPECIFIC_COUNTRIES',
        },
      });
      setAiAdviceText(result.advice);
      onAddLog({
        id: `ai_quant_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'AI_ACCOUNTANT',
        level: 'INFO',
        message: `Quant Reasoning complete: ${result.advice}`,
      });
    } finally {
      setIsAiConsulting(false);
    }
  };

  // Resolve Ticket
  const handleResolveTicket = (ticketId: string, action: 'REPLY' | 'FORCE_APPROVE' | 'REFUND_COINS' | 'APPROVE_WITHDRAWAL') => {
    const updatedTicket = TelegramBotBridgeService.resolveTicket(
      ticketId,
      action,
      `Action executed by SuperAdmin. Synced to Telegram @OurGrowthBot bridge.`,
      onAddLog
    );
    onUpdateTickets(supportTickets.map(t => t.id === ticketId ? updatedTicket : t));
  };

  return (
    <div className="space-y-8">
      {/* 1. VALIDATOR HUB & LINK SANITIZER */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <UploadCloud className="w-4 h-4" />
              <span>SHARDED STATE-PLANE VALIDATOR HUB</span>
            </div>
            <h3 className="text-xl font-bold text-white">Massive .txt Link Ingestion &amp; Sanitizer</h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Ingest raw .txt files or paste blobs containing up to 500,000+ WhatsApp invite links. Sharded Baileys state-plane inspects groups, discards dead/locked/&lt;100 members, and populates the Join Manager pool.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSampleLinks}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 border border-white/10 transition-colors"
            >
              Generate 50 Sample Links
            </button>
            <button
              onClick={handleProcessLinksBatch}
              disabled={telemetry.isProcessing || !rawLinksInput}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center gap-2 shadow-lg shadow-cyan-950/60 cursor-pointer"
            >
              {telemetry.isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sanitizing ({telemetry.reqPerSec} req/s)...</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  <span>Start Sharded Ingestion</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Text Area */}
        <textarea
          value={rawLinksInput}
          onChange={e => setRawLinksInput(e.target.value)}
          rows={4}
          placeholder="Paste https://chat.whatsapp.com/XXXXX links here or drag .txt file..."
          className="w-full p-3.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 resize-none"
        />

        {/* Live Telemetry Scoreboard */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono">
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
            <span className="text-[10px] text-slate-500 block">CHECKED</span>
            <span className="text-base font-bold text-white">{telemetry.linksChecked}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center">
            <span className="text-[10px] text-emerald-400 block">&gt;=100 OPEN (VALID)</span>
            <span className="text-base font-bold text-emerald-300">{telemetry.valid100PlusOpen}</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-center">
            <span className="text-[10px] text-amber-400 block">LOCKED (ANNOUNCE)</span>
            <span className="text-base font-bold text-amber-300">{telemetry.lockedRejected}</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-center">
            <span className="text-[10px] text-rose-400 block">&lt; 100 MEMBERS</span>
            <span className="text-base font-bold text-rose-300">{telemetry.smallRejected}</span>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
            <span className="text-[10px] text-slate-500 block">DEAD / REVOKED</span>
            <span className="text-base font-bold text-slate-400">{telemetry.deadLinks}</span>
          </div>
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-center">
            <span className="text-[10px] text-cyan-400 block">THROUGHPUT</span>
            <span className="text-base font-bold text-cyan-300">{telemetry.reqPerSec} /s</span>
          </div>
        </div>
      </div>

      {/* 2. THE AI ACCOUNTANT QUANTITATIVE CONSOLE */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
              <BrainCircuit className="w-4 h-4" />
              <span>QUANT FINTECH &amp; AI ACCOUNTANT (MISTAKE = ₦0 LOST)</span>
            </div>
            <h3 className="text-xl font-bold text-white">Dynamic Pricing Engine &amp; Escrow Stop</h3>
            <p className="text-xs text-slate-400 max-w-xl">
              Hard deterministic floor enforces 75%+ gross margin before checkout. Ollama / Gemini reasoning analyzes real-time session supply and kick-attrition risk.
            </p>
          </div>

          <button
            onClick={handleConsultAiAccountant}
            disabled={isAiConsulting}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-all flex items-center gap-2 shadow-lg shadow-amber-950/50 cursor-pointer"
          >
            {isAiConsulting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Quant Analyzing...</span>
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4" />
                <span>Run Quant Supply Analysis</span>
              </>
            )}
          </button>
        </div>

        {aiAdviceText && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs font-mono text-amber-200 leading-relaxed">
            <span className="font-bold text-amber-300 block mb-1">AI Accountant Live Advisory:</span>
            {aiAdviceText}
          </div>
        )}

        {/* Pricing Guardrail Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 block">MINIMUM GROSS MARGIN FLOOR</span>
            <span className="text-lg font-bold text-emerald-400">
              {(pricingConfig.minimumMarginPct * 100).toFixed(0)}% Protected
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 block">VIP ALLCHAT 2X MULTIPLIER</span>
            <span className="text-lg font-bold text-cyan-400">
              {pricingConfig.vipAllChatMultiplier.toFixed(1)}x Double Work
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="text-slate-400 block">SPECIFIC COUNTRY FILTER SURCHARGE</span>
            <span className="text-lg font-bold text-amber-400">
              {pricingConfig.specificCountryMultiplier.toFixed(2)}x Scarcity
            </span>
          </div>
        </div>
      </div>

      {/* 3. WHATSAPP ADMIN MONITOR BOTS POOL */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">WhatsApp Admin Monitor Bots Hub</h3>
            <p className="text-xs text-slate-400">
              Rotating bot numbers paired to execute WA Group admin entry, 10-minute timers, and 1-hour country filters.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400">{adminBots.length} Active Bots</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {adminBots.map(bot => (
            <div 
              key={bot.id}
              className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 font-mono text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{bot.phoneNumber}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  bot.role === 'PRIMARY' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                }`}>
                  {bot.role}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Active Groups:</span>
                <span className="text-white">{bot.activeGroupCount}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Health Ping:</span>
                <span className="text-emerald-400">ONLINE</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. UNIFIED TELEGRAM BOT SUPPORT BRIDGE */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Bot className="w-4 h-4" />
              <span>@OurGrowthBot 2-WAY SUPPORT &amp; OVERRIDE DESK</span>
            </div>
            <h3 className="text-lg font-bold text-white">Disputes, Timeouts &amp; Withdrawals</h3>
            <p className="text-xs text-slate-400">
              Synced directly with Telegram Admin Chat. Admins can force approve verifications, refund coins, or authorize withdrawals.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {supportTickets.map(ticket => (
            <div 
              key={ticket.id}
              className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono">
                      #{ticket.id}
                    </span>
                    <span className="text-xs font-medium text-slate-300">
                      {ticket.subject}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                      {ticket.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 pt-1">
                    {ticket.message}
                  </p>
                </div>

                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                  ticket.status === 'RESOLVED'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {ticket.status}
                </span>
              </div>

              {ticket.adminNotes && (
                <div className="p-2 rounded bg-white/[0.02] border border-white/5 text-[11px] font-mono text-emerald-300">
                  {ticket.adminNotes}
                </div>
              )}

              {ticket.status === 'OPEN' && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
                  <button
                    onClick={() => handleResolveTicket(ticket.id, 'FORCE_APPROVE')}
                    className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-mono border border-emerald-500/30 cursor-pointer"
                  >
                    Force Approve Verification
                  </button>
                  <button
                    onClick={() => handleResolveTicket(ticket.id, 'REFUND_COINS')}
                    className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-[11px] font-mono border border-amber-500/30 cursor-pointer"
                  >
                    Refund Coins
                  </button>
                  <button
                    onClick={() => handleResolveTicket(ticket.id, 'APPROVE_WITHDRAWAL')}
                    className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-[11px] font-mono border border-cyan-500/30 cursor-pointer"
                  >
                    Approve Instant Payout
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
