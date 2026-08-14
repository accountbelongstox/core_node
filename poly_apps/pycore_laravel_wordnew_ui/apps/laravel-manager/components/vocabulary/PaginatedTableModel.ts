export type PaginatedSortOrder = 'asc' | 'desc';

export interface PaginatedTableSort<TKey extends string = string> {
  key: TKey;
  order: PaginatedSortOrder;
}

export class PaginatedTableModel {
  static nextSort<TKey extends string>(
    current: PaginatedTableSort<TKey> | null,
    key: TKey,
  ): PaginatedTableSort<TKey> {
    if (!current || current.key !== key) return { key, order: 'asc' };
    return { key, order: current.order === 'asc' ? 'desc' : 'asc' };
  }
}
