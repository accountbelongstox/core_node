import React, { useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmMilestone, CmProjectDetail, CmTask } from '../../../../api/CmApiTypes';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { MobileEmptyState, MobileSectionHeader, MobileStatusBadge } from '../../../ui';
import { MobileEntityCard } from '../parts/MobileEntityCard';
import { MobileTagList } from '../parts/MobileTagList';
import { MobileTaskFormSheet } from '../parts/MobileTaskFormSheet';
import { MobileTaskSheet } from '../parts/MobileTaskSheet';

interface ProjectTasksTabProps {
  project: CmProjectDetail;
  milestones: CmMilestone[];
  canManage: boolean;
  closed: boolean;
  currentUserId: number | null;
  onChanged: () => Promise<void>;
}

/** Every task of the project grouped by milestone; managers and the assignee open the task sheet (submissions review, edit, comments). */
export const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({ project, milestones, canManage, closed, currentUserId, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [creatingFor, setCreatingFor] = useState<CmMilestone | null>(null);
  const withTasks = milestones.filter((milestone) => (milestone.tasks ?? []).length > 0);
  const editableMilestones = canManage && !closed ? milestones : [];

  const canOpen = (task: CmTask): boolean => canManage || (currentUserId !== null && task.assigned_to === currentUserId);

  return (
    <>
      {withTasks.length === 0 ? (
        <MobileEmptyState title={canManage && !closed ? t('projectDetail.noTasks') : t('projectDetail.noTasksReadOnly')} />
      ) : withTasks.map((milestone) => (
        <section key={milestone.id} className="cmm-stack-tight">
          <MobileSectionHeader title={milestone.title} />
          {(milestone.tasks ?? []).map((task) => {
            const mine = currentUserId !== null && task.assigned_to === currentUserId;
            return (
              <MobileEntityCard
                key={task.id}
                title={task.title}
                badge={<MobileStatusBadge group="task" status={task.status} />}
                meta={[
                  task.priority && t(`projectDetail.priorities.${task.priority}`, { defaultValue: task.priority }),
                  task.due_date && <><CalendarDays aria-hidden="true" />{format.date(task.due_date)}</>,
                  task.budget_allocation && <span className="cmm-entity__money">{format.money(task.budget_allocation, project.currency)}</span>,
                  mine && t('milestones.assignedToYou'),
                ]}
                tags={<MobileTagList items={task.required_skills} />}
                onClick={canOpen(task) ? () => setOpenTaskId(task.id) : undefined}
              />
            );
          })}
        </section>
      ))}
      {editableMilestones.length > 0 && (
        <section className="cmm-stack-tight">
          <MobileSectionHeader title={t('projectDetail.addTaskTitle')} />
          <div className="cmm-row-actions">
            {editableMilestones.map((milestone) => (
              <button key={milestone.id} type="button" className="cmm-btn is-small" onClick={() => setCreatingFor(milestone)}><Plus aria-hidden="true" /><span>{milestone.title}</span></button>
            ))}
          </div>
        </section>
      )}
      {openTaskId !== null && <MobileTaskSheet key={openTaskId} taskId={openTaskId} onClose={() => setOpenTaskId(null)} onChanged={onChanged} />}
      {creatingFor !== null && <MobileTaskFormSheet open milestoneId={creatingFor.id} task={null} onClose={() => setCreatingFor(null)} onSaved={onChanged} />}
    </>
  );
};
