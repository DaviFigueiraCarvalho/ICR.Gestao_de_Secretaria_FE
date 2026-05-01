import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import { useICRApi, Church } from '../hooks/useICRApi';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { buildLocalChurchFallback, getScopeLevel } from '../lib/scope-access';
import { isPermissionError } from '@/lib/utils';
import PermissionDeniedError from '../components/PermissionDeniedError';

interface MemberBirthday {
  id?: number;
  name: string;
  birthDate?: string;
  birthday?: string;
  date?: string;
  familyCellName?: string;
  familyCellId?: number;
}

interface Wedding {
  id?: number;
  name: string;
  weddingDate?: string;
  date?: string;
  manName?: string;
  womanName?: string;
  man?: { name: string };
  woman?: { name: string };
  churchId?: number;
  cellName?: string;
  cellId?: number;
}

interface DateItem {
  id?: number;
  name: string;
  type: 'birthday' | 'wedding';
  date?: string;
  cellName?: string;
  cellId?: number;
}

type TabType = 'all' | 'birthday' | 'wedding';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const TABS: { id: TabType; label: string }[] = [
  { id: 'all', label: 'Todas as Datas' },
  { id: 'birthday', label: 'Aniversários' },
  { id: 'wedding', label: 'Casamentos' },
];

const getDayOfMonth = (rawDate?: string): number => {
  if (!rawDate) return Number.MAX_SAFE_INTEGER;

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getDate();
  }

  // Fallback for non-ISO strings like dd/MM/yyyy or yyyy-MM-dd variants.
  const parts = rawDate.match(/\d+/g);
  if (!parts || parts.length < 3) return Number.MAX_SAFE_INTEGER;

  if (rawDate.includes('/')) {
    const day = Number(parts[0]);
    return Number.isFinite(day) && day >= 1 && day <= 31 ? day : Number.MAX_SAFE_INTEGER;
  }

  const day = Number(parts[2]);
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : Number.MAX_SAFE_INTEGER;
};

const formatDateLabel = (rawDate?: string): string => {
  if (!rawDate) return '—';

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
  });
};

const getDayString = (rawDate?: string): string => {
  if (!rawDate) return '—';

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getDate().toString().padStart(2, '0');
  }

  // Fallback
  const parts = rawDate.match(/\d+/g);
  if (!parts || parts.length < 3) return '—';

  const day = rawDate.includes('/') ? Number(parts[0]) : Number(parts[2]);
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day.toString().padStart(2, '0') : '—';
};

