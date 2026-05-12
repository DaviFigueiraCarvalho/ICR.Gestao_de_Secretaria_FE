import { useCallback } from 'react';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { API_BASE } from '../lib/api-config';

/**
 * Hook para chamadas autenticadas à API ICR.
 *
 * Todas as requisições passam pelo proxy Express local (/api/icr/*).
 * O servidor encaminha para o container ICR definido por ICR_API_URL.
 *
 * Uso:
 *   const { fetchApi } = useICRApi();
 *   const data = await fetchApi<Federation[]>('/api/federations');
 */
function normalizeApiPath(path: string): string {
  if (!path || path === '/') return '/';
  
  // Normalize query parameters: pageSize → size
  let normalized = path.replace(/([?&])pageSize=(\d+)/g, '$1size=$2');
  
  // Ensure path starts with '/'
  return normalized.startsWith('/') ? normalized : '/' + normalized;
}

export function useICRApi() {
  const { token, logout } = useICRAuth();

  const fetchApi = useCallback(async <T>(path: string, options?: RequestInit): Promise<T> => {
    const normalizedPath = normalizeApiPath(path);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Chama sempre o proxy local — nunca a URL externa diretamente
    const response = await fetch(`${API_BASE}${normalizedPath}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      logout();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (response.status === 403) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.detail ||
        errData.message ||
        'Acesso negado (403). Você não tem permissão para este recurso.',
      );
    }

    if (response.status === 503) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'API ICR indisponível. Verifique a variável ICR_API_URL.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.detail || `Erro ${response.status}`);
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }, [logout, token]);

  return { fetchApi };
}

// ─── Tipos da API ICR ────────────────────────────────────────────────────────

export interface Federation {
  id: number;
  name: string;
  ministerId: number;
  ministerName: string;
  resultMessage?: string;
}

export interface Church {
  id: number;
  name: string;
  address?: {
    countryCode?: string;
    postalCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    city?: string;
    state?: string;
    countyOrRegion?: string;
  };
  federationId: number;
  federationName?: string;
  ministerId?: number;
  ministerName?: string;
}

export interface Cell {
  id: number;
  name: string;
  type?: number | string;
  typeName?: string;
  churchId: number;
  church?: Church;
  responsibleId?: number;
  responsible?: Member;
}

export interface Family {
  id: number;
  name: string;
  cellId?: number;
  cellName?: string;
  churchId: number;
  churchName?: string;
  manId?: number;
  manName?: string;
  womanId?: number;
  womanName?: string;
  weddingDate?: string;
}

export interface Member {
  id: number;
  name: string;
  role?: number | string;
  roleName?: string;
  familyId?: number;
  familyName?: string;
  familyChurchName?: string;
  familyCellName?: string;
  birthDate?: string;
  hasBeenMarried?: boolean;
  spouseName?: string;
  weddingDate?: string;
  gender?: number | string;
  genderName?: string;
  class?: string;
  className?: string;
  cellPhone?: {
    countryCode?: string;
    countryName?: string;
    number?: string;
    displayFormat?: string;
    internationalFormat?: string;
    e164Format?: string;
    isMobileNumber?: boolean;
  };
}

export interface Minister {
  id: number;
  memberId: number;
  memberName?: string;
  churchMemberName?: string;
  federationMemberName?: string;
  memberBirthday?: string;
  memberPhone?: {
    countryCode?: string;
    countryName?: string;
    number?: string;
    displayFormat?: string;
    internationalFormat?: string;
    e164Format?: string;
    isMobileNumber?: boolean;
  };
  memberWifeName?: string;
  memberWeddingDate?: string;
  cpf?: string;
  email?: string;
  cardValidity?: string;
  presbiterOrdinationDate?: string;
  ministerOrdinationDate?: string;
  member?: Member;
  insured?: boolean;
  eligible?: boolean;
  isInsured?: boolean;
  isEligible?: boolean;
  segurado?: boolean;
  coverageStatus?: string;
  insuranceStatus?: string;
  status?: string;
  address?: {
    countryCode?: string;
    postalCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    city?: string;
    state?: string;
    countyOrRegion?: string;
  };
}

export interface Repass {
  id: number;
  churchId: number;
  churchName?: string;
  reference: number;
  referenceName?: string;
  amount: number;
  resultMessage?: string;
}

export interface Reference {
  id: number;
  name: string;
  competenceDate: string;
  createdAt: string;
}

export interface DashboardNational {
  totalFederations?: number;
  totalChurches?: number;
  totalMissionaryCommunities?: number;
  totalFamilies?: number;
  totalCells?: number;
  totalMembers?: number;
  totalMinisters?: number;
  totalCoveredMinisters?: number;
  totalUncoveredMinisters?: number;
  federations?: Array<{
    id: number;
    name: string;
    churches?: number;
    missionaryCommunities?: number;
    families?: number;
    cells?: number;
    members?: number;
  }>;
  localFamilies?: number;
  localCells?: number;
  localMembers?: number;
}
