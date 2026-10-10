import React from 'react';
import { CalendarDays, FilePlus2, Milestone, Search } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PROTECTED_ROUTE, cmProjectPath } from '../../../components/public-home/cmPublicRoutes';
import { useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../../../contexts/CmBootstrapContext';
import { useCmProjectsList } from '../../../shared/useCmProjectsList';
import { MobileButton, MobileFab, MobileListState, MobilePager, MobileScreen, MobileStatusBadge } from '../../ui';
import { MobileEntityCard } from './parts/MobileEntityCard';
import './styles/cm-mobile-work.css';

/** Mobile project list: search and status filter, cards with state, budget and milestone progress, create button. */
const MobileProjectsScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { hasCapability, states } = useCmBootstrap();
  const canCreate = hasCapability('project.create');
  const { list, status, setStatus, searchDraft, setSearchDraft, filtered, applySearch, clearFilters } = useCmProjectsList();

  const createButton = <MobileButton variant="primary" icon={<FilePlus2 aria-hidden="true" />} to={CM_PROTECTED_ROUTE.projectCreate}>{t('nav.createProject')}</MobileButton>;

  return (
    <MobileScreen title={t('nav.myProjects')} onRefresh={() => list.reload()}>
      <form className="cmm-stack-tight" onSubmit={(event) => { event.preventDefault(); applySearch(); }} role="search">
        <div className="cmm-search">
          <Search aria-hidden="true" />
          <input className="cmm-search__input" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t('projects.searchPlaceholder')} aria-label={t('projects.searchLabel')} enterKeyHint="search" />
        </div>
        <select className="cmm-input cmm-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t('projects.statusFilter')}>
          <option value="">{t('projects.allStatuses')}</option>
          {states('project').map((value) => <option key={value} value={value}>{t(`states.project.${value}`)}</option>)}
        </select>
      </form>
      <MobileListState
        loading={list.loading && list.items.length === 0}
        error={list.error}
        empty={list.items.length === 0}
        emptyTitle={filtered ? t('projects.noMatchTitle') : t('projects.emptyTitle')}
        emptyBody={filtered ? t('projects.noMatchBody') : (canCreate ? t('projects.emptyBody') : t('projects.emptyBodyNoCreate'))}
        emptyAction={filtered ? <MobileButton onClick={clearFilters}>{t('marketplace.clearFilters')}</MobileButton> : (canCreate ? createButton : undefined)}
        onRetry={list.retryable ? () => void list.reload() : undefined}
      >
        <div className="cmm-stack-tight" role="list" aria-label={t('nav.myProjects')}>
          {list.items.map((project) => (
            <MobileEntityCard
              key={project.id}
              title={project.title}
              description={project.description}
              badge={<MobileStatusBadge group="project" status={project.status} />}
              meta={[
                project.budget && <span className="cmm-entity__money">{format.money(project.budget, project.currency)}</span>,
                (project.total_milestones ?? 0) > 0 && <><Milestone aria-hidden="true" />{t('projects.milestoneProgress', { done: project.completed_milestones ?? 0, total: project.total_milestones ?? 0 })}</>,
                project.created_at && <><CalendarDays aria-hidden="true" />{t('projects.createdOn', { date: format.date(project.created_at) })}</>,
              ]}
              hint={t(`projects.nextAction.${project.status}`, { defaultValue: '' }) || undefined}
              to={cmProjectPath(project.id)}
            />
          ))}
        </div>
        <MobilePager page={list.page} totalPages={list.totalPages} disabled={list.loading} onChange={(page) => void list.load(page)} />
      </MobileListState>
      {canCreate && <MobileFab label={t('nav.createProject')} icon={<FilePlus2 aria-hidden="true" />} to={CM_PROTECTED_ROUTE.projectCreate} />}
    </MobileScreen>
  );
};

export default MobileProjectsScreen;
