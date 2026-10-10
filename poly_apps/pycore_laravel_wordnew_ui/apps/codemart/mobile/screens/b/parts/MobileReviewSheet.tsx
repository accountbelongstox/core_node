import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmReviewSubmission } from '../../../../api/CmApiTypes';
import { CM_REVIEW_RATING_VALUES, CM_REVIEW_RECOMMENDATIONS, useCmReviewDecision } from '../../../../shared/useCmReviews';
import { MobileButton, MobileField, MobileSectionHeader, MobileSheet, useMobileFeedback, MobileTagList } from '../../../ui';
import { MobileCommentField } from './MobileCommentField';
import { MobileRatingPicker } from './MobileRatingPicker';
import { MobileSubmissionFiles } from './MobileSubmissionFiles';

interface MobileReviewSheetProps {
  submission: CmReviewSubmission;
  onClose: () => void;
  onReviewed: (message: string) => Promise<void>;
}

/** Reviewer assessment of one submission: delivered work, dimensional scores, recommendation, comment (policy minimum) and line comments. */
export const MobileReviewSheet: React.FC<MobileReviewSheetProps> = ({ submission, onClose, onReviewed }) => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const form = useCmReviewDecision(submission.id, onReviewed, feedback);

  return (
    <MobileSheet
      open
      onClose={onClose}
      title={submission.task?.title ?? t('reviews.submissionTitle', { id: submission.id })}
      footer={(
        <>
          <MobileButton disabled={form.busy} onClick={onClose}>{t('common.cancel')}</MobileButton>
          <MobileButton variant="primary" loading={form.busy} disabled={!form.valid} onClick={() => void form.submit()}>{form.busy ? t('common.saving') : t('reviews.submitReview')}</MobileButton>
        </>
      )}
    >
      <div className="cmm-stack">
        <section className="cmm-stack-tight">
          <small className="cmm-entity__kicker">{t('reviews.submissionTitle', { id: submission.id })}</small>
          {submission.task?.description && <p className="cmm-prose">{submission.task.description}</p>}
          <MobileTagList items={submission.task?.required_skills} />
        </section>
        {submission.submission_note && (
          <section className="cmm-stack-tight">
            <MobileSectionHeader title={t('reviews.deliveryNote')} />
            <p className="cmm-prose">{submission.submission_note}</p>
          </section>
        )}
        <section className="cmm-stack-tight">
          <MobileSectionHeader title={t('reviews.deliveredFiles')} />
          <MobileSubmissionFiles submissionId={submission.id} files={submission.files} />
        </section>
        <section className="cmm-stack-tight">
          <MobileSectionHeader title={t('reviews.formTitle')} />
          <MobileRatingPicker label={t('reviews.quality')} value={form.quality} values={CM_REVIEW_RATING_VALUES} onChange={(value) => form.setQuality(Number(value))} />
          <MobileRatingPicker label={t('reviews.readability')} value={form.readability} values={CM_REVIEW_RATING_VALUES} onChange={(value) => form.setReadability(Number(value))} />
          <MobileRatingPicker label={t('reviews.efficiency')} value={form.efficiency} values={CM_REVIEW_RATING_VALUES} onChange={(value) => form.setEfficiency(Number(value))} />
          <MobileRatingPicker label={t('reviews.security')} value={form.security} values={CM_REVIEW_RATING_VALUES} onChange={form.setSecurity} emptyLabel={t('submissions.noRating')} />
          <MobileField label={t('reviews.recommendation')}>
            <select className="cmm-input cmm-select" value={form.recommendation} onChange={(event) => form.setRecommendation(event.target.value)}>
              <option value="">{t('reviews.noRecommendation')}</option>
              {CM_REVIEW_RECOMMENDATIONS.map((value) => <option key={value} value={value}>{t(`submissions.decisions.${value}`)}</option>)}
            </select>
          </MobileField>
          <MobileCommentField label={t('reviews.comments')} value={form.comments} min={form.commentMinLength} onChange={form.setComments} placeholder={t('reviews.commentsPlaceholder')} />
        </section>
        <section className="cmm-stack-tight">
          <MobileSectionHeader title={`${t('reviews.lineComments')} (${t('common.optional')})`} />
          {form.lineComments.map((line, index) => (
            <div key={index} className="cmm-linecomment-row">
              <input className="cmm-input" value={line.file} onChange={(event) => form.updateLine(index, { file: event.target.value })} placeholder={t('reviews.lineFile')} aria-label={t('reviews.lineFile')} />
              <input className="cmm-input" type="number" min={1} inputMode="numeric" value={line.line} onChange={(event) => form.updateLine(index, { line: event.target.value })} placeholder={t('reviews.lineNumber')} aria-label={t('reviews.lineNumber')} />
              <button type="button" className="cmm-icon-btn" aria-label={t('reviews.removeLineComment')} onClick={() => form.removeLine(index)}><Trash2 aria-hidden="true" /></button>
              <input className="cmm-input" value={line.comment} onChange={(event) => form.updateLine(index, { comment: event.target.value })} placeholder={t('reviews.lineComment')} aria-label={t('reviews.lineComment')} />
            </div>
          ))}
          <div className="cmm-row-actions"><MobileButton small icon={<Plus aria-hidden="true" />} onClick={form.addLineComment}>{t('reviews.addLineComment')}</MobileButton></div>
        </section>
      </div>
    </MobileSheet>
  );
};
