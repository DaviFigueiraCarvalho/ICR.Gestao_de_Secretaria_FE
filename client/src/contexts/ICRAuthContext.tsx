import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE = 'https://tools-verse-protective-lip.trycloudflare.com';

interface ICRUser {
  id: number;
  username: string;
  memberName: string;
  scope: string;
}

interface ICRAuthContextType {
  user: ICRUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const ICRAuthContext = createContext<ICRAuthContextType | null>(null);

export function ICRAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ICRUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('icr_token');
    const savedUser = localStorage.getItem('icr_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Credenciais inválidas');
      }

      const data = await response.json();
      const authToken = data.token || data.accessToken || data;
      
      // Try to get user info
      const userInfo: ICRUser = {
        id: data.id || 0,
        username: username,
        memberName: data.memberName || data.name || username,
        scope: data.scope || 'user',
      };

      setToken(authToken);
      setUser(userInfo);
      localStorage.setItem('icr_token', authToken);
      localStorage.setItem('icr_user', JSON.stringify(userInfo));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('icr_token');
    localStorage.removeItem('icr_user');
  };

  return (
    <ICRAuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      isLoading,
      login,
      logout,
      error,
    }}>
      {children}
    </ICRAuthContext.Provider>
  );
}

export function useICRAuth() {
  const ctx = useContext(ICRAuthContext);
  if (!ctx) throw new Error('useICRAuth must be used within ICRAuthProvider');
  return ctx;
}

export { API_BASE };
