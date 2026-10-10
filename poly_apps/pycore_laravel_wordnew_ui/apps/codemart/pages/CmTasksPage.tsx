import React, { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CircleDollarSign, ExternalLink, Flag, MessageSquare, Pencil, RefreshCw, Search, Send, Store, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { useCmPolicy } from '../contexts/useCmPolicy';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { CmSubmissionsPanel } from '../components/workspace/CmSubmissionsPanel';
import { CmTaskForm } from '../components/workspace/CmMilestoneCard';
import { CmTransitionBar } from '../components/workspace/CmTransitionBar';
import { cmFileAccept, cmUserLabel, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { CM_PROTECTED_ROUTE, CM_TASK_QUERY_PARAM, cmProjectPath } from '../components/public-home/cmPublicRoutes';
import { CM_TASK_SCOPES, useCmMyTasks } from '../shared/useCmMyTasks';
import { CM_TASK_REVIEW_STATUS, useCmTaskDetail, useCmTaskSubmit } from '../shared/useCmTaskDetail';

const CmTaskSubmitForm: React.FC<{ taskId: number; onSubmitted: () => Promise<void> }> = ({ taskId, onSubmitted }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [inputKey, setInputKey] = useState(0);
  const submitModel = useCmTaskSubmit(taskId, onSubmitted, notice);
  const { invalidUrls, rejectedUploads, allowedDocumentTypes, hasContent, canSubmit, busy } = submitModel;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (await submitModel.submit()) setInputKey((key) => key + 1);
  };

  return (
    <form className="cm-drawer__section" onSubmit={(event) => void submit(event)} noValidate>
      <h3><Send aria-hidden="true" /> {t('tasks.submitTitle')}</h3>
      <p className="cm-field-hint">{t('tasks.submitLead')}</p>
      <label className="cm-stacked-field">
        <span>{t('tasks.submissionNote')}</span>
        <textarea rows={4} value={submitModel.note} onChange={(event) => submitModel.setNote(event.target.value)} placeholder={t('tasks.submissionPlaceholder')} />
      </label>
      <label className="cm-stacked-field">
        <span>{t('tasks.fileUrls')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <textarea rows={2} value={submitModel.fileUrls} onChange={(event) => submitModel.setFileUrls(event.target.value)} placeholder={t('tasks.fileUrlsPlaceholder')} aria-invalid={invalidUrls.length > 0} />
        {invalidUrls.length > 0 && <small className="cm-field-error">{t('tasks.invalidUrls', { urls: invalidUrls.join(', ') })}</small>}
      </label>
      <label className="cm-stacked-field">
        <span>{t('tasks.uploads')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <input key={inputKey} type="file" multiple accept={cmFileAccept(allowedDocumentTypes)} onChange={(event) => submitModel.setUploads(Array.from(event.target.files ?? []))} aria-invalid={rejectedUploads.length > 0} />
        {rejectedUploads.length > 0 && <small className="cm-field-error">{t('tasks.uploadWrongType', { files: rejectedUploads.map((file) => file.name).join(', '), types: allowedDocumentTypes.join(', ') })}</small>}
      </label>
      <div className="cm-table-actions">
        <button type="submit" className="cm-workspace-button is-primary" disabled={busy || !canSubmit}>
          {busy ? t('tasks.submitting') : t('tasks.submit')}
        </button>
        {!hasContent && <small className="cm-field-hint">{t('tasks.submitEmptyHint')}</small>}
      </div>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </form>
  );
};

const CmTaskDrawer: React.FC<{ taskId: number; onClose: () => void; onChanged: () => Promise<void> }> = ({ taskId, onClose, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { currency } = useCmPolicy();
  const notice = useCmNotice();
  const detail = useCmTaskDetail(taskId, onChanged, notice);
  const { task, loading, loadError, lastReview, transitionLabel } = detail;
  const [editing, setEditing] = useState(false);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onEdited = async (): Promise<void> => {
    setEditing(false);
    notice.success(t('projectDetail.taskUpdated'));
    await detail.reload();
  };

  const postComment = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    await detail.postComment();
  };

  const comments = task?.comments ?? [];

  return (
    <div className="cm-drawer" role="dialog" aria-modal="true" aria-label={task?.title ?? t('tasks.detailTitle')}>
      <button type="button" className="cm-drawer__backdrop" aria-label={t('common.close')} onClick={onClose} />
      <aside className="cm-drawer__panel">
        <header className="cm-drawer__header">
          <div>
            <small>{t('tasks.detailTitle')}</small>
            <h2>{task?.title ?? t('common.loading')}</h2>
          </div>
          <button type="button" className="cm-workspace-button is-small" onClick={onClose} aria-label={t('common.close')}>
            <X aria-hidden="true" />
          </button>
        </header>
        {loading ? (
          <CmLoadingState compact />
        ) : loadError || !task ? (
          <CmErrorState compact message={loadError ?? t('tasks.loadFailed')} onRetry={detail.loadRetryable ? detail.retry : undefined} />
        ) : (
          <>
            <div className="cm-record-card__meta">
              <CmStatusBadge group="task" status={task.status} />
              {task.priority && <span><Flag aria-hidden="true" /> {t(`projectDetail.priorities.${task.priority}`, { defaultValue: task.priority })}</span>}
              {task.due_date && <span><CalendarDays aria-hidden="true" /> {t('tasks.due', { date: format.date(task.due_date) })}</span>}
              {task.budget_allocation && <span className="cm-record-card__money"><CircleDollarSign aria-hidden="true" /> {format.money(task.budget_allocation, currency)}</span>}
            </div>
            <p className="cm-project-description">{task.description}</p>
            {(task.required_skills ?? []).length > 0 && (
              <ul className="cm-chip-list">{(task.required_skills ?? []).map((skill) => <li key={skill}>{skill}</li>)}</ul>
            )}
            {task.project && (
              <Link className="cm-workspace-link" to={cmProjectPath(task.project.id)}>
                <ExternalLink aria-hidden="true" /> {t('tasks.projectLink', { title: task.project.title })}
              </Link>
            )}
            <p className="cm-drawer__hint">{t(`tasks.statusHint.${task.status}`, { defaultValue: '' })}</p>
            <CmNotice notice={notice.notice} onDismiss={notice.clear} />
            <CmTransitionBar transitions={task.access.allowed_transitions} labelFor={transitionLabel} onConfirm={detail.transition} />
            {task.access.can_edit && (
              <div className="cm-drawer__section">
                <button type="button" className="cm-workspace-button is-small" onClick={() => setEditing((value) => !value)} aria-expanded={editing}>
                  <Pencil aria-hidden="true" /> {editing ? t('common.cancel') : t('projectDetail.editTask')}
                </button>
                {editing && <CmTaskForm key={task.id} milestoneId={task.milestone_id} task={task} onSaved={onEdited} />}
              </div>
            )}
            {lastReview && (
              <div className="cm-drawer__section cm-last-review">
                <h3>{t('tasks.lastReview')}</h3>
                <CmStatusBadge group="submission" status={lastReview.recommendation ?? lastReview.status} />
                <p>{lastReview.review_notes || lastReview.comments}</p>
              </div>
            )}
            {task.access.can_submit && <CmTaskSubmitForm taskId={task.id} onSubmitted={detail.reload} />}
            {!task.access.can_submit && task.status === CM_TASK_REVIEW_STATUS && <CmNotice notice={{ tone: 'info', text: t('tasks.inReview') }} />}
            <CmSubmissionsPanel
              taskId={task.id}
              taskStatus={task.status}
              canReview={detail.canDecide}
              onChanged={detail.reload}
            />
            <form className="cm-drawer__section" onSubmit={(event) => void postComment(event)}>
              <h3><MessageSquare aria-hidden="true" /> {t('tasks.commentTitle')}</h3>
              {comments.length === 0 ? (
                <p className="cm-field-hint">{t('tasks.noComments')}</p>
              ) : (
                <ul className="cm-comment-thread">
                  {comments.map((item) => (
                    <li key={item.id}>
                      <div className="cm-record-card__meta">
                        <strong>{cmUserLabel(item.user, t('common.unavailable'))}</strong>
                        <span>{format.dateTime(item.created_at)}</span>
                      </div>
                      <p>{item.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
              <label className="cm-stacked-field">
                <span className="cm-visually-hidden">{t('tasks.commentLabel')}</span>
                <textarea rows={2} value={detail.comment} onChange={(event) => detail.setComment(event.target.value)} placeholder={t('tasks.commentPlaceholder')} />
              </label>
              <div className="cm-table-actions">
                <button type="submit" className="cm-workspace-button" disabled={detail.commenting || !detail.comment.trim()}>
                  {detail.commenting ? t('common.saving') : t('tasks.commentPost')}
                </button>
              </div>
            </form>
          </>
        )}
      </aside>
    </div>
  );
};

export const CmTasksPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { refresh, states } = useCmBootstrap();
  const { currency } = useCmPolicy();
  const [searchParams, setSearchParams] = useSearchParams();
  const { list, scope, setScope, statusFilter, setStatusFilter, searchDraft, setSearchDraft, applySearch } = useCmMyTasks();
  const selectedId = Number.parseInt(searchParams.get(CM_TASK_QUERY_PARAM) ?? '', 10);

  const openTask = useCallback((taskId: number | null): void => {
    const next = new URLSearchParams(searchParams);
    if (taskId === null) next.delete(CM_TASK_QUERY_PARAM);
    else next.set(CM_TASK_QUERY_PARAM, String(taskId));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const closeTask = useCallback(() => openTask(null), [openTask]);

  const onChanged = useCallback(async (): Promise<void> => {
    await list.reload();
    await refresh();
  }, [list, refresh]);

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="tasks.eyebrow"
        titleKey="nav.tasks"
        purposeKey="tasks.description"
        actions={(
          <>
            <button type="button" className="cm-workspace-button" onClick={() => void list.reload()} disabled={list.loading}>
              <RefreshCw aria-hidden="true" /> {t('common.refresh')}
            </button>
            <Link to={CM_PROTECTED_ROUTE.marketplace} className="cm-workspace-button is-primary"><Store aria-hidden="true" /> {t('tasks.findWork')}</Link>
          </>
        )}
      />
      <nav className="cm-tabs cm-tabs--inline" role="tablist" aria-label={t('tasks.scope.label')}>
        {CM_TASK_SCOPES.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={scope === item} className={scope === item ? 'is-active' : ''} onClick={() => setScope(item)}>
            {t(`tasks.scope.${item}`)}
          </button>
        ))}
      </nav>
      {scope === 'visible' && (
        <form className="cm-marketplace-toolbar" onSubmit={(event) => { event.preventDefault(); applySearch(); }}>
          <label>
            <span>{t('tasks.filters.search')}</span>
            <div>
              <Search aria-hidden="true" />
              <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t('tasks.filters.searchPlaceholder')} />
            </div>
          </label>
          <label>
            <span>{t('tasks.filters.status')}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">{t('tasks.filters.allStatuses')}</option>
              {states('task').map((value) => <option key={value} value={value}>{t(`states.task.${value}`, { defaultValue: value })}</option>)}
            </select>
          </label>
          <div className="cm-marketplace-toolbar__actions">
            <button type="submit" className="cm-workspace-button is-primary" disabled={list.loading}><Search aria-hidden="true" /> {t('tasks.filters.apply')}</button>
          </div>
        </form>
      )}
      {list.loading ? (
        <CmLoadingState />
      ) : list.error ? (
        <CmErrorState message={list.error} onRetry={list.retryable ? () => void list.reload() : undefined} />
      ) : list.items.length === 0 ? (
        <CmEmptyState
          title={t(scope === 'mine' ? 'tasks.emptyTitle' : 'tasks.filters.emptyTitle')}
          body={t(scope === 'mine' ? 'tasks.emptyBody' : 'tasks.filters.emptyBody')}
          action={<Link to={CM_PROTECTED_ROUTE.marketplace} className="cm-workspace-button is-primary"><Store aria-hidden="true" /> {t('tasks.findWork')}</Link>}
        />
      ) : (
        <section className="cm-card-list" aria-label={t('nav.tasks')}>
          {list.items.map((task) => (
            <article key={task.id} className="cm-record-card">
              <div className="cm-record-card__main">
                {task.milestone?.title && <small className="cm-record-card__kicker">{t('marketplace.milestoneLabel', { title: task.milestone.title })}</small>}
                <h2>
                  <button type="button" className="cm-record-card__title-button" onClick={() => openTask(task.id)}>{task.title}</button>
                </h2>
                <p>{task.description}</p>
                <div className="cm-record-card__meta">
                  <CmStatusBadge group="task" status={task.status} />
                  {task.due_date && <span><CalendarDays aria-hidden="true" /> {t('tasks.due', { date: format.date(task.due_date) })}</span>}
                  {task.budget_allocation && <span className="cm-record-card__money">{format.money(task.budget_allocation, currency)}</span>}
                  {task.priority && <span><Flag aria-hidden="true" /> {t(`projectDetail.priorities.${task.priority}`, { defaultValue: task.priority })}</span>}
                </div>
                <p className="cm-record-card__hint">{t(`tasks.statusHint.${task.status}`, { defaultValue: '' })}</p>
              </div>
              <button type="button" className="cm-workspace-button" onClick={() => openTask(task.id)}>
                {t('tasks.openDetail')} <ArrowRight aria-hidden="true" />
              </button>
            </article>
          ))}
        </section>
      )}
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
      {Number.isFinite(selectedId) && selectedId > 0 && (
        <CmTaskDrawer taskId={selectedId} onClose={closeTask} onChanged={onChanged} />
      )}
    </main>
  );
};

export default CmTasksPage;
