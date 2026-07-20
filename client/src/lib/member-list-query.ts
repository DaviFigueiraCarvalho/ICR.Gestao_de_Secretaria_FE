export interface MemberListQuery {
  pageNumber: number;
  pageQuantity: number;
  querySearch?: string;
  federationId?: number;
  churchId?: number;
  cellId?: number;
}

const appendId = (params: URLSearchParams, name: string, value?: number) => {
  if (typeof value === "number") {
    params.set(name, String(value));
  }
};

export const buildMemberListEndpoint = ({
  pageNumber,
  pageQuantity,
  querySearch,
  federationId,
  churchId,
  cellId,
}: MemberListQuery): string => {
  const hasFilter = [federationId, churchId, cellId].some(
    value => typeof value === "number"
  );
  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageQuantity: String(pageQuantity),
  });
  const normalizedSearch = querySearch?.trim();

  if (normalizedSearch) {
    params.set("querySearch", normalizedSearch);
  }

  appendId(params, "federationId", federationId);
  appendId(params, "churchId", churchId);
  appendId(params, "cellId", cellId);

  const path = hasFilter ? "/api/members/filter" : "/api/members";
  return `${path}?${params.toString()}`;
};
