import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type DashboardSummaryCardProps = {
  title: string;
  data: unknown;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  columns?: 1 | 2 | 3;
  className?: string;
};

type DashboardSummaryItem = {
  label: string;
  value: number | string;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getItemLabel(row: Record<string, unknown>, index: number): string {
  const label =
    row.name ??
    row.className ??
    row.roleName ??
    row.title ??
    row.label ??
    row.description;

  if (typeof label === 'string' && label.trim()) return label.trim();
  if (typeof label === 'number' && Number.isFinite(label)) return String(label);

  return `Item ${index + 1}`;
}

function getItemValue(row: Record<string, unknown>): number | string {
  const value =
    row.count ??
    row.total ??
    row.value ??
    row.quantity ??
    row.items;

  const numericValue = toNumber(value);
  return numericValue !== null ? numericValue : (typeof value === 'string' && value.trim() ? value.trim() : 0);
}

function resolveItems(data: unknown): DashboardSummaryItem[] {
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return { label: `Item ${index + 1}`, value: 0 };
    }

    const row = item as Record<string, unknown>;
    return {
      label: getItemLabel(row, index),
      value: getItemValue(row),
    };
  });
}

export default function DashboardSummaryCard({
  title,
  data,
  loading = false,
  error = null,
  emptyMessage = 'Sem dados para esta visão',
  columns = 1,
  className = '',
}: DashboardSummaryCardProps) {
  const items = resolveItems(data);
  const directValue = Array.isArray(data) ? null : toNumber(data);
  const hasItemList = items.length > 0;

  return (
    <Card
      className={cn(
        'overflow-hidden border border-[#cfe4dc] bg-white text-[#123b33] shadow-[0_8px_24px_rgba(1,113,88,0.08)] dark:border-white/10 dark:bg-[#2b2b2b] dark:text-white',
        className,
      )}
    >
      <CardHeader className="px-5 pb-3 pt-5">
        <CardTitle className="text-lg font-['Nunito'] font-semibold text-[#0f5f4d] dark:text-white">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-28 bg-black/10 dark:bg-white/15" />
            <div className={`grid gap-2 ${columns === 2 ? 'md:grid-cols-2' : columns === 3 ? 'md:grid-cols-3' : 'grid-cols-1'}`}>
              <Skeleton className="h-8 w-full bg-black/10 dark:bg-white/15" />
              <Skeleton className="h-8 w-full bg-black/10 dark:bg-white/15" />
              <Skeleton className="h-8 w-full bg-black/10 dark:bg-white/15" />
            </div>
          </div>
        ) : error ? (
          <div className="space-y-2">
            <div className="text-4xl font-['Nunito'] font-bold leading-none">—</div>
            <p className="text-sm text-[#4b756b] dark:text-white/75 font-['Nunito']">{error}</p>
          </div>
        ) : hasItemList ? (
          <div className="space-y-2">
            <div className={`grid gap-2 ${columns === 2 ? 'md:grid-cols-2' : columns === 3 ? 'md:grid-cols-3' : 'grid-cols-1'}`}>
              {items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#017158]/15 bg-[#f8fcfa] px-4 py-3 dark:border-white/10 dark:bg-white/5"
                >
                  <span className="text-sm font-['Nunito'] text-[#123b33] dark:text-white/95 truncate">
                    {item.label}
                  </span>
                  <span className="shrink-0 rounded-full border border-[#017158]/20 bg-white px-3 py-1 text-sm font-['Nunito'] font-semibold text-[#017158] dark:border-white/10 dark:bg-white/10 dark:text-white">
                    {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-white/75 font-['Nunito']">
              Quantidade de cada categoria nesta visão
            </p>
          </div>
        ) : directValue === null ? (
          <div className="space-y-2">
            <div className="text-4xl font-['Nunito'] font-bold leading-none">—</div>
            <p className="text-sm text-[#4b756b] dark:text-white/75 font-['Nunito']">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-5xl font-['Nunito'] font-bold leading-none tracking-tight">
              {formatNumber(directValue)}
            </div>
            <p className="text-sm text-[#4b756b] dark:text-white/75 font-['Nunito']">Atualizado conforme a visão selecionada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
