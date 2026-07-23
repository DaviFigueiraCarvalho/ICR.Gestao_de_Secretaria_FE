import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import MultiSelect from '../components/MultiSelect';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { buildLocalChurchFallback, getScopeLevel, resolveScopeRestrictions } from '../lib/scope-access';
import { useICRApi, Cell, Church, Family, Federation, Member, Minister } from '../hooks/useICRApi';
import { settledValue } from '@/lib/utils';
import { buildPaginatedListEndpoint } from '../lib/paginated-list-query';
import { toast } from 'sonner';

interface CelulaForm {
  name: string;
  type: number | '';
  churchId: number | '';
  responsibleId: number | '';
}

const CELL_TYPE_OPTIONS = [
  { value: 0, label: 'Celula' },
  { value: 1, label: 'Comunidade Missionaria' },
];

const getCellTypeValue = (value: unknown): number | '' => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : '';
  }
  return '';
};

const getCellTypeLabel = (value: unknown, typeName?: string): string => {
  if (typeName?.trim()) return typeName;
  const numericType = getCellTypeValue(value);
  if (numericType === '') {
    if (typeof value === 'string' && value.trim()) return value;
    return '-';
  }
  return CELL_TYPE_OPTIONS.find((option) => option.value === numericType)?.label ?? `Tipo ${numericType}`;
};

const getFriendlyCellSaveError = (message: string): string => {
  const normalized = message.toLowerCase();

  if (normalized.includes('duplicate') || normalized.includes('unique') || normalized.includes('23505')) {
    return 'Ja existe uma celula com esse nome. Tente outro nome.';
  }

  if (normalized.includes('foreign key') || normalized.includes('23503')) {
    return 'Igreja ou responsavel invalido. Atualize os dados e tente novamente.';
  }

  return message;
};

