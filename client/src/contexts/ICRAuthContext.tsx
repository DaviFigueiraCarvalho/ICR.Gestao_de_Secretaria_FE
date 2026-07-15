import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE } from '../lib/api-config';

interface ICRUser {
  id: number;
  memberId?: number;
  familyId?: number;
  churchId?: number;
  federationId?: number;
  username: string;
  memberName: string;
  scope: unknown;
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

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
};

const parseNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
};

const parseIdFromValue = (value: unknown): number | undefined => {
  const direct = parseNumberOrUndefined(value);
  if (typeof direct === 'number') return direct;

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      parseNumberOrUndefined(record.id) ??
      parseNumberOrUndefined(record.value) ??
      parseNumberOrUndefined(record.code)
    );
  }

  return undefined;
};

const parseIdFromRecord = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const parsed = parseIdFromValue(record[key]);
    if (typeof parsed === 'number') return parsed;
  }
  return undefined;
};

const parseStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const extractUserFromLoginResponse = (payload: unknown, fallbackUsername: string): ICRUser => {
  const root = toRecord(payload);
  const dataNode = toRecord(root.data);
  const nestedUser = toRecord(root.user);
  const nestedDataUser = toRecord(dataNode.user);

  const userData =
    Object.keys(nestedUser).length > 0 ? nestedUser
      : Object.keys(nestedDataUser).length > 0 ? nestedDataUser
        : Object.keys(dataNode).length > 0 ? dataNode
          : root;

  const userId = parseNumberOrUndefined(userData.id) ?? parseNumberOrUndefined(userData.userId) ?? 0;
  const memberId = parseIdFromRecord(userData, ['memberId', 'memberID', 'member_id', 'idMember', 'member']);
  const familyId = parseIdFromRecord(userData, ['familyId', 'familyID', 'family_id', 'family']);
  const churchId = parseIdFromRecord(userData, ['churchId', 'churchID', 'church_id', 'church']);
  const federationId = parseIdFromRecord(userData, ['federationId', 'federationID', 'federation_id', 'federation']);

  const username =
    (typeof userData.username === 'string' && userData.username.trim())
      ? userData.username
      : fallbackUsername;

  const memberName =
    (typeof userData.memberName === 'string' && userData.memberName.trim())
      ? userData.memberName
      : (typeof userData.churchMemberName === 'string' && userData.churchMemberName.trim())
        ? userData.churchMemberName
        : (typeof userData.federationMemberName === 'string' && userData.federationMemberName.trim())
          ? userData.federationMemberName
          : (userData.member && typeof userData.member === 'object' && typeof (userData.member as Record<string, unknown>).name === 'string' && ((userData.member as Record<string, unknown>).name as string).trim())
            ? ((userData.member as Record<string, unknown>).name as string)
      : (typeof userData.name === 'string' && userData.name.trim())
        ? userData.name
        : username;

  const scope = userData.scope ?? userData.userScope ?? userData.minimalScope ?? 'user';

  return {
    id: userId,
    memberId,
    familyId,
    churchId,
    federationId,
    username,
    memberName,
    scope,
  };
};

const extractUserPatch = (payload: unknown): Partial<ICRUser> => {
  const row = toRecord(payload);
  return {
    id: parseNumberOrUndefined(row.id) ?? parseNumberOrUndefined(row.userId),
    memberId: parseIdFromRecord(row, ['memberId', 'memberID', 'member_id', 'idMember', 'member']),
    familyId: parseIdFromRecord(row, ['familyId', 'familyID', 'family_id', 'family']),
    churchId: parseIdFromRecord(row, ['churchId', 'churchID', 'church_id', 'church']),
    federationId: parseIdFromRecord(row, ['federationId', 'federationID', 'federation_id', 'federation']),
    username: parseStringOrUndefined(row.username),
    memberName:
      parseStringOrUndefined(row.memberName) ??
      parseStringOrUndefined(row.churchMemberName) ??
      parseStringOrUndefined(row.federationMemberName),
    scope: row.scope ?? row.userScope ?? row.minimalScope,
  };
};

