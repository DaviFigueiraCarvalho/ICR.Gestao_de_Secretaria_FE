import { useEffect, useMemo, useState } from 'react';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { useICRApi, type Church, type DashboardNational, type Federation } from './useICRApi';
import { getScopeLevel } from '../lib/scope-access';
import { settledValue } from '@/lib/utils';

export type DashboardScopeType = 'national' | 'federation' | 'area' | 'church';

type AsyncResource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type DashboardEndpointSet = {
  dashboard: string;
  classes: string;
  roles: string;
  areaBackendNote?: string;
};

type NumberLike = number | string | undefined | null;

const toNumber = (value: NumberLike): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const formatError = (reason: unknown, fallback: string): string => {
  if (reason instanceof Error) return reason.message;
  return fallback;
};

const createResource = <T,>(loading = false): AsyncResource<T> => ({
  data: null,
  loading,
  error: null,
});

function resolveDashboardEndpoints(
  scopeType: DashboardScopeType,
  federationId?: number,
  churchId?: number,
): DashboardEndpointSet | null {
  switch (scopeType) {
    case 'national':
      return {
        dashboard: '/api/v1/dashboard/national',
        classes: '/api/v1/dashboard/classes/national',
        roles: '/api/v1/dashboard/member-roles/national',
      };
    case 'federation':
      if (typeof federationId !== 'number') return null;
      return {
        dashboard: `/api/v1/dashboard/federation/${federationId}`,
        classes: `/api/v1/dashboard/classes/federation/${federationId}`,
        roles: `/api/v1/dashboard/member-roles/federation/${federationId}`,
      };
    case 'area':
      if (typeof federationId !== 'number') return null;
      return {
        dashboard: `/api/v1/dashboard/federation/${federationId}`,
        classes: `/api/v1/dashboard/classes/federation/${federationId}`,
        roles: `/api/v1/dashboard/member-roles/federation/${federationId}`,
        // TODO: when the backend exposes area-specific dashboard routes, map this view to them.
        areaBackendNote: 'A visão de área ainda reutiliza os endpoints de federação no backend atual.',
      };
    case 'church':
      if (typeof churchId !== 'number') return null;
      return {
        dashboard: `/api/v1/dashboard/church/${churchId}`,
        classes: `/api/v1/dashboard/classes/church/${churchId}`,
        roles: `/api/v1/dashboard/member-roles/church/${churchId}`,
      };
    default:
      return null;
  }
}

