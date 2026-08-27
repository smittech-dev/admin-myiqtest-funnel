import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCurrentAdmin, login, logout } from '@/lib/api';
import { clearToken, getToken, setUnauthorizedHandler } from '@/lib/http';
import type { AdminUser } from '@/types';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  // Start in "checking" state whenever a token is on disk, so protected routes
  // wait instead of bouncing a signed-in operator to /login on every reload.
  const [initializing, setInitializing] = useState(() => getToken() !== null);

  const signOut = useCallback(() => {
    void logout();
    setUser(null);
  }, []);

  // Any request that comes back 401 — expired token, deactivated account —
  // drops the session here so the router sends the operator to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setUser(null);
      setInitializing(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Restore the session by asking the backend who the stored token belongs to.
  useEffect(() => {
    if (getToken() === null) return;

    let active = true;
    fetchCurrentAdmin()
      .then((admin) => {
        if (active) setUser(admin);
      })
      .catch(() => {
        // Rejected token, or the backend is down. Either way there is no
        // session to restore; the 401 handler has already cleared the token.
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setInitializing(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await login(email, password);
    setUser(result.user);
    setInitializing(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, initializing, signIn, signOut }),
    [user, initializing, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
