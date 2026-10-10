import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Pencil, Plus, RefreshCw, Send } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { CmProjectDetail } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmMilestoneCard } from '../components/workspace/CmMilestoneCard';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmProjectAnalysisPanel } from '../components/workspace/CmProjectAnalysisPanel';
import { CmProjectAttachments } from '../components/workspace/CmProjectAttachments';
import { CmProjectFundPanel } from '../components/workspace/CmProjectFundPanel';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { CmTransitionBar } from '../components/workspace/CmTransitionBar';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { CM_STACK_FIELDS } from '../shared/cmProjectForm';
import { useCmMilestoneForm } from '../shared/useCmMilestones';
import { CM_FUNDING_PENDING_STATUS, useCmProjectDetail } from '../shared/useCmProjectDetail';
import { useCmProjectEdit } from '../shared/useCmProjectEdit';

const CmProjectEditForm: React.FC<{ project: CmProjectDetail; onSaved: () => Promise<void> }> = ({ project, onSaved }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const { policyList } = useCmBootstrap();
  const edit = useCmProjectEdit(project, onSaved, notice);
  const { scopeEditable, projectMinBudget } = edit;

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    await edit.save();
  };

  return (
    <form className="cm-project-form" onSubmit={(event) => void save(event)} noValidate>
      {!scopeEditable && <p className="cm-field-hint is-wide">{t('projectDetail.scopeLocked')}</p>}
      <label className="is-wide">
        <span>{t('projectCreate.projectTitle')}</span>
        <input value={edit.title} maxLength={255} onChange={(event) => edit.setTitle(event.target.value)} aria-invalid={!edit.title.trim()} />
        {!edit.title.trim() && <small className="cm-field-error">{t('projectCreate.errors.titleRequired')}</small>}
      </label>
      <label className="is-wide">
        <span>{t('projectCreate.summary')}</span>
        <textarea rows={5} value={edit.description} onChange={(event) => edit.setDescription(event.target.value)} aria-invalid={!edit.description.trim()} />
        {!edit.description.trim() && <small className="cm-field-error">{t('projectCreate.errors.descriptionRequired')}</small>}
      </label>
      {scopeEditable && (
        <>
          <label>
            <span>{t('projectCreate.budget')}</span>
            <input type="number" min={projectMinBudget} step="0.01" value={edit.budget} onChange={(event) => edit.setBudget(event.target.value)} aria-invalid={edit.budgetInvalid} />
            {edit.budgetInvalid && <small className="cm-field-error">{t('projectCreate.errors.budgetMin', { amount: projectMinBudget, currency: project.currency ?? '' })}</small>}
          </label>
          <label>
            <span>{t('projectCreate.complexity')}</span>
            <select value={edit.complexity} onChange={(event) => edit.setComplexity(event.target.value)}>
              {policyList('complexities').map((value) => (
                <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('projectCreate.startDate')}</span>
            <input type="date" value={edit.startDate} onChange={(event) => edit.setStartDate(event.target.value)} />
          </label>
          <label>
            <span>{t('projectCreate.endDate')}</span>
            <input type="date" value={edit.endDate} min={edit.startDate || undefined} onChange={(event) => edit.setEndDate(event.target.value)} />
            {edit.endInvalid && <small className="cm-field-error">{t('projectCreate.errors.endAfterStart')}</small>}
          </label>
          {CM_STACK_FIELDS.map((field) => (
            <label key={field}>
              <span>{t(`projectCreate.${field}`)}</span>
              <input
                value={edit.stack[field]}
                onChange={(event) => edit.setStackField(field, event.target.value)}
                placeholder={t('projectCreate.listPlaceholder')}
              />
            </label>
          ))}
        </>
      )}
      {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
      <div className="cm-project-form__actions">
        <button type="submit" className="is-primary" disabled={edit.busy || edit.invalid}>
          {edit.busy ? t('common.saving') : t('projectDetail.saveChanges')}
        </button>
      </div>
    </form>
  );
};

const CmMilestoneCreateForm: React.FC<{ projectId: number; onCreated: () => Promise<void> }> = ({ projectId, onCreated }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const form = useCmMilestoneForm(projectId, null, onCreated, notice);
  const { errors, submitted } = form;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    await form.submit();
  };

  return (
    <form className="cm-project-form" onSubmit={(event) => void submit(event)} noValidate>
      <label className="is-wide">
        <span>{t('projectDetail.milestoneTitle')}</span>
        <input value={form.title} onChange={(event) => form.setTitle(event.target.value)} aria-invalid={submitted && Boolean(errors.title)} />
        {submitted && errors.title && <small className="cm-field-error">{errors.title}</small>}
      </label>
      <label>
        <span>{t('projectDetail.milestoneDueDate')}</span>
        <input type="date" value={form.dueDate} onChange={(event) => form.setDueDate(event.target.value)} aria-invalid={submitted && Boolean(errors.dueDate)} />
        {submitted && errors.dueDate && <small className="cm-field-error">{errors.dueDate}</small>}
      </label>
      <label>
        <span>{t('projectDetail.milestoneBudget')}</span>
        <input type="number" min={0} step="0.01" value={form.budget} onChange={(event) => form.setBudget(event.target.value)} aria-invalid={submitted && Boolean(errors.budget)} />
        {submitted && errors.budget && <small className="cm-field-error">{errors.budget}</small>}
      </label>
      <label className="is-wide">
        <span>{t('projectDetail.milestoneDescription')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <textarea rows={3} value={form.description} onChange={(event) => form.setDescription(event.target.value)} />
      </label>
      <label className="is-wide">
        <span>{t('milestones.deliverables')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <textarea rows={3} value={form.deliverables} onChange={(event) => form.setDeliverables(event.target.value)} placeholder={t('milestones.deliverablesPlaceholder')} />
      </label>
      {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
      <div className="cm-project-form__actions">
        <button type="submit" className="is-primary" disabled={form.busy}>
          {form.busy ? t('common.saving') : t('projectDetail.addMilestone')}
        </button>
      </div>
    </form>
  );
};

export const CmProjectDetailPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { projectId } = useParams<{ projectId: string }>();
  const numericId = Number.parseInt(projectId ?? '', 10);
  const notice = useCmNotice();
  const detail = useCmProjectDetail(numericId, notice);
  const { project, loading, load, reloadAll, isOwner, canManage, closed, publishable, currentUserId, milestones, nextAction, architectLabel } = detail;

  const [editing, setEditing] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const backLink = (
    <Link to={CM_PROTECTED_ROUTE.projects} className="cm-workspace-button">
      <ArrowLeft aria-hidden="true" /> {t('projectDetail.backToList')}
    </Link>
  );

  if (loading || !project) {
    return (
      <main className="cm-workspace-page">
        <CmPageHeader eyebrowKey="projects.eyebrow" titleKey="projectDetail.docTitle" purposeKey="projectDetail.purpose" actions={backLink} />
        {loading ? (
          <CmLoadingState />
        ) : detail.notFound ? (
          <CmEmptyState title={t('projectDetail.notFoundTitle')} body={t('projectDetail.notFoundBody')} action={backLink} />
        ) : detail.forbidden ? (
          <CmEmptyState title={t('projectDetail.noAccessTitle')} body={t('projectDetail.noAccessBody')} action={backLink} />
        ) : (
          <CmErrorState message={detail.loadError ?? t('projectDetail.loadFailed')} onRetry={detail.retry} />
        )}
      </main>
    );
  }

  const access = project.access;

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
      {detail.readOnly && <CmNotice notice={{ tone: 'info', text: t('projectDetail.readOnly') }} />}

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
        {CM_STACK_FIELDS.some((field) => (project[field] ?? []).length > 0) && (
          <div className="cm-stack-list">
            {CM_STACK_FIELDS.map((field) => (
              (project[field] ?? []).length > 0 && (
                <div key={field}>
                  <span>{t(`projectCreate.${field}`)}</span>
                  <ul className="cm-chip-list">{(project[field] ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )
            ))}
          </div>
        )}
        {isOwner && ((access?.allowed_transitions ?? []).length > 0 || publishable) && (
          <div className="cm-section-card__footer">
            <h3>{t('projectDetail.actionsTitle')}</h3>
            {publishable && (
              <button type="button" className="cm-workspace-button is-primary" disabled={detail.publishing} onClick={() => void detail.publish()}>
                <Send aria-hidden="true" /> {detail.publishing ? t('common.saving') : t('projects.publish')}
              </button>
            )}
            <CmTransitionBar
              transitions={access?.allowed_transitions ?? []}
              labelFor={(toStatus) => t(`transitions.project.${toStatus}`, { defaultValue: toStatus })}
              onConfirm={detail.transition}
            />
          </div>
        )}
      </section>

      {isOwner && project.status === CM_FUNDING_PENDING_STATUS && (
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
          {editing && <CmProjectEditForm key={formKey} project={project} onSaved={load} />}
        </section>
      )}
    </main>
  );
};

export default CmProjectDetailPage;
