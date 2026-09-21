import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, FilePlus2, Inbox, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmAiAnalysis, CmProject } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

function parseProjects(data: unknown): CmProject[] {
  if (!data || typeof data !== 'object') return [];
  const source = data as { projects?: unknown };
  return Array.isArray(source.projects) ? (source.projects as CmProject[]) : [];
}

const analysisStorageKey = (projectId: number): string => `cm_analysis_${projectId}`;

function readStoredAnalysisId(projectId: number): number | null {
  try {
    const raw = window.localStorage.getItem(analysisStorageKey(projectId));
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function storeAnalysisId(projectId: number, analysisId: number | null): void {
  try {
    if (analysisId === null) {
      window.localStorage.removeItem(analysisStorageKey(projectId));
    } else {
      window.localStorage.setItem(analysisStorageKey(projectId), String(analysisId));
    }
  } catch {
    // storage unavailable: analysis tracking simply resets on reload
  }
}

const CmProjectAnalysisPanel: React.FC<{ project: CmProject; onChanged: () => Promise<void> }> = ({ project, onChanged }) => {
  const { t } = useTranslation('cm');
  const [analysis, setAnalysis] = useState<CmAiAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRevision, setShowRevision] = useState(false);
  const pollTimer = useRef<number | null>(null);

  const stopPolling = useCallback((): void => {
    if (pollTimer.current !== null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const fetchAnalysis = useCallback(async (analysisId: number): Promise<void> => {
    const response = await cmApi.getAnalysis(analysisId);
    if (response.success && response.data) {
      setAnalysis(response.data);
      if (response.data.status === 'completed' || response.data.status === 'failed') {
        stopPolling();
      }
    }
  }, [stopPolling]);

  const startPolling = useCallback((analysisId: number): void => {
    stopPolling();
    pollTimer.current = window.setInterval(() => {
      void fetchAnalysis(analysisId);
    }, 3000);
  }, [fetchAnalysis, stopPolling]);

  useEffect(() => {
    const storedId = readStoredAnalysisId(project.id);
    if (storedId !== null) {
      void fetchAnalysis(storedId).then(() => {
        startPolling(storedId);
      });
    }
    return () => stopPolling();
  }, [project.id, fetchAnalysis, startPolling, stopPolling]);

  const analyze = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    const response = await cmApi.analyzeProject(project.id);
    if (response.success && response.data) {
      storeAnalysisId(project.id, response.data.analysis_id);
      setNotice(t('analysis.started'));
      await fetchAnalysis(response.data.analysis_id);
      startPolling(response.data.analysis_id);
    } else {
      setNotice(response.error ?? t('analysis.startFailed'));
    }
    setBusy(false);
  };

  const accept = async (): Promise<void> => {
    if (!analysis) return;
    setBusy(true);
    const response = await cmApi.acceptAnalysis(analysis.analysis_id);
    setNotice(response.success ? t('analysis.accepted') : (response.error ?? t('analysis.acceptFailed')));
    if (response.success) {
      storeAnalysisId(project.id, null);
      await onChanged();
    }
    setBusy(false);
  };

  const requestRevision = async (): Promise<void> => {
    if (!analysis || !revisionNotes.trim()) return;
    setBusy(true);
    const response = await cmApi.requestAnalysisRevision(analysis.analysis_id, revisionNotes.trim());
    if (response.success) {
      setNotice(t('analysis.revisionSent'));
      setShowRevision(false);
      setRevisionNotes('');
      setAnalysis(null);
      startPolling(analysis.analysis_id);
      void fetchAnalysis(analysis.analysis_id);
    } else {
      setNotice(response.error ?? t('analysis.revisionFailed'));
    }
    setBusy(false);
  };

  return (
    <section className="cm-analysis-panel">
      {!analysis && (
        <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => void analyze()}>
          <Sparkles aria-hidden="true" /> {busy ? t('common.loading') : t('analysis.run')}
        </button>
      )}
      {analysis && (
        <div className="cm-analysis-result">
          <p className="cm-contract-note">
            {t('analysis.statusLabel')}: <span className="cm-status" data-status={analysis.status}>{t(`analysis.statuses.${analysis.status}`, { defaultValue: analysis.status })}</span>
          </p>
          {analysis.status === 'completed' && (
            <>
              {analysis.proposal && <p className="cm-analysis-proposal">{analysis.proposal}</p>}
              <div className="cm-record-card__meta">
                {analysis.estimated_hours !== null && <span>{t('analysis.hours', { hours: analysis.estimated_hours })}</span>}
                {analysis.estimated_cost !== null && <span>{t('analysis.cost', { cost: analysis.estimated_cost })}</span>}
              </div>
              {analysis.recommended_languages && analysis.recommended_languages.length > 0 && (
                <p className="cm-contract-note">{t('analysis.languages')}: {analysis.recommended_languages.join(', ')}</p>
              )}
              {analysis.recommended_frameworks && analysis.recommended_frameworks.length > 0 && (
                <p className="cm-contract-note">{t('analysis.frameworks')}: {analysis.recommended_frameworks.join(', ')}</p>
              )}
              <div className="cm-project-form__actions">
                <button type="button" className="cm-workspace-button is-primary" disabled={busy} onClick={() => void accept()}>
                  {t('analysis.accept')}
                </button>
                <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => setShowRevision((value) => !value)}>
                  {t('analysis.requestRevision')}
                </button>
              </div>
              {showRevision && (
                <div className="cm-analysis-revision">
                  <textarea
                    rows={3}
                    value={revisionNotes}
                    onChange={(event) => setRevisionNotes(event.target.value)}
                    placeholder={t('analysis.revisionPlaceholder')}
                  />
                  <button type="button" className="cm-workspace-button is-primary" disabled={busy || !revisionNotes.trim()} onClick={() => void requestRevision()}>
                    {t('analysis.sendRevision')}
                  </button>
                </div>
              )}
            </>
          )}
          {(analysis.status === 'processing' || analysis.status === 'revising') && (
            <p className="cm-contract-note">{t('analysis.waiting')}</p>
          )}
          {analysis.status === 'failed' && (
            <button type="button" className="cm-workspace-button" disabled={busy} onClick={() => void analyze()}>
              <Sparkles aria-hidden="true" /> {t('analysis.retry')}
            </button>
          )}
        </div>
      )}
      {notice && <p className="cm-contract-note">{notice}</p>}
    </section>
  );
};

export const CmProjectsPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { hasCapability, refresh } = useCmBootstrap();
  const canCreate = hasCapability('project.create');
  const [projects, setProjects] = useState<CmProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const response = await cmApi.getProjects();
    if (response.success) {
      setProjects(parseProjects(response.data));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async (projectId: number): Promise<void> => {
    setPublishingId(projectId);
    setNotice(null);
    const response = await cmApi.publishProject(projectId);
    setNotice(response.success ? t('projects.published') : t('projects.publishFailed'));
    setPublishingId(null);
    await load();
    await refresh();
  };

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('projects.eyebrow')}</span>
        <h1>{t('nav.myProjects')}</h1>
        <p>{t('projects.description')}</p>
        {canCreate && (
          <Link to="/codemart/projects/new" className="cm-workspace-button is-primary">
            <FilePlus2 aria-hidden="true" /> {t('nav.createProject')}
          </Link>
        )}
      </header>
      {notice && <p className="cm-contract-note">{notice}</p>}
      {loading ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : projects.length === 0 ? (
        <section className="cm-marketplace-empty">
          <BriefcaseBusiness aria-hidden="true" />
          <h2>{t('projects.emptyTitle')}</h2>
          <p>{t('projects.emptyBody')}</p>
        </section>
      ) : (
        <section className="cm-card-list">
          {projects.map((project) => (
            <article key={project.id} className="cm-record-card">
              <div className="cm-record-card__main">
                <h2>{project.title}</h2>
                <p>{project.description}</p>
                <div className="cm-record-card__meta">
                  <span>{project.currency ?? ''} {project.budget ?? t('common.unavailable')}</span>
                  <span className="cm-status" data-status={project.status}>{t(`states.project.${project.status}`)}</span>
                </div>
              </div>
              <Link to={`/codemart/projects/${project.id}`} className="cm-workspace-button">
                {t('projects.openDetail')}
              </Link>
              {project.status === 'draft' && canCreate && (
                <button
                  type="button"
                  className="cm-workspace-button is-primary"
                  disabled={publishingId === project.id}
                  onClick={() => void publish(project.id)}
                >
                  {publishingId === project.id ? t('common.loading') : t('projects.publish')}
                </button>
              )}
              {(project.status === 'draft' || project.status === 'proposal_review') && canCreate && (
                <CmProjectAnalysisPanel project={project} onChanged={load} />
              )}
            </article>
          ))}
        </section>
      )}
      {projects.length === 0 && !loading && canCreate && (
        <section className="cm-dashboard-section">
          <Inbox aria-hidden="true" />
        </section>
      )}
    </main>
  );
};

