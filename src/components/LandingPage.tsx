import React, { useState } from 'react';
import { 
  AuthUser, 
  UserRole 
} from '../types';
import { ThreeSpatialHero } from './ThreeSpatialHero';
import { BrandLogo } from './BrandLogo';
import { 
  Radio, 
  Send, 
  ShieldCheck, 
  Coins, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Users, 
  Lock, 
  Unlock, 
  Layers, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Menu, 
  X, 
  ExternalLink, 
  ArrowUpRight, 
  FileText, 
  Eye, 
  Sliders, 
  Clock, 
  Activity, 
  Bot, 
  DollarSign, 
  LogOut,
  UserCheck
} from 'lucide-react';

interface LandingPageProps {
  currentUser: AuthUser | null;
  onNavigateToWorkerAuth: () => void;
  onNavigateToAdvertiserAuth: () => void;
  onNavigateToDashboard: (role: UserRole) => void;
  onSignOut: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  currentUser,
  onNavigateToWorkerAuth,
  onNavigateToAdvertiserAuth,
  onNavigateToDashboard,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [howItWorksTab, setHowItWorksTab] = useState<'WORKER' | 'ADVERTISER'>('WORKER');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [authChoiceModal, setAuthChoiceModal] = useState<boolean>(false);

  // FAQ Accordion Data (The 10 Required Questions)
  const faqItems = [
    {
      q: 'What is this platform?',
      a: 'Pappy Earning Hub is a dual-sided earning and advertising infrastructure. Workers discover paid opportunities (including WhatsApp group broadcasts, community tasks, and verified campaign activities) to earn decimal coins pegged 1:1 to Nigerian Naira (₦1.00) or USD equivalent, while advertisers deploy targeted campaigns across WhatsApp groups, channels, and Telegram communities with automated bot verification.',
    },
    {
      q: 'How do workers get started?',
      a: 'Getting started is simple and free: create a Worker Account, review the Onboarding Safety Advisory, and connect your eligible WhatsApp or Telegram account via our secure multi-device 8-digit pairing. Upon registration, workers receive an endowed 200.000 Coins bonus credited directly to their locked balance.',
    },
    {
      q: 'How do advertisers create campaigns?',
      a: 'Advertisers register an Advertiser Account, select either Direct Broadcast Session Rentals or one of our 4 Automated Bot Verification Systems (WA Group, WA Channel, TG Group, or TG Channel), customize country filters and volume, and fund the campaign using cash or earned wallet coins.',
    },
    {
      q: 'Is registration free?',
      a: 'Yes, registration is 100% free for both workers and advertisers. We never charge upfront account activation fees or hidden subscriptions.',
    },
    {
      q: 'How are tasks reviewed?',
      a: 'Tasks are reviewed either through automated cryptographic state-plane verification (such as Baileys 200 OK delivery receipts and @OurGrowthBot webhook events) or manual review by campaign managers within the published task review window.',
    },
    {
      q: 'When can workers withdraw approved earnings?',
      a: 'Under our Ironclad Withdrawal Lock, the minimum cashout is strictly 500.000 Coins (₦500.00). The withdrawal button unlocks once a worker earns at least 300.000 Coins from verified broadcasts, at which point the 200.000 locked registration bonus is released for an initial 500.000 Coins payout. Subsequent cashouts require 500.000 earned coins.',
    },
    {
      q: 'What payment methods are supported?',
      a: 'We support instant domestic bank transfers and OPay for NGN payouts, as well as multi-currency conversions into USDT (Tether), Kenyan Shillings (KES), Ghanaian Cedis (GHS), and West African CFA Francs (XOF) computed with a transparent 5% safety spread.',
    },
    {
      q: 'Can I have both a worker and an advertiser account?',
      a: 'Yes. You can hold both roles using the same or separate credentials; however, each session is strictly isolated to its respective dashboard to maintain clear separation of billing, tasks, and permissions.',
    },
    {
      q: 'How can I contact support?',
      a: 'You can submit support tickets directly through the in-app Support Desk or message our official Telegram Support Bridge (@OurGrowthBot). Administrators monitor disputes and inquiries 24/7.',
    },
    {
      q: 'What happens if a task submission is rejected?',
      a: 'If a broadcast or task does not meet qualification standards (for example, a WhatsApp group with fewer than 100 members or locked messaging permissions), the submission is flagged with the exact reason and awards 0.000 coins without penalizing your account balance.',
    },
  ];

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#06070A] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 antialiased overflow-x-hidden">
      {/* 1. STICKY NAVIGATION BAR */}
      <nav className="sticky top-0 z-40 w-full h-18 bg-[#06070A]/85 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="cursor-pointer group"
          >
            <BrandLogo size="md" showText={true} />
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-7 text-xs font-medium text-slate-300">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-white transition-colors cursor-pointer">
              Home
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors cursor-pointer">
              How It Works
            </button>
            <button onClick={() => scrollToSection('for-workers')} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400" />
              <span>For Workers</span>
            </button>
            <button onClick={() => scrollToSection('for-advertisers')} className="hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1.5">
              <Send className="w-3 h-3 text-cyan-400" />
              <span>For Advertisers</span>
            </button>
            <button onClick={() => scrollToSection('trust-security')} className="hover:text-white transition-colors cursor-pointer">
              Trust &amp; Transparency
            </button>
            <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors cursor-pointer">
              FAQ
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-semibold text-white block">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {currentUser.role} Account
                  </span>
                </div>
                <button
                  onClick={() => onNavigateToDashboard(currentUser.role)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all shadow-md shadow-emerald-950/50 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onSignOut}
                  title="Sign Out"
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setAuthChoiceModal(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthChoiceModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-xs font-semibold text-white transition-all shadow-lg shadow-emerald-950/60 cursor-pointer"
                >
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Animated Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0C0E14] border-b border-white/10 px-6 py-5 space-y-4 animate-in slide-in-from-top-4 duration-200 shadow-2xl">
            <div className="flex flex-col space-y-3 text-sm text-slate-300 font-medium">
              <button onClick={() => { scrollToSection('how-it-works'); }} className="text-left py-1 hover:text-white">
                How It Works
              </button>
              <button onClick={() => { scrollToSection('for-workers'); }} className="text-left py-1 hover:text-emerald-400 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>For Workers</span>
              </button>
              <button onClick={() => { scrollToSection('for-advertisers'); }} className="text-left py-1 hover:text-cyan-400 flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                <span>For Advertisers</span>
              </button>
              <button onClick={() => { scrollToSection('trust-security'); }} className="text-left py-1 hover:text-white">
                Trust &amp; Transparency
              </button>
              <button onClick={() => { scrollToSection('faq'); }} className="text-left py-1 hover:text-white">
                FAQ
              </button>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
              {currentUser ? (
                <>
                  <button
                    onClick={() => { setMobileMenuOpen(false); onNavigateToDashboard(currentUser.role); }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs text-center"
                  >
                    Open {currentUser.role} Dashboard
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); onSignOut(); }}
                    className="w-full py-2 rounded-xl bg-white/5 text-slate-300 text-xs text-center hover:text-rose-400"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setMobileMenuOpen(false); onNavigateToWorkerAuth(); }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs text-center"
                  >
                    Start Earning (Worker)
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); onNavigateToAdvertiserAuth(); }}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 text-white font-semibold text-xs text-center"
                  >
                    Advertise With Us
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-16 lg:pt-16 lg:pb-24">
        {/* Subtle decorative glow */}
        <div className="absolute top-12 left-1/3 w-[500px] h-[300px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[400px] h-[300px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Headlines & CTA Buttons */}
          <div className="lg:col-span-7 space-y-6 z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-emerald-400 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Decentralized Growth &amp; Micro-Task Architecture</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.08]">
              YOUR TIME. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                YOUR OPPORTUNITY.
              </span> <br />
              YOUR EARNINGS.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              Discover opportunities, complete tasks, and earn rewards as a worker — or promote your business and reach the right audience as an advertiser. Everything you need, all in one platform.
            </p>

            {/* The Two Prominent Call-To-Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* BUTTON 1: Start Earning */}
              <div 
                onClick={onNavigateToWorkerAuth}
                className="p-5 rounded-2xl bg-[#0C0E14] border border-emerald-500/30 hover:border-emerald-500/60 shadow-xl shadow-emerald-950/40 hover:-translate-y-1 transition-all cursor-pointer group space-y-2 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                    <Radio className="w-4 h-4" />
                  </div>
                  <span className="text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1">
                    <span>₦200 BONUS</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Start Earning
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  For people who want to discover and complete paid tasks with instant decimal coin cashouts.
                </p>
              </div>

              {/* BUTTON 2: Advertise With Us */}
              <div 
                onClick={onNavigateToAdvertiserAuth}
                className="p-5 rounded-2xl bg-[#0C0E14] border border-cyan-500/30 hover:border-cyan-500/60 shadow-xl shadow-cyan-950/40 hover:-translate-y-1 transition-all cursor-pointer group space-y-2 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                    <Send className="w-4 h-4" />
                  </div>
                  <span className="text-cyan-400 text-xs font-mono font-semibold flex items-center gap-1">
                    <span>GROWTH ENGINE</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Advertise With Us
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  For businesses that want to promote their products, services, or campaigns across WhatsApp &amp; Telegram.
                </p>
              </div>
            </div>

            {/* Invariant Financial Trust Bar */}
            <div className="flex flex-wrap items-center gap-6 pt-3 text-xs font-mono text-slate-400 border-t border-white/5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>1.000 Coin = ₦1.00 NGN Pegged</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Zero Fake Statistics</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>Verified Bot State-Planes</span>
              </div>
            </div>
          </div>

          {/* Right Column: Floating 3D Spatial Hero Scene & Live Interactive Cards */}
          <div className="lg:col-span-5 relative">
            <div className="rounded-3xl bg-gradient-to-b from-white/[0.04] to-black/60 border border-white/10 p-2 relative shadow-2xl overflow-hidden backdrop-blur-xl">
              <div className="h-[380px] sm:h-[440px] relative flex items-center justify-center">
                <ThreeSpatialHero isCompact={false} />
              </div>

              {/* Floating Live Card Overlays */}
              <div className="absolute top-4 left-4 p-3 rounded-xl bg-[#0C0E14]/90 border border-white/10 backdrop-blur-md shadow-xl text-xs font-mono space-y-1">
                <span className="text-[10px] text-slate-500 block">ACTIVE BROADCAST WORKER</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-bold text-white">Multi-Device 8-Digit Linked</span>
                </div>
              </div>

              <div className="absolute bottom-4 right-4 p-3 rounded-xl bg-[#0C0E14]/90 border border-white/10 backdrop-blur-md shadow-xl text-xs font-mono space-y-1">
                <span className="text-[10px] text-slate-500 block">AI ACCOUNTANT ESCROW</span>
                <span className="font-bold text-cyan-400 block">75% Gross Margin Protected</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 border-t border-white/[0.08]">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-cyan-400">
            <Activity className="w-3.5 h-3.5" />
            <span>TRANSPARENT TWO-WAY WORKFLOWS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How The Platform Works
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Every step is clearly defined and backed by automated state verification. No guesswork or hidden terms.
          </p>

          {/* Interactive Role Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-black/60 border border-white/10 text-xs font-mono mt-4">
            <button
              onClick={() => setHowItWorksTab('WORKER')}
              className={`px-5 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                howItWorksTab === 'WORKER'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              For Workers (Earning)
            </button>
            <button
              onClick={() => setHowItWorksTab('ADVERTISER')}
              className={`px-5 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                howItWorksTab === 'ADVERTISER'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              For Advertisers (Growth)
            </button>
          </div>
        </div>

        {/* 5-Step Process Timeline */}
        {howItWorksTab === 'WORKER' ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              {
                step: '01',
                title: 'Create Account',
                desc: 'Sign up in seconds and receive your 200.000 Coins locked registration bonus immediately.',
              },
              {
                step: '02',
                title: 'Explore Opportunities',
                desc: 'Browse available tasks, pair WhatsApp sessions, or join verified 100+ member open groups.',
              },
              {
                step: '03',
                title: 'Complete Tasks',
                desc: 'Deliver group status broadcasts or community tasks adhering strictly to platform guidelines.',
              },
              {
                step: '04',
                title: 'Verified Review',
                desc: 'Automated 200 OK delivery receipts and participant inspection verify eligible performance.',
              },
              {
                step: '05',
                title: 'Approved Rewards',
                desc: 'Receive rewards at 1.000 Coin = ₦1.00 NGN. Cash out to your bank or USDT once 300.000 earned is reached.',
              },
            ].map(item => (
              <div 
                key={item.step}
                className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/40 transition-all space-y-3"
              >
                <span className="text-2xl font-black font-mono text-emerald-400 block">
                  {item.step}
                </span>
                <h4 className="text-sm font-bold text-white">{item.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              {
                step: '01',
                title: 'Create Advertiser Account',
                desc: 'Register and access your dedicated Campaign Studio with zero interference from worker views.',
              },
              {
                step: '02',
                title: 'Set Up Campaign',
                desc: 'Choose Direct Session Rentals or one of our 4 Smart Automated Bot Verification Systems.',
              },
              {
                step: '03',
                title: 'Define Objectives',
                desc: 'Set request volume (up to 2,000 for WA groups), dial-code country filters, and budget limits.',
              },
              {
                step: '04',
                title: 'Publish Campaign',
                desc: 'Our dual admin bots execute the 10-minute handshake and lock AI accountant margin floors.',
              },
              {
                step: '05',
                title: 'Monitor Analytics',
                desc: 'Track live dispatches, 1-hour country scrubs, and monotonic cumulative request receipts.',
              },
            ].map(item => (
              <div 
                key={item.step}
                className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-cyan-500/40 transition-all space-y-3"
              >
                <span className="text-2xl font-black font-mono text-cyan-400 block">
                  {item.step}
                </span>
                <h4 className="text-sm font-bold text-white">{item.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. WORKER BENEFITS SECTION */}
      <section id="for-workers" className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 border-t border-white/[0.08]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
              <Radio className="w-3.5 h-3.5" />
              <span>THE WORKER EXPERIENCE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              A Purpose-Built Workspace for Transparent Earning
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every feature in the Worker Dashboard is built for real accountability. View qualified group lists, monitor 0.001 decimal coin balances, and enjoy guaranteed payout math.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {[
                { title: 'Discover Available Tasks', desc: 'Browse verified broadcast campaigns and micro-tasks.' },
                { title: 'Browse by Category', desc: 'Filter by WhatsApp Group, Channel, or Community tasks.' },
                { title: 'Track Submitted Tasks', desc: 'Monitor 200 OK delivery receipts and live group statuses.' },
                { title: '0.001 Decimal Precision', desc: 'Track coins with complete mathematical transparency.' },
                { title: 'Ironclad Cashout Gate', desc: 'Unlock your ₦200 registration bonus at 300.000 earned.' },
                { title: 'State-Plane Join Manager', desc: 'Grow your open groups safely with human jitter intervals.' },
              ].map(b => (
                <div key={b.title} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{b.title}</span>
                  </span>
                  <p className="text-[11px] text-slate-400">{b.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onNavigateToWorkerAuth}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-950/60 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Create Worker Account &amp; Claim ₦200 Bonus</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Illustrative Worker Dashboard Preview */}
          <div className="lg:col-span-6 p-5 rounded-3xl bg-[#0C0E14] border border-white/10 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-white font-bold">WORKER VAULT PREVIEW</span>
              </div>
              <span className="text-[10px] text-slate-500">SAMPLE DATA (ILLUSTRATIVE)</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-500 block">LOCKED BONUS</span>
                <span className="text-base font-bold text-amber-300">200.000 c</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-500 block">EARNED COINS</span>
                <span className="text-base font-bold text-emerald-300">314.820 c</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-500 block">CASHOUT READY</span>
                <span className="text-base font-bold text-white">₦514.82</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-emerald-300">Cashout Gate Status:</span>
                <span className="text-emerald-400 font-bold">UNLOCKED (First Cashout Discharged)</span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                Minimum 500.000 Coins threshold achieved. Payouts processed via OPay or direct bank transfer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ADVERTISER BENEFITS SECTION */}
      <section id="for-advertisers" className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 border-t border-white/[0.08]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Illustrative Campaign Dashboard Preview */}
          <div className="lg:col-span-6 order-2 lg:order-1 p-5 rounded-3xl bg-[#0C0E14] border border-white/10 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-white font-bold">CAMPAIGN STUDIO PREVIEW</span>
              </div>
              <span className="text-[10px] text-slate-500">SAMPLE DATA (ILLUSTRATIVE)</span>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold font-sans">Solana Developers West Africa</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">RUNNING</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>System: WA_GROUP (Dual Bot)</span>
                <span>Cap: 500 Requests</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 w-3/4 rounded-full" />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>375 / 500 Requests Delivered</span>
                <span>Scrub: 42 Wrong Prefixes Rejected</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-1">
              <span className="text-cyan-300 font-bold block">10-Minute Admin Timer Active</span>
              <p className="text-[10px] text-slate-400 font-sans">
                Dual monitor bots verify admin privileges before worker dispatches start, guaranteeing zero wasted spend.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-mono text-cyan-400">
              <Send className="w-3.5 h-3.5" />
              <span>THE ADVERTISER EXPERIENCE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              High-Conversion Campaigns with Zero Fraud Exposure
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Deploy your promotions across thousands of WhatsApp and Telegram groups. Leverage our automated verifier bots to filter wrong countries and protect your budgets.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {[
                { title: 'The 4 Target Platforms', desc: 'Support for WA Group, WA Channel, TG Group, and TG Channel.' },
                { title: '10-Minute Timeout Guard', desc: 'Bots auto-cancel and leave if admin rights are not granted in 10m.' },
                { title: '1-Hour Country Scrub', desc: 'Scrub wrong dial codes automatically so caps are never clogged.' },
                { title: 'Monotonic TG Counters', desc: 'Owner approvals or declines never backfill or drain budget.' },
                { title: 'Direct Session Rentals', desc: 'Rent Bronze, Silver, or Gold paired sessions on demand.' },
                { title: 'AI Accountant Protection', desc: 'Deterministic 75%+ margin floor with atomic Redis budget stops.' },
              ].map(b => (
                <div key={b.title} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{b.title}</span>
                  </span>
                  <p className="text-[11px] text-slate-400">{b.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onNavigateToAdvertiserAuth}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-lg shadow-cyan-950/60 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Launch an Advertiser Campaign</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. TRUST & TRANSPARENCY SECTION */}
      <section id="trust-security" className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 border-t border-white/[0.08]">
        <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SECURITY, POLICIES &amp; VERIFIED CLAIMS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Trust &amp; Operating Transparency
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            We publish our actual system rules and invariants. No fabricated testimonials or simulated earnings presented as live results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-400 mb-2">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Account Security &amp; Anti-Cheat</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every device is validated via hardware fingerprinting (1 physical device = 1 account). Our permanent SHA-256 WhatsApp JID ledger prevents bonus re-farming across newly registered SIMs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-cyan-400 mb-2">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Strict Financial Lock Policy</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              1.000 Coin is pegged 1:1 with ₦1.00 NGN. Minimum cashout is 500.000 Coins. Withdrawal unlocks strictly at 300.000 earned coins to release the endowed 200.000 bonus.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-amber-400 mb-2">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Worker &amp; Advertiser Guidelines</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              WhatsApp accounts are strictly used for open group broadcasts—never private chats. Groups with fewer than 100 members or locked messaging earn 0.000 coins.
            </p>
          </div>
        </div>
      </section>

      {/* 7. FAQ SECTION */}
      <section id="faq" className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-20 border-t border-white/[0.08]">
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-cyan-400">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Common Inquiries &amp; Platform Policies
          </h2>
          <p className="text-sm text-slate-400">
            Clear, honest answers about tasks, payouts, verification timers, and account types.
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div 
                key={item.q}
                className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-sm font-bold text-white">{item.q}</span>
                  <div className="p-1 rounded-lg bg-white/5 text-slate-400 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-3 animate-in fade-in duration-150">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. PROFESSIONAL FOOTER */}
      <footer className="w-full bg-[#050608] border-t border-white/[0.08] py-12 px-4 sm:px-6 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <BrandLogo size="sm" showText={true} />
            <p className="text-xs text-slate-400 leading-relaxed">
              Decentralized WhatsApp &amp; Telegram pair-to-earn network, automated bot verification, and quantitative AI marketplace.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <span className="font-bold text-white font-mono block">FOR WORKERS</span>
            <ul className="space-y-1.5 text-slate-400">
              <li><button onClick={onNavigateToWorkerAuth} className="hover:text-white">Start Earning</button></li>
              <li><button onClick={() => scrollToSection('for-workers')} className="hover:text-white">Task Opportunities</button></li>
              <li><button onClick={() => scrollToSection('trust-security')} className="hover:text-white">Withdrawal Policies</button></li>
              <li><button onClick={() => scrollToSection('faq')} className="hover:text-white">Worker FAQ</button></li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <span className="font-bold text-white font-mono block">FOR ADVERTISERS</span>
            <ul className="space-y-1.5 text-slate-400">
              <li><button onClick={onNavigateToAdvertiserAuth} className="hover:text-white">Advertise With Us</button></li>
              <li><button onClick={() => scrollToSection('for-advertisers')} className="hover:text-white">Campaign Studio</button></li>
              <li><button onClick={() => scrollToSection('for-advertisers')} className="hover:text-white">The 4 Smart Platforms</button></li>
              <li><button onClick={() => scrollToSection('trust-security')} className="hover:text-white">Pricing &amp; Margins</button></li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <span className="font-bold text-white font-mono block">TRUST &amp; COMPLIANCE</span>
            <ul className="space-y-1.5 text-slate-400">
              <li><span>Platform Terms of Service</span></li>
              <li><span>Privacy &amp; Data Security</span></li>
              <li><span>Anti-Spam &amp; JID Ledger</span></li>
              <li><span>Telegram: @OurGrowthBot</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <span>&copy; 2026 Pappy Earning Hub Ltd. All rights reserved.</span>
          <span>Zero Loss Invariants &middot; Verified State-Plane v2.026</span>
        </div>
      </footer>

      {/* ACCOUNT TYPE SELECTION MODAL */}
      {authChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0C0E14] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setAuthChoiceModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 text-center">
              <h3 className="text-xl font-bold text-white">Choose Your Account Type</h3>
              <p className="text-xs text-slate-400">
                Select your path to enter the appropriate dashboard experience.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => { setAuthChoiceModal(false); onNavigateToWorkerAuth(); }}
                className="w-full p-4 rounded-2xl bg-white/[0.02] hover:bg-emerald-950/30 border border-white/10 hover:border-emerald-500/50 transition-all text-left flex items-center gap-4 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                  <Radio className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white group-hover:text-emerald-300">
                      I want to Earn (Worker)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold">₦200 BONUS</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Complete tasks, pair sessions, and cash out 500+ coins.
                  </p>
                </div>
              </button>

              <button
                onClick={() => { setAuthChoiceModal(false); onNavigateToAdvertiserAuth(); }}
                className="w-full p-4 rounded-2xl bg-white/[0.02] hover:bg-cyan-950/30 border border-white/10 hover:border-cyan-500/50 transition-all text-left flex items-center gap-4 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white group-hover:text-cyan-300">
                      I want to Advertise (Business)
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono font-semibold">STUDIO</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Promote WhatsApp &amp; Telegram groups with automated bot verification.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
