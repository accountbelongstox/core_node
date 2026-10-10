import React, { useCallback, useState } from 'react';
import { CalendarDays, ClipboardCheck, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { CmReviewSubmission } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { CmSubmissionFiles } from '../components/workspace/CmSubmissionFiles';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import {
  CM_REVIEW_RATING_VALUES,
  CM_REVIEW_RECOMMENDATIONS,
  useCmReviewDecision,
  useCmReviewerApplication,
  useCmReviewerQueue,
} from '../shared/useCmReviews';

const CmRatingSelect: React.FC<{ label: string; value: number | ''; onChange: (value: number | '') => void; allowEmpty?: string }> = ({ label, value, onChange, allowEmpty }) => (
  <label className="cm-rating-field">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}>
      {allowEmpty && <option value="">{allowEmpty}</option>}
      {CM_REVIEW_RATING_VALUES.map((score) => (
        <option key={score} value={score}>{score}</option>
      ))}
    </select>
  </label>
);

const CmCommentField: React.FC<{ label: string; value: string; min: number; onChange: (value: string) => void; placeholder: string }> = ({ label, value, min, onChange, placeholder }) => {
  const { t } = useTranslation('cm');
  const length = value.trim().length;
  return (
    <label className="cm-stacked-field">
      <span>{label}</span>
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={length > 0 && length < min} />
      <small className={length > 0 && length < min ? 'cm-field-error' : 'cm-field-hint'}>
        {t('reviews.commentCounter', { count: length, min })}
      </small>
    </label>
  );
};

