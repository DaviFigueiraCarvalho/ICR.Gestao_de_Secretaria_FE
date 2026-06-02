import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';

interface SmartSelectOption {
  id: number | string;
  name: string;
  iconUrl?: string;
}

interface SmartSelectProps {
  label: string;
  selectedId: number | string | '';
  onSelect: (id: number | string | '') => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  // API function for remote search with pagination
  fetchItems?: (page: number, query: string) => Promise<SmartSelectOption[]>;
  // Legacy support for local items (if fetchItems not provided)
  items?: SmartSelectOption[];
  defaultSelectedId?: number | string;
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

export default function SmartSelect({
  label,
  selectedId,
  onSelect,
  placeholder = 'Selecione...',
  required = false,
  disabled = false,
  className = '',
  fetchItems,
  items = [],
  defaultSelectedId,
}: SmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteItems, setRemoteItems] = useState<SmartSelectOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedItem, setSelectedItem] = useState<SmartSelectOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(PAGE_SIZE);

  // Debounce timer for search
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Lock to prevent multiple simultaneous requests
  const loadingLockRef = useRef(false);
  // Command list ref for scroll detection
  const commandListRef = useRef<HTMLDivElement>(null);

  const resolvedSelectedId = selectedId === '' || selectedId == null ? defaultSelectedId ?? '' : selectedId;

  // Initialize selected item from items when component mounts or selectedId changes
  useEffect(() => {
    if (resolvedSelectedId) {
      const found = items.find(item => item.id === resolvedSelectedId);
      if (found) {
        setSelectedItem(found);
      }
    }
  }, [resolvedSelectedId, items]);

  // Fetch items from API or use local items
  const loadItems = async (page: number, searchQuery: string, append: boolean = false) => {
    // Prevent multiple simultaneous requests
    if (loadingLockRef.current) {
      return;
    }

    try {
      loadingLockRef.current = true;
      setLoading(true);
      setError(null);

      if (fetchItems) {
        // Use remote API
        const newItems = await fetchItems(page, searchQuery);

        // Detect if we've reached the end of pagination
        const hasMoreResults = newItems.length === PAGE_SIZE;
        setHasMore(hasMoreResults);
        setItemsPerPage(newItems.length);

        if (append) {
          // Infinite scroll: append new items
          setRemoteItems(prev => [...prev, ...newItems]);
        } else {
          // New search: replace items
          setRemoteItems(newItems);
        }
      } else if (items.length > 0) {
        // Fallback to local items if fetchItems not provided
        const normQuery = normalizeText(searchQuery);
        const filtered = !searchQuery.trim()
          ? items
          : items.filter(item => normalizeText(item.name).includes(normQuery));

        setRemoteItems(filtered);
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar itens');
      console.error('[SmartSelect] Error loading items:', err);
    } finally {
      loadingLockRef.current = false;
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

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      console.log('[SmartSelect] Search debounce triggered, query:', newQuery);
      setCurrentPage(1);
      setRemoteItems([]);
      setHasMore(true);
      loadItems(1, newQuery, false);
    }, SEARCH_DEBOUNCE_MS);
  };

  // Handle opening dropdown - load initial items
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);

    if (newOpen && remoteItems.length === 0 && !loading) {
      console.log('[SmartSelect] Dropdown opened, loading initial items');
      loadItems(1, '', false);
    }
  };

  // Handle infinite scroll - detect when user scrolls near end
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearEnd = target.scrollHeight - target.scrollTop - target.clientHeight < 100;

    if (isNearEnd && hasMore && !loading && !loadingLockRef.current) {
      console.log('[SmartSelect] Near end of list, loading next page:', currentPage + 1);
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      loadItems(nextPage, query, true);
    }
  };

  // Handle item selection
  const handleSelect = (item: SmartSelectOption) => {
    console.log('[SmartSelect] Item selected:', item.id);
    onSelect(item.id);
    setSelectedItem(item);
    setOpen(false);
    setQuery('');
    setRemoteItems([]);
    setCurrentPage(1);
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

  // Display items (remote if available, otherwise selected local item)
  const displayItems = remoteItems.length > 0 ? remoteItems : (selectedItem ? [selectedItem] : []);

  return (
    <div className={`relative ${className}`}>
      <label className="text-white/70 text-sm font-['Nunito'] block mb-1">
        {label} {required && '*'}
      </label>
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
              <span className="truncate">{selectedItem ? selectedItem.name : placeholder}</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 flex flex-col">
          <Command className="flex-1">
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
              ) : loading && remoteItems.length === 0 ? (
                <div className="px-4 py-6 text-center text-white/60 text-sm">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[#017158] border-r-transparent"></div>
                  <div className="mt-2">Carregando...</div>
                </div>
              ) : remoteItems.length > 0 ? (
                <>
                  {remoteItems.map(option => (
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
              ) : (
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              )}
            </CommandList>
          </Command>

          {/* Pagination Footer */}
          {remoteItems.length > 0 && (
            <div className="border-t border-white/10 px-4 py-3 bg-[#1c1c1c]">
              <div className="flex items-center justify-between gap-2">
                {/* Previous Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (currentPage > 1) {
                      const prevPage = currentPage - 1;
                      setCurrentPage(prevPage);
                      setRemoteItems([]);
                      loadItems(prevPage, query, false);
                    }
                  }}
                  disabled={currentPage === 1 || loading}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    currentPage === 1 || loading
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'bg-[#017158] text-white hover:bg-[#015a45]'
                  }`}
                >
                  ← Anterior
                </button>

                {/* Page Indicator */}
                <span className="text-white/70 text-sm font-medium whitespace-nowrap">
                  Página {currentPage}
                </span>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (hasMore) {
                      const nextPage = currentPage + 1;
                      setCurrentPage(nextPage);
                      setRemoteItems([]);
                      loadItems(nextPage, query, false);
                    }
                  }}
                  disabled={!hasMore || loading}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    !hasMore || loading
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'bg-[#017158] text-white hover:bg-[#015a45]'
                  }`}
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Normalize text for comparison (remove accents and convert to lowercase)
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
