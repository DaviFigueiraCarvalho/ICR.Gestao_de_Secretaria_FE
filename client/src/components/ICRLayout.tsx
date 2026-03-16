import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useICRAuth } from '../contexts/ICRAuthContext';
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
      { icon: 'corporate_fare', label: 'Comissões Federadas', path: '/federacoes' },
      { icon: 'church', label: 'Igrejas', path: '/igrejas' },
    ],
  },
  {
    label: 'Operacional',
    items: [
      { icon: 'hub', label: 'Células', path: '/celulas' },
      { icon: 'family_restroom', label: 'Famílias', path: '/familias' },
      { icon: 'group', label: 'Membros', path: '/membros' },
    ],
  },
  {
    label: 'Ministérios',
    items: [
      { icon: 'person', label: 'Pastores e Presbíteros', path: '/ministros' },
      { icon: 'cake', label: 'Datas Pastores', path: '/datas-pastores' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { icon: 'paid', label: 'Repasses', path: '/repasses' },
    ],
  },
];

interface ICRLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function ICRLayout({ children, title }: ICRLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useICRAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    toast.success('Sessão encerrada com sucesso');
  };

  const handleComingSoon = (label: string) => {
    toast.info(`${label} - Em breve`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#1c1c1c]">
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col overflow-y-auto"
        style={{
          width: sidebarOpen ? '260px' : '64px',
          backgroundColor: '#171717',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center py-4 px-3 border-b border-white/10">
          <img
            src={ICR_LOGO}
            alt="ICR Logo"
            className="w-20 h-20 object-contain"
          />
          {sidebarOpen && (
            <div className="text-center mt-1">
              <div className="text-[#017158] font-bold text-lg tracking-widest font-['Nunito']">ICR</div>
              <div className="text-white/50 text-[10px] font-['Nunito'] leading-tight text-center">
                FEDERAÇÃO<br />IGREJA CRISTÃ REFORMADA AVIVALISTA DO BRASIL
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {/* Main nav groups */}
          <div className="border-t border-white/20 pt-3">
            {navGroups.map((group) => (
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
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Bottom options */}
          <div className="border-t border-b border-white/20 py-3 mt-2">
            <button
              onClick={() => handleComingSoon('Configurações')}
              className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors text-[#017158] hover:bg-[#017158]/20 w-full mb-0.5"
            >
              <span className="material-icons text-[22px] flex-shrink-0">settings</span>
              {sidebarOpen && <span className="text-sm font-['Nunito'] font-medium">Configurações</span>}
            </button>
            <button
              onClick={() => handleComingSoon('Perfil')}
              className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors text-[#017158] hover:bg-[#017158]/20 w-full"
            >
              <span className="material-icons text-[22px] flex-shrink-0">badge</span>
              {sidebarOpen && (
                <span className="text-sm font-['Nunito'] font-medium">
                  {user?.memberName || user?.username || 'Perfil'}
                </span>
              )}
            </button>
          </div>

          {/* Logout */}
          <div className="mt-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors text-[#017158] hover:bg-red-900/20 hover:text-red-400 w-full"
            >
              <span className="material-icons text-[22px] flex-shrink-0">power_settings_new</span>
              {sidebarOpen && <span className="text-sm font-['Nunito'] font-medium">Sair</span>}
            </button>
          </div>
        </nav>

        {/* Toggle sidebar button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center py-3 border-t border-white/10 text-white/40 hover:text-white/80 transition-colors"
        >
          <span className="material-icons text-[18px]">
            {sidebarOpen ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {title && (
          <div className="px-8 py-4 border-b border-white/10">
            <h1 className="text-white text-2xl font-['Nunito'] font-semibold">{title}</h1>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
