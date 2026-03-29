import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import CRUDTable, { Column } from '../components/CRUDTable';
import { Member, useICRApi } from '../hooks/useICRApi';
import { toast } from 'sonner';

interface Usuario {
  id: number;
  username: string;
  memberId: number | null;
  memberName: string;
  scope: number;
}

interface Role {
  id: number;
  name: string;
  minimalScope: number;
  active: boolean;
  description?: string;
}

interface UsuarioForm {
  username: string;
  password: string;
  memberId: number | '';
  scope: number;
}

interface RoleForm {
  name: string;
  minimalScope: number;
  description: string;
  active: boolean;
}

function scopeLabel(scope: number): string {
  if (scope === 0) return 'Local';
  if (scope === 1) return 'Área';
  if (scope === 2) return 'Federação';
  return '-';
}

function toStringOrDash(value: unknown): string {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text.length > 0 ? text : '-';
}

function normalizeUsers(payload: unknown): Usuario[] {
  const rawList = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { content?: unknown[] }).content)
      ? (payload as { content: unknown[] }).content
      : [];

  return rawList.map((item, index) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const numericId = Number(row.id);
    const numericScope = Number(row.scope);
    const numericMemberId = Number(row.memberId);

    return {
      id: Number.isFinite(numericId) && numericId > 0 ? numericId : index + 1,
      username: toStringOrDash(row.username ?? row.login),
      memberId: Number.isFinite(numericMemberId) && numericMemberId > 0 ? numericMemberId : null,
      memberName: toStringOrDash(row.memberName ?? row.name),
      scope: Number.isFinite(numericScope) ? numericScope : 2,
    };
  });
}

function normalizeRoles(payload: unknown): Role[] {
  const rawList = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { content?: unknown[] }).content)
      ? (payload as { content: unknown[] }).content
      : [];

  return rawList
    .map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const numericId = Number(row.id);
      return {
        id: Number.isFinite(numericId) && numericId > 0 ? numericId : index + 1,
        name: toStringOrDash(row.name),
        minimalScope: Number.isFinite(Number(row.minimalScope)) ? Number(row.minimalScope) : 2,
        active: row.active !== false,
        description: typeof row.description === 'string' ? row.description : undefined,
      };
    })
    .filter((role) => role.id > 0);
}

const initialForm: UsuarioForm = {
  username: '',
  password: '',
  memberId: '',
  scope: 2,
};

const initialRoleForm: RoleForm = {
  name: '',
  minimalScope: 2,
  description: '',
  active: true,
};

