import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import { useICRApi, Family, Church, Cell, Member } from '../hooks/useICRApi';
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
  const [data, setData] = useState<Family[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Family | null>(null);
  const [form, setForm] = useState<FamiliaForm>({ name: '', churchId: '', cellId: '', manId: '', womanId: '', weddingDate: '' });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [churches, setChurches] = useState<Church[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [churchesRes, cellsRes, membersRes] = await Promise.all([
          fetchApi<Church[]>('/api/churches'),
          fetchApi<Cell[]>('/api/cells'),
          fetchApi<Member[]>('/api/members'),
        ]);
        setChurches(churchesRes);
        setCells(cellsRes);
        setMembers(membersRes);
      } catch (err) {
        console.error('Erro ao carregar dados auxiliares:', err);
      }
    };

    loadLookups();
  }, [fetchApi]);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchApi<Family[]>(`/api/families?page=${page}&pageSize=100`);
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar famílias');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', churchId: '', cellId: '', manId: '', womanId: '', weddingDate: '' });
    setShowModal(true);
  };

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
    { key: 'church', label: 'Igreja', render: (item) => item.church?.name || '-' },
    { key: 'cell', label: 'Célula', render: (item) => item.cell?.name || '-' },
    { key: 'man', label: 'Marido', render: (item) => item.man?.name || '-' },
    { key: 'woman', label: 'Esposa', render: (item) => item.woman?.name || '-' },
    { key: 'weddingDate', label: 'Casamento', render: (item) => item.weddingDate ? new Date(item.weddingDate).toLocaleDateString('pt-BR') : '-' },
  ];

  const setF = (key: keyof FamiliaForm, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <ICRLayout title="Famílias">
      <CRUDTable
        title="Famílias"
        data={data}
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
                  onSelect={id => setF('churchId', id)}
                  items={churches.map(c => ({ id: c.id, name: c.name }))}
                  placeholder="Selecione uma igreja"
                  required
                />
                <SmartSelect
                  label="Célula"
                  selectedId={form.cellId}
                  onSelect={id => setF('cellId', id)}
                  items={cells.map(c => ({ id: c.id, name: c.name }))}
                  placeholder="Selecione uma célula"
                />
                <SmartSelect
                  label="Marido"
                  selectedId={form.manId}
                  onSelect={id => setF('manId', id)}
                  items={members.map(m => ({ id: m.id, name: m.name }))}
                  placeholder="Selecione um membro"
                />
                <SmartSelect
                  label="Esposa"
                  selectedId={form.womanId}
                  onSelect={id => setF('womanId', id)}
                  items={members.map(m => ({ id: m.id, name: m.name }))}
                  placeholder="Selecione um membro"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Data de Casamento</label>
                <input type="date" value={form.weddingDate} onChange={e => setF('weddingDate', e.target.value)}
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
