import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  RotateCcw, 
  Sparkles, 
  User, 
  Loader2, 
  ChevronDown, 
  Check, 
  AlertCircle,
  HelpCircle,
  Zap,
  Flame,
  ShieldCheck
} from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { FirestoreService, StoredChatMessage } from '../services/firestoreService';

interface GeminiChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  currentRole: UserRole;
}

const SUGGESTED_PROMPTS = [
  { label: '💰 How to unlock the 200 Coin bonus?', prompt: 'How does the 200 Coin locked registration bonus work, and when can I request my first withdrawal?' },
  { label: '📱 1X vs 2X VIP group earnings', prompt: 'Explain how WhatsApp group earnings are calculated for 1X All-Status vs 2X VIP All-Chat, and why locked groups give 0 coins.' },
  { label: '🌍 Smart Verified country campaigns', prompt: 'How do advertisers create targeted broadcast campaigns for Nigeria (+234), Ghana (+233), or Kenya (+254)?' },
  { label: '🛡️ JID Anti-Spam protection', prompt: 'How does Pappy Earning Hub prevent WhatsApp bans and enforce the JID ledger?' },
];

export const GeminiChatbotModal: React.FC<GeminiChatbotModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentRole,
}) => {
  const [messages, setMessages] = useState<StoredChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, isStreaming]);

  // Load chat history from Firestore when opened
  useEffect(() => {
    if (!isOpen) return;

    if (currentUser?.id) {
      setIsLoadingHistory(true);
      FirestoreService.getChatMessages(currentUser.id)
        .then((history) => {
          if (history && history.length > 0) {
            setMessages(history);
          } else {
            // Initial welcome message
            const welcomeMsg: StoredChatMessage = {
              id: 'welcome_msg',
              userId: currentUser.id,
              role: 'model',
              text: `👋 Greetings, **${currentUser.name || 'Partner'}**! I am **Pappy AI**, your automated assistant for Pappy Earning Hub.\n\nI can help you with:\n- **Earning Calculations & Bonus Unlocks** (200.000 Coin bonus rules, 300.000 first payout milestone)\n- **Session & Group Pairing** (1X All-Status vs 2X VIP rates)\n- **Advertiser Campaigns** (Direct sessions & Smart Verified country routing)\n- **Compliance & Anti-Ban Architecture**\n\nHow can I accelerate your earnings or campaigns today?`,
              createdAt: new Date().toISOString(),
            };
            setMessages([welcomeMsg]);
          }
        })
        .catch((err) => {
          console.warn('Could not load Firestore chat history:', err);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      // Guest state
      setMessages([
        {
          id: 'guest_welcome',
          userId: 'guest',
          role: 'model',
          text: `👋 Welcome to **Pappy Earning Hub**! I am **Pappy AI** powered by Gemini 3.8 Flash.\n\nAsk me anything about earning Coins, WhatsApp session pairing, advertiser campaign pathways, or sign in with Google to persist your conversations!`,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, [isOpen, currentUser?.id]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isStreaming) return;

    setInputValue('');
    setErrorMsg(null);

    const userMessageId = `msg_u_${Date.now()}`;
    const userMessage: StoredChatMessage = {
      id: userMessageId,
      userId: currentUser?.id || 'guest',
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsStreaming(true);
    setStreamingContent('');

    // Persist user message to Firestore if authenticated
    if (currentUser?.id) {
      FirestoreService.saveChatMessage(currentUser.id, userMessage).catch(console.warn);
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map(m => ({
            role: m.role,
            content: m.text,
          })),
          userRole: currentRole,
          userName: currentUser?.name || 'Valued User',
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat API error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedReply = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                accumulatedReply += data.text;
                setStreamingContent(accumulatedReply);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch {
              // Ignore non-json chunk fragments
            }
          }
        }
      }

      const botMessageId = `msg_m_${Date.now()}`;
      const botMessage: StoredChatMessage = {
        id: botMessageId,
        userId: currentUser?.id || 'guest',
        role: 'model',
        text: accumulatedReply || 'I processed your request successfully.',
        createdAt: new Date().toISOString(),
      };

      setMessages([...newHistory, botMessage]);
      setStreamingContent('');

      // Persist bot reply to Firestore if authenticated
      if (currentUser?.id) {
        FirestoreService.saveChatMessage(currentUser.id, botMessage).catch(console.warn);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorMsg(err.message || 'Unable to complete response. Please check your network or API connection.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleResetConversation = () => {
    if (isStreaming) return;
    const initialMsg: StoredChatMessage = {
      id: `welcome_${Date.now()}`,
      userId: currentUser?.id || 'guest',
      role: 'model',
      text: `Conversation refreshed! How can I assist you with your Pappy Earning Hub tasks or campaigns?`,
      createdAt: new Date().toISOString(),
    };
    setMessages([initialMsg]);
    setStreamingContent('');
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-2xl h-[90vh] max-h-[720px] bg-slate-900/95 border border-emerald-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        role="dialog"
        aria-label="Pappy AI Assistant Chat"
      >
        {/* Modal Header */}
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-wide text-white">Pappy AI</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-2.5 h-2.5" /> Gemini 3.8 Flash
                </span>
                {currentUser && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Firestore Sync Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Multi-turn intelligent assistant for earners & advertisers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleResetConversation}
              disabled={isStreaming}
              title="Reset conversation"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm scroll-smooth">
          {isLoadingHistory ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Loading persistent chat history from Firestore...</span>
            </div>
          ) : (
            <>
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div 
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isUser 
                          ? 'bg-emerald-600 text-white font-bold' 
                          : 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                        isUser
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-slate-800/80 text-slate-200 border border-white/5 rounded-tl-none whitespace-pre-line'
                      }`}
                    >
                      {m.text}
                      <div className={`text-[10px] mt-1 font-mono opacity-60 ${isUser ? 'text-right' : 'text-left'}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Live Streaming Message Display */}
              {isStreaming && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed bg-slate-800/80 text-slate-200 border border-white/5 rounded-tl-none whitespace-pre-line">
                    {streamingContent ? (
                      <>
                        {streamingContent}
                        <span className="inline-block w-1.5 h-4 ml-1 bg-emerald-400 animate-pulse align-middle" />
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span className="text-xs">Thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                  <button 
                    onClick={() => handleSendMessage(messages[messages.length - 1]?.text)}
                    className="ml-auto underline hover:text-white"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Suggested Quick Prompts */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 bg-slate-950/40 border-t border-white/5 overflow-x-auto flex gap-2 no-scrollbar">
            {SUGGESTED_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                disabled={isStreaming}
                onClick={() => handleSendMessage(item.prompt)}
                className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-white/10 text-xs text-slate-300 hover:text-emerald-300 transition-all text-left disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 border-t border-white/10 bg-slate-950/70 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isStreaming}
            placeholder="Ask Pappy AI anything about earning, WhatsApp pairing, or campaigns..."
            className="flex-1 bg-white/[0.05] border border-white/10 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isStreaming}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
