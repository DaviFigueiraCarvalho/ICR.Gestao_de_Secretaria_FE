import { useEffect, useState } from 'react';
import ICRLayout from '../components/ICRLayout';
import { useICRApi } from '../hooks/useICRApi';

interface MinisterBirthday {
  name: string;
  type: string;
  memberWifeName: string;
  birthday: string;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function DatasPastores() {
  const { fetchApi } = useICRApi();
  const [data, setData] = useState<MinisterBirthday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const load = async (month: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchApi<MinisterBirthday[]>(`/api/ministers/birthdays?month=${month}`);
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar datas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(selectedMonth); }, [selectedMonth]);

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'BIRTHDAY': 'Aniversário',
      'WEDDING': 'Casamento',
      'ORDINATION': 'Ordenação',
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'BIRTHDAY': 'bg-blue-500/20 text-blue-400',
      'WEDDING': 'bg-pink-500/20 text-pink-400',
      'ORDINATION': 'bg-[#017158]/20 text-[#017158]',
    };
    return colors[type] || 'bg-white/10 text-white/60';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'BIRTHDAY': 'cake',
      'WEDDING': 'favorite',
      'ORDINATION': 'military_tech',
    };
    return icons[type] || 'event';
  };

  return (
    <ICRLayout title="Datas Pastores">
      {/* Month selector */}
      <div className="flex gap-2 flex-wrap mb-6">
        {MONTHS.map((month, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedMonth(idx + 1)}
            className={`px-3 py-1.5 rounded-lg text-sm font-['Nunito'] font-medium transition-colors ${
              selectedMonth === idx + 1
                ? 'bg-[#017158] text-white'
                : 'bg-[#2b2b2b] text-white/60 hover:text-white hover:bg-[#2b2b2b]/80'
            }`}
          >
            {month}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <span className="material-icons animate-spin text-[#017158] text-3xl">refresh</span>
            <p className="text-white/50 font-['Nunito'] text-sm">Carregando...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="material-icons text-red-400 text-3xl">error_outline</span>
            <p className="text-white/60 font-['Nunito'] text-sm">{error}</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-[#2b2b2b] rounded-xl p-12 flex flex-col items-center gap-3">
          <span className="material-icons text-white/20 text-5xl">event_busy</span>
          <p className="text-white/40 font-['Nunito']">
            Nenhuma data especial em {MONTHS[selectedMonth - 1]}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((item, idx) => (
            <div key={idx} className="bg-[#2b2b2b] rounded-xl p-4 flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getTypeColor(item.type)}`}>
                <span className="material-icons text-[20px]">{getTypeIcon(item.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-['Nunito'] font-medium truncate">{item.name}</div>
                {item.memberWifeName && (
                  <div className="text-white/50 text-sm font-['Nunito'] truncate">
                    Cônjuge: {item.memberWifeName}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(item.type)}`}>
                    {getTypeLabel(item.type)}
                  </span>
                  <span className="text-white/40 text-xs font-['Nunito']">
                    {item.birthday ? new Date(item.birthday).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ICRLayout>
  );
}
