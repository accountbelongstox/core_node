import { useCallback, useEffect, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import type { APIResponse } from '../../core/types';
import type { MediaListResponse } from '../../core/api/modules/MediaQueryAPI';

/**
 * useExistingMediaList — shared page/search/language state machine behind
 * ExistingBooksPanel and ExistingDocumentsPanel (GET /media/books, /media/documents).
 *
 * `page`, `search` and `language` are held in ONE state object updated
 * atomically: a search/language change resets `page` to 1 in the SAME
 * setState call, so there is exactly one derived re-render per user action
 * and therefore exactly one fetch — no separate "reset page" effect racing
 * a separate "page changed, refetch" effect (which would fire once with the
 * stale page, then again with the reset page). `useApiResource` supplies the
 * loading/error/mounted-guard machinery on top.
 */

interface Query {
  page: number;
  search: string;
  language: string;
}

interface UseExistingMediaListOptions<T> {
  perPage: number;
  /** False skips the fetch entirely (e.g. the documents endpoint while logged out). */
  enabled: boolean;
  fetchPage: (params: {
    page: number;
    per_page: number;
    search?: string;
    language?: string;
  }) => Promise<APIResponse<MediaListResponse<T>>>;
}

const EMPTY_PAGE = { items: [], total: 0, per_page: 0, current_page: 1, last_page: 1 };

export function useExistingMediaList<T>({ perPage, enabled, fetchPage }: UseExistingMediaListOptions<T>) {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<Query>({ page: 1, search: '', language: '' });

  // Debounce the raw search box into query.search, resetting page to 1 in the
  // same update.
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = searchInput.trim();
      setQuery((q) => (q.search === trimmed ? q : { ...q, page: 1, search: trimmed }));
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const setLanguage = useCallback((language: string) => {
    setQuery((q) => (q.language === language ? q : { ...q, page: 1, language }));
  }, []);

  const setPage = useCallback((updater: number | ((p: number) => number)) => {
    setQuery((q) => {
      const next = typeof updater === 'function' ? (updater as (p: number) => number)(q.page) : updater;
      return next === q.page ? q : { ...q, page: next };
    });
  }, []);

  // `enabled` flipping (e.g. logging in/out without unmounting) can leave a
  // page number that no longer applies to the new dataset — reset it.
  useEffect(() => {
    setQuery((q) => (q.page === 1 ? q : { ...q, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const resource = useApiResource<MediaListResponse<T>>(
    () => {
      if (!enabled) return Promise.resolve({ success: true, data: EMPTY_PAGE as MediaListResponse<T> });
      return fetchPage({
        page: query.page,
        per_page: perPage,
        search: query.search || undefined,
        language: query.language || undefined,
      });
    },
    { deps: [enabled, query.page, query.search, query.language, perPage] }
  );

  const data = resource.data;
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page: query.page,
    lastPage: data?.last_page ?? 1,
    loading: resource.loading,
    error: resource.error,
    search: searchInput,
    setSearch: setSearchInput,
    language: query.language,
    setLanguage,
    setPage,
    refresh: resource.refresh,
  };
}
