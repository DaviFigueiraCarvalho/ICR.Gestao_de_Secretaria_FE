import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import { useICRApi, Cell, Church } from '../hooks/useICRApi';
import { toast } from 'sonner';

interface CelulaForm {
  name: string;
  type: string;
  churchId: number | '';
  responsibleId: number | '';
}

export default function Celulas() {
  const { fetchApi } = useICRApi();
  const [data, setData] = useState<Cell[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Cell | null>(null);
  const [form, setForm] = useState<CelulaForm>({ name: '', type: '', churchId: '', responsibleId: '' });
  const [saving, setSaving] = useState(false);
  const [churches, setChurches] = useState<Church[]>([]);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchApi<Cell[]>('/api/cells');
      setData(result);
      const churchesResult = await fetchApi<Church[]>('/api/churches');
      setChurches(churchesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar células');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const loadData = async () => {
  const [cellsRes, churchesRes] = await Promise.all([
    fetchApi<Cell[]>('/api/cells'),
    fetchApi<Church[]>('/api/churches')
  ]);
  setData(cellsRes);
  setChurches(churchesRes);
};
  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', type: '', churchId: '', responsibleId: '' });
    setShowModal(true);
  };

  const openEdit = (item: Cell) => {
    setEditItem(item);
    setForm({
      name: item.name,
      type: item.type || '',
      churchId: item.churchId || '',
      responsibleId: item.responsibleId || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.churchId) { toast.error('Igreja é obrigatória'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        type: form.type || undefined,
        churchId: Number(form.churchId),
        ...(form.responsibleId ? { responsibleId: Number(form.responsibleId) } : {}),
      };
      if (editItem) {
        await fetchApi(`/api/cells/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('Célula atualizada com sucesso');
      } else {
        await fetchApi('/api/cells', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Célula criada com sucesso');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Cell) => {
    await fetchApi(`/api/cells/${item.id}`, { method: 'DELETE' });
    load();
  };

  const columns: Column<Cell>[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo', render: (item) => item.type || '-' },
    { key: 'church', label: 'Igreja', render: (item) => item.church?.name || '-' },
    { key: 'responsible', label: 'Responsável', render: (item) => item.responsible?.name || '-' },
  ];

  return (
    <ICRLayout title="Células">
      <CRUDTable
        title="Células"
        data={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={load}
        searchPlaceholder="Buscar célula..."
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
                <input type="text" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder="Tipo da célula" />
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Igreja *</label>
                <select 
                  value={form.churchId} 
                  onChange={e => setForm({ ...form, churchId: Number(e.target.value) })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white focus:border-[#017158] outline-none"
                >
                  <option value="">Selecione uma igreja</option>
                  {churches.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">ID Responsável</label>
                <input type="number" value={form.responsibleId} onChange={e => setForm({ ...form, responsibleId: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder="ID do responsável" />
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
