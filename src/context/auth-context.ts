import { createContext, useContext } from 'react';
import type { AdminUser } from '@/types';

export interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  /** True until the stored token has been checked against the backend. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
