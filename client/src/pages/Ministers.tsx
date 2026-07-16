import React, { useEffect, useRef, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import { useICRApi, Minister, Member } from '../hooks/useICRApi';
import { settledValue } from '@/lib/utils';
import { useViaCEP } from '../hooks/useViaCEP';
import { PRESBITERO_ROLE, getMemberRoleValue } from '../lib/member-roles';
import { useLocation } from 'wouter';
import { countrySelectItems, DEFAULT_COUNTRY_CODE, formatPostalCode, normalizePostalCode } from '../lib/country';
import { toast } from 'sonner';
import { getMinisterCoverageBadgeClass, getMinisterCoverageLabel, resolveMinisterCoverageStatus, summarizeMinisterCoverage } from '../lib/minister-coverage';
import { useMemo } from 'react';
import { useSharedMinisterData } from '../hooks/useSharedMinisterData';
import { formatDateOnly } from '../lib/date-utils';

interface MinistroForm {
  memberId: number | '';
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
const getPhoneDisplay = (phone?: Minister['memberPhone'] | Member['cellPhone']): string => {
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

export default function Ministros() {
  const { fetchApi } = useICRApi();
  const [location, setLocation] = useLocation();
  const { fetchCEP, loading: cepLoading, error: cepError } = useViaCEP();
  const todayDate = new Date().toISOString().split('T')[0];
  const [data, setData] = useState<Minister[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Minister | null>(null);
  const [insurance, setInsurance] = useState(false);
  const [form, setForm] = useState<MinistroForm>({
    memberId: '', cpf: '', email: '', cardValidity: '',
    presbiterOrdinationDate: '', ministerOrdinationDate: '',
    countryCode: DEFAULT_COUNTRY_CODE, postalCode: '', street: '', number: '', complement: '', city: '', state: '', countyOrRegion: '',
  });
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMinister, setSelectedMinister] = useState<Minister | null>(null);
  const handledPrefillRef = useRef<string | null>(null);
  const { data: sharedData, reload: reloadShared, invalidate: invalidateShared, isLoading: sharedLoading, error: sharedError } = useSharedMinisterData();
  const selectedMember = members.find((member) => member.id === form.memberId);
  const isSelectedMemberPresbitero = getMemberRoleValue(selectedMember?.role) === PRESBITERO_ROLE;

  const coverageSummary = useMemo(() => summarizeMinisterCoverage(data), [data]);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ministersResult, membersResult] = await Promise.allSettled([
        fetchApi<Minister[]>('/api/ministers?pageNumber=1&pageQuantity=100'),
        fetchApi<Member[]>('/api/members?pageNumber=1&pageQuantity=100'),
      ]);

      if (ministersResult.status === 'rejected') {
        throw ministersResult.reason;
      }

      setData(Array.isArray(ministersResult.value) ? ministersResult.value : []);
      setMembers(settledValue(membersResult) ?? []);
      invalidateShared();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar ministros');
    } finally {
      setIsLoading(false);
    }
  };

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
            // Mantém o número como estava
          }));
          toast.success('Endereço preenchido automaticamente');
        }
      }
    };

    // Funções auxiliares para colar datas de forma segura - cada handler é independente
    const handlePasteDate = React.useCallback(async (fieldName: string) => {
      try {
        const text = await navigator.clipboard.readText();
        const { parseDateString } = await import('@/lib/date-utils');
        const parsedDate = parseDateString(text);
        if (parsedDate) {
          // Garante que APENAS este campo é atualizado, preservando todos os outros
          setForm((prev) => {
            // Retorna um novo objeto com todos os campos anteriores + campo atualizado
            return { ...prev, [fieldName]: parsedDate };
          });
        }
      } catch (err) {
        console.error('Erro ao colar data:', err);
      }
    }, []);

    const handleCardValidityPaste = React.useCallback(() => handlePasteDate('cardValidity'), [handlePasteDate]);
    const handlePresbiterPaste = React.useCallback(() => handlePasteDate('presbiterOrdinationDate'), [handlePasteDate]);
    const handlePastorPaste = React.useCallback(() => handlePasteDate('ministerOrdinationDate'), [handlePasteDate]);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const [path, query = ''] = location.split('?');
    if (path !== '/ministers') return;

    const params = new URLSearchParams(query);
    const shouldOpenNew = params.get('openNew') === '1';
    const rawMemberId = params.get('memberId');
    const memberId = rawMemberId ? Number(rawMemberId) : NaN;

    if (!shouldOpenNew || !Number.isFinite(memberId) || memberId <= 0) {
      return;
    }

    const prefillKey = `${memberId}`;
    if (handledPrefillRef.current === prefillKey) {
      return;
    }
    handledPrefillRef.current = prefillKey;

    const prefillAndOpen = async () => {
      try {
        const exists = members.some((member) => member.id === memberId);
        if (!exists) {
          const fetchedMember = await fetchApi<Member>(`/api/members/${memberId}`);
          if (fetchedMember?.id) {
            setMembers((prev) => {
              if (prev.some((member) => member.id === fetchedMember.id)) return prev;
              return [...prev, fetchedMember];
            });
          }
        }
      } catch {
        toast.error('Nao foi possivel pre-selecionar o membro criado.');
      } finally {
        openAdd(memberId);
        setLocation('/ministers');
      }
    };

    prefillAndOpen();
  }, [location, members, fetchApi, setLocation]);

  const openAdd = (memberId?: number) => {
    setEditItem(null);
    setInsurance(false);
    setForm({ memberId: memberId ?? '', cpf: '', email: '', cardValidity: '', presbiterOrdinationDate: '', ministerOrdinationDate: '', countryCode: DEFAULT_COUNTRY_CODE, postalCode: '', street: '', number: '', complement: '', city: '', state: '', countyOrRegion: '' });
    setShowModal(true);
  };

  const openEdit = (item: Minister) => {
    setEditItem(item);
    setInsurance(item.insurance ?? item.insured ?? item.isInsured ?? item.segurado ?? false);
    setForm({
      memberId: item.memberId || '',
      cpf: item.cpf || '',
      email: item.email || '',
      cardValidity: item.cardValidity ? item.cardValidity.split('T')[0] : '',
      presbiterOrdinationDate: item.presbiterOrdinationDate ? item.presbiterOrdinationDate.split('T')[0] : '',
      ministerOrdinationDate: item.ministerOrdinationDate ? item.ministerOrdinationDate.split('T')[0] : '',
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
    if (!form.memberId) { toast.error('ID do membro é obrigatório'); return; }
    const normalizedCpf = normalizeCPF(form.cpf);
    const normalizedPostalCode = normalizePostalCode(form.countryCode, form.postalCode);
    if (normalizedCpf && normalizedCpf.length !== 11) {
      toast.error('CPF deve conter 11 dígitos');
      return;
    }
    if (form.countryCode === 'BR' && normalizedPostalCode && normalizedPostalCode.length !== 8) {
      toast.error('CEP deve conter 8 dígitos');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        memberId: Number(form.memberId),
        cpf: normalizedCpf,
        email: form.email,
        cardValidity: form.cardValidity || undefined,
        presbiterOrdinationDate: form.presbiterOrdinationDate || undefined,
        ministerOrdinationDate: form.ministerOrdinationDate || undefined,
        address: {
          countryCode: form.countryCode,
          postalCode: normalizedPostalCode,
          street: form.street,
          number: form.number,
          complement: form.complement,
          city: form.city,
          state: form.state,
          countyOrRegion: form.countyOrRegion,
        },
        insurance: insurance
      };
      if (editItem) {
        await fetchApi(`/api/ministers/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('Ministro atualizado com sucesso');
      } else {
        await fetchApi('/api/ministers', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Ministro criado com sucesso');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Minister) => {
    await fetchApi(`/api/ministers/${item.id}`, { method: 'DELETE' });
    load();
  };

  const columns: Column<Minister>[] = [
    { key: 'id', label: 'ID' },
    { key: 'memberName', label: 'Nome', render: (item) => item.memberName || '-' },
    { key: 'phone', label: 'Telefone', render: (item) => getPhoneDisplay(item.memberPhone || item.member?.cellPhone) },
    { key: 'email', label: 'E-mail', render: (item) => item.email || '-' },
    { key: 'memberBirthday', label: 'Nascimento', render: (item) => formatDateOnly(item.memberBirthday) },
    { key: 'memberWeddingDate', label: 'Casamento', render: (item) => formatDateOnly(item.memberWeddingDate) },
    {
      key: 'coverage',
      label: 'Cobertura',
      render: (item) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getMinisterCoverageBadgeClass(item)}`}>
          {getMinisterCoverageLabel(item)}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Card',
      render: (item) => (
        <button
          type="button"
          onClick={() => setSelectedMinister(item)}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-['Nunito'] text-white/80 hover:border-[#017158] hover:text-white transition-colors"
        >
          Ver card
        </button>
      ),
    },
  ];

  const setF = (key: keyof MinistroForm, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

  const topContent = (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-white/50 text-xs uppercase tracking-[0.2em] font-['Nunito']">Total</p>
          <p className="text-white text-2xl font-['Nunito'] font-semibold">{coverageSummary.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-emerald-200 text-xs uppercase tracking-[0.2em] font-['Nunito']">Segurados / elegíveis</p>
          <p className="text-white text-2xl font-['Nunito'] font-semibold">{coverageSummary.covered}</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
          <p className="text-rose-200 text-xs uppercase tracking-[0.2em] font-['Nunito']">Não segurados</p>
          <p className="text-white text-2xl font-['Nunito'] font-semibold">{coverageSummary.uncovered}</p>
        </div>
      </div>
    </div>
  );

  const ministerCard = selectedMinister ? (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#202020] shadow-2xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 sticky top-0 bg-[#202020] rounded-t-3xl z-10">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-[0.2em] font-['Nunito']">Card do ministro</p>
              <h3 className="text-white text-2xl font-['Nunito'] font-semibold">{selectedMinister.memberName || 'Ministro'}</h3>
            </div>
            <button onClick={() => setSelectedMinister(null)} className="text-white/50 hover:text-white transition-colors">
              <span className="material-icons">close</span>
            </button>
          </div>

          <div className="grid gap-4 px-6 py-6 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-[0.2em] font-['Nunito']">Status</p>
                    <p className="text-white text-lg font-['Nunito']">{getMinisterCoverageLabel(selectedMinister)}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getMinisterCoverageBadgeClass(selectedMinister)}`}>
                    {getMinisterCoverageLabel(selectedMinister)}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile label="Telefone" value={getPhoneDisplay(selectedMinister.memberPhone || selectedMinister.member?.cellPhone)} />
                <InfoTile label="E-mail" value={selectedMinister.email || '-'} />
                <InfoTile label="Nascimento" value={formatDateOnly(selectedMinister.memberBirthday)} />
                <InfoTile label="Casamento" value={formatDateOnly(selectedMinister.memberWeddingDate)} />
                <InfoTile label="CPF" value={selectedMinister.cpf || '-'} />
                <InfoTile label="Validade da carteira" value={formatDateOnly(selectedMinister.cardValidity)} />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <InfoTile label="Igreja" value={selectedMinister.churchMemberName || '-'} compact />
              <InfoTile label="Federação" value={selectedMinister.federationMemberName || '-'} compact />
              <InfoTile label="Ordenação Presbítero" value={formatDateOnly(selectedMinister.presbiterOrdinationDate)} compact />
              <InfoTile label="Ordenação a Pastor" value={formatDateOnly(selectedMinister.ministerOrdinationDate)} compact />
              <InfoTile label="Endereço" value={selectedMinister.address ? [selectedMinister.address.street, selectedMinister.address.number, selectedMinister.address.complement, selectedMinister.address.city, selectedMinister.address.state, selectedMinister.address.countyOrRegion].filter(Boolean).join(', ') : '-'} compact />
              <InfoTile label="Código postal" value={selectedMinister.address?.postalCode || '-'} compact />
            </div>
          </div>
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

  return (
    <ICRLayout title="Pastores e Presbíteros">
      <CRUDTable
        title="Pastores e Presbíteros"
        data={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={load}
        searchPlaceholder="Buscar ministro..."
        emptyMessage="Nenhum ministro encontrado"
        addLabel="Novo Ministro"
        topContent={topContent}
      />

      {ministerCard}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editItem ? 'Editar Ministro' : 'Novo Ministro'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
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
                  label="Membro *"
                  selectedId={form.memberId}
                  selectedItem={members.find(m => m.id === form.memberId) ? { id: members.find(m => m.id === form.memberId)!.id, name: members.find(m => m.id === form.memberId)!.name } : null}
                  onSelect={(id) => setF('memberId', typeof id === 'number' ? id : '')}
                  fetchItems={async (page, query) => {
                    const params = new URLSearchParams();
                    params.append('pageNumber', String(page));
                    params.append('pageQuantity', '10');
                    if (query) params.append('query', query);
                    const result = await fetchApi<Member[]>(`/api/members?${params}`);
                    return Array.isArray(result) ? result.map(m => ({ id: m.id, name: m.name })) : [];
                  }}
                  placeholder="Selecione um membro"
                  required
                />
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">CPF</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={14}
                    value={formatCPF(form.cpf)}
                    onChange={e => setF('cpf', normalizeCPF(e.target.value))}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={e => setF('email', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Validade Carteira</label>
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      value={form.cardValidity} 
                      onChange={e => setF('cardValidity', e.target.value)}
                      className="flex-1 bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" 
                    />
                    <button
                      type="button"
                      onClick={handleCardValidityPaste}
                      className="px-3 py-2.5 bg-[#1c1c1c] border border-white/20 rounded-lg hover:border-[#017158] shrink-0"
                      title="Colar data"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m0 0V3a2 2 0 00-2-2h-2a2 2 0 00-2 2v2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Ordenação Presbítero</label>
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      max={todayDate} 
                      value={form.presbiterOrdinationDate} 
                      onChange={e => setF('presbiterOrdinationDate', e.target.value)}
                      className="flex-1 bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" 
                    />
                    <button
                      type="button"
                      onClick={handlePresbiterPaste}
                      className="px-3 py-2.5 bg-[#1c1c1c] border border-white/20 rounded-lg hover:border-[#017158] shrink-0"
                      title="Colar data"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m0 0V3a2 2 0 00-2-2h-2a2 2 0 00-2 2v2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                {!isSelectedMemberPresbitero && (
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Ordenação a Pastor</label>
                    <div className="flex gap-2">
                      <input 
                        type="date" 
                        max={todayDate} 
                        value={form.ministerOrdinationDate} 
                        onChange={e => setF('ministerOrdinationDate', e.target.value)}
                        className="flex-1 bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" 
                      />
                      <button
                        type="button"
                        onClick={handlePastorPaste}
                        className="px-3 py-2.5 bg-[#1c1c1c] border border-white/20 rounded-lg hover:border-[#017158] shrink-0"
                        title="Colar data"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m0 0V3a2 2 0 00-2-2h-2a2 2 0 00-2 2v2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                )}
  <div className="col-span-2">
    <label className="flex items-center gap-3 rounded-lg border border-white/10 p-3 cursor-pointer">
      <input
        type="checkbox"
        checked={insurance}
        onChange={(e) => setInsurance(e.target.checked)}
        className="h-4 w-4 accent-[#017158]"
      />

      <span className="text-white font-['Nunito']">
        Segurado
      </span>
    </label>
  </div>

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
                      inputMode="numeric"
                      pattern={form.countryCode === 'BR' ? '[0-9]*' : undefined}
                      maxLength={form.countryCode === 'BR' ? 9 : 24}
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
