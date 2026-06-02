import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import MultiSmartSelect from '../components/MultiSmartSelect';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { buildLocalChurchFallback, getScopeLevel, resolveScopeRestrictions } from '../lib/scope-access';
import { useICRApi, Member, Family, Church, Cell, Federation, Minister } from '../hooks/useICRApi';
import { settledValue } from '@/lib/utils';
import { useViaCEP } from '../hooks/useViaCEP';
import { countrySelectItems, DEFAULT_COUNTRY_CODE, formatPhoneNumber, formatPostalCode, normalizePhoneNumber, normalizePostalCode, validatePhoneNumber } from '../lib/country';
import {
  GENDER_FEMALE,
  PASTOR_ROLE,
  PRESBITERO_ROLE,
  getMemberRoleLabel,
  getMemberRoleOptionsForGender,
  getMemberRoleValue,
  isMaleOnlyMemberRole,
} from '../lib/member-roles';
import { toast } from 'sonner';

interface MembroForm {
  name: string;
  familyId: number | '';
  gender: number;
  birthDate: string;
  hasBeenMarried: boolean;
  role: number | '';
  phoneCountryCode: string;
  phoneNumber: string;
}

interface MinistroInlineForm {
  cpf: string;
  email: string;
  cardValidity: string;
  presbiterOrdinationDate: string;
  ministerOrdinationDate: string;
  countryCode: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  state: string;
  countyOrRegion: string;
}

const normalizeCPF = (value: string): string => value.replace(/\D/g, '').slice(0, 11);
const getPhoneDisplay = (phone?: Member['cellPhone']): string => {
  if (!phone) return '-';
  return phone.displayFormat || phone.internationalFormat || phone.number || '-';
};

