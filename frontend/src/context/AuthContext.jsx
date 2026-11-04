import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from '../services/api';

// Customer authentication (JWT). The token is kept in sessionStorage so it disappears when the tab is closed.
// This is separate from the shopping bag / favorites, which keep working for guests.
const TOKEN_KEY = 'velora:token';
const AuthContext = createContext(null);

const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(readToken()));

  const accept = useCallback((data) => { writeToken(data.token); setToken(data.token); setUser(data.user); return data.user; }, []);
  const logout = useCallback(() => { writeToken(null); setToken(null); setUser(null); }, []);

  // Restore the session after a page refresh.
  useEffect(() => {
    if (!token || user) { setChecking(false); return undefined; }
    const controller = new AbortController();
    request('/auth/me', { token, signal: controller.signal })
      .then((res) => setUser(res.data.user))
      .catch((err) => { if (err.name !== 'AbortError') logout(); })
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, [token, user, logout]);

  const login = useCallback(async (email, password) => accept((await request('/auth/login', { method: 'POST', body: { email, password } })).data), [accept]);
  const register = useCallback(async (name, email, password) => accept((await request('/auth/register', { method: 'POST', body: { name, email, password } })).data), [accept]);
  const exchangeCode = useCallback(async (code) => accept((await request('/auth/oauth/exchange', { method: 'POST', body: { code } })).data), [accept]);

  const value = useMemo(() => ({ user, token, checking, login, register, logout, exchangeCode }), [user, token, checking, login, register, logout, exchangeCode]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
