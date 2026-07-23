import { useCallback, useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import AddressFormFields, { type AddressFormValue } from '../components/AddressFormFields';
import { useICRApi } from '../hooks/useICRApi';
import { DEFAULT_COUNTRY_CODE } from '../lib/country';
import { toast } from 'sonner';

interface PendingMinisterRegistration {
  memberId: number;
  memberName: string;
  churchName: string;
  memberRole: number;
  memberRoleName: string;
  phone?: {
    number?: string;
    e164Format?: string;
  };
}

const RECEITA_CPF_URL = 'https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/ConsultaPublica.asp';

export default function MinisterRegistrationPendencies() {
  const { fetchApi } = useICRApi();
  const [items, setItems] = useState<PendingMinisterRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ministerMemberId, setMinisterMemberId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<PendingMinisterRegistration[]>('/api/ministers/pending-registrations');
      setItems(Array.isArray(result) ? result : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar pendências ministeriais');
    } finally {
      setLoading(false);
    }
  }, [fetchApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleContact = (item: PendingMinisterRegistration) => {
    const phone = (item.phone?.e164Format || item.phone?.number || '').replace(/\D/g, '');
    if (!phone) {
      toast.error('Este membro não possui telefone cadastrado');
      return;
    }

    const message = `Olá, ${item.memberName}. A Federação ICR Avivalista do Brasil entra em contato para solicitar os dados necessários para concluir seu cadastro ministerial como ${item.memberRoleName}.\n\nPor favor, copie esta mensagem, preencha os dados abaixo e envie pelo seu próprio WhatsApp:\n\nCPF:\nE-mail:\nData de validade da carteirinha ministerial:\nData de ordenação a presbítero:\nData de ordenação a pastor (se houver):\nEndereço completo:\n\nAssim que recebermos as informações, concluiremos seu cadastro.`;
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCreateMinister = (memberId: number) => {
    window.open(RECEITA_CPF_URL, '_blank', 'noopener,noreferrer');
    setMinisterMemberId(memberId);
  };

  return (
    <ICRLayout title="Pendências Ministeriais">
      <div className="space-y-5">
        <div className="rounded-xl bg-[#2b2b2b] p-5 border border-white/10">
          <h2 className="text-white font-['Nunito'] text-xl font-semibold">Cadastros ministeriais pendentes</h2>
          <p className="mt-2 text-white/60 font-['Nunito'] text-sm">
            Entre em contato, peça os dados abaixo e peça à pessoa para copiar, preencher e enviar a mensagem pelo próprio WhatsApp.
            Antes de criar o cadastro, confira o CPF na consulta pública da Receita Federal.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl bg-[#2b2b2b] p-8 text-center text-white/60">Carregando pendências...</div>
        ) : error ? (
          <div className="rounded-xl bg-[#2b2b2b] p-8 text-center text-red-300">{error}</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-[#2b2b2b] p-8 text-center text-white/60">Não há cadastros ministeriais pendentes.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm font-['Nunito']">
              <thead className="bg-[#2b2b2b] text-white/60 text-left">
                <tr>
                  <th className="px-4 py-3">ID do membro</th>
                  <th className="px-4 py-3">Nome completo</th>
                  <th className="px-4 py-3">Igreja</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#1c1c1c] text-white">
                {items.map((item) => (
                  <tr key={item.memberId}>
                    <td className="px-4 py-3">{item.memberId}</td>
                    <td className="px-4 py-3">{item.memberName}</td>
                    <td className="px-4 py-3">{item.churchName || '-'}</td>
                    <td className="px-4 py-3">{item.memberRoleName}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleContact(item)} className="rounded-lg border border-[#017158] px-3 py-2 text-[#4fd6b5] hover:bg-[#017158]/20">
                          Entrar em contato
                        </button>
                        <button onClick={() => handleCreateMinister(item.memberId)} className="rounded-lg bg-[#017158] px-3 py-2 text-white hover:bg-[#01a07e]">
                          Criar ministro
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ministerMemberId && (
        <QuickMinisterModal
          memberId={ministerMemberId}
          memberName={items.find((item) => item.memberId === ministerMemberId)?.memberName || ''}
          onClose={() => setMinisterMemberId(null)}
          onCreated={() => { setMinisterMemberId(null); void load(); }}
        />
      )}
    </ICRLayout>
  );
}

function QuickMinisterModal({ memberId, memberName, onClose, onCreated }: { memberId: number; memberName: string; onClose: () => void; onCreated: () => void }) {
  const { fetchApi } = useICRApi();
  const [form, setForm] = useState({ countryCode: DEFAULT_COUNTRY_CODE, cpf: '', email: '', cardValidity: '', presbiterOrdinationDate: '', ministerOrdinationDate: '', postalCode: '', street: '', number: '', complement: '', city: '', state: '', countyOrRegion: '' });
  const [saving, setSaving] = useState(false);
  const setField = (field: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [field]: value }));
  const updateAddress = (address: AddressFormValue) => setForm((previous) => ({ ...previous, ...address, countryCode: address.countryCode || DEFAULT_COUNTRY_CODE }));

  const save = async () => {
    const cpf = form.cpf.replace(/\D/g, '');
    const addressStarted = Boolean(form.postalCode || form.street || form.number || form.city || form.state);
    if (cpf.length !== 11 || !form.email || !form.cardValidity || !form.presbiterOrdinationDate) {
      toast.error('Preencha CPF, e-mail, validade da carteira e ordenação a presbítero.');
      return;
    }
    if (addressStarted && (!form.postalCode || !form.street || !form.number || !form.city || !form.state)) {
      toast.error('Preencha CEP, número, rua, cidade e estado ou deixe o endereço vazio.');
      return;
    }
    setSaving(true);
    try {
      await fetchApi('/api/ministers', {
        method: 'POST',
        body: JSON.stringify({
          memberId, cpf, email: form.email, cardValidity: form.cardValidity,
          presbiterOrdinationDate: form.presbiterOrdinationDate,
          ministerOrdinationDate: form.ministerOrdinationDate || null,
          ...(addressStarted ? { address: { countryCode: form.countryCode, postalCode: form.postalCode, street: form.street, number: form.number, complement: form.complement || null, city: form.city, state: form.state, countyOrRegion: form.countyOrRegion || null } } : {}),
        }),
      });
      toast.success('Ministro criado com sucesso.');
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar ministro.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[#2b2b2b] p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between"><div><h3 className="font-['Nunito'] text-lg font-semibold text-white">Novo Ministro</h3><p className="text-sm text-white/55">{memberName} · membro #{memberId}</p></div><button onClick={onClose} className="text-white/50 hover:text-white"><span className="material-icons">close</span></button></div>
      <div className="grid grid-cols-2 gap-3">
        {([['CPF', 'cpf', '000.000.000-00'], ['E-mail', 'email', 'email@exemplo.com'], ['Validade Carteira', 'cardValidity', ''], ['Ordenação Presbítero', 'presbiterOrdinationDate', ''], ['Ordenação a Pastor', 'ministerOrdinationDate', '']] as const).map(([label, field, placeholder]) => <label key={field} className={`font-['Nunito'] text-sm text-white/70 ${field === 'email' ? 'col-span-2' : ''}`}>{label}<input type={field === 'cardValidity' || field === 'presbiterOrdinationDate' || field === 'ministerOrdinationDate' ? 'date' : field === 'email' ? 'email' : 'text'} value={form[field]} onChange={(event) => setField(field, event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-white/20 bg-[#1c1c1c] px-4 py-2.5 text-white focus:border-[#017158] focus:outline-none" /></label>)}
      </div>
      <div className="mt-4 border-t border-white/10 pt-4"><AddressFormFields value={form} onChange={updateAddress} /></div>
      <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg border border-white/20 px-4 py-2 text-white/70">Cancelar</button><button onClick={save} disabled={saving} className="rounded-lg bg-[#017158] px-4 py-2 text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button></div>
    </div>
  </div>;
}
