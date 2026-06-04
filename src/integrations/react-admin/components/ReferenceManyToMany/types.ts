import type { ReactElement } from 'react';

export const DEFAULT_SORT = { field: 'id', order: 'ASC' as const };

export function parseUsing(using: string): [string, string] {
  const keys = using.split(',').map((k) => k.trim());
  if (keys.length !== 2 || !keys[0] || !keys[1]) {
    throw new Error(`Invalid using format: "${using}". Expected "sourceKey,targetKey"`);
  }
  return keys as [string, string];
}

export const noop = () => {};

export const BASE_LIST_CONTEXT = {
  isLoading: false as const,
  isFetching: false as const,
  isPending: false as const,
  error: null,
  page: 1,
  displayedFilters: {},
  filterValues: {},
  hasNextPage: false,
  hasPreviousPage: false,
  selectedIds: [] as string[],
  setSort: noop,
  setPage: noop,
  setPerPage: noop,
  setFilters: noop,
  showFilter: noop,
  hideFilter: noop,
  refetch: noop,
  onSelect: noop,
  onSelectAll: noop,
  onToggleItem: noop,
  onUnselectItems: noop,
};

export interface ReferenceManyToManyFieldProps {
  reference: string;
  through: string;
  using: string;
  source?: string;
  children: ReactElement;
  label?: string;
  sort?: { field: string; order: 'ASC' | 'DESC' };
  perPage?: number;
}

export interface ReferenceManyToManyInputProps {
  reference: string;
  through: string;
  using: string;
  source?: string;
  children: ReactElement;
  label?: string;
  filter?: Record<string, unknown>;
}
