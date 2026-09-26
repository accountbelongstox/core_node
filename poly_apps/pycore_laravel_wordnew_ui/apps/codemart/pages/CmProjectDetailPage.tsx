import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Pencil, Plus, RefreshCw, Send } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProjectDetail } from '../api/CmApiTypes';
import { cmErrorCode, cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmMilestoneCard } from '../components/workspace/CmMilestoneCard';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmProjectAnalysisPanel } from '../components/workspace/CmProjectAnalysisPanel';
import { CmProjectAttachments } from '../components/workspace/CmProjectAttachments';
import { CmProjectFundPanel } from '../components/workspace/CmProjectFundPanel';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { CmTransitionBar } from '../components/workspace/CmTransitionBar';
import { cmJoinList, cmShortDate, cmSplitList, useCmFormat } from '../components/workspace/cmWorkspaceFormat';

const COMPLEXITIES = ['simple', 'medium', 'complex', 'very_complex'] as const;
const OWNER_ROLE = 'owner';
const FUNDING_PENDING_STATUS = 'funding_pending';
const PUBLISHABLE_STATUSES = new Set(['open', 'in_progress']);
const CLOSED_STATUSES = new Set(['completed', 'cancelled', 'archived']);
const SCOPE_EDITABLE_STATUSES = new Set(['draft', 'proposal_review']);
const STACK_FIELDS = ['skills', 'languages', 'frameworks', 'databases'] as const;
const MIN_BUDGET = 100;
const NOT_FOUND_STATUS = 404;

type CmStackField = typeof STACK_FIELDS[number];

const CmProjectEditForm: React.FC<{ project: CmProjectDetail; onSaved: () => Promise<void> }> = ({ project, onSaved }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const scopeEditable = SCOPE_EDITABLE_STATUSES.has(project.status);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [complexity, setComplexity] = useState(project.complexity ?? 'medium');
  const [budget, setBudget] = useState(project.budget ?? '');
  const [startDate, setStartDate] = useState(cmShortDate(project.start_date));
  const [endDate, setEndDate] = useState(cmShortDate(project.end_date));
  const [stack, setStack] = useState<Record<CmStackField, string>>({
    skills: cmJoinList(project.skills),
    languages: cmJoinList(project.languages),
    frameworks: cmJoinList(project.frameworks),
    databases: cmJoinList(project.databases),
  });
  const [busy, setBusy] = useState(false);

  const invalid = !title.trim() || !description.trim()
    || (scopeEditable && (!budget || Number(budget) < MIN_BUDGET))
    || (scopeEditable && startDate !== '' && endDate !== '' && endDate <= startDate);

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || invalid) return;
    setBusy(true);
    notice.clear();
    const payload: Record<string, unknown> = { title: title.trim(), description: description.trim() };
    if (scopeEditable) {
      payload.complexity = complexity;
      payload.budget = Number(budget);
      payload.start_date = startDate || null;
      payload.end_date = endDate || null;
      STACK_FIELDS.forEach((field) => {
        payload[field] = cmSplitList(stack[field]);
      });
    }
    const response = await cmApi.updateProject(project.id, payload);
    setBusy(false);
    if (response.success) {
      notice.success(t('projectDetail.saved'));
      await onSaved();
    } else {
      notice.error(cmErrorMessage(t, response, 'projectDetail.saveFailed'));
    }
  };

  return (
    <form className="cm-project-form" onSubmit={(event) => void save(event)} noValidate>
      {!scopeEditable && <p className="cm-field-hint is-wide">{t('projectDetail.scopeLocked')}</p>}
      <label className="is-wide">
        <span>{t('projectCreate.projectTitle')}</span>
        <input value={title} maxLength={255} onChange={(event) => setTitle(event.target.value)} aria-invalid={!title.trim()} />
        {!title.trim() && <small className="cm-field-error">{t('projectCreate.errors.titleRequired')}</small>}
      </label>
      <label className="is-wide">
        <span>{t('projectCreate.summary')}</span>
        <textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} aria-invalid={!description.trim()} />
        {!description.trim() && <small className="cm-field-error">{t('projectCreate.errors.descriptionRequired')}</small>}
      </label>
      {scopeEditable && (
        <>
          <label>
            <span>{t('projectCreate.budget')}</span>
            <input type="number" min={MIN_BUDGET} step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} aria-invalid={!budget || Number(budget) < MIN_BUDGET} />
            {(!budget || Number(budget) < MIN_BUDGET) && <small className="cm-field-error">{t('projectCreate.errors.budgetMin', { amount: MIN_BUDGET, currency: project.currency ?? '' })}</small>}
          </label>
          <label>
            <span>{t('projectCreate.complexity')}</span>
            <select value={complexity} onChange={(event) => setComplexity(event.target.value)}>
              {COMPLEXITIES.map((value) => (
                <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('projectCreate.startDate')}</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <span>{t('projectCreate.endDate')}</span>
            <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
            {startDate !== '' && endDate !== '' && endDate <= startDate && <small className="cm-field-error">{t('projectCreate.errors.endAfterStart')}</small>}
          </label>
          {STACK_FIELDS.map((field) => (
            <label key={field}>
              <span>{t(`projectCreate.${field}`)}</span>
              <input
                value={stack[field]}
                onChange={(event) => setStack((current) => ({ ...current, [field]: event.target.value }))}
                placeholder={t('projectCreate.listPlaceholder')}
              />
            </label>
          ))}
        </>
      )}
      {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
      <div className="cm-project-form__actions">
        <button type="submit" className="is-primary" disabled={busy || invalid}>
          {busy ? t('common.saving') : t('projectDetail.saveChanges')}
        </button>
      </div>
    </form>
  );
};

