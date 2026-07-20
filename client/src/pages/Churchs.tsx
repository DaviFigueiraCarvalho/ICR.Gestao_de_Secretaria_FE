import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import MultiSelect from '../components/MultiSelect';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { getScopeLevel } from '../lib/scope-access';
import { useICRApi, Church, Federation, Minister } from '../hooks/useICRApi';
import { settledValue } from '@/lib/utils';
import { buildPaginatedListEndpoint } from '../lib/paginated-list-query';
import { useViaCEP } from '../hooks/useViaCEP';
import { countrySelectItems, DEFAULT_COUNTRY_CODE, formatPostalCode, normalizePostalCode } from '../lib/country';
import { toast } from 'sonner';

interface IgrejaForm {
  name: string;
  federationId: number | '';
  ministerId: number | '';
  countryCode: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  state: string;
  countyOrRegion: string;
}

export default function Igrejas() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const { fetchCEP, loading: cepLoading, error: cepError } = useViaCEP();
  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  const isFederatedScope = scopeLevel === 'federated';
  const isLocalScope = scopeLevel === 'local';
  const [data, setData] = useState<Church[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Church | null>(null);
  const [form, setForm] = useState<IgrejaForm>({
    name: '', federationId: '', ministerId: '',
    countryCode: DEFAULT_COUNTRY_CODE, postalCode: '', street: '', number: '', complement: '', city: '', state: '', countyOrRegion: '',
  });
  const [saving, setSaving] = useState(false);
  const [federations, setFederations] = useState<Federation[]>([]);
  const [ministers, setMinisters] = useState<Minister[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedFederationId, setSelectedFederationId] = useState<number | undefined>(() =>
    isFederatedScope && typeof user?.federationId === 'number' ? user.federationId : undefined,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const latestChurchesRequestRef = useRef(0);

  const usesSingleChurchEndpoint = isLocalScope && typeof user?.churchId === 'number';
  const churchesEndpoint = useMemo(() => {
    const path = typeof selectedFederationId === 'number'
      ? `/api/churches/federation/${selectedFederationId}`
      : '/api/churches';

    return buildPaginatedListEndpoint(path, {
      pageNumber: page,
      pageQuantity: pageSize,
      querySearch: debouncedSearchTerm,
    });
  }, [debouncedSearchTerm, page, pageSize, selectedFederationId]);

  const loadChurches = useCallback(async () => {
    const requestId = ++latestChurchesRequestRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = usesSingleChurchEndpoint
        ? await fetchApi<Church>(`/api/churches/${user?.churchId}`)
        : await fetchApi<Church[]>(churchesEndpoint);

      if (requestId !== latestChurchesRequestRef.current) return;

      const churchesData = usesSingleChurchEndpoint
        ? result && !Array.isArray(result) ? [result as Church] : []
        : Array.isArray(result) ? result : [];

      if (!usesSingleChurchEndpoint && page > 1 && churchesData.length === 0) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
        return;
      }

      setData(churchesData);
      setHasNextPage(!usesSingleChurchEndpoint && churchesData.length === pageSize);
    } catch (err) {
      if (requestId === latestChurchesRequestRef.current) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar igrejas');
      }
    } finally {
      if (requestId === latestChurchesRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [churchesEndpoint, fetchApi, page, pageSize, user?.churchId, usesSingleChurchEndpoint]);

  useEffect(() => {
    void loadChurches();

    return () => {
      latestChurchesRequestRef.current += 1;
    };
  }, [loadChurches]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearchTerm(searchTerm.trim());
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    const loadReferenceData = async () => {
      const federationsRequest = isLocalScope
        ? Promise.resolve<Federation[]>([])
        : fetchApi<Federation[]>('/api/federations');

      const [federationsResult, ministersResult] = await Promise.allSettled([
        federationsRequest,
        fetchApi<Minister[]>('/api/ministers?pageNumber=1&pageQuantity=200'),
      ]);

      setFederations(settledValue(federationsResult) ?? []);
      setMinisters(settledValue(ministersResult) ?? []);
    };

    void loadReferenceData();
  }, [fetchApi, isLocalScope]);

  const handlePostalCodeChange = async (value: string) => {
    const normalizedPostalCode = normalizePostalCode(form.countryCode, value);
    setForm(prev => ({ ...prev, postalCode: normalizedPostalCode }));
    
    if (form.countryCode !== 'BR') return;

    const cleanCEP = normalizedPostalCode;
    if (cleanCEP.length === 8) {
      const cepData = await fetchCEP(value);
      if (cepData) {
        setForm(prev => ({
          ...prev,
          street: cepData.street,
          city: cepData.city,
          state: cepData.state,
        }));
        toast.success('Endereço preenchido automaticamente');
      }
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', federationId: '', ministerId: '', countryCode: DEFAULT_COUNTRY_CODE, postalCode: '', street: '', number: '', complement: '', city: '', state: '', countyOrRegion: '' });
    setShowModal(true);
  };

  const openEdit = (item: Church) => {
    setEditItem(item);
    setForm({
      name: item.name,
      federationId: item.federationId || '',
      ministerId: item.ministerId || '',
      countryCode: item.address?.countryCode || DEFAULT_COUNTRY_CODE,
      postalCode: item.address?.postalCode || '',
      street: item.address?.street || '',
      number: item.address?.number || '',
      complement: item.address?.complement || '',
      city: item.address?.city || '',
      state: item.address?.state || '',
      countyOrRegion: item.address?.countyOrRegion || '',
    });
    setShowModal(true);
  };

const handleSave = async () => {
  // 1. Validações básicas no Front
  if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
  if (!form.federationId) { toast.error('Area é obrigatória'); return; }

  // 2. Limpeza do CEP (Remove hífens e pontos) para evitar o erro de 8 dígitos do Backend
  const normalizedPostalCode = normalizePostalCode(form.countryCode, form.postalCode);

  if (form.countryCode === 'BR' && normalizedPostalCode.length > 0 && normalizedPostalCode.length !== 8) {
    toast.error('O CEP deve conter exatamente 8 números');
    return;
  }

  setSaving(true);
  try {
    // 3. Montagem do body seguindo exatamente o ChurchPatchDTO
    const body = {
      name: form.name,
      federationId: Number(form.federationId),
      ministerId: form.ministerId ? Number(form.ministerId) : 0,
      address: {
        countryCode: form.countryCode,
        postalCode: normalizedPostalCode,
        street: form.street,
        number: form.number,
        complement: form.complement,
        city: form.city,
        state: form.state,
        countyOrRegion: form.countyOrRegion,
      }
    }; 

    if (editItem) {
    await fetchApi(`/api/churches/${editItem.id}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});      toast.success('Igreja atualizada com sucesso');
    } else {
      await fetchApi('/api/churches', { 
        method: 'POST', 
        body: JSON.stringify(body) 
      });
      toast.success('Igreja criada com sucesso');
    }

    setShowModal(false);
    await loadChurches();
  } catch (err) {
    console.error("Erro detalhado:", err);
    toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
  } finally {
    setSaving(false);
  }
};
  const handleDelete = async (item: Church) => {
    await fetchApi(`/api/churches/${item.id}`, { method: 'DELETE' });
    await loadChurches();
  };

  const columns: Column<Church>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'federationName', label: 'Área', render: (item) => item.federationName || '-' },
    { key: 'ministerName', label: 'Ministro', render: (item) => item.ministerName || '-' },
    { key: 'city', label: 'Cidade', render: (item) => item.address?.city || '-' },
    { key: 'state', label: 'Estado', render: (item) => item.address?.state || '-' },
  ];

  const lockedFederationId = useMemo(() => {
    if (!isFederatedScope) return undefined;

    if (typeof user?.federationId === 'number') return user.federationId;

    if (typeof user?.memberId === 'number') {
      const ministerFromMember = ministers.find((minister) => minister.memberId === user.memberId);
      if (ministerFromMember?.id) {
        const federationFromMinister = federations.find((federation) => federation.ministerId === ministerFromMember.id);
        if (federationFromMinister?.id) return federationFromMinister.id;
      }
    }

    if (federations.length === 1) return federations[0].id;
    return federations[0]?.id;
  }, [federations, isFederatedScope, ministers, user?.federationId, user?.memberId]);

  useEffect(() => {
    if (!isFederatedScope || !lockedFederationId) return;

    setSelectedFederationId(lockedFederationId);
    setPage(1);
    setForm((prev) => ({ ...prev, federationId: lockedFederationId }));
  }, [isFederatedScope, lockedFederationId]);

  const setF = (key: keyof IgrejaForm, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));
  const handlePageSizeChange = (size: number) => {
    const safeSize = Math.min(100, Math.max(1, size));
    setPageSize(safeSize);
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleFederationFilterChange = (ids: number[]) => {
    setSelectedFederationId(ids[ids.length - 1]);
    setPage(1);
  };

  const topFilters = !isFederatedScope && !isLocalScope ? (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <MultiSelect
        label="Filtro por Federação"
        selectedIds={typeof selectedFederationId === 'number' ? [selectedFederationId] : []}
        onChange={handleFederationFilterChange}
        maxSelections={1}
        placeholder="Todas as áreas"
        fetchItems={async (page, query) => {
          const result = await fetchApi<Federation[]>(`/api/federations?pageNumber=${page}&pageQuantity=10&search=${encodeURIComponent(query.trim())}`);
          return Array.isArray(result) ? result.map(f => ({ id: f.id, name: `${f.id} - ${f.name}` })) : [];
        }}
      />
    </div>
  ) : null;

  return (
    <ICRLayout title="Igrejas">
      <CRUDTable
        title="Igrejas"
        topContent={topFilters}
        data={data}
        searchable={!usesSingleChurchEndpoint}
        serverPagination={!usesSingleChurchEndpoint ? {
          currentPage: page,
          pageSize,
          hasNextPage,
          onPageChange: setPage,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions: [10, 25, 50, 100],
        } : undefined}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={loadChurches}
        searchPlaceholder="Buscar igreja..."
        onSearch={!usesSingleChurchEndpoint ? handleSearch : undefined}
        emptyMessage="Nenhuma igreja encontrada"
        addLabel="Nova Igreja"
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editItem ? 'Editar Igreja' : 'Nova Igreja'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nome *</label>
                  <input type="text" value={form.name} onChange={e => setF('name', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="Nome da igreja" />
                </div>
                <SmartSelect
                  className="col-span-2"
                  label="País"
                  selectedId={form.countryCode}
                  selectedItem={countrySelectItems.find(c => c.id === form.countryCode) || null}
                  onSelect={(id) => {
                    const countryCode = typeof id === 'string' ? id : DEFAULT_COUNTRY_CODE;
                    setForm((prev) => ({ ...prev, countryCode, postalCode: '' }));
                  }}
                  fetchItems={async (page, query) => {
                    const filtered = countrySelectItems.filter(c => 
                      c.name.toLowerCase().includes(query.toLowerCase())
                    );
                    const start = (page - 1) * 10;
                    const end = start + 10;
                    return filtered.slice(start, end);
                  }}
                  placeholder="Selecione um país"
                  required
                />
                <SmartSelect
                  label="Area"
                  selectedId={form.federationId}
                  selectedItem={federations.find(f => f.id === form.federationId) ? { id: federations.find(f => f.id === form.federationId)!.id, name: federations.find(f => f.id === form.federationId)!.name } : null}
                  onSelect={(id) => {
                    if (isFederatedScope) return;
                    setF('federationId', typeof id === 'number' ? id : '');
                  }}
                  fetchItems={async (page, query) => {
                    const params = new URLSearchParams();
                    params.append('pageNumber', String(page));
                    params.append('pageQuantity', '10');
                    if (query) params.append('query', query);
                    const result = await fetchApi<Federation[]>(`/api/federations?${params}`);
                    return Array.isArray(result) ? result.map(f => ({ id: f.id, name: f.name })) : [];
                  }}
                  placeholder="Selecione uma área"
                  required
                  disabled={isFederatedScope}
                />
                <SmartSelect
                  label="Ministro"
                  selectedId={form.ministerId}
                  selectedItem={ministers.find(m => m.id === form.ministerId) ? { id: ministers.find(m => m.id === form.ministerId)!.id, name: ministers.find(m => m.id === form.ministerId)!.memberName || ministers.find(m => m.id === form.ministerId)!.id.toString() } : null}
                  onSelect={(id) => setF('ministerId', typeof id === 'number' ? id : '')}
                  fetchItems={async (page, query) => {
                    const params = new URLSearchParams();
                    params.append('pageNumber', String(page));
                    params.append('pageQuantity', '10');
                    if (query) params.append('query', query);
                    const result = await fetchApi<Minister[]>(`/api/ministers?${params}`);
                    return Array.isArray(result) ? result.map(m => ({ id: m.id, name: m.memberName || m.id.toString() })) : [];
                  }}
                  placeholder="Selecione um ministro"
                />
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-white/50 text-xs font-['Nunito'] mb-3 uppercase tracking-wider">Endereço</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">{form.countryCode === 'BR' ? 'CEP' : 'Código postal'} {form.countryCode === 'BR' && cepLoading && <span className="text-[#017158] text-xs">buscando...</span>}</label>
                    <input 
                      type="text" 
                      value={formatPostalCode(form.countryCode, form.postalCode)} 
                      onChange={e => handlePostalCodeChange(e.target.value)}
                      disabled={form.countryCode === 'BR' && cepLoading}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                      placeholder={form.countryCode === 'BR' ? '00000-000' : 'Informe o código postal'} 
                    />
                    {form.countryCode === 'BR' && cepError && <p className="text-red-400 text-xs mt-1">{cepError}</p>}
                  </div>
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Número</label>
                    <input type="text" value={form.number} onChange={e => setF('number', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      placeholder="Nº" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Rua</label>
                    <input type="text" value={form.street} onChange={e => setF('street', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      placeholder="Nome da rua" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Complemento</label>
                    <input type="text" value={form.complement} onChange={e => setF('complement', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      placeholder="Apto, bloco, referência" />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Cidade</label>
                    <input type="text" value={form.city} onChange={e => setF('city', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      placeholder="Cidade" />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Estado</label>
                    <input type="text" value={form.state} onChange={e => setF('state', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      placeholder="UF" maxLength={2} />
                  </div>
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Região/Condado</label>
                    <input type="text" value={form.countyOrRegion} onChange={e => setF('countyOrRegion', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      placeholder="Condado, província, região" />
                  </div>
                </div>
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
