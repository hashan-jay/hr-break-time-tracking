import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('hr_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('hr_token'));
  const [loading, setLoading] = useState(() => !!localStorage.getItem('hr_token'));

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) {
          setUser(data);
          localStorage.setItem('hr_user', JSON.stringify(data));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('hr_token');
          localStorage.removeItem('hr_user');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (userName, password) => {
    const { data } = await api.post('/auth/login', { userName, password });
    localStorage.setItem('hr_token', data.token);
    localStorage.setItem('hr_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('hr_token');
    localStorage.removeItem('hr_user');
    setToken(null);
    setUser(null);
  };

  const roles = user?.roles || [];
  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      roles,
      isAuthenticated: !!token && !!user,
      isDeveloper: roles.includes('Developer'),
      isHRManager: roles.includes('HRManager'),
      isHRAssistant: roles.includes('HRAssistant'),
      canManageMasterData: roles.includes('Developer') || roles.includes('HRManager'),
      canTrackBreaks: roles.includes('Developer') || roles.includes('HRManager') || roles.includes('HRAssistant'),
    }),
    [user, token, loading, roles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
