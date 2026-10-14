import React, { useState } from 'react';
import { Terminal, ChevronUp, ChevronDown, Trash2, Shield, Activity } from 'lucide-react';
import { LiveTerminalLog } from '../types';

interface TerminalDrawerProps {
  logs: LiveTerminalLog[];
  onClearLogs: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  logs,
  onClearLogs,
  isOpen,
  onToggle,
}) => {
  const [filterSource, setFilterSource] = useState<string>('ALL');

  const filteredLogs = filterSource === 'ALL' 
    ? logs 
    : logs.filter(l => l.source === filterSource);

  const getBadgeColor = (level: LiveTerminalLog['level']) => {
    switch (level) {
      case 'SUCCESS':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
      case 'WARN':
        return 'text-amber-400 bg-amber-950/60 border-amber-800/60';
      case 'ERROR':
        return 'text-rose-400 bg-rose-950/60 border-rose-800/60';
      case 'LOCK':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${isOpen ? 'h-72' : 'h-10'} bg-[#08090d]/95 backdrop-blur-xl border-t border-white/10 shadow-2xl flex flex-col font-mono`}>
      {/* Drawer Header Bar */}
      <div 
        onClick={onToggle}
        className="h-10 px-4 bg-black/60 border-b border-white/5 flex items-center justify-between cursor-pointer select-none text-xs"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold tracking-wider">
            <Terminal className="w-3.5 h-3.5" />
            <span>STATE-PLANE LIVE TERMINAL</span>
          </div>
          <span className="text-slate-500">|</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>{logs.length} telemetry events</span>
          </div>
        </div>

        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          {isOpen && (
            <>
              <div className="flex items-center gap-1 text-[11px]">
                {['ALL', 'STATE_PLANE', 'BROADCAST_WORKER', 'AI_ACCOUNTANT', 'JOIN_MANAGER'].map(src => (
                  <button
                    key={src}
                    onClick={() => setFilterSource(src)}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      filterSource === src 
                        ? 'bg-white/15 text-white font-medium' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>

              <button
                onClick={onClearLogs}
                title="Clear Logs"
                className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button 
            onClick={onToggle} 
            className="p-1 text-slate-400 hover:text-slate-200"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Log Feed Viewport */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-600">
              No live telemetry logs for source "{filterSource}".
            </div>
          ) : (
            filteredLogs.map(log => (
              <div 
                key={log.id} 
                className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-white/[0.02] border-b border-white/[0.02]"
              >
                <span className="text-[10px] text-slate-500 whitespace-nowrap pt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap uppercase font-semibold ${getBadgeColor(log.level)}`}>
                  {log.source}
                </span>
                <span className="text-slate-300 flex-1 leading-relaxed break-all">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
