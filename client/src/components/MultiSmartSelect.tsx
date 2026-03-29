import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { normalizeText } from './SmartSelect';

interface MultiSmartSelectOption {
  id: number;
  name: string;
}

interface MultiSmartSelectProps {
  label: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  items: MultiSmartSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function MultiSmartSelect({
  label,
  selectedIds,
  onChange,
  items,
  placeholder = 'Selecione...',
  disabled = false,
  className = '',
}: MultiSmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const normalizedQuery = normalizeText(query);
    return items.filter((item) => normalizeText(item.name).includes(normalizedQuery));
  }, [items, query]);

  const buttonLabel = useMemo(() => {
    if (selectedItems.length === 0) return placeholder;
    if (selectedItems.length === 1) return selectedItems[0].name;
    return `${selectedItems.length} selecionados`;
  }, [placeholder, selectedItems]);

  const toggleId = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }

    onChange([...selectedIds, id]);
  };

  return (
    <div className={`relative ${className}`}>
      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`w-full text-left bg-[#2b2b2b] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {buttonLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={`Buscar ${label.toLowerCase()}`}
            />
            <CommandList>
              <CommandItem
                onSelect={() => {
                  onChange([]);
                  setQuery('');
                }}
              >
                Limpar selecao
              </CommandItem>
              {filteredItems.length > 0 ? (
                filteredItems.map((option) => {
                  const selected = selectedIds.includes(option.id);
                  return (
                    <CommandItem
                      key={option.id}
                      onSelect={() => {
                        toggleId(option.id);
                      }}
                    >
                      <span className={`material-icons text-[16px] mr-2 ${selected ? 'text-[#01a07e]' : 'text-white/20'}`}>
                        {selected ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      {option.name}
                    </CommandItem>
                  );
                })
              ) : (
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
