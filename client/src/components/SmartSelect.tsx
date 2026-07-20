import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';

export interface SmartSelectOption {
  id: number | string;
  name: string;
  iconUrl?: string;
}

interface SmartSelectProps {
  label: string;
  selectedId: number | string | '';
  selectedItem: SmartSelectOption | null;
  onSelect: (id: number | string | '') => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  fetchItems: (page: number, query: string) => Promise<SmartSelectOption[]>;
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export default function SmartSelect({
  label,
  selectedId,
  selectedItem,
  onSelect,
  placeholder = 'Selecione...',
  required = false,
  disabled = false,
  className = '',
  fetchItems,
}: SmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SmartSelectOption[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const commandListRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const queryRef = useRef(query);

  // Keep refs in sync with state
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  // Fetch items from API
  const loadItems = async (pageNum: number, searchQuery: string, append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const newItems = await fetchItems(pageNum, searchQuery);

      // Detect if we've reached the end of pagination
      const hasMoreResults = newItems.length >= PAGE_SIZE;
      setHasMore(hasMoreResults);

      if (append) {
        // Infinite scroll: append new items
        setItems(prev => [...prev, ...newItems]);
      } else {
        // New search: replace items
        setItems(newItems);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar itens');
      console.error('[SmartSelect] Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle search input with debounce
  const handleSearchChange = (newQuery: string) => {
    setQuery(newQuery);

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Reset pagination for new search
    setPage(1);
    setHasMore(true);

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      loadItems(1, newQuery, false);
    }, SEARCH_DEBOUNCE_MS);
  };

  // Handle opening dropdown - load initial items
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);

    if (newOpen) {
      // Reset state and load initial items
      setItems([]);
      setPage(1);
      setHasMore(true);
      setError(null);
      loadItems(1, query, false);
    }
  };

  // Handle infinite scroll - detect when user scrolls near end
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearEnd = target.scrollHeight - target.scrollTop - target.clientHeight < 100;

    if (isNearEnd && hasMore && !loading) {
      const nextPage = pageRef.current + 1;
      setPage(nextPage);
      loadItems(nextPage, queryRef.current, true);
    }
  };

  // Handle item selection
  const handleSelect = (item: SmartSelectOption) => {
    onSelect(item.id);
    setOpen(false);
    setQuery('');
    setItems([]);
    setPage(1);
    setHasMore(true);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="text-white/70 text-sm font-['Nunito'] block mb-1">
          {label} {required && '*'}
        </label>
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`w-full text-left bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {selectedItem?.iconUrl && (
                <img
                  src={selectedItem.iconUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-4 w-6 rounded-[2px] object-cover flex-shrink-0"
                />
              )}
              <span className="truncate">
                {selectedItem ? selectedItem.name : placeholder}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 flex flex-col">
          <Command className="flex-1" shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={handleSearchChange}
              placeholder={`Buscar ${label.toLowerCase()}`}
            />
            <CommandList
              ref={commandListRef}
              onScroll={handleScroll}
            >
              {error ? (
                <div className="px-4 py-2 text-red-400 text-sm">{error}</div>
              ) : loading && items.length === 0 ? (
                <div className="px-4 py-6 text-center text-white/60 text-sm">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[#017158] border-r-transparent"></div>
                  <div className="mt-2">Carregando...</div>
                </div>
              ) : items.length > 0 ? (
                <>
                  {items.map(option => (
                    <CommandItem
                      key={`${option.id}`}
                      onSelect={() => handleSelect(option)}
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
                  ))}
                  {loading && (
                    <div className="px-4 py-2 text-center text-white/60 text-sm">
                      <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-[#017158] border-r-transparent mr-2"></span>
                      Carregando mais...
                    </div>
                  )}
                </>
              ) : !loading && query.trim() ? (
                <div className="px-4 py-6 text-center text-white/40 text-sm">
                  Nenhum resultado encontrado.
                </div>
              ) : !loading && !query.trim() ? (
                <div className="px-4 py-6 text-center text-white/40 text-sm">
                  Digite para buscar...
                </div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
