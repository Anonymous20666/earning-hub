import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Keyboard, 
  Search, 
  X, 
  Radio, 
  Send, 
  ShieldCheck, 
  Terminal, 
  ArrowDownCircle, 
  Bot, 
  Users, 
  CornerDownLeft, 
  Sliders, 
  Command, 
  HelpCircle, 
  Sparkles, 
  Compass, 
  Accessibility, 
  Check, 
  ExternalLink,
  Laptop
} from 'lucide-react';
import { UserRole } from '../types';

export interface ShortcutItem {
  id: string;
  category: 'Navigation' | 'Command Palette' | 'Workspaces' | 'Terminal & Logs' | 'Accessibility';
  keys: string[];
  title: string;
  description: string;
  actionLabel?: string;
  action?: () => void;
  badge?: string;
}

interface KeyboardShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCommandPalette: () => void;
  onToggleTerminal: () => void;
  onSelectRole: (role: UserRole) => void;
  onOpenWithdraw?: () => void;
  onOpenPairModal?: () => void;
  onOpenJoinManager?: () => void;
  onOpenValidatorHub?: () => void;
  onNavigateHome?: () => void;
  onOpenChat?: () => void;
}

export const KeyboardShortcutsHelpModal: React.FC<KeyboardShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
  onOpenCommandPalette,
  onToggleTerminal,
  onSelectRole,
  onOpenWithdraw,
  onOpenPairModal,
  onOpenJoinManager,
  onOpenValidatorHub,
  onNavigateHome,
  onOpenChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isMac, setIsMac] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Platform detection for Mac Command vs Windows/Linux Ctrl
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator) {
      const platform = navigator.platform || navigator.userAgent || '';
      setIsMac(/Mac|iPod|iPhone|iPad/.test(platform));
    }
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC directly within modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const modifierKey = isMac ? '⌘' : 'Ctrl';

  const shortcutData: ShortcutItem[] = useMemo(() => [
    // Navigation & Global Overlays
    {
      id: 'gemini-ai-chat',
      category: 'Navigation',
      keys: [modifierKey, 'J'],
      title: 'Open Pappy AI Assistant (Gemini 3.8 Flash)',
      description: 'Multi-turn intelligent assistant with streaming responses and Firestore conversation persistence',
      actionLabel: 'Launch Pappy AI',
      action: () => {
        onClose();
        if (onOpenChat) setTimeout(onOpenChat, 100);
      },
      badge: 'Gemini AI',
    },
    {
      id: 'help-overlay',
      category: 'Navigation',
      keys: ['?'],
      title: 'Open / Close Help Overlay',
      description: 'Display this keyboard shortcuts, accessibility guide, and action directory',
      badge: 'Global',
    },
    {
      id: 'cmd-k',
      category: 'Navigation',
      keys: [modifierKey, 'K'],
      title: 'Open Command Palette',
      description: 'Search commands, trigger instant actions, or switch workspaces',
      actionLabel: 'Launch Palette',
      action: () => {
        onClose();
        setTimeout(onOpenCommandPalette, 100);
      },
      badge: 'Quick Jump',
    },
    {
      id: 'terminal-toggle',
      category: 'Terminal & Logs',
      keys: [modifierKey, '`'],
      title: 'Toggle Cyber-Terminal Drawer',
      description: 'Stream live Baileys state-plane logs, ping/pong heartbeats, and kick alerts',
      actionLabel: 'Toggle Terminal',
      action: () => {
        onClose();
        setTimeout(onToggleTerminal, 100);
      },
      badge: 'Real-Time',
    },
    {
      id: 'terminal-toggle-alt',
      category: 'Terminal & Logs',
      keys: [modifierKey, 'J'],
      title: 'Alternative Terminal Hotkey',
      description: 'Standard developer shortcut to toggle live background log drawer',
      actionLabel: 'Toggle Terminal',
      action: () => {
        onClose();
        setTimeout(onToggleTerminal, 100);
      },
    },
    {
      id: 'nav-worker',
      category: 'Workspaces',
      keys: ['Alt', '1'],
      title: 'Switch to Worker Workspace',
      description: 'Pair WhatsApp numbers, browse 100+ member groups, and view coin earnings',
      actionLabel: 'Switch to Worker',
      action: () => {
        onClose();
        onSelectRole('EARNER');
      },
      badge: 'Earner',
    },
    {
      id: 'nav-advertiser',
      category: 'Workspaces',
      keys: ['Alt', '2'],
      title: 'Switch to Advertiser Studio',
      description: 'Create automated dual-bot campaigns for WhatsApp and Telegram groups/channels',
      actionLabel: 'Switch to Advertiser',
      action: () => {
        onClose();
        onSelectRole('ADVERTISER');
      },
      badge: 'Advertiser',
    },
    {
      id: 'nav-admin',
      category: 'Workspaces',
      keys: ['Alt', '3'],
      title: 'Switch to Admin Command Center',
      description: 'Access Validator Hub, AI math engine, Telegram bridge, and ticket desk',
      actionLabel: 'Switch to Admin',
      action: () => {
        onClose();
        onSelectRole('ADMIN');
      },
      badge: 'Admin',
    },
    {
      id: 'nav-home',
      category: 'Navigation',
      keys: ['Alt', 'H'],
      title: 'Return to Landing Page',
      description: 'Navigate back to public platform showcase, pricing overview, and FAQs',
      actionLabel: 'Go to Landing',
      action: () => {
        onClose();
        if (onNavigateHome) onNavigateHome();
      },
    },
    {
      id: 'nav-esc',
      category: 'Navigation',
      keys: ['Esc'],
      title: 'Dismiss Active Overlay',
      description: 'Close active modal, drawer, command palette, or dropdown cleanly',
    },

    // Command Palette Actions
    {
      id: 'cmd-withdraw',
      category: 'Command Palette',
      keys: [modifierKey, 'K', '→', 'Cashout'],
      title: 'Request Coin Cashout (₦500.000 minimum)',
      description: 'Convert 500+ Coins to NGN, OPay, USDT, KES, GHS, or XOF with zero loss',
      actionLabel: 'Withdraw',
      action: () => {
        onClose();
        if (onOpenWithdraw) onOpenWithdraw();
        else onSelectRole('EARNER');
      },
      badge: 'Finance',
    },
    {
      id: 'cmd-pair',
      category: 'Command Palette',
      keys: [modifierKey, 'K', '→', 'Pair'],
      title: 'Pair New WhatsApp Worker Session',
      description: 'Multi-device pairing with native group status verification and 8-digit code',
      actionLabel: 'Open Pairing',
      action: () => {
        onClose();
        if (onOpenPairModal) onOpenPairModal();
        else onSelectRole('EARNER');
      },
      badge: 'Pairing',
    },
    {
      id: 'cmd-join-manager',
      category: 'Command Palette',
      keys: [modifierKey, 'K', '→', 'Join'],
      title: 'Launch Web Join Manager (State-Plane Incubation)',
      description: 'Hands-free group joining with human jitter delays to reach 100+ GCs safely',
      actionLabel: 'Launch Joiner',
      action: () => {
        onClose();
        if (onOpenJoinManager) onOpenJoinManager();
        else onSelectRole('EARNER');
      },
      badge: 'Automation',
    },
    {
      id: 'cmd-validator',
      category: 'Command Palette',
      keys: [modifierKey, 'K', '→', 'Validator'],
      title: 'Open Validator Hub (.txt Batch Ingest)',
      description: 'Sanitize up to 500k WhatsApp links, filter 100+ open groups, and export CSV',
      actionLabel: 'Open Validator',
      action: () => {
        onClose();
        if (onOpenValidatorHub) onOpenValidatorHub();
        else onSelectRole('ADMIN');
      },
      badge: 'Admin Tool',
    },

    // Accessibility Controls
    {
      id: 'acc-tab',
      category: 'Accessibility',
      keys: ['Tab'],
      title: 'Sequential Focus Navigation',
      description: 'Move keyboard focus forward through interactive buttons, inputs, and tabs',
      badge: 'a11y',
    },
    {
      id: 'acc-shift-tab',
      category: 'Accessibility',
      keys: ['Shift', 'Tab'],
      title: 'Reverse Focus Navigation',
      description: 'Move keyboard focus backward to the previous interactive element',
      badge: 'a11y',
    },
    {
      id: 'acc-enter-space',
      category: 'Accessibility',
      keys: ['Enter', 'or', 'Space'],
      title: 'Activate Focused Control',
      description: 'Trigger selected button, toggle checkbox, or submit active form',
      badge: 'a11y',
    },
    {
      id: 'acc-arrows',
      category: 'Accessibility',
      keys: ['↑', '↓'],
      title: 'Navigate Lists & Command Results',
      description: 'Scroll through search results in Command Palette or table rows',
      badge: 'a11y',
    },
  ], [modifierKey, onClose, onOpenCommandPalette, onToggleTerminal, onSelectRole, onOpenWithdraw, onOpenPairModal, onOpenJoinManager, onOpenValidatorHub, onNavigateHome]);

  const categories = ['ALL', 'Navigation', 'Command Palette', 'Workspaces', 'Terminal & Logs', 'Accessibility'];

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return shortcutData.filter(item => {
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
      if (!matchesCategory) return false;

      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keys.some(k => k.toLowerCase().includes(q))
      );
    });
  }, [shortcutData, searchQuery, activeCategory]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      aria-describedby="shortcuts-modal-desc"
    >
      <div 
        ref={modalRef}
        className="w-full max-w-3xl bg-[#0c0e14] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="shortcuts-modal-title" className="text-base sm:text-lg font-bold text-white">
                  Keyboard Shortcuts &amp; Accessibility
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Quick Reference
                </span>
              </div>
              <p id="shortcuts-modal-desc" className="text-xs text-slate-400 mt-0.5">
                Navigate the entire Pappy Earning Hub platform hands-free via hotkeys and Command Palette
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-400">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>{isMac ? 'macOS Layout' : 'Windows/Linux Layout'}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close shortcuts help modal"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SEARCH & CATEGORY FILTER */}
        <div className="p-4 border-b border-white/10 bg-black/30 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search shortcuts or commands (e.g., cashout, terminal, switch, alt)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#121620] border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all font-sans"
              aria-label="Filter shortcuts"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                }`}
              >
                {cat === 'ALL' ? 'All Shortcuts' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* SHORTCUTS LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-white/5">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-300 font-medium">No matching shortcuts found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try searching for a different keyword or select "All Shortcuts" above.
              </p>
            </div>
          ) : (
            filteredShortcuts.map(item => (
              <div 
                key={item.id} 
                className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-100 group-hover:text-white">
                      {item.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono uppercase tracking-wider">
                      {item.category}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {/* Key Combo Display */}
                  <div className="flex items-center gap-1">
                    {item.keys.map((k, idx) => {
                      if (k === 'or') {
                        return (
                          <span key={idx} className="text-[11px] text-slate-500 font-mono px-0.5">
                            or
                          </span>
                        );
                      }
                      if (k === '→') {
                        return (
                          <span key={idx} className="text-[11px] text-slate-600 font-mono px-0.5">
                            →
                          </span>
                        );
                      }
                      return (
                        <kbd
                          key={idx}
                          className="min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-md bg-[#161a24] border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-sm shadow-black/50"
                        >
                          {k}
                        </kbd>
                      );
                    })}
                  </div>

                  {/* Interactive Trigger Button (if actionable) */}
                  {item.action && item.actionLabel && (
                    <button
                      onClick={item.action}
                      className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                      title={`Run: ${item.title}`}
                    >
                      <span>{item.actionLabel}</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ACCESSIBILITY & SCREEN READER FOOTER */}
        <div className="px-6 py-3 bg-[#08090d] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Accessibility className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px]">
              Full keyboard accessibility: Use <kbd className="px-1 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">Tab</kbd> to focus, <kbd className="px-1 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">Enter</kbd> to execute, and <kbd className="px-1 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">Esc</kbd> to dismiss.
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300">?</kbd> anywhere</span>
            <span>•</span>
            <span className="text-emerald-400">Pappy Earning Hub</span>
          </div>
        </div>
      </div>
    </div>
  );
};
