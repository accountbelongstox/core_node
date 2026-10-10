import React, { useState } from 'react';
import { CalendarDays, CheckCircle2, Pencil, Plus } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmMilestone, CmProjectDetail } from '../../../../api/CmApiTypes';
import { useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../../../../contexts/CmBootstrapContext';
import { useCmMilestoneComplete } from '../../../../shared/useCmMilestones';
import { MobileButton, MobileEmptyState, MobileStatusBadge, useMobileFeedback } from '../../../ui';
import { MobileConfirmSheet } from '../parts/MobileConfirmSheet';
import { MobileTaskFormSheet } from '../parts/MobileTaskFormSheet';
import { MilestoneFormSheet } from './MilestoneFormSheet';

interface MilestoneCardProps {
  index: number;
  milestone: CmMilestone;
  currency: string | null;
  editable: boolean;
  onChanged: () => Promise<void>;
  onEdit: () => void;
  onAddTask: () => void;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ index, milestone, currency, editable, onChanged, onEdit, onAddTask }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const [completing, setCompleting] = useState(false);
  const completion = useCmMilestoneComplete(milestone.id, onChanged, feedback);
  const taskCount = (milestone.tasks ?? []).length;

  const complete = async (): Promise<void> => {
    await completion.complete();
    setCompleting(false);
  };

  return (
    <article className="cmm-entity">
      <span className="cmm-entity__head"><h3>{index}. {milestone.title}</h3><MobileStatusBadge group="milestone" status={milestone.status} /></span>
      <span className="cmm-entity__meta">
        {milestone.due_date && <span><CalendarDays aria-hidden="true" />{t('tasks.due', { date: format.date(milestone.due_date) })}</span>}
        {milestone.budget && <span className="cmm-entity__money">{format.money(milestone.budget, currency)}</span>}
        {milestone.completed_at && <span>{t('milestones.completedAt', { date: format.date(milestone.completed_at) })}</span>}
        <span>{t('milestones.tasksTitle', { count: taskCount })}</span>
      </span>
      {milestone.description && <p className="cmm-prose">{milestone.description}</p>}
      {(milestone.deliverables ?? []).length > 0 && (
        <div className="cmm-stack-tight">
          <strong>{t('milestones.deliverables')}</strong>
          <ul className="cmm-filelist">{(milestone.deliverables ?? []).map((item, position) => <li key={position}><span>{item}</span></li>)}</ul>
        </div>
      )}
      {editable && (
        <div className="cmm-row-actions">
          <MobileButton small icon={<Plus aria-hidden="true" />} onClick={onAddTask}>{t('projectDetail.addTask')}</MobileButton>
          <MobileButton small icon={<Pencil aria-hidden="true" />} onClick={onEdit}>{t('milestones.edit')}</MobileButton>
          <MobileButton small icon={<CheckCircle2 aria-hidden="true" />} onClick={() => setCompleting(true)}>{t('milestones.complete')}</MobileButton>
        </div>
      )}
      <MobileConfirmSheet
        open={completing}
        title={t('milestones.complete')}
        message={t('milestones.completeConfirm')}
        busy={completion.busy}
        onClose={() => setCompleting(false)}
        onConfirm={complete}
      />
    </article>
  );
};

interface ProjectMilestonesTabProps {
  project: CmProjectDetail;
  milestones: CmMilestone[];
  canManage: boolean;
  closed: boolean;
  onChanged: () => Promise<void>;
}

/** Milestones with their budgets and deliverables; managers add, edit and complete them and add tasks. */
export const ProjectMilestonesTab: React.FC<ProjectMilestonesTabProps> = ({ project, milestones, canManage, closed, onChanged }) => {
  const { t } = useTranslation('cm');
  const { terminalStates } = useCmBootstrap();
  const [formFor, setFormFor] = useState<CmMilestone | 'new' | null>(null);
  const [taskFor, setTaskFor] = useState<CmMilestone | null>(null);
  const canAdd = canManage && !closed;

  return (
    <>
      <p className="cmm-hint">{t('projectDetail.milestonesLead')}</p>
      {canAdd && <MobileButton block icon={<Plus aria-hidden="true" />} onClick={() => setFormFor('new')}>{t('projectDetail.addMilestone')}</MobileButton>}
      {milestones.length === 0 ? (
        <MobileEmptyState title={canAdd ? t('projectDetail.noMilestones') : t('projectDetail.noMilestonesReadOnly')} />
      ) : (
        <div className="cmm-stack-tight">
          {milestones.map((milestone, index) => (
            <MilestoneCard
              key={milestone.id}
              index={index + 1}
              milestone={milestone}
              currency={project.currency}
              editable={canAdd && !terminalStates('milestone').includes(milestone.status)}
              onChanged={onChanged}
              onEdit={() => setFormFor(milestone)}
              onAddTask={() => setTaskFor(milestone)}
            />
          ))}
        </div>
      )}
      {formFor !== null && (
        <MilestoneFormSheet projectId={project.id} milestone={formFor === 'new' ? null : formFor} onClose={() => setFormFor(null)} onSaved={onChanged} />
      )}
      {taskFor !== null && (
        <MobileTaskFormSheet open milestoneId={taskFor.id} task={null} onClose={() => setTaskFor(null)} onSaved={onChanged} />
      )}
    </>
  );
};
