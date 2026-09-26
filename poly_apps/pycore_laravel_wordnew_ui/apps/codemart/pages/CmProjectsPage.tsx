import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, FilePlus2, Milestone, RefreshCw, Search } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProject } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { cmSplitList, cmTotalPages, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList } from '../components/workspace/useCmPagedList';

const COMPLEXITIES = ['simple', 'medium', 'complex', 'very_complex'] as const;
const BUDGET_TYPES = ['fixed', 'hourly'] as const;
const STACK_FIELDS = ['skills', 'languages', 'frameworks', 'databases'] as const;
const PROJECT_STATUSES = ['draft', 'proposal_review', 'funding_pending', 'open', 'in_progress', 'paused', 'completed', 'cancelled', 'archived'] as const;
const DEFAULT_CURRENCY = 'CNY';
const MIN_BUDGET = 100;
const TITLE_MAX_LENGTH = 255;
const ALL_STATUSES = '';

type CmStackField = typeof STACK_FIELDS[number];
type CmCreateField = 'title' | 'description' | 'budget' | 'endDate';

const extractProjects = (data: { projects: CmProject[]; pagination: unknown }) => ({
  items: Array.isArray(data.projects) ? data.projects : [],
  totalPages: cmTotalPages(data.pagination as Parameters<typeof cmTotalPages>[0]),
});

