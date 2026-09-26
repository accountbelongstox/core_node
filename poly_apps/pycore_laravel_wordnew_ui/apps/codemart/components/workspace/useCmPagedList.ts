import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { APIResponse } from '../../../../core/integrations/laravel/transport/TransportTypes';
import { cmErrorMessage } from '../../api/cmErrors';

export interface CmPagedSlice<T> {
  items: T[];
  totalPages: number;
}

export interface CmPagedList<T> {
  items: T[];
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  load: (page: number) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Paged server list with loading and localized error state.
 * `fetcher` and `extract` must be stable (module-level or memoized).
 */
export function useCmPagedList<R, T>(
  fetcher: (page: number) => Promise<APIResponse<R>>,
  extract: (data: R) => CmPagedSlice<T>,
  fallbackKey: string,
  enabled = true,
): CmPagedList<T> {
  const { t } = useTranslation('cm');
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);
  const translate = useRef(t);
  translate.current = t;

  const load = useCallback(async (targetPage: number): Promise<void> => {
    setLoading(true);
    const response = await fetcher(targetPage);
    if (response.success && response.data) {
      const slice = extract(response.data);
      setItems(slice.items);
      setTotalPages(slice.totalPages);
      setPage(targetPage);
      pageRef.current = targetPage;
      setError(null);
    } else {
      setError(cmErrorMessage(translate.current, response, fallbackKey));
    }
    setLoading(false);
  }, [fetcher, extract, fallbackKey]);

  const reload = useCallback(() => load(pageRef.current), [load]);

  useEffect(() => {
    if (enabled) void load(1);
    else setLoading(false);
  }, [enabled, load]);

  return { items, page, totalPages, loading, error, load, reload };
}
