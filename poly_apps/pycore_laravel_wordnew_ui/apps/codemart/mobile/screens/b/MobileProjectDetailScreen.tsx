import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PROTECTED_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmProjectDetail } from '../../../shared/useCmProjectDetail';
import { MobileButton, MobileEmptyState, MobileErrorState, MobileNotice, MobileScreen, MobileSkeletonBlock, MobileStatusBadge, useMobileFeedback } from '../../ui';
import { ProjectAnalysisTab } from './project/ProjectAnalysisTab';
import { ProjectFilesTab } from './project/ProjectFilesTab';
import { ProjectMilestonesTab } from './project/ProjectMilestonesTab';
import { ProjectOverviewTab } from './project/ProjectOverviewTab';
import { ProjectTasksTab } from './project/ProjectTasksTab';
import './styles/cm-mobile-work.css';

const TAB_PARAM = 'tab';
const TABS = ['overview', 'analysis', 'milestones', 'tasks', 'files'] as const;
type ProjectTab = typeof TABS[number];

/** Mobile project detail: tabs for overview and transitions, AI analysis, milestones, tasks (with submission review) and attachments. */
const MobileProjectDetailScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const feedback = useMobileFeedback();
  const detail = useCmProjectDetail(Number.parseInt(projectId ?? '', 10), feedback);
  const { project, loading } = detail;

  const requested = searchParams.get(TAB_PARAM);
  const visibleTabs = TABS.filter((tab) => tab !== 'analysis' || detail.canManage);
  const tab: ProjectTab = visibleTabs.find((item) => item === requested) ?? 'overview';
  const selectTab = (next: ProjectTab): void => {
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete(TAB_PARAM);
    else params.set(TAB_PARAM, next);
    setSearchParams(params, { replace: true });
  };

  const backButton = <MobileButton to={CM_PROTECTED_ROUTE.projects}>{t('projectDetail.backToList')}</MobileButton>;

  if (loading || !project) {
    return (
      <MobileScreen title={t('projectDetail.docTitle')} onRefresh={detail.load}>
        {loading ? <MobileSkeletonBlock height={220} /> : detail.notFound ? (
          <MobileEmptyState title={t('projectDetail.notFoundTitle')} body={t('projectDetail.notFoundBody')} action={backButton} />
        ) : detail.forbidden ? (
          <MobileEmptyState title={t('projectDetail.noAccessTitle')} body={t('projectDetail.noAccessBody')} action={backButton} />
        ) : (
          <MobileErrorState message={detail.loadError ?? t('projectDetail.loadFailed')} onRetry={detail.retry} />
        )}
      </MobileScreen>
    );
  }

  const taskCount = detail.milestones.reduce((total, milestone) => total + (milestone.tasks ?? []).length, 0);
  const counts: Partial<Record<ProjectTab, number>> = { milestones: detail.milestones.length, tasks: taskCount };

  return (
    <MobileScreen
      title={t('projectDetail.docTitle')}
      onRefresh={detail.reloadAll}
      actions={<button type="button" className="cmm-icon-btn" onClick={() => void detail.reloadAll()} aria-label={t('common.refresh')}><RefreshCw aria-hidden="true" /></button>}
    >
      <div className="cmm-stack-tight">
        <div className="cmm-entity__head"><h2 className="cmm-steps__label" style={{ margin: 0 }}>{project.title}</h2><MobileStatusBadge group="project" status={project.status} /></div>
        {detail.nextAction && <p className="cmm-entity__hint">{detail.nextAction}</p>}
        {detail.readOnly && <MobileNotice>{t('projectDetail.readOnly')}</MobileNotice>}
      </div>
      <nav className="cmm-tabs" role="tablist" aria-label={t('projectDetail.docTitle')}>
        {visibleTabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => selectTab(item)}>
            {t(`mobile.work.projectTabs.${item}`)}
            {counts[item] !== undefined && <small>{counts[item]}</small>}
          </button>
        ))}
      </nav>
      {tab === 'overview' && <ProjectOverviewTab project={project} detail={detail} />}
      {tab === 'analysis' && <ProjectAnalysisTab project={project} isOwner={detail.isOwner} onProjectChanged={detail.reloadAll} />}
      {tab === 'milestones' && <ProjectMilestonesTab project={project} milestones={detail.milestones} canManage={detail.canManage} closed={detail.closed} onChanged={detail.load} />}
      {tab === 'tasks' && <ProjectTasksTab project={project} milestones={detail.milestones} canManage={detail.canManage} closed={detail.closed} currentUserId={detail.currentUserId} onChanged={detail.load} />}
      {tab === 'files' && <ProjectFilesTab projectId={project.id} canUpload={detail.canManage} />}
    </MobileScreen>
  );
};

export default MobileProjectDetailScreen;
