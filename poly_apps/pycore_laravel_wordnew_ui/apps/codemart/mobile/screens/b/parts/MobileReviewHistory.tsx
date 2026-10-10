import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmCodeReview } from '../../../../api/CmApiTypes';
import { cmUserLabel, useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { MobileStatusBadge } from '../../../ui';

/** Reviews recorded on one submission: reviewer or client, decision, scores, notes and line comments. */
export const MobileReviewHistory: React.FC<{ reviews: CmCodeReview[] | undefined }> = ({ reviews }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const list = reviews ?? [];
  if (list.length === 0) return <p className="cmm-hint">{t('submissions.noReviews')}</p>;
  return (
    <div className="cmm-stack-tight">
      {list.map((review) => {
        const scores = [
          review.code_score !== null && review.code_score !== undefined ? t('submissions.codeScore', { score: review.code_score }) : null,
          review.rating !== null && review.rating !== undefined ? t('submissions.rating', { rating: review.rating }) : null,
          review.security_rating !== null && review.security_rating !== undefined ? t('submissions.securityRating', { rating: review.security_rating }) : null,
        ].filter(Boolean);
        return (
          <div key={review.id} className="cmm-reviewline">
            <div className="cmm-entity__head">
              <strong>{t(`submissions.reviewKinds.${review.review_kind ?? 'reviewer'}`, { defaultValue: review.review_kind ?? '' })}</strong>
              <MobileStatusBadge group="submission" status={review.recommendation ?? review.status} />
            </div>
            <div className="cmm-entity__meta">
              {review.reviewer && <span>{cmUserLabel(review.reviewer, '')}</span>}
              {scores.length > 0 && <span>{scores.join(' · ')}</span>}
              <span>{format.dateTime(review.created_at)}</span>
            </div>
            {(review.review_notes || review.comments) && <p>{review.review_notes || review.comments}</p>}
            {Array.isArray(review.line_comments) && review.line_comments.length > 0 && (
              <ul className="cmm-filelist">
                {review.line_comments.map((line, index) => (
                  <li key={index}><span><code>{t('submissions.lineRef', { file: line.file ?? '', line: line.line ?? '' })}</code> {line.comment ?? ''}</span></li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};
