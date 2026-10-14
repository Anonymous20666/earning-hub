import React, { useState, useEffect } from 'react';
import { initialAppState, AppState } from './services/store';
import { AuthService } from './services/authService';
import { UserRole, AuthUser, AuthSession } from './types';
import { LandingPage } from './components/LandingPage';
import { WorkerAuth } from './components/WorkerAuth';
import { AdvertiserAuth } from './components/AdvertiserAuth';
import { CommandPalette } from './components/CommandPalette';
import { TerminalDrawer } from './components/TerminalDrawer';
import { EarnerWorkspace } from './components/EarnerWorkspace';
import { AdvertiserStudio } from './components/AdvertiserStudio';
import { AdminCommandCenter } from './components/AdminCommandCenter';
import { BrandLogo } from './components/BrandLogo';
import { 
  Radio, 
  Send, 
  ShieldCheck, 
  Search, 
  Terminal, 
  Coins, 
  Sparkles, 
  Lock, 
  Zap, 
  ArrowLeft,
  LogOut,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

type AppView = 'LANDING' | 'WORKER_AUTH' | 'ADVERTISER_AUTH' | 'DASHBOARD';

export function App() {
  const [state, setState] = useState<AppState>(initialAppState);
  const [currentView, setCurrentView] = useState<AppView>('LANDING');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [permissionAlert, setPermissionAlert] = useState<string | null>(null);

  // Initialize and check active session
  useEffect(() => {
    const session = AuthService.getCurrentSession();
    if (session) {
      setCurrentUser(session.user);
      setState(prev => ({
        ...prev,
        currentRole: session.user.role,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          deviceHash: prev.user.deviceHash,
        },
      }));
    }
  }, []);

  // Helper log emitter
  const handleAddLog = (log: typeof state.terminalLogs[0]) => {
    setState(prev => ({
      ...prev,
      terminalLogs: [log, ...prev.terminalLogs].slice(0, 200),
    }));
  };

  // Auth Success Handlers
  const handleAuthSuccess = (session: AuthSession) => {
    setCurrentUser(session.user);
    setState(prev => ({
      ...prev,
      currentRole: session.user.role,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        deviceHash: prev.user.deviceHash,
      },
    }));
    setCurrentView('DASHBOARD');
    setPermissionAlert(null);

    handleAddLog({
      id: `auth_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'SUCCESS',
      message: `User [${session.user.email}] authenticated with role ${session.user.role}. Secure token generated.`,
    });
  };

  // Sign out handler
  const handleSignOut = () => {
    AuthService.signOut();
    setCurrentUser(null);
    setCurrentView('LANDING');
    setPermissionAlert(null);

    handleAddLog({
      id: `signout_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'STATE_PLANE',
      level: 'INFO',
      message: 'Active session terminated. Client redirected to public landing page.',
    });
  };

  // Role Protection Guard
  const handleRoleSwitch = (targetRole: UserRole) => {
    if (!currentUser) {
      if (targetRole === 'EARNER') setCurrentView('WORKER_AUTH');
      else if (targetRole === 'ADVERTISER') setCurrentView('ADVERTISER_AUTH');
      return;
    }

    // Role boundary validation: check if non-admin user is attempting to access wrong role
    if (currentUser.role !== 'ADMIN' && currentUser.role !== targetRole) {
      setPermissionAlert(
        `Role Restriction: You are currently signed in as a ${currentUser.role === 'EARNER' ? 'Worker' : 'Advertiser'}. To access the ${targetRole === 'EARNER' ? 'Worker' : 'Advertiser'} Dashboard, please switch your account role or sign in with your corresponding credentials.`
      );
      return;
    }

    setPermissionAlert(null);
    setState(p => ({ ...p, currentRole: targetRole }));
  };

  // Fast switch for multi-role testing
  const handleUpgradeAccountRole = (newRole: UserRole) => {
    const session = AuthService.getCurrentSession();
    if (session) {
      const updated = AuthService.switchRole(session, newRole);
      setCurrentUser(updated.user);
      setState(p => ({ ...p, currentRole: newRole }));
      setPermissionAlert(null);
      handleAddLog({
        id: `role_switch_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'STATE_PLANE',
        level: 'INFO',
        message: `Account role switched to ${newRole} for user ${updated.user.email}.`,
      });
    }
  };

  // Landing Page CTA Routing
  const handleStartEarningClicked = () => {
    if (currentUser && currentUser.role === 'EARNER') {
      setState(p => ({ ...p, currentRole: 'EARNER' }));
      setCurrentView('DASHBOARD');
    } else if (currentUser && currentUser.role === 'ADVERTISER') {
      setPermissionAlert('You are currently signed in as an Advertiser. Switch to your Worker profile to view earnings.');
      setCurrentView('DASHBOARD');
    } else {
      setCurrentView('WORKER_AUTH');
    }
  };

  const handleAdvertiseWithUsClicked = () => {
    if (currentUser && currentUser.role === 'ADVERTISER') {
      setState(p => ({ ...p, currentRole: 'ADVERTISER' }));
      setCurrentView('DASHBOARD');
    } else if (currentUser && currentUser.role === 'EARNER') {
      setPermissionAlert('You are currently signed in as a Worker. Switch to your Advertiser profile to manage campaigns.');
      setCurrentView('DASHBOARD');
    } else {
      setCurrentView('ADVERTISER_AUTH');
    }
  };

  // RENDER VIEW 1: WORKER AUTH PAGE
  if (currentView === 'WORKER_AUTH') {
    return (
      <WorkerAuth
        onSuccess={handleAuthSuccess}
        onReturnHome={() => setCurrentView('LANDING')}
        onSwitchToAdvertiserAuth={() => setCurrentView('ADVERTISER_AUTH')}
      />
    );
  }

  // RENDER VIEW 2: ADVERTISER AUTH PAGE
  if (currentView === 'ADVERTISER_AUTH') {
    return (
      <AdvertiserAuth
        onSuccess={handleAuthSuccess}
        onReturnHome={() => setCurrentView('LANDING')}
        onSwitchToWorkerAuth={() => setCurrentView('WORKER_AUTH')}
      />
    );
  }

  // RENDER VIEW 3: PUBLIC LANDING PAGE
  if (currentView === 'LANDING') {
    return (
      <>
        <LandingPage
          currentUser={currentUser}
          onNavigateToWorkerAuth={handleStartEarningClicked}
          onNavigateToAdvertiserAuth={handleAdvertiseWithUsClicked}
          onNavigateToDashboard={role => {
            setState(p => ({ ...p, currentRole: role }));
            setCurrentView('DASHBOARD');
          }}
          onSignOut={handleSignOut}
        />
        {/* State-Plane Live Terminal Drawer */}
        <TerminalDrawer
          logs={state.terminalLogs}
          onClearLogs={() => setState(p => ({ ...p, terminalLogs: [] }))}
          isOpen={isTerminalOpen}
          onToggle={() => setIsTerminalOpen(prev => !prev)}
        />
        {/* Cmd+K Command Palette */}
        <CommandPalette
          isOpen={isCommandOpen}
          onClose={() => setIsCommandOpen(false)}
          onSelectRole={role => {
            handleRoleSwitch(role);
            setCurrentView('DASHBOARD');
          }}
          onOpenWithdraw={() => {
            handleRoleSwitch('EARNER');
            setCurrentView('DASHBOARD');
          }}
          onOpenPairModal={() => {
            handleRoleSwitch('EARNER');
            setCurrentView('DASHBOARD');
          }}
          onOpenJoinManager={() => {
            handleRoleSwitch('EARNER');
            setCurrentView('DASHBOARD');
          }}
          onOpenValidatorHub={() => {
            handleRoleSwitch('ADMIN');
            setCurrentView('DASHBOARD');
          }}
          onOpenLiveTerminal={() => setIsTerminalOpen(true)}
        />
      </>
    );
  }

  // RENDER VIEW 4: PROTECTED DASHBOARDS (WORKER, ADVERTISER, ADMIN)
  return (
    <div className="min-h-screen bg-[#06070A] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 antialiased pb-28">
      {/* GLOBAL TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-30 w-full h-16 bg-[#06070A]/85 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Brand Logo & Back to Landing */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('LANDING')}
              className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer mr-1"
              title="Return to Public Landing Page"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Landing</span>
            </button>

            <BrandLogo size="sm" showText={true} />
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-semibold">
              {state.currentRole}
            </span>
          </div>

          {/* Role-Based Workspace Switcher with Permission Verification */}
          <nav className="flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <button
              onClick={() => handleRoleSwitch('EARNER')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                state.currentRole === 'EARNER'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Worker</span>
              <span className="text-[10px] font-mono text-emerald-300">
                (₦{(state.wallet.earned_balance + state.wallet.locked_bonus).toFixed(0)} / ${((state.wallet.earned_balance + state.wallet.locked_bonus) / 1500).toFixed(2)})
              </span>
            </button>

            <button
              onClick={() => handleRoleSwitch('ADVERTISER')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                state.currentRole === 'ADVERTISER'
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-900/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Advertiser</span>
            </button>

            <button
              onClick={() => handleRoleSwitch('ADMIN')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                state.currentRole === 'ADMIN'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </nav>

          {/* User Profile Badge & Quick Actions */}
          <div className="flex items-center gap-2.5">
            {currentUser && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/5 text-xs font-mono">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300 truncate max-w-[120px]">{currentUser.name}</span>
              </div>
            )}

            <button
              onClick={() => setIsCommandOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-xs text-slate-400 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <kbd className="hidden sm:inline text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-slate-300">
                ⌘K
              </kbd>
            </button>

            <button
              onClick={() => setIsTerminalOpen(prev => !prev)}
              className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-emerald-400 transition-colors cursor-pointer"
              title="Toggle State-Plane Live Terminal"
            >
              <Terminal className="w-4 h-4" />
            </button>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* PERMISSION / ROLE BOUNDARY ALERT BANNER */}
      {permissionAlert && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{permissionAlert}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleUpgradeAccountRole(state.currentRole === 'EARNER' ? 'ADVERTISER' : 'EARNER')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer"
              >
                Switch Role Profile
              </button>
              <button
                onClick={() => setPermissionAlert(null)}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {state.currentRole === 'EARNER' && (
          <EarnerWorkspace
            wallet={state.wallet}
            sessions={state.sessions}
            groups={state.groups}
            validatedPool={state.validatedPool}
            onUpdateWallet={w => setState(p => ({ ...p, wallet: w }))}
            onUpdateSessions={s => setState(p => ({ ...p, sessions: s }))}
            onUpdateGroups={g => setState(p => ({ ...p, groups: g }))}
            onAddLog={handleAddLog}
          />
        )}

        {state.currentRole === 'ADVERTISER' && (
          <AdvertiserStudio
            campaigns={state.campaigns}
            groups={state.groups}
            adminBots={state.adminBots}
            onAddCampaign={c => setState(p => ({ ...p, campaigns: [c, ...p.campaigns] }))}
            onUpdateCampaign={c => setState(p => ({ ...p, campaigns: p.campaigns.map(item => item.id === c.id ? c : item) }))}
            onAddLog={handleAddLog}
          />
        )}

        {state.currentRole === 'ADMIN' && (
          <AdminCommandCenter
            adminBots={state.adminBots}
            supportTickets={state.supportTickets}
            pricingConfig={state.pricingConfig}
            validatedPool={state.validatedPool}
            campaigns={state.campaigns}
            onUpdatePricing={cfg => setState(p => ({ ...p, pricingConfig: cfg }))}
            onUpdateTickets={t => setState(p => ({ ...p, supportTickets: t }))}
            onAddLog={handleAddLog}
          />
        )}
      </main>

      {/* CYBER-TERMINAL LIVE LOG DRAWER */}
      <TerminalDrawer
        logs={state.terminalLogs}
        onClearLogs={() => setState(p => ({ ...p, terminalLogs: [] }))}
        isOpen={isTerminalOpen}
        onToggle={() => setIsTerminalOpen(prev => !prev)}
      />

      {/* CMD+K COMMAND PALETTE */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelectRole={role => {
          handleRoleSwitch(role);
          setCurrentView('DASHBOARD');
        }}
        onOpenWithdraw={() => {
          handleRoleSwitch('EARNER');
          setCurrentView('DASHBOARD');
        }}
        onOpenPairModal={() => {
          handleRoleSwitch('EARNER');
          setCurrentView('DASHBOARD');
        }}
        onOpenJoinManager={() => {
          handleRoleSwitch('EARNER');
          setCurrentView('DASHBOARD');
        }}
        onOpenValidatorHub={() => {
          handleRoleSwitch('ADMIN');
          setCurrentView('DASHBOARD');
        }}
        onOpenLiveTerminal={() => setIsTerminalOpen(true)}
      />
    </div>
  );
}

export default App;
