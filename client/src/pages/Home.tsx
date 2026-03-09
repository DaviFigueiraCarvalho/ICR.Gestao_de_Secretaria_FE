import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import { useICRApi, DashboardNational } from '../hooks/useICRApi';

interface StatCard {
  label: string;
  value: number | string;
}

interface DashboardSection {
  title: string;
  cards: StatCard[];
}

export default function Home() {
  const { fetchApi } = useICRApi();
  const [dashboard, setDashboard] = useState<DashboardNational | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await fetchApi<DashboardNational>('/api/v1/dashboard/national');
        setDashboard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const sections: DashboardSection[] = dashboard ? [
    {
      title: 'Federações, Igrejas e Comunidades Missionárias',
      cards: [
        { label: 'Total de Comissões Federadas', value: dashboard.totalFederations ?? 0 },
        { label: 'Igrejas', value: dashboard.totalChurches ?? 0 },
        { label: 'Comunidades Missionárias', value: dashboard.totalMissionaryCommunities ?? 0 },
      ],
    },
    {
      title: 'Igrejas e Comunidades Missionárias por Comissão Federada',
      cards: [
        { label: 'Igrejas', value: dashboard.totalChurches ?? 0 },
        { label: 'Comunidades Missionárias', value: dashboard.totalMissionaryCommunities ?? 0 },
      ],
    },
    {
      title: 'Familias Células e Membros Totais',
      cards: [
        { label: 'Famílias', value: dashboard.totalFamilies ?? 0 },
        { label: 'Células', value: dashboard.totalCells ?? 0 },
        { label: 'Membros', value: dashboard.totalMembers ?? 0 },
      ],
    },
    {
      title: 'Familias Células e Membros Por Comissão Federada',
      cards: [
        { label: 'Famílias', value: dashboard.totalFamilies ?? 0 },
        { label: 'Células', value: dashboard.totalCells ?? 0 },
        { label: 'Membros', value: dashboard.totalMembers ?? 0 },
      ],
    },
    {
      title: 'Familias Células e Membros Locais',
      cards: [
        { label: 'Famílias', value: dashboard.localFamilies ?? 0 },
        { label: 'Células', value: dashboard.localCells ?? 0 },
        { label: 'Membros', value: dashboard.localMembers ?? 0 },
      ],
    },
  ] : [];

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
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-[#2b2b2b] rounded-[33px] px-6 py-5"
          >
            <h2 className="text-white text-2xl font-['Nunito'] text-center mb-4">
              {section.title}
            </h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${section.cards.length}, 1fr)` }}>
              {section.cards.map((card) => (
                <div
                  key={card.label}
                  className="bg-[#017158] rounded-[18px] p-4 text-white"
                >
                  <div className="text-lg font-['Nunito'] leading-tight mb-2">{card.label}</div>
                  <div className="text-5xl font-['Nunito'] font-bold">{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!dashboard && !isLoading && !error && (
          <div className="bg-[#2b2b2b] rounded-[33px] px-6 py-10 text-center">
            <span className="material-icons text-white/30 text-5xl mb-3 block">dashboard</span>
            <p className="text-white/50 font-['Nunito']">Nenhum dado disponível no momento</p>
          </div>
        )}
      </div>

      {/* Support button */}
      <div className="fixed bottom-6 right-6">
        <button className="bg-[#2b2b2b] border border-[#017158]/40 rounded-xl p-3 flex items-center gap-2 text-white/70 hover:text-white hover:border-[#017158] transition-colors shadow-lg">
          <span className="material-icons text-[#017158]">chat</span>
          <span className="text-sm font-['Nunito']">Entre em contato<br />para suporte</span>
        </button>
      </div>
    </ICRLayout>
  );
}
