import { createContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserRecord, UserRole, UserPermission } from '../types';
import type { EmailCheckResult } from '../firebase/authService';

export interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserRecord | null;
  role: UserRole | null;
  permissions: UserPermission[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isActivated: boolean;
  emailVerified: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkEmailAuthorization: (email: string) => Promise<EmailCheckResult>;
  initiateFirstTimeActivation: (email: string) => Promise<{ success: boolean; message?: string }>;
  checkEmailVerified: (email?: string) => Promise<boolean>;
  completePasswordSetup: (password: string, email: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
