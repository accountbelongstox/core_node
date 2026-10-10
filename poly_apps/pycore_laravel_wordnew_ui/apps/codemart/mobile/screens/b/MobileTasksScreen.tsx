import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CircleDollarSign, Flag, Search, Store } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PROTECTED_ROUTE, CM_TASK_QUERY_PARAM } from '../../../components/public-home/cmPublicRoutes';
import { useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../../../contexts/CmBootstrapContext';
import { useCmPolicy } from '../../../contexts/useCmPolicy';
import { CM_TASK_SCOPES, useCmMyTasks } from '../../../shared/useCmMyTasks';
import { MobileButton, MobileListState, MobilePager, MobileScreen, MobileSegmented, MobileStatusBadge } from '../../ui';
import { MobileEntityCard } from './parts/MobileEntityCard';
import { MobileTaskSheet } from './parts/MobileTaskSheet';
import './styles/cm-mobile-work.css';

/** Mobile tasks: my assigned tasks or every visible task, task sheet with start/block/unblock, submissions, review and comments. */
const MobileTasksScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { refresh, states } = useCmBootstrap();
  const { currency } = useCmPolicy();
  const [searchParams, setSearchParams] = useSearchParams();
  const { list, scope, setScope, statusFilter, setStatusFilter, searchDraft, setSearchDraft, applySearch } = useCmMyTasks();
  const selectedId = Number.parseInt(searchParams.get(CM_TASK_QUERY_PARAM) ?? '', 10);
  const openId = Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null;

  const openTask = useCallback((taskId: number | null): void => {
    const next = new URLSearchParams(searchParams);
    if (taskId === null) next.delete(CM_TASK_QUERY_PARAM);
    else next.set(CM_TASK_QUERY_PARAM, String(taskId));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const onChanged = useCallback(async (): Promise<void> => {
    await list.reload();
    await refresh();
  }, [list, refresh]);

  const findWork = <MobileButton variant="primary" icon={<Store aria-hidden="true" />} to={CM_PROTECTED_ROUTE.marketplace}>{t('tasks.findWork')}</MobileButton>;

  return (
    <MobileScreen title={t('nav.tasks')} onRefresh={() => list.reload()}>
      <MobileSegmented
        ariaLabel={t('tasks.scope.label')}
        value={scope}
        onChange={setScope}
        options={CM_TASK_SCOPES.map((value) => ({ value, label: t(`tasks.scope.${value}`) }))}
      />
      {scope === 'visible' && (
        <form className="cmm-stack-tight" onSubmit={(event) => { event.preventDefault(); applySearch(); }} role="search">
          <div className="cmm-search">
            <Search aria-hidden="true" />
            <input className="cmm-search__input" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t('tasks.filters.searchPlaceholder')} aria-label={t('tasks.filters.search')} enterKeyHint="search" />
          </div>
          <select className="cmm-input cmm-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t('tasks.filters.status')}>
            <option value="">{t('tasks.filters.allStatuses')}</option>
            {states('task').map((value) => <option key={value} value={value}>{t(`states.task.${value}`, { defaultValue: value })}</option>)}
          </select>
        </form>
      )}
      <MobileListState
        loading={list.loading && list.items.length === 0}
        error={list.error}
        empty={list.items.length === 0}
        emptyTitle={t(scope === 'mine' ? 'tasks.emptyTitle' : 'tasks.filters.emptyTitle')}
        emptyBody={t(scope === 'mine' ? 'tasks.emptyBody' : 'tasks.filters.emptyBody')}
        emptyAction={findWork}
        onRetry={list.retryable ? () => void list.reload() : undefined}
      >
        <div className="cmm-stack-tight" role="list" aria-label={t('nav.tasks')}>
          {list.items.map((task) => (
            <MobileEntityCard
              key={task.id}
              kicker={task.milestone?.title ? t('marketplace.milestoneLabel', { title: task.milestone.title }) : undefined}
              title={task.title}
              description={task.description}
              badge={<MobileStatusBadge group="task" status={task.status} />}
              meta={[
                task.due_date && <><CalendarDays aria-hidden="true" />{t('tasks.due', { date: format.date(task.due_date) })}</>,
                task.budget_allocation && <><CircleDollarSign aria-hidden="true" /><span className="cmm-entity__money">{format.money(task.budget_allocation, currency)}</span></>,
                task.priority && <><Flag aria-hidden="true" />{t(`projectDetail.priorities.${task.priority}`, { defaultValue: task.priority })}</>,
              ]}
              hint={t(`tasks.statusHint.${task.status}`, { defaultValue: '' }) || undefined}
              onClick={() => openTask(task.id)}
            />
          ))}
        </div>
        <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(page) => void list.load(page)} />
      </MobileListState>
      {openId !== null && <MobileTaskSheet key={openId} taskId={openId} onClose={() => openTask(null)} onChanged={onChanged} />}
    </MobileScreen>
  );
};

export default MobileTasksScreen;
