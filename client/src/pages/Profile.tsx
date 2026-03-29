import { FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ICRLayout from '../components/ICRLayout';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { useICRApi } from '../hooks/useICRApi';
import { API_BASE } from '../lib/api-config';

interface UserDirectoryRow {
  id?: number;
  memberId?: number | null;
  scope?: number | string;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseDirectoryRow(payload: unknown): UserDirectoryRow {
  if (!payload || typeof payload !== 'object') return {};
  const row = payload as Record<string, unknown>;
  return {
    id: toNumber(row.id),
    memberId: toNumber(row.memberId) ?? null,
    scope: row.scope as number | string | undefined,
  };
}

export default function Profile() {
  const { user } = useICRAuth();
  const { fetchApi } = useICRApi();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      currentPassword.trim().length > 0 &&
      newPassword.trim().length >= 6 &&
      confirmNewPassword.trim().length >= 6
    );
  }, [confirmNewPassword, currentPassword, newPassword]);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const validateCurrentPassword = async (username: string, password: string): Promise<boolean> => {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    return response.ok;
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.username) {
      toast.error('Usuário autenticado não encontrado');
      return;
    }

    if (newPassword.trim().length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('A confirmação da nova senha não confere');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('A nova senha deve ser diferente da senha atual');
      return;
    }

    setIsSavingPassword(true);
    try {
      const currentPasswordValid = await validateCurrentPassword(user.username, currentPassword);
      if (!currentPasswordValid) {
        toast.error('Senha atual inválida');
        return;
      }

      let targetUserId = toNumber(user.id);
      let targetMemberId = toNumber(user.memberId) ?? null;
      let targetScope: number | string | undefined = user.scope;

      if (typeof targetUserId !== 'number' || targetUserId <= 0) {
        const byUsername = await fetchApi<unknown>(`/api/user-roles/users/by-username/${encodeURIComponent(user.username)}`);
        const parsed = parseDirectoryRow(byUsername);
        targetUserId = parsed.id;
        targetMemberId = parsed.memberId ?? targetMemberId;
        targetScope = parsed.scope ?? targetScope;
      }

      if (typeof targetUserId !== 'number' || targetUserId <= 0) {
        throw new Error('Não foi possível identificar o usuário para atualizar a senha.');
      }

      await fetchApi(`/api/user-roles/users/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          username: user.username,
          memberId: targetMemberId,
          scope: targetScope,
          passwordHash: newPassword,
        }),
      });

      resetForm();
      toast.success('Senha atualizada com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar senha');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <ICRLayout title="Perfil">
      <div className="space-y-6">
        <div className="bg-[#2b2b2b] rounded-xl border border-white/10 p-5">
          <h3 className="text-white text-base font-['Nunito'] font-semibold mb-4">Dados da Conta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Usuário</label>
              <input
                value={user?.username ?? '-'}
                disabled
                className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-3 py-2 text-white/90 font-['Nunito']"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nome vinculado</label>
              <input
                value={user?.memberName ?? '-'}
                disabled
                className="w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-3 py-2 text-white/90 font-['Nunito']"
              />
            </div>
          </div>
          <p className="text-white/50 text-xs mt-3 font-['Nunito']">
            Para alterar nome de membro ou vínculos administrativos, use as telas de gestão.
          </p>
        </div>

        <div className="bg-[#2b2b2b] rounded-xl border border-white/10 p-5">
          <h3 className="text-white text-base font-['Nunito'] font-semibold mb-4">Segurança</h3>
          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div>
              <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Senha atual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full md:w-[420px] bg-[#1c1c1c] border border-white/20 rounded-lg px-3 py-2 text-white font-['Nunito'] focus:outline-none focus:border-[#017158]"
                required
              />
            </div>

            <div>
              <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Nova senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full md:w-[420px] bg-[#1c1c1c] border border-white/20 rounded-lg px-3 py-2 text-white font-['Nunito'] focus:outline-none focus:border-[#017158]"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="text-white/70 text-sm font-['Nunito'] block mb-1">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full md:w-[420px] bg-[#1c1c1c] border border-white/20 rounded-lg px-3 py-2 text-white font-['Nunito'] focus:outline-none focus:border-[#017158]"
                required
                minLength={6}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!canSubmit || isSavingPassword}
                className="px-4 py-2 rounded-lg bg-[#017158] hover:bg-[#015a47] text-white transition-colors font-['Nunito'] text-sm font-medium disabled:opacity-50"
              >
                {isSavingPassword ? 'Salvando...' : 'Atualizar Senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ICRLayout>
  );
}
