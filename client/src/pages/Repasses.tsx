import { useEffect, useState, useMemo } from 'react';
import ICRLayout from '../components/ICRLayout';
import { useICRApi, Repass, Reference, Church } from '../hooks/useICRApi';
import { toast } from 'sonner';
import { isPermissionError } from '@/lib/utils';
import PermissionDeniedError from '../components/PermissionDeniedError';

interface RepassRow {
  churchId: number;
  churchName: string;
  federationName?: string;
  state?: string;
  repass?: Repass;
  amount?: number;
}

interface RepassForm {
  churchId: number | '';
  reference: number | '';
  amount: number | '';
}

export default function Repasses() {
  const { fetchApi } = useICRApi();
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

  const loadAll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [refs, churchList] = await Promise.all([
        fetchApi<Reference[]>('/api/repasses/references'),
        fetchApi<Church[]>('/api/churches'),
      ]);
      setReferences(refs);
      setChurches(churchList);
      if (refs.length > 0 && !selectedRef) {
        setSelectedRef(refs[refs.length - 1].id);
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

  // Build rows: all churches with their repass status for selected reference
  const rows = useMemo((): RepassRow[] => {
    return churches
      .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.federationName || '').toLowerCase().includes(search.toLowerCase()))
      .map(church => {
        const repass = repasses.find(r => r.churchId === church.id);
        return {
          churchId: church.id,
          churchName: church.name,
          federationName: church.federationName,
          state: church.address?.state,
          repass,
          amount: repass?.amount,
        };
      });
  }, [churches, repasses, search]);

  // Summary
  const totalPaid = rows.filter(r => r.amount && r.amount > 0).reduce((sum, r) => sum + (r.amount || 0), 0);
  const paidCount = rows.filter(r => r.amount && r.amount > 0).length;
  const pendingCount = rows.filter(r => !r.amount || r.amount === 0).length;

 const getRowColor = (row: RepassRow): string => {
    const val = row.amount || 0;
    if (val > 150) return 'bg-green-900/40 hover:bg-green-900/50';
    if (val === 150) return 'bg-yellow-900/40 hover:bg-yellow-900/50';
    return 'bg-red-900/40 hover:bg-red-900/50'; // Menor que 150
  };

  const getRowTextColor = (row: RepassRow): string => {
    const val = row.amount || 0;
    if (val > 150) return 'text-green-200';
    if (val === 150) return 'text-yellow-200';
    return 'text-red-200'; // Menor que 150
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

  const selectedRefName = references.find(r => r.id === selectedRef)?.name || '';

  return (
    <ICRLayout title="Repasses">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#2b2b2b] rounded-xl p-4">
          <div className="text-white/50 text-xs font-['Nunito'] uppercase tracking-wider mb-1">Total Repassado</div>
          <div className="text-[#017158] text-2xl font-['Nunito'] font-bold">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-4">
          <div className="text-green-300/70 text-xs font-['Nunito'] uppercase tracking-wider mb-1">Igrejas em Dia</div>
          <div className="text-green-300 text-2xl font-['Nunito'] font-bold">{paidCount}</div>
        </div>
        <div className="bg-red-900/30 border border-red-700/30 rounded-xl p-4">
          <div className="text-red-300/70 text-xs font-['Nunito'] uppercase tracking-wider mb-1">Pendentes</div>
          <div className="text-red-300 text-2xl font-['Nunito'] font-bold">{pendingCount}</div>
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
              className="bg-[#2b2b2b] border border-white/20 rounded-lg pl-9 pr-4 py-2 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] transition-colors w-56"
            />
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#017158] hover:bg-[#01a07e] text-white rounded-lg transition-colors font-['Nunito'] text-sm font-medium"
        >
          <span className="material-icons text-[18px]">add</span>
          Novo Repasse
        </button>
      </div>

      {/* Reference tabs */}
      <div className="flex gap-1 flex-wrap mb-0 overflow-x-auto pb-0">
        {references.map((ref) => (
          <button
            key={ref.id}
            onClick={() => setSelectedRef(ref.id)}
            className={`px-4 py-2 text-sm font-['Nunito'] font-medium transition-colors border-b-2 whitespace-nowrap ${
              selectedRef === ref.id
                ? 'text-white border-[#017158] bg-[#017158]/10'
                : 'text-white/50 border-transparent hover:text-white/80 hover:border-white/20'
            }`}
          >
            {ref.name}
          </button>
        ))}
      </div>

      {/* Excel-like table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 bg-[#2b2b2b] rounded-b-xl rounded-tr-xl">
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
        <div className="bg-[#1a1a1a] rounded-b-xl rounded-tr-xl overflow-hidden border border-white/10">
          {/* TOTAL row */}
          <div className="flex items-center px-4 py-3 border-b border-white/10 bg-[#0f0f0f]">
            <div className="flex-1">
              <span className="text-white font-['Nunito'] font-bold text-lg">TOTAL</span>
            </div>
            <div className="w-48 text-right">
              <span className="text-white font-['Nunito'] font-bold text-lg">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="w-32"></div>
          </div>

          {/* Table header */}
          <div className="flex items-center px-4 py-2 bg-[#111] border-b border-white/20">
            <div className="flex-1 text-white/60 text-xs font-['Nunito'] font-semibold uppercase tracking-wider flex items-center gap-1">
              CIDADES
              <span className="material-icons text-[14px]">filter_list</span>
            </div>
            <div className="w-32 text-white/60 text-xs font-['Nunito'] font-semibold uppercase tracking-wider flex items-center gap-1">
              ESTADOS
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
                  className={`flex items-center px-4 py-2 border-b border-white/5 transition-colors ${getRowColor(row)}`}
                >
                  <div className={`flex-1 font-['Nunito'] font-medium text-sm ${getRowTextColor(row)}`}>
                    {row.churchName}
                  </div>
                  <div className={`w-32 font-['Nunito'] text-sm ${getRowTextColor(row)}`}>
                    {row.state || row.federationName || '-'}
                  </div>
                  <div className={`w-48 text-right font-['Nunito'] font-bold text-sm ${getRowTextColor(row)}`}>
                    {row.amount && row.amount > 0 ? (
                      <span>
                        <span className="text-xs mr-1 opacity-70">R$</span>
                        {row.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </div>
                  <div className={`w-32 text-right font-['Nunito'] text-sm ${getRowTextColor(row)}`}>
                    {/* Caso especial placeholder */}
                    <span className="text-white/20 text-xs">—</span>
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
          <div className="flex items-center gap-4 px-4 py-3 border-t border-white/10 bg-[#0f0f0f]">
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
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Igreja *</label>
                <select
                  value={form.churchId}
                  onChange={e => setForm({ ...form, churchId: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                >
                  <option value="">Selecione a igreja</option>
                  {churches.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
    </ICRLayout>
  );
}
