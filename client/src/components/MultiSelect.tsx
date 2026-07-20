import { useState, useEffect, useRef } from 'react';
import SmartSelect, { SmartSelectOption } from './SmartSelect';

interface MultiSelectProps {
  label: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxSelections?: number;
  fetchItems: (page: number, query: string) => Promise<SmartSelectOption[]>;
}

export default function MultiSelect({
  label,
  selectedIds,
  onChange,
  placeholder = 'Selecione...',
  disabled = false,
  className = '',
  maxSelections,
  fetchItems,
}: MultiSelectProps) {
  const [selectedItems, setSelectedItems] = useState<SmartSelectOption[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Carregar detalhes dos itens selecionados quando selectedIds mudar
  useEffect(() => {
    if (!isInitialized || selectedIds.length === 0) {
      if (selectedIds.length === 0) {
        setSelectedItems([]);
      }
      return;
    }

    const loadSelectedItems = async () => {
      try {
        // Buscar itens selecionados para exibir seus nomes
        const items = await fetchItems(1, '');
        const selected = items.filter(item => selectedIds.includes(item.id as number));
        setSelectedItems(selected);
      } catch (error) {
        console.error('[MultiSelect] Error loading selected items:', error);
        // Em caso de erro, manter os IDs mas sem nomes
        setSelectedItems([]);
      }
    };

    loadSelectedItems();
  }, [selectedIds, isInitialized, fetchItems]);

  // Marcar como inicializado após a primeira renderização
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const handleSelect = (id: number | string | '') => {
    if (id === '' || id === null || id === undefined) return;

    const numericId = typeof id === 'string' ? parseInt(id) : id;
    
    if (!numericId || isNaN(numericId)) return;

    // Verificar se já está selecionado
    if (selectedIds.includes(numericId)) {
      // Remover da seleção
      onChange(selectedIds.filter(existingId => existingId !== numericId));
    } else {
      // Adicionar à seleção
      const nextIds = [...selectedIds, numericId];
      onChange(maxSelections ? nextIds.slice(-maxSelections) : nextIds);
    }
  };

  const handleRemove = (idToRemove: number) => {
    onChange(selectedIds.filter(id => id !== idToRemove));
  };

  // Criar um texto resumido dos itens selecionados
  const getSelectedText = (): string => {
    if (selectedIds.length === 0) return placeholder;
    if (selectedIds.length === 1) {
      const item = selectedItems.find(item => item.id === selectedIds[0]);
      return item?.name || `1 item selecionado`;
    }
    return `${selectedIds.length} itens selecionados`;
  };

  return (
    <div className={`relative ${className}`}>
      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">
        {label}
      </label>
      
      {/* Mostrar itens selecionados como tags */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedIds.map((id) => {
            const item = selectedItems.find((selectedItem) => selectedItem.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-[#017158]/20 border border-[#017158]/30 rounded-lg text-white text-sm font-['Nunito']"
              >
                <span className="truncate max-w-[200px]">{item?.name || `ID ${id}`}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(id)}
                  className="hover:text-red-400 transition-colors flex-shrink-0"
                  disabled={disabled}
                >
                  <span className="material-icons text-sm">close</span>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* SmartSelect para adicionar novos itens */}
      <SmartSelect
        label=""
        selectedId={''}
        selectedItem={null}
        onSelect={handleSelect}
        placeholder={getSelectedText()}
        disabled={disabled}
        fetchItems={fetchItems}
      />
    </div>
  );
}
