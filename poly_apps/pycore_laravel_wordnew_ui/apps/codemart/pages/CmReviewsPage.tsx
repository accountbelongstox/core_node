import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, CircleDashed, ClipboardCheck, Plus, RefreshCw, Star, Trash2, Workflow } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type {
  CmArchitectEligibility,
  CmArchitectProject,
  CmArchitectTasks,
  CmLineComment,
  CmReviewerApplicationStart,
  CmReviewSubmission,
} from '../api/CmApiTypes';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmPager } from '../components/workspace/CmPager';
import { CmEmptyState, CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { CmSubmissionFiles } from '../components/workspace/CmSubmissionFiles';
import { cmFormatNumber, cmTotalPages, useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList } from '../components/workspace/useCmPagedList';

const REVIEW_COMMENT_MIN_LENGTH = 20;
const REVIEW_RECOMMENDATIONS = ['approved', 'needs_revision', 'rejected'] as const;
const RATING_VALUES = [1, 2, 3, 4, 5] as const;
const DEFAULT_RATING = 3;
const PASSED_STATUS = 'passed';
const PENDING_STATUS = 'pending';
const DEFAULT_CURRENCY = 'CNY';
const ARCHITECT_METRIC_STAT_KEYS: Record<string, string> = {
  min_completed_projects: 'completed_projects',
  min_avg_code_score: 'avg_code_score',
  min_client_satisfaction: 'avg_client_satisfaction',
};

interface CmLineCommentDraft {
  file: string;
  line: string;
  comment: string;
}

interface CmTestDraft {
  quality_rating: number;
  readability_rating: number;
  efficiency_rating: number;
  comments: string;
}

const emptyDraft = (): CmTestDraft => ({
  quality_rating: DEFAULT_RATING,
  readability_rating: DEFAULT_RATING,
  efficiency_rating: DEFAULT_RATING,
  comments: '',
});

const CmRatingSelect: React.FC<{ label: string; value: number | ''; onChange: (value: number | '') => void; allowEmpty?: string }> = ({ label, value, onChange, allowEmpty }) => (
  <label className="cm-rating-field">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}>
      {allowEmpty && <option value="">{allowEmpty}</option>}
      {RATING_VALUES.map((score) => (
        <option key={score} value={score}>{score}</option>
      ))}
    </select>
  </label>
);

const CmCommentField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder: string }> = ({ label, value, onChange, placeholder }) => {
  const { t } = useTranslation('cm');
  const length = value.trim().length;
  return (
    <label className="cm-stacked-field">
      <span>{label}</span>
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={length > 0 && length < REVIEW_COMMENT_MIN_LENGTH} />
      <small className={length > 0 && length < REVIEW_COMMENT_MIN_LENGTH ? 'cm-field-error' : 'cm-field-hint'}>
        {t('reviews.commentCounter', { count: length, min: REVIEW_COMMENT_MIN_LENGTH })}
      </small>
    </label>
  );
};