export default function Usuarios() {
  const { fetchApi } = useICRApi();
  const [data, setData] = useState<Usuario[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Usuario | null>(null);
  const [form, setForm] = useState<UsuarioForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [rolesUser, setRolesUser] = useState<Usuario | null>(null);
  const [assignedRoleIds, setAssignedRoleIds] = useState<number[]>([]);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [showRolesManagerModal, setShowRolesManagerModal] = useState(false);
  const [showRoleFormModal, setShowRoleFormModal] = useState(false);
  const [editRoleItem, setEditRoleItem] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(initialRoleForm);
  const [savingRole, setSavingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);

  const activeRoles = useMemo(() => roles.filter((role) => role.active), [roles]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchApi<unknown>('/api/user-roles/users');
      setData(normalizeUsers(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLookups = async () => {
    try {
      const [membersResult, rolesResult] = await Promise.all([
        fetchApi<Member[]>('/api/members?page=1&pageSize=200'),
        fetchApi<unknown>('/api/user-roles/roles'),
      ]);
      setMembers(Array.isArray(membersResult) ? membersResult : []);
      setRoles(normalizeRoles(rolesResult));
    } catch {
      // User list can still be used even if lookups fail.
    }
  };

  useEffect(() => {
    loadUsers();
    loadLookups();
  }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm(initialForm);
    setShowModal(true);
  };

  const openEdit = (item: Usuario) => {
    setEditItem(item);
    setForm({
      username: item.username,
      password: '',
      memberId: item.memberId ?? '',
      scope: item.scope,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.username.trim()) {
      toast.error('Usuário é obrigatório');
      return;
    }

    if (!editItem && !form.password.trim()) {
      toast.error('Senha é obrigatória para novo usuário');
      return;
    }

    setSaving(true);
    try {
      if (editItem) {
        const body: Record<string, unknown> = {
          username: form.username,
          scope: form.scope,
          memberId: form.memberId ? Number(form.memberId) : null,
        };

        if (form.password.trim()) {
          body.passwordHash = form.password;
        }

        await fetchApi(`/api/user-roles/users/${editItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Usuário atualizado com sucesso');
      } else {
        await fetchApi('/api/user-roles/users', {
          method: 'POST',
          body: JSON.stringify({
            username: form.username,
            password: form.password,
            scope: form.scope,
            memberId: form.memberId ? Number(form.memberId) : null,
          }),
        });
        toast.success('Usuário criado com sucesso');
      }

      setShowModal(false);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Usuario) => {
    await fetchApi(`/api/user-roles/users/${item.id}`, { method: 'DELETE' });
    await loadUsers();
  };

  const openRolesModal = async (item: Usuario) => {
    setRolesUser(item);
    setShowRolesModal(true);
    try {
      const result = await fetchApi<unknown>(`/api/user-roles/users/${item.id}/roles`);
      const normalized = normalizeRoles(result);
      setAssignedRoleIds(normalized.map((role) => role.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar cargos do usuário');
      setAssignedRoleIds([]);
    }
  };

  const toggleRole = async (roleId: number, assigned: boolean) => {
    if (!rolesUser) return;

    setSavingRoleId(roleId);
    try {
      await fetchApi(`/api/user-roles/assign?userId=${rolesUser.id}&roleId=${roleId}`, {
        method: assigned ? 'DELETE' : 'POST',
      });

      setAssignedRoleIds((prev) => {
        if (assigned) return prev.filter((id) => id !== roleId);
        if (prev.includes(roleId)) return prev;
        return [...prev, roleId];
      });
      toast.success(assigned ? 'Cargo removido com sucesso' : 'Cargo atribuído com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar cargo');
    } finally {
      setSavingRoleId(null);
    }
  };

  const openAddRole = () => {
    setEditRoleItem(null);
    setRoleForm(initialRoleForm);
    setShowRoleFormModal(true);
  };

  const openEditRole = (role: Role) => {
    setEditRoleItem(role);
    setRoleForm({
      name: role.name,
      minimalScope: role.minimalScope,
      description: role.description ?? '',
      active: role.active,
    });
    setShowRoleFormModal(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error('Nome do cargo é obrigatório');
      return;
    }

    setSavingRole(true);
    try {
      const body = {
        name: roleForm.name,
        minimalScope: roleForm.minimalScope,
        description: roleForm.description.trim() || null,
        active: roleForm.active,
      };

      if (editRoleItem) {
        await fetchApi(`/api/user-roles/roles/${editRoleItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Cargo atualizado com sucesso');
      } else {
        await fetchApi('/api/user-roles/roles', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Cargo criado com sucesso');
      }

      setShowRoleFormModal(false);
      await loadLookups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar cargo');
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    setDeletingRoleId(role.id);
    try {
      await fetchApi(`/api/user-roles/roles/${role.id}`, { method: 'DELETE' });
      toast.success('Cargo removido com sucesso');
      await loadLookups();
      setAssignedRoleIds((prev) => prev.filter((id) => id !== role.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover cargo');
    } finally {
      setDeletingRoleId(null);
    }
  };

  const columns: Column<Usuario>[] = [
    { key: 'id', label: 'ID' },
    { key: 'username', label: 'Usuário' },
    {
      key: 'memberId',
      label: 'ID Membro',
      render: (item) => (item.memberId ? String(item.memberId) : '-'),
    },
    { key: 'memberName', label: 'Membro' },
    { key: 'scope', label: 'Escopo', render: (item) => scopeLabel(item.scope) },
    {
      key: 'roles',
      label: 'Cargos',
      render: (item) => (
        <button
          onClick={() => openRolesModal(item)}
          className="px-2.5 py-1 rounded-md bg-[#017158]/15 text-[#20d3aa] hover:bg-[#017158]/25 transition-colors text-xs font-['Nunito']"
        >
          Gerenciar
        </button>
      ),
    },
  ];

  return (
    <ICRLayout title="Usuários">
      <CRUDTable
        title="Usuários"
        data={data}
        columns={columns}
        isLoading={isLoading}
        error={error}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRefresh={loadUsers}
        addLabel="Novo Usuário"
        searchPlaceholder="Buscar usuário..."
        emptyMessage="Nenhum usuário encontrado"
      />

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => setShowRolesManagerModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2b2b2b] border border-white/20 rounded-lg text-white/80 hover:text-white hover:border-[#017158] transition-colors font-['Nunito'] text-sm"
        >
          <span className="material-icons text-[18px]">admin_panel_settings</span>
          Gerenciar Cargos
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editItem ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Usuário *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder="Nome de usuário"
                />
              </div>

              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">
                  {editItem ? 'Nova senha (opcional)' : 'Senha *'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder={editItem ? 'Informe para alterar' : 'Senha do usuário'}
                />
              </div>

              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Membro vinculado</label>
                <select
                  value={form.memberId}
                  onChange={(e) => setForm((prev) => ({ ...prev, memberId: e.target.value ? Number(e.target.value) : '' }))}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                >
                  <option value="">Sem vínculo</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Escopo *</label>
                <select
                  value={form.scope}
                  onChange={(e) => setForm((prev) => ({ ...prev, scope: Number(e.target.value) }))}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                >
                  <option value={0}>Local</option>
                  <option value={1}>Comissão Federada</option>
                  <option value={2}>Federação</option>
                </select>
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

      {showRolesModal && rolesUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                Cargos de {rolesUser.username}
              </h3>
              <button
                onClick={() => setShowRolesModal(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
              {activeRoles.length === 0 ? (
                <div className="text-white/50 text-sm font-['Nunito']">Nenhum cargo ativo encontrado.</div>
              ) : (
                activeRoles.map((role) => {
                  const assigned = assignedRoleIds.includes(role.id);
                  const loading = savingRoleId === role.id;
                  return (
                    <div
                      key={role.id}
                      className="flex items-center justify-between gap-3 bg-[#1f1f1f] border border-white/10 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-white font-['Nunito'] text-sm font-medium">{role.name}</div>
                        {role.description && (
                          <div className="text-white/50 font-['Nunito'] text-xs">{role.description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleRole(role.id, assigned)}
                        disabled={loading}
                        className={`px-3 py-1.5 rounded-md text-xs font-['Nunito'] transition-colors ${
                          assigned
                            ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
                            : 'bg-[#017158]/15 text-[#20d3aa] hover:bg-[#017158]/25'
                        } disabled:opacity-50`}
                      >
                        {loading ? 'Salvando...' : assigned ? 'Remover' : 'Atribuir'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowRolesModal(false)}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors font-['Nunito'] text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRolesManagerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">Gestão de Cargos</h3>
              <button
                onClick={() => setShowRolesManagerModal(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="flex justify-end mb-3">
              <button
                onClick={openAddRole}
                className="flex items-center gap-2 px-3 py-2 bg-[#017158] hover:bg-[#01a07e] text-white rounded-lg transition-colors font-['Nunito'] text-sm"
              >
                <span className="material-icons text-[18px]">add</span>
                Novo Cargo
              </button>
            </div>

            <div className="max-h-[52vh] overflow-y-auto space-y-2 pr-1">
              {roles.length === 0 ? (
                <div className="text-white/50 text-sm font-['Nunito']">Nenhum cargo cadastrado.</div>
              ) : (
                roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between gap-3 bg-[#1f1f1f] border border-white/10 rounded-lg px-3 py-2"
                  >
                    <div>
                      <div className="text-white font-['Nunito'] text-sm font-medium">{role.name}</div>
                      <div className="text-white/50 font-['Nunito'] text-xs">
                        Escopo mínimo: {scopeLabel(role.minimalScope)} | {role.active ? 'Ativo' : 'Inativo'}
                      </div>
                      {role.description && (
                        <div className="text-white/40 font-['Nunito'] text-xs mt-0.5">{role.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditRole(role)}
                        className="px-3 py-1.5 rounded-md bg-[#017158]/15 text-[#20d3aa] hover:bg-[#017158]/25 transition-colors text-xs font-['Nunito']"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role)}
                        disabled={deletingRoleId === role.id}
                        className="px-3 py-1.5 rounded-md bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors text-xs font-['Nunito'] disabled:opacity-50"
                      >
                        {deletingRoleId === role.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowRolesManagerModal(false)}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors font-['Nunito'] text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleFormModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">
                {editRoleItem ? 'Editar Cargo' : 'Novo Cargo'}
              </h3>
              <button onClick={() => setShowRoleFormModal(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nome *</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                  placeholder="Nome do cargo"
                />
              </div>

              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Escopo mínimo *</label>
                <select
                  value={roleForm.minimalScope}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, minimalScope: Number(e.target.value) }))}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
                >
                  <option value={0}>Global</option>
                  <option value={1}>Federação</option>
                  <option value={2}>Igreja</option>
                </select>
              </div>

              <div>
                <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Descrição</label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] resize-none"
                  placeholder="Descrição do cargo"
                />
              </div>

              <label className="flex items-center gap-2 text-white/70 text-sm font-['Nunito']">
                <input
                  type="checkbox"
                  checked={roleForm.active}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, active: e.target.checked }))}
                  className="accent-[#017158]"
                />
                Cargo ativo
              </label>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowRoleFormModal(false)}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors font-['Nunito'] text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRole}
                disabled={savingRole}
                className="px-4 py-2 rounded-lg bg-[#017158] hover:bg-[#01a07e] text-white transition-colors font-['Nunito'] text-sm font-medium disabled:opacity-50"
              >
                {savingRole ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ICRLayout>
  );
}
