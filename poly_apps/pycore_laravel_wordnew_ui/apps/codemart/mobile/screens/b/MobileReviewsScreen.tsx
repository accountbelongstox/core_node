import React, { useCallback, useState } from 'react';
import { CalendarDays, ClipboardCheck, Star } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import type { CmReviewSubmission } from '../../../api/CmApiTypes';
import { useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../../../contexts/CmBootstrapContext';
import { CM_REVIEW_RATING_VALUES, useCmReviewerApplication, useCmReviewerQueue } from '../../../shared/useCmReviews';
import { MobileButton, MobileCard, MobileListState, MobilePager, MobileScreen, MobileStatusBadge, useMobileFeedback } from '../../ui';
import { MobileCommentField } from './parts/MobileCommentField';
import { MobileEntityCard } from './parts/MobileEntityCard';
import { MobileRatingPicker } from './parts/MobileRatingPicker';
import { MobileReviewSheet } from './parts/MobileReviewSheet';
import { MobileTagList } from './parts/MobileTagList';
import './styles/cm-mobile-work.css';

const ReviewerApplication: React.FC<{ onPassed: (message: string) => Promise<void> }> = ({ onPassed }) => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const model = useCmReviewerApplication(onPassed, feedback);
  const { application, drafts, busy, draftsValid, updateDraft } = model;

  return (
    <>
      <MobileCard tone="accent">
        <h3 className="cmm-card-title"><Star aria-hidden="true" /> {t('reviews.applyTitle')}</h3>
        <p className="cmm-card-lead">{t('reviews.applyBody', { count: model.examCount, score: model.passScore })}</p>
        {!application && (
          <div className="cmm-stack-tight">
            <ol className="cmm-points">
              {(['start', 'rate', 'result'] as const).map((step) => <li key={step}>{t(`reviews.applySteps.${step}`, { count: model.examCount })}</li>)}
            </ol>
            <MobileButton variant="primary" block loading={busy} onClick={() => void model.apply()}>{busy ? t('common.loading') : t('reviews.apply')}</MobileButton>
          </div>
        )}
        {application?.instructions && <p className="cmm-hint">{application.instructions}</p>}
      </MobileCard>
      {application && application.test_cases.map((testCase, index) => (
        <MobileCard key={testCase.code_snippet_id}>
          <h3 className="cmm-card-title">{t('reviews.snippetTitle', { number: index + 1, total: application.test_cases.length })}</h3>
          <div className="cmm-stack-tight">
            <pre className="cmm-code"><code>{testCase.code}</code></pre>
            <MobileRatingPicker label={t('reviews.quality')} value={drafts[index].quality_rating} values={CM_REVIEW_RATING_VALUES} onChange={(value) => updateDraft(index, { quality_rating: Number(value) })} />
            <MobileRatingPicker label={t('reviews.readability')} value={drafts[index].readability_rating} values={CM_REVIEW_RATING_VALUES} onChange={(value) => updateDraft(index, { readability_rating: Number(value) })} />
            <MobileRatingPicker label={t('reviews.efficiency')} value={drafts[index].efficiency_rating} values={CM_REVIEW_RATING_VALUES} onChange={(value) => updateDraft(index, { efficiency_rating: Number(value) })} />
            <MobileCommentField label={t('reviews.comments')} value={drafts[index].comments} min={model.commentMinLength} onChange={(value) => updateDraft(index, { comments: value })} placeholder={t('reviews.commentsPlaceholder')} />
          </div>
        </MobileCard>
      ))}
      {application && (
        <div className="cmm-stickybar">
          <MobileButton variant="primary" loading={busy} disabled={!draftsValid} onClick={() => void model.submitTest()}>{busy ? t('common.saving') : t('reviews.submitTest')}</MobileButton>
        </div>
      )}
      {application && !draftsValid && <p className="cmm-hint">{t('reviews.testIncomplete', { min: model.commentMinLength })}</p>}
    </>
  );
};

/** Mobile reviews: the reviewer queue with a review sheet, or the reviewer qualification for accounts that are not reviewers yet. */
const MobileReviewsScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const { hasCapability, hasRole, refresh } = useCmBootstrap();
  const canReview = hasCapability('review.read') && hasRole('reviewer', 'active');
  const list = useCmReviewerQueue(canReview);
  const [openSubmission, setOpenSubmission] = useState<CmReviewSubmission | null>(null);

  const onPassed = useCallback(async (message: string): Promise<void> => {
    feedback.success(message);
    await refresh();
  }, [feedback, refresh]);

  const onReviewed = async (message: string): Promise<void> => {
    feedback.success(message);
    setOpenSubmission(null);
    await list.reload();
    await refresh();
  };

  return (
    <MobileScreen title={canReview ? t('nav.reviews') : t('nav.reviewerApply')} onRefresh={canReview ? () => list.reload() : undefined} className={canReview ? '' : 'is-fill'}>
      {!canReview && <ReviewerApplication onPassed={onPassed} />}
      {canReview && (
        <MobileListState
          loading={list.loading && list.items.length === 0}
          error={list.error}
          empty={list.items.length === 0}
          emptyTitle={t('reviews.emptyTitle')}
          emptyBody={t('reviews.emptyBody')}
          onRetry={list.retryable ? () => void list.reload() : undefined}
        >
          <div className="cmm-stack-tight" role="list" aria-label={t('nav.reviews')}>
            {list.items.map((submission) => (
              <MobileEntityCard
                key={submission.id}
                kicker={t('reviews.submissionTitle', { id: submission.id })}
                title={submission.task?.title ?? t('reviews.submissionTitle', { id: submission.id })}
                description={submission.task?.description}
                badge={<MobileStatusBadge group="submission" status={submission.status} />}
                meta={[submission.created_at && <><CalendarDays aria-hidden="true" />{t('reviews.submittedOn', { date: format.dateTime(submission.created_at) })}</>]}
                tags={<MobileTagList items={submission.task?.required_skills} />}
                onClick={() => setOpenSubmission(submission)}
              >
                <span className="cmm-link-btn"><ClipboardCheck aria-hidden="true" />{t('reviews.startReview')}</span>
              </MobileEntityCard>
            ))}
          </div>
          <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(page) => void list.load(page)} />
        </MobileListState>
      )}
      {openSubmission !== null && <MobileReviewSheet key={openSubmission.id} submission={openSubmission} onClose={() => setOpenSubmission(null)} onReviewed={onReviewed} />}
    </MobileScreen>
  );
};

export default MobileReviewsScreen;
