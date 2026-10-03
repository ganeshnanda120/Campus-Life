import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reload,
  type User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import type { UserRecord, UserPermission } from '../types';

// Sole provisioned MAIN_ADMIN account (Strict No Demo Users)
export const INITIAL_DEMO_USERS: UserRecord[] = [
  {
    uid: '08uaC8idQOa0H05njEK8WC8Jakn1',
    email: 'ganeshnanda4500@gmail.com',
    role: 'MAIN_ADMIN',
    name: 'Ganesh Nanda',
    department: 'University Administration',
    designation: 'Chief Administrative Officer',
    permissions: [] as UserPermission[],
    isActivated: true,
    isActive: true,
    emailVerified: true,
    createdAt: '2026-10-03T14:28:00.000Z',
    updatedAt: '2026-10-03T14:28:00.000Z',
  }
];

const inMemoryStorage = new Map<string, string>();

const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // ignore
    }
    return inMemoryStorage.get(key) || null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
    inMemoryStorage.set(key, value);
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    inMemoryStorage.delete(key);
  }
};

export { safeStorage };

// Helper to get local authorized users database
export function getLocalUsers(): UserRecord[] {
  try {
    const raw = safeStorage.getItem('campus_life_authorized_users');
    if (raw) {
      let parsed = JSON.parse(raw) as UserRecord[];
      // Purge any legacy demo users ending in @campuslife.edu
      parsed = parsed.filter((u) => !u.email.endsWith('@campuslife.edu'));
      if (!parsed.some((u) => u.email.toLowerCase() === INITIAL_DEMO_USERS[0].email.toLowerCase())) {
        parsed.unshift(INITIAL_DEMO_USERS[0]);
      }
      safeStorage.setItem('campus_life_authorized_users', JSON.stringify(parsed));
      return parsed;
    }
  } catch {
    // ignore
  }
  try {
    safeStorage.setItem('campus_life_authorized_users', JSON.stringify(INITIAL_DEMO_USERS));
  } catch {
    // ignore
  }
  return INITIAL_DEMO_USERS;
}

export function saveLocalUsers(users: UserRecord[]): void {
  try {
    safeStorage.setItem('campus_life_authorized_users', JSON.stringify(users));
  } catch {
    // ignore
  }
}

export function updateLocalUser(email: string, updates: Partial<UserRecord>): UserRecord | null {
  const users = getLocalUsers();
  const index = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (index === -1) return null;
  users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
  saveLocalUsers(users);
  return users[index];
}

// Section 23: Human-readable error translation
export function mapFirebaseAuthError(codeOrMessage: string): string {
  if (!codeOrMessage) return 'An unexpected error occurred. Please try again.';

  if (codeOrMessage.includes('auth/invalid-credential') || codeOrMessage.includes('auth/wrong-password')) {
    return 'Incorrect email address or password. Please verify your credentials.';
  }
  if (codeOrMessage.includes('auth/user-not-found')) {
    return 'Your email address has not been registered by the administrator.';
  }
  if (codeOrMessage.includes('auth/user-disabled')) {
    return 'Your account is currently inactive. Please contact your administrator.';
  }
  if (codeOrMessage.includes('auth/too-many-requests')) {
    return 'Too many unsuccessful attempts. Access has been temporarily restricted for security.';
  }
  if (codeOrMessage.includes('auth/network-request-failed')) {
    return 'Network connection failure. Please check your internet connectivity and retry.';
  }
  if (codeOrMessage.includes('auth/weak-password')) {
    return 'Password is too weak. Please ensure it contains uppercase, lowercase, and numeric characters.';
  }
  if (codeOrMessage.includes('auth/email-already-in-use')) {
    return 'This email address is already initialized in authentication records.';
  }

  return codeOrMessage;
}

export interface EmailCheckResult {
  authorized: boolean;
  active: boolean;
  activated: boolean;
  user?: UserRecord;
  message?: string;
}

