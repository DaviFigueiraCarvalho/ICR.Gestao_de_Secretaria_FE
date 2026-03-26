import { useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { isPermissionError } from '@/lib/utils';
import PermissionDeniedError from './PermissionDeniedError';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
}

interface CRUDTableProps<T extends { id: number }> {
  title: string;
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  error?: string | null;
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onRefresh?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  addLabel?: string;
}

export default function CRUDTable<T extends { id: number }>({
  title,
  data,
  columns,
  isLoading,
  error,
  onAdd,
  onEdit,
  onDelete,
  onRefresh,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum registro encontrado',
  addLabel = 'Adicionar',
}: CRUDTableProps<T>) {
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<T | null>(null);

  const filteredData = searchable && search
    ? data.filter((item) =>
        Object.values(item as Record<string, unknown>).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase())
        )
      )
    : data;

  const handleDelete = async (item: T) => {
    if (onDelete) {
      try {
        await onDelete(item);
        setDeleteConfirm(null);
        toast.success('Registro excluído com sucesso');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao excluir');
      }
    }
  };

  const getCellValue = (item: T, col: Column<T>): ReactNode => {
    if (col.render) return col.render(item);
    const keys = String(col.key).split('.');
    let val: unknown = item;
    for (const k of keys) {
      val = (val as Record<string, unknown>)?.[k];
    }
    if (val === null || val === undefined) return '-';
    return String(val);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative">
              <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[18px]">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="bg-[#2b2b2b] border border-white/20 rounded-lg pl-9 pr-4 py-2 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] transition-colors w-64"
              />
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#2b2b2b] border border-white/20 text-white/60 hover:text-white hover:border-[#017158] transition-colors text-sm font-['Nunito']"
            >
              <span className="material-icons text-[16px]">refresh</span>
              Atualizar
            </button>
          )}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#017158] hover:bg-[#01a07e] text-white rounded-lg transition-colors font-['Nunito'] text-sm font-medium"
          >
            <span className="material-icons text-[18px]">add</span>
            {addLabel}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#2b2b2b] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <span className="material-icons animate-spin text-[#017158] text-3xl">refresh</span>
              <p className="text-white/50 font-['Nunito'] text-sm">Carregando...</p>
            </div>
          </div>
        ) : error ? (
          isPermissionError(new Error(error)) ? (
            <PermissionDeniedError message={error} compact={true} />
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="material-icons text-red-400 text-3xl">error_outline</span>
                <p className="text-white/60 font-['Nunito'] text-sm">{error}</p>
              </div>
            </div>
          )
        ) : filteredData.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="material-icons text-white/20 text-4xl">inbox</span>
              <p className="text-white/40 font-['Nunito'] text-sm">{emptyMessage}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {columns.map((col) => (
                    <th
                      key={String(col.key)}
                      className="text-left px-4 py-3 text-white/60 font-['Nunito'] text-xs font-semibold uppercase tracking-wider"
                    >
                      {col.label}
                    </th>
                  ))}
                  {(onEdit || onDelete) && (
                    <th className="text-right px-4 py-3 text-white/60 font-['Nunito'] text-xs font-semibold uppercase tracking-wider">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className="px-4 py-3 text-white/80 font-['Nunito'] text-sm"
                      >
                        {getCellValue(item, col)}
                      </td>
                    ))}
                    {(onEdit || onDelete) && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(item)}
                              className="p-1.5 rounded-lg text-white/40 hover:text-[#017158] hover:bg-[#017158]/10 transition-colors"
                              title="Editar"
                            >
                              <span className="material-icons text-[18px]">edit</span>
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => setDeleteConfirm(item)}
                              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                              title="Excluir"
                            >
                              <span className="material-icons text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2b2b2b] rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons text-red-400 text-2xl">warning</span>
              <h3 className="text-white font-['Nunito'] font-semibold text-lg">Confirmar exclusão</h3>
            </div>
            <p className="text-white/60 font-['Nunito'] text-sm mb-6">
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors font-['Nunito'] text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors font-['Nunito'] text-sm font-medium"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
