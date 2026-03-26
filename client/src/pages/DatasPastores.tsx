import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import { useICRApi } from '../hooks/useICRApi';
import { isPermissionError } from '@/lib/utils';
import PermissionDeniedError from '../components/PermissionDeniedError';

interface MinisterBirthday {
  id?: number;
  name: string;
  type: string;
  memberWifeName?: string;
  birthday?: string;
  date?: string;
  weddingDate?: string;
}

type TabType = 'all' | 'birthday' | 'wedding';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const TABS: { id: TabType; label: string; type?: string }[] = [
  { id: 'all', label: 'Todas as Datas' },
  { id: 'birthday', label: 'Aniversários', type: 'birthday' },
  { id: 'wedding', label: 'Casamentos', type: 'wedding' },
];

export default function DatasPastores() {
  const { fetchApi } = useICRApi();
  const [data, setData] = useState<MinisterBirthday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const load = async (month: number, tab: TabType) => {
    setIsLoading(true);
    setError(null);
    try {
      let result: MinisterBirthday[] = [];

      if (tab === 'all') {
        // Carregar todos os tipos
        const [birthdays, weddings] = await Promise.all([
          fetchApi<MinisterBirthday[]>(`/api/ministers/birthdays/month/${month}`).catch(() => []),
          fetchApi<MinisterBirthday[]>(`/api/ministers/weddings/month/${month}`).catch(() => []),
        ]);
        result = [...(Array.isArray(birthdays) ? birthdays : []), ...(Array.isArray(weddings) ? weddings : [])];
      } else if (tab === 'birthday') {
        const response = await fetchApi<MinisterBirthday[]>(`/api/ministers/birthdays/month/${month}`);
        result = Array.isArray(response) ? response : [];
      } else if (tab === 'wedding') {
        const response = await fetchApi<MinisterBirthday[]>(`/api/ministers/weddings/month/${month}`);
        result = Array.isArray(response) ? response : [];
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar datas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(selectedMonth, activeTab);
  }, [selectedMonth, activeTab]);

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'BIRTHDAY': 'Aniversário',
      'birthday': 'Aniversário',
      'WEDDING': 'Casamento',
      'wedding': 'Casamento',
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const types: Record<string, string> = {
      'BIRTHDAY': 'bg-blue-500/20 text-blue-400',
      'birthday': 'bg-blue-500/20 text-blue-400',
      'WEDDING': 'bg-pink-500/20 text-pink-400',
      'wedding': 'bg-pink-500/20 text-pink-400',
    };
    return types[type] || 'bg-gray-500/20 text-gray-400';
  };

  if (error && !isLoading) {
    if (isPermissionError(new Error(error))) {
      return (
        <ICRLayout title="Datas de Pastores">
          <PermissionDeniedError message={error} />
        </ICRLayout>
      );
    }
    return (
      <ICRLayout title="Datas de Pastores">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="material-icons text-red-400 text-4xl">error_outline</span>
            <p className="text-white/60 font-['Nunito']">{error}</p>
          </div>
        </div>
      </ICRLayout>
    );
  }

  return (
    <ICRLayout title="Datas de Pastores">
      {/* Seletor de Mês */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-white/70 font-['Nunito'] text-sm">Mês:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="bg-[#2b2b2b] border border-white/20 rounded-lg px-4 py-2 text-white font-['Nunito'] focus:outline-none focus:border-[#017158]"
        >
          {MONTHS.map((month, idx) => (
            <option key={idx} value={idx + 1}>
              {month}
            </option>
          ))}
        </select>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-6 border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-['Nunito'] font-medium transition-colors ${ activeTab === tab.id
              ? 'text-[#017158] border-b-2 border-[#017158]'
              : 'text-white/60 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <span className="material-icons animate-spin text-[#017158] text-4xl">refresh</span>
            <p className="text-white/60 font-['Nunito']">Carregando...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-white/40 font-['Nunito']">Nenhuma data encontrada para {MONTHS[selectedMonth - 1]}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data.map((item, idx) => (
            <div key={idx} className="bg-[#2b2b2b] rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-['Nunito'] font-semibold">{item.name}</h3>
                    <span className={`text-xs font-['Nunito'] px-2 py-1 rounded ${getTypeColor(item.type)}`}>
                      {getTypeLabel(item.type)}
                    </span>
                  </div>
                  {item.memberWifeName && (
                    <p className="text-white/50 text-sm font-['Nunito']">Esposa: {item.memberWifeName}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[#017158] font-['Nunito'] font-medium">
                    {item.birthday || item.weddingDate || item.date || '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ICRLayout>
  );
}
