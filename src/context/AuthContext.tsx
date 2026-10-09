import React, { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import { authService, getLocalUsers, type EmailCheckResult } from '../firebase/authService';
import { AuthContext } from './AuthContextDefinition';
import type { UserRecord, UserRole, UserPermission } from '../types';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserRecord | null>(() => {
    try {
      const savedSession = sessionStorage.getItem('campus_life_session');
      if (savedSession) {
        return JSON.parse(savedSession) as UserRecord;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => isFirebaseConfigured);

  // Load user profile from Firestore or local authorized registry
  const loadProfile = useCallback(async (email: string, uid?: string): Promise<UserRecord | null> => {
    if (isFirebaseConfigured && db && uid) {
      try {
        const userDocRef = doc(db, 'users', uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data() as UserRecord;
          if (data.isActive) {
            return data;
          }
          await authService.signOut();
          return null;
        }
      } catch (err) {
        console.warn('Error loading user document from Firestore:', err);
      }
    }

    const check = await authService.checkEmailAuthorization(email);
    if (check.authorized && check.active && check.user) {
      if (isFirebaseConfigured && db && uid && check.user.uid !== uid) {
        try {
          const userDocRef = doc(db, 'users', uid);
          await setDoc(userDocRef, { ...check.user, uid }, { merge: true });
        } catch {
          // ignore
        }
      }
      return check.user;
    }
    return null;
  }, []);

  // Initialize session state on mount when Firebase Auth is configured
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser && firebaseUser.email) {
        const profile = await loadProfile(firebaseUser.email, firebaseUser.uid);
        if (profile) {
          setCurrentUser(firebaseUser);
          setUserProfile(profile);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      } else {
        setCurrentUser(null);
        const wasExplicitLogout = sessionStorage.getItem('campus_life_logged_out') === 'true';
        if (wasExplicitLogout) {
          setUserProfile(null);
        } else {
          const savedSession = sessionStorage.getItem('campus_life_session');
          if (savedSession) {
            try {
              const parsed = JSON.parse(savedSession) as UserRecord;
              if (parsed && parsed.isActive) {
                setUserProfile(parsed);
                setIsLoading(false);
                return;
              }
            } catch {
              // ignore
            }
          }
          setUserProfile(null);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [loadProfile]);

  // Section 13: Real-Time Updates — listen to Firestore doc and local changes
  useEffect(() => {
    let firestoreUnsub: (() => void) | null = null;
    const activeUid = currentUser?.uid || userProfile?.uid;

    if (isFirebaseConfigured && db && activeUid) {
      try {
        const userDocRef = doc(db, 'users', activeUid);
        firestoreUnsub = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserRecord;
              if (data.isActive) {
                setUserProfile(data);
                try {
                  sessionStorage.setItem('campus_life_session', JSON.stringify(data));
                } catch {
                  // ignore
                }
              } else {
                authService.signOut();
                setCurrentUser(null);
                setUserProfile(null);
              }
            }
          },
          (err) => {
            console.warn('Realtime user profile listener error:', err);
          }
        );
      } catch (err) {
        console.warn('Failed to attach realtime profile listener:', err);
      }
    }

    const handleStorageChange = () => {
      if (userProfile?.email) {
        const localUsers = getLocalUsers();
        const found = localUsers.find((u) => u.email.toLowerCase() === userProfile.email.toLowerCase());
        if (found) {
          setUserProfile(found);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (firestoreUnsub) firestoreUnsub();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentUser?.uid, userProfile?.uid, userProfile?.email]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const result = await authService.signInWithEmailPassword(email, password);
    if (result.success && result.user) {
      setUserProfile(result.user);
      try {
        sessionStorage.setItem('campus_life_session', JSON.stringify(result.user));
      } catch {
        // ignore
      }
      setIsLoading(false);
      return { success: true };
    }
    setIsLoading(false);
    return { success: false, error: result.error || 'Failed to authenticate.' };
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    await authService.signOut();
    setCurrentUser(null);
    setUserProfile(null);
    try {
      sessionStorage.setItem('campus_life_logged_out', 'true');
      sessionStorage.removeItem('campus_life_session');
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  const checkEmailAuthorization = async (email: string): Promise<EmailCheckResult> => {
    return authService.checkEmailAuthorization(email);
  };

  const initiateFirstTimeActivation = async (email: string): Promise<{ success: boolean; message?: string }> => {
    return authService.initiateFirstTimeActivation(email);
  };

  const checkEmailVerified = async (email?: string): Promise<boolean> => {
    return authService.checkEmailVerified(currentUser, email || userProfile?.email);
  };

  const completePasswordSetup = async (password: string, email: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const activeAuthUser = currentUser || (isFirebaseConfigured && auth ? auth.currentUser : null);
    const result = await authService.completePasswordSetup(email, password, activeAuthUser);
    if (result.success && result.user) {
      setUserProfile(result.user);
      if (activeAuthUser) {
        setCurrentUser(activeAuthUser);
      }
      try {
        sessionStorage.setItem('campus_life_session', JSON.stringify(result.user));
      } catch {
        // ignore
      }
      setIsLoading(false);
      return { success: true };
    }
    setIsLoading(false);
    return { success: false, error: result.error || 'Failed to set up password.' };
  };

  const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    return authService.sendPasswordResetEmail(email);
  };

  const refreshProfile = async (): Promise<void> => {
    if (userProfile?.email) {
      const updated = await loadProfile(userProfile.email, currentUser?.uid);
      if (updated) {
        setUserProfile(updated);
      }
    }
  };

  const role: UserRole | null = userProfile?.role || null;
  const permissions: UserPermission[] = userProfile?.permissions || [];
  const isAuthenticated = Boolean(userProfile && userProfile.isActive);
  const isActivated = Boolean(userProfile?.isActivated);
  const emailVerified = Boolean(currentUser?.emailVerified || userProfile?.emailVerified);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        role,
        permissions,
        isLoading,
        isAuthenticated,
        isActivated,
        emailVerified,
        login,
        logout,
        checkEmailAuthorization,
        initiateFirstTimeActivation,
        checkEmailVerified,
        completePasswordSetup,
        sendPasswordReset,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
