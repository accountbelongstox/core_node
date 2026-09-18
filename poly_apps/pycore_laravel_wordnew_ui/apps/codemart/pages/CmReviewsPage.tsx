import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw, Workflow } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

interface CmReviewTask {
  id: number;
  task_id?: number;
  submission_note?: string | null;
  status?: string;
  created_at?: string | null;
}

interface CmArchitectEligibility {
  is_eligible: boolean;
  requirements: Record<string, number>;
  current_stats: Record<string, number>;
  shortfall: Record<string, number>;
}

interface CmArchitectTasks {
  assigned_projects: { id: number; title: string; status: string }[];
  available_projects: { id: number; title: string; status: string }[];
}

export const CmReviewsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { hasCapability } = useCmBootstrap();
  const canReview = hasCapability('review.read');
  const [tasks, setTasks] = useState<CmReviewTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.get<{ pending_reviews?: CmReviewTask[] }>('reviewer/tasks');
    if (response.success && response.data && Array.isArray(response.data.pending_reviews)) {
      setTasks(response.data.pending_reviews);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('reviews.eyebrow')}</span>
        <h1>{t('nav.reviews')}</h1>
        <p>{t('reviews.description')}</p>
        <button type="button" className="cm-workspace-button" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" /> {t('common.refresh')}
        </button>
      </header>
      {!canReview && <p className="cm-contract-note">{t('reviews.noCapability')}</p>}
      {loading ? (
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
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export const CmArchitectPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { hasCapability } = useCmBootstrap();
  const canArchitect = hasCapability('architect.read');
  const [eligibility, setEligibility] = useState<CmArchitectEligibility | null>(null);
  const [assignments, setAssignments] = useState<CmArchitectTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [eligibilityResponse, tasksResponse] = await Promise.all([
      cmApi.get<CmArchitectEligibility>('architect/eligibility'),
      cmApi.get<CmArchitectTasks>('architect/tasks'),
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

  const apply = async (): Promise<void> => {
    const response = await cmApi.post<unknown>('architect/apply', {});
    setNotice(response.success ? t('architect.applied') : (response.error ?? t('architect.applyFailed')));
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
                  {eligibility.is_eligible ? t('architect.eligible') : t('architect.notEligible')}
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
                {eligibility.is_eligible && (
                  <button type="button" className="cm-workspace-button is-primary" onClick={() => void apply()}>
                    {t('architect.apply')}
                  </button>
                )}
              </>
            ) : (
              <p className="cm-contract-note">{t('architect.noData')}</p>
            )}
          </section>
          {canArchitect && assignments && (
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
          )}
        </>
      )}
    </main>
  );
};

export default CmReviewsPage;
