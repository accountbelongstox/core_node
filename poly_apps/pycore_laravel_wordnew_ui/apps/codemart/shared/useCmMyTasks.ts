import { useCallback, useState } from 'react';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmApi } from '../api/CmApi';
import type { CmTask } from '../api/CmApiTypes';
import { cmTotalPages } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';

export const CM_TASK_SCOPES = ['mine', 'visible'] as const;
export type CmTaskScope = typeof CM_TASK_SCOPES[number];

export interface CmListedTask extends CmTask {
  milestone?: { id: number; project_id: number; title: string } | null;
}

interface CmTaskSlice {
  items: CmListedTask[];
  totalPages: number;
}

/** Tasks assigned to the signed-in developer (`GET /marketplace/my-tasks`). */
async function fetchMyTasks(page: number): Promise<APIResponse<CmTaskSlice>> {
  const response = await cmApi.getMyTasks(page);
  if (!response.success || !response.data) return { ...response, data: null };
  return {
    ...response,
    data: {
      items: (Array.isArray(response.data.my_tasks) ? response.data.my_tasks : []) as CmListedTask[],
      totalPages: cmTotalPages(response.data.pagination as Parameters<typeof cmTotalPages>[0]),
    },
  };
}

/** Every task the account may see, filtered on the server (`GET /tasks`). */
async function fetchVisibleTasks(page: number, status: string, search: string): Promise<APIResponse<CmTaskSlice>> {
  const response = await cmApi.getTasks({ page, status, search });
  if (!response.success || !response.data) return { ...response, data: null };
  return {
    ...response,
    data: { items: (Array.isArray(response.data.items) ? response.data.items : []) as CmListedTask[], totalPages: cmTotalPages(response.data) },
  };
}

const extractTasks = (data: CmTaskSlice): CmTaskSlice => data;

export interface CmMyTasksModel {
  list: CmPagedList<CmListedTask>;
  scope: CmTaskScope;
  setScope: (scope: CmTaskScope) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  applySearch: () => void;
}

/** The developer's own tasks, or every task the account may see with status and search filters. */
export function useCmMyTasks(): CmMyTasksModel {
  const [scope, setScope] = useState<CmTaskScope>('mine');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const fetchTasks = useCallback(
    (page: number) => (scope === 'mine' ? fetchMyTasks(page) : fetchVisibleTasks(page, statusFilter, search)),
    [scope, statusFilter, search],
  );
  const list = useCmPagedList(fetchTasks, extractTasks, 'tasks.loadFailed');
  const applySearch = useCallback((): void => setSearch(searchDraft.trim()), [searchDraft]);
  return { list, scope, setScope, statusFilter, setStatusFilter, searchDraft, setSearchDraft, applySearch };
}
