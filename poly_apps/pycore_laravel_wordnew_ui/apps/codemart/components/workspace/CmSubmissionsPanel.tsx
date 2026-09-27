import React, { useCallback, useState } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import type { CmCodeReview, CmEscrowRelease, CmListPage, CmSubmission } from '../../api/CmApiTypes';
import { cmErrorMessage } from '../../api/cmErrors';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { CmPager } from './CmPager';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from './CmStateViews';
import { CmStatusBadge } from './CmStatusBadge';
import { CmSubmissionFiles } from './CmSubmissionFiles';
import { cmTotalPages, cmUserLabel, useCmFormat } from './cmWorkspaceFormat';
import { useCmPagedList } from './useCmPagedList';

const CLIENT_DECISIONS = ['approved', 'needs_revision', 'rejected'] as const;
const REVIEWABLE_SUBMISSION_STATUSES = new Set(['pending', 'pending_review']);
const TASK_REVIEW_STATUS = 'review';
const RATING_VALUES = [1, 2, 3, 4, 5] as const;
const APPROVED_DECISION = 'approved';

export const CmReviewList: React.FC<{ reviews: CmCodeReview[] | undefined }> = ({ reviews }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = reviews ?? [];
  if (list.length === 0) return <p className="cm-field-hint">{t('submissions.noReviews')}</p>;
  return (
    <ul className="cm-review-list">
      {list.map((review) => {
        const decision = review.recommendation ?? review.status;
        return (
          <li key={review.id}>
            <div className="cm-record-card__meta">
              <strong>{t(`submissions.reviewKinds.${review.review_kind ?? 'reviewer'}`, { defaultValue: review.review_kind ?? '' })}</strong>
              <span>{cmUserLabel(review.reviewer, t('common.unavailable'))}</span>
              <CmStatusBadge group="submission" status={decision} />
              {review.code_score !== null && review.code_score !== undefined && (
                <span>{t('submissions.codeScore', { score: review.code_score })}</span>
              )}
              {review.rating !== null && review.rating !== undefined && (
                <span>{t('submissions.rating', { rating: review.rating })}</span>
              )}
              {review.security_rating !== null && review.security_rating !== undefined && (
                <span>{t('submissions.securityRating', { rating: review.security_rating })}</span>
              )}
              <span>{format.dateTime(review.created_at)}</span>
            </div>
            {(review.review_notes || review.comments) && <p>{review.review_notes || review.comments}</p>}
            {Array.isArray(review.line_comments) && review.line_comments.length > 0 && (
              <ul className="cm-line-comments">
                {review.line_comments.map((line, index) => (
                  <li key={index}>
                    <code>{t('submissions.lineRef', { file: line.file ?? '', line: line.line ?? '' })}</code> {line.comment ?? ''}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const CmClientReviewForm: React.FC<{ submission: CmSubmission; onReviewed: (escrow: CmEscrowRelease | null) => Promise<void> }> = ({ submission, onReviewed }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [decision, setDecision] = useState<string>(CLIENT_DECISIONS[0]);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || !notes.trim()) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.reviewSubmission(submission.id, {
      status: decision,
      review_notes: notes.trim(),
      rating: rating ? Number(rating) : null,
    });
    setBusy(false);
    if (response.success) {
      await onReviewed(response.data?.escrow ?? null);
    } else {
      notice.error(cmErrorMessage(t, response, 'submissions.reviewFailed'));
    }
  };

  return (
    <form className="cm-project-form cm-inline-form" onSubmit={(event) => void submit(event)} noValidate>
      <h4 className="is-wide">{t('submissions.decisionTitle')}</h4>
      <label>
        <span>{t('submissions.decision')}</span>
        <select value={decision} onChange={(event) => setDecision(event.target.value)}>
          {CLIENT_DECISIONS.map((value) => (
            <option key={value} value={value}>{t(`submissions.decisions.${value}`)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('submissions.ratingLabel')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <select value={rating} onChange={(event) => setRating(event.target.value)}>
          <option value="">{t('submissions.noRating')}</option>
          {RATING_VALUES.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
      <label className="is-wide">
        <span>{t('submissions.notes')}</span>
        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('submissions.notesPlaceholder')} />
      </label>
      {decision === APPROVED_DECISION && <p className="cm-field-hint is-wide">{t('submissions.approveHint')}</p>}
      {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
      <div className="cm-project-form__actions">
        <button type="submit" className="is-primary" disabled={busy || !notes.trim()}>
          {busy ? t('common.saving') : t('submissions.submitDecision')}
        </button>
      </div>
    </form>
  );
};

interface CmSubmissionsPanelProps {
  taskId: number;
  taskStatus: string;
  canReview: boolean;
  onChanged?: () => Promise<void>;
}

const extractSubmissions = (data: CmListPage<CmSubmission>) => ({
  items: Array.isArray(data.items) ? data.items : [],
  totalPages: cmTotalPages(data),
});

/** Task submissions with files and reviews; managers decide on reviewable submissions, others read only. */
export const CmSubmissionsPanel: React.FC<CmSubmissionsPanelProps> = ({ taskId, taskStatus, canReview, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const { bootstrap } = useCmBootstrap();
  const currency = bootstrap?.vocabulary.policy.currency ?? null;
  const fetcher = useCallback((page: number) => cmApi.getTaskSubmissions(taskId, page), [taskId]);
  const list = useCmPagedList(fetcher, extractSubmissions, 'submissions.loadFailed');

  const onReviewed = async (escrow: CmEscrowRelease | null): Promise<void> => {
    if (escrow === null) {
      notice.success(t('submissions.reviewed'));
    } else if (escrow.released) {
      notice.success(t('submissions.escrowReleased', {
        amount: format.money(escrow.net_amount ?? escrow.amount ?? '', currency),
        commission: format.money(escrow.commission ?? '', currency),
      }));
    } else {
      const key = escrow.error_code ? `errors.${escrow.error_code}` : 'errors.escrow_release_failed';
      notice.error(t('submissions.escrowNotReleased', { reason: t(key, { defaultValue: t('errors.escrow_release_failed') }) }));
    }
    await list.reload();
    if (onChanged) await onChanged();
  };

  return (
    <div className="cm-submissions-panel">
      <h4>{t('submissions.title')}</h4>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {list.loading ? (
        <CmLoadingState compact />
      ) : list.error ? (
        <CmErrorState compact message={list.error} onRetry={() => void list.reload()} />
      ) : list.items.length === 0 ? (
        <p className="cm-field-hint">{t('submissions.empty')}</p>
      ) : (
        list.items.map((submission) => (
          <article key={submission.id} className="cm-submission-card">
            <div className="cm-record-card__meta">
              <strong>{t('reviews.submissionTitle', { id: submission.id })}</strong>
              <CmStatusBadge group="submission" status={submission.status} />
              <span>{cmUserLabel(submission.submitter, t('common.unavailable'))}</span>
              <span>{format.dateTime(submission.created_at)}</span>
            </div>
            {submission.submission_note && <p>{submission.submission_note}</p>}
            <CmSubmissionFiles submissionId={submission.id} files={submission.files} />
            <CmReviewList reviews={submission.reviews} />
            {canReview && taskStatus === TASK_REVIEW_STATUS && REVIEWABLE_SUBMISSION_STATUSES.has(submission.status) && (
              <CmClientReviewForm submission={submission} onReviewed={onReviewed} />
            )}
          </article>
        ))
      )}
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </div>
  );
};

export default CmSubmissionsPanel;
