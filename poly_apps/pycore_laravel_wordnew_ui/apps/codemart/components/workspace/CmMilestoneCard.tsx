import React, { useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import type { CmMilestone, CmTask } from '../../api/CmApiTypes';
import { cmErrorMessage } from '../../api/cmErrors';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { CmNotice, useCmNotice } from './CmStateViews';
import { CmStatusBadge } from './CmStatusBadge';
import { CmSubmissionsPanel } from './CmSubmissionsPanel';
import { cmShortDate, cmSplitList, useCmFormat } from './cmWorkspaceFormat';

const DEFAULT_TASK_PRIORITY = 'medium';
/** Mirrors the server TASK_EDITABLE_STATUSES. */
const TASK_EDITABLE_STATUSES = ['pending', 'open', 'assigned', 'in_progress', 'blocked'];
const DELIVERABLE_SEPARATOR = '\n';

interface CmMilestoneCardProps {
  index: number;
  milestone: CmMilestone;
  currency: string | null;
  canManage: boolean;
  currentUserId: number | null;
  onChanged: () => Promise<void>;
}

const CmTaskRow: React.FC<{ task: CmTask; currency: string | null; canManage: boolean; currentUserId: number | null; onChanged: () => Promise<void> }> = ({ task, currency, canManage, currentUserId, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const isMine = currentUserId !== null && task.assigned_to === currentUserId;
  const canSeeSubmissions = canManage || isMine;
  const canEdit = canManage && TASK_EDITABLE_STATUSES.includes(task.status);
  const onEdited = async (): Promise<void> => {
    setEditing(false);
    await onChanged();
  };
  return (
    <li className="cm-task-row">
      <div className="cm-task-row__line">
        <span className="cm-task-row__title">{task.title}</span>
        <span className="cm-task-row__meta">
          {task.priority && <span>{t(`projectDetail.priorities.${task.priority}`, { defaultValue: task.priority })}</span>}
          {task.due_date && <span><CalendarDays aria-hidden="true" /> {format.date(task.due_date)}</span>}
          {task.budget_allocation && <span>{format.money(task.budget_allocation, currency)}</span>}
          {isMine && <span className="cm-task-row__mine">{t('milestones.assignedToYou')}</span>}
        </span>
        <CmStatusBadge group="task" status={task.status} />
        {canEdit && (
          <button type="button" className="cm-workspace-button is-small" onClick={() => setEditing((value) => !value)} aria-expanded={editing}>
            <Pencil aria-hidden="true" /> {editing ? t('common.cancel') : t('projectDetail.editTask')}
          </button>
        )}
        {canSeeSubmissions && (
          <button type="button" className="cm-workspace-button is-small" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />} {open ? t('submissions.hide') : t('submissions.show')}
          </button>
        )}
      </div>
      {(task.required_skills ?? []).length > 0 && (
        <ul className="cm-chip-list">{(task.required_skills ?? []).map((skill) => <li key={skill}>{skill}</li>)}</ul>
      )}
      {editing && <CmTaskForm milestoneId={task.milestone_id} task={task} onSaved={onEdited} />}
      {open && <CmSubmissionsPanel taskId={task.id} taskStatus={task.status} canReview={canManage} onChanged={onChanged} />}
    </li>
  );
};

/** Task budgets are locked by the server once a developer is assigned. */
const TASK_BUDGET_EDITABLE_STATUSES = ['pending', 'open'];

interface CmTaskFormProps {
  milestoneId: number;
  task?: CmTask;
  onSaved: () => Promise<void>;
}

/** Create a task in a milestone, or edit an existing one when `task` is given. */
export const CmTaskForm: React.FC<CmTaskFormProps> = ({ milestoneId, task, onSaved }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const { policyList } = useCmBootstrap();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<string>(task?.priority ?? DEFAULT_TASK_PRIORITY);
  const [dueDate, setDueDate] = useState(cmShortDate(task?.due_date));
  const [budget, setBudget] = useState(task?.budget_allocation ?? '');
  const [skills, setSkills] = useState((task?.required_skills ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const budgetEditable = !task || TASK_BUDGET_EDITABLE_STATUSES.includes(task.status);
  const titleError = !title.trim() ? t('milestones.errors.taskTitleRequired') : null;
  const descriptionError = !description.trim() ? t('milestones.errors.taskDescriptionRequired') : null;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (busy || titleError || descriptionError) return;
    setBusy(true);
    notice.clear();
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      priority,
      due_date: dueDate || null,
      required_skills: cmSplitList(skills),
    };
    if (budgetEditable) payload.budget_allocation = budget ? Number(budget) : null;
    const response = task
      ? await cmApi.updateTask(task.id, payload)
      : await cmApi.createTask({ ...payload, milestone_id: milestoneId });
    setBusy(false);
    if (response.success) {
      notice.success(t(task ? 'projectDetail.taskUpdated' : 'projectDetail.taskAdded'));
      if (!task) {
        setTitle('');
        setDescription('');
        setPriority(DEFAULT_TASK_PRIORITY);
        setDueDate('');
        setBudget('');
        setSkills('');
      }
      setSubmitted(false);
      await onSaved();
    } else {
      notice.error(cmErrorMessage(t, response, task ? 'projectDetail.taskUpdateFailed' : 'projectDetail.taskFailed'));
    }
  };

  return (
    <form className="cm-project-form" onSubmit={(event) => void submit(event)} noValidate>
      <label className="is-wide">
        <span>{t('projectDetail.taskTitle')}</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={submitted && Boolean(titleError)} />
        {submitted && titleError && <small className="cm-field-error">{titleError}</small>}
      </label>
      <label className="is-wide">
        <span>{t('projectDetail.taskDescription')}</span>
        <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} aria-invalid={submitted && Boolean(descriptionError)} />
        {submitted && descriptionError && <small className="cm-field-error">{descriptionError}</small>}
      </label>
      <label>
        <span>{t('projectDetail.taskPriority')}</span>
        <select value={priority} onChange={(event) => setPriority(event.target.value)}>
          {policyList('task_priorities').map((value) => (
            <option key={value} value={value}>{t(`projectDetail.priorities.${value}`)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('projectDetail.taskDueDate')}</span>
        <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </label>
      <label>
        <span>{t('projectDetail.taskBudget')}</span>
        <input type="number" min={0} step="0.01" value={budget} disabled={!budgetEditable} onChange={(event) => setBudget(event.target.value)} />
        {!budgetEditable && <small className="cm-field-hint">{t('projectDetail.taskBudgetLocked')}</small>}
      </label>
      <label>
        <span>{t('projectDetail.taskSkills')}</span>
        <input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder={t('marketplace.skillsPlaceholder')} />
      </label>
      {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
      <div className="cm-project-form__actions">
        <button type="submit" className="is-primary" disabled={busy}>{busy ? t('common.saving') : t(task ? 'projectDetail.saveTask' : 'projectDetail.addTask')}</button>
      </div>
    </form>
  );
};

export const CmMilestoneCard: React.FC<CmMilestoneCardProps> = ({ index, milestone, currency, canManage, currentUserId, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const { terminalStates } = useCmBootstrap();
  const closed = terminalStates('milestone').includes(milestone.status);
  const editable = canManage && !closed;
  const tasks = milestone.tasks ?? [];
  const [mode, setMode] = useState<'none' | 'edit' | 'task' | 'complete'>('none');
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? '');
  const [dueDate, setDueDate] = useState(cmShortDate(milestone.due_date));
  const [budget, setBudget] = useState(milestone.budget ?? '');
  const [deliverables, setDeliverables] = useState((milestone.deliverables ?? []).join(DELIVERABLE_SEPARATOR));
  const editInvalid = !title.trim() || !dueDate || budget === '' || Number(budget) < 0;

  const toggle = (next: 'edit' | 'task' | 'complete'): void => {
    if (next === 'edit' && mode !== 'edit') {
      setTitle(milestone.title);
      setDescription(milestone.description ?? '');
      setDueDate(cmShortDate(milestone.due_date));
      setBudget(milestone.budget ?? '');
      setDeliverables((milestone.deliverables ?? []).join(DELIVERABLE_SEPARATOR));
    }
    setMode(mode === next ? 'none' : next);
  };

  const saveMilestone = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || editInvalid) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.updateMilestone(milestone.id, {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate,
      budget: Number(budget),
      deliverables: deliverables.split(DELIVERABLE_SEPARATOR).map((item) => item.trim()).filter((item) => item !== ''),
    });
    setBusy(false);
    if (response.success) {
      setMode('none');
      notice.success(t('milestones.saved'));
      await onChanged();
    } else {
      notice.error(cmErrorMessage(t, response, 'milestones.saveFailed'));
    }
  };

  const completeMilestone = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.completeMilestone(milestone.id);
    setBusy(false);
    setMode('none');
    if (response.success) {
      notice.success(t('milestones.completed'));
      await onChanged();
    } else {
      notice.error(cmErrorMessage(t, response, 'milestones.completeFailed'));
    }
  };

  const onTaskCreated = async (): Promise<void> => {
    setMode('none');
    notice.success(t('projectDetail.taskAdded'));
    await onChanged();
  };

  return (
    <article className="cm-milestone-card">
      <header className="cm-milestone-card__header">
        <span className="cm-milestone-card__index" aria-hidden="true">{index}</span>
        <div className="cm-milestone-card__heading">
          <h3>{milestone.title}</h3>
          <div className="cm-record-card__meta">
            <CmStatusBadge group="milestone" status={milestone.status} />
            {milestone.due_date && <span><CalendarDays aria-hidden="true" /> {t('tasks.due', { date: format.date(milestone.due_date) })}</span>}
            {milestone.budget && <span className="cm-record-card__money">{format.money(milestone.budget, currency)}</span>}
            {milestone.completed_at && <span>{t('milestones.completedAt', { date: format.date(milestone.completed_at) })}</span>}
          </div>
        </div>
      </header>
      {milestone.description && <p className="cm-milestone-card__description">{milestone.description}</p>}
      {(milestone.deliverables ?? []).length > 0 && (
        <div className="cm-deliverables">
          <strong>{t('milestones.deliverables')}</strong>
          <ul>{(milestone.deliverables ?? []).map((item, position) => <li key={position}>{item}</li>)}</ul>
        </div>
      )}
      <div className="cm-milestone-card__tasks">
        <strong>{t('milestones.tasksTitle', { count: tasks.length })}</strong>
        {tasks.length === 0 ? (
          <p className="cm-field-hint">{editable ? t('projectDetail.noTasks') : t('projectDetail.noTasksReadOnly')}</p>
        ) : (
          <ul className="cm-task-list">
            {tasks.map((task) => (
              <CmTaskRow key={task.id} task={task} currency={currency} canManage={canManage} currentUserId={currentUserId} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </div>
      {editable && (
        <div className="cm-table-actions">
          <button type="button" className={`cm-workspace-button ${mode === 'task' ? 'is-active' : ''}`} onClick={() => toggle('task')} aria-expanded={mode === 'task'}>
            <Plus aria-hidden="true" /> {t('projectDetail.addTask')}
          </button>
          <button type="button" className={`cm-workspace-button ${mode === 'edit' ? 'is-active' : ''}`} onClick={() => toggle('edit')} aria-expanded={mode === 'edit'}>
            <Pencil aria-hidden="true" /> {t('milestones.edit')}
          </button>
          <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => toggle('complete')}>
            <CheckCircle2 aria-hidden="true" /> {t('milestones.complete')}
          </button>
        </div>
      )}
      {mode === 'complete' && editable && (
        <div className="cm-confirm-box">
          <p>{t('milestones.completeConfirm')}</p>
          <div className="cm-table-actions">
            <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void completeMilestone()}>
              {busy ? t('common.saving') : t('common.confirm')}
            </button>
            <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => setMode('none')}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {mode === 'edit' && editable && (
        <form className="cm-project-form cm-inline-form" onSubmit={(event) => void saveMilestone(event)} noValidate>
          <label className="is-wide">
            <span>{t('projectDetail.milestoneTitle')}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={!title.trim()} />
            {!title.trim() && <small className="cm-field-error">{t('milestones.errors.titleRequired')}</small>}
          </label>
          <label>
            <span>{t('projectDetail.milestoneDueDate')}</span>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-invalid={!dueDate} />
            {!dueDate && <small className="cm-field-error">{t('milestones.errors.dueDateRequired')}</small>}
          </label>
          <label>
            <span>{t('projectDetail.milestoneBudget')}</span>
            <input type="number" min={0} step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} aria-invalid={budget === '' || Number(budget) < 0} />
            {(budget === '' || Number(budget) < 0) && <small className="cm-field-error">{t('milestones.errors.budgetRequired')}</small>}
          </label>
          <label className="is-wide">
            <span>{t('projectDetail.milestoneDescription')}</span>
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="is-wide">
            <span>{t('milestones.deliverables')}</span>
            <textarea rows={3} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} placeholder={t('milestones.deliverablesPlaceholder')} />
          </label>
          <div className="cm-project-form__actions">
            <button type="button" onClick={() => setMode('none')}>{t('common.cancel')}</button>
            <button type="submit" className="is-primary" disabled={busy || editInvalid}>{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      )}
      {mode === 'task' && editable && (
        <div className="cm-inline-form">
          <h4>{t('projectDetail.addTaskTitle')}</h4>
          <CmTaskForm milestoneId={milestone.id} onSaved={onTaskCreated} />
        </div>
      )}
    </article>
  );
};

export default CmMilestoneCard;
