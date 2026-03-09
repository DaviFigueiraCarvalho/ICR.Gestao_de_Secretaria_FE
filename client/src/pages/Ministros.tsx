import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import { useICRApi, Minister } from '../hooks/useICRApi';
import { toast } from 'sonner';

interface MinistroForm {
  memberId: number | '';
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

export default function Ministros() {
  const { fetchApi } = useICRApi();
  const [data, setData] = useState<Minister[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Minister | null>(null);
  const [form, setForm] = useState<MinistroForm>({
    memberId: '', cpf: '', email: '', cardValidity: '',
    presbiterOrdinationDate: '', ministerOrdinationDate: '',
    zipCode: '', street: '', number: '', city: '', state: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchApi<Minister[]>('/api/ministers?page=1&pageSize=100');
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar ministros');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ memberId: '', cpf: '', email: '', cardValidity: '', presbiterOrdinationDate: '', ministerOrdinationDate: '', zipCode: '', street: '', number: '', city: '', state: '' });
    setShowModal(true);
  };

  const openEdit = (item: Minister) => {
    setEditItem(item);
    setForm({
      memberId: item.memberId || '',
      cpf: item.cpf || '',
      email: item.email || '',
      cardValidity: item.cardValidity ? item.cardValidity.split('T')[0] : '',
      presbiterOrdinationDate: item.presbiterOrdinationDate ? item.presbiterOrdinationDate.split('T')[0] : '',
      ministerOrdinationDate: item.ministerOrdinationDate ? item.ministerOrdinationDate.split('T')[0] : '',
      zipCode: item.address?.zipCode || '',
      street: item.address?.street || '',
      number: item.address?.number || '',
      city: item.address?.city || '',
      state: item.address?.state || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.memberId) { toast.error('ID do membro é obrigatório'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        memberId: Number(form.memberId),
        cpf: form.cpf,
        email: form.email,
        cardValidity: form.cardValidity || undefined,
        presbiterOrdinationDate: form.presbiterOrdinationDate || undefined,
        ministerOrdinationDate: form.ministerOrdinationDate || undefined,
        address: {
          zipCode: form.zipCode,
          street: form.street,
          number: form.number,
          city: form.city,
          state: form.state,
        },
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
    { key: 'churchMemberName', label: 'Igreja', render: (item) => item.churchMemberName || '-' },
    { key: 'federationMemberName', label: 'Federação', render: (item) => item.federationMemberName || '-' },
    { key: 'email', label: 'E-mail', render: (item) => item.email || '-' },
    { key: 'cpf', label: 'CPF', render: (item) => item.cpf || '-' },
    { key: 'cardValidity', label: 'Validade Carteira', render: (item) => item.cardValidity ? new Date(item.cardValidity).toLocaleDateString('pt-BR') : '-' },
    { key: 'ministerOrdinationDate', label: 'Ordenação Ministro', render: (item) => item.ministerOrdinationDate ? new Date(item.ministerOrdinationDate).toLocaleDateString('pt-BR') : '-' },
  ];

  const setF = (key: keyof MinistroForm, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

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
      />

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
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">ID Membro *</label>
                  <input type="number" value={form.memberId} onChange={e => setF('memberId', e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="ID do membro" />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">CPF</label>
                  <input type="text" value={form.cpf} onChange={e => setF('cpf', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="000.000.000-00" />
                </div>
                <div className="col-span-2">
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={e => setF('email', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Validade Carteira</label>
                  <input type="date" value={form.cardValidity} onChange={e => setF('cardValidity', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Ordenação Presbítero</label>
                  <input type="date" value={form.presbiterOrdinationDate} onChange={e => setF('presbiterOrdinationDate', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Ordenação Ministro</label>
                  <input type="date" value={form.ministerOrdinationDate} onChange={e => setF('ministerOrdinationDate', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" />
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
