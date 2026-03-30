import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import { useICRApi, DashboardNational } from '../hooks/useICRApi';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getScopeLevel } from '../lib/scope-access';
import { isPermissionError } from '@/lib/utils';
import PermissionDeniedError from '../components/PermissionDeniedError';

interface StatCard {
  label: string;
  value: number | string;
}

interface DashboardSection {
  title: string;
  cards: StatCard[];
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export default function Home() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [nationalDashboard, setNationalDashboard] = useState<DashboardNational | null>(null);
  const [federationDashboard, setFederationDashboard] = useState<DashboardNational | null>(null);
  const [churchDashboard, setChurchDashboard] = useState<DashboardNational | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scopeLevel = getScopeLevel(user?.scope, user?.username);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const resolvedMemberId = toNumber(user?.memberId);
        const resolvedChurchId = toNumber(user?.churchId);
        const resolvedFederationId = toNumber(user?.federationId);
        const hasFederationId = typeof resolvedFederationId === 'number';
        const hasChurchId = typeof resolvedChurchId === 'number';

        const needsNational = scopeLevel === 'federation';
        const needsFederation = scopeLevel === 'federation' || scopeLevel === 'federated';
        const needsChurch = true;
        const allowMissingLinkage = typeof resolvedMemberId !== 'number';

        if (needsFederation && !hasFederationId && !allowMissingLinkage) {
          throw new Error('Nao foi possivel resolver a area vinculada ao usuario.');
        }

        if (needsChurch && !hasChurchId && !allowMissingLinkage) {
          throw new Error('Nao foi possivel resolver a igreja vinculada ao usuario.');
        }

        const shouldLoadFederation = needsFederation && hasFederationId;
        const shouldLoadChurch = needsChurch && hasChurchId;

        const nationalRequest = needsNational
          ? fetchApi<DashboardNational>('/api/v1/dashboard/national')
          : Promise.resolve(null);

        const federationRequest = shouldLoadFederation
          ? fetchApi<DashboardNational>(`/api/v1/dashboard/federation/${resolvedFederationId}`)
          : Promise.resolve(null);

        const churchRequest = shouldLoadChurch
          ? fetchApi<DashboardNational>(`/api/v1/dashboard/church/${resolvedChurchId}`)
          : Promise.resolve(null);

        const [nationalData, federationData, churchData] = await Promise.all([
          nationalRequest,
          federationRequest,
          churchRequest,
        ]);

        if (!isMounted) return;
        setNationalDashboard(nationalData);
        setFederationDashboard(federationData);
        setChurchDashboard(churchData);
      } catch (err) {
        if (!isMounted) return;
        setNationalDashboard(null);
        setFederationDashboard(null);
        setChurchDashboard(null);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [fetchApi, scopeLevel, user?.churchId, user?.federationId]);

  const sections: DashboardSection[] = [
    {
      title: 'Areas, Igrejas e Comunidades Missionárias',
      cards: [
        { label: 'Total de Áreas', value: nationalDashboard?.totalFederations ?? 0 },
        { label: 'Igrejas', value: nationalDashboard?.totalChurches ?? 0 },
        { label: 'Comunidades Missionárias', value: nationalDashboard?.totalMissionaryCommunities ?? 0 },
      ],
    },
    {
      title: 'Igrejas e Comunidades Missionárias por Área',
      cards: [
        { label: 'Igrejas', value: federationDashboard?.totalChurches ?? 0 },
        { label: 'Comunidades Missionárias', value: federationDashboard?.totalMissionaryCommunities ?? 0 },
      ],
    },
    {
      title: 'Familias Células e Membros Totais',
      cards: [
        { label: 'Famílias', value: nationalDashboard?.totalFamilies ?? 0 },
        { label: 'Células', value: nationalDashboard?.totalCells ?? 0 },
        { label: 'Membros', value: nationalDashboard?.totalMembers ?? 0 },
      ],
    },
    {
      title: 'Familias Células e Membros Por Área',
      cards: [
        { label: 'Famílias', value: federationDashboard?.totalFamilies ?? 0 },
        { label: 'Células', value: federationDashboard?.totalCells ?? 0 },
        { label: 'Membros', value: federationDashboard?.totalMembers ?? 0 },
      ],
    },
    {
      title: 'Familias Células e Membros Locais',
      cards: [
        { label: 'Famílias', value: churchDashboard?.totalFamilies ?? churchDashboard?.localFamilies ?? 0 },
        { label: 'Células', value: churchDashboard?.totalCells ?? churchDashboard?.localCells ?? 0 },
        { label: 'Membros', value: churchDashboard?.totalMembers ?? churchDashboard?.localMembers ?? 0 },
      ],
    },
  ];

  const visibleSections = sections.filter((section) => {
    if (scopeLevel === 'federation') return true;

    const sectionTitle = section.title.toLowerCase();
    const isLocalSection = sectionTitle.includes('locais') || sectionTitle.includes('local');
    const isFederatedSection = sectionTitle.includes('área') || sectionTitle.includes('area');
    const isFederationWideSection = sectionTitle.includes('totais') || sectionTitle.includes('federações');

    if (scopeLevel === 'federated') {
      return isLocalSection || isFederatedSection;
    }

    return isLocalSection && !isFederationWideSection;
  }).filter((section) => {
    const sectionTitle = section.title.toLowerCase();
    const isLocalSection = sectionTitle.includes('locais') || sectionTitle.includes('local');
    const isFederatedSection = sectionTitle.includes('área') || sectionTitle.includes('area');

    if (isLocalSection && !churchDashboard) return false;
    if (isFederatedSection && !federationDashboard) return false;
    return true;
  });

  if (isLoading) {
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

  if (error) {
    if (isPermissionError(new Error(error))) {
      return (
        <ICRLayout>
          <PermissionDeniedError message={error} />
        </ICRLayout>
      );
    }
    return (
      <ICRLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="material-icons text-red-400 text-4xl">error_outline</span>
            <p className="text-white/60 font-['Nunito']">{error}</p>
            <p className="text-white/40 text-sm font-['Nunito']">Verifique sua conexão com a API</p>
          </div>
        </div>
      </ICRLayout>
    );
  }

  return (
    <ICRLayout>
      <div className="space-y-6">
        {visibleSections.map((section) => (
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
                  <div className="text-5xl font-['Nunito'] font-bold">{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {visibleSections.length === 0 && !isLoading && !error && (
          <div className={`${isLight ? 'bg-white border border-[#cfe4dc]' : 'bg-[#2b2b2b]'} rounded-[33px] px-6 py-10 text-center`}>
            <span className="material-icons text-white/30 text-5xl mb-3 block">dashboard</span>
            <p className="text-white/50 font-['Nunito']">Nenhum dado disponível no momento</p>
          </div>
        )}
      </div>

      {/* Support button */}
      <div className="fixed bottom-6 right-6">
        <button className={`${isLight ? 'bg-white border-[#99cfc0] text-[#2e6f5f] hover:text-[#0f5f4d]' : 'bg-[#2b2b2b] border-[#017158]/40 text-white/70 hover:text-white'} border rounded-xl p-3 flex items-center gap-2 hover:border-[#017158] transition-colors shadow-lg`}>
          <span className="material-icons text-[#017158]">chat</span>
          <span className="text-sm font-['Nunito']">Entre em contato<br />para suporte</span>
        </button>
      </div>
    </ICRLayout>
  );
}