export default function Celulas() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  const isLocalScope = scopeLevel === 'local';
  const isFederatedScope = scopeLevel === 'federated';
  const [data, setData] = useState<Cell[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Cell | null>(null);
  const [form, setForm] = useState<CelulaForm>({ name: '', type: '', churchId: '', responsibleId: '' });
  const [saving, setSaving] = useState(false);
  const [churches, setChurches] = useState<Church[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [federations, setFederations] = useState<Federation[]>([]);
  const [ministers, setMinisters] = useState<Minister[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedFederationId, setSelectedFederationId] = useState<number | undefined>(() =>
    isFederatedScope && typeof user?.federationId === 'number' ? user.federationId : undefined,
  );
  const [selectedChurchId, setSelectedChurchId] = useState<number | undefined>(() =>
    isLocalScope && typeof user?.churchId === 'number' ? user.churchId : undefined,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const latestCellsRequestRef = useRef(0);

  const cellsEndpoint = useMemo(() => {
    const hasFilter = typeof selectedFederationId === 'number' || typeof selectedChurchId === 'number';
    return buildPaginatedListEndpoint(
      hasFilter ? '/api/cells/filter' : '/api/cells',
      {
        pageNumber: page,
        pageQuantity: pageSize,
        querySearch: debouncedSearchTerm,
        filters: hasFilter
          ? { federationId: selectedFederationId, churchId: selectedChurchId }
          : undefined,
      },
    );
  }, [debouncedSearchTerm, page, pageSize, selectedChurchId, selectedFederationId]);

  const loadCells = useCallback(async () => {
    const requestId = ++latestCellsRequestRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchApi<Cell[]>(cellsEndpoint);
      if (requestId !== latestCellsRequestRef.current) return;

      const cellsData = Array.isArray(result) ? result : [];
      if (page > 1 && cellsData.length === 0) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
        return;
      }

      setData(cellsData);
      setHasNextPage(cellsData.length === pageSize);
    } catch (err) {
      if (requestId === latestCellsRequestRef.current) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar células');
      }
    } finally {
      if (requestId === latestCellsRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [cellsEndpoint, fetchApi, page, pageSize]);

  useEffect(() => {
    void loadCells();

    return () => {
      latestCellsRequestRef.current += 1;
    };
  }, [loadCells]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearchTerm(searchTerm.trim());
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    const loadReferenceData = async () => {
      const churchesRequest = isLocalScope && typeof user?.churchId === 'number'
        ? fetchApi<Church>(`/api/churches/${user.churchId}`)
            .then((church) => [church])
            .catch(() => buildLocalChurchFallback(user.churchId))
        : fetchApi<Church[]>('/api/churches');

      const federationsRequest = isLocalScope
        ? Promise.resolve<Federation[]>([])
        : fetchApi<Federation[]>('/api/federations');

      const ministersRequest = isLocalScope
        ? Promise.resolve<Minister[]>([])
        : fetchApi<Minister[]>('/api/ministers?pageNumber=1&pageQuantity=200');

      const [churchesResult, familiesResult, federationsResult, ministersResult, membersResult] = await Promise.allSettled([
        churchesRequest,
        fetchApi<Family[]>('/api/families?pageNumber=1&pageQuantity=200'),
        federationsRequest,
        ministersRequest,
        fetchApi<Member[]>('/api/members?pageNumber=1&pageQuantity=200'),
      ]);

      setChurches(settledValue(churchesResult) ?? []);
      setFamilies(Array.isArray(settledValue(familiesResult)) ? settledValue(familiesResult) ?? [] : []);
      setFederations(settledValue(federationsResult) ?? []);
      setMinisters(Array.isArray(settledValue(ministersResult)) ? settledValue(ministersResult) ?? [] : []);
      setMembers(settledValue(membersResult) ?? []);
    };

    void loadReferenceData();
  }, [fetchApi, isLocalScope, user?.churchId]);

  const openAdd = () => {
    setEditItem(null);
    setForm({
      name: '',
      type: '',
      churchId: isLocalScope ? restrictions.lockedChurchId || '' : '',
      responsibleId: '',
    });
    setShowModal(true);
  };

  const openEdit = (item: Cell) => {
    setEditItem(item);
    setForm({
      name: item.name,
      type: getCellTypeValue(item.type),
      churchId: item.churchId || '',
      responsibleId: item.responsibleId || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();

    if (!trimmedName) { toast.error('Nome é obrigatório'); return; }
    if (!form.churchId) { toast.error('Igreja é obrigatória'); return; }

    setSaving(true);
    try {
      const body = {
        name: trimmedName,
        type: form.type === '' ? undefined : form.type,
        churchId: Number(form.churchId),
        responsibleId: form.responsibleId ? Number(form.responsibleId) : null,
      };
      if (editItem) {
        await fetchApi(`/api/cells/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('Célula atualizada com sucesso');
      } else {
        await fetchApi('/api/cells', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Célula criada com sucesso');
      }
      setShowModal(false);
      void loadCells();
    } catch (err) {
      if (err instanceof Error) {
        toast.error(getFriendlyCellSaveError(err.message));
      } else {
        toast.error('Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Cell) => {
    await fetchApi(`/api/cells/${item.id}`, { method: 'DELETE' });
    await loadCells();
  };

  const columns: Column<Cell>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo', render: (item) => getCellTypeLabel(item.type, item.typeName) },
    {
      key: 'church',
      label: 'Igreja',
      render: (item) => item.church?.name || churches.find((church) => church.id === item.churchId)?.name || '-',
    },
    { key: 'responsible', label: 'Responsável', render: (item) => item.responsible?.name || '-' },
  ];

  const restrictions = useMemo(
    () => resolveScopeRestrictions({
      scopeLevel,
      userMemberId: user?.memberId,
      userFamilyId: user?.familyId,
      userChurchId: user?.churchId,
      userFederationId: user?.federationId,
      churches,
      federations,
      members,
      families,
      ministers,
    }),
    [churches, families, federations, members, ministers, scopeLevel, user?.churchId, user?.familyId, user?.federationId, user?.memberId],
  );

  const scopedChurches = useMemo(() => {
    if (scopeLevel === 'federation') return churches;

    const allowedChurchIds = new Set(restrictions.allowedChurchIds);
    return churches.filter((church) => allowedChurchIds.has(church.id));
  }, [churches, restrictions.allowedChurchIds, scopeLevel]);

  const scopedFederationIds = useMemo(() => {
    if (scopeLevel === 'federation') return new Set(federations.map((federation) => federation.id));

    if (typeof restrictions.lockedFederationId === 'number') {
      return new Set([restrictions.lockedFederationId]);
    }

    return new Set(scopedChurches.map((church) => church.federationId));
  }, [federations, restrictions.lockedFederationId, scopeLevel, scopedChurches]);

  useEffect(() => {
    if (isFederatedScope && typeof restrictions.lockedFederationId === 'number') {
      setSelectedFederationId(restrictions.lockedFederationId);
      setPage(1);
    }

    if (isLocalScope && typeof restrictions.lockedChurchId === 'number') {
      setSelectedChurchId(restrictions.lockedChurchId);
      setPage(1);
    }
  }, [isFederatedScope, isLocalScope, restrictions.lockedChurchId, restrictions.lockedFederationId]);

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
    setSelectedChurchId(undefined);
    setPage(1);
  };

  const handleChurchFilterChange = (ids: number[]) => {
    setSelectedChurchId(ids[ids.length - 1]);
    setPage(1);
  };

  const fetchChurchFilterItems = async (filterPage: number, query: string) => {
    const path = typeof selectedFederationId === 'number'
      ? `/api/churches/federation/${selectedFederationId}`
      : '/api/churches';
    const endpoint = buildPaginatedListEndpoint(path, {
      pageNumber: filterPage,
      pageQuantity: 10,
      querySearch: query,
    });
    const result = await fetchApi<Church[]>(endpoint);
    return Array.isArray(result) ? result.map(c => ({ id: c.id, name: `${c.id} - ${c.name}` })) : [];
  };

  const fetchChurchItems = async (selectPage: number, query: string) => {
    const path = isFederatedScope && typeof restrictions.lockedFederationId === 'number'
      ? `/api/churches/federation/${restrictions.lockedFederationId}`
      : '/api/churches';
    const endpoint = buildPaginatedListEndpoint(path, {
      pageNumber: selectPage,
      pageQuantity: 10,
      querySearch: query,
    });
    const result = await fetchApi<Church[]>(endpoint);
    const churchResults = Array.isArray(result) ? result : [];

    setChurches((previousChurches) => {
      const churchesById = new Map(previousChurches.map((church) => [church.id, church]));
      churchResults.forEach((church) => churchesById.set(church.id, church));
      return Array.from(churchesById.values());
    });

    const allowedChurchIds = new Set(scopedChurches.map((church) => church.id));
    const visibleChurches = scopeLevel === 'federation'
      ? churchResults
      : churchResults.filter((church) => allowedChurchIds.has(church.id));

    return visibleChurches.map((church) => ({ id: church.id, name: `${church.id} - ${church.name}` }));
  };

  const fetchResponsibleItems = async (selectPage: number, query: string) => {
    if (!form.churchId) return [];

    const params = new URLSearchParams();
    params.append('pageNumber', String(selectPage));
    params.append('pageQuantity', '10');
    params.append('churchId', String(form.churchId));
    if (query.trim()) params.append('querySearch', query.trim());

    const result = await fetchApi<Member[]>(`/api/members/filter?${params.toString()}`);
    const memberResults = Array.isArray(result) ? result : [];
    setMembers((previousMembers) => {
      const membersById = new Map(previousMembers.map((member) => [member.id, member]));
      memberResults.forEach((member) => membersById.set(member.id, member));
      return Array.from(membersById.values());
    });

    return memberResults.map((member) => ({ id: member.id, name: member.name }));
  };

  const topFilters = (
    <>
      {!isLocalScope && !isFederatedScope && (
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
          <MultiSelect
            label="Filtro por Igreja"
            selectedIds={typeof selectedChurchId === 'number' ? [selectedChurchId] : []}
            onChange={handleChurchFilterChange}
            maxSelections={1}
            placeholder="Todas as igrejas"
            fetchItems={fetchChurchFilterItems}
          />
        </div>
      )}

      {isFederatedScope && (
        <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
          <MultiSelect
            label="Filtro por Igreja"
            selectedIds={typeof selectedChurchId === 'number' ? [selectedChurchId] : []}
            onChange={handleChurchFilterChange}
            maxSelections={1}
            placeholder="Igrejas da sua comissão"
            fetchItems={fetchChurchFilterItems}
          />
        </div>
      )}
    </>
  );

  return (
    <ICRLayout title="Células">
      <CRUDTable
        title="Células"
        topContent={topFilters}
        data={data}
        serverPagination={{
          currentPage: page,
          pageSize,
          hasNextPage,
          onPageChange: setPage,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions: [10, 25, 50, 100],
        }}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={loadCells}
        searchPlaceholder="Buscar célula..."
        onSearch={handleSearch}
        emptyMessage="Nenhuma célula encontrada"
        addLabel="Nova Célula"
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editItem ? 'Editar Célula' : 'Nova Célula'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nome *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder="Nome da célula" />
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white focus:border-[#017158] outline-none"
                >
                  <option value="">Selecione um tipo</option>
                  {CELL_TYPE_OPTIONS.map((cellType) => (
                    <option key={cellType.value} value={cellType.value}>{cellType.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <SmartSelect
                  label="Igreja"
                  selectedId={form.churchId}
                  selectedItem={churches.find(c => c.id === form.churchId) ? { id: churches.find(c => c.id === form.churchId)!.id, name: `${churches.find(c => c.id === form.churchId)!.id} - ${churches.find(c => c.id === form.churchId)!.name}` } : null}
                  onSelect={(id) => setForm((previousForm) => ({
                    ...previousForm,
                    churchId: id === '' ? '' : Number(id),
                    responsibleId: '',
                  }))}
                  fetchItems={fetchChurchItems}
                  placeholder="Selecione uma igreja"
                  disabled={isLocalScope}
                />
              </div>
              <SmartSelect
                label="Responsável"
                selectedId={form.responsibleId}
                selectedItem={members.find(m => m.id === form.responsibleId) ? { id: members.find(m => m.id === form.responsibleId)!.id, name: members.find(m => m.id === form.responsibleId)!.name } : null}
                onSelect={(id) => setForm((previousForm) => ({ ...previousForm, responsibleId: id === '' ? '' : Number(id) }))}
                fetchItems={fetchResponsibleItems}
                disabled={!form.churchId}
                placeholder="Selecione um responsável"
              />
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
