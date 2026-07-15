import { useEffect, useState, useMemo } from 'react';
import ICRLayout from '../components/ICRLayout';
import SmartSelect, { SmartSelectOption } from '../components/SmartSelect';
import { useICRApi, Repass, Reference, Church } from '../hooks/useICRApi';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { generateAreaCode } from '../../../shared/areaCodes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { isPermissionError } from '@/lib/utils';
import { settledValue } from '@/lib/utils';
import PermissionDeniedError from '../components/PermissionDeniedError';

interface RepassRow {
  churchId: number;
  churchName: string;
  federationName?: string;
  repass?: Repass;
  amount?: number;
}

interface RepassForm {
  churchId: number | '';
  reference: number | '';
  amount: number | '';
}

interface ReferenceResponse {
  id: number;
  name?: string;
  competenceDate?: string;
  createdAt?: string;
  resultMessage?: string;
}

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MONTH_ABBR = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

const MONTH_LOOKUP: Record<string, number> = {
  JAN: 0,
  FEV: 1,
  MAR: 2,
  ABR: 3,
  MAI: 4,
  JUN: 5,
  JUL: 6,
  AGO: 7,
  SET: 8,
  OUT: 9,
  NOV: 10,
  DEZ: 11,
};

const getReferenceSortKey = (reference: Reference) => {
  const normalizedName = (reference.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  const match = normalizedName.match(/^([A-Z]{3})[-\s]?([0-9]{2,4})$/);
  if (match) {
    const monthIndex = MONTH_LOOKUP[match[1]];
    if (typeof monthIndex === 'number') {
      const yearValue = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
      return yearValue * 12 + monthIndex;
    }
  }

  const competenceDate = reference.competenceDate ? new Date(reference.competenceDate) : null;
  if (competenceDate && !Number.isNaN(competenceDate.getTime())) {
    return competenceDate.getFullYear() * 12 + competenceDate.getMonth();
  }

  return Number.MAX_SAFE_INTEGER;
};

const sortReferencesChronologically = (items: Reference[]) => {
  return [...items].sort((a, b) => {
    const diff = getReferenceSortKey(a) - getReferenceSortKey(b);
    if (diff !== 0) return diff;
    return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
  });
};

const parseReferenceCompetenceDate = (reference?: Reference | null): Date | null => {
  if (!reference) return null;

  const competenceDate = reference.competenceDate ? new Date(reference.competenceDate) : null;
  if (competenceDate && !Number.isNaN(competenceDate.getTime())) {
    return new Date(competenceDate.getFullYear(), competenceDate.getMonth(), 1);
  }

  const normalizedName = (reference.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  const match = normalizedName.match(/^([A-Z]{3})[-\s]?([0-9]{2,4})$/);
  if (!match) return null;

  const monthIndex = MONTH_LOOKUP[match[1]];
  if (typeof monthIndex !== 'number') return null;

  const yearValue = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  if (Number.isNaN(yearValue)) return null;

  return new Date(yearValue, monthIndex, 1);
};

const getLastBusinessDayOfFollowingMonth = (competenceDate: Date): Date => {
  const deadline = new Date(competenceDate.getFullYear(), competenceDate.getMonth() + 1, 0);
  while (deadline.getDay() === 0 || deadline.getDay() === 6) {
    deadline.setDate(deadline.getDate() - 1);
  }
  return deadline;
};

const formatDateBR = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
};

export default function Repasses() {
  const { fetchApi } = useICRApi();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [references, setReferences] = useState<Reference[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [repasses, setRepasses] = useState<Repass[]>([]);
  const [selectedRef, setSelectedRef] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Repass | null>(null);
  const [form, setForm] = useState<RepassForm>({ churchId: '', reference: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [referenceDate, setReferenceDate] = useState('');
  const [showPendingMessageModal, setShowPendingMessageModal] = useState(false);
  const [pendingMessageContent, setPendingMessageContent] = useState('');
  const [savingReference, setSavingReference] = useState(false);

  const selectedReference = useMemo(
    () => references.find((ref) => ref.id === selectedRef) || null,
    [references, selectedRef],
  );

  const loadAll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [refs, churchList] = await Promise.allSettled([
        fetchApi<Reference[]>('/api/repasses/references'),
        fetchApi<Church[]>('/api/churches'),
      ]);

      const resolvedRefs = settledValue(refs) ?? [];
      const resolvedChurches = settledValue(churchList) ?? [];
      const orderedRefs = sortReferencesChronologically(resolvedRefs);

      setReferences(orderedRefs);
      setChurches(resolvedChurches);
      if (orderedRefs.length > 0 && !selectedRef) {
        setSelectedRef(orderedRefs[orderedRefs.length - 1].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRepasses = async (refId: number) => {
    try {
      const result = await fetchApi<Repass[]>(`/api/repasses/reference/${refId}`);
      setRepasses(Array.isArray(result) ? result : []);
    } catch (err) {
      setRepasses([]);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (selectedRef) loadRepasses(selectedRef);
  }, [selectedRef]);

  const fetchChurchItems = async (page: number, query: string): Promise<SmartSelectOption[]> => {
    const params = new URLSearchParams();
    params.append('pageNumber', String(page));
    params.append('pageQuantity', '10');
    if (query.trim()) {
      params.append('querySearch', query.trim());
    }

    const results = await fetchApi<Church[]>(`/api/churches?${params.toString()}`);
    return (Array.isArray(results) ? results : []).map((church) => ({
      id: church.id,
      name: church.name,
    }));
  };

  // Build rows: all churches with their repass status for selected reference
  const rows = useMemo((): RepassRow[] => {
    const getSortPriority = (amount?: number) => {
      const value = amount || 0;
      if (value > 150) return 0; // Pagos
      if (value === 150) return 1; // Minimo
      return 2; // Nao pagos
    };

    return churches
      .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.federationName || '').toLowerCase().includes(search.toLowerCase()))
      .map(church => {
        const repass = repasses.find(r => r.churchId === church.id);
        return {
          churchId: church.id,
          churchName: church.name,
          federationName: church.federationName,
          repass,
          amount: repass?.amount,
        };
      })
      .sort((a, b) => {
        const priorityDiff = getSortPriority(a.amount) - getSortPriority(b.amount);
        if (priorityDiff !== 0) return priorityDiff;

        const federationCompare = (a.federationName || '').localeCompare(b.federationName || '', 'pt-BR', {
          sensitivity: 'base',
        });
        if (federationCompare !== 0) return federationCompare;

        return a.churchName.localeCompare(b.churchName, 'pt-BR', { sensitivity: 'base' });
      });
  }, [churches, repasses, search]);

  // Summary
  const totalPaid = rows.filter(r => r.amount && r.amount > 0).reduce((sum, r) => sum + (r.amount || 0), 0);
  const paidCount = rows.filter(r => r.amount && r.amount > 0).length;
  const pendingCount = rows.filter(r => !r.amount || r.amount === 0).length;

 const getRowColor = (row: RepassRow): string => {
    const val = row.amount || 0;
    if (isLight) {
      if (val > 150) return 'bg-[#e4f4ef] hover:bg-[#d6ede5]';
      if (val === 150) return 'bg-[#fdf3dc] hover:bg-[#f7ebcf]';
      return 'bg-[#f9e4e4] hover:bg-[#f4d8d8]';
    }
    if (val > 150) return 'bg-green-900/40 hover:bg-green-900/50';
    if (val === 150) return 'bg-yellow-900/40 hover:bg-yellow-900/50';
    return 'bg-red-900/40 hover:bg-red-900/50';
  };

  const getRowTextColor = (row: RepassRow): string => {
    const val = row.amount || 0;
    if (isLight) {
      if (val > 150) return 'text-[#0f6d58]';
      if (val === 150) return 'text-[#8a6708]';
      return 'text-[#943434]';
    }
    if (val > 150) return 'text-green-200';
    if (val === 150) return 'text-yellow-200';
    return 'text-red-200';
  };
  

  const openAdd = () => {
    setEditItem(null);
    setForm({ churchId: '', reference: selectedRef || '', amount: '' });
    setShowModal(true);
  };

  const openEdit = (row: RepassRow) => {
    if (row.repass) {
      setEditItem(row.repass);
      setForm({ churchId: row.churchId, reference: row.repass.reference, amount: row.repass.amount });
    } else {
      setEditItem(null);
      setForm({ churchId: row.churchId, reference: selectedRef || '', amount: '' });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.churchId) { toast.error('Igreja é obrigatória'); return; }
    if (!form.reference) { toast.error('Referência é obrigatória'); return; }
    if (form.amount === '' || form.amount === null) { toast.error('Valor é obrigatório'); return; }
    setSaving(true);
    try {
      const body = {
        churchId: Number(form.churchId),
        reference: Number(form.reference),
        amount: Number(form.amount),
      };
      if (editItem) {
        await fetchApi(`/api/repasses/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('Repasse atualizado com sucesso');
      } else {
        await fetchApi('/api/repasses', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Repasse registrado com sucesso');
      }
      setShowModal(false);
      if (selectedRef) loadRepasses(selectedRef);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (repass: Repass) => {
    try {
      await fetchApi(`/api/repasses/${repass.id}`, { method: 'DELETE' });
      toast.success('Repasse excluído');
      if (selectedRef) loadRepasses(selectedRef);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getReferencePreview = (monthValue: string) => {
    if (!monthValue) return { cobradoEm: '', referenteA: '' };

    const [yearPart, monthPart] = monthValue.split('-');
    const year = Number(yearPart);
    const monthIndex = Number(monthPart) - 1;

    if (!year || monthIndex < 0 || monthIndex > 11) return { cobradoEm: '', referenteA: '' };

    const monthName = MONTH_NAMES[monthIndex];
    const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} - ${String(year).slice(-2)}`;

    const previousDate = new Date(year, monthIndex - 1, 1);
    const previousMonthIndex = previousDate.getMonth();
    const previousYear = previousDate.getFullYear();
    const referenceLabel = `${MONTH_ABBR[previousMonthIndex]}-${String(previousYear).slice(-2)}`;

    return { cobradoEm: monthLabel, referenteA: referenceLabel };
  };

  const getTodayMonth = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 7);
  };

  const toReferenceDateTime = (monthValue: string) => {
    return new Date(`${monthValue}-01T00:00:00`).toISOString();
  };

  const openReferenceModal = () => {
    setReferenceDate(getTodayMonth());
    setShowReferenceModal(true);
  };

  const handleCreateReference = async () => {
    if (!referenceDate) {
      toast.error('Selecione o mês cobrado');
      return;
    }

    setSavingReference(true);
    try {
      const response = await fetchApi<ReferenceResponse>('/api/repasses/references', {
        method: 'POST',
        body: JSON.stringify({ competenceDate: toReferenceDateTime(referenceDate) }),
      });

      toast.success(response.resultMessage || 'Referência criada com sucesso');
      setShowReferenceModal(false);
      await loadAll();
      if (response.id) {
        setSelectedRef(response.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar referência');
    } finally {
      setSavingReference(false);
    }
  };

  const selectedRefName = references.find(r => r.id === selectedRef)?.name || '';

  const pendingRows = useMemo(() => {
    return churches
      .map((church) => {
        const repass = repasses.find((item) => item.churchId === church.id);
        return {
          churchId: church.id,
          churchName: church.name,
          federationName: church.federationName,
          amount: repass?.amount,
        };
      })
      .filter((row) => row.amount == null || row.amount < 150)
      .sort((a, b) => {
        const federationCompare = (a.federationName || '').localeCompare(b.federationName || '', 'pt-BR', {
          sensitivity: 'base',
        });
        if (federationCompare !== 0) return federationCompare;

        return a.churchName.localeCompare(b.churchName, 'pt-BR', { sensitivity: 'base' });
      });
  }, [churches, repasses]);

  const buildPendingRepassMessage = () => {
    if (!selectedReference) {
      throw new Error('Selecione uma referência para gerar a mensagem');
    }

    const competenceDate = parseReferenceCompetenceDate(selectedReference);
    if (!competenceDate) {
      throw new Error('Não foi possível identificar o mês da referência selecionada');
    }

    const deadline = getLastBusinessDayOfFollowingMonth(competenceDate);
    const monthName = MONTH_NAMES[competenceDate.getMonth()];
    const dueMonthName = MONTH_NAMES[deadline.getMonth()];
    const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}`;
    const dueMonthLabel = `${dueMonthName.charAt(0).toUpperCase()}${dueMonthName.slice(1)}`;
    // chargedMonth is one month before competenceDate (e.g., Maio -> Abril)
    const chargedMonthDate = new Date(competenceDate.getFullYear(), competenceDate.getMonth() - 1, 1);
    const chargedMonthName = MONTH_NAMES[chargedMonthDate.getMonth()];
    const chargedMonthLabel = `${chargedMonthName.charAt(0).toUpperCase()}${chargedMonthName.slice(1)}`;
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const deadlineVerb = deadlineDate < todayDate ? 'foi' : 'será';

    let pendingIndex = 0;
    const numberedPendingList = pendingRows.length
      ? (() => {
          const groups = pendingRows.reduce((map, row) => {
            const federationKey = (row.federationName || 'SEM FEDERAÇÃO').trim();
            const key = federationKey || 'SEM FEDERAÇÃO';
            const group = map.get(key) || [];
            group.push(row);
            map.set(key, group);
            return map;
          }, new Map<string, RepassRow[]>());

          // generate distinct 3-letter codes per federation (area)
          const used = new Set<string>();
          const areaCodeFor = new Map<string, string>();
          for (const areaName of groups.keys()) {
            const code = generateAreaCode(areaName, used);
            used.add(code);
            areaCodeFor.set(areaName, code);
          }

          const parts: string[] = [];
          for (const [areaName, groupRows] of groups) {
            const code = areaCodeFor.get(areaName) || generateAreaCode(areaName, used);
            for (const row of groupRows) {
              parts.push(`${++pendingIndex} - \t${row.churchName.toUpperCase()} \t| ${code}`);
            }
            parts.push('');
          }

          // remove trailing blank
          if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
          return parts.join('\n');
        })()
      : 'Nenhuma igreja pendente nesta referência.';

    return [
      'IMPORTANTE',
      '',
      `Igrejas sem efetuar o envio das informações por e-mail, ou sem ter feito o Repasse de ${selectedReference.name} até a presente data:`,
      '',
      numberedPendingList,
      '',
      `Dia ${formatDateBR(deadline)} ${deadlineVerb} o prazo final para o envio das informações para a Federação, através do e-mail: financeiro@icravivalista.com.br, referente ao repasse de ${selectedReference.name}.`,
    ].join('\n');
  };

  const handleGeneratePendingMessage = () => {
    try {
      const message = buildPendingRepassMessage();
      setPendingMessageContent(message);
      setShowPendingMessageModal(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar a mensagem');
    }
  };

  const handleCopyPendingMessage = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('A cópia automática não está disponível neste navegador');
      }

      await navigator.clipboard.writeText(pendingMessageContent);
      toast.success('Mensagem copiada para a área de transferência');
      setShowPendingMessageModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao copiar a mensagem');
    }
  };
  const orderedReferences = useMemo(() => sortReferencesChronologically(references), [references]);

  return (
    <ICRLayout title="Repasses">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`${isLight ? 'bg-white border border-[#cfe4dc]' : 'bg-[#2b2b2b]'} rounded-xl p-4`}>
          <div className="text-white/50 text-xs font-['Nunito'] uppercase tracking-wider mb-1">Total Repassado</div>
          <div className="text-[#017158] text-2xl font-['Nunito'] font-bold">{formatCurrency(totalPaid)}</div>
        </div>
        <div className={`${isLight ? 'bg-[#e3f2ec] border-[#b6dacd]' : 'bg-green-900/30 border-green-700/30'} border rounded-xl p-4`}>
          <div className={`${isLight ? 'text-[#277864]' : 'text-green-300/70'} text-xs font-['Nunito'] uppercase tracking-wider mb-1`}>Igrejas em Dia</div>
          <div className={`${isLight ? 'text-[#0f6d58]' : 'text-green-300'} text-2xl font-['Nunito'] font-bold`}>{paidCount}</div>
        </div>
        <div className={`${isLight ? 'bg-[#f9e5e5] border-[#e7bbbb]' : 'bg-red-900/30 border-red-700/30'} border rounded-xl p-4`}>
          <div className={`${isLight ? 'text-[#995050]' : 'text-red-300/70'} text-xs font-['Nunito'] uppercase tracking-wider mb-1`}>Pendentes</div>
          <div className={`${isLight ? 'text-[#943434]' : 'text-red-300'} text-2xl font-['Nunito'] font-bold`}>{pendingCount}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[18px]">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar igreja..."
              className={`${isLight ? 'bg-white border-[#cfe4dc] text-[#0f6d58]' : 'bg-[#2b2b2b] border-white/20 text-white'} border rounded-lg pl-9 pr-4 py-2 font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] transition-colors w-56`}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePendingMessage}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-['Nunito'] text-sm font-medium ${
              isLight
                ? 'bg-white border border-[#cfe4dc] text-[#0f6d58] hover:bg-[#f2f8f6]'
                : 'bg-[#2b2b2b] border border-white/20 text-white hover:bg-[#343434]'
            }`}
          >
            <span className="material-icons text-[18px]">content_copy</span>
            Gerar mensagem
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#017158] hover:bg-[#01a07e] text-white rounded-lg transition-colors font-['Nunito'] text-sm font-medium"
          >
            <span className="material-icons text-[18px]">add</span>
            Novo Repasse
          </button>
        </div>
      </div>

      {/* Reference tabs */}
      <div className={`${isLight ? 'bg-white border border-[#cfe4dc]' : 'bg-[#1a1a1a] border border-white/10'} rounded-xl rounded-b-none overflow-hidden mb-0`}>
        <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${isLight ? 'border-[#d8e9e2] bg-[#f8fcfa]' : 'border-white/10 bg-[#111]'}`}>
          <div>
            <div className="text-white/55 text-xs font-['Nunito'] uppercase tracking-wider">Referências</div>
            <div className="text-white/80 text-sm font-['Nunito']">Selecione a referência para ver e editar os repasses.</div>
          </div>
          <div className="text-white/45 text-xs font-['Nunito'] uppercase tracking-wider">
            {references.length} {references.length === 1 ? 'referência' : 'referências'}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap overflow-x-auto px-2 py-2 min-h-[52px]">
          {orderedReferences.length > 0 ? (
            orderedReferences.map((ref) => (
              <button
                key={ref.id}
                onClick={() => setSelectedRef(ref.id)}
                className={`px-4 py-2 text-sm font-['Nunito'] font-medium transition-colors border-b-2 whitespace-nowrap ${
                  selectedRef === ref.id
                    ? `${isLight ? 'text-[#0f6d58] border-[#017158] bg-[#017158]/10' : 'text-white border-[#017158] bg-[#017158]/10'}`
                    : `${isLight ? 'text-[#4b7c70] border-transparent hover:text-[#0f6d58] hover:border-[#017158]/30' : 'text-white/50 border-transparent hover:text-white/80 hover:border-white/20'}`
                }`}
              >
                {ref.name}
              </button>
            ))
          ) : (
            <div className={`px-4 py-2 text-sm font-['Nunito'] ${isLight ? 'text-[#4b7c70]' : 'text-white/50'}`}>
              Nenhuma referência disponível
            </div>
          )}
          <button
            type="button"
            onClick={openReferenceModal}
            className={`ml-auto inline-flex items-center justify-center gap-1 rounded-md border border-dashed px-3 py-2 text-sm font-['Nunito'] font-medium transition-colors ${
              isLight
                ? 'border-[#b6dacd] text-[#0f6d58] hover:bg-[#017158]/10 hover:border-[#017158]'
                : 'border-white/15 text-white/70 hover:bg-[#017158]/15 hover:border-[#017158]'
            }`}
            title="Nova referência"
          >
            <Plus className="h-4 w-4" />
            Nova referência
          </button>
        </div>
      </div>

      {/* Excel-like table */}
      {isLoading ? (
        <div className={`flex items-center justify-center h-48 rounded-b-xl rounded-tr-xl ${isLight ? 'bg-white border border-[#cfe4dc]' : 'bg-[#2b2b2b]'}`}>
          <div className="flex flex-col items-center gap-3">
            <span className="material-icons animate-spin text-[#017158] text-3xl">refresh</span>
            <p className="text-white/50 font-['Nunito'] text-sm">Carregando...</p>
          </div>
        </div>
      ) : error ? (
        isPermissionError(new Error(error)) ? (
          <div className="bg-[#2b2b2b] rounded-b-xl rounded-tr-xl">
            <PermissionDeniedError message={error} compact={true} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 bg-[#2b2b2b] rounded-b-xl rounded-tr-xl">
            <p className="text-red-400 font-['Nunito'] text-sm">{error}</p>
          </div>
        )
      ) : (
        <div className={`${isLight ? 'bg-white border-[#cfe4dc]' : 'bg-[#1a1a1a] border-white/10'} rounded-b-xl rounded-tr-xl overflow-hidden border`}>
          {/* TOTAL row */}
          <div className={`flex items-center px-4 py-3 border-b ${isLight ? 'border-[#d8e9e2] bg-[#f2f8f6]' : 'border-white/10 bg-[#0f0f0f]'}`}>
            <div className="flex-1">
              <span className="text-white font-['Nunito'] font-bold text-lg">TOTAL</span>
            </div>
            <div className="w-48 text-right">
              <span className="text-white font-['Nunito'] font-bold text-lg">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="w-32"></div>
          </div>

          {/* Table header */}
          <div className={`flex items-center px-4 py-2 border-b ${isLight ? 'bg-[#f8fcfa] border-[#d8e9e2]' : 'bg-[#111] border-white/20'}`}>
            <div className="flex-1 text-white/60 text-xs font-['Nunito'] font-semibold uppercase tracking-wider flex items-center gap-1">
              CIDADES
              <span className="material-icons text-[14px]">filter_list</span>
            </div>
            <div className="w-48 text-white/60 text-xs font-['Nunito'] font-semibold uppercase tracking-wider flex items-center gap-1">
              AREAS
              <span className="material-icons text-[14px]">filter_list</span>
            </div>
            <div className="w-48 text-right text-white/60 text-xs font-['Nunito'] font-semibold uppercase tracking-wider flex items-center justify-end gap-1">
              REPASSE REALIZADO
              <span className="material-icons text-[14px]">filter_list</span>
            </div>
            <div className="w-32 text-right text-white/60 text-xs font-['Nunito'] font-semibold uppercase tracking-wider flex items-center justify-end gap-1">
              CASO ESPECIAL
              <span className="material-icons text-[14px]">filter_list</span>
            </div>
            <div className="w-20 text-right text-white/60 text-xs font-['Nunito'] font-semibold uppercase tracking-wider">
              AÇÕES
            </div>
          </div>

          {/* Table rows */}
          <div className="overflow-y-auto max-h-[60vh]">
            {rows.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <span className="material-icons text-white/20 text-4xl">inbox</span>
                  <p className="text-white/40 font-['Nunito'] text-sm">Nenhuma igreja encontrada</p>
                </div>
              </div>
            ) : (
              rows.map((row, idx) => (
                <div
                  key={row.churchId}
                  className={`flex items-center px-4 py-2 border-b ${isLight ? 'border-[#e6f0ec]' : 'border-white/5'} transition-colors ${getRowColor(row)}`}
                >
                  <div className={`flex-1 font-['Nunito'] font-medium text-sm ${getRowTextColor(row)}`}>
                    {row.churchName}
                  </div>
                  <div className={`w-48 font-['Nunito'] text-sm ${getRowTextColor(row)}`}>
                    {row.federationName || '-'}
                  </div>
                  <div className={`w-48 text-right font-['Nunito'] font-bold text-sm ${getRowTextColor(row)}`}>
                    {row.amount && row.amount > 0 ? (
                      <span>
                        <span className="text-xs mr-1 opacity-70">R$</span>
                        {row.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className={`${isLight ? 'text-[#7ca294]' : 'text-white/20'} text-xs`}>—</span>
                    )}
                  </div>
                  <div className={`w-32 text-right font-['Nunito'] text-sm ${getRowTextColor(row)}`}>
                    {/* Caso especial placeholder */}
                    <span className={`${isLight ? 'text-[#7ca294]' : 'text-white/20'} text-xs`}>—</span>
                  </div>
                  <div className="w-20 flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(row)}
                      className="p-1 rounded text-white/30 hover:text-[#017158] hover:bg-[#017158]/10 transition-colors"
                      title={row.repass ? 'Editar repasse' : 'Registrar repasse'}
                    >
                      <span className="material-icons text-[16px]">{row.repass ? 'edit' : 'add_circle_outline'}</span>
                    </button>
                    {row.repass && (
                      <button
                        onClick={() => handleDelete(row.repass!)}
                        className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Excluir repasse"
                      >
                        <span className="material-icons text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div className={`flex items-center gap-4 px-4 py-3 border-t ${isLight ? 'border-[#d8e9e2] bg-[#f8fcfa]' : 'border-white/10 bg-[#0f0f0f]'}`}>
            <span className="text-white/40 text-xs font-['Nunito']">Legenda:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-600"></div>
              <span className="text-white/50 text-xs font-['Nunito']">Repasse Maior que o Mínimo (&gt; R$ 150)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-600"></div>
              <span className="text-white/50 text-xs font-['Nunito']">Repasse Mínimo (= R$ 150)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-700"></div>
              <span className="text-white/50 text-xs font-['Nunito']">Pendente</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editItem ? 'Editar Repasse' : 'Registrar Repasse'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <SmartSelect
                  label="Igreja"
                  selectedId={form.churchId}
                  selectedItem={churches.find(c => c.id === form.churchId) ? { id: churches.find(c => c.id === form.churchId)!.id, name: churches.find(c => c.id === form.churchId)!.name } : null}
                  onSelect={(id) => setForm({ ...form, churchId: id === '' ? '' : Number(id) })}
                  placeholder="Selecione a igreja"
                  fetchItems={fetchChurchItems}
                  required
                />
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Referência (Mês) *</label>
                <select
                  value={form.reference}
                  onChange={e => setForm({ ...form, reference: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                >
                  <option value="">Selecione a referência</option>
                  {references.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors font-['Nunito'] text-sm">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#017158] hover:bg-[#01a07e] text-white transition-colors font-['Nunito'] text-sm font-medium disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showReferenceModal} onOpenChange={setShowReferenceModal}>
        <DialogContent className={`${isLight ? 'bg-white border-[#cfe4dc]' : 'bg-[#2b2b2b] border-white/10'} text-white`}>
          <DialogHeader>
            <DialogTitle className="font-['Nunito']">Nova referência</DialogTitle>
            <DialogDescription className={isLight ? 'text-[#4b7c70]' : 'text-white/60'}>
              Informe o mês cobrado e confira a referência que será criada.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className={`block mb-1 text-sm font-['Nunito'] ${isLight ? 'text-[#4b7c70]' : 'text-white/70'}`}>
              Cobrado em: *</label>
            <input
              type="month"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className={`w-full rounded-lg border px-4 py-2.5 font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] ${
                isLight
                  ? 'bg-white border-[#cfe4dc] text-[#0f6d58]'
                  : 'bg-[#1c1c1c] border-white/20 text-white'
              }`}
            />
            <div className={`mt-3 rounded-lg border px-4 py-3 text-sm font-['Nunito'] ${isLight ? 'border-[#d8e9e2] bg-[#f8fcfa] text-[#4b7c70]' : 'border-white/10 bg-[#1c1c1c] text-white/70'}`}>
              <div>
                <span className="font-semibold">Cobrado em:</span> {getReferencePreview(referenceDate).cobradoEm || '---'}
              </div>
              <div className="mt-1">
                <span className="font-semibold">Referente à:</span> {getReferencePreview(referenceDate).referenteA || '---'}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReferenceModal(false)}
              className={isLight ? 'border-[#cfe4dc] bg-transparent text-[#0f6d58]' : 'border-white/15 bg-transparent text-white/80'}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateReference} disabled={savingReference} className="bg-[#017158] hover:bg-[#01a07e] text-white">
              {savingReference ? 'Criando...' : 'Criar referência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPendingMessageModal} onOpenChange={setShowPendingMessageModal}>
        <DialogContent className={`${isLight ? 'bg-white border-[#cfe4dc]' : 'bg-[#2b2b2b] border-white/10'} text-white max-w-2xl`}>
          <DialogHeader>
            <DialogTitle className="font-['Nunito']">Pré-visualização da mensagem de cobrança</DialogTitle>
            <DialogDescription className={isLight ? 'text-[#4b7c70]' : 'text-white/60'}>
              Revise a mensagem antes de copiar para a área de transferência.
            </DialogDescription>
          </DialogHeader>

          <div className={`rounded-lg border p-4 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed ${
            isLight
              ? 'bg-[#f8fcfa] border-[#d8e9e2] text-[#0f6d58]'
              : 'bg-[#1c1c1c] border-white/20 text-white/80'
          }`}>
            {pendingMessageContent}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPendingMessageModal(false)}
              className={isLight ? 'border-[#cfe4dc] bg-transparent text-[#0f6d58]' : 'border-white/15 bg-transparent text-white/80'}
            >
              Fechar
            </Button>
            <Button onClick={handleCopyPendingMessage} className="bg-[#017158] hover:bg-[#01a07e] text-white">
              <span className="material-icons mr-2 text-[18px]">content_copy</span>
              Copiar mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ICRLayout>
  );
}
