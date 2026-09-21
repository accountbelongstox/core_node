import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw, Star, Workflow } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type {
  CmArchitectEligibility,
  CmArchitectTasks,
  CmReviewerApplicationStart,
  CmReviewSubmission,
} from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

interface CmTestDraft {
  quality_rating: number;
  readability_rating: number;
  efficiency_rating: number;
  comments: string;
}

const emptyDraft = (): CmTestDraft => ({
  quality_rating: 3,
  readability_rating: 3,
  efficiency_rating: 3,
  comments: '',
});

const CmRatingSelect: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => (
  <label className="cm-rating-field">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {[1, 2, 3, 4, 5].map((score) => (
        <option key={score} value={score}>{score}</option>
      ))}
    </select>
  </label>
);

const CmReviewerApplication: React.FC<{ onPassed: () => Promise<void> }> = ({ onPassed }) => {
  const { t } = useTranslation('cm');
  const [application, setApplication] = useState<CmReviewerApplicationStart | null>(null);
  const [drafts, setDrafts] = useState<CmTestDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    const response = await cmApi.applyReviewer();
    if (response.success && response.data) {
      setApplication(response.data);
      setDrafts(response.data.test_cases.map(() => emptyDraft()));
    } else {
      setNotice(response.error ?? t('reviews.applyFailed'));
    }
    setBusy(false);
  };

  const updateDraft = (index: number, patch: Partial<CmTestDraft>): void => {
    setDrafts((current) => current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)));
  };

  const submitTest = async (): Promise<void> => {
    if (!application || busy) return;
    setBusy(true);
    setNotice(null);
    const reviews = application.test_cases.map((testCase, index) => ({
      code_snippet_id: testCase.code_snippet_id,
      quality_rating: drafts[index].quality_rating,
      readability_rating: drafts[index].readability_rating,
      efficiency_rating: drafts[index].efficiency_rating,
      comments: drafts[index].comments,
    }));
    const response = await cmApi.submitReviewerTest(application.application_id, reviews);
    if (response.success && response.data) {
      setNotice(response.data.status === 'passed' ? t('reviews.testPassed') : t('reviews.testFailed', { score: response.data.similarity_score }));
      if (response.data.status === 'passed') {
        setApplication(null);
        await onPassed();
      }
    } else {
      setNotice(response.error ?? t('reviews.testSubmitFailed'));
    }
    setBusy(false);
  };

  const draftsValid = drafts.length > 0 && drafts.every((draft) => draft.comments.trim().length >= 20);

  return (
    <section className="cm-dashboard-section">
      <h2><Star aria-hidden="true" /> {t('reviews.applyTitle')}</h2>
      <p className="cm-contract-note">{t('reviews.applyBody')}</p>
      {!application && (
        <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void apply()}>
          {busy ? t('common.loading') : t('reviews.apply')}
        </button>
      )}
      {application && (
        <div className="cm-reviewer-test">
          <p className="cm-contract-note">{application.instructions}</p>
          {application.test_cases.map((testCase, index) => (
            <article key={testCase.code_snippet_id} className="cm-record-card">
              <pre className="cm-code-snippet"><code>{testCase.code}</code></pre>
              <div className="cm-rating-row">
                <CmRatingSelect label={t('reviews.quality')} value={drafts[index].quality_rating} onChange={(value) => updateDraft(index, { quality_rating: value })} />
                <CmRatingSelect label={t('reviews.readability')} value={drafts[index].readability_rating} onChange={(value) => updateDraft(index, { readability_rating: value })} />
                <CmRatingSelect label={t('reviews.efficiency')} value={drafts[index].efficiency_rating} onChange={(value) => updateDraft(index, { efficiency_rating: value })} />
              </div>
              <textarea
                rows={3}
                value={drafts[index].comments}
                onChange={(event) => updateDraft(index, { comments: event.target.value })}
                placeholder={t('reviews.commentsPlaceholder')}
              />
            </article>
          ))}
          <button type="button" className="cm-workspace-button is-primary" disabled={busy || !draftsValid} onClick={() => void submitTest()}>
            {busy ? t('common.loading') : t('reviews.submitTest')}
          </button>
        </div>
      )}
      {notice && <p className="cm-contract-note">{notice}</p>}
    </section>
  );
};

