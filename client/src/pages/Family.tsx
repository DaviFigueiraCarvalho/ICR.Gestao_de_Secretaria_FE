import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import MultiSmartSelect from '../components/MultiSmartSelect';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { buildLocalChurchFallback, getScopeLevel, resolveScopeRestrictions } from '../lib/scope-access';
import { useICRApi, Family, Church, Cell, Federation, Member, Minister } from '../hooks/useICRApi';
import { settledValue } from '@/lib/utils';
import {
  GENDER_FEMALE,
  GENDER_MALE,
  PASTOR_ROLE,
  PRESBITERO_ROLE,
  getMemberRoleOptionsForGender,
  isMaleOnlyMemberRole,
} from '../lib/member-roles';
import { toast } from 'sonner';

interface FamiliaForm {
  name: string;
  churchId: number | '';
  cellId: number | '';
  manId: number | '';
  womanId: number | '';
  weddingDate: string;
}

interface FamilyMemberDraft {
  enabled: boolean;
  name: string;
  birthDate: string;
  cellPhone: string;
  role: number | '';
}

interface MinistroInlineForm {
  cpf: string;
  email: string;
  cardValidity: string;
  presbiterOrdinationDate: string;
  ministerOrdinationDate: string;
  zipCode: string;
  street: string;
  number: string;
  city: string;
  state: string;
}

const EMPTY_MINISTER_FORM: MinistroInlineForm = {
  cpf: '',
  email: '',
  cardValidity: '',
  presbiterOrdinationDate: '',
  ministerOrdinationDate: '',
  zipCode: '',
  street: '',
  number: '',
  city: '',
  state: '',
};

const createEmptyFamilyMemberDraft = (enabled = true): FamilyMemberDraft => ({
  enabled,
  name: '',
  birthDate: '',
  cellPhone: '',
  role: 0,
});

