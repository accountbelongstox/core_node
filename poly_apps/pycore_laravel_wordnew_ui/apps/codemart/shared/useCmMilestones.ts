import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmMilestone, CmTask } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { cmShortDate, cmSplitList } from '../components/workspace/cmWorkspaceFormat';
import type { CmFeedback } from './cmFeedback';

export const CM_DEFAULT_TASK_PRIORITY = 'medium';
/** Mirrors the server TASK_EDITABLE_STATUSES. */
export const CM_TASK_EDITABLE_STATUSES = ['pending', 'open', 'assigned', 'in_progress', 'blocked'];
/** Task budgets are locked by the server once a developer is assigned. */
const TASK_BUDGET_EDITABLE_STATUSES = ['pending', 'open'];
const DELIVERABLE_SEPARATOR = '\n';

const splitDeliverables = (value: string): string[] => value.split(DELIVERABLE_SEPARATOR).map((item) => item.trim()).filter((item) => item !== '');

export interface CmMilestoneFormModel {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  dueDate: string;
  setDueDate: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  deliverables: string;
  setDeliverables: (value: string) => void;
  errors: { title: string | null; dueDate: string | null; budget: string | null };
  invalid: boolean;
  submitted: boolean;
  busy: boolean;
  /** Create (no milestone given) or update the milestone; resolves true on success. */
  submit: () => Promise<boolean>;
}

/** Create-milestone form for a project, or edit form when `milestone` is given. */
export function useCmMilestoneForm(projectId: number, milestone: CmMilestone | null, onSaved: () => Promise<void>, feedback: CmFeedback): CmMilestoneFormModel {
  const { t } = useTranslation('cm');
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [description, setDescription] = useState(milestone?.description ?? '');
  const [dueDate, setDueDate] = useState(cmShortDate(milestone?.due_date));
  const [budget, setBudget] = useState(milestone?.budget ?? '');
  const [deliverables, setDeliverables] = useState((milestone?.deliverables ?? []).join(DELIVERABLE_SEPARATOR));
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    title: !title.trim() ? t('milestones.errors.titleRequired') : null,
    dueDate: !dueDate ? t('milestones.errors.dueDateRequired') : null,
    budget: budget === '' || Number(budget) < 0 ? t('milestones.errors.budgetRequired') : null,
  };
  const invalid = Object.values(errors).some((value) => value !== null);

  const submit = useCallback(async (): Promise<boolean> => {
    setSubmitted(true);
    if (busy || invalid) return false;
    setBusy(true);
    feedback.clear();
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate,
      budget: Number(budget),
      deliverables: splitDeliverables(deliverables),
    };
    const response = milestone ? await cmApi.updateMilestone(milestone.id, payload) : await cmApi.createMilestone(projectId, payload);
    setBusy(false);
    if (response.success) {
      if (!milestone) {
        setTitle('');
        setDescription('');
        setDueDate('');
        setBudget('');
        setDeliverables('');
      }
      setSubmitted(false);
      feedback.success(t(milestone ? 'milestones.saved' : 'projectDetail.milestoneAdded'));
      await onSaved();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, milestone ? 'milestones.saveFailed' : 'projectDetail.milestoneFailed'));
    return false;
  }, [busy, invalid, feedback, title, description, dueDate, budget, deliverables, milestone, projectId, onSaved, t]);

  return { title, setTitle, description, setDescription, dueDate, setDueDate, budget, setBudget, deliverables, setDeliverables, errors, invalid, submitted, busy, submit };
}

/** Mark a milestone completed; the server enforces its state rules and answers with a coded error. */
export function useCmMilestoneComplete(milestoneId: number, onChanged: () => Promise<void>, feedback: CmFeedback): { busy: boolean; complete: () => Promise<boolean> } {
  const { t } = useTranslation('cm');
  const [busy, setBusy] = useState(false);
  const complete = useCallback(async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.completeMilestone(milestoneId);
    setBusy(false);
    if (response.success) {
      feedback.success(t('milestones.completed'));
      await onChanged();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'milestones.completeFailed'));
    return false;
  }, [busy, milestoneId, onChanged, feedback, t]);
  return { busy, complete };
}

export interface CmTaskFormModel {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  priority: string;
  setPriority: (value: string) => void;
  dueDate: string;
  setDueDate: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  skills: string;
  setSkills: (value: string) => void;
  budgetEditable: boolean;
  titleError: string | null;
  descriptionError: string | null;
  submitted: boolean;
  busy: boolean;
  /** Create (no task given) or update the task; the escrow headroom check is the server's and arrives as a coded error. */
  submit: () => Promise<boolean>;
}

/** Create-task form for a milestone, or edit form when `task` is given. */
export function useCmTaskForm(milestoneId: number, task: CmTask | null, onSaved: () => Promise<void>, feedback: CmFeedback): CmTaskFormModel {
  const { t } = useTranslation('cm');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<string>(task?.priority ?? CM_DEFAULT_TASK_PRIORITY);
  const [dueDate, setDueDate] = useState(cmShortDate(task?.due_date));
  const [budget, setBudget] = useState(task?.budget_allocation ?? '');
  const [skills, setSkills] = useState((task?.required_skills ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const budgetEditable = !task || TASK_BUDGET_EDITABLE_STATUSES.includes(task.status);
  const titleError = !title.trim() ? t('milestones.errors.taskTitleRequired') : null;
  const descriptionError = !description.trim() ? t('milestones.errors.taskDescriptionRequired') : null;

  const submit = useCallback(async (): Promise<boolean> => {
    setSubmitted(true);
    if (busy || titleError || descriptionError) return false;
    setBusy(true);
    feedback.clear();
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
      feedback.success(t(task ? 'projectDetail.taskUpdated' : 'projectDetail.taskAdded'));
      if (!task) {
        setTitle('');
        setDescription('');
        setPriority(CM_DEFAULT_TASK_PRIORITY);
        setDueDate('');
        setBudget('');
        setSkills('');
      }
      setSubmitted(false);
      await onSaved();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, task ? 'projectDetail.taskUpdateFailed' : 'projectDetail.taskFailed'));
    return false;
  }, [busy, titleError, descriptionError, feedback, title, description, priority, dueDate, skills, budgetEditable, budget, task, milestoneId, onSaved, t]);

  return {
    title, setTitle, description, setDescription, priority, setPriority, dueDate, setDueDate, budget, setBudget, skills, setSkills,
    budgetEditable, titleError, descriptionError, submitted, busy, submit,
  };
}
