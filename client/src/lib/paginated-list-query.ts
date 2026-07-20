export interface PaginatedListQuery {
  pageNumber: number;
  pageQuantity: number;
  querySearch?: string;
  filters?: Record<string, number | undefined>;
}

export const buildPaginatedListEndpoint = (
  path: string,
  { pageNumber, pageQuantity, querySearch, filters = {} }: PaginatedListQuery
): string => {
  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageQuantity: String(pageQuantity),
  });
  const normalizedSearch = querySearch?.trim();

  if (normalizedSearch) {
    params.set("querySearch", normalizedSearch);
  }

  Object.entries(filters).forEach(([name, value]) => {
    if (typeof value === "number") {
      params.set(name, String(value));
    }
  });

  return `${path}?${params.toString()}`;
};
