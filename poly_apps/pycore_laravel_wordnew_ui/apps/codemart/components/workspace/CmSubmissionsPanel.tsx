import React, { useState } from 'react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import type { CmCodeReview, CmSubmission } from '../../api/CmApiTypes';
import { CM_APPROVED_DECISION, CM_CLIENT_DECISIONS, CM_RATING_VALUES, useCmTaskSubmissions, type CmSubmissionDecision } from '../../shared/useCmTaskSubmissions';
import { CmPager } from './CmPager';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from './CmStateViews';
import { CmStatusBadge } from './CmStatusBadge';
import { CmSubmissionFiles } from './CmSubmissionFiles';
import { cmUserLabel, useCmFormat } from './cmWorkspaceFormat';

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

const CmClientReviewForm: React.FC<{ submission: CmSubmission; onDecide: (submission: CmSubmission, input: CmSubmissionDecision) => Promise<boolean>; busy: boolean }> = ({ submission, onDecide, busy }) => {
  const { t } = useTranslation('cm');
  const [decision, setDecision] = useState<string>(CM_CLIENT_DECISIONS[0]);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState('');

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    await onDecide(submission, { decision, notes, rating });
  };

  return (
    <form className="cm-project-form cm-inline-form" onSubmit={(event) => void submit(event)} noValidate>
      <h4 className="is-wide">{t('submissions.decisionTitle')}</h4>
      <label>
        <span>{t('submissions.decision')}</span>
        <select value={decision} onChange={(event) => setDecision(event.target.value)}>
          {CM_CLIENT_DECISIONS.map((value) => (
            <option key={value} value={value}>{t(`submissions.decisions.${value}`)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('submissions.ratingLabel')} <small className="cm-field-hint">{t('common.optional')}</small></span>
        <select value={rating} onChange={(event) => setRating(event.target.value)}>
          <option value="">{t('submissions.noRating')}</option>
          {CM_RATING_VALUES.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
      <label className="is-wide">
        <span>{t('submissions.notes')}</span>
        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('submissions.notesPlaceholder')} />
      </label>
      {decision === CM_APPROVED_DECISION && <p className="cm-field-hint is-wide">{t('submissions.approveHint')}</p>}
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

/** Task submissions with files and reviews; managers decide on reviewable submissions, others read only. */
export const CmSubmissionsPanel: React.FC<CmSubmissionsPanelProps> = ({ taskId, taskStatus, canReview, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const notice = useCmNotice();
  const { list, canDecide, deciding, decide } = useCmTaskSubmissions(taskId, taskStatus, canReview, onChanged, notice);

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
            {canDecide(submission) && <CmClientReviewForm submission={submission} onDecide={decide} busy={deciding} />}
          </article>
        ))
      )}
      <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />
    </div>
  );
};

export default CmSubmissionsPanel;
