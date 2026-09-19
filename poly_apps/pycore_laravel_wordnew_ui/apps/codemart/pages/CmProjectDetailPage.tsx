import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProjectDetail } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const CmProjectDetailPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { projectId } = useParams<{ projectId: string }>();
  const { bootstrap } = useCmBootstrap();
  const numericId = Number.parseInt(projectId ?? '', 10);

  const [project, setProject] = useState<CmProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editComplexity, setEditComplexity] = useState('medium');
  const [editBudget, setEditBudget] = useState('');

  const [msTitle, setMsTitle] = useState('');
  const [msDescription, setMsDescription] = useState('');
  const [msDueDate, setMsDueDate] = useState('');
  const [msBudget, setMsBudget] = useState('');

  const [taskMilestoneId, setTaskMilestoneId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<string>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskBudget, setTaskBudget] = useState('');

  const load = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(numericId)) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadFailed(false);
    const response = await cmApi.getProject(numericId);
    if (response.success && response.data) {
      setProject(response.data);
      setEditTitle(response.data.title);
      setEditDescription(response.data.description);
      setEditComplexity(response.data.complexity ?? 'medium');
      setEditBudget(response.data.budget ?? '');
    } else {
      setLoadFailed(true);
    }
    setLoading(false);
  }, [numericId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwner = project !== null && bootstrap !== null && project.client_id === bootstrap.user.id;
  const canManage = project !== null && bootstrap !== null
    && (project.client_id === bootstrap.user.id || project.architect_id === bootstrap.user.id);

  const saveProject = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!project || busy) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.updateProject(project.id, {
      title: editTitle,
      description: editDescription,
      complexity: editComplexity,
      budget: Number(editBudget),
    });
    setNotice(response.success ? t('projectDetail.saved') : t('projectDetail.saveFailed'));
    setBusy(false);
    if (response.success) await load();
  };

  const addMilestone = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!project || busy) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.createMilestone(project.id, {
      title: msTitle,
      description: msDescription || null,
      due_date: msDueDate,
      budget: Number(msBudget),
    });
    setNotice(response.success ? t('projectDetail.milestoneAdded') : t('projectDetail.milestoneFailed'));
    setBusy(false);
    if (response.success) {
      setMsTitle('');
      setMsDescription('');
      setMsDueDate('');
      setMsBudget('');
      await load();
    }
  };

  const addTask = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (taskMilestoneId === null || busy) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.createTask({
      milestone_id: taskMilestoneId,
      title: taskTitle,
      description: taskDescription,
      priority: taskPriority,
      due_date: taskDueDate || null,
      budget_allocation: taskBudget ? Number(taskBudget) : null,
    });
    setNotice(response.success ? t('projectDetail.taskAdded') : t('projectDetail.taskFailed'));
    setBusy(false);
    if (response.success) {
      setTaskMilestoneId(null);
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setTaskDueDate('');
      setTaskBudget('');
      await load();
    }
  };

  if (loading) {
    return (
      <main className="cm-workspace-page">
        <p className="cm-contract-note">{t('common.loading')}</p>
      </main>
    );
  }

  if (loadFailed || !project) {
    return (
      <main className="cm-workspace-page">
        <p className="cm-contract-note">{t('projectDetail.loadFailed')}</p>
        <Link to="/codemart/projects" className="cm-workspace-button">
          <ArrowLeft aria-hidden="true" /> {t('projectDetail.backToList')}
        </Link>
      </main>
    );
  }

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('projects.eyebrow')}</span>
        <h1>{project.title}</h1>
        <p>{project.description}</p>
        <div className="cm-page-heading__actions">
          <Link to="/codemart/projects" className="cm-workspace-button">
            <ArrowLeft aria-hidden="true" /> {t('projectDetail.backToList')}
          </Link>
          <button type="button" className="cm-workspace-button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
        </div>
      </header>
      {notice && <p className="cm-contract-note">{notice}</p>}

      <section className="cm-dashboard-section">
        <h2>{t('projectDetail.overviewTitle')}</h2>
        <div className="cm-record-card__meta">
          <span className="cm-status" data-status={project.status}>{t(`states.project.${project.status}`)}</span>
          <span>{t('projectDetail.budgetLabel')}: {project.currency ?? ''} {project.budget ?? t('common.unavailable')}</span>
          <span>{t('projectDetail.architectLabel')}: {project.architect_id ?? t('projectDetail.unassigned')}</span>
          {project.created_at && (
            <span><CalendarDays aria-hidden="true" /> {t('projectDetail.createdAt')}: {project.created_at}</span>
          )}
        </div>
      </section>

      <section className="cm-dashboard-section">
        <h2>{t('projectDetail.milestonesTitle')}</h2>
        {(project.milestones ?? []).length === 0 ? (
          <p className="cm-contract-note">{t('projectDetail.noMilestones')}</p>
        ) : (
          (project.milestones ?? []).map((milestone) => (
            <article key={milestone.id} className="cm-record-card">
              <div className="cm-record-card__main">
                <h3>{milestone.title}</h3>
                {milestone.description && <p>{milestone.description}</p>}
                <div className="cm-record-card__meta">
                  <span className="cm-status" data-status={milestone.status}>{milestone.status}</span>
                  {milestone.due_date && <span>{t('projectDetail.dueDate')}: {milestone.due_date}</span>}
                  {milestone.budget && <span>{project.currency ?? ''} {milestone.budget}</span>}
                </div>
                {(milestone.tasks ?? []).length === 0 ? (
                  <p className="cm-contract-note">{t('projectDetail.noTasks')}</p>
                ) : (
                  <ul className="cm-task-list">
                    {(milestone.tasks ?? []).map((task) => (
                      <li key={task.id}>
                        <span>{task.title}</span>
                        <span className="cm-status" data-status={task.status}>
                          {t(`states.task.${task.status}`, { defaultValue: task.status })}
                        </span>
                        {task.priority && <span>{t(`projectDetail.priorities.${task.priority}`, { defaultValue: task.priority })}</span>}
                        {task.due_date && <span>{t('projectDetail.dueDate')}: {task.due_date}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  className="cm-workspace-button"
                  onClick={() => setTaskMilestoneId(milestone.id)}
                >
                  {t('projectDetail.addTask')}
                </button>
              )}
              {taskMilestoneId === milestone.id && (
                <form className="cm-project-form" onSubmit={(event) => void addTask(event)}>
                  <label>
                    <span>{t('projectDetail.taskTitle')}</span>
                    <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required />
                  </label>
                  <label className="is-wide">
                    <span>{t('projectDetail.taskDescription')}</span>
                    <textarea rows={3} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} required />
                  </label>
                  <label>
                    <span>{t('projectDetail.taskPriority')}</span>
                    <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
                      {TASK_PRIORITIES.map((value) => (
                        <option key={value} value={value}>{t(`projectDetail.priorities.${value}`)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{t('projectDetail.taskDueDate')}</span>
                    <input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} />
                  </label>
                  <label>
                    <span>{t('projectDetail.taskBudget')}</span>
                    <input type="number" min={0} value={taskBudget} onChange={(event) => setTaskBudget(event.target.value)} />
                  </label>
                  <div className="cm-project-form__actions">
                    <button type="submit" className="is-primary" disabled={busy}>
                      {busy ? t('common.loading') : t('projectDetail.addTask')}
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))
        )}
      </section>

      {canManage && (
        <section className="cm-dashboard-section">
          <h2>{t('projectDetail.addMilestoneTitle')}</h2>
          <form className="cm-project-form" onSubmit={(event) => void addMilestone(event)}>
            <label>
              <span>{t('projectDetail.milestoneTitle')}</span>
              <input value={msTitle} onChange={(event) => setMsTitle(event.target.value)} required />
            </label>
            <label className="is-wide">
              <span>{t('projectDetail.milestoneDescription')}</span>
              <textarea rows={3} value={msDescription} onChange={(event) => setMsDescription(event.target.value)} />
            </label>
            <label>
              <span>{t('projectDetail.milestoneDueDate')}</span>
              <input type="date" value={msDueDate} onChange={(event) => setMsDueDate(event.target.value)} required />
            </label>
            <label>
              <span>{t('projectDetail.milestoneBudget')}</span>
              <input type="number" min={0} value={msBudget} onChange={(event) => setMsBudget(event.target.value)} required />
            </label>
            <div className="cm-project-form__actions">
              <button type="submit" className="is-primary" disabled={busy}>
                {busy ? t('common.loading') : t('projectDetail.addMilestone')}
              </button>
            </div>
          </form>
        </section>
      )}

      {isOwner && (
        <section className="cm-dashboard-section">
          <h2>{t('projectDetail.editTitle')}</h2>
          <form className="cm-project-form" onSubmit={(event) => void saveProject(event)}>
            <label>
              <span>{t('projectCreate.projectTitle')}</span>
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
            </label>
            <label className="is-wide">
              <span>{t('projectCreate.summary')}</span>
              <textarea rows={5} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} required />
            </label>
            <label>
              <span>{t('projectCreate.complexity')}</span>
              <select value={editComplexity} onChange={(event) => setEditComplexity(event.target.value)}>
                {['simple', 'medium', 'complex', 'very_complex'].map((value) => (
                  <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('projectCreate.budget')}</span>
              <input type="number" min={100} value={editBudget} onChange={(event) => setEditBudget(event.target.value)} required />
            </label>
            <div className="cm-project-form__actions">
              <button type="submit" className="is-primary" disabled={busy}>
                {busy ? t('common.loading') : t('projectDetail.saveChanges')}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
};

export default CmProjectDetailPage;
