import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import { useICRApi, Federation } from '../hooks/useICRApi';
import { toast } from 'sonner';

interface FederacaoForm {
  name: string;
  ministerId: number | '';
}

export default function Federacoes() {
  const { fetchApi } = useICRApi();
  const [data, setData] = useState<Federation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Federation | null>(null);
  const [form, setForm] = useState<FederacaoForm>({ name: '', ministerId: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchApi<Federation[]>('/api/federations');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar federações');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', ministerId: '' });
    setShowModal(true);
  };

  const openEdit = (item: Federation) => {
    setEditItem(item);
    setForm({ name: item.name, ministerId: item.ministerId || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        ...(form.ministerId ? { ministerId: Number(form.ministerId) } : {}),
      };
      if (editItem) {
        await fetchApi(`/api/federations/${editItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Federação atualizada com sucesso');
      } else {
        await fetchApi('/api/federations', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Federação criada com sucesso');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Federation) => {
    await fetchApi(`/api/federations/${item.id}`, { method: 'DELETE' });
    load();
  };

  const columns: Column<Federation>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'ministerName', label: 'Ministro', render: (item) => item.ministerName || '-' },
  ];

  return (
    <ICRLayout title="Comissões Federadas">
      <CRUDTable
        title="Comissões Federadas"
        data={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={load}
        searchPlaceholder="Buscar federação..."
        emptyMessage="Nenhuma comissão federada encontrada"
        addLabel="Nova Federação"
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editItem ? 'Editar Federação' : 'Nova Federação'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] transition-colors"
                  placeholder="Nome da federação"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">ID do Ministro</label>
                <input
                  type="number"
                  value={form.ministerId}
                  onChange={(e) => setForm({ ...form, ministerId: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] transition-colors"
                  placeholder="ID do ministro responsável"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors font-['Nunito'] text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#017158] hover:bg-[#01a07e] text-white transition-colors font-['Nunito'] text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ICRLayout>
  );
}
