import React, { useState } from 'react';
import { AuthService } from '../services/authService';
import { AuthSession } from '../types';
import { BrandLogo } from './BrandLogo';
import { 
  ArrowLeft, 
  Mail, 
  Lock, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface AdvertiserAuthProps {
  onSuccess: (session: AuthSession) => void;
  onReturnHome: () => void;
  onSwitchToWorkerAuth: () => void;
}

export const AdvertiserAuth: React.FC<AdvertiserAuthProps> = ({
  onSuccess,
  onReturnHome,
  onSwitchToWorkerAuth,
}) => {
  const [mode, setMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_UP');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // 1-Click Demo Fill
  const handleDemoFill = () => {
    setMode('SIGN_IN');
    setEmail('advertiser@pappyearninghub.com');
    setPassword('AdPass2026!');
    setErrorMsg(null);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'SIGN_IN') {
        const result = await AuthService.signInWithEmail(email, password, 'ADVERTISER');
        if (!result.success) {
          setErrorMsg(result.error || 'Sign in failed.');
          return;
        }
        setSuccessToast(`Welcome back, ${result.session?.user.name}!`);
        setTimeout(() => onSuccess(result.session!), 400);
      } else {
        const result = await AuthService.signUpWithEmail(email, password, confirmPassword, companyName, 'ADVERTISER');
        if (!result.success) {
          setErrorMsg(result.error || 'Registration failed.');
          return;
        }
        setSuccessToast('Advertiser account created! Campaign Studio unlocked.');
        setTimeout(() => onSuccess(result.session!), 500);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const result = await AuthService.signInWithGoogle('ADVERTISER');
      if (result.success && result.session) {
        setSuccessToast(`Signed in with Google as ${result.session.user.name}`);
        setTimeout(() => onSuccess(result.session!), 400);
      } else {
        setErrorMsg(result.error || 'Google authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    const res = await AuthService.requestPasswordReset(forgotEmail);
    setForgotSent(true);
  };

  return (
    <div className="min-h-screen bg-[#06070A] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background cyber ambiance */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Return button */}
      <div className="w-full max-w-md flex items-center justify-between mb-6 z-10">
        <button
          onClick={onReturnHome}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Return to homepage</span>
        </button>

        <button
          onClick={handleDemoFill}
          className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/40 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Sparkles className="w-3 h-3" />
          <span>Quick Demo Fill</span>
        </button>
      </div>

      {/* Main Glass Card */}
      <div className="w-full max-w-md bg-[#0C0E14]/90 border border-white/10 rounded-3xl p-7 sm:p-8 backdrop-blur-2xl shadow-2xl relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="space-y-2 text-center flex flex-col items-center">
          <BrandLogo size="md" className="justify-center mb-1" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-mono text-cyan-400">
            <Send className="w-3.5 h-3.5" />
            <span>ADVERTISER ACCOUNT ACCESS</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Turn your campaigns into opportunities.
          </h1>

          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Create your advertiser account and manage your campaigns from one place.
          </p>
        </div>

        {/* Mode Toggle (Create vs Sign In) */}
        <div className="flex p-1 rounded-xl bg-black/60 border border-white/10 text-xs font-mono">
          <button
            type="button"
            onClick={() => { setMode('SIGN_UP'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              mode === 'SIGN_UP'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => { setMode('SIGN_IN'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              mode === 'SIGN_IN'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-3 cursor-pointer group"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3 text-slate-600 text-xs font-mono">
          <div className="flex-1 h-[1px] bg-white/10" />
          <span>OR WITH EMAIL</span>
          <div className="flex-1 h-[1px] bg-white/10" />
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {mode === 'SIGN_UP' && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Business / Organization Name</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Media Global"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Work Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="campaigns@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs text-slate-400 font-medium">Password</label>
              {mode === 'SIGN_IN' && (
                <button
                  type="button"
                  onClick={() => setForgotModal(true)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {mode === 'SIGN_UP' && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successToast}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white tracking-wide shadow-lg shadow-cyan-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : mode === 'SIGN_UP' ? (
              <>
                <span>Create Advertiser Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Sign In to Studio</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch to Worker Auth */}
        <div className="pt-2 border-t border-white/5 text-center text-xs text-slate-400">
          <span>Looking to earn by completing tasks? </span>
          <button
            type="button"
            onClick={onSwitchToWorkerAuth}
            className="text-emerald-400 hover:text-emerald-300 font-medium ml-1 transition-colors cursor-pointer"
          >
            Go to Worker Sign In &rarr;
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#0c0e14] border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Reset Password</h3>
            <p className="text-xs text-slate-400">
              Enter your registered work email and we'll dispatch password reset instructions.
            </p>
            {forgotSent ? (
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-300">
                Reset link sent! Please check your inbox.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="campaigns@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setForgotModal(false); setForgotSent(false); }}
                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white"
                  >
                    Send Link
                  </button>
                </div>
              </form>
            )}
            {forgotSent && (
              <button
                onClick={() => { setForgotModal(false); setForgotSent(false); }}
                className="w-full py-2 rounded-xl bg-white/10 text-xs text-white"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