const CmMilestoneCreateForm: React.FC<{ projectId: number; onCreated: () => Promise<void> }> = ({ projectId, onCreated }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [budget, setBudget] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    title: !title.trim() ? t('milestones.errors.titleRequired') : null,
    dueDate: !dueDate ? t('milestones.errors.dueDateRequired') : null,
    budget: budget === '' || Number(budget) < 0 ? t('milestones.errors.budgetRequired') : null,
  };
  const invalid = Object.values(errors).some((value) => value !== null);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (busy || invalid) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.createMilestone(projectId, {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate,
      budget: Number(budget),
      deliverables: deliverables.split('\n').map((item) => item.trim()).filter((item) => item !== ''),
    });
    setBusy(false);
    if (response.success) {
      setTitle('');
      setDescription('');
      setDueDate('');
      setBudget('');
      setDeliverables('');
      setSubmitted(false);
      notice.success(t('projectDetail.milestoneAdded'));
      await onCreated();
    } else {
      notice.error(cmErrorMessage(t, response, 'projectDetail.milestoneFailed'));
    }
  };

  return (
    <form className="cm-project-form" onSubmit={(event) => void submit(event)} noValidate>
      <label className="is-wide">
        <span>{t('projectDetail.milestoneTitle')}</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={submitted && Boolean(errors.title)} />
        {submitted && errors.title && <small className="cm-field-error">{errors.title}</small>}
      </label>
      <label>
        <span>{t('projectDetail.milestoneDueDate')}</span>
        <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-invalid={submitted && Boolean(errors.dueDate)} />
        {submitted && errors.dueDate && <small className="cm-field-error">{errors.dueDate}</small>}
      </label>
      <label>
        <span>{t('projectDetail.milestoneBudget')}</span>
        <input type="number" min={0} step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} aria-invalid={submitted && Boolean(errors.budget)} />
        {submitted && errors.budget && <small className="cm-field-error">{errors.budget}</small>}
      </label>
      <label className="is-wide">
        <span>{t('projectDetail.milestoneDescription')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label className="is-wide">
        <span>{t('milestones.deliverables')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <textarea rows={3} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} placeholder={t('milestones.deliverablesPlaceholder')} />
      </label>
      {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
      <div className="cm-project-form__actions">
        <button type="submit" className="is-primary" disabled={busy}>
          {busy ? t('common.saving') : t('projectDetail.addMilestone')}
        </button>
      </div>
    </form>
  );
};

