import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import MultiSmartSelect from '../components/MultiSmartSelect';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { getScopeLevel, resolveScopeRestrictions } from '../lib/scope-access';
import { useICRApi, Member, Family, Church, Cell, Federation, Minister } from '../hooks/useICRApi';
import { useViaCEP } from '../hooks/useViaCEP';
import { toast } from 'sonner';

interface MembroForm {
  name: string;
  familyId: number | '';
  gender: number;
  birthDate: string;
  hasBeenMarried: boolean;
  role: number | '';
  cellPhone: string;
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

const MEMBER_ROLE_OPTIONS = [
  { value: 1, label: 'Pastor' },
  { value: 2, label: 'Presbitero' },
  { value: 3, label: 'Diacono' },
  { value: 4, label: 'Obreiro' },
  { value: 5, label: 'Midias' },
  { value: 6, label: 'Louvor' },
  { value: 7, label: 'Som / Projecao' },
  { value: 8, label: 'Secretaria / Integracao' },
  { value: 9, label: 'Ensino' },
  { value: 10, label: 'Evangelizacao / Social' },
  { value: 11, label: 'Familias' },
  { value: 12, label: 'Outros' },
];

const PASTOR_ROLE = 1;
const PRESBITERO_ROLE = 2;

const getMemberRoleValue = (value: unknown): number | '' => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : '';
  }
  return '';
};

const getMemberRoleLabel = (role: unknown, roleName?: string): string => {
  if (roleName?.trim()) return roleName;
  const numericRole = getMemberRoleValue(role);
  if (numericRole === '') {
    if (typeof role === 'string' && role.trim()) return role;
    return '-';
  }
  return MEMBER_ROLE_OPTIONS.find((option) => option.value === numericRole)?.label ?? `Cargo ${numericRole}`;
};

const normalizePhone = (value: string): string => value.replace(/\D/g, '').slice(0, 11);
const normalizeCPF = (value: string): string => value.replace(/\D/g, '').slice(0, 11);
const normalizeCEP = (value: string): string => value.replace(/\D/g, '').slice(0, 8);

