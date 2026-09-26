import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BriefcaseBusiness, CalendarClock, ChevronLeft, ChevronRight, RotateCw, Trophy } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { cmPublicApi, type CmShowcaseProject, type CmShowcaseSection, type CmShowcaseTask } from '../api/CmPublicApi';
import { formatCmAmountRange, formatCmDate } from '../components/public-home/cmPublicFormat';
import { CmPublicIllustration, CmPublicSplit } from '../components/public-home/CmPublicBlocks';
import { CmPublicCta } from '../components/public-home/CmPublicCta';
import { CmPublicPage } from '../components/public-home/CmPublicPage';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { useCmProtectedNavigate } from '../components/public-home/useCmProtectedNavigate';

type CmShowcaseKind = 'open_tasks' | 'completed_projects';

interface CmShowcaseSectionState<T> {
  page: number;
  section: CmShowcaseSection<T> | null;
  loading: boolean;
  error: string | null;
}

type CmShowcaseSectionHook<T> = CmShowcaseSectionState<T> & { setPage: (page: number) => void; retry: () => void };

const SHOWCASE_PAGE_SIZE = 9;
const OPEN_TASKS_ANCHOR = 'cm-showcase-open-tasks';
const COMPLETED_ANCHOR = 'cm-showcase-completed';
const SHOWCASE_INTRO_POINTS = ['redacted', 'accept', 'completed'];

function useShowcaseSection<T>(kind: CmShowcaseKind): CmShowcaseSectionHook<T> {
  const { t } = useTranslation('cm');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [section, setSection] = useState<CmShowcaseSection<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void cmPublicApi.getShowcase(page, SHOWCASE_PAGE_SIZE).then((response) => {
      if (!active) return;
      setLoading(false);
      if (response.success && response.data) {
        setSection(response.data[kind] as unknown as CmShowcaseSection<T>);
      } else {
        setError(cmErrorMessage(t, response, 'showcase.loadFailed'));
      }
    });
    return () => {
      active = false;
    };
    // Reload on page or retry only; translation changes keep the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, page, attempt]);

  return { page, section, loading, error, setPage, retry: () => setAttempt((current) => current + 1) };
}

const CmSkillChips: React.FC<{ skills: string[] }> = ({ skills }) => {
  const { t } = useTranslation('cm');
  if (skills.length === 0) return null;
  return (
    <ul className="cm-showcase-card__skills" aria-label={t('showcase.skills')}>
      {skills.map((skill) => <li key={skill}>{skill}</li>)}
    </ul>
  );
};

