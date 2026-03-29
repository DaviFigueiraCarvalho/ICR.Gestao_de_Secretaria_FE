import { useEffect, useMemo, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';

type HomeRoute = '/' | '/members' | '/families' | '/cells';
type DatesDefaultMonth = 'current' | 'next';

interface LocalSettings {
  confirmDelete: boolean;
  compactTables: boolean;
  reducedMotion: boolean;
  openSidebarByDefault: boolean;
  homeRoute: HomeRoute;
  datesDefaultMonth: DatesDefaultMonth;
}

const SETTINGS_KEY = 'icr_local_settings_v1';

const DEFAULT_SETTINGS: LocalSettings = {
  confirmDelete: true,
  compactTables: false,
  reducedMotion: false,
  openSidebarByDefault: true,
  homeRoute: '/',
  datesDefaultMonth: 'current',
};

function parseSettings(raw: string | null): LocalSettings {
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      confirmDelete: typeof parsed.confirmDelete === 'boolean' ? parsed.confirmDelete : DEFAULT_SETTINGS.confirmDelete,
      compactTables: typeof parsed.compactTables === 'boolean' ? parsed.compactTables : DEFAULT_SETTINGS.compactTables,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
      openSidebarByDefault: typeof parsed.openSidebarByDefault === 'boolean' ? parsed.openSidebarByDefault : DEFAULT_SETTINGS.openSidebarByDefault,
      homeRoute: parsed.homeRoute === '/members' || parsed.homeRoute === '/families' || parsed.homeRoute === '/cells' || parsed.homeRoute === '/'
        ? parsed.homeRoute
        : DEFAULT_SETTINGS.homeRoute,
      datesDefaultMonth: parsed.datesDefaultMonth === 'next' || parsed.datesDefaultMonth === 'current'
        ? parsed.datesDefaultMonth
        : DEFAULT_SETTINGS.datesDefaultMonth,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function Settings() {
  const { mode, setThemeMode } = useTheme();
  const [settings, setSettings] = useState<LocalSettings>(() => parseSettings(localStorage.getItem(SETTINGS_KEY)));

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const preferredRouteLabel = useMemo(() => {
    if (settings.homeRoute === '/members') return 'Membros';
    if (settings.homeRoute === '/families') return 'Famílias';
    if (settings.homeRoute === '/cells') return 'Células';
    return 'Dashboard';
  }, [settings.homeRoute]);

  const setSetting = <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const restoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('sidebarOpen', JSON.stringify(true));
    toast.success('Configurações locais restauradas para o padrão');
  };

  const clearOnlyLocalSettings = () => {
    localStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
    toast.success('Configurações locais removidas desta máquina');
  };

  return (
    <ICRLayout title="Configurações">
      <div className="space-y-6">
        

        <div className="bg-[#2b2b2b] rounded-xl border border-white/10 p-5 space-y-5">
          <h3 className="text-white text-base font-['Nunito'] font-semibold">Comportamento</h3>

          <div>
            <label className="text-white/70 text-sm font-['Nunito'] block mb-2">Tema da aplicação</label>
            <select
              value={mode}
              onChange={(e) => setThemeMode?.(e.target.value as 'system' | 'light' | 'dark')}
              className="w-full md:w-[320px] bg-[#1c1c1c] border border-white/20 rounded-lg px-3 py-2 text-white font-['Nunito'] focus:outline-none focus:border-[#017158]"
            >
              <option value="system">Padrão do sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
            <p className="text-white/50 text-xs mt-2 font-['Nunito']">
              Esta opção é salva apenas nesta máquina.
            </p>
          </div>

          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-['Nunito']">Confirmar exclusões</p>
              <p className="text-white/50 text-sm font-['Nunito']">Exibe confirmação extra antes de excluir dados.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.confirmDelete}
              onChange={(e) => setSetting('confirmDelete', e.target.checked)}
              className="h-5 w-5 accent-[#017158]"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-['Nunito']">Tabelas compactas</p>
              <p className="text-white/50 text-sm font-['Nunito']">Mostra linhas mais compactas quando suportado.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.compactTables}
              onChange={(e) => setSetting('compactTables', e.target.checked)}
              className="h-5 w-5 accent-[#017158]"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-['Nunito']">Reduzir animações</p>
              <p className="text-white/50 text-sm font-['Nunito']">Diminui transições para reduzir distrações.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => setSetting('reducedMotion', e.target.checked)}
              className="h-5 w-5 accent-[#017158]"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-['Nunito']">Abrir menu lateral expandido</p>
              <p className="text-white/50 text-sm font-['Nunito']">Define o estado padrão do menu lateral nesta máquina.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.openSidebarByDefault}
              onChange={(e) => {
                const checked = e.target.checked;
                setSetting('openSidebarByDefault', checked);
                localStorage.setItem('sidebarOpen', JSON.stringify(checked));
              }}
              className="h-5 w-5 accent-[#017158]"
            />
          </label>
        </div>

        <div className="bg-[#2b2b2b] rounded-xl border border-white/10 p-5 space-y-4">
          <h3 className="text-white text-base font-['Nunito'] font-semibold">Preferências de Navegação</h3>

          <div>
            <label className="text-white/70 text-sm font-['Nunito'] block mb-2">Tela inicial preferida</label>
            <select
              value={settings.homeRoute}
              onChange={(e) => setSetting('homeRoute', e.target.value as HomeRoute)}
              className="w-full md:w-[320px] bg-[#1c1c1c] border border-white/20 rounded-lg px-3 py-2 text-white font-['Nunito'] focus:outline-none focus:border-[#017158]"
            >
              <option value="/">Dashboard</option>
              <option value="/members">Membros</option>
              <option value="/families">Famílias</option>
              <option value="/cells">Células</option>
            </select>
            <p className="text-white/50 text-xs mt-2 font-['Nunito']">Atual: {preferredRouteLabel}</p>
          </div>

          <div>
            <label className="text-white/70 text-sm font-['Nunito'] block mb-2">Mês padrão em Datas de Membros</label>
            <select
              value={settings.datesDefaultMonth}
              onChange={(e) => setSetting('datesDefaultMonth', e.target.value as DatesDefaultMonth)}
              className="w-full md:w-[320px] bg-[#1c1c1c] border border-white/20 rounded-lg px-3 py-2 text-white font-['Nunito'] focus:outline-none focus:border-[#017158]"
            >
              <option value="current">Mês atual</option>
              <option value="next">Próximo mês</option>
            </select>
          </div>
        </div>

        <div className="bg-[#2b2b2b] rounded-xl border border-white/10 p-5">
          <h3 className="text-white text-base font-['Nunito'] font-semibold mb-3">Gerenciar Preferências Locais</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={restoreDefaults}
              className="px-4 py-2 rounded-lg bg-[#017158] text-white font-['Nunito'] hover:bg-[#015a47] transition-colors"
            >
              Restaurar Padrões
            </button>
            <button
              onClick={clearOnlyLocalSettings}
              className="px-4 py-2 rounded-lg border border-white/20 text-white/80 font-['Nunito'] hover:bg-white/5 transition-colors"
            >
              Limpar Apenas Configurações Locais
            </button>
          </div>
        </div>
      </div>
    </ICRLayout>
  );
}