export const CmProjectDetailPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { projectId } = useParams<{ projectId: string }>();
  const { bootstrap, refresh } = useCmBootstrap();
  const numericId = Number.parseInt(projectId ?? '', 10);
  const notice = useCmNotice();

  const [project, setProject] = useState<CmProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(numericId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const response = await cmApi.getProject(numericId);
    if (response.success && response.data) {
      setProject(response.data);
      setLoadError(null);
      setNotFound(false);
    } else {
      setNotFound(response.status === NOT_FOUND_STATUS || cmErrorCode(response) === 'project_not_found');
      setLoadError(cmErrorMessage(t, response, 'projectDetail.loadFailed'));
    }
    setLoading(false);
  }, [numericId, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const reloadAll = useCallback(async (): Promise<void> => {
    await load();
    await refresh();
  }, [load, refresh]);

  const retry = (): void => {
    setLoading(true);
    void load();
  };

  const backLink = (
    <Link to="/codemart/projects" className="cm-workspace-button">
      <ArrowLeft aria-hidden="true" /> {t('projectDetail.backToList')}
    </Link>
  );

  if (loading || !project) {
    return (
      <main className="cm-workspace-page">
        <CmPageHeader eyebrowKey="projects.eyebrow" titleKey="projectDetail.docTitle" purposeKey="projectDetail.purpose" actions={backLink} />
        {loading ? (
          <CmLoadingState />
        ) : notFound ? (
          <CmEmptyState title={t('projectDetail.notFoundTitle')} body={t('projectDetail.notFoundBody')} action={backLink} />
        ) : (
          <CmErrorState message={loadError ?? t('projectDetail.loadFailed')} onRetry={retry} />
        )}
      </main>
    );
  }

  const access = project.access;
  const isOwner = access?.role === OWNER_ROLE;
  const canManage = access?.can_manage === true;
  const closed = CLOSED_STATUSES.has(project.status);
  const currentUserId = bootstrap?.user.id ?? null;
  const milestones = project.milestones ?? [];
  const nextActionKey = `projects.nextAction.${project.status}`;
  const nextAction = isOwner ? t(nextActionKey, { defaultValue: '' }) : '';
  const architectLabel = project.architect_id
    ? (project.architect_id === currentUserId ? t('projectDetail.architectYou') : t('projectDetail.architectAssigned'))
    : t('projectDetail.unassigned');

  const transition = async (toStatus: string, reason: string): Promise<boolean> => {
    notice.clear();
    const response = await cmApi.transitionProject(project.id, toStatus, reason);
    if (response.success) {
      notice.success(t('transitions.projectDone', { status: t(`states.project.${toStatus}`, { defaultValue: toStatus }) }));
      await reloadAll();
      return true;
    }
    notice.error(cmErrorMessage(t, response, 'transitions.failed'));
    return false;
  };

  const publish = async (): Promise<void> => {
    setBusy(true);
    notice.clear();
    const response = await cmApi.publishProject(project.id);
    setBusy(false);
    if (response.success) {
      notice.success(t('projects.published'));
      await reloadAll();
    } else {
      notice.error(cmErrorMessage(t, response, 'projects.publishFailed'));
    }
  };

  const onSaved = async (): Promise<void> => {
    await load();
  };

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="projects.eyebrow"
        titleKey="projectDetail.docTitle"
        purposeKey="projectDetail.purpose"
        title={project.title}
        purpose={nextAction || t('projectDetail.purpose')}
        actions={(
          <>
            {backLink}
            <button type="button" className="cm-workspace-button" onClick={() => void load()}>
              <RefreshCw aria-hidden="true" /> {t('common.refresh')}
            </button>
          </>
        )}
      />
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {access?.read_only && <CmNotice notice={{ tone: 'info', text: t('projectDetail.readOnly') }} />}

      <section className="cm-section-card">
        <h2><ClipboardList aria-hidden="true" /> {t('projectDetail.overviewTitle')}</h2>
        <p className="cm-project-description">{project.description}</p>
        <dl className="cm-kv">
          <div><dt>{t('projectDetail.statusLabel')}</dt><dd><CmStatusBadge group="project" status={project.status} /></dd></div>
          {access && <div><dt>{t('projectDetail.yourRole')}</dt><dd>{t(`projectDetail.accessRoles.${access.role}`, { defaultValue: access.role })}</dd></div>}
          <div>
            <dt>{t('projectDetail.budgetLabel')}</dt>
            <dd>{project.budget ? format.money(project.budget, project.currency) : t('common.unavailable')}{project.budget_type ? ` · ${t(`projectCreate.budgetTypes.${project.budget_type}`, { defaultValue: project.budget_type })}` : ''}</dd>
          </div>
          {project.complexity && <div><dt>{t('projectCreate.complexity')}</dt><dd>{t(`estimate.complexities.${project.complexity}`, { defaultValue: project.complexity })}</dd></div>}
          <div><dt>{t('projectDetail.architectLabel')}</dt><dd>{architectLabel}</dd></div>
          <div><dt>{t('projectDetail.milestonesLabel')}</dt><dd>{t('projects.milestoneProgress', { done: project.completed_milestones ?? 0, total: project.total_milestones ?? milestones.length })}</dd></div>
          {project.start_date && <div><dt>{t('projectCreate.startDate')}</dt><dd>{format.date(project.start_date)}</dd></div>}
          {project.end_date && <div><dt>{t('projectCreate.endDate')}</dt><dd>{format.date(project.end_date)}</dd></div>}
          {project.created_at && <div><dt>{t('projectDetail.createdAt')}</dt><dd>{format.date(project.created_at)}</dd></div>}
          {project.published_at && <div><dt>{t('projectDetail.publishedAt')}</dt><dd>{format.date(project.published_at)}</dd></div>}
        </dl>
        {STACK_FIELDS.some((field) => (project[field] ?? []).length > 0) && (
          <div className="cm-stack-list">
            {STACK_FIELDS.map((field) => (
              (project[field] ?? []).length > 0 && (
                <div key={field}>
                  <span>{t(`projectCreate.${field}`)}</span>
                  <ul className="cm-chip-list">{(project[field] ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )
            ))}
          </div>
        )}
        {isOwner && ((access?.allowed_transitions ?? []).length > 0 || (PUBLISHABLE_STATUSES.has(project.status) && !project.published_at)) && (
          <div className="cm-section-card__footer">
            <h3>{t('projectDetail.actionsTitle')}</h3>
            {PUBLISHABLE_STATUSES.has(project.status) && !project.published_at && (
              <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void publish()}>
                <Send aria-hidden="true" /> {busy ? t('common.saving') : t('projects.publish')}
              </button>
            )}
            <CmTransitionBar
              transitions={access?.allowed_transitions ?? []}
              labelFor={(toStatus) => t(`transitions.project.${toStatus}`, { defaultValue: toStatus })}
              onConfirm={transition}
            />
          </div>
        )}
      </section>

      {isOwner && project.status === FUNDING_PENDING_STATUS && (
        <CmProjectFundPanel project={project} onFunded={reloadAll} />
      )}

      {canManage && <CmProjectAnalysisPanel project={project} isOwner={isOwner} onProjectChanged={reloadAll} />}

      <section className="cm-section-card">
        <div className="cm-section-card__head">
          <h2>{t('projectDetail.milestonesTitle')}</h2>
          {canManage && !closed && (
            <button type="button" className="cm-workspace-button" onClick={() => setAddingMilestone((value) => !value)} aria-expanded={addingMilestone}>
              <Plus aria-hidden="true" /> {t('projectDetail.addMilestone')}
            </button>
          )}
        </div>
        <p className="cm-section-card__lead">{t('projectDetail.milestonesLead')}</p>
        {canManage && !closed && addingMilestone && (
          <div className="cm-inline-form">
            <h3>{t('projectDetail.addMilestoneTitle')}</h3>
            <CmMilestoneCreateForm projectId={project.id} onCreated={load} />
          </div>
        )}
        {milestones.length === 0 ? (
          <CmEmptyState compact title={canManage && !closed ? t('projectDetail.noMilestones') : t('projectDetail.noMilestonesReadOnly')} />
        ) : (
          <div className="cm-milestone-list">
            {milestones.map((milestone, index) => (
              <CmMilestoneCard
                key={milestone.id}
                index={index + 1}
                milestone={milestone}
                currency={project.currency}
                canManage={canManage && !closed}
                currentUserId={currentUserId}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </section>

      <CmProjectAttachments projectId={project.id} canUpload={canManage} />

      {isOwner && !closed && (
        <section className="cm-section-card">
          <div className="cm-section-card__head">
            <h2>{t('projectDetail.editTitle')}</h2>
            <button type="button" className="cm-workspace-button" onClick={() => { setEditing((value) => !value); setFormKey((key) => key + 1); }} aria-expanded={editing}>
              <Pencil aria-hidden="true" /> {editing ? t('common.cancel') : t('projectDetail.editOpen')}
            </button>
          </div>
          {editing && <CmProjectEditForm key={formKey} project={project} onSaved={onSaved} />}
        </section>
      )}
    </main>
  );
};

export default CmProjectDetailPage;
