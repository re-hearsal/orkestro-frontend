export interface FlatPagination {
  page?: number;
  size?: number;
  sort?: string[];
}

export function withFlatPagination<TQuery extends Record<string, unknown>>(
  query: TQuery,
  pagination: FlatPagination
): TQuery & FlatPagination {
  return {
    ...query,
    ...(pagination.page != null ? { page: pagination.page } : {}),
    ...(pagination.size != null ? { size: pagination.size } : {}),
    ...(pagination.sort && pagination.sort.length > 0 ? { sort: pagination.sort } : {}),
  };
}