export default function Familias() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const todayDate = new Date().toISOString().split('T')[0];
  const [data, setData] = useState<Family[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Family | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [form, setForm] = useState<FamiliaForm>({ name: '', churchId: '', cellId: '', manId: '', womanId: '', weddingDate: '' });
  const [createManMember, setCreateManMember] = useState(true);
  const [createWomanMember, setCreateWomanMember] = useState(true);
  const [manDraft, setManDraft] = useState<FamilyMemberDraft>(createEmptyFamilyMemberDraft(true));
  const [womanDraft, setWomanDraft] = useState<FamilyMemberDraft>(createEmptyFamilyMemberDraft(true));
  const [manMinisterForm, setManMinisterForm] = useState<MinistroInlineForm>(EMPTY_MINISTER_FORM);
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

  const shouldAutoCreateMinister = (role: number | '') => role === PASTOR_ROLE || role === PRESBITERO_ROLE;

  const normalizePhone = (value: string): string => value.replace(/\D/g, '').slice(0, 11);
  const normalizeCPF = (value: string): string => value.replace(/\D/g, '').slice(0, 11);
  const normalizeCEP = (value: string): string => value.replace(/\D/g, '').slice(0, 8);

  const formatCPF = (value: string): string => {
    const digits = normalizeCPF(value);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatCEP = (value: string): string => {
    const digits = normalizeCEP(value);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const handleManMinisterCEPChange = async (value: string) => {
    const normalizedCEP = normalizeCEP(value);
    setManMinisterForm((prev) => ({ ...prev, zipCode: normalizedCEP }));

    if (normalizedCEP.length === 8) {
      const cepData = await fetchCEP(value);
      if (cepData) {
        setManMinisterForm((prev) => ({
          ...prev,
          street: cepData.street,
          city: cepData.city,
          state: cepData.state,
        }));
        toast.success('Endereco do ministro preenchido automaticamente');
      }
    }
  };

  const saveMinisterForMember = async (memberId: number) => {
    const ministerBody: Record<string, unknown> = {
      memberId,
      cpf: manMinisterForm.cpf || '',
      email: manMinisterForm.email || '',
      cardValidity: manMinisterForm.cardValidity || undefined,
      presbiterOrdinationDate: manMinisterForm.presbiterOrdinationDate || undefined,
      ministerOrdinationDate: manMinisterForm.ministerOrdinationDate || undefined,
      address: {
        zipCode: manMinisterForm.zipCode || '',
        street: manMinisterForm.street || '',
        number: manMinisterForm.number || '',
        city: manMinisterForm.city || '',
        state: manMinisterForm.state || '',
      },
    };

    const ministersResult = await fetchApi<Minister[]>('/api/ministers?page=1&pageSize=100').catch(() => []);
    const existingMinister = Array.isArray(ministersResult)
      ? ministersResult.find((minister) => minister.memberId === memberId)
      : undefined;

    if (existingMinister?.id) {
      await fetchApi(`/api/ministers/${existingMinister.id}`, {
        method: 'PATCH',
        body: JSON.stringify(ministerBody),
      });
      return 'updated';
    }

    await fetchApi('/api/ministers', {
      method: 'POST',
      body: JSON.stringify(ministerBody),
    });
    return 'created';
  };

  useEffect(() => {
    const loadLookups = async () => {
      try {
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
          : fetchApi<Minister[]>('/api/ministers?page=1&pageSize=200');

        const [churchesRes, cellsRes, federationsRes, ministersRes, membersRes] = await Promise.allSettled([
          churchesRequest,
          fetchApi<Cell[]>('/api/cells'),
          federationsRequest,
          ministersRequest,
          fetchApi<Member[]>('/api/members'),
        ]);

        setChurches(settledValue(churchesRes) ?? []);
        setCells(settledValue(cellsRes) ?? []);
        setFederations(settledValue(federationsRes) ?? []);
        setMinisters(settledValue(ministersRes) ?? []);
        setMembers(settledValue(membersRes) ?? []);
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
    setCreateManMember(true);
    setCreateWomanMember(true);
    setManDraft(createEmptyFamilyMemberDraft(true));
    setWomanDraft(createEmptyFamilyMemberDraft(true));
    setManMinisterForm(EMPTY_MINISTER_FORM);
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

  const selectedFamilyMembers = useMemo(() => {
    if (!selectedFamily) return [];
    return scopedMembers.filter((member) => member.familyId === selectedFamily.id);
  }, [scopedMembers, selectedFamily]);

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
    setCreateManMember(false);
    setCreateWomanMember(false);
    setManDraft(createEmptyFamilyMemberDraft(false));
    setWomanDraft(createEmptyFamilyMemberDraft(false));
    setManMinisterForm(EMPTY_MINISTER_FORM);
    setShowModal(true);
  };

  const createMemberForFamily = async (familyId: number, gender: number, draft: FamilyMemberDraft) => {
    const createdMember = await fetchApi<Member>('/api/members', {
      method: 'POST',
      body: JSON.stringify({
        name: draft.name,
        familyId,
        gender,
        hasBeenMarried: true,
        birthDate: draft.birthDate || undefined,
        cellPhone: draft.cellPhone || undefined,
        role: Number(draft.role || 0),
      }),
    });

    if (!createdMember?.id) {
      throw new Error('Falha ao criar membro da família');
    }

    return createdMember.id;
  };

  const openMembers = (item: Family) => {
    setSelectedFamily(item);
    setShowMembersModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.churchId) { toast.error('Igreja é obrigatória'); return; }

    if (!scopedChurches.some((church) => church.id === form.churchId)) {
      toast.error('Você não tem permissão para usar esta igreja.');
      return;
    }

    if (!editItem) {
      if (createManMember && !manDraft.name.trim()) {
        toast.error('Informe o nome do marido para criar o membro');
        return;
      }

      if (createWomanMember && !womanDraft.name.trim()) {
        toast.error('Informe o nome da mulher para criar o membro');
        return;
      }

      if (createWomanMember && isMaleOnlyMemberRole(womanDraft.role)) {
        toast.error('A esposa não pode receber cargo exclusivo de homem');
        return;
      }
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
        const createdFamily = await fetchApi<Family>('/api/families', { method: 'POST', body: JSON.stringify(body) });
        const familyId = createdFamily?.id;

        if (!familyId) {
          throw new Error('Falha ao obter ID da família criada');
        }

        const createdManId = createManMember ? await createMemberForFamily(familyId, 1, manDraft) : undefined;
        const createdWomanId = createWomanMember ? await createMemberForFamily(familyId, 2, womanDraft) : undefined;

        if (createdManId && shouldAutoCreateMinister(manDraft.role)) {
          const ministerResult = await saveMinisterForMember(createdManId);
          if (ministerResult === 'created') {
            toast.success('Cadastro de ministro do marido criado no formulario adicional');
          } else {
            toast.success('Cadastro de ministro do marido atualizado no formulario adicional');
          }
        }

        if (createdManId || createdWomanId) {
          await fetchApi(`/api/families/${familyId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              manId: createdManId,
              womanId: createdWomanId,
            }),
          });
        }

        toast.success('Família e membros criados com sucesso');
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
        onView={openMembers}
        viewLabel="Ver membros"
        viewIcon="groups"
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
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
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
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Data de Casamento</label>
                <input type="date" max={todayDate} value={form.weddingDate} onChange={e => setF('weddingDate', e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" />
              </div>

              {!editItem && (
                <div className="space-y-4 pt-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white font-['Nunito'] font-semibold text-sm">Criar marido</p>
                        <p className="text-white/45 font-['Nunito'] text-xs mt-1">O membro será criado e marcado como marido da família.</p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-white/70 text-sm font-['Nunito'] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createManMember}
                          onChange={(event) => setCreateManMember(event.target.checked)}
                          className="h-4 w-4 rounded border-white/30 bg-[#1c1c1c] text-[#017158] focus:ring-[#017158]"
                        />
                        Ativar
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-100">
                      <div>
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nome do marido *</label>
                        <input
                          type="text"
                          value={manDraft.name}
                          onChange={(event) => setManDraft((prev) => ({ ...prev, name: event.target.value }))}
                          disabled={!createManMember}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                          placeholder="Nome do marido"
                        />
                      </div>
                      <div>
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Telefone</label>
                        <input
                          type="text"
                          value={manDraft.cellPhone}
                          onChange={(event) => setManDraft((prev) => ({ ...prev, cellPhone: event.target.value }))}
                          disabled={!createManMember}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                          placeholder="Opcional"
                        />
                      </div>
                      <div>
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nascimento</label>
                        <input
                          type="date"
                          value={manDraft.birthDate}
                          onChange={(event) => setManDraft((prev) => ({ ...prev, birthDate: event.target.value }))}
                          disabled={!createManMember}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Função / Cargo</label>
                        <select
                          value={manDraft.role}
                          onChange={(event) => setManDraft((prev) => ({ ...prev, role: event.target.value ? Number(event.target.value) : '' }))}
                          disabled={!createManMember}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                        >
                          <option value={0}>Sem função</option>
                          {getMemberRoleOptionsForGender(GENDER_MALE).filter((option) => option.value !== 0).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {shouldAutoCreateMinister(manDraft.role) && (
                      <div className="border-t border-white/10 pt-4 space-y-4">
                        <p className="text-white/50 text-xs font-['Nunito'] uppercase tracking-wider">Dados de Ministro do marido</p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">CPF</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={14}
                              value={formatCPF(manMinisterForm.cpf)}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, cpf: normalizeCPF(event.target.value) }))}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                              placeholder="000.000.000-00"
                            />
                          </div>
                          <div>
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">E-mail</label>
                            <input
                              type="email"
                              value={manMinisterForm.email}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, email: event.target.value }))}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                              placeholder="email@exemplo.com"
                            />
                          </div>
                          <div>
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Validade Carteira</label>
                            <input
                              type="date"
                              value={manMinisterForm.cardValidity}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, cardValidity: event.target.value }))}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Ordenação Presbítero</label>
                            <input
                              type="date"
                              value={manMinisterForm.presbiterOrdinationDate}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, presbiterOrdinationDate: event.target.value }))}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Ordenação a Pastor</label>
                            <input
                              type="date"
                              value={manMinisterForm.ministerOrdinationDate}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, ministerOrdinationDate: event.target.value }))}
                              disabled={!createManMember || manDraft.role === PRESBITERO_ROLE}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">CEP</label>
                            <input
                              type="text"
                              value={formatCEP(manMinisterForm.zipCode)}
                              onChange={(event) => handleManMinisterCEPChange(event.target.value)}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={9}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                              placeholder="00000-000"
                            />
                          </div>
                          <div>
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Número</label>
                            <input
                              type="text"
                              value={manMinisterForm.number}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, number: event.target.value }))}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                              placeholder="Nº"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Rua</label>
                            <input
                              type="text"
                              value={manMinisterForm.street}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, street: event.target.value }))}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                              placeholder="Nome da rua"
                            />
                          </div>
                          <div>
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Cidade</label>
                            <input
                              type="text"
                              value={manMinisterForm.city}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, city: event.target.value }))}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                              placeholder="Cidade"
                            />
                          </div>
                          <div>
                            <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Estado</label>
                            <input
                              type="text"
                              value={manMinisterForm.state}
                              onChange={(event) => setManMinisterForm((prev) => ({ ...prev, state: event.target.value }))}
                              disabled={!createManMember}
                              className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                              placeholder="UF"
                              maxLength={2}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white font-['Nunito'] font-semibold text-sm">Criar mulher</p>
                        <p className="text-white/45 font-['Nunito'] text-xs mt-1">O membro será criado e marcado como mulher da família.</p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-white/70 text-sm font-['Nunito'] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createWomanMember}
                          onChange={(event) => setCreateWomanMember(event.target.checked)}
                          className="h-4 w-4 rounded border-white/30 bg-[#1c1c1c] text-[#017158] focus:ring-[#017158]"
                        />
                        Ativar
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nome da mulher *</label>
                        <input
                          type="text"
                          value={womanDraft.name}
                          onChange={(event) => setWomanDraft((prev) => ({ ...prev, name: event.target.value }))}
                          disabled={!createWomanMember}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                          placeholder="Nome da mulher"
                        />
                      </div>
                      <div>
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Telefone</label>
                        <input
                          type="text"
                          value={womanDraft.cellPhone}
                          onChange={(event) => setWomanDraft((prev) => ({ ...prev, cellPhone: event.target.value }))}
                          disabled={!createWomanMember}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                          placeholder="Opcional"
                        />
                      </div>
                      <div>
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nascimento</label>
                        <input
                          type="date"
                          value={womanDraft.birthDate}
                          onChange={(event) => setWomanDraft((prev) => ({ ...prev, birthDate: event.target.value }))}
                          disabled={!createWomanMember}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Função / Cargo</label>
                        <select
                          value={womanDraft.role}
                          onChange={(event) => setWomanDraft((prev) => ({ ...prev, role: event.target.value ? Number(event.target.value) : '' }))}
                          disabled={!createWomanMember}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                        >
                          <option value={0}>Sem função</option>
                          {getMemberRoleOptionsForGender(GENDER_FEMALE).filter((option) => option.value !== 0).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {editItem && (
                <div className="grid grid-cols-2 gap-3">
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
              )}
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

      {showMembersModal && selectedFamily && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                  Membros da família
                </h3>
                <p className="text-white/50 font-['Nunito'] text-sm mt-1">{selectedFamily.name}</p>
              </div>
              <button onClick={() => setShowMembersModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            {selectedFamilyMembers.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-6 text-center text-white/50 font-['Nunito'] text-sm">
                Nenhum membro vinculado a esta família.
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {selectedFamilyMembers.map((member) => (
                  <div
                    key={member.id}
                    className={`rounded-lg px-4 py-3 flex items-center justify-between gap-3 border ${
                      member.id === selectedFamily.manId
                        ? 'border-[#017158] bg-[#017158]/10'
                        : member.id === selectedFamily.womanId
                          ? 'border-[#8a5cff] bg-[#8a5cff]/10'
                          : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div>
                      <p className="text-white font-['Nunito'] text-sm font-medium">{member.name}</p>
                      <p className="text-white/45 font-['Nunito'] text-xs mt-1">
                        {member.roleName || member.className || 'Membro'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {member.id === selectedFamily.manId && (
                        <span className="rounded-full border border-[#017158]/30 bg-[#017158]/10 px-3 py-1 text-xs text-[#8de2c7] font-['Nunito']">
                          Marido
                        </span>
                      )}
                      {member.id === selectedFamily.womanId && (
                        <span className="rounded-full border border-[#8a5cff]/30 bg-[#8a5cff]/10 px-3 py-1 text-xs text-[#d9caff] font-['Nunito']">
                          Mulher
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-white/60 font-['Nunito']">
                        ID {member.id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowMembersModal(false)}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors font-['Nunito'] text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </ICRLayout>
  );
}
