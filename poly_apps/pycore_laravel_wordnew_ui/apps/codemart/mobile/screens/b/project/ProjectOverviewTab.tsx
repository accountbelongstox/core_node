import React, { useState } from 'react';
import { Pencil, Send } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmProjectDetail } from '../../../../api/CmApiTypes';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { CM_STACK_FIELDS } from '../../../../shared/cmProjectForm';
import { CM_FUNDING_PENDING_STATUS, type CmProjectDetailModel } from '../../../../shared/useCmProjectDetail';
import { MobileButton, MobileCard, MobileSectionHeader } from '../../../ui';
import { MobileKeyValue } from '../parts/MobileKeyValue';
import { MobileTagList } from '../parts/MobileTagList';
import { MobileTransitionActions } from '../parts/MobileTransitionActions';
import { FundingCard } from './FundingCard';
import { ProjectEditSheet } from './ProjectEditSheet';

/** Overview: description, facts, stack, funding when due, owner actions (publish, state transitions, edit). */
export const ProjectOverviewTab: React.FC<{ project: CmProjectDetail; detail: CmProjectDetailModel }> = ({ project, detail }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const [editing, setEditing] = useState(false);
  const { isOwner, closed, publishable, milestones } = detail;
  const access = project.access;
  const transitions = access?.allowed_transitions ?? [];

  return (
    <>
      {isOwner && project.status === CM_FUNDING_PENDING_STATUS && <FundingCard project={project} onFunded={detail.reloadAll} />}
      <MobileCard>
        <p className="cmm-prose">{project.description}</p>
      </MobileCard>
      <MobileCard>
        <MobileKeyValue
          items={[
            access && { label: t('projectDetail.yourRole'), value: t(`projectDetail.accessRoles.${access.role}`, { defaultValue: access.role }) },
            { label: t('projectDetail.budgetLabel'), value: `${project.budget ? format.money(project.budget, project.currency) : t('common.unavailable')}${project.budget_type ? ` · ${t(`projectCreate.budgetTypes.${project.budget_type}`, { defaultValue: project.budget_type })}` : ''}` },
            project.complexity && { label: t('projectCreate.complexity'), value: t(`estimate.complexities.${project.complexity}`, { defaultValue: project.complexity }) },
            { label: t('projectDetail.architectLabel'), value: detail.architectLabel },
            { label: t('projectDetail.milestonesLabel'), value: t('projects.milestoneProgress', { done: project.completed_milestones ?? 0, total: project.total_milestones ?? milestones.length }) },
            project.start_date && { label: t('projectCreate.startDate'), value: format.date(project.start_date) },
            project.end_date && { label: t('projectCreate.endDate'), value: format.date(project.end_date) },
            project.created_at && { label: t('projectDetail.createdAt'), value: format.date(project.created_at) },
            project.published_at && { label: t('projectDetail.publishedAt'), value: format.date(project.published_at) },
          ]}
        />
      </MobileCard>
      {CM_STACK_FIELDS.some((field) => (project[field] ?? []).length > 0) && (
        <section className="cmm-section">
          {CM_STACK_FIELDS.map((field) => ((project[field] ?? []).length > 0 ? (
            <div key={field} className="cmm-stack-tight">
              <MobileSectionHeader title={t(`projectCreate.${field}`)} />
              <MobileTagList items={project[field]} />
            </div>
          ) : null))}
        </section>
      )}
      {isOwner && (transitions.length > 0 || publishable || !closed) && (
        <MobileCard>
          <h3 className="cmm-card-title">{t('projectDetail.actionsTitle')}</h3>
          <div className="cmm-stack-tight">
            {publishable && (
              <MobileButton variant="primary" block icon={<Send aria-hidden="true" />} loading={detail.publishing} onClick={() => void detail.publish()}>
                {detail.publishing ? t('common.saving') : t('projects.publish')}
              </MobileButton>
            )}
            <MobileTransitionActions transitions={transitions} labelFor={(toStatus) => t(`transitions.project.${toStatus}`, { defaultValue: toStatus })} onConfirm={detail.transition} />
            {!closed && <MobileButton block icon={<Pencil aria-hidden="true" />} onClick={() => setEditing(true)}>{t('projectDetail.editOpen')}</MobileButton>}
          </div>
        </MobileCard>
      )}
      {editing && <ProjectEditSheet project={project} onClose={() => setEditing(false)} onSaved={detail.load} />}
    </>
  );
};