const CmReviewDecisionPanel: React.FC<{ submission: CmReviewSubmission; onChanged: () => Promise<void> }> = ({ submission, onChanged }) => {
  const { t } = useTranslation('cm');
  const [quality, setQuality] = useState(3);
  const [readability, setReadability] = useState(3);
  const [efficiency, setEfficiency] = useState(3);
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submitReview = async (): Promise<void> => {
    if (busy || comments.trim().length < 20) return;
    setBusy(true);
    setNotice(null);
    const response = await cmApi.submitCodeReview(submission.id, {
      quality_rating: quality,
      readability_rating: readability,
      efficiency_rating: efficiency,
      comments: comments.trim(),
    });
    if (response.success) {
      setNotice(t('reviews.submitted'));
      await onChanged();
    } else {
      setNotice(response.error ?? t('reviews.submitFailed'));
    }
    setBusy(false);
  };

  return (
    <div className="cm-task-work">
      <div className="cm-rating-row">
        <CmRatingSelect label={t('reviews.quality')} value={quality} onChange={setQuality} />
        <CmRatingSelect label={t('reviews.readability')} value={readability} onChange={setReadability} />
        <CmRatingSelect label={t('reviews.efficiency')} value={efficiency} onChange={setEfficiency} />
      </div>
      <textarea
        rows={3}
        value={comments}
        onChange={(event) => setComments(event.target.value)}
        placeholder={t('reviews.commentsPlaceholder')}
      />
      <button
        type="button"
        className="cm-workspace-button is-primary"
        disabled={busy || comments.trim().length < 20}
        onClick={() => void submitReview()}
      >
        {busy ? t('common.loading') : t('reviews.submitReview')}
      </button>
      {notice && <p className="cm-contract-note">{notice}</p>}
    </div>
  );
};

export const CmReviewsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { hasCapability, refresh } = useCmBootstrap();
  const canReview = hasCapability('review.read');
  const [tasks, setTasks] = useState<CmReviewSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getReviewTasks();
    if (response.success && response.data && Array.isArray(response.data.pending_reviews)) {
      setTasks(response.data.pending_reviews);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (canReview) {
      void load();
    } else {
      setLoading(false);
    }
  }, [canReview, load]);

  const onPassed = useCallback(async (): Promise<void> => {
    await refresh();
    await load();
  }, [refresh, load]);

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('reviews.eyebrow')}</span>
        <h1>{t('nav.reviews')}</h1>
        <p>{t('reviews.description')}</p>
        {canReview && (
          <button type="button" className="cm-workspace-button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> {t('common.refresh')}
          </button>
        )}
      </header>
      {!canReview && (
        <>
          <p className="cm-contract-note">{t('reviews.noCapability')}</p>
          <CmReviewerApplication onPassed={onPassed} />
        </>
      )}
      {canReview && (
        loading ? (
          <p className="cm-contract-note">{t('common.loading')}</p>
        ) : tasks.length === 0 ? (
          <section className="cm-marketplace-empty">
            <ClipboardCheck aria-hidden="true" />
            <h2>{t('reviews.emptyTitle')}</h2>
            <p>{t('reviews.emptyBody')}</p>
          </section>
        ) : (
          <section className="cm-card-list">
            {tasks.map((task) => (
              <article key={task.id} className="cm-record-card">
                <div className="cm-record-card__main">
                  <h2>{t('reviews.submissionTitle', { id: task.id })}</h2>
                  <p>{task.submission_note ?? ''}</p>
                </div>
                <CmReviewDecisionPanel submission={task} onChanged={load} />
              </article>
            ))}
          </section>
        )
      )}
    </main>
  );
};

