import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import SmartSelect from '../components/SmartSelect';
import { useICRApi, Member, Family } from '../hooks/useICRApi';
import { toast } from 'sonner';

interface MembroForm {
  name: string;
  familyId: number | '';
  gender: string;
  birthDate: string;
  hasBeenMarried: boolean;
  role: string;
  cellPhone: string;
}

export default function Membros() {
  const { fetchApi } = useICRApi();
  const [data, setData] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Member | null>(null);
  const [form, setForm] = useState<MembroForm>({
    name: '', familyId: '', gender: 'MALE', birthDate: '', hasBeenMarried: false, role: '', cellPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [membersResult, familiesResult] = await Promise.all([
        fetchApi<Member[]>('/api/members?page=1&pageSize=100'),
        fetchApi<Family[]>('/api/families?page=1&pageSize=100'),
      ]);
      setData(Array.isArray(membersResult) ? membersResult : []);
      setFamilies(Array.isArray(familiesResult) ? familiesResult : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar membros');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', familyId: '', gender: 'MALE', birthDate: '', hasBeenMarried: false, role: '', cellPhone: '' });
    setShowModal(true);
  };

  const openEdit = (item: Member) => {
    setEditItem(item);
    setForm({
      name: item.name,
      familyId: item.familyId || '',
      gender: item.gender || 'MALE',
      birthDate: item.birthDate ? item.birthDate.split('T')[0] : '',
      hasBeenMarried: item.hasBeenMarried || false,
      role: item.role || '',
      cellPhone: item.cellPhone || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        gender: form.gender,
        hasBeenMarried: form.hasBeenMarried,
      };
      if (form.familyId) body.familyId = Number(form.familyId);
      if (form.birthDate) body.birthDate = form.birthDate;
      if (form.role) body.role = form.role;
      if (form.cellPhone) body.cellPhone = form.cellPhone;

      if (editItem) {
        await fetchApi(`/api/members/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('Membro atualizado com sucesso');
      } else {
        await fetchApi('/api/members', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Membro criado com sucesso');
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
    { key: 'roleName', label: 'Função', render: (item) => item.roleName || item.role || '-' },
    { key: 'genderName', label: 'Gênero', render: (item) => item.genderName || (item.gender === 'MALE' ? 'Masculino' : 'Feminino') },
    { key: 'familyName', label: 'Família', render: (item) => item.familyName || '-' },
    { key: 'familyChurchName', label: 'Igreja', render: (item) => item.familyChurchName || '-' },
    { key: 'birthDate', label: 'Nascimento', render: (item) => item.birthDate ? new Date(item.birthDate).toLocaleDateString('pt-BR') : '-' },
    { key: 'cellPhone', label: 'Telefone', render: (item) => item.cellPhone || '-' },
  ];

  const setF = (key: keyof MembroForm, val: string | number | boolean) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <ICRLayout title="Membros">
      <CRUDTable
        title="Membros"
        data={data}
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
                  <select value={form.gender} onChange={e => setF('gender', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]">
                    <option value="MALE">Masculino</option>
                    <option value="FEMALE">Feminino</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Data de Nascimento</label>
                  <input type="date" value={form.birthDate} onChange={e => setF('birthDate', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]" />
                </div>
                <SmartSelect
                  label="Família"
                  selectedId={form.familyId}
                  onSelect={(id) => setF('familyId', id)}
                  items={families.map((f) => ({ id: f.id, name: f.name }))}
                  placeholder="Selecione uma família"
                />
                <div>
                  <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Telefone</label>
                  <input type="text" value={form.cellPhone} onChange={e => setF('cellPhone', e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                    placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Função/Cargo</label>
                <input type="text" value={form.role} onChange={e => setF('role', e.target.value)}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder="Função na igreja" />
              </div>
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
