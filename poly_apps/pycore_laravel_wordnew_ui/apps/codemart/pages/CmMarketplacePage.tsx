import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CircleDollarSign, Flag, Layers, ListTodo, RefreshCw, Search, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmTask } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { cmSplitList, cmTotalPages, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList } from '../components/workspace/useCmPagedList';

const DEFAULT_CURRENCY = 'CNY';

interface CmMarketplaceTask extends CmTask {
  milestone?: { id: number; project_id: number; title: string } | null;
}

interface CmMarketplaceFilters {
  skills: string;
  minBudget: string;
  maxBudget: string;
}

const EMPTY_FILTERS: CmMarketplaceFilters = { skills: '', minBudget: '', maxBudget: '' };

const extractTasks = (data: { tasks: CmTask[]; pagination: unknown }) => ({
  items: (Array.isArray(data.tasks) ? data.tasks : []) as CmMarketplaceTask[],
  totalPages: cmTotalPages(data.pagination as Parameters<typeof cmTotalPages>[0]),
});

export const CmMarketplacePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, hasRole, refresh } = useCmBootstrap();
  const canAccept = hasRole('developer', 'active');
  const currency = bootstrap?.vocabulary.policy.currency ?? DEFAULT_CURRENCY;
  const notice = useCmNotice();
  const [keyword, setKeyword] = useState('');
  const [draft, setDraft] = useState<CmMarketplaceFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<CmMarketplaceFilters>(EMPTY_FILTERS);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [acceptedId, setAcceptedId] = useState<number | null>(null);

  const fetcher = useCallback((page: number) => {
    const skillList = cmSplitList(filters.skills);
    return cmApi.browseMarketplace({
      page,
      ...(skillList.length > 0 ? { skills: skillList.join(',') } : {}),
      ...(filters.minBudget ? { min_budget: Number(filters.minBudget) } : {}),
      ...(filters.maxBudget ? { max_budget: Number(filters.maxBudget) } : {}),
    });
  }, [filters]);
  const list = useCmPagedList(fetcher, extractTasks, 'marketplace.loadFailed');

  const budgetInvalid = draft.minBudget !== '' && draft.maxBudget !== '' && Number(draft.minBudget) > Number(draft.maxBudget);
  const filtersActive = filters.skills !== '' || filters.minBudget !== '' || filters.maxBudget !== '' || keyword !== '';

  const applyFilters = (event: React.FormEvent): void => {
    event.preventDefault();
    if (budgetInvalid) return;
    setFilters({ ...draft });
  };

  const resetFilters = (): void => {
    setKeyword('');
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  const accept = async (task: CmMarketplaceTask): Promise<void> => {
    setAcceptingId(task.id);
    notice.clear();
    setAcceptedId(null);
    const response = await cmApi.acceptTask(task.id);
    setAcceptingId(null);
    if (response.success) {
      notice.success(t('marketplace.acceptedTitle', { title: task.title }));
      setAcceptedId(task.id);
      await list.reload();
      await refresh();
    } else {
      notice.error(cmErrorMessage(t, response, 'marketplace.acceptFailed'));
    }
  };

  const visibleTasks = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return list.items;
    return list.items.filter((task) => (
      task.title.toLowerCase().includes(needle)
      || (task.description ?? '').toLowerCase().includes(needle)
      || (task.required_skills ?? []).some((skill) => skill.toLowerCase().includes(needle))
    ));
  }, [keyword, list.items]);

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="marketplace.eyebrow"
        titleKey="nav.marketplace"
        purposeKey="marketplace.description"
        actions={(
          <button type="button" className="cm-workspace-button" onClick={() => void list.reload()} disabled={list.loading}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
        )}
      />
      <form className="cm-marketplace-toolbar" onSubmit={applyFilters}>
        <label>
          <span>{t('marketplace.searchLabel')}</span>
          <div>
            <Search aria-hidden="true" />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t('marketplace.searchPlaceholder')} />
          </div>
        </label>
        <label>
          <span>{t('marketplace.skillsLabel')}</span>
          <div>
            <Layers aria-hidden="true" />
            <input value={draft.skills} onChange={(event) => setDraft((current) => ({ ...current, skills: event.target.value }))} placeholder={t('marketplace.skillsPlaceholder')} />
          </div>
        </label>
        <label>
          <span>{t('marketplace.budgetRange')}</span>
          <div className="cm-range-inputs">
            <input type="number" min={0} inputMode="decimal" value={draft.minBudget} onChange={(event) => setDraft((current) => ({ ...current, minBudget: event.target.value }))} placeholder={t('marketplace.minBudget')} aria-label={t('marketplace.minBudget')} aria-invalid={budgetInvalid} />
            <span aria-hidden="true">–</span>
            <input type="number" min={0} inputMode="decimal" value={draft.maxBudget} onChange={(event) => setDraft((current) => ({ ...current, maxBudget: event.target.value }))} placeholder={t('marketplace.maxBudget')} aria-label={t('marketplace.maxBudget')} aria-invalid={budgetInvalid} />
          </div>
          {budgetInvalid && <small className="cm-field-error">{t('marketplace.budgetRangeInvalid')}</small>}
        </label>
        <div className="cm-marketplace-toolbar__actions">
          <button type="submit" className="cm-workspace-button is-primary" disabled={budgetInvalid || list.loading}>
            <Search aria-hidden="true" /> {t('marketplace.applyFilters')}
          </button>
          {filtersActive && (
            <button type="button" className="cm-workspace-button" onClick={resetFilters}>
              <X aria-hidden="true" /> {t('marketplace.clearFilters')}
            </button>
          )}
        </div>
      </form>
      {!canAccept && <CmNotice notice={{ tone: 'info', text: t('marketplace.developerRequired') }} />}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {acceptedId !== null && (
        <p className="cm-inline-action">
          <Link to={`/codemart/tasks?task=${acceptedId}`} className="cm-workspace-button"><ListTodo aria-hidden="true" /> {t('marketplace.openAccepted')}</Link>
        </p>
      )}
      {list.loading ? (
        <CmLoadingState />
      ) : list.error ? (
        <CmErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : visibleTasks.length === 0 ? (
        <CmEmptyState
          title={filtersActive ? t('marketplace.noMatchTitle') : t('marketplace.emptyTitle')}
          body={filtersActive ? t('marketplace.noMatchBody') : t('marketplace.emptyBody')}
          action={filtersActive ? <button type="button" className="cm-workspace-button" onClick={resetFilters}>{t('marketplace.clearFilters')}</button> : undefined}
        />
      ) : (
        <section className="cm-card-list" aria-label={t('nav.marketplace')}>
          {visibleTasks.map((task) => (
            <article key={task.id} className="cm-record-card">
              <div className="cm-record-card__main">
                {task.milestone?.title && <small className="cm-record-card__kicker">{t('marketplace.milestoneLabel', { title: task.milestone.title })}</small>}
                <h2>{task.title}</h2>
                <p>{task.description}</p>
                <div className="cm-record-card__meta">
                  <CmStatusBadge group="task" status={task.status} />
                  {task.budget_allocation && (
                    <span className="cm-record-card__money"><CircleDollarSign aria-hidden="true" /> {format.money(task.budget_allocation, currency)}</span>
                  )}
                  {task.due_date && <span><CalendarDays aria-hidden="true" /> {t('tasks.due', { date: format.date(task.due_date) })}</span>}
                  {task.priority && <span><Flag aria-hidden="true" /> {t(`projectDetail.priorities.${task.priority}`, { defaultValue: task.priority })}</span>}
                </div>
                {(task.required_skills ?? []).length > 0 && (
                  <ul className="cm-chip-list" aria-label={t('marketplace.skillsLabel')}>
                    {(task.required_skills ?? []).map((skill) => <li key={skill}>{skill}</li>)}
                  </ul>
                )}
              </div>
              {canAccept && (
                <button
                  type="button"
                  className="cm-workspace-button is-primary"
                  disabled={acceptingId !== null}
                  onClick={() => void accept(task)}
                >
                  {acceptingId === task.id ? t('marketplace.accepting') : t('marketplace.accept')}
                </button>
              )}
            </article>
          ))}
        </section>
      )}
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </main>
  );
};

export default CmMarketplacePage;
