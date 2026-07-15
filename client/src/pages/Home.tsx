import { useEffect } from 'react';
import ICRLayout from '../components/ICRLayout';
import DashboardSummaryCard from '../components/DashboardSummaryCard';
import PermissionDeniedError from '../components/PermissionDeniedError';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '../contexts/ThemeContext';
import { isPermissionError } from '@/lib/utils';
import { useDashboardScope } from '../hooks/useDashboardScope';

interface DashboardSection {
  title: string;
  scopes: Array<'national' | 'federation' | 'area' | 'church'>;
  cards: Array<{ label: string; value: number | string }>;
}

const formatNumber = (value: number | string): string => {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  return value;
};

export default function Home() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const {
    scopeLevel,
    selectedScopeType,
    setSelectedScopeType,
    selectedFederationId,
    setSelectedFederationId,
    selectedChurchId,
    setSelectedChurchId,
    federationOptions,
    churchOptions,
    scopeOptions,
    dashboard,
    classesData,
    rolesData,
    selectedScopeLabel,
    scopeNote,
    isViewReady,
    isLoading,
    userChurchId,
    userFederationId,
  } = useDashboardScope();

  // Temporary debug logs - remove after investigation
  console.log('🏠 [Home] scopeLevel:', scopeLevel);
  console.log('🏠 [Home] selectedScopeType:', selectedScopeType);
  console.log('🏠 [Home] selectedChurchId:', selectedChurchId);
  console.log('🏠 [Home] dashboard data:', dashboard.data);
  console.log('🏠 [Home] dashboard keys:', dashboard.data ? Object.keys(dashboard.data) : []);

  const currentDashboard = dashboard.data;

  useEffect(() => {
    // Only apply fallbacks for non-local users
    // Local users should use the churchId/federationId from user context (set by useDashboardScope)
    if (scopeLevel === 'local') return;

    if (selectedScopeType === 'church') {
      if (typeof selectedChurchId !== 'number' && churchOptions[0]?.id) {
        setSelectedChurchId(churchOptions[0].id);
      }
      return;
    }

    if (typeof selectedFederationId === 'number') return;

    const fallbackFederationId = userFederationId ?? federationOptions[0]?.id;
    if (typeof fallbackFederationId === 'number') {
      setSelectedFederationId(fallbackFederationId);
    }
  }, [
    churchOptions,
    federationOptions,
    scopeLevel,
    selectedChurchId,
    selectedFederationId,
    selectedScopeType,
    setSelectedChurchId,
    setSelectedFederationId,
    userFederationId,
  ]);

  const handleScopeTypeChange = (value: string) => {
    const nextScopeType = value as 'national' | 'federation' | 'area' | 'church';
    setSelectedScopeType(nextScopeType);

    if (nextScopeType === 'national') {
      setSelectedFederationId(undefined);
      setSelectedChurchId(undefined);
      return;
    }

    if (nextScopeType === 'church') {
      setSelectedFederationId(undefined);
      // For local users, use userChurchId directly instead of churchOptions
      if (scopeLevel === 'local' && typeof userChurchId === 'number') {
        setSelectedChurchId(userChurchId);
      } else {
        setSelectedChurchId(churchOptions[0]?.id);
      }
      return;
    }

    setSelectedFederationId(userFederationId ?? federationOptions[0]?.id);
    setSelectedChurchId(undefined);
  };

  const handleContextFilterChange = (value: string) => {
    const nextId = value ? Number(value) : undefined;

    if (selectedScopeType === 'church') {
      const nextChurchId = Number.isFinite(nextId ?? Number.NaN) ? nextId : undefined;
      setSelectedChurchId(nextChurchId);
      return;
    }

    const nextFederationId = Number.isFinite(nextId ?? Number.NaN) ? nextId : undefined;
    setSelectedFederationId(nextFederationId);
    setSelectedChurchId(undefined);
  };

  const sections: DashboardSection[] = [
    {
      scopes: ['national'],
      title: 'Areas, Igrejas e Comunidades Missionárias',
      cards: [
        { label: 'Total de Áreas', value: currentDashboard?.totalFederations ?? 0 },
        { label: 'Igrejas', value: currentDashboard?.totalChurches ?? 0 },
        { label: 'Comunidades Missionárias', value: currentDashboard?.totalMissionaryCommunities ?? 0 },
      ],
    },
    {
      scopes: ['federation', 'area'],
      title: 'Igrejas e Comunidades Missionárias por Área',
      cards: [
        { label: 'Igrejas', value: currentDashboard?.totalChurches ?? 0 },
        { label: 'Comunidades Missionárias', value: currentDashboard?.totalMissionaryCommunities ?? 0 },
      ],
    },
    {
      scopes: ['national'],
      title: 'Familias Células e Membros Totais',
      cards: [
        { label: 'Famílias', value: currentDashboard?.totalFamilies ?? 0 },
        { label: 'Células', value: currentDashboard?.totalCells ?? 0 },
        { label: 'Membros', value: currentDashboard?.totalMembers ?? 0 },
      ],
    },
    {
      scopes: ['federation', 'area'],
      title: 'Familias Células e Membros Por Área',
      cards: [
        { label: 'Famílias', value: currentDashboard?.totalFamilies ?? 0 },
        { label: 'Células', value: currentDashboard?.totalCells ?? 0 },
        { label: 'Membros', value: currentDashboard?.totalMembers ?? 0 },
      ],
    },
    {
      scopes: ['church'],
      title: 'Familias Células e Membros Locais',
      cards: [
        { 
          label: 'Famílias', 
          value: currentDashboard?.localFamilies ?? currentDashboard?.totalFamilies ?? 0 
        },
        { 
          label: 'Células', 
          value: currentDashboard?.localCells ?? currentDashboard?.totalCells ?? 0 
        },
        { 
          label: 'Membros', 
          value: currentDashboard?.localMembers ?? currentDashboard?.totalMembers ?? 0 
        },
      ],
    },
  ];

  const visibleSections = sections.filter((section) => section.scopes.includes(selectedScopeType));
  const hasLoadedContent = Boolean(currentDashboard || classesData.data || rolesData.data);

  if (isLoading && !hasLoadedContent) {
    return (
      <ICRLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <span className="material-icons animate-spin text-[#017158] text-4xl">refresh</span>
            <p className="text-white/60 font-['Nunito']">Carregando dashboard...</p>
          </div>
        </div>
      </ICRLayout>
    );
  }

  if (dashboard.error && !currentDashboard) {
    if (isPermissionError(new Error(dashboard.error))) {
      return (
        <ICRLayout>
          <PermissionDeniedError message={dashboard.error} />
        </ICRLayout>
      );
    }

    return (
      <ICRLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="material-icons text-red-400 text-4xl">error_outline</span>
            <p className="text-white/60 font-['Nunito']">{dashboard.error}</p>
            <p className="text-white/40 text-sm font-['Nunito']">Verifique sua conexão com a API</p>
          </div>
        </div>
      </ICRLayout>
    );
  }

  const showViewPrompt = !isViewReady && !isLoading;
  const contextFilterOptions = selectedScopeType === 'church' ? churchOptions : federationOptions;
  const contextFilterLabel = selectedScopeType === 'church' ? 'Igreja' : 'Área';
  const contextFilterValue = selectedScopeType === 'church'
    ? (selectedChurchId?.toString() ?? churchOptions[0]?.id?.toString() ?? '')
    : (selectedFederationId?.toString() ?? userFederationId?.toString() ?? federationOptions[0]?.id?.toString() ?? '');

  return (
    <ICRLayout>
      <div className="space-y-6">
        <div className={`${isLight ? 'bg-white border border-[#cfe4dc] shadow-[0_8px_24px_rgba(1,113,88,0.08)]' : 'bg-[#2b2b2b]'} rounded-[33px] px-6 py-5 text-center`}>
          <h2 className={`${isLight ? 'text-[#0f5f4d]' : 'text-white'} text-2xl font-['Nunito'] font-semibold`}>
            {selectedScopeLabel}
          </h2>
        </div>

        {scopeLevel !== 'local' && (
          <div className={`${isLight ? 'bg-white border border-[#cfe4dc]' : 'bg-[#2b2b2b]'} rounded-[28px] px-5 py-5 space-y-4`}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className={`${isLight ? 'text-[#0f5f4d]' : 'text-white'} text-xl font-['Nunito'] font-semibold`}>
                  Filtro do dashboard
                </h2>
                <p className={`${isLight ? 'text-[#35695d]' : 'text-white/50'} text-sm font-['Nunito']`}>
                  Uma única visão por vez. Troque o escopo e o filtro contextual abaixo se alinham automaticamente.
                </p>
              </div>
              <Badge
                variant="outline"
                className={`${isLight ? 'border-[#017158]/30 text-[#0f5f4d]' : 'border-white/20 text-white/80'} w-fit`}
              >
                Visão atual: {selectedScopeLabel}
              </Badge>
            </div>

            <div className={`grid gap-3 ${selectedScopeType === 'national' ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
              <div>
                <label className={`${isLight ? 'text-[#35695d]' : 'text-white/70'} text-sm font-['Nunito'] block mb-1`}>
                  Visão
                </label>
                <select
                  value={selectedScopeType}
                  onChange={(event) => handleScopeTypeChange(event.target.value)}
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm font-['Nunito'] outline-none transition-colors ${
                    isLight
                      ? 'bg-white border-[#cfe4dc] text-[#123b33] focus:border-[#017158]'
                      : 'bg-[#1c1c1c] border-white/20 text-white focus:border-[#017158]'
                  }`}
                >
                  {scopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedScopeType !== 'national' && (
                <div>
                  <label className={`${isLight ? 'text-[#35695d]' : 'text-white/70'} text-sm font-['Nunito'] block mb-1`}>
                    {contextFilterLabel}
                  </label>
                  <select
                    value={contextFilterValue}
                    onChange={(event) => handleContextFilterChange(event.target.value)}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm font-['Nunito'] outline-none transition-colors ${
                      isLight
                        ? 'bg-white border-[#cfe4dc] text-[#123b33] focus:border-[#017158]'
                        : 'bg-[#1c1c1c] border-white/20 text-white focus:border-[#017158]'
                    }`}
                  >
                    {contextFilterOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {scopeNote && (
              <p className={`${isLight ? 'text-[#4b756b]' : 'text-white/50'} text-xs font-['Nunito']`}>
                {scopeNote}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <DashboardSummaryCard
            title="Classes"
            data={classesData.data}
            loading={classesData.loading}
            error={classesData.error}
            emptyMessage="Sem classes para esta visão"
            className="xl:col-span-1"
          />
          <DashboardSummaryCard
            title="Funções / Cargos"
            data={rolesData.data}
            loading={rolesData.loading}
            error={rolesData.error}
            emptyMessage="Sem funções ou cargos para esta visão"
            columns={2}
            className="xl:col-span-2"
          />
        </div>

        {showViewPrompt ? (
          <div className={`${isLight ? 'bg-white border border-[#cfe4dc]' : 'bg-[#2b2b2b]'} rounded-[33px] px-6 py-10 text-center`}>
            <span className="material-icons text-white/30 text-5xl mb-3 block">filter_alt</span>
            <p className="text-white/50 font-['Nunito']">Selecione uma federação, área ou igreja para carregar a visão correspondente.</p>
          </div>
        ) : (
          visibleSections.map((section) => (
            <div
              key={section.title}
              className={`${
                isLight
                  ? 'bg-white border border-[#cfe4dc] shadow-[0_8px_24px_rgba(1,113,88,0.08)]'
                  : 'bg-[#2b2b2b]'
              } rounded-[33px] px-6 py-5`}
            >
              <h2 className={`${isLight ? 'text-[#0f5f4d]' : 'text-white'} text-2xl font-['Nunito'] text-center mb-4`}>
                {section.title}
              </h2>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${section.cards.length}, 1fr)` }}>
                {section.cards.map((card) => (
                  <div
                    key={card.label}
                    className={`${isLight ? 'bg-[#017158] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'bg-[#017158]'} rounded-[18px] p-4 text-white`}
                  >
                    <div className="text-lg font-['Nunito'] leading-tight mb-2">{card.label}</div>
                    <div className="text-5xl font-['Nunito'] font-bold">{formatNumber(card.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {!showViewPrompt && visibleSections.length === 0 && !isLoading && (
          <div className={`${isLight ? 'bg-white border border-[#cfe4dc]' : 'bg-[#2b2b2b]'} rounded-[33px] px-6 py-10 text-center`}>
            <span className="material-icons text-white/30 text-5xl mb-3 block">dashboard</span>
            <p className="text-white/50 font-['Nunito']">Nenhum dado disponível no momento</p>
          </div>
        )}
      </div>
    </ICRLayout>
  );
}
