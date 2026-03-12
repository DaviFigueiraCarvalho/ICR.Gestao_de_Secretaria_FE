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
export function useICRApi() {
  const { token, logout } = useICRAuth();

  const fetchApi = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Chama sempre o proxy local — nunca a URL externa diretamente
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      logout();
      throw new Error('Sessão expirada. Faça login novamente.');
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
  };

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
    zipCode?: string;
    street?: string;
    number?: string;
    city?: string;
    state?: string;
  };
  federationId: number;
  federationName?: string;
  ministerId?: number;
  ministerName?: string;
}

export interface Cell {
  id: number;
  name: string;
  type?: string;
  churchId: number;
  church?: Church;
  responsibleId?: number;
  responsible?: Member;
}

export interface Family {
  id: number;
  name: string;
  cellId?: number;
  cell?: Cell;
  churchId: number;
  church?: Church;
  manId?: number;
  man?: Member;
  womanId?: number;
  woman?: Member;
  weddingDate?: string;
}

export interface Member {
  id: number;
  name: string;
  role?: string;
  roleName?: string;
  familyId?: number;
  familyName?: string;
  familyChurchName?: string;
  familyCellName?: string;
  birthDate?: string;
  hasBeenMarried?: boolean;
  spouseName?: string;
  weddingDate?: string;
  gender?: string;
  genderName?: string;
  class?: string;
  className?: string;
  cellPhone?: string;
}

export interface Minister {
  id: number;
  memberId: number;
  memberName?: string;
  churchMemberName?: string;
  federationMemberName?: string;
  memberBirthday?: string;
  memberWifeName?: string;
  memberWeddingDate?: string;
  cpf?: string;
  email?: string;
  cardValidity?: string;
  presbiterOrdinationDate?: string;
  ministerOrdinationDate?: string;
  address?: {
    zipCode?: string;
    street?: string;
    number?: string;
    city?: string;
    state?: string;
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
