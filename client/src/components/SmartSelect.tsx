import { useMemo, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

interface SmartSelectOption {
  id: number | string;
  name: string;
  iconUrl?: string;
}

interface SmartSelectProps {
  label: string;
  selectedId: number | string | '';
  onSelect: (id: number | string | '') => void;
  items: SmartSelectOption[];
  defaultSelectedId?: number | string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function SmartSelect({
  label,
  selectedId,
  onSelect,
  items,
  defaultSelectedId,
  placeholder = 'Selecione...',
  required = false,
  disabled = false,
  className = '',
}: SmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const resolvedSelectedId = selectedId === '' || selectedId == null ? defaultSelectedId ?? '' : selectedId;
  const selected = useMemo(() => items.find(item => item.id === resolvedSelectedId), [items, resolvedSelectedId]);
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const normQuery = normalizeText(query);
    return items.filter(item => normalizeText(item.name).includes(normQuery));
  }, [items, query]);

  return (
    <div className={`relative ${className}`}>
      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">
        {label} {required && '*'}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`w-full text-left bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected?.iconUrl && (
                <img
                  src={selected.iconUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-4 w-6 rounded-[2px] object-cover flex-shrink-0"
                />
              )}
              <span className="truncate">{selected ? selected.name : placeholder}</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={`Buscar ${label.toLowerCase()}`}
            />
            <CommandList>
              {filteredItems.length > 0 ? (
                filteredItems.map(option => (
                  <CommandItem
                    key={option.id}
                    onSelect={() => {
                      onSelect(option.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span className="flex items-center gap-2 min-w-0 w-full">
                      {option.iconUrl && (
                        <img
                          src={option.iconUrl}
                          alt=""
                          aria-hidden="true"
                          className="h-4 w-6 rounded-[2px] object-cover flex-shrink-0"
                        />
                      )}
                      <span className="truncate">{option.name}</span>
                    </span>
                  </CommandItem>
                ))
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
