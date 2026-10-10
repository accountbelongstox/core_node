import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmEscrowRelease, CmListPage, CmSubmission } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { cmTotalPages, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import type { CmFeedback } from './cmFeedback';

export const CM_CLIENT_DECISIONS = ['approved', 'needs_revision', 'rejected'] as const;
export const CM_RATING_VALUES = [1, 2, 3, 4, 5] as const;
export const CM_APPROVED_DECISION = 'approved';
const TASK_REVIEW_STATUS = 'review';

const extractSubmissions = (data: CmListPage<CmSubmission>) => ({
  items: Array.isArray(data.items) ? data.items : [],
  totalPages: cmTotalPages(data),
});

export interface CmSubmissionDecision {
  decision: string;
  notes: string;
  /** Empty string = no rating. */
  rating: string;
}

export interface CmTaskSubmissionsModel {
  list: CmPagedList<CmSubmission>;
  /** Whether the viewer can decide on this submission now (manager, task in review, submission reviewable). */
  canDecide: (submission: CmSubmission) => boolean;
  deciding: boolean;
  /** Record the client decision; escrow release or failure is reported through the feedback channel. */
  decide: (submission: CmSubmission, input: CmSubmissionDecision) => Promise<boolean>;
}

/** Submissions of a task with files and reviews, and the project owner's approve / revise / reject decision. */
export function useCmTaskSubmissions(taskId: number, taskStatus: string, canReview: boolean, onChanged: (() => Promise<void>) | undefined, feedback: CmFeedback): CmTaskSubmissionsModel {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, stateRule } = useCmBootstrap();
  const currency = bootstrap?.vocabulary.policy.currency ?? null;
  const reviewableStates = stateRule('submission_reviewable');
  const fetcher = useCallback((page: number) => cmApi.getTaskSubmissions(taskId, page), [taskId]);
  const list = useCmPagedList(fetcher, extractSubmissions, 'submissions.loadFailed');
  const [deciding, setDeciding] = useState(false);
  const { reload } = list;

  const canDecide = useCallback((submission: CmSubmission): boolean => (
    canReview && taskStatus === TASK_REVIEW_STATUS && reviewableStates.includes(submission.status)
  ), [canReview, taskStatus, reviewableStates]);

  const reportEscrow = useCallback((escrow: CmEscrowRelease | null): void => {
    if (escrow === null) {
      feedback.success(t('submissions.reviewed'));
    } else if (escrow.released) {
      feedback.success(t('submissions.escrowReleased', {
        amount: format.money(escrow.net_amount ?? escrow.amount ?? '', currency),
        commission: format.money(escrow.commission ?? '', currency),
      }));
    } else {
      const key = escrow.error_code ? `errors.${escrow.error_code}` : 'errors.escrow_release_failed';
      feedback.error(t('submissions.escrowNotReleased', { reason: t(key, { defaultValue: t('errors.escrow_release_failed') }) }));
    }
  }, [feedback, format, currency, t]);

  const decide = useCallback(async (submission: CmSubmission, input: CmSubmissionDecision): Promise<boolean> => {
    if (deciding || !input.notes.trim()) return false;
    setDeciding(true);
    feedback.clear();
    const response = await cmApi.reviewSubmission(submission.id, {
      status: input.decision,
      review_notes: input.notes.trim(),
      rating: input.rating ? Number(input.rating) : null,
    });
    setDeciding(false);
    if (!response.success) {
      feedback.error(cmErrorMessage(t, response, 'submissions.reviewFailed'));
      return false;
    }
    reportEscrow(response.data?.escrow ?? null);
    await reload();
    if (onChanged) await onChanged();
    return true;
  }, [deciding, feedback, reportEscrow, reload, onChanged, t]);

  return { list, canDecide, deciding, decide };
}