const CmShowcasePager: React.FC<{ page: number; total: number; onChange: (page: number) => void }> = ({ page, total, onChange }) => {
  const { t } = useTranslation('cm');
  const pageCount = Math.max(1, Math.ceil(total / SHOWCASE_PAGE_SIZE));
  if (pageCount <= 1) return null;
  return (
    <nav className="cm-showcase-pager" aria-label={t('showcase.pagination')}>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label={t('common.previous')}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <span>{t('showcase.pageOf', { page, total: pageCount })}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label={t('common.next')}>
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
};

function CmShowcaseBlock<T extends { id: number }>({
  id,
  titleKey,
  emptyKey,
  icon,
  state,
  renderItem,
}: {
  id: string;
  titleKey: string;
  emptyKey: string;
  icon: React.ReactNode;
  state: CmShowcaseSectionHook<T>;
  renderItem: (item: T) => React.ReactNode;
}): React.ReactElement {
  const { t, i18n } = useTranslation('cm');
  const total = state.section?.total ?? 0;
  return (
    <section id={id} className="cm-showcase-section" aria-busy={state.loading}>
      <header className="cm-showcase-section__header">
        <h2>{icon} {t(titleKey)}</h2>
        {state.section && <span>{t('showcase.total', { number: new Intl.NumberFormat(i18n.language).format(total) })}</span>}
      </header>
      {state.error ? (
        <div className="cm-public-form__notice is-error" role="alert">
          <span>{state.error}</span>
          <button type="button" className="cm-public-form__link" onClick={state.retry}>
            <RotateCw aria-hidden="true" /> {t('showcase.retry')}
          </button>
        </div>
      ) : state.loading && !state.section ? (
        <p className="cm-public-page__status" role="status">{t('common.loading')}</p>
      ) : state.section && state.section.items.length === 0 ? (
        <div className="cm-public-empty">
          <CmPublicIllustration name="empty-workspace" className="cm-public-empty__image" />
          <p>{t(emptyKey)}</p>
        </div>
      ) : (
        <div className="cm-showcase-grid">{state.section?.items.map((item) => <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>)}</div>
      )}
      <CmShowcasePager page={state.page} total={total} onChange={state.setPage} />
    </section>
  );
}

/** Public, redacted showcase of open marketplace work and completed projects. */
const CmShowcasePage: React.FC = () => {
  const { t, i18n } = useTranslation('cm');
  const location = useLocation();
  const openProtected = useCmProtectedNavigate();
  const tasks = useShowcaseSection<CmShowcaseTask>('open_tasks');
  const projects = useShowcaseSection<CmShowcaseProject>('completed_projects');
  const tasksReady = tasks.section !== null;

  useEffect(() => {
    const anchor = location.hash.replace('#', '');
    if (!anchor || !tasksReady) return;
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, tasksReady]);

  const label = (group: string, value: string | null): string | null => (
    value ? t(`${group}.${value}`, { defaultValue: value }) : null
  );

  const renderTask = (task: CmShowcaseTask): React.ReactNode => {
    const budget = task.budget_range
      ? formatCmAmountRange(task.budget_range.min, task.budget_range.max, task.currency, i18n.language)
      : t('showcase.budgetUndisclosed');
    const due = formatCmDate(task.due_date, i18n.language);
    const meta = [label('estimate.complexities', task.category), label('estimate.budgetTypes', task.budget_type), label('showcase.priorities', task.priority)]
      .filter((value): value is string => value !== null);
    return (
      <article className="cm-showcase-card">
        <h3>{task.title}</h3>
        {meta.length > 0 && <p className="cm-showcase-card__meta">{meta.join(' · ')}</p>}
        <p className="cm-showcase-card__budget"><span>{t('showcase.budget')}</span><strong>{budget}</strong></p>
        {due && <p className="cm-showcase-card__meta"><CalendarClock aria-hidden="true" /> {t('showcase.due', { date: due })}</p>}
        <CmSkillChips skills={task.skills} />
        <button
          type="button"
          className="cm-showcase-card__action"
          onClick={() => openProtected(CM_PROTECTED_ROUTE.marketplace, 'marketplace-entry')}
        >
          {t('showcase.viewInMarketplace')}
        </button>
      </article>
    );
  };

  const renderProject = (project: CmShowcaseProject): React.ReactNode => {
    const completed = formatCmDate(project.completed_at, i18n.language);
    const category = label('estimate.complexities', project.category);
    return (
      <article className="cm-showcase-card is-completed">
        <h3>{project.title}</h3>
        {category && <p className="cm-showcase-card__meta">{category}</p>}
        {project.duration_days !== null && (
          <p className="cm-showcase-card__budget">
            <span>{t('showcase.duration')}</span>
            <strong>{t('showcase.days', { number: new Intl.NumberFormat(i18n.language).format(project.duration_days) })}</strong>
          </p>
        )}
        {completed && <p className="cm-showcase-card__meta">{t('showcase.completedOn', { date: completed })}</p>}
        <CmSkillChips skills={project.skills} />
      </article>
    );
  };

  return (
    <CmPublicPage titleKey="showcase.title" descriptionKey="showcase.lead" eyebrow={t('showcase.eyebrow')} lead={t('showcase.lead')} className="cm-showcase-page">
      <div className="cm-public-container cm-showcase">
        <CmPublicSplit
          image="showcase-projects"
          titleKey="showcase.intro.title"
          bodyKeys={['showcase.intro.body']}
          pointKeys={SHOWCASE_INTRO_POINTS.map((id) => `showcase.intro.points.${id}`)}
          eager
        />
        <CmShowcaseBlock
          id={OPEN_TASKS_ANCHOR}
          titleKey="showcase.openTasksTitle"
          emptyKey="showcase.openTasksEmpty"
          icon={<BriefcaseBusiness aria-hidden="true" />}
          state={tasks}
          renderItem={renderTask}
        />
        <CmShowcaseBlock
          id={COMPLETED_ANCHOR}
          titleKey="showcase.completedTitle"
          emptyKey="showcase.completedEmpty"
          icon={<Trophy aria-hidden="true" />}
          state={projects}
          renderItem={renderProject}
        />
      </div>
      <CmPublicCta titleKey="showcase.cta.title" bodyKey="showcase.cta.body" />
    </CmPublicPage>
  );
};

export default CmShowcasePage;
