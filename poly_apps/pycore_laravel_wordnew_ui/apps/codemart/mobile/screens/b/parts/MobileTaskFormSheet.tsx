import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmTask } from '../../../../api/CmApiTypes';
import { useCmBootstrap } from '../../../../contexts/CmBootstrapContext';
import { useCmTaskForm } from '../../../../shared/useCmMilestones';
import { MobileButton, MobileField, MobileSheet, useMobileFeedback } from '../../../ui';

interface MobileTaskFormBodyProps {
  milestoneId: number;
  task: CmTask | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const MobileTaskFormBody: React.FC<MobileTaskFormBodyProps> = ({ milestoneId, task, onClose, onSaved }) => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const { policyList } = useCmBootstrap();
  const form = useCmTaskForm(milestoneId, task, onSaved, feedback);
  const { submitted, titleError, descriptionError, budgetEditable } = form;

  const save = async (): Promise<void> => {
    if (await form.submit()) onClose();
  };

  return (
    <MobileSheet
      open
      onClose={onClose}
      title={t(task ? 'projectDetail.editTask' : 'projectDetail.addTaskTitle')}
      footer={(
        <>
          <MobileButton disabled={form.busy} onClick={onClose}>{t('common.cancel')}</MobileButton>
          <MobileButton variant="primary" loading={form.busy} onClick={() => void save()}>{t(task ? 'projectDetail.saveTask' : 'projectDetail.addTask')}</MobileButton>
        </>
      )}
    >
      <MobileField label={t('projectDetail.taskTitle')} error={submitted && titleError}>
        <input className="cmm-input" value={form.title} onChange={(event) => form.setTitle(event.target.value)} aria-invalid={submitted && Boolean(titleError)} />
      </MobileField>
      <MobileField label={t('projectDetail.taskDescription')} error={submitted && descriptionError}>
        <textarea className="cmm-input cmm-textarea" rows={4} value={form.description} onChange={(event) => form.setDescription(event.target.value)} aria-invalid={submitted && Boolean(descriptionError)} />
      </MobileField>
      <div className="cmm-field-pair">
        <MobileField label={t('projectDetail.taskPriority')}>
          <select className="cmm-input cmm-select" value={form.priority} onChange={(event) => form.setPriority(event.target.value)}>
            {policyList('task_priorities').map((value) => <option key={value} value={value}>{t(`projectDetail.priorities.${value}`)}</option>)}
          </select>
        </MobileField>
        <MobileField label={t('projectDetail.taskDueDate')}>
          <input className="cmm-input" type="date" value={form.dueDate} onChange={(event) => form.setDueDate(event.target.value)} />
        </MobileField>
      </div>
      <MobileField label={t('projectDetail.taskBudget')} hint={budgetEditable ? undefined : t('projectDetail.taskBudgetLocked')}>
        <input className="cmm-input" type="number" min={0} step="0.01" inputMode="decimal" value={form.budget} disabled={!budgetEditable} onChange={(event) => form.setBudget(event.target.value)} />
      </MobileField>
      <MobileField label={t('projectDetail.taskSkills')}>
        <input className="cmm-input" value={form.skills} onChange={(event) => form.setSkills(event.target.value)} placeholder={t('marketplace.skillsPlaceholder')} />
      </MobileField>
    </MobileSheet>
  );
};

interface MobileTaskFormSheetProps extends MobileTaskFormBodyProps {
  open: boolean;
}

/** Create a task in a milestone, or edit one; mounted only while open so every opening starts from the task's current values. */
export const MobileTaskFormSheet: React.FC<MobileTaskFormSheetProps> = ({ open, ...body }) => (open ? <MobileTaskFormBody {...body} /> : null);
