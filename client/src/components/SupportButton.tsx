import { useTheme } from '../contexts/ThemeContext';

export default function SupportButton() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const handleSupportClick = () => {
    const message = encodeURIComponent(
      'Olá! Preciso de suporte no Sistema de Gestão da ICR.'
    );

    window.open(
      `https://wa.me/5521964297572?text=${message}`,
      '_blank'
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleSupportClick}
        className={`
          ${isLight
            ? 'bg-white border-[#99cfc0] text-[#2e6f5f] hover:text-[#0f5f4d]'
            : 'bg-[#2b2b2b] border-[#017158]/40 text-white/70 hover:text-white'
          }
          border rounded-xl p-3 flex items-center gap-2
          hover:border-[#017158]
          transition-colors shadow-lg
        `}
      >
        <span className="material-icons text-[#25D366]">
          support_agent
        </span>

        <span className="text-sm font-['Nunito']">
          Entre em contato
          <br />
          para suporte
        </span>
      </button>
    </div>
  );
}