import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE } from '../lib/api-config';

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
      // Chama o proxy local — o Express encaminha para ICR_API_URL/api/v1/auth/login
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.detail || errData?.message || 'Credenciais inválidas');
      }

      const data = await response.json();

      // Se a API colocar token no header Authorization, usa isso primeiro
      const headerAuth = response.headers.get('authorization') || response.headers.get('Authorization');
      const headerToken = headerAuth ? headerAuth.replace(/^Bearer\s+/i, '') : undefined;

      // Suporte a diferentes formatos de resposta da API
      let rawToken =
        headerToken ||
        data?.token ||
        data?.accessToken ||
        data?.access_token ||
        data?.jwt ||
        data?.authToken ||
        data?.data?.token ||
        data?.data?.accessToken ||
        data?.data?.access_token ||
        data;

      // Se retornar string com Bearer, remove prefixo
      if (typeof rawToken === 'string' && rawToken.match(/^Bearer\s+/i)) {
        rawToken = rawToken.replace(/^Bearer\s+/i, '');
      }

      if (!rawToken || typeof rawToken !== 'string') {
        throw new Error('Token de autenticação inválido recebido da API.');
      }

      const authToken = rawToken;

      const userData = data?.user || data?.data || data;
      const userInfo: ICRUser = {
        id: userData?.id || 0,
        username: username,
        memberName: userData?.memberName || userData?.name || username,
        scope: userData?.scope || 'user',
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