const CmReviewerApplication: React.FC<{ onPassed: () => Promise<void> }> = ({ onPassed }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [application, setApplication] = useState<CmReviewerApplicationStart | null>(null);
  const [drafts, setDrafts] = useState<CmTestDraft[]>([]);
  const [busy, setBusy] = useState(false);

  const apply = async (): Promise<void> => {
    setBusy(true);
    notice.clear();
    const response = await cmApi.applyReviewer();
    setBusy(false);
    if (response.success && response.data) {
      setApplication(response.data);
      setDrafts(response.data.test_cases.map(() => emptyDraft()));
    } else {
      notice.error(cmErrorMessage(t, response, 'reviews.applyFailed'));
    }
  };

  const updateDraft = (index: number, patch: Partial<CmTestDraft>): void => {
    setDrafts((current) => current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)));
  };

  const draftsValid = drafts.length > 0 && drafts.every((draft) => draft.comments.trim().length >= REVIEW_COMMENT_MIN_LENGTH);

  const submitTest = async (): Promise<void> => {
    if (!application || busy || !draftsValid) return;
    setBusy(true);
    notice.clear();
    const reviews = application.test_cases.map((testCase, index) => ({
      code_snippet_id: testCase.code_snippet_id,
      quality_rating: drafts[index].quality_rating,
      readability_rating: drafts[index].readability_rating,
      efficiency_rating: drafts[index].efficiency_rating,
      comments: drafts[index].comments.trim(),
    }));
    const response = await cmApi.submitReviewerTest(application.application_id, reviews);
    setBusy(false);
    if (response.success && response.data) {
      if (response.data.status === PASSED_STATUS) {
        notice.success(t('reviews.testPassed'));
        setApplication(null);
        await onPassed();
      } else {
        notice.error(t('reviews.testFailed', { score: response.data.similarity_score }));
        setApplication(null);
      }
    } else {
      notice.error(cmErrorMessage(t, response, 'reviews.testSubmitFailed'));
    }
  };

  return (
    <section className="cm-section-card">
      <h2><Star aria-hidden="true" /> {t('reviews.applyTitle')}</h2>
      <p className="cm-section-card__lead">{t('reviews.applyBody')}</p>
      {!application && (
        <ol className="cm-flow-steps is-compact">
          {(['start', 'rate', 'result'] as const).map((step, index) => (
            <li key={step}><strong>{index + 1}</strong><span>{t(`reviews.applySteps.${step}`)}</span></li>
          ))}
        </ol>
      )}
      {!application && (
        <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void apply()}>
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
              <CmCommentField label={t('reviews.comments')} value={drafts[index].comments} onChange={(value) => updateDraft(index, { comments: value })} placeholder={t('reviews.commentsPlaceholder')} />
            </article>
          ))}
          <div className="cm-table-actions">
            <button type="button" className="cm-workspace-button is-primary" disabled={busy || !draftsValid} onClick={() => void submitTest()}>
              {busy ? t('common.saving') : t('reviews.submitTest')}
            </button>
            {!draftsValid && <small className="cm-field-hint">{t('reviews.testIncomplete')}</small>}
          </div>
        </div>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

