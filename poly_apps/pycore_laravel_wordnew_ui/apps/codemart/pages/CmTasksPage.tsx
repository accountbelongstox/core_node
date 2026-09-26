import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CircleDollarSign, ExternalLink, Flag, MessageSquare, RefreshCw, Send, Store, X } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmCodeReview, CmTask, CmTaskDetail } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { CmSubmissionsPanel } from '../components/workspace/CmSubmissionsPanel';
import { CmTransitionBar } from '../components/workspace/CmTransitionBar';
import { cmSplitList, cmTotalPages, cmUserLabel, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList } from '../components/workspace/useCmPagedList';

const TASK_QUERY_PARAM = 'task';
const BLOCKED_STATUS = 'blocked';
const REVIEW_STATUS = 'review';
const IN_PROGRESS_STATUS = 'in_progress';
const MANAGER_ROLE = 'manager';
const URL_PATTERN = /^https?:\/\/\S+$/i;
const DEFAULT_CURRENCY = 'CNY';

interface CmMyTask extends CmTask {
  milestone?: { id: number; project_id: number; title: string } | null;
}

function latestReviewWithNotes(task: CmTaskDetail): CmCodeReview | null {
  for (const submission of task.submissions ?? []) {
    const review = (submission.reviews ?? []).find((item) => item.review_notes || item.comments);
    if (review) return review;
  }
  return null;
}

const CmTaskSubmitForm: React.FC<{ taskId: number; onSubmitted: () => Promise<void> }> = ({ taskId, onSubmitted }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [note, setNote] = useState('');
  const [fileUrls, setFileUrls] = useState('');
  const [uploads, setUploads] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const urls = cmSplitList(fileUrls);
  const invalidUrls = urls.filter((url) => !URL_PATTERN.test(url));
  const hasContent = note.trim() !== '' || urls.length > 0 || uploads.length > 0;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || !hasContent || invalidUrls.length > 0) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.submitTask(taskId, note.trim(), urls, uploads);
    setBusy(false);
    if (response.success) {
      setNote('');
      setFileUrls('');
      setUploads([]);
      setInputKey((key) => key + 1);
      notice.success(t('tasks.submitted'));
      await onSubmitted();
    } else {
      notice.error(cmErrorMessage(t, response, 'tasks.submitFailed'));
    }
  };

  return (
    <form className="cm-drawer__section" onSubmit={(event) => void submit(event)} noValidate>
      <h3><Send aria-hidden="true" /> {t('tasks.submitTitle')}</h3>
      <p className="cm-field-hint">{t('tasks.submitLead')}</p>
      <label className="cm-stacked-field">
        <span>{t('tasks.submissionNote')}</span>
        <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('tasks.submissionPlaceholder')} />
      </label>
      <label className="cm-stacked-field">
        <span>{t('tasks.fileUrls')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <textarea rows={2} value={fileUrls} onChange={(event) => setFileUrls(event.target.value)} placeholder={t('tasks.fileUrlsPlaceholder')} aria-invalid={invalidUrls.length > 0} />
        {invalidUrls.length > 0 && <small className="cm-field-error">{t('tasks.invalidUrls', { urls: invalidUrls.join(', ') })}</small>}
      </label>
      <label className="cm-stacked-field">
        <span>{t('tasks.uploads')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <input key={inputKey} type="file" multiple onChange={(event) => setUploads(Array.from(event.target.files ?? []))} />
      </label>
      <div className="cm-table-actions">
        <button type="submit" className="cm-workspace-button is-primary" disabled={busy || !hasContent || invalidUrls.length > 0}>
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
  const { bootstrap } = useCmBootstrap();
  const currency = bootstrap?.vocabulary.policy.currency ?? DEFAULT_CURRENCY;
  const notice = useCmNotice();
  const [task, setTask] = useState<CmTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const response = await cmApi.getTask(taskId);
    if (response.success && response.data) {
      setTask(response.data);
      setLoadError(null);
    } else {
      setLoadError(cmErrorMessage(t, response, 'tasks.loadFailed'));
    }
    setLoading(false);
  }, [taskId, t]);

  useEffect(() => {
    setLoading(true);
    setTask(null);
    notice.clear();
    void load();
  }, [load, notice.clear]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reload = async (): Promise<void> => {
    await load();
    await onChanged();
  };

  const transition = async (toStatus: string, reason: string): Promise<boolean> => {
    notice.clear();
    const response = await cmApi.transitionTask(taskId, toStatus, reason);
    if (response.success) {
      notice.success(t('transitions.taskDone', { status: t(`states.task.${toStatus}`, { defaultValue: toStatus }) }));
      await reload();
      return true;
    }
    notice.error(cmErrorMessage(t, response, 'transitions.failed'));
    return false;
  };

  const postComment = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!comment.trim() || busy) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.addTaskComment(taskId, comment.trim());
    setBusy(false);
    if (response.success) {
      setComment('');
      await load();
    } else {
      notice.error(cmErrorMessage(t, response, 'tasks.commentFailed'));
    }
  };

  const lastReview = task ? latestReviewWithNotes(task) : null;
  const transitionLabel = (toStatus: string): string => (
    task?.status === BLOCKED_STATUS && toStatus === IN_PROGRESS_STATUS
      ? t('transitions.task.unblock')
      : t(`transitions.task.${toStatus}`, { defaultValue: toStatus })
  );
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
          <CmErrorState compact message={loadError ?? t('tasks.loadFailed')} onRetry={() => { setLoading(true); void load(); }} />
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
              <Link className="cm-workspace-link" to={`/codemart/projects/${task.project.id}`}>
                <ExternalLink aria-hidden="true" /> {t('tasks.projectLink', { title: task.project.title })}
              </Link>
            )}
            <p className="cm-drawer__hint">{t(`tasks.statusHint.${task.status}`, { defaultValue: '' })}</p>
            <CmNotice notice={notice.notice} onDismiss={notice.clear} />
            <CmTransitionBar transitions={task.access.allowed_transitions} labelFor={transitionLabel} onConfirm={transition} />
            {lastReview && (
              <div className="cm-drawer__section cm-last-review">
                <h3>{t('tasks.lastReview')}</h3>
                <CmStatusBadge group="submission" status={lastReview.recommendation ?? lastReview.status} />
                <p>{lastReview.review_notes || lastReview.comments}</p>
              </div>
            )}
            {task.access.can_submit && <CmTaskSubmitForm taskId={task.id} onSubmitted={reload} />}
            {!task.access.can_submit && task.status === REVIEW_STATUS && <CmNotice notice={{ tone: 'info', text: t('tasks.inReview') }} />}
            <CmSubmissionsPanel
              taskId={task.id}
              taskStatus={task.status}
              canReview={task.access.roles.includes(MANAGER_ROLE) && task.access.can_review}
              onChanged={reload}
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
                <textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t('tasks.commentPlaceholder')} />
              </label>
              <div className="cm-table-actions">
                <button type="submit" className="cm-workspace-button" disabled={busy || !comment.trim()}>
                  {busy ? t('common.saving') : t('tasks.commentPost')}
                </button>
              </div>
            </form>
          </>
        )}
      </aside>
    </div>
  );
};

