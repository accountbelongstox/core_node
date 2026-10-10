import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import type { CmProjectDetail } from '../../../../api/CmApiTypes';
import { useCmBootstrap } from '../../../../contexts/CmBootstrapContext';
import { CM_STACK_FIELDS } from '../../../../shared/cmProjectForm';
import { useCmProjectEdit } from '../../../../shared/useCmProjectEdit';
import { MobileButton, MobileField, MobileNotice, MobileSheet, useMobileFeedback } from '../../../ui';

interface ProjectEditSheetProps {
  project: CmProjectDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Edit the project; the scope fields (budget, dates, stack) are editable only before the proposal is accepted. Mounted only while open. */
export const ProjectEditSheet: React.FC<ProjectEditSheetProps> = ({ project, onClose, onSaved }) => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const { policyList } = useCmBootstrap();
  const edit = useCmProjectEdit(project, onSaved, feedback);

  const save = async (): Promise<void> => {
    if (await edit.save()) onClose();
  };

  return (
    <MobileSheet
      open
      onClose={onClose}
      title={t('projectDetail.editTitle')}
      footer={(
        <>
          <MobileButton disabled={edit.busy} onClick={onClose}>{t('common.cancel')}</MobileButton>
          <MobileButton variant="primary" loading={edit.busy} disabled={edit.invalid} onClick={() => void save()}>{edit.busy ? t('common.saving') : t('projectDetail.saveChanges')}</MobileButton>
        </>
      )}
    >
      {!edit.scopeEditable && <MobileNotice>{t('projectDetail.scopeLocked')}</MobileNotice>}
      <MobileField label={t('projectCreate.projectTitle')} error={!edit.title.trim() && t('projectCreate.errors.titleRequired')}>
        <input className="cmm-input" value={edit.title} maxLength={255} onChange={(event) => edit.setTitle(event.target.value)} aria-invalid={!edit.title.trim()} />
      </MobileField>
      <MobileField label={t('projectCreate.summary')} error={!edit.description.trim() && t('projectCreate.errors.descriptionRequired')}>
        <textarea className="cmm-input cmm-textarea" rows={5} value={edit.description} onChange={(event) => edit.setDescription(event.target.value)} aria-invalid={!edit.description.trim()} />
      </MobileField>
      {edit.scopeEditable && (
        <>
          <MobileField label={t('projectCreate.budget')} error={edit.budgetInvalid && t('projectCreate.errors.budgetMin', { amount: edit.projectMinBudget, currency: project.currency ?? '' })}>
            <input className="cmm-input" type="number" min={edit.projectMinBudget} step="0.01" inputMode="decimal" value={edit.budget} onChange={(event) => edit.setBudget(event.target.value)} aria-invalid={edit.budgetInvalid} />
          </MobileField>
          <MobileField label={t('projectCreate.complexity')}>
            <select className="cmm-input cmm-select" value={edit.complexity} onChange={(event) => edit.setComplexity(event.target.value)}>
              {policyList('complexities').map((value) => <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>)}
            </select>
          </MobileField>
          <div className="cmm-field-pair">
            <MobileField label={t('projectCreate.startDate')}>
              <input className="cmm-input" type="date" value={edit.startDate} onChange={(event) => edit.setStartDate(event.target.value)} />
            </MobileField>
            <MobileField label={t('projectCreate.endDate')} error={edit.endInvalid && t('projectCreate.errors.endAfterStart')}>
              <input className="cmm-input" type="date" value={edit.endDate} min={edit.startDate || undefined} onChange={(event) => edit.setEndDate(event.target.value)} aria-invalid={edit.endInvalid} />
            </MobileField>
          </div>
          {CM_STACK_FIELDS.map((field) => (
            <MobileField key={field} label={t(`projectCreate.${field}`)} hint={t('projectCreate.listPlaceholder')}>
              <input className="cmm-input" value={edit.stack[field]} onChange={(event) => edit.setStackField(field, event.target.value)} />
            </MobileField>
          ))}
        </>
      )}
    </MobileSheet>
  );
};
