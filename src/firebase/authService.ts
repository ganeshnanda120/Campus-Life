import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reload,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc
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
  if (codeOrMessage.includes('auth/requires-recent-login')) {
    return 'Your activation session timed out. Please retry or click Start Activation again.';
  }
  if (codeOrMessage.includes('permission-denied') || codeOrMessage.includes('Missing or insufficient permissions')) {
    return 'Permission denied by authorization policy. Please verify your activation link or contact your system administrator.';
  }

  return codeOrMessage;
}

export interface EmailCheckResult {
  authorized: boolean;
  active: boolean;
  activated: boolean;
  emailVerified?: boolean;
  user?: UserRecord;
  message?: string;
}

// Deterministic temporary password for pre-activation email verification
export function getActivationTempPassword(email: string): string {
  const b64 = typeof btoa !== 'undefined'
    ? btoa(email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
    : 'CampusPass';
  return `Init_${b64}_Pass1!`;
}

export const authService = {
  async checkEmailAuthorization(email: string): Promise<EmailCheckResult> {
    const cleanEmail = email.trim().toLowerCase();

    const isLocallyVerified = safeStorage.getItem(`campus_life_verification_${cleanEmail}`) === 'VERIFIED';
    const hasStoredPwd = Boolean(safeStorage.getItem(`campus_life_pwd_${cleanEmail}`));

    if (isFirebaseConfigured && db) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', cleanEmail));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data() as UserRecord;
          const isVerified = Boolean(docData.emailVerified || isLocallyVerified || hasStoredPwd);
          const isActivated = Boolean(docData.isActivated || hasStoredPwd);
          return {
            authorized: true,
            active: Boolean(docData.isActive),
            activated: isActivated,
            emailVerified: isVerified,
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
        emailVerified: false,
        message: 'Your email address has not been registered by the administrator. Please contact your administrator.',
      };
    }

    const isVerified = Boolean(user.emailVerified || isLocallyVerified || hasStoredPwd);
    const isActivated = Boolean(user.isActivated || hasStoredPwd);

    return {
      authorized: true,
      active: Boolean(user.isActive),
      activated: isActivated,
      emailVerified: isVerified,
      user,
    };
  },

  async initiateFirstTimeActivation(email: string): Promise<{ success: boolean; message?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (isFirebaseConfigured && auth) {
      try {
        const tempInitPassword = getActivationTempPassword(cleanEmail);
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, tempInitPassword);
          await sendEmailVerification(cred.user);
        } catch {
          try {
            const signedIn = await signInWithEmailAndPassword(auth, cleanEmail, tempInitPassword);
            await sendEmailVerification(signedIn.user);
          } catch {
            if (auth.currentUser) {
              await sendEmailVerification(auth.currentUser);
            }
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
    const cleanEmail = email ? email.trim().toLowerCase() : undefined;

    if (cleanEmail && safeStorage.getItem(`campus_life_verification_${cleanEmail}`) === 'VERIFIED') {
      return true;
    }

    if (isFirebaseConfigured && auth) {
      let targetUser = user || auth.currentUser;

      if (!targetUser || (cleanEmail && targetUser.email?.toLowerCase() !== cleanEmail)) {
        if (cleanEmail) {
          try {
            const tempPass = getActivationTempPassword(cleanEmail);
            const cred = await signInWithEmailAndPassword(auth, cleanEmail, tempPass);
            targetUser = cred.user;
          } catch {
            // ignore
          }
        }
      }

      if (targetUser) {
        try {
          await reload(targetUser);
          if (targetUser.emailVerified) {
            if (cleanEmail) {
              safeStorage.setItem(`campus_life_verification_${cleanEmail}`, 'VERIFIED');
            }
            return true;
          }
        } catch {
          // ignore
        }
      }
    }

    if (cleanEmail) {
      const state = safeStorage.getItem(`campus_life_verification_${cleanEmail}`);
      return state === 'VERIFIED';
    }
    return false;
  },

  async completePasswordSetup(
    email: string,
    password: string,
    currentUser?: FirebaseUser | null
  ): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    let activeUser = currentUser || (isFirebaseConfigured && auth ? auth.currentUser : null);

    let activatedRecord: UserRecord | null = null;

    if (isFirebaseConfigured && auth) {
      const tempPass = getActivationTempPassword(cleanEmail);

      // Re-authenticate or sign in with temporary activation password to get a fresh auth session (prevents auth/requires-recent-login)
      try {
        const signedIn = await signInWithEmailAndPassword(auth, cleanEmail, tempPass);
        activeUser = signedIn.user;
      } catch {
        // If signIn with tempPass fails, activeUser might already be signed in
      }

      if (activeUser) {
        try {
          try {
            await updatePassword(activeUser, password);
          } catch (passErr: any) {
            if (passErr.code === 'auth/requires-recent-login') {
              const credential = EmailAuthProvider.credential(cleanEmail, tempPass);
              await reauthenticateWithCredential(activeUser, credential);
              await updatePassword(activeUser, password);
            } else {
              throw passErr;
            }
          }

        if (db) {
          const userDocRef = doc(db, 'users', activeUser.uid);
          let baseRecord: UserRecord | null = null;
          let oldDocId: string | null = null;

          try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              baseRecord = userDocSnap.data() as UserRecord;
            }
          } catch (e) {
            console.warn('Could not fetch userDoc by UID:', e);
          }

          if (!baseRecord) {
            try {
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('email', '==', cleanEmail));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                baseRecord = qSnap.docs[0].data() as UserRecord;
                oldDocId = qSnap.docs[0].id;
              }
            } catch (e) {
              console.warn('Could not query users by email:', e);
            }
          }

          if (!baseRecord) {
            const localUsers = getLocalUsers();
            baseRecord = localUsers.find((u) => u.email.toLowerCase() === cleanEmail) || null;
          }

          const activatedData: UserRecord = {
            role: baseRecord?.role || 'STUDENT',
            name: cleanEmail.split('@')[0],
            ...baseRecord,
            uid: activeUser.uid,
            email: cleanEmail,
            isActivated: true,
            isActive: true,
            emailVerified: true,
            createdAt: baseRecord?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          activatedRecord = activatedData;
          await setDoc(userDocRef, activatedData, { merge: true });

          if (oldDocId && oldDocId !== activeUser.uid) {
            try {
              await deleteDoc(doc(db, 'users', oldDocId));
            } catch {
              // ignore legacy doc cleanup failure
            }
          }
        }
      } catch (err: any) {
        console.error('Password setup error:', err);
        return { success: false, error: mapFirebaseAuthError(err.code || err.message) };
      }
    }
  }

    const updated = updateLocalUser(cleanEmail, {
      uid: activeUser?.uid,
      isActivated: true,
      emailVerified: true,
    });

    try {
      safeStorage.setItem(`campus_life_pwd_${cleanEmail}`, password);
      safeStorage.setItem(`campus_life_verification_${cleanEmail}`, 'VERIFIED');
    } catch {
      // ignore
    }

    return { success: true, user: updated || activatedRecord || undefined };
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
        // If Firebase Auth user doesn't exist yet, but local password matches
        const storedPwd = safeStorage.getItem(`campus_life_pwd_${cleanEmail}`);
        if (storedPwd && storedPwd === password && authCheck.user) {
          try {
            const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            if (db && cred.user) {
              const userDocRef = doc(db, 'users', cred.user.uid);
              await setDoc(userDocRef, { ...authCheck.user, uid: cred.user.uid, isActivated: true, emailVerified: true }, { merge: true });
            }
            return { success: true, user: { ...authCheck.user, uid: cred.user.uid, isActivated: true, emailVerified: true } };
          } catch {
            return { success: true, user: authCheck.user };
          }
        }
        return { success: false, error: mapFirebaseAuthError(err.code || err.message) };
      }
    }

    const storedPwd = safeStorage.getItem(`campus_life_pwd_${cleanEmail}`);
    if (storedPwd && storedPwd === password && authCheck.user) {
      return { success: true, user: authCheck.user };
    }

    return {
      success: false,
      error: 'Authentication failed. Please check your credentials.',
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
