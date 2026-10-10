import React, { useState } from 'react';
import { CalendarDays, CircleDollarSign, Flag, ListTodo, SlidersHorizontal, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PROTECTED_ROUTE, cmTaskPath } from '../../../components/public-home/cmPublicRoutes';
import { useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmMarketplace, type CmMarketplaceTask } from '../../../shared/useCmMarketplace';
import {
  MobileButton,
  MobileCard,
  MobileField,
  MobileList,
  MobileListRow,
  MobileListState,
  MobileNotice,
  MobilePager,
  MobileScreen,
  MobileSheet,
  MobileStatusBadge,
  useMobileFeedback,
} from '../../ui';

/** Mobile marketplace: search bar, filters in a bottom sheet, task rows, details and atomic accept in a sheet. */
const MobileMarketplaceScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const market = useCmMarketplace(feedback);
  const { list, currency, canAccept, draft, setDraft, budgetInvalid, filtersActive, acceptingId, acceptedId } = market;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<CmMarketplaceTask | null>(null);
  const [confirming, setConfirming] = useState(false);

  const closeTask = (): void => {
    setSelected(null);
    setConfirming(false);
  };
  const submitSearch = (event: React.FormEvent): void => {
    event.preventDefault();
    market.applyFilters();
  };
  const applyFromSheet = (): void => {
    market.applyFilters();
    setFiltersOpen(false);
  };
  const acceptSelected = async (): Promise<void> => {
    if (!selected) return;
    const accepted = await market.accept(selected);
    if (accepted) closeTask();
    else setConfirming(false);
  };

  return (
    <MobileScreen title={t('nav.marketplace')} onRefresh={() => list.reload()}>
      <form className="cmm-search" onSubmit={submitSearch} role="search">
        <Search aria-hidden="true" />
        <input
          className="cmm-search__input"
          value={market.keyword}
          onChange={(event) => market.setKeyword(event.target.value)}
          placeholder={t('marketplace.searchPlaceholder')}
          aria-label={t('marketplace.searchLabel')}
          enterKeyHint="search"
        />
        <button type="button" className={`cmm-icon-btn ${filtersActive ? 'is-active' : ''}`} onClick={() => setFiltersOpen(true)} aria-label={t('mobile.marketplace.filters')}>
          <SlidersHorizontal aria-hidden="true" />
        </button>
      </form>
      {filtersActive && (
        <div className="cmm-active-filters">
          <span>{t('mobile.marketplace.filters')}</span>
          <button type="button" className="cmm-link-btn" onClick={market.resetFilters}><X aria-hidden="true" /> {t('marketplace.clearFilters')}</button>
        </div>
      )}
      {!canAccept && (
        <MobileNotice action={<Link to={`${CM_PROTECTED_ROUTE.wallet}?tab=deposits`} className="cmm-link-btn">{t('marketplace.developerRequiredAction')}</Link>}>
          {t('marketplace.developerRequired')}
        </MobileNotice>
      )}
      {acceptedId !== null && (
        <MobileButton block to={cmTaskPath(acceptedId)} icon={<ListTodo aria-hidden="true" />}>{t('marketplace.openAccepted')}</MobileButton>
      )}
      <MobileListState
        loading={list.loading && list.items.length === 0}
        error={list.error}
        empty={list.items.length === 0}
        emptyTitle={filtersActive ? t('marketplace.noMatchTitle') : t('marketplace.emptyTitle')}
        emptyBody={filtersActive ? t('marketplace.noMatchBody') : t('marketplace.emptyBody')}
        emptyAction={filtersActive ? <MobileButton onClick={market.resetFilters}>{t('marketplace.clearFilters')}</MobileButton> : undefined}
        onRetry={list.retryable ? () => void list.reload() : undefined}
      >
        <MobileList label={t('nav.marketplace')}>
          {list.items.map((task) => (
            <MobileListRow
              key={task.id}
              title={task.title}
              subtitle={task.milestone?.title ? t('marketplace.milestoneLabel', { title: task.milestone.title }) : undefined}
              meta={[
                task.budget_allocation ? format.money(task.budget_allocation, currency) : null,
                task.due_date ? t('tasks.due', { date: format.date(task.due_date) }) : null,
              ].filter(Boolean).join(' · ') || undefined}
              trailing={<MobileStatusBadge group="task" status={task.status} />}
              onClick={() => setSelected(task)}
              chevron
            />
          ))}
        </MobileList>
        <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(page) => void list.load(page)} />
      </MobileListState>

      <MobileSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('mobile.marketplace.filtersTitle')}
        footer={(
          <>
            <MobileButton onClick={() => { market.resetFilters(); setFiltersOpen(false); }}>{t('marketplace.clearFilters')}</MobileButton>
            <MobileButton variant="primary" disabled={budgetInvalid} onClick={applyFromSheet}>{t('mobile.marketplace.showResults')}</MobileButton>
          </>
        )}
      >
        <MobileField label={t('marketplace.skillsLabel')}>
          <input className="cmm-input" value={draft.skills} onChange={(event) => setDraft((current) => ({ ...current, skills: event.target.value }))} placeholder={t('marketplace.skillsPlaceholder')} />
        </MobileField>
        <div className="cmm-field-pair">
          <MobileField label={t('marketplace.minBudget')} error={budgetInvalid && t('marketplace.budgetRangeInvalid')}>
            <input className="cmm-input" type="number" min={0} inputMode="decimal" value={draft.minBudget} onChange={(event) => setDraft((current) => ({ ...current, minBudget: event.target.value }))} aria-invalid={budgetInvalid} />
          </MobileField>
          <MobileField label={t('marketplace.maxBudget')}>
            <input className="cmm-input" type="number" min={0} inputMode="decimal" value={draft.maxBudget} onChange={(event) => setDraft((current) => ({ ...current, maxBudget: event.target.value }))} aria-invalid={budgetInvalid} />
          </MobileField>
        </div>
      </MobileSheet>

      <MobileSheet
        open={selected !== null}
        onClose={closeTask}
        title={t('mobile.marketplace.taskDetails')}
        footer={selected && canAccept ? (
          confirming ? (
            <>
              <MobileButton disabled={acceptingId !== null} onClick={() => setConfirming(false)}>{t('common.cancel')}</MobileButton>
              <MobileButton variant="primary" loading={acceptingId === selected.id} onClick={() => void acceptSelected()}>{acceptingId === selected.id ? t('marketplace.accepting') : t('common.confirm')}</MobileButton>
            </>
          ) : (
            <MobileButton variant="primary" block onClick={() => setConfirming(true)}>{t('marketplace.accept')}</MobileButton>
          )
        ) : undefined}
      >
        {selected && (
          <MobileCard flush className="cmm-task-detail">
            <h3>{selected.title}</h3>
            {selected.milestone?.title && <small className="cmm-muted">{t('marketplace.milestoneLabel', { title: selected.milestone.title })}</small>}
            <p>{selected.description}</p>
            <ul className="cmm-facts">
              <li><MobileStatusBadge group="task" status={selected.status} /></li>
              {selected.budget_allocation && <li><CircleDollarSign aria-hidden="true" /> {format.money(selected.budget_allocation, currency)}</li>}
              {selected.due_date && <li><CalendarDays aria-hidden="true" /> {t('tasks.due', { date: format.date(selected.due_date) })}</li>}
              {selected.priority && <li><Flag aria-hidden="true" /> {t(`projectDetail.priorities.${selected.priority}`, { defaultValue: selected.priority })}</li>}
            </ul>
            {(selected.required_skills ?? []).length > 0 && (
              <ul className="cmm-tags" aria-label={t('marketplace.skillsLabel')}>
                {(selected.required_skills ?? []).map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            )}
            {confirming && <MobileNotice>{t('marketplace.acceptConfirm', { title: selected.title })}</MobileNotice>}
          </MobileCard>
        )}
      </MobileSheet>
    </MobileScreen>
  );
};

export default MobileMarketplaceScreen;
