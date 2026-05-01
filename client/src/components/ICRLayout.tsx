import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useICRAuth } from '../contexts/ICRAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { canAccessPathByScope, getScopeLevel } from '../lib/scope-access';
import { toast } from 'sonner';
import icrLogo from '../assets/icr-logo.svg';

const ICR_LOGO = icrLogo;

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface TooltipState {
  x: number;
  y: number;
  label: string | null;
}

const navGroups: NavGroup[] = [
  {
    label: 'Top',
    items: [
      { icon: 'home', label: 'Início', path: '/' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { icon: 'corporate_fare', label: 'Áreas', path: '/federations' },
      { icon: 'church', label: 'Igrejas', path: '/churches' },
      { icon: 'paid', label: 'Repasses', path: '/repasses' },
      { icon: 'people', label: 'Usuários', path: '/users' },
    ],
  },
  {
    label: 'Operacional',
    items: [
      { icon: 'hub', label: 'Células', path: '/cells' },
      { icon: 'family_restroom', label: 'Famílias', path: '/families' },
      { icon: 'group', label: 'Membros', path: '/members' },
      { icon: 'cake', label: 'Datas Membros', path: '/members-dates' },
    ],
  },
  {
    label: 'Ministérios',
    items: [
      { icon: 'person', label: 'Pastores e Presbiteros', path: '/ministers' },
      { icon: 'health_and_safety', label: 'Seguro de Ministros', path: '/ministers-insurance' },
      { icon: 'cake', label: 'Datas de  Pastores e Presbiteros', path: '/ministers-dates' },
    ],
  },
  
];

function SidebarTooltip({ state }: { state: TooltipState }) {
  if (!state.label) return null;

  return (
    <div
      className="fixed z-[10000] bg-[#017158] text-white px-3 py-1.5 rounded-md text-xs font-['Nunito'] pointer-events-none shadow-lg"
      style={{
        left: state.x + 12,
        top: state.y + 12,
        whiteSpace: 'nowrap',
      }}
    >
      {state.label}
    </div>
  );
}

interface ICRLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function ICRLayout({ children, title }: ICRLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useICRAuth();
  const { theme } = useTheme();
  const scopeLevel = getScopeLevel(user?.scope, user?.username);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tooltipState, setTooltipState] = useState<TooltipState>({ x: 0, y: 0, label: null });

  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.matchMedia('(max-width: 1023px)').matches;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Sessão encerrada com sucesso');
  };

  const handleComingSoon = (label: string) => {
    toast.info(`${label} - Em breve`);
  };

  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessPathByScope(scopeLevel, item.path)),
    }))
    .filter((group) => group.items.length > 0);

  const isDark = theme === 'dark';
  const shellBgColor = isDark ? '#1c1c1c' : 'oklch(0.985 0.01 168)';
  const sidebarBgColor = isDark ? '#171717' : 'oklch(0.975 0.012 168)';
  const sidebarBorder = isDark
    ? '1px solid rgba(255,255,255,0.1)'
    : '1px solid oklch(0.84 0.03 168 / 0.7)';

  return (
    <div className="flex h-screen overflow-visible relative" style={{ backgroundColor: shellBgColor }}>
      {/* Mobile floating menu button */}
      {isMobile && !mobileSidebarOpen && (
        <button
          onClick={() => {
            setMobileSidebarOpen(true);
            setSidebarOpen(true);
          }}
          className={`fixed top-3 left-3 z-40 p-2 rounded-md border text-[#017158] lg:hidden ${
            isDark
              ? 'bg-[#171717]/95 border-white/10 hover:bg-[#171717]'
              : 'bg-white/95 border-[#017158]/20 hover:bg-[#f1fbf8]'
          }`}
          aria-label="Abrir menu"
        >
          <span className="material-icons">menu</span>
        </button>
      )}

      {/* Mobile overlay to close sidebar */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {(!isMobile || mobileSidebarOpen) && (
        <aside
          className={`flex-shrink-0 flex flex-col overflow-visible relative ${isMobile ? 'fixed inset-0 z-50' : ''}`}
          style={{
            width: isMobile ? '100vw' : sidebarOpen ? '260px' : '64px',
            backgroundColor: sidebarBgColor,
            borderRight: sidebarBorder,
            transition: 'width 0.2s ease, transform 0.2s ease',
            transform: 'translateX(0)',
          }}
        >
        {isMobile && (
          <div className="flex justify-end p-2 border-b border-white/10">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-2 rounded-md text-[#017158] hover:bg-[#017158]/20"
              aria-label="Fechar menu"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        )}

        <div className="flex flex-col items-center py-4 px-3 border-b border-white/10">
          <img src={ICR_LOGO} alt="ICR Logo" className="w-20 h-20 object-contain" />
          {sidebarOpen && (
            <div className="text-center mt-1">
              <div className="text-[#017158] font-bold text-lg tracking-widest font-['Nunito']">ICR</div>
              <div className="text-white/50 text-[10px] font-['Nunito'] leading-tight text-center">
                FEDERAÇÃO<br />IGREJA CRISTÃ REFORMADA AVIVALISTA DO BRASIL
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <div className="border-t border-white/20 pt-3">
            {visibleNavGroups.map((group, groupIndex) => (
              <div key={group.label} className="mb-3">
                {sidebarOpen && (
                  <div className="text-white/50 text-xs font-['Nunito'] px-2 py-1 uppercase tracking-wider">
                    {group.label}
                  </div>
                )}

                {group.items.map((item) => {
                  const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path));
                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        className="relative"
                        onMouseEnter={(e) => {
                          if (!sidebarOpen) setTooltipState({ x: e.clientX, y: e.clientY, label: item.label });
                        }}
                        onMouseMove={(e) => {
                          if (!sidebarOpen && tooltipState.label === item.label) {
                            setTooltipState({ x: e.clientX, y: e.clientY, label: item.label });
                          }
                        }}
                        onMouseLeave={() => setTooltipState({ ...tooltipState, label: null })}
                      >
                        <div
                          className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors mb-0.5 ${
                            isActive
                              ? 'bg-[#017158]/30 text-[#017158]'
                              : 'text-[#017158] hover:bg-[#017158]/20'
                          }`}
                        >
                          <span className="material-icons text-[22px] flex-shrink-0">{item.icon}</span>
                          {sidebarOpen && (
                            <span className="text-sm font-['Nunito'] font-medium truncate">{item.label}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {!sidebarOpen && groupIndex < visibleNavGroups.length - 1 && <div className="h-px bg-white/20 my-2" />}
              </div>
            ))}
          </div>

          <div className="border-t border-b border-white/20 py-3 mt-2">
            <button
              onClick={() => setLocation('/settings')}
              className="relative flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors text-[#017158] hover:bg-[#017158]/20 w-full mb-0.5"
              onMouseEnter={(e) => {
                if (!sidebarOpen) setTooltipState({ x: e.clientX, y: e.clientY, label: 'Configurações' });
              }}
              onMouseMove={(e) => {
                if (!sidebarOpen && tooltipState.label === 'Configurações') {
                  setTooltipState({ x: e.clientX, y: e.clientY, label: 'Configurações' });
                }
              }}
              onMouseLeave={() => setTooltipState({ ...tooltipState, label: null })}
            >
              <span className="material-icons text-[22px] flex-shrink-0">settings</span>
              {sidebarOpen && <span className="text-sm font-['Nunito'] font-medium">Configurações</span>}
            </button>
            <button
              onClick={() => setLocation('/profile')}
              className="relative flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors text-[#017158] hover:bg-[#017158]/20 w-full"
              onMouseEnter={(e) => {
                if (!sidebarOpen) setTooltipState({ x: e.clientX, y: e.clientY, label: user?.memberName || user?.username || 'Perfil' });
              }}
              onMouseMove={(e) => {
                if (!sidebarOpen && tooltipState.label === (user?.memberName || user?.username || 'Perfil')) {
                  setTooltipState({ x: e.clientX, y: e.clientY, label: user?.memberName || user?.username || 'Perfil' });
                }
              }}
              onMouseLeave={() => setTooltipState({ ...tooltipState, label: null })}
            >
              <span className="material-icons text-[22px] flex-shrink-0">badge</span>
              {sidebarOpen && (
                <span className="text-sm font-['Nunito'] font-medium">
                  {user?.memberName || user?.username || 'Perfil'}
                </span>
              )}
            </button>
          </div>

          <div className="mt-3">
            <button
              onClick={handleLogout}
              className="relative flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors text-[#017158] hover:bg-red-900/20 hover:text-red-400 w-full"
              onMouseEnter={(e) => {
                if (!sidebarOpen) setTooltipState({ x: e.clientX, y: e.clientY, label: 'Sair' });
              }}
              onMouseMove={(e) => {
                if (!sidebarOpen && tooltipState.label === 'Sair') {
                  setTooltipState({ x: e.clientX, y: e.clientY, label: 'Sair' });
                }
              }}
              onMouseLeave={() => setTooltipState({ ...tooltipState, label: null })}
            >
              <span className="material-icons text-[22px] flex-shrink-0">power_settings_new</span>
              {sidebarOpen && <span className="text-sm font-['Nunito'] font-medium">Sair</span>}
            </button>
          </div>
        </nav>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex items-center justify-center py-3 border-t border-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <span className="material-icons text-[18px]">{sidebarOpen ? 'chevron_left' : 'chevron_right'}</span>
          </button>
        </aside>
      )}

      <SidebarTooltip state={tooltipState} />

      <main className="min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto">
        {title && (
          <div className="px-4 lg:px-8 py-4 border-b border-white/10 text-center lg:text-left">
            <h1 className="text-white text-2xl font-['Nunito'] font-semibold">{title}</h1>
          </div>
        )}
        <div className="p-2 sm:p-4 lg:p-6 w-full">{children}</div>
      </main>
    </div>
  );
}
