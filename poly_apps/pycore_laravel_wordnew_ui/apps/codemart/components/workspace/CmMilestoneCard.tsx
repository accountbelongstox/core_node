import React, { useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmMilestone, CmTask } from '../../api/CmApiTypes';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { CmNotice, useCmNotice, type CmNoticeController } from './CmStateViews';
import { CmStatusBadge } from './CmStatusBadge';
import { CmSubmissionsPanel } from './CmSubmissionsPanel';
import { useCmFormat } from './cmWorkspaceFormat';
import { CM_TASK_EDITABLE_STATUSES, useCmMilestoneComplete, useCmMilestoneForm, useCmTaskForm } from '../../shared/useCmMilestones';

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
  const canEdit = canManage && CM_TASK_EDITABLE_STATUSES.includes(task.status);
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
  const form = useCmTaskForm(milestoneId, task ?? null, onSaved, notice);
  const { submitted, titleError, descriptionError, budgetEditable } = form;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    await form.submit();
  };

  return (
    <form className="cm-project-form" onSubmit={(event) => void submit(event)} noValidate>
      <label className="is-wide">
        <span>{t('projectDetail.taskTitle')}</span>
        <input value={form.title} onChange={(event) => form.setTitle(event.target.value)} aria-invalid={submitted && Boolean(titleError)} />
        {submitted && titleError && <small className="cm-field-error">{titleError}</small>}
      </label>
      <label className="is-wide">
        <span>{t('projectDetail.taskDescription')}</span>
        <textarea rows={3} value={form.description} onChange={(event) => form.setDescription(event.target.value)} aria-invalid={submitted && Boolean(descriptionError)} />
        {submitted && descriptionError && <small className="cm-field-error">{descriptionError}</small>}
      </label>
      <label>
        <span>{t('projectDetail.taskPriority')}</span>
        <select value={form.priority} onChange={(event) => form.setPriority(event.target.value)}>
          {policyList('task_priorities').map((value) => (
            <option key={value} value={value}>{t(`projectDetail.priorities.${value}`)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('projectDetail.taskDueDate')}</span>
        <input type="date" value={form.dueDate} onChange={(event) => form.setDueDate(event.target.value)} />
      </label>
      <label>
        <span>{t('projectDetail.taskBudget')}</span>
        <input type="number" min={0} step="0.01" value={form.budget} disabled={!budgetEditable} onChange={(event) => form.setBudget(event.target.value)} />
        {!budgetEditable && <small className="cm-field-hint">{t('projectDetail.taskBudgetLocked')}</small>}
      </label>
      <label>
        <span>{t('projectDetail.taskSkills')}</span>
        <input value={form.skills} onChange={(event) => form.setSkills(event.target.value)} placeholder={t('marketplace.skillsPlaceholder')} />
      </label>
      {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
      <div className="cm-project-form__actions">
        <button type="submit" className="is-primary" disabled={form.busy}>{form.busy ? t('common.saving') : t(task ? 'projectDetail.saveTask' : 'projectDetail.addTask')}</button>
      </div>
    </form>
  );
};

const CmMilestoneEditForm: React.FC<{ milestone: CmMilestone; onSaved: () => Promise<void>; onCancel: () => void; notice: CmNoticeController }> = ({ milestone, onSaved, onCancel, notice }) => {
  const { t } = useTranslation('cm');
  const form = useCmMilestoneForm(milestone.project_id, milestone, onSaved, notice);
  const { errors, invalid } = form;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    await form.submit();
  };

  return (
    <form className="cm-project-form cm-inline-form" onSubmit={(event) => void submit(event)} noValidate>
      <label className="is-wide">
        <span>{t('projectDetail.milestoneTitle')}</span>
        <input value={form.title} onChange={(event) => form.setTitle(event.target.value)} aria-invalid={Boolean(errors.title)} />
        {errors.title && <small className="cm-field-error">{errors.title}</small>}
      </label>
      <label>
        <span>{t('projectDetail.milestoneDueDate')}</span>
        <input type="date" value={form.dueDate} onChange={(event) => form.setDueDate(event.target.value)} aria-invalid={Boolean(errors.dueDate)} />
        {errors.dueDate && <small className="cm-field-error">{errors.dueDate}</small>}
      </label>
      <label>
        <span>{t('projectDetail.milestoneBudget')}</span>
        <input type="number" min={0} step="0.01" value={form.budget} onChange={(event) => form.setBudget(event.target.value)} aria-invalid={Boolean(errors.budget)} />
        {errors.budget && <small className="cm-field-error">{errors.budget}</small>}
      </label>
      <label className="is-wide">
        <span>{t('projectDetail.milestoneDescription')}</span>
        <textarea rows={3} value={form.description} onChange={(event) => form.setDescription(event.target.value)} />
      </label>
      <label className="is-wide">
        <span>{t('milestones.deliverables')}</span>
        <textarea rows={3} value={form.deliverables} onChange={(event) => form.setDeliverables(event.target.value)} placeholder={t('milestones.deliverablesPlaceholder')} />
      </label>
      <div className="cm-project-form__actions">
        <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="submit" className="is-primary" disabled={form.busy || invalid}>{form.busy ? t('common.saving') : t('common.save')}</button>
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
  const [editKey, setEditKey] = useState(0);
  const completion = useCmMilestoneComplete(milestone.id, onChanged, notice);

  const toggle = (next: 'edit' | 'task' | 'complete'): void => {
    if (next === 'edit' && mode !== 'edit') setEditKey((key) => key + 1);
    setMode(mode === next ? 'none' : next);
  };

  const completeMilestone = async (): Promise<void> => {
    await completion.complete();
    setMode('none');
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
          <button type="button" className="cm-workspace-button" disabled={completion.busy} onClick={() => toggle('complete')}>
            <CheckCircle2 aria-hidden="true" /> {t('milestones.complete')}
          </button>
        </div>
      )}
      {mode === 'complete' && editable && (
        <div className="cm-confirm-box">
          <p>{t('milestones.completeConfirm')}</p>
          <div className="cm-table-actions">
            <button type="button" className="cm-workspace-button is-primary" disabled={completion.busy} onClick={() => void completeMilestone()}>
              {completion.busy ? t('common.saving') : t('common.confirm')}
            </button>
            <button type="button" className="cm-workspace-button" disabled={completion.busy} onClick={() => setMode('none')}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {mode === 'edit' && editable && (
        <CmMilestoneEditForm
          key={editKey}
          milestone={milestone}
          onSaved={async () => { setMode('none'); await onChanged(); }}
          onCancel={() => setMode('none')}
          notice={notice}
        />
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
