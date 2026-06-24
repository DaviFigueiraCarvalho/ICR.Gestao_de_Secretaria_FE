import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Minister, useICRApi } from './useICRApi';

interface MinisterDataContextType {
  data: Minister[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  invalidate: () => void;
}

const MinisterDataContext = createContext<MinisterDataContextType | null>(null);

export function MinisterDataProvider({ children }: { children: ReactNode }) {
  const { fetchApi } = useICRApi();
  const [data, setData] = useState<Minister[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldReload, setShouldReload] = useState(true);

  const invalidate = useCallback(() => {
    setShouldReload(true);
  }, []);

  const reload = useCallback(async () => {
    if (!shouldReload) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchApi<Minister[]>('/api/ministers?pageNumber=1&pageQuantity=100');
      const allMinisters = Array.isArray(response) ? response : [];
      // Filter only insured ministers
      const insuredMinisters = allMinisters.filter((minister) => {
        const isInsured = minister.insurance ?? minister.insured ?? minister.isInsured ?? minister.segurado ?? false;
        return isInsured === true;
      });
      setData(insuredMinisters);
      setShouldReload(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar ministros');
    } finally {
      setIsLoading(false);
    }
  }, [fetchApi, shouldReload]);
  React.useEffect(() => {
    if (shouldReload) {
      reload();
    }
  }, [shouldReload, reload]);

  return (
    <MinisterDataContext.Provider value={{ data, isLoading, error, reload, invalidate }}>
      {children}
    </MinisterDataContext.Provider>
  );
}

export function useSharedMinisterData() {
  const context = useContext(MinisterDataContext);
  if (!context) {
    throw new Error('useSharedMinisterData deve ser usado dentro de MinisterDataProvider');
  }
  return context;
}
