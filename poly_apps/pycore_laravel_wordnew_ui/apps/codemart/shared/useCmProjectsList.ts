import { useCallback, useState } from 'react';
import { cmApi } from '../api/CmApi';
import type { CmProject } from '../api/CmApiTypes';
import { cmTotalPages } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';

const ALL_STATUSES = '';

const extractProjects = (data: { projects: CmProject[]; pagination: unknown }) => ({
  items: Array.isArray(data.projects) ? data.projects : [],
  totalPages: cmTotalPages(data.pagination as Parameters<typeof cmTotalPages>[0]),
});

export interface CmProjectsListModel {
  list: CmPagedList<CmProject>;
  status: string;
  setStatus: (value: string) => void;
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  filtered: boolean;
  applySearch: () => void;
  clearFilters: () => void;
}

/** The projects the account owns, manages or works on, with status filter, search and paging. */
export function useCmProjectsList(): CmProjectsListModel {
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');

  const fetcher = useCallback((page: number) => cmApi.getProjects({
    include_assigned: true,
    page,
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
  }), [status, search]);
  const list = useCmPagedList(fetcher, extractProjects, 'projects.loadFailed');
  const filtered = status !== ALL_STATUSES || search !== '';

  const applySearch = useCallback((): void => {
    setSearch(searchDraft.trim());
  }, [searchDraft]);

  const clearFilters = useCallback((): void => {
    setStatus(ALL_STATUSES);
    setSearch('');
    setSearchDraft('');
  }, []);

  return { list, status, setStatus, searchDraft, setSearchDraft, filtered, applySearch, clearFilters };
}
