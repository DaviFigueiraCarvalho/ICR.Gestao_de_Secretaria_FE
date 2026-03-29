import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import MultiSmartSelect from '../components/MultiSmartSelect';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { getScopeLevel } from '../lib/scope-access';
import { useICRApi, Cell, Church, Federation, Minister } from '../hooks/useICRApi';
import { useViaCEP } from '../hooks/useViaCEP';
import { toast } from 'sonner';

interface IgrejaForm {
  name: string;
  federationId: number | '';
  ministerId: number | '';
  zipCode: string;
  street: string;
  number: string;
  city: string;
  state: string;
}

export default function Igrejas() {
  const { fetchApi } = useICRApi();
  const { user } = useICRAuth();
  const { fetchCEP, loading: cepLoading, error: cepError } = useViaCEP();
  const [data, setData] = useState<Church[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Church | null>(null);
  const [form, setForm] = useState<IgrejaForm>({
    name: '', federationId: '', ministerId: '',
    zipCode: '', street: '', number: '', city: '', state: '',
  });
  const [saving, setSaving] = useState(false);
  const [federations, setFederations] = useState<Federation[]>([]);
  const [ministers, setMinisters] = useState<Minister[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [selectedFederationIds, setSelectedFederationIds] = useState<number[]>([]);
  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  const isFederatedScope = scopeLevel === 'federated';

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [churchesResult, federationsResult, ministersResult, cellsResult] = await Promise.all([
        fetchApi<Church[]>('/api/churches'),
        fetchApi<Federation[]>('/api/federations'),
        fetchApi<Minister[]>('/api/ministers'),
        fetchApi<Cell[]>('/api/cells'),
      ]);
      setData(churchesResult);
      setFederations(federationsResult);
      setMinisters(ministersResult);
      setCells(cellsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar igrejas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCEPChange = async (value: string) => {
    setForm(prev => ({ ...prev, zipCode: value }));
    
    // Autocomplete quando atingir 8 dígitos
    const cleanCEP = value.replace(/\D/g, '');
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

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', federationId: '', ministerId: '', zipCode: '', street: '', number: '', city: '', state: '' });
    setShowModal(true);
  };

  const openEdit = (item: Church) => {
    setEditItem(item);
    setForm({
      name: item.name,
      federationId: item.federationId || '',
      ministerId: item.ministerId || '',
      zipCode: item.address?.zipCode || '',
      street: item.address?.street || '',
      number: item.address?.number || '',
      city: item.address?.city || '',
      state: item.address?.state || '',
    });
    setShowModal(true);
  };

const handleSave = async () => {
  // 1. Validações básicas no Front
  if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
  if (!form.federationId) { toast.error('Area é obrigatória'); return; }

  // 2. Limpeza do CEP (Remove hífens e pontos) para evitar o erro de 8 dígitos do Backend
  const cleanZipCode = form.zipCode.replace(/\D/g, '');
  
  if (cleanZipCode.length > 0 && cleanZipCode.length !== 8) {
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
        zipCode: cleanZipCode,
        street: form.street,
        number: form.number,
        city: form.city,
        state: form.state
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
    await load(); // Recarrega a lista
  } catch (err) {
    console.error("Erro detalhado:", err);
    toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
  } finally {
    setSaving(false);
  }
};
  const handleDelete = async (item: Church) => {
    const shouldMoveDependencies = window.confirm(
      'Deseja mover os dados dependentes para outra igreja antes de excluir?\n\nOK = mover dependencias\nCancelar = excluir em cascata',
    );

    let targetChurchId: number | undefined;
    let targetCellId: number | undefined;

    if (shouldMoveDependencies) {
      const availableChurches = data.filter((church) => church.id !== item.id);

      if (availableChurches.length === 0) {
        throw new Error('Nao existe outra igreja disponivel para mover os dados dependentes.');
      }

      const churchPrompt = window.prompt(
        `Informe o ID da igreja de destino:\n${availableChurches
          .map((church) => `${church.id} - ${church.name}`)
          .join('\n')}`,
      );

      const parsedTargetChurchId = Number(churchPrompt);
      if (!Number.isFinite(parsedTargetChurchId) || !availableChurches.some((church) => church.id === parsedTargetChurchId)) {
        throw new Error('ID da igreja de destino invalido.');
      }

      targetChurchId = parsedTargetChurchId;

      const targetChurchCells = cells.filter((cell) => cell.churchId === parsedTargetChurchId);
      if (targetChurchCells.length > 0) {
        const cellPrompt = window.prompt(
          `Informe o ID da celula de destino (opcional):\n${targetChurchCells
            .map((cell) => `${cell.id} - ${cell.name}`)
            .join('\n')}`,
        );

        if (cellPrompt?.trim()) {
          const parsedTargetCellId = Number(cellPrompt);
          if (!Number.isFinite(parsedTargetCellId) || !targetChurchCells.some((cell) => cell.id === parsedTargetCellId)) {
            throw new Error('ID da celula de destino invalido para a igreja escolhida.');
          }
          targetCellId = parsedTargetCellId;
        }
      }
    }

    const query = new URLSearchParams();
    if (targetChurchId) query.set('targetChurchId', String(targetChurchId));
    if (targetCellId) query.set('targetCellId', String(targetCellId));

    const path = query.toString()
      ? `/api/churches/bulk/${item.id}?${query.toString()}`
      : `/api/churches/bulk/${item.id}`;

    await fetchApi(path, { method: 'DELETE' });
    load();
  };

  const columns: Column<Church>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'federationName', label: 'Área', render: (item) => item.federationName || '-' },
    { key: 'ministerName', label: 'Ministro', render: (item) => item.ministerName || '-' },
    { key: 'city', label: 'Cidade', render: (item) => item.address?.city || '-' },
    { key: 'state', label: 'Estado', render: (item) => item.address?.state || '-' },
  ];

  const federationOptions = useMemo(
    () => federations.map((federation) => ({ id: federation.id, name: `${federation.id} - ${federation.name}` })),
    [federations],
  );

  const filteredData = useMemo(() => {
    if (selectedFederationIds.length === 0) return data;

    return data.filter((church) =>
      typeof church.federationId === 'number' && selectedFederationIds.includes(church.federationId),
    );
  }, [data, selectedFederationIds]);

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

    setSelectedFederationIds([lockedFederationId]);
    setForm((prev) => ({ ...prev, federationId: lockedFederationId }));
  }, [isFederatedScope, lockedFederationId]);

  const setF = (key: keyof IgrejaForm, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <ICRLayout title="Igrejas">
      {!isFederatedScope && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <MultiSmartSelect
            label="Filtro por Áreas"
            selectedIds={selectedFederationIds}
            onChange={setSelectedFederationIds}
            items={federationOptions}
            placeholder="Todas as áreas"
          />
        </div>
      )}
      <CRUDTable
        title="Igrejas"
        data={filteredData}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={load}
        searchPlaceholder="Buscar igreja..."
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
                  label="Area"
                  selectedId={form.federationId}
                  onSelect={(id) => {
                    if (isFederatedScope) return;
                    setF('federationId', id);
                  }}
                  items={isFederatedScope && lockedFederationId
                    ? federations.filter((f) => f.id === lockedFederationId).map((f) => ({ id: f.id, name: f.name }))
                    : federations.map((f) => ({ id: f.id, name: f.name }))}
                  placeholder="Selecione uma área"
                  required
                  disabled={isFederatedScope}
                />
                <SmartSelect
                  label="Ministro"
                  selectedId={form.ministerId}
                  onSelect={(id) => setF('ministerId', id)}
                  items={ministers.map((m) => ({ id: m.id, name: m.memberName || m.id.toString() }))}
                  placeholder="Selecione um ministro"
                />
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-white/50 text-xs font-['Nunito'] mb-3 uppercase tracking-wider">Endereço</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">CEP {cepLoading && <span className="text-[#017158] text-xs">buscando...</span>}</label>
                    <input 
                      type="text" 
                      value={form.zipCode} 
                      onChange={e => handleCEPChange(e.target.value)}
                      disabled={cepLoading}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
                      placeholder="00000-000" 
                    />
                    {cepError && <p className="text-red-400 text-xs mt-1">{cepError}</p>}
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
