import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import MultiSmartSelect from '../components/MultiSmartSelect';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { getScopeLevel, resolveScopeRestrictions } from '../lib/scope-access';
import { useICRApi, Family, Church, Cell, Federation, Member, Minister } from '../hooks/useICRApi';
import { toast } from 'sonner';

interface FamiliaForm {
  name: string;
  churchId: number | '';
  cellId: number | '';
  manId: number | '';
  womanId: number | '';
  weddingDate: string;
}

export default function Familias() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const todayDate = new Date().toISOString().split('T')[0];
  const [data, setData] = useState<Family[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Family | null>(null);
  const [form, setForm] = useState<FamiliaForm>({ name: '', churchId: '', cellId: '', manId: '', womanId: '', weddingDate: '' });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [serverPaginationEnabled, setServerPaginationEnabled] = useState(true);
  const [churches, setChurches] = useState<Church[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [federations, setFederations] = useState<Federation[]>([]);
  const [ministers, setMinisters] = useState<Minister[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedFederationIds, setSelectedFederationIds] = useState<number[]>([]);
  const [selectedChurchIds, setSelectedChurchIds] = useState<number[]>([]);
  const [selectedCellIds, setSelectedCellIds] = useState<number[]>([]);
  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  const isLocalScope = scopeLevel === 'local';
  const isFederatedScope = scopeLevel === 'federated';
  const isForbiddenError = (err: unknown) =>
    err instanceof Error && (err.message.includes('403') || err.message.toLowerCase().includes('forbidden'));

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [churchesRes, cellsRes, federationsRes, ministersRes, membersRes] = await Promise.all([
          fetchApi<Church[]>('/api/churches'),
          fetchApi<Cell[]>('/api/cells'),
          fetchApi<Federation[]>('/api/federations'),
          fetchApi<Minister[]>('/api/ministers?page=1&pageSize=200'),
          fetchApi<Member[]>('/api/members'),
        ]);
        setChurches(churchesRes);
        setCells(cellsRes);
        setFederations(federationsRes);
        setMinisters(Array.isArray(ministersRes) ? ministersRes : []);
        setMembers(membersRes);
      } catch (err) {
        console.error('Erro ao carregar dados auxiliares:', err);
      }
    };

    loadLookups();
  }, []);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchApi<Family[]>(
        serverPaginationEnabled
          ? `/api/families?page=${page}&pageSize=${pageSize}`
          : '/api/families',
      );
      const familiesData = Array.isArray(result) ? result : [];

      if (serverPaginationEnabled && page > 1 && familiesData.length === 0) {
        setPage((prev) => Math.max(1, prev - 1));
        return;
      }

      setData(familiesData);
      setHasNextPage(serverPaginationEnabled && familiesData.length === pageSize);
    } catch (err) {
      if (serverPaginationEnabled && isForbiddenError(err)) {
        try {
          const fallbackResult = await fetchApi<Family[]>('/api/families');
          setData(Array.isArray(fallbackResult) ? fallbackResult : []);
          setHasNextPage(false);
          setServerPaginationEnabled(false);
          setPage(1);
          return;
        } catch (fallbackErr) {
          setError(fallbackErr instanceof Error ? fallbackErr.message : 'Erro ao carregar famílias');
          return;
        }
      }

      setError(err instanceof Error ? err.message : 'Erro ao carregar famílias');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, pageSize, serverPaginationEnabled]);

  const openAdd = () => {
    setEditItem(null);
    setForm({
      name: '',
      churchId: isLocalScope ? restrictions.lockedChurchId || '' : '',
      cellId: '',
      manId: '',
      womanId: '',
      weddingDate: '',
    });
    setShowModal(true);
  };

  const handleChurchChange = (churchId: number | '') => {
    if (!churchId) {
      setForm(prev => ({
        ...prev,
        churchId,
        cellId: '',
      }));
      return;
    }

    const matrixCell = cells.find(
      c => c.churchId === churchId && String(c.type ?? '').trim().toLowerCase() === 'matriz'
    );

    setForm(prev => ({
      ...prev,
      churchId,
      cellId: matrixCell?.id ?? '',
    }));
  };

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
      families: data,
      ministers,
    }),
    [churches, data, federations, members, ministers, scopeLevel, user?.churchId, user?.familyId, user?.federationId, user?.memberId],
  );

  const scopedChurches = useMemo(() => {
    if (scopeLevel === 'federation') return churches;

    const allowedChurchIds = new Set(restrictions.allowedChurchIds);
    return churches.filter((church) => allowedChurchIds.has(church.id));
  }, [churches, restrictions.allowedChurchIds, scopeLevel]);

  const scopedFamilies = useMemo(() => {
    const allowedChurchIds = new Set(scopedChurches.map((church) => church.id));
    return data.filter((family) => allowedChurchIds.has(family.churchId));
  }, [data, scopedChurches]);

  const scopedCells = useMemo(() => {
    const allowedChurchIds = new Set(scopedChurches.map((church) => church.id));
    return cells.filter((cell) => allowedChurchIds.has(cell.churchId));
  }, [cells, scopedChurches]);

  const scopedMembers = useMemo(() => {
    const allowedFamilyIds = new Set(scopedFamilies.map((family) => family.id));
    return members.filter((member) => member.familyId && allowedFamilyIds.has(member.familyId));
  }, [members, scopedFamilies]);

  useEffect(() => {
    if (isFederatedScope && typeof restrictions.lockedFederationId === 'number') {
      setSelectedFederationIds([restrictions.lockedFederationId]);
    }

    if (isLocalScope && typeof restrictions.lockedChurchId === 'number') {
      setSelectedChurchIds([restrictions.lockedChurchId]);
      setForm((prev) => ({ ...prev, churchId: prev.churchId || restrictions.lockedChurchId || '' }));
    }
  }, [isFederatedScope, isLocalScope, restrictions.lockedChurchId, restrictions.lockedFederationId]);

  // Filtra células apenas da igreja selecionada
  const availableCells = form.churchId ? scopedCells.filter(c => c.churchId === form.churchId) : scopedCells;

  const openEdit = (item: Family) => {
    setEditItem(item);
    setForm({
      name: item.name,
      churchId: item.churchId || '',
      cellId: item.cellId || '',
      manId: item.manId || '',
      womanId: item.womanId || '',
      weddingDate: item.weddingDate ? item.weddingDate.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.churchId) { toast.error('Igreja é obrigatória'); return; }

    if (!scopedChurches.some((church) => church.id === form.churchId)) {
      toast.error('Você não tem permissão para usar esta igreja.');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        churchId: Number(form.churchId),
      };
      if (form.cellId) body.cellId = Number(form.cellId);
      if (form.manId) body.manId = Number(form.manId);
      if (form.womanId) body.womanId = Number(form.womanId);
      if (form.weddingDate) body.weddingDate = form.weddingDate;

      if (editItem) {
        await fetchApi(`/api/families/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('Família atualizada com sucesso');
      } else {
        await fetchApi('/api/families', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Família criada com sucesso');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Family) => {
    await fetchApi(`/api/families/${item.id}`, { method: 'DELETE' });
    load();
  };

  const columns: Column<Family>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'churchName', label: 'Igreja', render: (item) => item.churchName || '-' },
    { key: 'cellName', label: 'Célula', render: (item) => item.cellName || '-' },
    { key: 'manName', label: 'Marido', render: (item) => item.manName || '-' },
    { key: 'womanName', label: 'Esposa', render: (item) => item.womanName || '-' },
    { key: 'weddingDate', label: 'Casamento', render: (item) => item.weddingDate ? new Date(item.weddingDate).toLocaleDateString('pt-BR') : '-' },
  ];

  const setF = (key: keyof FamiliaForm, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

  const federationOptions = useMemo(
    () => {
      const scopedFederationIds = new Set(scopedChurches.map((church) => church.federationId));
      return federations
        .filter((federation) => scopedFederationIds.has(federation.id))
        .map((federation) => ({ id: federation.id, name: `${federation.id} - ${federation.name}` }));
    },
    [federations, scopedChurches],
  );

  const churchOptions = useMemo(
    () => scopedChurches.map((church) => ({ id: church.id, name: `${church.id} - ${church.name}` })),
    [scopedChurches],
  );

  const cellOptions = useMemo(
    () => scopedCells.map((cell) => ({ id: cell.id, name: `${cell.id} - ${cell.name}` })),
    [scopedCells],
  );

  const filteredData = useMemo(() => {
    return scopedFamilies.filter((family) => {
      const church = scopedChurches.find((churchItem) => churchItem.id === family.churchId);
      const federationId = church?.federationId;

      const federationMatch =
        selectedFederationIds.length === 0 ||
        (typeof federationId === 'number' && selectedFederationIds.includes(federationId));

      const churchMatch =
        selectedChurchIds.length === 0 ||
        (typeof family.churchId === 'number' && selectedChurchIds.includes(family.churchId));

      const cellMatch =
        selectedCellIds.length === 0 ||
        (typeof family.cellId === 'number' && selectedCellIds.includes(family.cellId));

      return federationMatch && churchMatch && cellMatch;
    });
  }, [scopedChurches, scopedFamilies, selectedCellIds, selectedChurchIds, selectedFederationIds]);

  const handlePageSizeChange = (size: number) => {
    const safeSize = Math.min(100, Math.max(1, size));
    setPageSize(safeSize);
    setPage(1);
  };

  const topFilters = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {!isLocalScope && !isFederatedScope && (
        <MultiSmartSelect
          label="Filtro por Federações"
          selectedIds={selectedFederationIds}
          onChange={setSelectedFederationIds}
          items={federationOptions}
          placeholder="Todas as federações"
        />
      )}
      {!isLocalScope && (
        <MultiSmartSelect
          label="Filtro por Igrejas"
          selectedIds={selectedChurchIds}
          onChange={setSelectedChurchIds}
          items={churchOptions}
          placeholder="Todas as igrejas"
        />
      )}
      <MultiSmartSelect
        label="Filtro por Células"
        selectedIds={selectedCellIds}
        onChange={setSelectedCellIds}
        items={cellOptions}
        placeholder="Todas as células"
      />
    </div>
  );

  return (
    <ICRLayout title="Famílias">
      <CRUDTable
        title="Famílias"
        topContent={topFilters}
        data={filteredData}
        pagination={!serverPaginationEnabled}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
        pageSizeOptions={[10, 25, 50, 100]}
        serverPagination={serverPaginationEnabled ? {
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
        onRefresh={load}
        searchPlaceholder="Buscar família..."
        emptyMessage="Nenhuma família encontrada"
        addLabel="Nova Família"
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editItem ? 'Editar Família' : 'Nova Família'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nome *</label>
                <input type="text" value={form.name} onChange={e => setF('name', e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder="Nome da família" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SmartSelect
                  label="Igreja *"
                  selectedId={form.churchId}
                  onSelect={(id) => {
                    if (isLocalScope) return;
                    handleChurchChange(id);
                  }}
                  items={scopedChurches.map(c => ({ id: c.id, name: c.name }))}
                  placeholder="Selecione uma igreja"
                  required
                  disabled={isLocalScope}
                />
                <SmartSelect
                  label="Célula"
                  selectedId={form.cellId}
                  onSelect={id => setF('cellId', id)}
                  items={availableCells.map(c => ({ id: c.id, name: c.name }))}
                  placeholder={form.churchId ? 'Selecione uma célula' : 'Escolha uma igreja primeiro'}
                  disabled={!form.churchId}
                />
                <SmartSelect
                  label="Marido"
                  selectedId={form.manId}
                  onSelect={id => setF('manId', id)}
                  items={scopedMembers.map(m => ({ id: m.id, name: m.name }))}
                  placeholder="Selecione um membro"
                />
                <SmartSelect
                  label="Esposa"
                  selectedId={form.womanId}
                  onSelect={id => setF('womanId', id)}
                  items={scopedMembers.map(m => ({ id: m.id, name: m.name }))}
                  placeholder="Selecione um membro"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Data de Casamento</label>
                <input type="date" max={todayDate} value={form.weddingDate} onChange={e => setF('weddingDate', e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" />
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
