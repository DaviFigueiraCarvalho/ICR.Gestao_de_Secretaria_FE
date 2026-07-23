import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import { useICRApi } from '../hooks/useICRApi';
import { useTheme } from '../contexts/ThemeContext';
import { isPermissionError } from '@/lib/utils';
import { parseDateOnly } from '../lib/date-utils';
import PermissionDeniedError from '../components/PermissionDeniedError';

interface MinisterBirthday {
  id?: number;
  name: string;
  type: string;
  memberWifeName?: string;
  churchName?: string;
  birthday?: string;
  date?: string;
  weddingDate?: string;
  role?: number; // 1 = Pastor (Pr), 2 = Presbítero (Pb)
}

interface DateItem {
  id?: number;
  name: string;
  type: 'birthday' | 'wedding';
  date?: string;
  churchName?: string;
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

const getMinisterPrefix = (role?: number): string => {
  if (role === 1) return 'Pr ';
  if (role === 2) return 'Pb ';
  return '';
};

const getDisplayName = (item: MinisterBirthday): string => {
  const prefix = getMinisterPrefix(item.role);
  
  // Se for casamento, mostrar "Pr Nome e Nome da Esposa" ou "Pb Nome e Nome da Esposa"
  if ((item.type === 'WEDDING' || item.type === 'wedding') && item.memberWifeName) {
    return `${prefix}${item.name} e ${item.memberWifeName}`;
  }
  
  return `${prefix}${item.name}`;
};

const getDayOfMonth = (rawDate?: string): number => {
  const date = parseDateOnly(rawDate);
  const day = Number(date.split('-')[2]);
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : Number.MAX_SAFE_INTEGER;
};

const getDayString = (rawDate?: string): string => {
  const day = getDayOfMonth(rawDate);
  return day === Number.MAX_SAFE_INTEGER ? '—' : String(day).padStart(2, '0');
};

export default function DatasPastores() {
  const { fetchApi } = useICRApi();
  const { theme } = useTheme();
  const isLight = theme === 'light';
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

  const displayItems = useMemo<DateItem[]>(() => data
    .map((item) => ({
      id: item.id,
      name: getDisplayName(item),
      type: (item.type.toLowerCase() === 'wedding' ? 'wedding' : 'birthday') as DateItem['type'],
      date: item.birthday || item.weddingDate || item.date,
      churchName: item.churchName,
    }))
    .sort((a, b) => getDayOfMonth(a.date) - getDayOfMonth(b.date)), [data]);

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
      <div className="mb-6 flex flex-wrap items-center gap-6">
        <label className="text-white/70 font-['Nunito'] text-sm">Mês:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className={`${isLight ? 'bg-white border-[#cfe4dc] text-[#0f6d58]' : 'bg-[#2b2b2b] border-white/20 text-white'} border rounded-lg px-4 py-2 font-['Nunito'] focus:outline-none focus:border-[#017158]`}
        >
          {MONTHS.map((month, idx) => (
            <option key={idx} value={idx + 1}>
              {month}
            </option>
          ))}
        </select>
      </div>

      {/* Abas */}
      <div className="mb-6 flex gap-0 border-b border-white/20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 font-['Nunito'] font-semibold transition-all ${ activeTab === tab.id
              ? 'text-[#017158] border-b-2 border-[#017158]'
              : `${isLight ? 'text-[#4b7c70] hover:text-[#0f6d58]' : 'text-white/50 hover:text-white/70'}`
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
      ) : displayItems.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-white/40 font-['Nunito']">Nenhuma data encontrada para {MONTHS[selectedMonth - 1]}</p>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/20">
                <th className="px-4 py-3 text-left text-sm font-['Nunito'] font-semibold text-white/70">Nome</th>
                <th className="px-4 py-3 text-left text-sm font-['Nunito'] font-semibold text-white/70">Igreja</th>
                <th className="px-4 py-3 text-center text-sm font-['Nunito'] font-semibold text-white/70">Dia</th>
                <th className="px-4 py-3 text-center text-sm font-['Nunito'] font-semibold text-white/70">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, idx) => (
                <tr
                  key={`${item.type}-${item.id ?? idx}`}
                  className={`border-b transition-colors ${
                    item.type === 'birthday'
                      ? isLight ? 'border-[#dbeae4] hover:bg-[#f2f8f5]' : 'border-white/10 hover:bg-white/5'
                      : isLight ? 'border-[#dbeae4] bg-[#fdf1f7]' : 'border-white/10 bg-pink-500/5'
                  }`}
                >
                  <td className="px-4 py-3 font-['Nunito'] font-medium text-white">{item.name}</td>
                  <td className="px-4 py-3 text-sm font-['Nunito'] text-white/70">{item.churchName || '—'}</td>
                  <td className="px-4 py-3 text-center text-lg font-['Nunito'] font-semibold text-[#017158]">{getDayString(item.date)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-['Nunito'] font-medium ${
                      item.type === 'birthday'
                        ? isLight ? 'bg-[#d9eaff] text-[#225d98]' : 'bg-blue-500/30 text-blue-200'
                        : isLight ? 'bg-[#f8dbe9] text-[#8f2f63]' : 'bg-pink-500/30 text-pink-200'
                    }`}>
                      {item.type === 'birthday' ? 'Aniversário' : 'Casamento'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hidden">
          {data.map((item, idx) => (
            <div key={idx} className="bg-[#2b2b2b] rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-['Nunito'] font-semibold">{getDisplayName(item)}</h3>
                    <span className={`text-xs font-['Nunito'] px-2 py-1 rounded ${getTypeColor(item.type)}`}>
                      {getTypeLabel(item.type)}
                    </span>
                  </div>
                  {item.memberWifeName && (item.type === 'BIRTHDAY' || item.type === 'birthday') && (
                    <p className="text-white/50 text-sm font-['Nunito']">Esposa: {item.memberWifeName}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-white/50 font-['Nunito']">
                    <span className="material-icons text-base">church</span>
                    {item.churchName || 'Igreja não informada'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#017158] font-['Nunito'] font-medium">
                    {getDayString(item.birthday || item.weddingDate || item.date)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </ICRLayout>
  );
}