const CmReviewerApplication: React.FC<{ onPassed: (message: string) => Promise<void> }> = ({ onPassed }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const model = useCmReviewerApplication(onPassed, notice);
  const { application, drafts, busy, draftsValid, updateDraft } = model;
  const reviewerExamCount = model.examCount;
  const reviewerPassScore = model.passScore;
  const reviewCommentMinLength = model.commentMinLength;

  return (
    <section className="cm-section-card">
      <h2><Star aria-hidden="true" /> {t('reviews.applyTitle')}</h2>
      <p className="cm-section-card__lead">{t('reviews.applyBody', { count: reviewerExamCount, score: reviewerPassScore })}</p>
      {!application && (
        <ol className="cm-flow-steps is-compact">
          {(['start', 'rate', 'result'] as const).map((step, index) => (
            <li key={step}><strong>{index + 1}</strong><span>{t(`reviews.applySteps.${step}`, { count: reviewerExamCount })}</span></li>
          ))}
        </ol>
      )}
      {!application && (
        <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void model.apply()}>
          {busy ? t('common.loading') : t('reviews.apply')}
        </button>
      )}
      {application && (
        <div className="cm-reviewer-test">
          {application.instructions && <CmNotice notice={{ tone: 'info', text: application.instructions }} />}
          {application.test_cases.map((testCase, index) => (
            <article key={testCase.code_snippet_id} className="cm-milestone-card">
              <h3 className="cm-reviewer-test__title">{t('reviews.snippetTitle', { number: index + 1, total: application.test_cases.length })}</h3>
              <pre className="cm-code-snippet"><code>{testCase.code}</code></pre>
              <div className="cm-rating-row">
                <CmRatingSelect label={t('reviews.quality')} value={drafts[index].quality_rating} onChange={(value) => updateDraft(index, { quality_rating: Number(value) })} />
                <CmRatingSelect label={t('reviews.readability')} value={drafts[index].readability_rating} onChange={(value) => updateDraft(index, { readability_rating: Number(value) })} />
                <CmRatingSelect label={t('reviews.efficiency')} value={drafts[index].efficiency_rating} onChange={(value) => updateDraft(index, { efficiency_rating: Number(value) })} />
              </div>
              <CmCommentField label={t('reviews.comments')} value={drafts[index].comments} min={reviewCommentMinLength} onChange={(value) => updateDraft(index, { comments: value })} placeholder={t('reviews.commentsPlaceholder')} />
            </article>
          ))}
          <div className="cm-table-actions">
            <button type="button" className="cm-workspace-button is-primary" disabled={busy || !draftsValid} onClick={() => void model.submitTest()}>
              {busy ? t('common.saving') : t('reviews.submitTest')}
            </button>
            {!draftsValid && <small className="cm-field-hint">{t('reviews.testIncomplete', { min: reviewCommentMinLength })}</small>}
          </div>
        </div>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

const CmReviewDecisionPanel: React.FC<{ submission: CmReviewSubmission; onChanged: (message: string) => Promise<void> }> = ({ submission, onChanged }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const form = useCmReviewDecision(submission.id, onChanged, notice);

  return (
    <div className="cm-inline-form cm-review-form">
      <h4>{t('reviews.formTitle')}</h4>
      <div className="cm-rating-row">
        <CmRatingSelect label={t('reviews.quality')} value={form.quality} onChange={(value) => form.setQuality(Number(value))} />
        <CmRatingSelect label={t('reviews.readability')} value={form.readability} onChange={(value) => form.setReadability(Number(value))} />
        <CmRatingSelect label={t('reviews.efficiency')} value={form.efficiency} onChange={(value) => form.setEfficiency(Number(value))} />
        <CmRatingSelect label={t('reviews.security')} value={form.security} onChange={form.setSecurity} allowEmpty={t('submissions.noRating')} />
        <label className="cm-rating-field">
          <span>{t('reviews.recommendation')}</span>
          <select value={form.recommendation} onChange={(event) => form.setRecommendation(event.target.value)}>
            <option value="">{t('reviews.noRecommendation')}</option>
            {CM_REVIEW_RECOMMENDATIONS.map((value) => (
              <option key={value} value={value}>{t(`submissions.decisions.${value}`)}</option>
            ))}
          </select>
        </label>
      </div>
      <CmCommentField label={t('reviews.comments')} value={form.comments} min={form.commentMinLength} onChange={form.setComments} placeholder={t('reviews.commentsPlaceholder')} />
      <div className="cm-drawer__section">
        <h3>{t('reviews.lineComments')} <small className="cm-field-hint">{t('common.optional')}</small></h3>
        {form.lineComments.map((line, index) => (
          <div key={index} className="cm-line-comment-row">
            <input value={line.file} onChange={(event) => form.updateLine(index, { file: event.target.value })} placeholder={t('reviews.lineFile')} aria-label={t('reviews.lineFile')} />
            <input type="number" min={1} value={line.line} onChange={(event) => form.updateLine(index, { line: event.target.value })} placeholder={t('reviews.lineNumber')} aria-label={t('reviews.lineNumber')} />
            <input value={line.comment} onChange={(event) => form.updateLine(index, { comment: event.target.value })} placeholder={t('reviews.lineComment')} aria-label={t('reviews.lineComment')} />
            <button
              type="button"
              className="cm-workspace-button is-small"
              aria-label={t('reviews.removeLineComment')}
              onClick={() => form.removeLine(index)}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="cm-workspace-button is-small" onClick={form.addLineComment}>
            <Plus aria-hidden="true" /> {t('reviews.addLineComment')}
          </button>
        </div>
      </div>
      <div className="cm-table-actions">
        <button type="button" className="cm-workspace-button is-primary" disabled={form.busy || !form.valid} onClick={() => void form.submit()}>
          {form.busy ? t('common.saving') : t('reviews.submitReview')}
        </button>
      </div>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </div>
  );
};

export const CmReviewsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { hasCapability, hasRole, refresh } = useCmBootstrap();
  const canReview = hasCapability('review.read') && hasRole('reviewer', 'active');
  const list = useCmReviewerQueue(canReview);
  const pageNotice = useCmNotice();
  const [openId, setOpenId] = useState<number | null>(null);

  const onPassed = useCallback(async (message: string): Promise<void> => {
    pageNotice.success(message);
    await refresh();
  }, [pageNotice.success, refresh]);

  const onReviewed = async (message: string): Promise<void> => {
    pageNotice.success(message);
    setOpenId(null);
    await list.reload();
    await refresh();
  };

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="reviews.eyebrow"
        titleKey={canReview ? 'nav.reviews' : 'nav.reviewerApply'}
        purposeKey={canReview ? 'reviews.description' : 'reviews.applyPurpose'}
        actions={canReview ? (
          <button type="button" className="cm-workspace-button" onClick={() => void list.reload()} disabled={list.loading}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
        ) : undefined}
      />
      <CmNotice notice={pageNotice.notice} onDismiss={pageNotice.clear} />
      {!canReview && <CmReviewerApplication onPassed={onPassed} />}
      {canReview && (
        list.loading ? (
          <CmLoadingState />
        ) : list.error ? (
          <CmErrorState message={list.error} onRetry={list.retryable ? () => void list.reload() : undefined} />
        ) : list.items.length === 0 ? (
          <CmEmptyState title={t('reviews.emptyTitle')} body={t('reviews.emptyBody')} />
        ) : (
          <section className="cm-card-list" aria-label={t('nav.reviews')}>
            {list.items.map((submission) => (
              <article key={submission.id} className="cm-record-card is-stacked">
                <div className="cm-record-card__main">
                  <small className="cm-record-card__kicker">{t('reviews.submissionTitle', { id: submission.id })}</small>
                  <h2>{submission.task?.title ?? t('reviews.submissionTitle', { id: submission.id })}</h2>
                  {submission.task?.description && <p>{submission.task.description}</p>}
                  <div className="cm-record-card__meta">
                    <CmStatusBadge group="submission" status={submission.status} />
                    {submission.created_at && <span><CalendarDays aria-hidden="true" /> {t('reviews.submittedOn', { date: format.dateTime(submission.created_at) })}</span>}
                  </div>
                  {(submission.task?.required_skills ?? []).length > 0 && (
                    <ul className="cm-chip-list">{(submission.task?.required_skills ?? []).map((skill) => <li key={skill}>{skill}</li>)}</ul>
                  )}
                  {submission.submission_note && (
                    <div className="cm-drawer__section">
                      <h3>{t('reviews.deliveryNote')}</h3>
                      <p className="cm-project-description">{submission.submission_note}</p>
                    </div>
                  )}
                  <div className="cm-drawer__section">
                    <h3>{t('reviews.deliveredFiles')}</h3>
                    <CmSubmissionFiles submissionId={submission.id} files={submission.files} />
                  </div>
                </div>
                {openId === submission.id ? (
                  <CmReviewDecisionPanel submission={submission} onChanged={onReviewed} />
                ) : (
                  <button type="button" className="cm-workspace-button is-primary" onClick={() => setOpenId(submission.id)}>
                    <ClipboardCheck aria-hidden="true" /> {t('reviews.startReview')}
                  </button>
                )}
              </article>
            ))}
          </section>
        )
      )}
      {canReview && <CmPager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(next) => void list.load(next)} />}
    </main>
  );
};

export default CmReviewsPage;
