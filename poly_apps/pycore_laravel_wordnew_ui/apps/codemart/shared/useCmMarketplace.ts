import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmTask } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { cmSplitList, cmTotalPages } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { useCmPolicy } from '../contexts/useCmPolicy';
import type { CmFeedback } from './cmFeedback';

export interface CmMarketplaceTask extends CmTask {
  milestone?: { id: number; project_id: number; title: string } | null;
}

export interface CmMarketplaceFilters {
  skills: string;
  minBudget: string;
  maxBudget: string;
}

const EMPTY_FILTERS: CmMarketplaceFilters = { skills: '', minBudget: '', maxBudget: '' };

const extractTasks = (data: { tasks: CmTask[]; pagination: unknown }) => ({
  items: (Array.isArray(data.tasks) ? data.tasks : []) as CmMarketplaceTask[],
  totalPages: cmTotalPages(data.pagination as Parameters<typeof cmTotalPages>[0]),
});

export interface CmMarketplaceModel {
  list: CmPagedList<CmMarketplaceTask>;
  currency: string;
  canAccept: boolean;
  keyword: string;
  setKeyword: (value: string) => void;
  draft: CmMarketplaceFilters;
  setDraft: (update: (current: CmMarketplaceFilters) => CmMarketplaceFilters) => void;
  budgetInvalid: boolean;
  filtersActive: boolean;
  applyFilters: () => void;
  resetFilters: () => void;
  acceptingId: number | null;
  acceptedId: number | null;
  accept: (task: CmMarketplaceTask) => Promise<boolean>;
}

/** Marketplace search, budget and skill filters, paging and atomic task acceptance. */
export function useCmMarketplace(feedback: CmFeedback): CmMarketplaceModel {
  const { t } = useTranslation('cm');
  const { hasRole, refresh } = useCmBootstrap();
  const { currency } = useCmPolicy();
  const canAccept = hasRole('developer', 'active');
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [draft, setDraft] = useState<CmMarketplaceFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<CmMarketplaceFilters>(EMPTY_FILTERS);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [acceptedId, setAcceptedId] = useState<number | null>(null);

  const fetcher = useCallback((page: number) => {
    const skillList = cmSplitList(filters.skills);
    return cmApi.browseMarketplace({
      page,
      ...(appliedKeyword !== '' ? { keyword: appliedKeyword } : {}),
      ...(skillList.length > 0 ? { skills: skillList.join(',') } : {}),
      ...(filters.minBudget ? { min_budget: Number(filters.minBudget) } : {}),
      ...(filters.maxBudget ? { max_budget: Number(filters.maxBudget) } : {}),
    });
  }, [filters, appliedKeyword]);
  const list = useCmPagedList(fetcher, extractTasks, 'marketplace.loadFailed');

  const budgetInvalid = draft.minBudget !== '' && draft.maxBudget !== '' && Number(draft.minBudget) > Number(draft.maxBudget);
  const filtersActive = filters.skills !== '' || filters.minBudget !== '' || filters.maxBudget !== '' || appliedKeyword !== '';

  const applyFilters = useCallback((): void => {
    if (budgetInvalid) return;
    setFilters({ ...draft });
    setAppliedKeyword(keyword.trim());
  }, [budgetInvalid, draft, keyword]);

  const resetFilters = useCallback((): void => {
    setKeyword('');
    setAppliedKeyword('');
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  }, []);

  const { reload } = list;
  const accept = useCallback(async (task: CmMarketplaceTask): Promise<boolean> => {
    setAcceptingId(task.id);
    feedback.clear();
    setAcceptedId(null);
    const response = await cmApi.acceptTask(task.id);
    setAcceptingId(null);
    if (response.success) {
      feedback.success(t('marketplace.acceptedTitle', { title: task.title }));
      setAcceptedId(task.id);
      await reload();
      await refresh();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'marketplace.acceptFailed'));
    return false;
  }, [feedback, reload, refresh, t]);

  return {
    list, currency, canAccept, keyword, setKeyword, draft, setDraft,
    budgetInvalid, filtersActive, applyFilters, resetFilters, acceptingId, acceptedId, accept,
  };
}
