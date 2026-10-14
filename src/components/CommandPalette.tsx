import React, { useState, useEffect } from 'react';
import { Search, Radio, Send, ShieldCheck, ArrowDownCircle, Users, Bot, Terminal, X } from 'lucide-react';
import { UserRole } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: UserRole) => void;
  onOpenWithdraw: () => void;
  onOpenPairModal: () => void;
  onOpenJoinManager: () => void;
  onOpenValidatorHub: () => void;
  onOpenLiveTerminal: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectRole,
  onOpenWithdraw,
  onOpenPairModal,
  onOpenJoinManager,
  onOpenValidatorHub,
  onOpenLiveTerminal,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'earner',
      title: 'Switch to Earner Workspace',
      desc: 'Pair WhatsApp numbers, view 100+ member GCs, and cash out ₦500+',
      icon: Radio,
      category: 'Workspace',
      run: () => { onSelectRole('EARNER'); onClose(); },
    },
    {
      id: 'advertiser',
      title: 'Switch to Advertiser Studio',
      desc: 'Deploy Direct Session Broadcasts or 4 Smart Verified Systems',
      icon: Send,
      category: 'Workspace',
      run: () => { onSelectRole('ADVERTISER'); onClose(); },
    },
    {
      id: 'admin',
      title: 'Switch to Admin Command Center',
      desc: 'Validator Hub, AI Accountant math engine, and Telegram bridge',
      icon: ShieldCheck,
      category: 'Workspace',
      run: () => { onSelectRole('ADMIN'); onClose(); },
    },
    {
      id: 'withdraw',
      title: 'Request Coin Cashout (₦500.000 minimum)',
      desc: 'Convert 500+ Coins to NGN, USDT, KES, GHS, or XOF with zero loss',
      icon: ArrowDownCircle,
      category: 'Finance',
      run: () => { onOpenWithdraw(); onClose(); },
    },
    {
      id: 'pair',
      title: 'Pair New WhatsApp Worker Session (8-Digit Code)',
      desc: 'Multi-device pairing with native group status & hidetag support',
      icon: Bot,
      category: 'Pairing',
      run: () => { onOpenPairModal(); onClose(); },
    },
    {
      id: 'join_manager',
      title: 'Launch Web Join Manager (State-Plane Incubation)',
      desc: 'Hands-free group joining with human jitter delays to reach 100 GCs',
      icon: Users,
      category: 'Growth',
      run: () => { onOpenJoinManager(); onClose(); },
    },
    {
      id: 'validator_hub',
      title: 'Open Validator Hub (.txt Batch Ingest)',
      desc: 'Sanitize up to 500k WhatsApp links, filter 100+ open groups',
      icon: ShieldCheck,
      category: 'Admin',
      run: () => { onOpenValidatorHub(); onClose(); },
    },
    {
      id: 'terminal',
      title: 'Open Cyber-Terminal Live State-Plane Log',
      desc: 'Stream live WebSocket logs, Baileys receipts, and kick alerts',
      icon: Terminal,
      category: 'System',
      run: () => { onOpenLiveTerminal(); onClose(); },
    },
  ];

  const filtered = actions.filter(a => 
    a.title.toLowerCase().includes(query.toLowerCase()) || 
    a.desc.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-xl bg-[#0c0e14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center px-4 py-3 border-b border-white/10">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            type="text"
            placeholder="Type a command or jump to feature (e.g., withdraw, pair, join manager)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-white/5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No matching commands found.
            </div>
          ) : (
            filtered.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={action.run}
                  className="w-full flex items-center gap-3.5 p-3 rounded-xl text-left hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-emerald-400 group-hover:border-emerald-500/40">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white">
                        {action.title}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                        {action.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {action.desc}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">ESC</kbd> to exit</span>
          <span>Pappy Earning Hub v2.026</span>
        </div>
      </div>
    </div>
  );
};
