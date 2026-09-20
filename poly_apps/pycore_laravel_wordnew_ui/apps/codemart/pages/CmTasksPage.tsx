import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, ListTodo, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmTask } from '../api/CmApiTypes';

function parseMyTasks(data: unknown): CmTask[] {
  if (!data || typeof data !== 'object') return [];
  const source = data as { my_tasks?: unknown };
  return Array.isArray(source.my_tasks) ? (source.my_tasks as CmTask[]) : [];
}

const SUBMITTABLE_STATUSES = new Set(['assigned', 'in_progress', 'blocked']);

const CmTaskWorkPanel: React.FC<{ task: CmTask; onChanged: () => Promise<void> }> = ({ task, onChanged }) => {
  const { t } = useTranslation('cm');
  const [submissionNote, setSubmissionNote] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submitDeliverable = async (): Promise<void> => {
    if (!submissionNote.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.submitTask(task.id, submissionNote.trim());
    if (response.success) {
      setNotice(t('tasks.submitted'));
      setSubmissionNote('');
      await onChanged();
    } else {
      setNotice(response.error ?? t('tasks.submitFailed'));
    }
    setBusy(false);
  };

  const postComment = async (): Promise<void> => {
    if (!comment.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.addTaskComment(task.id, comment.trim());
    setNotice(response.success ? t('tasks.commentPosted') : (response.error ?? t('tasks.commentFailed')));
    if (response.success) {
      setComment('');
    }
    setBusy(false);
  };

  return (
    <div className="cm-task-work">
      {SUBMITTABLE_STATUSES.has(task.status) && (
        <div className="cm-task-work__section">
          <h3><Send aria-hidden="true" /> {t('tasks.submitTitle')}</h3>
          <textarea
            rows={3}
            value={submissionNote}
            onChange={(event) => setSubmissionNote(event.target.value)}
            placeholder={t('tasks.submissionPlaceholder')}
          />
          <button
            type="button"
            className="cm-workspace-button is-primary"
            disabled={busy || !submissionNote.trim()}
            onClick={() => void submitDeliverable()}
          >
            {busy ? t('common.loading') : t('tasks.submit')}
          </button>
        </div>
      )}
      {task.status === 'review' && (
        <p className="cm-contract-note">{t('tasks.inReview')}</p>
      )}
      <div className="cm-task-work__section">
        <h3><MessageSquare aria-hidden="true" /> {t('tasks.commentTitle')}</h3>
        <div className="cm-task-comment-row">
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t('tasks.commentPlaceholder')}
          />
          <button
            type="button"
            className="cm-workspace-button"
            disabled={busy || !comment.trim()}
            onClick={() => void postComment()}
          >
            {t('tasks.commentPost')}
          </button>
        </div>
      </div>
      {notice && <p className="cm-contract-note">{notice}</p>}
    </div>
  );
};

export const CmTasksPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [tasks, setTasks] = useState<CmTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getMyTasks();
    if (response.success) {
      setTasks(parseMyTasks(response.data));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('tasks.eyebrow')}</span>
        <h1>{t('nav.tasks')}</h1>
        <p>{t('tasks.description')}</p>
        <button type="button" className="cm-workspace-button" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      </header>
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : tasks.length === 0 ? (
        <section className="cm-marketplace-empty">
          <ListTodo aria-hidden="true" />
          <h2>{t('tasks.emptyTitle')}</h2>
          <p>{t('tasks.emptyBody')}</p>
        </section>
      ) : (
        <section className="cm-card-list">
          {tasks.map((task) => (
            <article key={task.id} className="cm-record-card">
              <div className="cm-record-card__main">
                <h2>{task.title}</h2>
                <p>{task.description}</p>
                <div className="cm-record-card__meta">
                  <span className="cm-status" data-status={task.status}>{t(`states.task.${task.status}`)}</span>
                  {task.due_date && <span>{t('tasks.due', { date: task.due_date.slice(0, 10) })}</span>}
                </div>
              </div>
              <CmTaskWorkPanel task={task} onChanged={load} />
            </article>
          ))}
        </section>
      )}
      {tasks.length === 0 && !loading && <Inbox aria-hidden="true" style={{ display: 'none' }} />}
    </main>
  );
};

export default CmTasksPage;
