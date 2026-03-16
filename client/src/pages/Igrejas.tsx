import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import { useICRApi, Church } from '../hooks/useICRApi';
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

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchApi<Church[]>('/api/churches');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar igrejas');
    } finally {
      setIsLoading(false);
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
  if (!form.federationId) { toast.error('Federação é obrigatória'); return; }

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
    await fetchApi(`/api/churches/${item.id}`, { method: 'DELETE' });
    load();
  };

  const columns: Column<Church>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'federationName', label: 'Federação', render: (item) => item.federationName || '-' },
    { key: 'ministerName', label: 'Ministro', render: (item) => item.ministerName || '-' },
    { key: 'city', label: 'Cidade', render: (item) => item.address?.city || '-' },
    { key: 'state', label: 'Estado', render: (item) => item.address?.state || '-' },
  ];

  const setF = (key: keyof IgrejaForm, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <ICRLayout title="Igrejas">
      <CRUDTable
        title="Igrejas"
        data={data}
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
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">ID Federação *</label>
                  <input type="number" value={form.federationId} onChange={e => setF('federationId', e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="ID da federação" />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">ID Ministro</label>
                  <input type="number" value={form.ministerId} onChange={e => setF('ministerId', e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="ID do ministro" />
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-white/50 text-xs font-['Nunito'] mb-3 uppercase tracking-wider">Endereço</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/70 text-sm font-['Nunito'] block mb-1">CEP</label>
                    <input type="text" value={form.zipCode} onChange={e => setF('zipCode', e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                      placeholder="00000-000" />
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