export function useDashboardScope() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const scopeLevel = getScopeLevel(user?.scope, user?.username);

  const [selectedScopeType, setSelectedScopeType] = useState<DashboardScopeType>('national');
  const [selectedFederationId, setSelectedFederationId] = useState<number | undefined>(undefined);
  const [selectedChurchId, setSelectedChurchId] = useState<number | undefined>(undefined);

  const [dashboard, setDashboard] = useState<AsyncResource<DashboardNational>>(createResource(true));
  const [classesData, setClassesData] = useState<AsyncResource<unknown>>(createResource(true));
  const [rolesData, setRolesData] = useState<AsyncResource<unknown>>(createResource(true));
  const [federations, setFederations] = useState<Federation[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [scopeNote, setScopeNote] = useState<string | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(false);

  useEffect(() => {
    if (scopeLevel === 'local') {
      setSelectedScopeType('church');
      setSelectedFederationId(undefined);
      setSelectedChurchId(toNumber(user?.churchId));
      return;
    }

    if (scopeLevel === 'federated') {
      setSelectedScopeType('area');
      setSelectedFederationId(toNumber(user?.federationId));
      setSelectedChurchId(undefined);
      return;
    }

    setSelectedScopeType('national');
    setSelectedFederationId(undefined);
    setSelectedChurchId(undefined);
  }, [scopeLevel, user?.churchId, user?.federationId]);

  useEffect(() => {
    let cancelled = false;

    const loadFilters = async () => {
      setFiltersLoading(true);

      try {
        if (scopeLevel === 'local') {
          if (!cancelled) {
            setFederations([]);
            setChurches([]);
          }
          return;
        }

        if (scopeLevel === 'federated') {
          const scopedFederationId = toNumber(user?.federationId);
          const [federationsResult, churchesResult] = await Promise.allSettled([
            fetchApi<Federation[]>('/api/federations'),
            scopedFederationId
              ? fetchApi<Church[]>(`/api/churches/federation/${scopedFederationId}`)
              : Promise.resolve([] as Church[]),
          ]);

          if (cancelled) return;
          setFederations(settledValue(federationsResult) ?? []);
          setChurches(settledValue(churchesResult) ?? []);
          return;
        }

        const [federationsResult, churchesResult] = await Promise.allSettled([
          fetchApi<Federation[]>('/api/federations'),
          fetchApi<Church[]>('/api/churches'),
        ]);

        if (cancelled) return;

        setFederations(settledValue(federationsResult) ?? []);
        setChurches(settledValue(churchesResult) ?? []);
      } catch {
        if (cancelled) return;
        setFederations([]);
        setChurches([]);
      } finally {
        if (!cancelled) {
          setFiltersLoading(false);
        }
      }
    };

    loadFilters();

    return () => {
      cancelled = true;
    };
  }, [fetchApi, scopeLevel, user?.federationId]);

  const federationOptions = useMemo(
    () => federations
      .map((federation) => ({ id: federation.id, name: federation.name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' })),
    [federations],
  );

  const scopedChurchOptions = useMemo(() => {
    const sourceChurches = scopeLevel === 'federated'
      ? churches
      : selectedFederationId
        ? churches.filter((church) => church.federationId === selectedFederationId)
        : churches;

    return sourceChurches
      .map((church) => ({ id: church.id, name: church.name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }));
  }, [churches, scopeLevel, selectedFederationId]);

  useEffect(() => {
    if (selectedScopeType !== 'church') {
      setSelectedChurchId(undefined);
      return;
    }

    if (typeof selectedChurchId !== 'number') return;

    // Para usuários locais, não validar se a igreja está na lista de opções
    // pois a lista pode estar vazia (filtros não carregados para escopo local)
    if (scopeLevel === 'local') return;

    const isStillVisible = scopedChurchOptions.some((church) => church.id === selectedChurchId);
    if (!isStillVisible) {
      setSelectedChurchId(undefined);
    }
  }, [scopedChurchOptions, selectedChurchId, selectedScopeType, scopeLevel]);

  const selectedScopeLabel = useMemo(() => {
    if (selectedScopeType === 'national') return 'Nacional';
    if (selectedScopeType === 'federation') return 'Federação';
    if (selectedScopeType === 'area') return 'Área';
    return 'Igreja';
  }, [selectedScopeType]);

  const selectedFederationLabel = useMemo(() => {
    if (typeof selectedFederationId !== 'number') return null;
    return federationOptions.find((item) => item.id === selectedFederationId)?.name ?? `Área ${selectedFederationId}`;
  }, [federationOptions, selectedFederationId]);

  const selectedChurchLabel = useMemo(() => {
    if (typeof selectedChurchId !== 'number') return null;
    return scopedChurchOptions.find((item) => item.id === selectedChurchId)?.name ?? `Igreja ${selectedChurchId}`;
  }, [scopedChurchOptions, selectedChurchId]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentView = async () => {
      const endpoints = resolveDashboardEndpoints(
        selectedScopeType,
        selectedFederationId,
        selectedChurchId,
      );

      if (!endpoints) {
        if (!cancelled) {
          setDashboard(createResource(false));
          setClassesData(createResource(false));
          setRolesData(createResource(false));
          setScopeNote(null);
        }
        return;
      }

      if (!cancelled) {
        setDashboard(createResource(true));
        setClassesData(createResource(true));
        setRolesData(createResource(true));
        setScopeNote(endpoints.areaBackendNote ?? null);
      }

      console.log('🔍 [Dashboard] Loading dashboard:', {
        scopeLevel,
        selectedScopeType,
        selectedChurchId,
        selectedFederationId,
        endpoint: endpoints.dashboard,
      });

      const [dashboardResult, classesResult, rolesResult] = await Promise.allSettled([
        fetchApi<DashboardNational>(endpoints.dashboard),
        fetchApi<unknown>(endpoints.classes),
        fetchApi<unknown>(endpoints.roles),
      ]);

      if (cancelled) return;

      const dashboardData = settledValue(dashboardResult);
      
      console.log('🔍 [Dashboard] Response received:', {
        scopeLevel,
        selectedScopeType,
        selectedChurchId,
        endpoint: endpoints.dashboard,
        status: dashboardResult.status,
        data: dashboardData,
        keys: dashboardData ? Object.keys(dashboardData) : [],
      });

      setDashboard({
        data: dashboardData ?? null,
        loading: false,
        error: dashboardResult.status === 'rejected'
          ? formatError(dashboardResult.reason, 'Erro ao carregar dashboard')
          : null,
      });
      setClassesData({
        data: settledValue(classesResult) ?? null,
        loading: false,
        error: classesResult.status === 'rejected'
          ? formatError(classesResult.reason, 'Erro ao carregar classes')
          : null,
      });
      setRolesData({
        data: settledValue(rolesResult) ?? null,
        loading: false,
        error: rolesResult.status === 'rejected'
          ? formatError(rolesResult.reason, 'Erro ao carregar funções')
          : null,
      });
    };

    loadCurrentView();

    return () => {
      cancelled = true;
    };
  }, [fetchApi, selectedChurchId, selectedFederationId, selectedScopeType]);

  const scopeOptions = useMemo(() => {
    if (scopeLevel === 'local') return [];
    if (scopeLevel === 'federated') {
      return [
        { value: 'area' as const, label: 'Área' },
        { value: 'church' as const, label: 'Igreja' },
      ];
    }

    return [
      { value: 'national' as const, label: 'Nacional' },
      { value: 'area' as const, label: 'Área' },
      { value: 'church' as const, label: 'Igreja' },
    ];
  }, [scopeLevel]);

  const isViewReady = useMemo(() => {
    if (scopeLevel === 'local') {
      return typeof toNumber(user?.churchId) === 'number';
    }

    if (selectedScopeType === 'national') return true;

    if (selectedScopeType === 'federation' || selectedScopeType === 'area') {
      return typeof selectedFederationId === 'number';
    }

    return typeof selectedChurchId === 'number';
  }, [scopeLevel, selectedChurchId, selectedFederationId, selectedScopeType, user?.churchId]);

  const isLoading = dashboard.loading || classesData.loading || rolesData.loading || filtersLoading;

  return {
    scopeLevel,
    selectedScopeType,
    setSelectedScopeType,
    selectedFederationId,
    setSelectedFederationId,
    selectedChurchId,
    setSelectedChurchId,
    federationOptions,
    churchOptions: scopedChurchOptions,
    scopeOptions,
    dashboard,
    classesData,
    rolesData,
    selectedScopeLabel,
    selectedFederationLabel,
    selectedChurchLabel,
    scopeNote,
    isViewReady,
    isLoading,
    userChurchId: toNumber(user?.churchId),
    userFederationId: toNumber(user?.federationId),
  };
}

// Temporary debug function - remove after investigation
export const debugDashboard = () => {
  console.log('🔍 [Dashboard Debug] Temporary investigation logs');
  console.log('Check the console for dashboard response data');
};