export const CmProjectsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { hasCapability } = useCmBootstrap();
  const canCreate = hasCapability('project.create');
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

  const applySearch = (event: React.FormEvent): void => {
    event.preventDefault();
    setSearch(searchDraft.trim());
  };

  const clearFilters = (): void => {
    setStatus(ALL_STATUSES);
    setSearch('');
    setSearchDraft('');
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
              <Link to="/codemart/projects/new" className="cm-workspace-button is-primary">
                <FilePlus2 aria-hidden="true" /> {t('nav.createProject')}
              </Link>
            )}
          </>
        )}
      />
      <form className="cm-filter-bar" onSubmit={applySearch}>
        <label className="cm-filter-bar__search">
          <span className="cm-visually-hidden">{t('projects.searchLabel')}</span>
          <Search aria-hidden="true" />
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t('projects.searchPlaceholder')} />
        </label>
        <label>
          <span className="cm-visually-hidden">{t('projects.statusFilter')}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value={ALL_STATUSES}>{t('projects.allStatuses')}</option>
            {PROJECT_STATUSES.map((value) => (
              <option key={value} value={value}>{t(`states.project.${value}`)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="cm-workspace-button">{t('projects.searchAction')}</button>
      </form>
      {list.loading ? (
        <CmLoadingState />
      ) : list.error ? (
        <CmErrorState message={list.error} onRetry={() => void list.reload()} />
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
            action={canCreate ? <Link to="/codemart/projects/new" className="cm-workspace-button is-primary"><FilePlus2 aria-hidden="true" /> {t('nav.createProject')}</Link> : undefined}
          />
        )
      ) : (
        <section className="cm-card-list" aria-label={t('nav.myProjects')}>
          {list.items.map((project) => (
            <article key={project.id} className="cm-record-card">
              <div className="cm-record-card__main">
                <h2><Link to={`/codemart/projects/${project.id}`} className="cm-record-card__title-link">{project.title}</Link></h2>
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
              <Link to={`/codemart/projects/${project.id}`} className="cm-workspace-button">
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
  const { bootstrap, hasCapability, refresh } = useCmBootstrap();
  const notice = useCmNotice();
  const canCreate = hasCapability('project.create');
  const currency = bootstrap?.vocabulary.policy.currency ?? DEFAULT_CURRENCY;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [complexity, setComplexity] = useState('medium');
  const [budget, setBudget] = useState('');
  const [budgetType, setBudgetType] = useState<string>('fixed');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stack, setStack] = useState<Record<CmStackField, string>>({ skills: '', languages: '', frameworks: '', databases: '' });
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const errors: Partial<Record<CmCreateField, string>> = {};
  if (!title.trim()) errors.title = t('projectCreate.errors.titleRequired');
  else if (title.length > TITLE_MAX_LENGTH) errors.title = t('projectCreate.errors.titleTooLong', { max: TITLE_MAX_LENGTH });
  if (!description.trim()) errors.description = t('projectCreate.errors.descriptionRequired');
  if (!budget || Number(budget) < MIN_BUDGET) errors.budget = t('projectCreate.errors.budgetMin', { amount: MIN_BUDGET, currency });
  if (startDate && endDate && endDate <= startDate) errors.endDate = t('projectCreate.errors.endAfterStart');
  const showError = (field: CmCreateField): string | undefined => (submitted ? errors[field] : undefined);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (!canCreate || pending || Object.keys(errors).length > 0) return;
    setPending(true);
    notice.clear();
    const response = await cmApi.createProject({
      title: title.trim(),
      description: description.trim(),
      complexity,
      budget: Number(budget),
      budget_type: budgetType,
      currency,
      start_date: startDate || null,
      end_date: endDate || null,
      skills: cmSplitList(stack.skills),
      languages: cmSplitList(stack.languages),
      frameworks: cmSplitList(stack.frameworks),
      databases: cmSplitList(stack.databases),
    });
    setPending(false);
    if (response.success && response.data) {
      await refresh();
      navigate(`/codemart/projects/${response.data.id}`);
      return;
    }
    notice.error(cmErrorMessage(t, response, 'projectCreate.createFailed'));
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
          <input value={title} maxLength={TITLE_MAX_LENGTH} onChange={(event) => setTitle(event.target.value)} placeholder={t('projectCreate.projectTitlePlaceholder')} aria-invalid={Boolean(showError('title'))} />
          {showError('title') && <small className="cm-field-error">{showError('title')}</small>}
        </label>
        <label className="is-wide">
          <CmFieldLabel label={t('projectCreate.summary')} required />
          <textarea rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('projectCreate.summaryPlaceholder')} aria-invalid={Boolean(showError('description'))} />
          {showError('description') ? <small className="cm-field-error">{showError('description')}</small> : <small className="cm-field-hint">{t('projectCreate.summaryHint')}</small>}
        </label>
        <label>
          <CmFieldLabel label={t('projectCreate.budget')} required />
          <input type="number" min={MIN_BUDGET} step="0.01" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder={t('projectCreate.budgetPlaceholder', { amount: MIN_BUDGET, currency })} aria-invalid={Boolean(showError('budget'))} />
          {showError('budget') && <small className="cm-field-error">{showError('budget')}</small>}
        </label>
        <label>
          <CmFieldLabel label={t('projectCreate.budgetType')} required />
          <select value={budgetType} onChange={(event) => setBudgetType(event.target.value)}>
            {BUDGET_TYPES.map((value) => (
              <option key={value} value={value}>{t(`projectCreate.budgetTypes.${value}`)}</option>
            ))}
          </select>
        </label>
        <label>
          <CmFieldLabel label={t('projectCreate.complexity')} required />
          <select value={complexity} onChange={(event) => setComplexity(event.target.value)}>
            {COMPLEXITIES.map((value) => (
              <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>
            ))}
          </select>
        </label>
        <span className="cm-project-form__spacer" aria-hidden="true" />
        <label>
          <CmFieldLabel label={t('projectCreate.startDate')} />
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          <CmFieldLabel label={t('projectCreate.endDate')} />
          <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} aria-invalid={Boolean(showError('endDate'))} />
          {showError('endDate') && <small className="cm-field-error">{showError('endDate')}</small>}
        </label>
        <h2 className="is-wide">{t('projectCreate.stackTitle')}</h2>
        {STACK_FIELDS.map((field) => (
          <label key={field}>
            <CmFieldLabel label={t(`projectCreate.${field}`)} hint={t('projectCreate.listPlaceholder')} />
            <input
              value={stack[field]}
              onChange={(event) => setStack((current) => ({ ...current, [field]: event.target.value }))}
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
          <Link to="/codemart/projects" className="cm-workspace-button">{t('common.cancel')}</Link>
          <button type="submit" className="is-primary" disabled={!canCreate || pending}>
            {pending ? t('projectCreate.creating') : t('projectCreate.submit')}
          </button>
        </div>
      </form>
    </main>
  );
};

export default CmProjectsPage;