const extractTasks = (data: { my_tasks: CmTask[]; pagination: unknown }) => ({
  items: (Array.isArray(data.my_tasks) ? data.my_tasks : []) as CmMyTask[],
  totalPages: cmTotalPages(data.pagination as Parameters<typeof cmTotalPages>[0]),
});
const fetchTasks = (page: number) => cmApi.getMyTasks(page);

export const CmTasksPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, refresh } = useCmBootstrap();
  const currency = bootstrap?.vocabulary.policy.currency ?? DEFAULT_CURRENCY;
  const [searchParams, setSearchParams] = useSearchParams();
  const list = useCmPagedList(fetchTasks, extractTasks, 'tasks.loadFailed');
  const selectedId = Number.parseInt(searchParams.get(TASK_QUERY_PARAM) ?? '', 10);

  const openTask = useCallback((taskId: number | null): void => {
    const next = new URLSearchParams(searchParams);
    if (taskId === null) next.delete(TASK_QUERY_PARAM);
    else next.set(TASK_QUERY_PARAM, String(taskId));
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
            <Link to="/codemart/marketplace" className="cm-workspace-button is-primary"><Store aria-hidden="true" /> {t('tasks.findWork')}</Link>
          </>
        )}
      />
      {list.loading ? (
        <CmLoadingState />
      ) : list.error ? (
        <CmErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : list.items.length === 0 ? (
        <CmEmptyState
          title={t('tasks.emptyTitle')}
          body={t('tasks.emptyBody')}
          action={<Link to="/codemart/marketplace" className="cm-workspace-button is-primary"><Store aria-hidden="true" /> {t('tasks.findWork')}</Link>}
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
