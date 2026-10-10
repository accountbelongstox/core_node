import React, { useState } from 'react';
import { CalendarClock, Trophy } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import type { CmShowcaseProject, CmShowcaseTask } from '../../../api/CmPublicApi';
import { CM_PROTECTED_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmProtectedNavigate } from '../../../components/public-home/useCmProtectedNavigate';
import { CM_WHOLE_MONEY_DIGITS, cmFormatDate, cmFormatMoneyRange, cmFormatNumber, cmTotalPages } from '../../../components/workspace/cmWorkspaceFormat';
import { CM_SHOWCASE_PAGE_SIZE, useCmShowcaseSection, type CmShowcaseKind, type CmShowcaseSectionModel } from '../../../shared/useCmShowcase';
import { MobilePageHead } from './MobilePublicParts';
import { MobileButton, MobileCard, MobileEmptyState, MobileErrorState, MobilePager, MobileScreen, MobileSegmented, MobileSkeletonList } from '../../ui';

const SkillTags: React.FC<{ skills: string[] }> = ({ skills }) => {
  const { t } = useTranslation('cm');
  if (skills.length === 0) return null;
  return (
    <ul className="cmm-tags" aria-label={t('showcase.skills')}>
      {skills.map((skill) => <li key={skill}>{skill}</li>)}
    </ul>
  );
};

function ShowcaseBody<T extends { id: number }>({ state, emptyKey, renderItem }: {
  state: CmShowcaseSectionModel<T>;
  emptyKey: string;
  renderItem: (item: T) => React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation('cm');
  const total = state.section?.total ?? 0;
  if (state.error) return <MobileErrorState message={state.error} onRetry={state.retry} />;
  if (state.loading && !state.section) return <MobileSkeletonList rows={3} />;
  if (!state.section || state.section.items.length === 0) return <MobileEmptyState title={t(emptyKey)} />;
  return (
    <div className="cmm-a-stack" aria-busy={state.loading}>
      {state.section.items.map((item) => <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>)}
      <MobilePager page={state.page} totalPages={cmTotalPages({ total, page_size: CM_SHOWCASE_PAGE_SIZE })} disabled={state.loading} onChange={state.setPage} />
    </div>
  );
}

const TaskCards: React.FC<{ state: CmShowcaseSectionModel<CmShowcaseTask> }> = ({ state }) => {
  const { t, i18n } = useTranslation('cm');
  const openProtected = useCmProtectedNavigate();
  const label = (group: string, value: string | null): string | null => (value ? t(`${group}.${value}`, { defaultValue: value }) : null);

  return (
    <ShowcaseBody
      state={state}
      emptyKey="showcase.openTasksEmpty"
      renderItem={(task) => {
        const budget = task.budget_range
          ? cmFormatMoneyRange(task.budget_range.min, task.budget_range.max, task.currency, i18n.language, CM_WHOLE_MONEY_DIGITS)
          : t('showcase.budgetUndisclosed');
        const due = cmFormatDate(task.due_date, i18n.language);
        const meta = [label('estimate.complexities', task.category), label('estimate.budgetTypes', task.budget_type), label('showcase.priorities', task.priority)]
          .filter((value): value is string => value !== null);
        return (
          <MobileCard className="cmm-a-showcase">
            <h3>{task.title}</h3>
            {meta.length > 0 && <p className="cmm-a-showcase__meta">{meta.join(' · ')}</p>}
            <p className="cmm-a-showcase__budget"><span>{t('showcase.budget')}</span><strong>{budget}</strong></p>
            {due && <p className="cmm-a-showcase__meta"><CalendarClock aria-hidden="true" /> {t('showcase.due', { date: due })}</p>}
            <SkillTags skills={task.skills} />
            <MobileButton small block onClick={() => openProtected(CM_PROTECTED_ROUTE.marketplace, 'marketplace-entry')}>{t('showcase.viewInMarketplace')}</MobileButton>
          </MobileCard>
        );
      }}
    />
  );
};

const ProjectCards: React.FC<{ state: CmShowcaseSectionModel<CmShowcaseProject> }> = ({ state }) => {
  const { t, i18n } = useTranslation('cm');
  return (
    <ShowcaseBody
      state={state}
      emptyKey="showcase.completedEmpty"
      renderItem={(project) => {
        const completed = cmFormatDate(project.completed_at, i18n.language);
        const category = project.category ? t(`estimate.complexities.${project.category}`, { defaultValue: project.category }) : null;
        return (
          <MobileCard className="cmm-a-showcase">
            <h3>{project.title}</h3>
            {category && <p className="cmm-a-showcase__meta">{category}</p>}
            {project.duration_days !== null && (
              <p className="cmm-a-showcase__budget">
                <span>{t('showcase.duration')}</span>
                <strong>{t('showcase.days', { number: cmFormatNumber(project.duration_days, i18n.language) })}</strong>
              </p>
            )}
            {completed && <p className="cmm-a-showcase__meta">{t('showcase.completedOn', { date: completed })}</p>}
            <SkillTags skills={project.skills} />
          </MobileCard>
        );
      }}
    />
  );
};

/** Public showcase: open marketplace work and delivered projects, one section at a time. */
const MobileShowcaseScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const [kind, setKind] = useState<CmShowcaseKind>('open_tasks');
  const tasks = useCmShowcaseSection<CmShowcaseTask>('open_tasks');
  const projects = useCmShowcaseSection<CmShowcaseProject>('completed_projects');

  return (
    <MobileScreen onRefresh={kind === 'open_tasks' ? tasks.retry : projects.retry}>
      <MobilePageHead
        titleKey="showcase.title"
        leadKey="showcase.lead"
        title={t('showcase.title')}
        lead={t('showcase.lead')}
        icon={<Trophy aria-hidden="true" />}
      />
      <MobileSegmented
        ariaLabel={t('showcase.title')}
        value={kind}
        onChange={setKind}
        options={[
          { value: 'open_tasks', label: t('showcase.openTasksTitle') },
          { value: 'completed_projects', label: t('showcase.completedTitle') },
        ]}
      />
      {kind === 'open_tasks' ? <TaskCards state={tasks} /> : <ProjectCards state={projects} />}
    </MobileScreen>
  );
};

export default MobileShowcaseScreen;
