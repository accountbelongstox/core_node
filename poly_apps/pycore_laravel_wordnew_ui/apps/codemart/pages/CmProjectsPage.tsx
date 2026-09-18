import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, FilePlus2, Inbox, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProject } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

function parseProjects(data: unknown): CmProject[] {
  if (!data || typeof data !== 'object') return [];
  const source = data as { projects?: unknown };
  return Array.isArray(source.projects) ? (source.projects as CmProject[]) : [];
}

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
