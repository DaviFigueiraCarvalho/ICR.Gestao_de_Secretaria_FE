export type ScopeLevel = 'local' | 'federated' | 'federation';

import type { Church, Family, Federation, Member, Minister } from '../hooks/useICRApi';

export const buildLocalChurchFallback = (churchId?: number): Church[] => {
  if (typeof churchId !== 'number') return [];

  return [{ id: churchId, name: `Igreja vinculada (ID ${churchId})`, federationId: 0 } as Church];
};

export const normalizeScopeValue = (scopeValue: unknown): string => {
  if (typeof scopeValue === 'string') return scopeValue;
  if (typeof scopeValue === 'number' || typeof scopeValue === 'boolean') return String(scopeValue);

  if (scopeValue && typeof scopeValue === 'object') {
    const record = scopeValue as Record<string, unknown>;
    const candidate =
      record.scope ??
      record.name ??
      record.value ??
      record.role ??
      record.description;

    if (typeof candidate === 'string') return candidate;
    if (typeof candidate === 'number' || typeof candidate === 'boolean') return String(candidate);
  }

  return '';
};

export const getScopeLevel = (scopeValue: unknown, username?: string): ScopeLevel => {
  const normalized = normalizeScopeValue(scopeValue).trim().toLowerCase();
  const normalizedUsername = (username || '').trim().toLowerCase();

  // UserScope enum from API: 0=local, 1=federated, 2=federation
  if (/^\d+$/.test(normalized)) {
    const numericScope = Number(normalized);
    if (numericScope >= 2) return 'federation';
    if (numericScope === 1) return 'federated';
    return 'local';
  }

  if (
    normalizedUsername === 'root' ||
    normalizedUsername === 'admin' ||
    normalizedUsername === 'administrator'
  ) {
    return 'federation';
  }

  if (
    normalized.includes('federation') &&
    !normalized.includes('federated')
  ) {
    return 'federation';
  }

  if (
    normalized.includes('root') ||
    normalized.includes('admin') ||
    normalized.includes('superuser') ||
    normalized.includes('super user')
  ) {
    return 'federation';
  }

  if (
    normalized.includes('comissao') ||
    normalized.includes('comissão') ||
    normalized.includes('federated') ||
    normalized.includes('federada')
  ) {
    return 'federated';
  }

  return 'local';
};

const FEDERATION_ONLY_PATHS = new Set([
  '/federations',
  '/repasses',
  '/users',
  '/ministers',
  '/ministers-insurance',
  '/ministers-dates',
  '/minister-registration-pendencies',
]);

export const canAccessPathByScope = (scopeLevel: ScopeLevel, path: string): boolean => {
  if (scopeLevel === 'federation') return true;

  if (FEDERATION_ONLY_PATHS.has(path)) {
    return false;
  }

  if (path === '/churches') {
    return scopeLevel === 'federated';
  }

  return true;
};

interface ScopeRestrictionParams {
  scopeLevel: ScopeLevel;
  userMemberId?: number;
  userFamilyId?: number;
  userChurchId?: number;
  userFederationId?: number;
  churches: Church[];
  federations: Federation[];
  members?: Member[];
  families?: Family[];
  ministers?: Minister[];
}

interface ScopeRestrictionResult {
  lockedFederationId?: number;
  lockedChurchId?: number;
  allowedChurchIds: number[];
}

export const resolveScopeRestrictions = ({
  scopeLevel,
  userMemberId,
  userFamilyId,
  userChurchId,
  userFederationId,
  churches,
  federations,
  members = [],
  families = [],
  ministers = [],
}: ScopeRestrictionParams): ScopeRestrictionResult => {
  if (scopeLevel === 'federation') {
    return {
      allowedChurchIds: churches.map((church) => church.id),
    };
  }

  if (scopeLevel === 'federated') {
    let lockedFederationId: number | undefined = userFederationId;

    if (typeof lockedFederationId !== 'number' && typeof userMemberId === 'number') {
      const minister = ministers.find((item) => item.memberId === userMemberId);
      if (minister?.id) {
        lockedFederationId = federations.find((federation) => federation.ministerId === minister.id)?.id;
      }
    }

    const allowedChurchIds = typeof lockedFederationId === 'number'
      ? churches.filter((church) => church.federationId === lockedFederationId).map((church) => church.id)
      : [];

    return {
      lockedFederationId,
      allowedChurchIds,
    };
  }

  let lockedChurchId: number | undefined;

  if (typeof userChurchId === 'number') {
    lockedChurchId = userChurchId;
  }

  if (typeof lockedChurchId !== 'number' && typeof userFamilyId === 'number') {
    lockedChurchId = families.find((family) => family.id === userFamilyId)?.churchId;
  }

  if (typeof lockedChurchId !== 'number' && typeof userMemberId === 'number') {
    const currentMember = members.find((member) => member.id === userMemberId);
    if (currentMember?.familyId) {
      lockedChurchId = families.find((family) => family.id === currentMember.familyId)?.churchId;
    }
  }

  return {
    lockedChurchId,
    allowedChurchIds: typeof lockedChurchId === 'number' ? [lockedChurchId] : [],
  };
};