export const CmArchitectPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [eligibility, setEligibility] = useState<CmArchitectEligibility | null>(null);
  const [assignments, setAssignments] = useState<CmArchitectTasks | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [eligibilityResponse, tasksResponse] = await Promise.all([
      cmApi.getArchitectEligibility(),
      cmApi.getArchitectTasks(),
    ]);
    if (eligibilityResponse.success && eligibilityResponse.data) {
      setEligibility(eligibilityResponse.data);
    }
    if (tasksResponse.success && tasksResponse.data) {
      setAssignments(tasksResponse.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingActivation = eligibility?.architect_status === 'pending';
  const isArchitect = eligibility?.is_architect === true || assignments?.is_architect === true;

  const apply = async (): Promise<void> => {
    const response = await cmApi.applyArchitect();
    if (response.success) {
      setNotice(t('architect.applied'));
    } else {
      setNotice(response.error ?? t('architect.applyFailed'));
    }
    await load();
  };

  const completeActivation = async (): Promise<void> => {
    const response = await cmApi.completeArchitectDeposit();
    if (response.success) {
      setNotice(t('architect.activated'));
    } else {
      setNotice(response.error ?? t('architect.activationFailed'));
    }
    await load();
  };

  const acceptProject = async (projectId: number): Promise<void> => {
    setAcceptingId(projectId);
    setNotice(null);
    const response = await cmApi.acceptArchitectTask(projectId);
    setNotice(response.success ? t('architect.projectAccepted') : (response.error ?? t('architect.acceptFailed')));
    setAcceptingId(null);
    await load();
  };

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('architect.eyebrow')}</span>
        <h1>{t('nav.architect')}</h1>
        <p>{t('architect.description')}</p>
      </header>
      {notice && <p className="cm-contract-note">{notice}</p>}
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : (
        <>
          <section className="cm-dashboard-section">
            <h2><Workflow aria-hidden="true" /> {t('architect.eligibilityTitle')}</h2>
            {eligibility ? (
              <>
                <p className="cm-contract-note">
                  {eligibility.is_eligible
                    ? t('architect.eligible')
                    : t(`architect.reasons.${eligibility.reason ?? 'requirements_unmet'}`)}
                </p>
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th>{t('architect.metric')}</th>
                      <th>{t('architect.current')}</th>
                      <th>{t('architect.required')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(eligibility.requirements).map(([key, required]) => (
                      <tr key={key}>
                        <td>{t(`architect.metrics.${key}`)}</td>
                        <td>{eligibility.current_stats[key.replace('min_', '')] ?? t('common.unavailable')}</td>
                        <td>{required}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {eligibility.is_eligible && !pendingActivation && (
                  <button type="button" className="cm-workspace-button is-primary" onClick={() => void apply()}>
                    {t('architect.apply')}
                  </button>
                )}
              </>
            ) : (
              <p className="cm-contract-note">{t('architect.noData')}</p>
            )}
            {pendingActivation && (
              <div className="cm-task-work">
                <p className="cm-contract-note">
                  {t('architect.activationHint', { amount: eligibility?.required_deposit ?? 0 })}
                </p>
                <button type="button" className="cm-workspace-button is-primary" onClick={() => void completeActivation()}>
                  {t('architect.completeActivation')}
                </button>
              </div>
            )}
          </section>
          {isArchitect && assignments && (
            <>
              <section className="cm-dashboard-section">
                <h2>{t('architect.assignmentsTitle')}</h2>
                <div className="cm-card-list">
                  {assignments.assigned_projects.map((project) => (
                    <article key={project.id} className="cm-record-card">
                      <div className="cm-record-card__main">
                        <h2>{project.title}</h2>
                        <div className="cm-record-card__meta">
                          <span className="cm-status" data-status={project.status}>{t(`states.project.${project.status}`)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                  {assignments.assigned_projects.length === 0 && (
                    <p className="cm-contract-note">{t('architect.noAssignments')}</p>
                  )}
                </div>
              </section>
              <section className="cm-dashboard-section">
                <h2>{t('architect.availableTitle')}</h2>
                <div className="cm-card-list">
                  {assignments.available_projects.map((project) => (
                    <article key={project.id} className="cm-record-card">
                      <div className="cm-record-card__main">
                        <h2>{project.title}</h2>
                        <div className="cm-record-card__meta">
                          <span className="cm-status" data-status={project.status}>{t(`states.project.${project.status}`)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="cm-workspace-button is-primary"
                        disabled={acceptingId === project.id}
                        onClick={() => void acceptProject(project.id)}
                      >
                        {acceptingId === project.id ? t('common.loading') : t('architect.acceptProject')}
                      </button>
                    </article>
                  ))}
                  {assignments.available_projects.length === 0 && (
                    <p className="cm-contract-note">{t('architect.noAvailable')}</p>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
};

export default CmReviewsPage;