export const authService = {
  async checkEmailAuthorization(email: string): Promise<EmailCheckResult> {
    const cleanEmail = email.trim().toLowerCase();

    if (isFirebaseConfigured && db) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', cleanEmail));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data() as UserRecord;
          return {
            authorized: true,
            active: Boolean(docData.isActive),
            activated: Boolean(docData.isActivated),
            user: docData,
          };
        }
      } catch (err) {
        console.warn('Firestore query failed, falling back to authorized repository:', err);
      }
    }

    const users = getLocalUsers();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return {
        authorized: false,
        active: false,
        activated: false,
        message: 'Your email address has not been registered by the administrator. Please contact your administrator.',
      };
    }

    return {
      authorized: true,
      active: Boolean(user.isActive),
      activated: Boolean(user.isActivated),
      user,
    };
  },

  async initiateFirstTimeActivation(email: string): Promise<{ success: boolean; message?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (isFirebaseConfigured && auth) {
      try {
        const tempInitPassword = `Init_${Date.now()}_Tmp!`;
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, tempInitPassword);
          await sendEmailVerification(cred.user);
        } catch {
          if (auth.currentUser) {
            await sendEmailVerification(auth.currentUser);
          }
        }
        return { success: true };
      } catch (err: any) {
        console.warn('Firebase email verification dispatch:', err);
        return { success: false, message: mapFirebaseAuthError(err.code || err.message) };
      }
    }

    try {
      safeStorage.setItem(`campus_life_verification_${cleanEmail}`, 'SENT');
    } catch {
      // ignore
    }
    return { success: true };
  },

  async checkEmailVerified(user?: FirebaseUser | null, email?: string): Promise<boolean> {
    if (isFirebaseConfigured && user) {
      try {
        await reload(user);
        return user.emailVerified;
      } catch {
        return false;
      }
    }

    if (email) {
      const state = safeStorage.getItem(`campus_life_verification_${email.toLowerCase()}`);
      return state === 'VERIFIED' || state === 'SENT';
    }
    return true;
  },

  async completePasswordSetup(
    email: string,
    password: string,
    currentUser?: FirebaseUser | null
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (isFirebaseConfigured && auth && currentUser) {
      try {
        await updatePassword(currentUser, password);

        if (db) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userDocRef, {
            isActivated: true,
            emailVerified: true,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        return { success: false, error: mapFirebaseAuthError(err.code || err.message) };
      }
    }

    const updated = updateLocalUser(cleanEmail, {
      isActivated: true,
      emailVerified: true,
    });

    try {
      safeStorage.setItem(`campus_life_pwd_${cleanEmail}`, password);
      safeStorage.removeItem(`campus_life_verification_${cleanEmail}`);
    } catch {
      // ignore
    }

    return { success: true, user: updated || undefined };
  },

  async signInWithEmailPassword(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    const authCheck = await this.checkEmailAuthorization(cleanEmail);
    if (!authCheck.authorized) {
      return {
        success: false,
        error: 'Your email address has not been registered by the administrator. Please contact your administrator.',
      };
    }

    if (!authCheck.active) {
      return {
        success: false,
        error: 'Your account is currently inactive. Please contact your administrator.',
      };
    }

    if (isFirebaseConfigured && auth) {
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        return { success: true, user: authCheck.user };
      } catch (err: any) {
        return { success: false, error: mapFirebaseAuthError(err.code || err.message) };
      }
    }

    return {
      success: false,
      error: 'Authentication service unavailable. Please check your network connection.',
    };
  },

  async sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    const authCheck = await this.checkEmailAuthorization(cleanEmail);
    if (!authCheck.authorized) {
      return { success: true };
    }

    if (isFirebaseConfigured && auth) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: mapFirebaseAuthError(err.code || err.message) };
      }
    }

    return { success: true };
  },

  async signOut(): Promise<void> {
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('Firebase sign out error:', err);
      }
    }
  }
};