export default function DatasMembers() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [birthdays, setBirthdays] = useState<MemberBirthday[]>([]);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurch, setSelectedChurch] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  const isLocalScope = scopeLevel === 'local';
  const isFederatedScope = scopeLevel === 'federated';

  const scopedChurches = useMemo(() => {
    if (isLocalScope) {
      if (typeof user?.churchId !== 'number') return [];

      const ownChurch = churches.find((church) => church.id === user.churchId);
      if (ownChurch) return [ownChurch];

      // Keep filter rendered even if church list endpoint does not include the linked church item.
      return [{ id: user.churchId, name: `Igreja vinculada (ID ${user.churchId})`, federationId: 0 } as Church];
    }

    if (isFederatedScope && typeof user?.federationId === 'number') {
      return churches.filter((church) => church.federationId === user.federationId);
    }

    return churches;
  }, [churches, isFederatedScope, isLocalScope, user?.churchId, user?.federationId]);

  useEffect(() => {
    const loadChurches = async () => {
      try {
        if (isLocalScope) {
          if (typeof user?.churchId === 'number') {
            try {
              const ownChurch = await fetchApi<Church>(`/api/churches/${user.churchId}`);
              setChurches(ownChurch?.id ? [ownChurch] : buildLocalChurchFallback(user.churchId));
              setSelectedChurch(ownChurch?.id ?? user.churchId);
            } catch {
              setChurches(buildLocalChurchFallback(user.churchId));
              setSelectedChurch(user.churchId);
            }
          } else {
            setChurches([]);
            setSelectedChurch('');
          }
          return;
        }

        const result = await fetchApi<Church[]>('/api/churches');
        const churchesList = Array.isArray(result) ? result : [];

        if (isFederatedScope && typeof user?.federationId === 'number') {
          const federationChurches = churchesList.filter((church) => church.federationId === user.federationId);
          setChurches(federationChurches);
          setSelectedChurch((current) => {
            if (typeof current === 'number' && federationChurches.some((church) => church.id === current)) {
              return current;
            }
            return federationChurches[0]?.id ?? '';
          });
          return;
        }

        setChurches(churchesList);
        if (churchesList.length > 0) {
          setSelectedChurch((current) => (typeof current === 'number' ? current : churchesList[0].id));
        }
      } catch (err) {
        console.error('Erro ao carregar igrejas:', err);
      }
    };
    loadChurches();
  }, [fetchApi, isFederatedScope, isLocalScope, user?.churchId, user?.federationId]);

  const load = async (month: number, churchId: number | '') => {
    if (!churchId) {
      setBirthdays([]);
      setWeddings([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Load birthdays
      const birthdayResponse = await fetchApi<MemberBirthday[]>(
        `/api/members/birthdays/${month}/church/${churchId}`
      );
      const birthdaysList = Array.isArray(birthdayResponse) ? birthdayResponse : [];
      console.log('📅 DatesMembers - API birthdays response:', birthdaysList);
      setBirthdays(birthdaysList);

      // Load weddings
      const weddingResponse = await fetchApi<Wedding[]>(
        `/api/families/wedding/month/${month}`
      );
      const weddingsList = Array.isArray(weddingResponse) ? weddingResponse : [];
      // Filter by church
      const filteredWeddings = weddingsList.filter((w) => w.churchId === churchId);
      setWeddings(filteredWeddings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar datas');
      setBirthdays([]);
      setWeddings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(selectedMonth, selectedChurch);
  }, [selectedMonth, selectedChurch]);

  const getDisplayItems = (): DateItem[] => {
    const items: DateItem[] = [];

    if (activeTab === 'all' || activeTab === 'birthday') {
      const birthdayItems = birthdays.map((b) => ({
        id: b.id,
        name: b.name,
        type: 'birthday' as const,
        date: b.birthDate || b.birthday || b.date,
        cellName: b.familyCellName,
        cellId: b.familyCellId,
      }));
      console.log('🎂 DatesMembers - Mapped birthday items:', birthdayItems);
      items.push(...birthdayItems);
    }

    if (activeTab === 'all' || activeTab === 'wedding') {
      items.push(...weddings.map((w) => {
        // Prioriza nomes explícitos do casal vindos da API de famílias.
        const manName = w.manName || w.man?.name || '';
        const womanName = w.womanName || w.woman?.name || '';
        const coupleDisplayName = manName && womanName 
          ? `${manName} e ${womanName}`
          : manName || womanName || w.name || '';

        return {
          id: w.id,
          name: coupleDisplayName,
          type: 'wedding' as const,
          date: w.weddingDate || w.date,
          cellName: w.cellName,
          cellId: w.cellId,
        };
      }));
    }

    // Sort by cell name first, then by day of month
    return items.sort((a, b) => {
      // Primary sort: cell name
      const cellA = (a.cellName || '').toLowerCase();
      const cellB = (b.cellName || '').toLowerCase();
      if (cellA !== cellB) {
        return cellA.localeCompare(cellB, 'pt-BR');
      }

      // Secondary sort: day of month
      const aDate = getDayOfMonth(a.date);
      const bDate = getDayOfMonth(b.date);
      return aDate - bDate;
    });
  };

  const displayItems = getDisplayItems();

  if (error && !isLoading) {
    if (isPermissionError(new Error(error))) {
      return (
        <ICRLayout title="Datas de Membros">
          <PermissionDeniedError message={error} />
        </ICRLayout>
      );
    }
    return (
      <ICRLayout title="Datas de Membros">
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
    <ICRLayout title="Datas de Membros">
      {/* Seletores */}
      <div className="mb-6 flex flex-wrap items-center gap-6">
        {!isLocalScope && (
          <div className="flex items-center gap-4">
            <label className="text-white/70 font-['Nunito'] text-sm">Igreja:</label>
            <select
              value={selectedChurch}
              onChange={(e) => setSelectedChurch(e.target.value ? Number(e.target.value) : '')}
              className={`${isLight ? 'bg-white border-[#cfe4dc] text-[#0f6d58]' : 'bg-[#2b2b2b] border-white/20 text-white'} border rounded-lg px-4 py-2 font-['Nunito'] focus:outline-none focus:border-[#017158]`}
            >
              <option value="">Selecione uma igreja</option>
              {scopedChurches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-4">
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
      </div>

      {/* Abas */}
      <div className="mb-6 flex gap-0 border-b border-white/20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 font-['Nunito'] font-semibold transition-all ${
              activeTab === tab.id
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
      ) : !selectedChurch ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-white/40 font-['Nunito']">
            {isLocalScope
              ? 'Nao foi possivel resolver a igreja vinculada deste usuario.'
              : 'Selecione uma igreja para ver as datas'}
          </p>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-white/40 font-['Nunito']">
            Nenhuma{' '}
            {activeTab === 'birthday'
              ? 'aniversário'
              : activeTab === 'wedding'
                ? 'casamento'
                : 'data'}{' '}
            encontrado para {MONTHS[selectedMonth - 1]}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left px-4 py-3 text-white/70 font-['Nunito'] font-semibold text-sm">Nome</th>
                <th className="text-left px-4 py-3 text-white/70 font-['Nunito'] font-semibold text-sm">Célula</th>
                <th className="text-center px-4 py-3 text-white/70 font-['Nunito'] font-semibold text-sm">Dia</th>
                <th className="text-center px-4 py-3 text-white/70 font-['Nunito'] font-semibold text-sm">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, idx) => (
                <tr
                  key={`${item.type}-${idx}`}
                  className={`border-b ${isLight ? 'border-[#dbeae4] hover:bg-[#f2f8f5]' : 'border-white/10 hover:bg-white/5'} transition-colors ${
                    item.type === 'birthday'
                      ? ''
                      : isLight ? 'bg-[#fdf1f7]' : 'bg-pink-500/5'
                  }`}
                >
                  <td className="px-4 py-3 text-white font-['Nunito'] font-medium">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-white/70 font-['Nunito'] text-sm">
                    {item.cellName || '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-[#017158] font-['Nunito'] font-semibold text-lg">
                    {getDayString(item.date)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-['Nunito'] font-medium ${
                        item.type === 'birthday'
                          ? isLight ? 'bg-[#d9eaff] text-[#225d98]' : 'bg-blue-500/30 text-blue-200'
                          : isLight ? 'bg-[#f8dbe9] text-[#8f2f63]' : 'bg-pink-500/30 text-pink-200'
                      }`}
                    >
                      {item.type === 'birthday' ? 'Aniversário' : 'Casamento'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ICRLayout>
  );
}