export const CmProjectCreatePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { hasCapability, refresh } = useCmBootstrap();
  const canCreate = hasCapability('project.create');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [complexity, setComplexity] = useState('medium');
  const [budget, setBudget] = useState('');
  const [budgetType, setBudgetType] = useState('fixed');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canCreate || pending) return;
    setPending(true);
    setNotice(null);
    const response = await cmApi.createProject({
      title,
      description,
      complexity,
      budget: Number(budget),
      budget_type: budgetType,
      currency: 'CNY',
    });
    if (response.success) {
      setNotice(t('projectCreate.created'));
      setTitle('');
      setDescription('');
      setBudget('');
      await refresh();
    } else {
      setNotice(response.error ?? t('projectCreate.createFailed'));
    }
    setPending(false);
  };

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('projects.eyebrow')}</span>
        <h1>{t('projectCreate.title')}</h1>
        <p>{t('projectCreate.subtitle')}</p>
      </header>
      {!canCreate && <p className="cm-contract-note">{t('projectCreate.noCapability')}</p>}
      {notice && <p className="cm-contract-note">{notice}</p>}
      <form className="cm-project-form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>{t('projectCreate.projectTitle')}</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('projectCreate.projectTitlePlaceholder')} required />
        </label>
        <label className="is-wide">
          <span>{t('projectCreate.summary')}</span>
          <textarea rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('projectCreate.summaryPlaceholder')} required />
        </label>
        <label>
          <span>{t('projectCreate.complexity')}</span>
          <select value={complexity} onChange={(event) => setComplexity(event.target.value)}>
            {['simple', 'medium', 'complex', 'very_complex'].map((value) => (
              <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('projectCreate.budget')}</span>
          <input type="number" min={100} value={budget} onChange={(event) => setBudget(event.target.value)} required />
        </label>
        <label>
          <span>{t('projectCreate.budgetType')}</span>
          <select value={budgetType} onChange={(event) => setBudgetType(event.target.value)}>
            <option value="fixed">{t('projectCreate.budgetFixed')}</option>
            <option value="hourly">{t('projectCreate.budgetHourly')}</option>
          </select>
        </label>
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={!canCreate || pending}>
            {pending ? t('common.loading') : t('projectCreate.submit')}
          </button>
        </div>
      </form>
    </main>
  );
};

export default CmProjectsPage;
