import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmMilestone } from '../../../../api/CmApiTypes';
import { useCmMilestoneForm } from '../../../../shared/useCmMilestones';
import { MobileButton, MobileField, MobileSheet, useMobileFeedback } from '../../../ui';

interface MilestoneFormSheetProps {
  projectId: number;
  milestone: CmMilestone | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Create a milestone, or edit one; mounted only while open. */
export const MilestoneFormSheet: React.FC<MilestoneFormSheetProps> = ({ projectId, milestone, onClose, onSaved }) => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const form = useCmMilestoneForm(projectId, milestone, onSaved, feedback);
  const { errors, submitted } = form;

  const save = async (): Promise<void> => {
    if (await form.submit()) onClose();
  };

  return (
    <MobileSheet
      open
      onClose={onClose}
      title={milestone ? t('milestones.edit') : t('projectDetail.addMilestoneTitle')}
      footer={(
        <>
          <MobileButton disabled={form.busy} onClick={onClose}>{t('common.cancel')}</MobileButton>
          <MobileButton variant="primary" loading={form.busy} onClick={() => void save()}>{form.busy ? t('common.saving') : (milestone ? t('common.save') : t('projectDetail.addMilestone'))}</MobileButton>
        </>
      )}
    >
      <MobileField label={t('projectDetail.milestoneTitle')} error={submitted && errors.title}>
        <input className="cmm-input" value={form.title} onChange={(event) => form.setTitle(event.target.value)} aria-invalid={submitted && Boolean(errors.title)} />
      </MobileField>
      <div className="cmm-field-pair">
        <MobileField label={t('projectDetail.milestoneDueDate')} error={submitted && errors.dueDate}>
          <input className="cmm-input" type="date" value={form.dueDate} onChange={(event) => form.setDueDate(event.target.value)} aria-invalid={submitted && Boolean(errors.dueDate)} />
        </MobileField>
        <MobileField label={t('projectDetail.milestoneBudget')} error={submitted && errors.budget}>
          <input className="cmm-input" type="number" min={0} step="0.01" inputMode="decimal" value={form.budget} onChange={(event) => form.setBudget(event.target.value)} aria-invalid={submitted && Boolean(errors.budget)} />
        </MobileField>
      </div>
      <MobileField label={`${t('projectDetail.milestoneDescription')} (${t('common.optional')})`}>
        <textarea className="cmm-input cmm-textarea" rows={3} value={form.description} onChange={(event) => form.setDescription(event.target.value)} />
      </MobileField>
      <MobileField label={`${t('milestones.deliverables')} (${t('common.optional')})`}>
        <textarea className="cmm-input cmm-textarea" rows={3} value={form.deliverables} onChange={(event) => form.setDeliverables(event.target.value)} placeholder={t('milestones.deliverablesPlaceholder')} />
      </MobileField>
    </MobileSheet>
  );
};
