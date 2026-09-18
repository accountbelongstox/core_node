import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, ListTodo, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmTask } from '../api/CmApiTypes';

function parseMyTasks(data: unknown): CmTask[] {
  if (!data || typeof data !== 'object') return [];
  const source = data as { my_tasks?: unknown };
  return Array.isArray(source.my_tasks) ? (source.my_tasks as CmTask[]) : [];
}

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
            </article>
          ))}
        </section>
      )}
      {tasks.length === 0 && !loading && <Inbox aria-hidden="true" style={{ display: 'none' }} />}
    </main>
  );
};

export default CmTasksPage;
