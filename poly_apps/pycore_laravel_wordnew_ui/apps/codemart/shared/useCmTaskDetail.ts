import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmCodeReview, CmTaskDetail } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { cmSplitList, cmFileTypeAllowed } from '../components/workspace/cmWorkspaceFormat';
import { useCmPolicy } from '../contexts/useCmPolicy';
import type { CmFeedback } from './cmFeedback';

const BLOCKED_STATUS = 'blocked';
const IN_PROGRESS_STATUS = 'in_progress';
export const CM_TASK_REVIEW_STATUS = 'review';
export const CM_TASK_MANAGER_ROLE = 'manager';
const URL_PATTERN = /^https?:\/\/\S+$/i;

/** Newest review of any submission that carries notes, for the "last review" hint after a revision request. */
export function cmLatestReviewWithNotes(task: CmTaskDetail): CmCodeReview | null {
  for (const submission of task.submissions ?? []) {
    const review = (submission.reviews ?? []).find((item) => item.review_notes || item.comments);
    if (review) return review;
  }
  return null;
}

export interface CmTaskDetailModel {
  task: CmTaskDetail | null;
  loading: boolean;
  loadError: string | null;
  loadRetryable: boolean;
  /** Reload the task only. */
  load: () => Promise<void>;
  /** Reload the task and tell the list owner something changed. */
  reload: () => Promise<void>;
  retry: () => void;
  lastReview: CmCodeReview | null;
  transitionLabel: (toStatus: string) => string;
  /** True when the viewer is the project manager of this task and may decide on submissions. */
  canDecide: boolean;
  transition: (toStatus: string, reason: string) => Promise<boolean>;
  comment: string;
  setComment: (value: string) => void;
  commenting: boolean;
  postComment: () => Promise<boolean>;
}

/** One task with the viewer's access: status transitions (start, block, unblock, ...), comments and refresh. */
export function useCmTaskDetail(taskId: number, onChanged: () => Promise<void>, feedback: CmFeedback): CmTaskDetailModel {
  const { t } = useTranslation('cm');
  const [task, setTask] = useState<CmTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRetryable, setLoadRetryable] = useState(true);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const response = await cmApi.getTask(taskId);
    if (response.success && response.data) {
      setTask(response.data);
      setLoadError(null);
      setLoadRetryable(true);
    } else {
      setLoadError(cmErrorMessage(t, response, 'tasks.loadFailed'));
      setLoadRetryable(response.status !== 403 && response.status !== 404);
    }
    setLoading(false);
  }, [taskId, t]);

  const { clear } = feedback;
  useEffect(() => {
    setLoading(true);
    setTask(null);
    clear();
    void load();
  }, [load, clear]);

  const reload = useCallback(async (): Promise<void> => {
    await load();
    await onChanged();
  }, [load, onChanged]);

  const retry = useCallback((): void => {
    setLoading(true);
    void load();
  }, [load]);

  const transition = useCallback(async (toStatus: string, reason: string): Promise<boolean> => {
    feedback.clear();
    const response = await cmApi.transitionTask(taskId, toStatus, reason);
    if (response.success) {
      feedback.success(t('transitions.taskDone', { status: t(`states.task.${toStatus}`, { defaultValue: toStatus }) }));
      await reload();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'transitions.failed'));
    return false;
  }, [taskId, feedback, reload, t]);

  const postComment = useCallback(async (): Promise<boolean> => {
    if (!comment.trim() || commenting) return false;
    setCommenting(true);
    feedback.clear();
    const response = await cmApi.addTaskComment(taskId, comment.trim());
    setCommenting(false);
    if (response.success) {
      setComment('');
      await load();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'tasks.commentFailed'));
    return false;
  }, [comment, commenting, taskId, feedback, load, t]);

  const transitionLabel = useCallback((toStatus: string): string => (
    task?.status === BLOCKED_STATUS && toStatus === IN_PROGRESS_STATUS
      ? t('transitions.task.unblock')
      : t(`transitions.task.${toStatus}`, { defaultValue: toStatus })
  ), [task?.status, t]);

  const lastReview = task ? cmLatestReviewWithNotes(task) : null;
  const canDecide = task ? task.access.roles.includes(CM_TASK_MANAGER_ROLE) && task.access.can_review : false;

  return { task, loading, loadError, loadRetryable, load, reload, retry, lastReview, transitionLabel, canDecide, transition, comment, setComment, commenting, postComment };
}

export interface CmTaskSubmitModel {
  note: string;
  setNote: (value: string) => void;
  fileUrls: string;
  setFileUrls: (value: string) => void;
  uploads: File[];
  setUploads: (files: File[]) => void;
  invalidUrls: string[];
  rejectedUploads: File[];
  allowedDocumentTypes: string[];
  hasContent: boolean;
  canSubmit: boolean;
  busy: boolean;
  /** Submit the deliverables (note, links, uploads); first submission or resubmission after a revision request. */
  submit: () => Promise<boolean>;
}

/** Deliverable submission form of a task: note, link URLs and uploaded files checked against the server policy. */
export function useCmTaskSubmit(taskId: number, onSubmitted: () => Promise<void>, feedback: CmFeedback): CmTaskSubmitModel {
  const { t } = useTranslation('cm');
  const { allowedDocumentTypes } = useCmPolicy();
  const [note, setNote] = useState('');
  const [fileUrls, setFileUrls] = useState('');
  const [uploads, setUploads] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const urls = cmSplitList(fileUrls);
  const invalidUrls = urls.filter((url) => !URL_PATTERN.test(url));
  const hasContent = note.trim() !== '' || urls.length > 0 || uploads.length > 0;
  const rejectedUploads = uploads.filter((file) => !cmFileTypeAllowed(file.name, allowedDocumentTypes));
  const canSubmit = hasContent && invalidUrls.length === 0 && rejectedUploads.length === 0;

  const submit = useCallback(async (): Promise<boolean> => {
    if (busy || !canSubmit) return false;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.submitTask(taskId, note.trim(), urls, uploads);
    setBusy(false);
    if (response.success) {
      setNote('');
      setFileUrls('');
      setUploads([]);
      feedback.success(t('tasks.submitted'));
      await onSubmitted();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'tasks.submitFailed'));
    return false;
    // `urls` is derived from `fileUrls`; depend on the source string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, canSubmit, feedback, taskId, note, fileUrls, uploads, onSubmitted, t]);

  return { note, setNote, fileUrls, setFileUrls, uploads, setUploads, invalidUrls, rejectedUploads, allowedDocumentTypes, hasContent, canSubmit, busy, submit };
}
