import { 
  db, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { AuthUser, Wallet } from '../types';

export interface StoredChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
}

export class FirestoreService {
  /**
   * Sync or save user profile to Firestore
   */
  public static async saveUserProfile(user: AuthUser): Promise<void> {
    const userPath = `users/${user.id}`;
    try {
      await setDoc(doc(db, 'users', user.id), {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl || '',
        isEmailVerified: user.isEmailVerified,
        authProvider: user.authProvider,
        createdAt: user.createdAt || new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }

  /**
   * Fetch user profile from Firestore
   */
  public static async getUserProfile(userId: string): Promise<AuthUser | null> {
    const userPath = `users/${userId}`;
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) return null;
      return snap.data() as AuthUser;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }
  }

  /**
   * Get wallet or initialize new wallet in Firestore
   */
  public static async getOrCreateWallet(userId: string): Promise<Wallet> {
    const walletPath = `wallets/${userId}`;
    try {
      const ref = doc(db, 'wallets', userId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data() as Wallet;
      }

      // Initialize default wallet with locked 200.000 bonus
      const initialWallet: Wallet = {
        id: `wal_${userId}`,
        userId,
        locked_bonus: 200.000,
        earned_balance: 0.000,
        pending_referral_balance: 5.000,
        bonus_claimed: false,
        total_withdrawn: 0.000,
      };

      await setDoc(ref, initialWallet);
      return initialWallet;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, walletPath);
    }
  }

  /**
   * Update wallet in Firestore
   */
  public static async saveWallet(wallet: Wallet): Promise<void> {
    const walletPath = `wallets/${wallet.userId}`;
    try {
      await setDoc(doc(db, 'wallets', wallet.userId), wallet, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, walletPath);
    }
  }

  /**
   * Real-time subscription to user wallet
   */
  public static subscribeToWallet(userId: string, callback: (wallet: Wallet) => void): () => void {
    const walletPath = `wallets/${userId}`;
    const unsubscribe = onSnapshot(
      doc(db, 'wallets', userId),
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as Wallet);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, walletPath);
      }
    );
    return unsubscribe;
  }

  /**
   * Save a chat message to Firestore multi-turn history
   */
  public static async saveChatMessage(userId: string, message: StoredChatMessage): Promise<void> {
    const messagePath = `users/${userId}/chatMessages/${message.id}`;
    try {
      await setDoc(doc(db, 'users', userId, 'chatMessages', message.id), message);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, messagePath);
    }
  }

  /**
   * Fetch chat history for user from Firestore
   */
  public static async getChatMessages(userId: string): Promise<StoredChatMessage[]> {
    const messagesPath = `users/${userId}/chatMessages`;
    try {
      const q = query(
        collection(db, 'users', userId, 'chatMessages'),
        orderBy('createdAt', 'asc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const messages: StoredChatMessage[] = [];
      snap.forEach((d) => {
        messages.push(d.data() as StoredChatMessage);
      });
      return messages;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, messagesPath);
    }
  }
}
