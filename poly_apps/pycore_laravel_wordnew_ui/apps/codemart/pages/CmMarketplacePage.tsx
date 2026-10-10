import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CircleDollarSign, Flag, Layers, ListTodo, RefreshCw, Search, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { cmTaskPath, CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmMarketplace, type CmMarketplaceTask } from '../shared/useCmMarketplace';

export const CmMarketplacePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const {
    list, currency, canAccept, keyword, setKeyword, draft, setDraft, budgetInvalid, filtersActive,
    applyFilters, resetFilters, acceptingId, acceptedId, accept,
  } = useCmMarketplace(notice);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const submitFilters = (event: React.FormEvent): void => {
    event.preventDefault();
    applyFilters();
  };

  const acceptTask = async (task: CmMarketplaceTask): Promise<void> => {
    await accept(task);
    setConfirmingId(null);
  };

  const visibleTasks = list.items;

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
      <form className="cm-marketplace-toolbar" onSubmit={submitFilters}>
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
      {!canAccept && (
        <div className="cm-inline-action">
          <CmNotice notice={{ tone: 'info', text: t('marketplace.developerRequired') }} />
          <Link to={`${CM_PROTECTED_ROUTE.wallet}?tab=deposits`} className="cm-workspace-button">
            <CircleDollarSign aria-hidden="true" /> {t('marketplace.developerRequiredAction')}
          </Link>
        </div>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {acceptedId !== null && (
        <p className="cm-inline-action">
          <Link to={cmTaskPath(acceptedId)} className="cm-workspace-button"><ListTodo aria-hidden="true" /> {t('marketplace.openAccepted')}</Link>
        </p>
      )}
      {list.loading ? (
        <CmLoadingState />
      ) : list.error ? (
        <CmErrorState message={list.error} onRetry={list.retryable ? () => void list.reload() : undefined} />
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
                confirmingId === task.id ? (
                  <div className="cm-table-actions">
                    <span className="cm-confirm-inline">{t('marketplace.acceptConfirm', { title: task.title })}</span>
                    <button
                      type="button"
                      className="cm-workspace-button is-primary"
                      disabled={acceptingId !== null}
                      onClick={() => void acceptTask(task)}
                    >
                      {acceptingId === task.id ? t('marketplace.accepting') : t('common.confirm')}
                    </button>
                    <button type="button" className="cm-workspace-button" disabled={acceptingId !== null} onClick={() => setConfirmingId(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="cm-workspace-button is-primary"
                    disabled={acceptingId !== null}
                    onClick={() => setConfirmingId(task.id)}
                  >
                    {t('marketplace.accept')}
                  </button>
                )
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
