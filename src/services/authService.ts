import { AuthUser, AuthSession, UserRole } from '../types';

const STORAGE_SESSION_KEY = 'pappy_auth_session';
const STORAGE_USERS_KEY = 'pappy_registered_users';

// Pre-seeded verified accounts for immediate testing
const DEFAULT_ACCOUNTS: Array<{ user: AuthUser; passwordHash: string }> = [
  {
    user: {
      id: 'usr_worker_01',
      email: 'worker@pappyearninghub.com',
      name: 'Adewale Worker',
      role: 'EARNER',
      isEmailVerified: true,
      authProvider: 'email',
      createdAt: '2026-01-15T08:00:00.000Z',
    },
    passwordHash: 'WorkerPass2026!',
  },
  {
    user: {
      id: 'usr_advertiser_01',
      email: 'advertiser@pappyearninghub.com',
      name: 'Chisom Advertiser',
      role: 'ADVERTISER',
      isEmailVerified: true,
      authProvider: 'email',
      createdAt: '2026-02-10T10:30:00.000Z',
    },
    passwordHash: 'AdPass2026!',
  },
  {
    user: {
      id: 'usr_admin_01',
      email: 'admin@pappyearninghub.com',
      name: 'Chief Systems Architect',
      role: 'ADMIN',
      isEmailVerified: true,
      authProvider: 'email',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    passwordHash: 'AdminPass2026!',
  },
];

export class AuthService {
  private static getStoredUsers(): Array<{ user: AuthUser; passwordHash: string }> {
    try {
      const stored = localStorage.getItem(STORAGE_USERS_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
        return DEFAULT_ACCOUNTS;
      }
      return JSON.parse(stored);
    } catch {
      return DEFAULT_ACCOUNTS;
    }
  }

  private static saveUsers(users: Array<{ user: AuthUser; passwordHash: string }>) {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users to storage', e);
    }
  }

  /**
   * Retrieves active authenticated session
   */
  public static getCurrentSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        this.signOut();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Sign In with Email & Password with Role Guard
   */
  public static async signInWithEmail(
    email: string,
    password: string,
    enforceRole?: UserRole
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    // Artificial latency for realistic async feedback
    await new Promise(res => setTimeout(res, 450));

    const cleanEmail = email.trim().toLowerCase();
    const users = this.getStoredUsers();
    const found = users.find(u => u.user.email.toLowerCase() === cleanEmail);

    if (!found) {
      return { success: false, error: 'No account found with this email address. Please check your credentials or create an account.' };
    }

    if (found.passwordHash !== password) {
      return { success: false, error: 'Incorrect password entered. Please try again or use the forgot password link.' };
    }

    // Role Guard Check: Ensure user matches expected flow
    if (enforceRole && found.user.role !== enforceRole && found.user.role !== 'ADMIN') {
      const targetFlow = enforceRole === 'EARNER' ? 'Worker' : 'Advertiser';
      const actualRole = found.user.role === 'EARNER' ? 'Worker' : 'Advertiser';
      return {
        success: false,
        error: `This account is registered as an ${actualRole}. Please use the ${actualRole} sign-in page to access your dashboard.`,
      };
    }

    const session: AuthSession = {
      token: `ns_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      user: found.user,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    return { success: true, session };
  }

  /**
   * Register new account with role assignment
   */
  public static async signUpWithEmail(
    email: string,
    password: string,
    confirmPassword: string,
    name: string,
    role: UserRole
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    await new Promise(res => setTimeout(res, 550));

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    if (password !== confirmPassword) {
      return { success: false, error: 'Password confirmation does not match.' };
    }

    const users = this.getStoredUsers();
    if (users.some(u => u.user.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
    }

    const newUser: AuthUser = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      name: name.trim() || (role === 'EARNER' ? 'Verified Worker' : 'Campaign Manager'),
      role,
      isEmailVerified: true,
      authProvider: 'email',
      createdAt: new Date().toISOString(),
    };

    users.push({ user: newUser, passwordHash: password });
    this.saveUsers(users);

    const session: AuthSession = {
      token: `ns_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      user: newUser,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    return { success: true, session };
  }

  /**
   * Continue with Google OAuth
   */
  public static async signInWithGoogle(
    role: UserRole
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    await new Promise(res => setTimeout(res, 600));

    // Simulated Google OAuth response based on client email/profile
    const googleEmail = `${role.toLowerCase()}.${Math.floor(100 + Math.random() * 900)}@gmail.com`;
    const users = this.getStoredUsers();
    let existing = users.find(u => u.user.email.toLowerCase() === googleEmail.toLowerCase());

    if (!existing) {
      const newUser: AuthUser = {
        id: `usr_g_${Date.now()}`,
        email: googleEmail,
        name: role === 'EARNER' ? 'Google Worker' : 'Google Advertiser',
        role,
        isEmailVerified: true,
        authProvider: 'google',
        createdAt: new Date().toISOString(),
      };
      users.push({ user: newUser, passwordHash: 'GOOGLE_OAUTH_MANAGED' });
      this.saveUsers(users);
      existing = { user: newUser, passwordHash: 'GOOGLE_OAUTH_MANAGED' };
    }

    const session: AuthSession = {
      token: `ns_g_tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      user: existing.user,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    return { success: true, session };
  }

  /**
   * Password Reset Flow
   */
  public static async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    await new Promise(res => setTimeout(res, 400));
    return {
      success: true,
      message: `Password reset instructions have been dispatched to ${email}. Check your inbox or spam folder.`,
    };
  }

  /**
   * Terminate active session
   */
  public static signOut() {
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch (e) {
      console.error('Sign out error', e);
    }
  }

  /**
   * Multi-role switch helper
   */
  public static switchRole(session: AuthSession, targetRole: UserRole): AuthSession {
    const updatedUser: AuthUser = {
      ...session.user,
      role: targetRole,
    };
    const updatedSession: AuthSession = {
      ...session,
      user: updatedUser,
    };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(updatedSession));
    return updatedSession;
  }
}
