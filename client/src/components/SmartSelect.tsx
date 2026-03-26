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
  id: number;
  name: string;
}

interface SmartSelectProps {
  label: string;
  selectedId: number | '';
  onSelect: (id: number | '') => void;
  items: SmartSelectOption[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function SmartSelect({
  label,
  selectedId,
  onSelect,
  items,
  placeholder = 'Selecione...',
  required = false,
  className = '',
}: SmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => items.find(item => item.id === selectedId), [items, selectedId]);
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
            className="w-full text-left bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158]"
          >
            {selected ? selected.name : placeholder}
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
                    {option.name}
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
