import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, FilePlus2, Milestone, RefreshCw, Search } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CM_PROTECTED_ROUTE, cmProjectPath } from '../components/public-home/cmPublicRoutes';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { CM_PROJECT_TITLE_MAX_LENGTH, CM_STACK_FIELDS } from '../shared/cmProjectForm';
import { useCmProjectCreate } from '../shared/useCmProjectCreate';
import { useCmProjectsList } from '../shared/useCmProjectsList';

export const CmProjectsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { hasCapability, states } = useCmBootstrap();
  const canCreate = hasCapability('project.create');
  const { list, status, setStatus, searchDraft, setSearchDraft, filtered, applySearch, clearFilters } = useCmProjectsList();

  const submitSearch = (event: React.FormEvent): void => {
    event.preventDefault();
    applySearch();
  };

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="projects.eyebrow"
        titleKey="nav.myProjects"
        purposeKey="projects.description"
        actions={(
          <>
            <button type="button" className="cm-workspace-button" onClick={() => void list.reload()} disabled={list.loading}>
              <RefreshCw aria-hidden="true" /> {t('common.refresh')}
            </button>
            {canCreate && (
              <Link to={CM_PROTECTED_ROUTE.projectCreate} className="cm-workspace-button is-primary">
                <FilePlus2 aria-hidden="true" /> {t('nav.createProject')}
              </Link>
            )}
          </>
        )}
      />
      <form className="cm-filter-bar" onSubmit={submitSearch}>
        <label className="cm-filter-bar__search">
          <span className="cm-visually-hidden">{t('projects.searchLabel')}</span>
          <Search aria-hidden="true" />
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t('projects.searchPlaceholder')} />
        </label>
        <label>
          <span className="cm-visually-hidden">{t('projects.statusFilter')}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t('projects.allStatuses')}</option>
            {states('project').map((value) => (
              <option key={value} value={value}>{t(`states.project.${value}`)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="cm-workspace-button">{t('projects.searchAction')}</button>
      </form>
      {list.loading ? (
        <CmLoadingState />
      ) : list.error ? (
        <CmErrorState message={list.error} onRetry={list.retryable ? () => void list.reload() : undefined} />
      ) : list.items.length === 0 ? (
        filtered ? (
          <CmEmptyState
            title={t('projects.noMatchTitle')}
            body={t('projects.noMatchBody')}
            action={<button type="button" className="cm-workspace-button" onClick={clearFilters}>{t('marketplace.clearFilters')}</button>}
          />
        ) : (
          <CmEmptyState
            title={t('projects.emptyTitle')}
            body={canCreate ? t('projects.emptyBody') : t('projects.emptyBodyNoCreate')}
            action={canCreate ? <Link to={CM_PROTECTED_ROUTE.projectCreate} className="cm-workspace-button is-primary"><FilePlus2 aria-hidden="true" /> {t('nav.createProject')}</Link> : undefined}
          />
        )
      ) : (
        <section className="cm-card-list" aria-label={t('nav.myProjects')}>
          {list.items.map((project) => (
            <article key={project.id} className="cm-record-card">
              <div className="cm-record-card__main">
                <h2><Link to={cmProjectPath(project.id)} className="cm-record-card__title-link">{project.title}</Link></h2>
                <p>{project.description}</p>
                <div className="cm-record-card__meta">
                  <CmStatusBadge group="project" status={project.status} />
                  {project.budget && <span className="cm-record-card__money">{format.money(project.budget, project.currency)}</span>}
                  {(project.total_milestones ?? 0) > 0 && (
                    <span><Milestone aria-hidden="true" /> {t('projects.milestoneProgress', { done: project.completed_milestones ?? 0, total: project.total_milestones ?? 0 })}</span>
                  )}
                  {project.created_at && <span><CalendarDays aria-hidden="true" /> {t('projects.createdOn', { date: format.date(project.created_at) })}</span>}
                </div>
                <p className="cm-record-card__hint">{t(`projects.nextAction.${project.status}`, { defaultValue: '' })}</p>
              </div>
              <Link to={cmProjectPath(project.id)} className="cm-workspace-button">
                {t('projects.openDetail')} <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>
      )}
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </main>
  );
};

const CmFieldLabel: React.FC<{ label: string; required?: boolean; hint?: string }> = ({ label, required = false, hint }) => {
  const { t } = useTranslation('cm');
  return (
    <span>
      {label}
      {required ? <span className="cm-required" aria-label={t('common.required')}>*</span> : <small className="cm-field-hint">{hint ?? t('common.optional')}</small>}
    </span>
  );
};

export const CmProjectCreatePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const { policyList } = useCmBootstrap();
  const notice = useCmNotice();
  const { form, update, updateStack, errors, showError, submitted, canCreate, pending, currency, projectMinBudget, submit: createProject } = useCmProjectCreate(notice);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const projectId = await createProject();
    if (projectId !== null) navigate(cmProjectPath(projectId));
  };

  return (
    <main className="cm-workspace-page">
      <CmPageHeader eyebrowKey="projects.eyebrow" titleKey="projectCreate.title" purposeKey="projectCreate.subtitle" />
      {!canCreate && <CmNotice notice={{ tone: 'info', text: t('projectCreate.noCapability') }} />}
      <ol className="cm-flow-steps" aria-label={t('projectCreate.flowLabel')}>
        {(['brief', 'analysis', 'escrow', 'delivery'] as const).map((step, index) => (
          <li key={step} className={index === 0 ? 'is-current' : ''}>
            <strong>{index + 1}</strong>
            <span>{t(`projectCreate.flow.${step}`)}</span>
          </li>
        ))}
      </ol>
      <form className="cm-project-form" onSubmit={(event) => void submit(event)} noValidate>
        <label className="is-wide">
          <CmFieldLabel label={t('projectCreate.projectTitle')} required />
          <input value={form.title} maxLength={CM_PROJECT_TITLE_MAX_LENGTH} onChange={(event) => update({ title: event.target.value })} placeholder={t('projectCreate.projectTitlePlaceholder')} aria-invalid={Boolean(showError('title'))} />
          {showError('title') && <small className="cm-field-error">{showError('title')}</small>}
        </label>
        <label className="is-wide">
          <CmFieldLabel label={t('projectCreate.summary')} required />
          <textarea rows={7} value={form.description} onChange={(event) => update({ description: event.target.value })} placeholder={t('projectCreate.summaryPlaceholder')} aria-invalid={Boolean(showError('description'))} />
          {showError('description') ? <small className="cm-field-error">{showError('description')}</small> : <small className="cm-field-hint">{t('projectCreate.summaryHint')}</small>}
        </label>
        <label>
          <CmFieldLabel label={t('projectCreate.budget')} required />
          <input type="number" min={projectMinBudget} step="0.01" inputMode="decimal" value={form.budget} onChange={(event) => update({ budget: event.target.value })} placeholder={t('projectCreate.budgetPlaceholder', { amount: projectMinBudget, currency })} aria-invalid={Boolean(showError('budget'))} />
          {showError('budget') && <small className="cm-field-error">{showError('budget')}</small>}
        </label>
        <label>
          <CmFieldLabel label={t('projectCreate.budgetType')} required />
          <select value={form.budgetType} onChange={(event) => update({ budgetType: event.target.value })}>
            {policyList('budget_types').map((value) => (
              <option key={value} value={value}>{t(`projectCreate.budgetTypes.${value}`)}</option>
            ))}
          </select>
        </label>
        <label>
          <CmFieldLabel label={t('projectCreate.complexity')} required />
          <select value={form.complexity} onChange={(event) => update({ complexity: event.target.value })}>
            {policyList('complexities').map((value) => (
              <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>
            ))}
          </select>
        </label>
        <span className="cm-project-form__spacer" aria-hidden="true" />
        <label>
          <CmFieldLabel label={t('projectCreate.startDate')} />
          <input type="date" value={form.startDate} onChange={(event) => update({ startDate: event.target.value })} />
        </label>
        <label>
          <CmFieldLabel label={t('projectCreate.endDate')} />
          <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => update({ endDate: event.target.value })} aria-invalid={Boolean(showError('endDate'))} />
          {showError('endDate') && <small className="cm-field-error">{showError('endDate')}</small>}
        </label>
        <h2 className="is-wide">{t('projectCreate.stackTitle')}</h2>
        {CM_STACK_FIELDS.map((field) => (
          <label key={field}>
            <CmFieldLabel label={t(`projectCreate.${field}`)} hint={t('projectCreate.listPlaceholder')} />
            <input
              value={form.stack[field]}
              onChange={(event) => updateStack(field, event.target.value)}
              placeholder={t(`projectCreate.placeholders.${field}`)}
            />
          </label>
        ))}
        {(notice.notice || (submitted && Object.keys(errors).length > 0)) && (
          <div className="is-wide">
            <CmNotice notice={notice.notice} onDismiss={notice.clear} />
            {submitted && Object.keys(errors).length > 0 && <CmNotice notice={{ tone: 'error', text: t('projectCreate.errors.fixFields') }} />}
          </div>
        )}
        <div className="cm-project-form__actions">
          <Link to={CM_PROTECTED_ROUTE.projects} className="cm-workspace-button">{t('common.cancel')}</Link>
          <button type="submit" className="is-primary" disabled={!canCreate || pending}>
            {pending ? t('projectCreate.creating') : t('projectCreate.submit')}
          </button>
        </div>
      </form>
    </main>
  );
};

export default CmProjectsPage;