const formatCPF = (value: string): string => {
  const digits = normalizeCPF(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const getGenderValue = (value: unknown): number => {
  if (value === 1 || value === '1' || value === 'MALE') return 1;
  if (value === 2 || value === '2' || value === 'FEMALE') return 2;
  return 1;
};

const EMPTY_MINISTER_FORM: MinistroInlineForm = {
  cpf: '',
  email: '',
  cardValidity: '',
  presbiterOrdinationDate: '',
  ministerOrdinationDate: '',
  countryCode: DEFAULT_COUNTRY_CODE,
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  city: '',
  state: '',
  countyOrRegion: '',
};

export default function Membros() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const { fetchCEP, loading: ministerCepLoading, error: ministerCepError } = useViaCEP();
  const todayDate = new Date().toISOString().split('T')[0];
  const [data, setData] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Member | null>(null);
  const [form, setForm] = useState<MembroForm>({
    name: '', familyId: '', gender: 1, birthDate: '', hasBeenMarried: false, role: '', phoneCountryCode: DEFAULT_COUNTRY_CODE, phoneNumber: '',
  });
  const [ministerForm, setMinisterForm] = useState<MinistroInlineForm>(EMPTY_MINISTER_FORM);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [federations, setFederations] = useState<Federation[]>([]);
  const [ministers, setMinisters] = useState<Minister[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [serverPaginationEnabled, setServerPaginationEnabled] = useState(true);
  const [selectedFederationIds, setSelectedFederationIds] = useState<number[]>([]);
  const [selectedChurchIds, setSelectedChurchIds] = useState<number[]>([]);
  const [selectedCellIds, setSelectedCellIds] = useState<number[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  const isLocalScope = scopeLevel === 'local';
  const isFederatedScope = scopeLevel === 'federated';

  const shouldAutoCreateMinister = (role: number | '') => role === PASTOR_ROLE || role === PRESBITERO_ROLE;
  const isPresbiteroSelected = form.role === PRESBITERO_ROLE;
  const isForbiddenError = (err: unknown) =>
    err instanceof Error && (err.message.includes('403') || err.message.toLowerCase().includes('forbidden'));

  const handleMinisterCEPChange = async (value: string) => {
    const normalizedPostalCode = normalizePostalCode(ministerForm.countryCode, value);
    setMinisterForm((prev) => ({ ...prev, postalCode: normalizedPostalCode }));

    if (ministerForm.countryCode !== 'BR') return;

    const cleanCEP = normalizedPostalCode;
    if (cleanCEP.length === 8) {
      const cepData = await fetchCEP(value);
      if (cepData) {
        setMinisterForm((prev) => ({
          ...prev,
          street: cepData.street,
          city: cepData.city,
          state: cepData.state,
        }));
        toast.success('Endereco de ministro preenchido automaticamente');
      }
    }
  };

  const handleGenderChange = (gender: number) => {
    setF('gender', gender);

    if (gender === GENDER_FEMALE && isMaleOnlyMemberRole(form.role)) {
      setF('role', 0);
    }
  };

  const saveMinisterForMember = async (memberId: number) => {
    const ministerBody: Record<string, unknown> = {
      memberId,
      cpf: ministerForm.cpf || '',
      email: ministerForm.email || '',
      cardValidity: ministerForm.cardValidity || undefined,
      presbiterOrdinationDate: ministerForm.presbiterOrdinationDate || undefined,
      ministerOrdinationDate: ministerForm.ministerOrdinationDate || undefined,
      address: {
        countryCode: ministerForm.countryCode || DEFAULT_COUNTRY_CODE,
        postalCode: ministerForm.postalCode || '',
        street: ministerForm.street || '',
        number: ministerForm.number || '',
        complement: ministerForm.complement || '',
        city: ministerForm.city || '',
        state: ministerForm.state || '',
        countyOrRegion: ministerForm.countyOrRegion || '',
      },
    };

    const ministers = await fetchApi<Minister[]>('/api/ministers?page=1&pageSize=100').catch(() => []);
    const existingMinister = Array.isArray(ministers)
      ? ministers.find((minister) => minister.memberId === memberId)
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

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const requestList = serverPaginationEnabled
        ? [
            fetchApi<Member[]>(`/api/members?page=${page}&pageSize=${pageSize}`),
            fetchApi<Family[]>('/api/families?page=1&pageSize=100'),
            isLocalScope && typeof user?.churchId === 'number'
              ? fetchApi<Church>(`/api/churches/${user.churchId}`).then((church) => [church]).catch(() => buildLocalChurchFallback(user.churchId))
              : fetchApi<Church[]>('/api/churches'),
            fetchApi<Cell[]>('/api/cells'),
            isLocalScope ? Promise.resolve<Federation[]>([]) : fetchApi<Federation[]>('/api/federations'),
            isLocalScope ? Promise.resolve<Minister[]>([]) : fetchApi<Minister[]>('/api/ministers?page=1&pageSize=200'),
          ]
        : [
            fetchApi<Member[]>('/api/members'),
            fetchApi<Family[]>('/api/families?page=1&pageSize=100'),
            isLocalScope && typeof user?.churchId === 'number'
              ? fetchApi<Church>(`/api/churches/${user.churchId}`).then((church) => [church]).catch(() => buildLocalChurchFallback(user.churchId))
              : fetchApi<Church[]>('/api/churches'),
            fetchApi<Cell[]>('/api/cells'),
            isLocalScope ? Promise.resolve<Federation[]>([]) : fetchApi<Federation[]>('/api/federations'),
            isLocalScope ? Promise.resolve<Minister[]>([]) : fetchApi<Minister[]>('/api/ministers?page=1&pageSize=200'),
          ];

      const [membersResult, familiesResult, churchesResult, cellsResult, federationsResult, ministersResult] = await Promise.allSettled(requestList);

      if (membersResult.status === 'rejected') {
        if (serverPaginationEnabled && isForbiddenError(membersResult.reason)) {
          const fallbackResults = await Promise.allSettled([
            fetchApi<Member[]>('/api/members'),
            fetchApi<Family[]>('/api/families?page=1&pageSize=100'),
            fetchApi<Church[]>('/api/churches'),
            fetchApi<Cell[]>('/api/cells'),
            fetchApi<Federation[]>('/api/federations'),
            fetchApi<Minister[]>('/api/ministers?page=1&pageSize=200'),
          ]);

          const [fallbackMembersResult, fallbackFamiliesResult, fallbackChurchesResult, fallbackCellsResult, fallbackFederationsResult, fallbackMinistersResult] = fallbackResults;
          const fallbackMembersData = (settledValue(fallbackMembersResult) ?? []) as Member[];

          if (page > 1 && fallbackMembersData.length === 0) {
            setPage((prev) => Math.max(1, prev - 1));
            return;
          }

          setData(fallbackMembersData);
          setHasNextPage(false);
          setFamilies((settledValue(fallbackFamiliesResult) ?? []) as Family[]);
          setChurches((settledValue(fallbackChurchesResult) ?? []) as Church[]);
          setCells((settledValue(fallbackCellsResult) ?? []) as Cell[]);
          setFederations((settledValue(fallbackFederationsResult) ?? []) as Federation[]);
          setMinisters((settledValue(fallbackMinistersResult) ?? []) as Minister[]);
          setServerPaginationEnabled(false);
          setPage(1);
          return;
        }

        throw membersResult.reason;
      }

      const membersData = Array.isArray(membersResult.value) ? (membersResult.value as Member[]) : [];

      if (serverPaginationEnabled && page > 1 && membersData.length === 0) {
        setPage((prev) => Math.max(1, prev - 1));
        return;
      }

      setData(membersData);
      setHasNextPage(serverPaginationEnabled && membersData.length === pageSize);
      setFamilies((settledValue(familiesResult) ?? []) as Family[]);
      setChurches((settledValue(churchesResult) ?? []) as Church[]);
      setCells((settledValue(cellsResult) ?? []) as Cell[]);
      setFederations((settledValue(federationsResult) ?? []) as Federation[]);
      setMinisters((settledValue(ministersResult) ?? []) as Minister[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar membros');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, pageSize, serverPaginationEnabled]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', familyId: '', gender: 1, birthDate: '', hasBeenMarried: false, role: 0, phoneCountryCode: DEFAULT_COUNTRY_CODE, phoneNumber: '' });
    setMinisterForm(EMPTY_MINISTER_FORM);
    setPhoneError(null);
    setShowModal(true);
  };

  const openEdit = (item: Member) => {
    setEditItem(item);
    setForm({
      name: item.name,
      familyId: item.familyId || '',
      gender: getGenderValue(item.gender),
      birthDate: item.birthDate ? item.birthDate.split('T')[0] : '',
      hasBeenMarried: item.hasBeenMarried || false,
      role: getMemberRoleValue(item.role) === '' ? 0 : getMemberRoleValue(item.role),
      phoneCountryCode: item.cellPhone?.countryCode || DEFAULT_COUNTRY_CODE,
      phoneNumber: item.cellPhone?.number || '',
    });
    setMinisterForm(EMPTY_MINISTER_FORM);
    setPhoneError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (saving) return;

    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }

    if (form.familyId && !scopedFamilies.some((family) => family.id === form.familyId)) {
      toast.error('Você não tem permissão para vincular este membro a essa família.');
      return;
    }

    const normalizedCellPhone = normalizePhoneNumber(form.phoneCountryCode, form.phoneNumber);
    const phoneValidationError = normalizedCellPhone
      ? validatePhoneNumber(form.phoneCountryCode, normalizedCellPhone)
      : null;
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      toast.error(phoneValidationError);
      return;
    }

    setPhoneError(null);

    if (form.gender === GENDER_FEMALE && isMaleOnlyMemberRole(form.role)) {
      toast.error('Essa função só pode ser atribuída a homens');
      return;
    }

    const normalizedMinisterCPF = normalizeCPF(ministerForm.cpf);
    const normalizedMinisterCEP = normalizePostalCode(ministerForm.countryCode, ministerForm.postalCode);
    if (shouldAutoCreateMinister(form.role)) {
      if (normalizedMinisterCPF && normalizedMinisterCPF.length !== 11) {
        toast.error('CPF do ministro deve conter 11 dígitos');
        return;
      }
      if (ministerForm.countryCode === 'BR' && normalizedMinisterCEP && normalizedMinisterCEP.length !== 8) {
        toast.error('CEP do ministro deve conter 8 dígitos');
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        gender: Number(form.gender),
        hasBeenMarried: form.hasBeenMarried,
      };
      if (form.familyId) body.familyId = Number(form.familyId);
      if (form.birthDate) body.birthDate = form.birthDate;
      body.role = Number(form.role);
      body.cellPhone = normalizedCellPhone
        ? {
            countryCode: form.phoneCountryCode,
            number: normalizedCellPhone,
          }
        : null;

      let memberId = editItem?.id;

      if (editItem) {
        await fetchApi(`/api/members/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('Membro atualizado com sucesso');
      } else {
        const createdMember = await fetchApi<Member>('/api/members', { method: 'POST', body: JSON.stringify(body) });
        memberId = createdMember?.id;

        if (!memberId) {
          throw new Error('Falha ao obter ID do membro criado');
        }

        toast.success('Membro criado com sucesso');
      }

      if (memberId && shouldAutoCreateMinister(form.role)) {
        const ministerResult = await saveMinisterForMember(memberId);
        if (ministerResult === 'created') {
          toast.success('Cadastro de ministro criado no formulario adicional');
        } else {
          toast.success('Cadastro de ministro atualizado no formulario adicional');
        }
      }

      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Member) => {
    await fetchApi(`/api/members/${item.id}`, { method: 'DELETE' });
    load();
  };

  const columns: Column<Member>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'roleName', label: 'Função', render: (item) => getMemberRoleLabel(item.role, item.roleName) },
    { key: 'genderName', label: 'Gênero', render: (item) => item.genderName || (getGenderValue(item.gender) === 1 ? 'Masculino' : 'Feminino') },
    { key: 'familyName', label: 'Família', render: (item) => item.familyName || '-' },
    { key: 'familyChurchName', label: 'Igreja', render: (item) => item.familyChurchName || '-' },
    { key: 'birthDate', label: 'Nascimento', render: (item) => item.birthDate ? new Date(item.birthDate).toLocaleDateString('pt-BR') : '-' },
    { key: 'cellPhone', label: 'Telefone', render: (item) => getPhoneDisplay(item.cellPhone) },
  ];

  const setF = (key: keyof MembroForm, val: string | number | boolean) => setForm(prev => ({ ...prev, [key]: val }));
  const setMinisterF = (key: keyof MinistroInlineForm, val: string) => setMinisterForm((prev) => ({ ...prev, [key]: val }));
  const availableRoleOptions = getMemberRoleOptionsForGender(form.gender);

  const selectedMemberCard = selectedMember ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#202020] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-[0.2em] font-['Nunito']">Panorama geral do membro</p>
            <h3 className="text-white text-2xl font-['Nunito'] font-semibold">{selectedMember.name || 'Membro'}</h3>
          </div>
          <button onClick={() => setSelectedMember(null)} className="text-white/50 hover:text-white transition-colors">
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Função" value={getMemberRoleLabel(selectedMember.role, selectedMember.roleName)} />
            <InfoTile label="Gênero" value={selectedMember.genderName || (getGenderValue(selectedMember.gender) === 1 ? 'Masculino' : 'Feminino')} />
            <InfoTile label="Telefone" value={getPhoneDisplay(selectedMember.cellPhone)} />
            <InfoTile label="Nascimento" value={selectedMember.birthDate ? new Date(selectedMember.birthDate).toLocaleDateString('pt-BR') : '-'} />
            <InfoTile label="Família" value={selectedMember.familyName || '-'} />
            <InfoTile label="Igreja" value={selectedMember.familyChurchName || '-'} />
            <InfoTile label="Célula" value={selectedMember.familyCellName || '-'} />
            <InfoTile label="Classe" value={selectedMember.className || '-'} />
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <InfoTile label="Já foi casado(a)" value={selectedMember.hasBeenMarried ? 'Sim' : 'Não'} compact />
            <InfoTile label="Cônjuge" value={selectedMember.spouseName || '-'} compact />
            <InfoTile label="Data do casamento" value={selectedMember.weddingDate ? new Date(selectedMember.weddingDate).toLocaleDateString('pt-BR') : '-'} compact />
            <InfoTile label="ID" value={String(selectedMember.id)} compact />
          </div>
        </div>

        <div className="flex justify-end border-t border-white/10 px-6 py-4">
          <button
            onClick={() => setSelectedMember(null)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-['Nunito'] text-white hover:border-white/30 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  function InfoTile({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
    return (
      <div className={`rounded-xl border border-white/10 ${compact ? 'bg-black/10 px-3 py-2' : 'bg-black/10 p-4'}`}>
        <p className="text-white/45 text-[11px] uppercase tracking-[0.2em] font-['Nunito']">{label}</p>
        <p className={`text-white ${compact ? 'text-sm' : 'text-base'} font-['Nunito'] break-words`}>{value}</p>
      </div>
    );
  }

  const restrictions = useMemo(
    () => resolveScopeRestrictions({
      scopeLevel,
      userMemberId: user?.memberId,
      userFamilyId: user?.familyId,
      userChurchId: user?.churchId,
      userFederationId: user?.federationId,
      churches,
      federations,
      members: data,
      families,
      ministers,
    }),
    [churches, data, families, federations, ministers, scopeLevel, user?.churchId, user?.familyId, user?.federationId, user?.memberId],
  );

  const scopedChurches = useMemo(() => {
    if (scopeLevel === 'federation') return churches;

    const allowedChurchIds = new Set(restrictions.allowedChurchIds);
    return churches.filter((church) => allowedChurchIds.has(church.id));
  }, [churches, restrictions.allowedChurchIds, scopeLevel]);

  const scopedFamilies = useMemo(() => {
    const allowedChurchIds = new Set(scopedChurches.map((church) => church.id));
    return families.filter((family) => allowedChurchIds.has(family.churchId));
  }, [families, scopedChurches]);

  const scopedCells = useMemo(() => {
    const allowedChurchIds = new Set(scopedChurches.map((church) => church.id));
    return cells.filter((cell) => allowedChurchIds.has(cell.churchId));
  }, [cells, scopedChurches]);

  useEffect(() => {
    if (isFederatedScope && typeof restrictions.lockedFederationId === 'number') {
      setSelectedFederationIds([restrictions.lockedFederationId]);
    }

    if (isLocalScope && typeof restrictions.lockedChurchId === 'number') {
      setSelectedChurchIds([restrictions.lockedChurchId]);
    }
  }, [isFederatedScope, isLocalScope, restrictions.lockedChurchId, restrictions.lockedFederationId]);

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
    return data.filter((member) => {
      const family = scopedFamilies.find((familyItem) => familyItem.id === member.familyId);
      if (!family) return false;

      const churchId = family?.churchId;
      const cellId = family?.cellId;
      const federationId = scopedChurches.find((church) => church.id === churchId)?.federationId;

      const federationMatch =
        selectedFederationIds.length === 0 ||
        (typeof federationId === 'number' && selectedFederationIds.includes(federationId));

      const churchMatch =
        selectedChurchIds.length === 0 ||
        (typeof churchId === 'number' && selectedChurchIds.includes(churchId));

      const cellMatch =
        selectedCellIds.length === 0 ||
        (typeof cellId === 'number' && selectedCellIds.includes(cellId));

      return federationMatch && churchMatch && cellMatch;
    });
  }, [data, scopedChurches, scopedFamilies, selectedCellIds, selectedChurchIds, selectedFederationIds]);

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
    <ICRLayout title="Membros">
      <CRUDTable
        title="Membros"
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
        onView={setSelectedMember}
        viewLabel="Panorama geral"
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={load}
        searchPlaceholder="Buscar membro..."
        emptyMessage="Nenhum membro encontrado"
        addLabel="Novo Membro"
      />

      {selectedMemberCard}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editItem ? 'Editar Membro' : 'Novo Membro'}
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
                  placeholder="Nome completo" />
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Gênero</label>
                    <select value={form.gender} onChange={e => handleGenderChange(Number(e.target.value))}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]">
                      <option value={1}>Masculino</option>
                      <option value={2}>Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Data de Nascimento</label>
                    <input type="date" max={todayDate} value={form.birthDate} onChange={e => setF('birthDate', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SmartSelect
                    label="País do Telefone"
                    selectedId={form.phoneCountryCode}
                    onSelect={(id) => setF('phoneCountryCode', typeof id === 'string' ? id : DEFAULT_COUNTRY_CODE)}
                    items={countrySelectItems}
                    placeholder="Selecione um país"
                  />
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Telefone</label>
                    <input
                      type="text"
                      required
                      inputMode={form.phoneCountryCode === 'BR' ? 'numeric' : 'text'}
                      pattern={form.phoneCountryCode === 'BR' ? '[0-9]*' : undefined}
                      maxLength={form.phoneCountryCode === 'BR' ? 15 : 24}
                      value={formatPhoneNumber(form.phoneCountryCode, form.phoneNumber)}
                      onChange={e => {
                        setPhoneError(null);
                        setF('phoneNumber', normalizePhoneNumber(form.phoneCountryCode, e.target.value));
                      }}
                      onBlur={() => {
                        const normalizedValue = normalizePhoneNumber(form.phoneCountryCode, form.phoneNumber);
                        setPhoneError(normalizedValue ? validatePhoneNumber(form.phoneCountryCode, normalizedValue) : null);
                      }}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      placeholder={form.phoneCountryCode === 'BR' ? '(21) 90000-0000' : 'Telefone internacional'}
                    />
                    {phoneError && <p className="mt-1 text-xs text-red-400 font-['Nunito']">{phoneError}</p>}
                  </div>
                </div>
                <SmartSelect
                  label="Família"
                  selectedId={form.familyId}
                  onSelect={(id) => setF('familyId', id)}
                  items={scopedFamilies.map((f) => ({ id: f.id, name: f.name }))}
                  placeholder="Selecione uma família"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Função/Cargo</label>
                <select
                  value={form.role}
                  onChange={e => setF('role', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                >
                  <option value={0}>Sem função</option>
                  {availableRoleOptions.filter((roleOption) => roleOption.value !== 0).map((roleOption) => (
                    <option key={roleOption.value} value={roleOption.value}>{roleOption.label}</option>
                  ))}
                </select>
              </div>

              {shouldAutoCreateMinister(form.role) && (
                <div className="border-t border-white/10 pt-4 space-y-4">
                  <p className="text-white/50 text-xs font-['Nunito'] uppercase tracking-wider">Dados de Ministro (Pastor/Presbitero)</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">CPF</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={14}
                        value={formatCPF(ministerForm.cpf)}
                        onChange={(e) => setMinisterF('cpf', normalizeCPF(e.target.value))}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">E-mail</label>
                      <input
                        type="email"
                        value={ministerForm.email}
                        onChange={(e) => setMinisterF('email', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Validade Carteira</label>
                      <input
                        type="date"
                        value={ministerForm.cardValidity}
                        onChange={(e) => setMinisterF('cardValidity', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      />
                    </div>
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Ordenação Presbítero</label>
                      <input
                        type="date"
                        max={todayDate}
                        value={ministerForm.presbiterOrdinationDate}
                        onChange={(e) => setMinisterF('presbiterOrdinationDate', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      />
                    </div>
                    {!isPresbiteroSelected && (
                      <div className="col-span-2">
                        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Ordenação a Pastor</label>
                        <input
                          type="date"
                          max={todayDate}
                          value={ministerForm.ministerOrdinationDate}
                          onChange={(e) => setMinisterF('ministerOrdinationDate', e.target.value)}
                          className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <SmartSelect
                      className="col-span-2"
                      label="País"
                      selectedId={ministerForm.countryCode}
                      onSelect={(id) => {
                        const countryCode = typeof id === 'string' ? id : DEFAULT_COUNTRY_CODE;
                        setMinisterForm((prev) => ({ ...prev, countryCode, postalCode: '' }));
                      }}
                      items={countrySelectItems}
                      placeholder="Selecione um país"
                    />
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">{ministerForm.countryCode === 'BR' ? 'CEP' : 'Código postal'} {ministerForm.countryCode === 'BR' && ministerCepLoading && <span className="text-[#017158] text-xs">buscando...</span>}</label>
                      <input
                        type="text"
                        value={formatPostalCode(ministerForm.countryCode, ministerForm.postalCode)}
                        onChange={(e) => handleMinisterCEPChange(e.target.value)}
                        inputMode={ministerForm.countryCode === 'BR' ? 'numeric' : 'text'}
                        pattern={ministerForm.countryCode === 'BR' ? '[0-9]*' : undefined}
                        maxLength={ministerForm.countryCode === 'BR' ? 9 : 24}
                        disabled={ministerForm.countryCode === 'BR' && ministerCepLoading}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                        placeholder={ministerForm.countryCode === 'BR' ? '00000-000' : 'Informe o código postal'}
                      />
                      {ministerForm.countryCode === 'BR' && ministerCepError && <p className="text-red-400 text-xs mt-1">{ministerCepError}</p>}
                    </div>
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Número</label>
                      <input
                        type="text"
                        value={ministerForm.number}
                        onChange={(e) => setMinisterF('number', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        placeholder="Nº"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Rua</label>
                      <input
                        type="text"
                        value={ministerForm.street}
                        onChange={(e) => setMinisterF('street', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        placeholder="Nome da rua"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Complemento</label>
                      <input
                        type="text"
                        value={ministerForm.complement}
                        onChange={(e) => setMinisterF('complement', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        placeholder="Apto, bloco, referência"
                      />
                    </div>
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Cidade</label>
                      <input
                        type="text"
                        value={ministerForm.city}
                        onChange={(e) => setMinisterF('city', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        placeholder="Cidade"
                      />
                    </div>
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Estado</label>
                      <input
                        type="text"
                        value={ministerForm.state}
                        onChange={(e) => setMinisterF('state', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        placeholder="UF"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Região/Condado</label>
                      <input
                        type="text"
                        value={ministerForm.countyOrRegion}
                        onChange={(e) => setMinisterF('countyOrRegion', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                        placeholder="Condado, província, região"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input type="checkbox" id="hasBeenMarried" checked={form.hasBeenMarried}
                  onChange={e => setF('hasBeenMarried', e.target.checked)}
                  className="w-4 h-4 accent-[#017158]" />
                <label htmlFor="hasBeenMarried" className="text-white/70 text-sm font-['Nunito']">
                  Já foi casado(a)
                </label>
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