const formatPhone = (value: string): string => {
  const digits = normalizePhone(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

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
  zipCode: '',
  street: '',
  number: '',
  city: '',
  state: '',
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
    name: '', familyId: '', gender: 1, birthDate: '', hasBeenMarried: false, role: '', cellPhone: '',
  });
  const [ministerForm, setMinisterForm] = useState<MinistroInlineForm>(EMPTY_MINISTER_FORM);
  const [saving, setSaving] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [federations, setFederations] = useState<Federation[]>([]);
  const [ministers, setMinisters] = useState<Minister[]>([]);
  const [selectedFederationIds, setSelectedFederationIds] = useState<number[]>([]);
  const [selectedChurchIds, setSelectedChurchIds] = useState<number[]>([]);
  const [selectedCellIds, setSelectedCellIds] = useState<number[]>([]);
  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  const isLocalScope = scopeLevel === 'local';
  const isFederatedScope = scopeLevel === 'federated';

  const shouldAutoCreateMinister = (role: number | '') => role === PASTOR_ROLE || role === PRESBITERO_ROLE;
  const isPresbiteroSelected = form.role === PRESBITERO_ROLE;

  const handleMinisterCEPChange = async (value: string) => {
    const normalizedCEP = normalizeCEP(value);
    setMinisterForm((prev) => ({ ...prev, zipCode: normalizedCEP }));

    const cleanCEP = normalizedCEP;
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

  const saveMinisterForMember = async (memberId: number) => {
    const ministerBody: Record<string, unknown> = {
      memberId,
      cpf: ministerForm.cpf || '',
      email: ministerForm.email || '',
      cardValidity: ministerForm.cardValidity || undefined,
      presbiterOrdinationDate: ministerForm.presbiterOrdinationDate || undefined,
      ministerOrdinationDate: ministerForm.ministerOrdinationDate || undefined,
      address: {
        zipCode: ministerForm.zipCode || '',
        street: ministerForm.street || '',
        number: ministerForm.number || '',
        city: ministerForm.city || '',
        state: ministerForm.state || '',
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
      const [membersResult, familiesResult, churchesResult, cellsResult, federationsResult, ministersResult] = await Promise.all([
        fetchApi<Member[]>('/api/members?page=1&pageSize=100'),
        fetchApi<Family[]>('/api/families?page=1&pageSize=100'),
        fetchApi<Church[]>('/api/churches'),
        fetchApi<Cell[]>('/api/cells'),
        fetchApi<Federation[]>('/api/federations'),
        fetchApi<Minister[]>('/api/ministers?page=1&pageSize=200'),
      ]);
      setData(Array.isArray(membersResult) ? membersResult : []);
      setFamilies(Array.isArray(familiesResult) ? familiesResult : []);
      setChurches(Array.isArray(churchesResult) ? churchesResult : []);
      setCells(Array.isArray(cellsResult) ? cellsResult : []);
      setFederations(Array.isArray(federationsResult) ? federationsResult : []);
      setMinisters(Array.isArray(ministersResult) ? ministersResult : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar membros');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', familyId: '', gender: 1, birthDate: '', hasBeenMarried: false, role: '', cellPhone: '' });
    setMinisterForm(EMPTY_MINISTER_FORM);
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
      role: getMemberRoleValue(item.role),
      cellPhone: normalizePhone(item.cellPhone || ''),
    });
    setMinisterForm(EMPTY_MINISTER_FORM);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }

    if (form.familyId && !scopedFamilies.some((family) => family.id === form.familyId)) {
      toast.error('Você não tem permissão para vincular este membro a essa família.');
      return;
    }

    const normalizedCellPhone = normalizePhone(form.cellPhone);
    if (normalizedCellPhone && normalizedCellPhone.length !== 11) {
      toast.error('Telefone deve conter 11 dígitos (DDD + número)');
      return;
    }

    const normalizedMinisterCPF = normalizeCPF(ministerForm.cpf);
    const normalizedMinisterCEP = normalizeCEP(ministerForm.zipCode);
    if (shouldAutoCreateMinister(form.role)) {
      if (normalizedMinisterCPF && normalizedMinisterCPF.length !== 11) {
        toast.error('CPF do ministro deve conter 11 dígitos');
        return;
      }
      if (normalizedMinisterCEP && normalizedMinisterCEP.length !== 8) {
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
      if (form.role !== '') body.role = Number(form.role);
      if (normalizedCellPhone) body.cellPhone = normalizedCellPhone;

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
    { key: 'cellPhone', label: 'Telefone', render: (item) => item.cellPhone || '-' },
  ];

  const setF = (key: keyof MembroForm, val: string | number | boolean) => setForm(prev => ({ ...prev, [key]: val }));
  const setMinisterF = (key: keyof MinistroInlineForm, val: string) => setMinisterForm((prev) => ({ ...prev, [key]: val }));

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

  return (
    <ICRLayout title="Membros">
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
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
      <CRUDTable
        title="Membros"
        data={filteredData}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={load}
        searchPlaceholder="Buscar membro..."
        emptyMessage="Nenhum membro encontrado"
        addLabel="Novo Membro"
      />

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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Gênero</label>
                  <select value={form.gender} onChange={e => setF('gender', Number(e.target.value))}
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
                <SmartSelect
                  label="Família"
                  selectedId={form.familyId}
                  onSelect={(id) => setF('familyId', id)}
                  items={scopedFamilies.map((f) => ({ id: f.id, name: f.name }))}
                  placeholder="Selecione uma família"
                />
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Telefone</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={15}
                    value={formatPhone(form.cellPhone)}
                    onChange={e => setF('cellPhone', normalizePhone(e.target.value))}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="(21) 90000-0000"
                  />
                </div>
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Função/Cargo</label>
                <select
                  value={form.role}
                  onChange={e => setF('role', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                >
                  <option value="">Selecione uma função</option>
                  {MEMBER_ROLE_OPTIONS.map((roleOption) => (
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
                    <div>
                      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">CEP {ministerCepLoading && <span className="text-[#017158] text-xs">buscando...</span>}</label>
                      <input
                        type="text"
                        value={formatCEP(ministerForm.zipCode)}
                        onChange={(e) => handleMinisterCEPChange(e.target.value)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={9}
                        disabled={ministerCepLoading}
                        className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                        placeholder="00000-000"
                      />
                      {ministerCepError && <p className="text-red-400 text-xs mt-1">{ministerCepError}</p>}
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
