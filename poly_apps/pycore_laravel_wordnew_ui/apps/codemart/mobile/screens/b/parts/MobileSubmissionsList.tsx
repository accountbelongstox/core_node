import React, { useState } from 'react';
import { Gavel } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmSubmission } from '../../../../api/CmApiTypes';
import { cmUserLabel, useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { useCmTaskSubmissions } from '../../../../shared/useCmTaskSubmissions';
import { MobileButton, MobileErrorState, MobilePager, MobileSkeletonBlock, MobileStatusBadge, useMobileFeedback } from '../../../ui';
import { MobileDecisionSheet } from './MobileDecisionSheet';
import { MobileReviewHistory } from './MobileReviewHistory';
import { MobileSubmissionFiles } from './MobileSubmissionFiles';

interface MobileSubmissionsListProps {
  taskId: number;
  taskStatus: string;
  canReview: boolean;
  onChanged?: () => Promise<void>;
}

/** Submissions of a task with files and reviews; the project owner decides on reviewable ones. */
export const MobileSubmissionsList: React.FC<MobileSubmissionsListProps> = ({ taskId, taskStatus, canReview, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const { list, canDecide, deciding, decide } = useCmTaskSubmissions(taskId, taskStatus, canReview, onChanged, feedback);
  const [pendingDecision, setDecidingSubmission] = useState<CmSubmission | null>(null);

  const submitDecision = async (input: Parameters<typeof decide>[1]): Promise<void> => {
    if (pendingDecision && await decide(pendingDecision, input)) setDecidingSubmission(null);
  };

  return (
    <>
      {list.loading && list.items.length === 0 ? <MobileSkeletonBlock height={72} /> : list.error ? (
        <MobileErrorState message={list.error} onRetry={list.retryable ? () => void list.reload() : undefined} />
      ) : list.items.length === 0 ? (
        <p className="cmm-hint">{t('submissions.empty')}</p>
      ) : (
        <>
          <div className="cmm-stack-tight">
            {list.items.map((submission) => (
              <article key={submission.id} className="cmm-subcard">
                <div className="cmm-entity__head">
                  <h3>{t('reviews.submissionTitle', { id: submission.id })}</h3>
                  <MobileStatusBadge group="submission" status={submission.status} />
                </div>
                <div className="cmm-entity__meta">
                  <span>{cmUserLabel(submission.submitter, t('common.unavailable'))}</span>
                  <span>{format.dateTime(submission.created_at)}</span>
                </div>
                {submission.submission_note && <p className="cmm-prose">{submission.submission_note}</p>}
                <MobileSubmissionFiles submissionId={submission.id} files={submission.files} />
                <MobileReviewHistory reviews={submission.reviews} />
                {canDecide(submission) && (
                  <MobileButton variant="primary" block icon={<Gavel aria-hidden="true" />} onClick={() => setDecidingSubmission(submission)}>{t('submissions.decisionTitle')}</MobileButton>
                )}
              </article>
            ))}
          </div>
          <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(page) => void list.load(page)} />
        </>
      )}
      <MobileDecisionSheet open={pendingDecision !== null} submissionId={pendingDecision?.id ?? null} busy={deciding} onClose={() => setDecidingSubmission(null)} onSubmit={submitDecision} />
    </>
  );
};