const enrichUserFromDirectory = async (userInfo: ICRUser, authToken: string): Promise<ICRUser> => {
  if (!userInfo.username) return userInfo;

  try {
    const response = await fetch(
      `${API_BASE}/api/user-roles/users/by-username/${encodeURIComponent(userInfo.username)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    if (!response.ok) return userInfo;

    const payload = await response.json().catch(() => null);
    const patch = extractUserPatch(payload);

    return {
      id: patch.id ?? userInfo.id,
      memberId: patch.memberId ?? userInfo.memberId,
      familyId: patch.familyId ?? userInfo.familyId,
      churchId: patch.churchId ?? userInfo.churchId,
      federationId: patch.federationId ?? userInfo.federationId,
      username: patch.username ?? userInfo.username,
      memberName: patch.memberName ?? userInfo.memberName,
      scope: patch.scope ?? userInfo.scope,
    };
  } catch {
    return userInfo;
  }
};

const enrichUserChurchContext = async (userInfo: ICRUser, authToken: string): Promise<ICRUser> => {
  if (typeof userInfo.memberId !== 'number') return userInfo;

  try {
    const memberResponse = await fetch(`${API_BASE}/api/members/${userInfo.memberId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!memberResponse.ok) return userInfo;

    const memberPayload = await memberResponse.json().catch(() => null);
    const memberRow = toRecord(memberPayload);
    const resolvedMemberName =
      parseStringOrUndefined(memberRow.name) ??
      parseStringOrUndefined(memberRow.memberName) ??
      parseStringOrUndefined(memberRow.churchMemberName) ??
      parseStringOrUndefined(memberRow.federationMemberName);
    const resolvedFamilyId =
      parseNumberOrUndefined(memberRow.familyId) ??
      parseNumberOrUndefined(memberRow.familyID) ??
      parseNumberOrUndefined(memberRow.family_id) ??
      userInfo.familyId;

    if (typeof resolvedFamilyId !== 'number') {
      return {
        ...userInfo,
        memberName:
          resolvedMemberName && (userInfo.memberName === userInfo.username || !userInfo.memberName)
            ? resolvedMemberName
            : userInfo.memberName,
        familyId: userInfo.familyId,
        churchId: userInfo.churchId,
      };
    }

    const familyResponse = await fetch(`${API_BASE}/api/families/${resolvedFamilyId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!familyResponse.ok) {
      return {
        ...userInfo,
        memberName:
          resolvedMemberName && (userInfo.memberName === userInfo.username || !userInfo.memberName)
            ? resolvedMemberName
            : userInfo.memberName,
        familyId: resolvedFamilyId,
      };
    }

    const familyPayload = await familyResponse.json().catch(() => null);
    const familyRow = toRecord(familyPayload);
    const resolvedChurchId =
      parseNumberOrUndefined(familyRow.churchId) ??
      parseNumberOrUndefined(familyRow.churchID) ??
      parseNumberOrUndefined(familyRow.church_id) ??
      userInfo.churchId;

    let resolvedFederationId = userInfo.federationId;
    if (typeof resolvedFederationId !== 'number' && typeof resolvedChurchId === 'number') {
      const churchResponse = await fetch(`${API_BASE}/api/churches/${resolvedChurchId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (churchResponse.ok) {
        const churchPayload = await churchResponse.json().catch(() => null);
        const churchRow = toRecord(churchPayload);
        resolvedFederationId = parseIdFromRecord(churchRow, ['federationId', 'federationID', 'federation_id', 'federation']) ?? resolvedFederationId;
      }
    }

    return {
      ...userInfo,
      memberName:
        resolvedMemberName && (userInfo.memberName === userInfo.username || !userInfo.memberName)
          ? resolvedMemberName
          : userInfo.memberName,
      familyId: resolvedFamilyId,
      churchId: resolvedChurchId,
      federationId: resolvedFederationId,
    };
  } catch {
    return userInfo;
  }
};

const enrichAuthenticatedUser = async (userInfo: ICRUser, authToken: string): Promise<ICRUser> => {
  const withDirectory = await enrichUserFromDirectory(userInfo, authToken);
  return enrichUserChurchContext(withDirectory, authToken);
};

export function ICRAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ICRUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('icr_token');
    const savedUser = localStorage.getItem('icr_user');
    if (!savedToken || !savedUser) {
      setIsLoading(false);
      return;
    }

    setToken(savedToken);

    try {
      const parsedUser = extractUserFromLoginResponse(JSON.parse(savedUser), 'usuario');
      setUser(parsedUser);

      enrichAuthenticatedUser(parsedUser, savedToken)
        .then((resolvedUser) => {
          setUser(resolvedUser);
          localStorage.setItem('icr_user', JSON.stringify(resolvedUser));
        })
        .finally(() => setIsLoading(false));
    } catch {
      setUser(null);
      setIsLoading(false);
    }
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

      const userInfo = extractUserFromLoginResponse(data, username);
      const enrichedUserInfo = await enrichAuthenticatedUser(userInfo, authToken);

      setToken(authToken);
      setUser(enrichedUserInfo);
      localStorage.setItem('icr_token', authToken);
      localStorage.setItem('icr_user', JSON.stringify(enrichedUserInfo));
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