const CmReviewDecisionPanel: React.FC<{ submission: CmReviewSubmission; onChanged: () => Promise<void> }> = ({ submission, onChanged }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [quality, setQuality] = useState(DEFAULT_RATING);
  const [readability, setReadability] = useState(DEFAULT_RATING);
  const [efficiency, setEfficiency] = useState(DEFAULT_RATING);
  const [security, setSecurity] = useState<number | ''>('');
  const [recommendation, setRecommendation] = useState('');
  const [comments, setComments] = useState('');
  const [lineComments, setLineComments] = useState<CmLineCommentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const valid = comments.trim().length >= REVIEW_COMMENT_MIN_LENGTH;

  const updateLine = (index: number, patch: Partial<CmLineCommentDraft>): void => {
    setLineComments((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  };

  const submitReview = async (): Promise<void> => {
    if (busy || !valid) return;
    setBusy(true);
    notice.clear();
    const lines: CmLineComment[] = lineComments
      .filter((line) => line.comment.trim() !== '')
      .map((line) => ({ file: line.file.trim(), line: line.line ? Number(line.line) : undefined, comment: line.comment.trim() }));
    const response = await cmApi.submitCodeReview(submission.id, {
      quality_rating: quality,
      readability_rating: readability,
      efficiency_rating: efficiency,
      security_rating: security === '' ? null : security,
      recommendation: recommendation || null,
      comments: comments.trim(),
      line_comments: lines.length > 0 ? lines : null,
    });
    setBusy(false);
    if (response.success) {
      notice.success(t('reviews.submittedWithScore', { score: response.data?.code_score ?? '' }));
      await onChanged();
    } else {
      notice.error(cmErrorMessage(t, response, 'reviews.submitFailed'));
    }
  };

  return (
    <div className="cm-inline-form cm-review-form">
      <h4>{t('reviews.formTitle')}</h4>
      <div className="cm-rating-row">
        <CmRatingSelect label={t('reviews.quality')} value={quality} onChange={(value) => setQuality(Number(value))} />
        <CmRatingSelect label={t('reviews.readability')} value={readability} onChange={(value) => setReadability(Number(value))} />
        <CmRatingSelect label={t('reviews.efficiency')} value={efficiency} onChange={(value) => setEfficiency(Number(value))} />
        <CmRatingSelect label={t('reviews.security')} value={security} onChange={setSecurity} allowEmpty={t('submissions.noRating')} />
        <label className="cm-rating-field">
          <span>{t('reviews.recommendation')}</span>
          <select value={recommendation} onChange={(event) => setRecommendation(event.target.value)}>
            <option value="">{t('reviews.noRecommendation')}</option>
            {REVIEW_RECOMMENDATIONS.map((value) => (
              <option key={value} value={value}>{t(`submissions.decisions.${value}`)}</option>
            ))}
          </select>
        </label>
      </div>
      <CmCommentField label={t('reviews.comments')} value={comments} onChange={setComments} placeholder={t('reviews.commentsPlaceholder')} />
      <div className="cm-drawer__section">
        <h3>{t('reviews.lineComments')} <small className="cm-field-hint">{t('common.optional')}</small></h3>
        {lineComments.map((line, index) => (
          <div key={index} className="cm-line-comment-row">
            <input value={line.file} onChange={(event) => updateLine(index, { file: event.target.value })} placeholder={t('reviews.lineFile')} aria-label={t('reviews.lineFile')} />
            <input type="number" min={1} value={line.line} onChange={(event) => updateLine(index, { line: event.target.value })} placeholder={t('reviews.lineNumber')} aria-label={t('reviews.lineNumber')} />
            <input value={line.comment} onChange={(event) => updateLine(index, { comment: event.target.value })} placeholder={t('reviews.lineComment')} aria-label={t('reviews.lineComment')} />
            <button
              type="button"
              className="cm-workspace-button is-small"
              aria-label={t('reviews.removeLineComment')}
              onClick={() => setLineComments((current) => current.filter((_, position) => position !== index))}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="cm-workspace-button is-small" onClick={() => setLineComments((current) => [...current, { file: '', line: '', comment: '' }])}>
            <Plus aria-hidden="true" /> {t('reviews.addLineComment')}
          </button>
        </div>
      </div>
      <div className="cm-table-actions">
        <button type="button" className="cm-workspace-button is-primary" disabled={busy || !valid} onClick={() => void submitReview()}>
          {busy ? t('common.saving') : t('reviews.submitReview')}
        </button>
      </div>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </div>
  );
};

const extractReviews = (data: { pending_reviews: CmReviewSubmission[]; pagination: unknown }) => ({
  items: Array.isArray(data.pending_reviews) ? data.pending_reviews : [],
  totalPages: cmTotalPages(data.pagination as Parameters<typeof cmTotalPages>[0]),
});
const fetchReviews = (page: number) => cmApi.getReviewTasks(page);

export const CmReviewsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { hasCapability, refresh } = useCmBootstrap();
  const canReview = hasCapability('review.read');
  const list = useCmPagedList(fetchReviews, extractReviews, 'reviews.loadFailed', canReview);
  const [openId, setOpenId] = useState<number | null>(null);

  const onPassed = useCallback(async (): Promise<void> => {
    await refresh();
  }, [refresh]);

  const onReviewed = async (): Promise<void> => {
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
      {!canReview && <CmReviewerApplication onPassed={onPassed} />}
      {canReview && (
        list.loading ? (
          <CmLoadingState />
        ) : list.error ? (
          <CmErrorState message={list.error} onRetry={() => void list.reload()} />
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

const CmArchitectProjectList: React.FC<{
  titleKey: string;
  emptyKey: string;
  projects: CmArchitectProject[];
  renderAction: (project: CmArchitectProject) => React.ReactNode;
}> = ({ titleKey, emptyKey, projects, renderAction }) => {
  const { t } = useTranslation('cm');
  return (
    <section className="cm-section-card">
      <h2>{t(titleKey)}</h2>
      {projects.length === 0 ? (
        <p className="cm-field-hint">{t(emptyKey)}</p>
      ) : (
        <ul className="cm-preview-list">
          {projects.map((project) => (
            <li key={project.id} className="cm-preview-list__row">
              <span className="cm-preview-list__title">{project.title}</span>
              <CmStatusBadge group="project" status={project.status} />
              {renderAction(project)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const CmArchitectPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, refresh } = useCmBootstrap();
  const currency = bootstrap?.vocabulary.policy.currency ?? DEFAULT_CURRENCY;
  const notice = useCmNotice();
  const [eligibility, setEligibility] = useState<CmArchitectEligibility | null>(null);
  const [assignments, setAssignments] = useState<CmArchitectTasks | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [eligibilityResponse, tasksResponse] = await Promise.all([
      cmApi.getArchitectEligibility(),
      cmApi.getArchitectTasks(),
    ]);
    if (eligibilityResponse.success && eligibilityResponse.data) {
      setEligibility(eligibilityResponse.data);
      setLoadError(null);
    } else {
      setLoadError(cmErrorMessage(t, eligibilityResponse, 'architect.loadFailed'));
    }
    if (tasksResponse.success && tasksResponse.data) setAssignments(tasksResponse.data);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingActivation = eligibility?.architect_status === PENDING_STATUS;
  const isArchitect = eligibility?.is_architect === true || assignments?.is_architect === true;

  const runAction = async (action: () => Promise<APIResponse<unknown>>, successKey: string, failKey: string): Promise<void> => {
    setBusy(true);
    notice.clear();
    const result = await action();
    setBusy(false);
    if (result.success) {
      notice.success(t(successKey));
      await refresh();
    } else {
      notice.error(cmErrorMessage(t, result, failKey));
    }
    await load();
  };

  const acceptProject = async (projectId: number): Promise<void> => {
    setAcceptingId(projectId);
    notice.clear();
    const response = await cmApi.acceptArchitectTask(projectId);
    setAcceptingId(null);
    if (response.success) notice.success(t('architect.projectAccepted'));
    else notice.error(cmErrorMessage(t, response, 'architect.acceptFailed'));
    await load();
  };

  return (
    <main className="cm-workspace-page">
      <CmPageHeader
        eyebrowKey="architect.eyebrow"
        titleKey={isArchitect ? 'nav.architect' : 'nav.architectApply'}
        purposeKey={isArchitect ? 'architect.description' : 'architect.applyPurpose'}
        actions={(
          <button type="button" className="cm-workspace-button" onClick={() => void load()} disabled={loading}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
        )}
      />
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
      {loading && !eligibility ? (
        <CmLoadingState />
      ) : loadError || !eligibility ? (
        <CmErrorState message={loadError ?? t('architect.loadFailed')} onRetry={() => void load()} />
      ) : (
        <>
          {!isArchitect && (
            <section className="cm-section-card">
              <h2><Workflow aria-hidden="true" /> {t('architect.eligibilityTitle')}</h2>
              <p className="cm-section-card__lead">
                {eligibility.is_eligible ? t('architect.eligible') : t(`architect.reasons.${eligibility.reason ?? 'requirements_unmet'}`, { defaultValue: t('architect.reasons.requirements_unmet') })}
              </p>
              <ul className="cm-requirement-list">
                {Object.entries(eligibility.requirements).map(([key, required]) => {
                  const current = eligibility.current_stats[ARCHITECT_METRIC_STAT_KEYS[key] ?? key.replace('min_', '')];
                  const met = typeof current === 'number' && current >= required;
                  return (
                    <li key={key} data-met={met}>
                      {met ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                      <span>{t(`architect.metrics.${key}`, { defaultValue: key })}</span>
                      <strong>{t('architect.progressValue', { current: current === undefined ? t('common.unavailable') : cmFormatNumber(current, format.language), required: cmFormatNumber(required, format.language) })}</strong>
                    </li>
                  );
                })}
              </ul>
              {eligibility.is_eligible && !pendingActivation && (
                <div className="cm-section-card__actions">
                  <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void runAction(() => cmApi.applyArchitect(), 'architect.applied', 'architect.applyFailed')}>
                    {busy ? t('common.saving') : t('architect.apply')}
                  </button>
                </div>
              )}
              {pendingActivation && (
                <div className="cm-confirm-box">
                  <p>{t('architect.activationHint', { amount: format.money(eligibility.required_deposit ?? 0, currency) })}</p>
                  <div className="cm-table-actions">
                    <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void runAction(() => cmApi.completeArchitectDeposit(), 'architect.activated', 'architect.activationFailed')}>
                      {busy ? t('common.saving') : t('architect.completeActivation')}
                    </button>
                    <Link to="/codemart/wallet" className="cm-workspace-button">{t('funding.openWallet')}</Link>
                  </div>
                </div>
              )}
            </section>
          )}
          {isArchitect && assignments && (
            <>
              <CmArchitectProjectList
                titleKey="architect.assignmentsTitle"
                emptyKey="architect.noAssignments"
                projects={assignments.assigned_projects}
                renderAction={(project) => (
                  <Link to={`/codemart/projects/${project.id}`} className="cm-workspace-button is-small">
                    {t('projects.openDetail')} <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              />
              <CmArchitectProjectList
                titleKey="architect.availableTitle"
                emptyKey="architect.noAvailable"
                projects={assignments.available_projects}
                renderAction={(project) => (
                  <button
                    type="button"
                    className="cm-workspace-button is-small is-primary"
                    disabled={acceptingId !== null}
                    onClick={() => void acceptProject(project.id)}
                  >
                    {acceptingId === project.id ? t('common.saving') : t('architect.acceptProject')}
                  </button>
                )}
              />
            </>
          )}
        </>
      )}
    </main>
  );
};

export default CmReviewsPage;
