import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { cmApi } from '../../../api/CmApi';
import { CM_PROTECTED_ROUTE, cmProjectPath } from '../../../components/public-home/cmPublicRoutes';
import { useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../../../contexts/CmBootstrapContext';
import { useCmPolicy } from '../../../contexts/useCmPolicy';
import { CM_PROJECT_TITLE_MAX_LENGTH, CM_STACK_FIELDS } from '../../../shared/cmProjectForm';
import { cmAttachmentIssue, cmAttachmentUploadError } from '../../../shared/useCmProjectAttachments';
import { useCmProjectCreate, type CmCreateField } from '../../../shared/useCmProjectCreate';
import { MobileButton, MobileCard, MobileField, MobileNotice, MobileScreen, useMobileFeedback, MobileFilePicker, MobileKeyValues } from '../../ui';
import './styles/cm-mobile-work.css';

const STEPS = ['brief', 'budget', 'stack'] as const;
type CreateStep = typeof STEPS[number];
const STEP_FIELDS: Record<CreateStep, CmCreateField[]> = { brief: ['title', 'description'], budget: ['budget', 'endDate'], stack: [] };

/** Mobile create-project flow in three steps (brief, budget and dates, stack and files); reference files upload right after the project exists. */
const MobileProjectCreateScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const format = useCmFormat();
  const feedback = useMobileFeedback();
  const { policyList } = useCmBootstrap();
  const policy = useCmPolicy();
  const create = useCmProjectCreate(feedback);
  const { form, update, updateStack, errors, showError, canCreate, pending, currency, projectMinBudget } = create;
  const [stepIndex, setStepIndex] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const stepHasErrors = STEP_FIELDS[step].some((field) => errors[field]);
  const fileIssues = files.map((file) => cmAttachmentIssue(file, policy, t)).filter((issue): issue is string => issue !== null);

  const next = (): void => {
    if (stepHasErrors) {
      create.reveal();
      return;
    }
    setStepIndex((index) => index + 1);
  };

  const submit = async (): Promise<void> => {
    if (fileIssues.length > 0) return;
    const firstInvalid = STEPS.findIndex((candidate) => STEP_FIELDS[candidate].some((field) => errors[field]));
    if (firstInvalid >= 0) {
      create.reveal();
      setStepIndex(firstInvalid);
      return;
    }
    const projectId = await create.submit();
    if (projectId === null) return;
    setUploading(true);
    let failure: string | null = null;
    for (const file of files) {
      const response = await cmApi.uploadProjectAttachment(projectId, file, () => undefined);
      if (!response.success && failure === null) failure = cmAttachmentUploadError(response, t);
    }
    setUploading(false);
    if (failure !== null) feedback.error(failure);
    navigate(cmProjectPath(projectId), { replace: true });
  };

  return (
    <MobileScreen title={t('projectCreate.title')} className="is-fill">
      {!canCreate && <MobileNotice>{t('projectCreate.noCapability')}</MobileNotice>}
      <div className="cmm-stack-tight">
        <div className="cmm-steps" role="list" aria-label={t('mobile.work.create.stepsLabel')}>
          {STEPS.map((item, index) => (
            <React.Fragment key={item}>
              {index > 0 && <span className={`cmm-steps__line ${index <= stepIndex ? 'is-done' : ''}`} />}
              <span role="listitem" aria-current={index === stepIndex ? 'step' : undefined} className={`cmm-steps__dot ${index < stepIndex ? 'is-done' : ''} ${index === stepIndex ? 'is-current' : ''}`}>
                {index < stepIndex ? <Check size={14} aria-hidden="true" /> : index + 1}
              </span>
            </React.Fragment>
          ))}
        </div>
        <h2 className="cmm-steps__label">{t(`mobile.work.create.steps.${step}`)}</h2>
        <p className="cmm-hint">{t(`mobile.work.create.lead.${step}`)}</p>
      </div>

      <MobileCard>
        {step === 'brief' && (
          <>
            <MobileField label={t('projectCreate.projectTitle')} error={showError('title')}>
              <input className="cmm-input" value={form.title} maxLength={CM_PROJECT_TITLE_MAX_LENGTH} onChange={(event) => update({ title: event.target.value })} placeholder={t('projectCreate.projectTitlePlaceholder')} aria-invalid={Boolean(showError('title'))} />
            </MobileField>
            <MobileField label={t('projectCreate.summary')} error={showError('description')} hint={t('projectCreate.summaryHint')}>
              <textarea className="cmm-input cmm-textarea" rows={8} value={form.description} onChange={(event) => update({ description: event.target.value })} placeholder={t('projectCreate.summaryPlaceholder')} aria-invalid={Boolean(showError('description'))} />
            </MobileField>
          </>
        )}
        {step === 'budget' && (
          <>
            <MobileField label={`${t('projectCreate.budget')} (${currency})`} error={showError('budget')}>
              <input className="cmm-input" type="number" min={projectMinBudget} step="0.01" inputMode="decimal" value={form.budget} onChange={(event) => update({ budget: event.target.value })} placeholder={t('projectCreate.budgetPlaceholder', { amount: projectMinBudget, currency })} aria-invalid={Boolean(showError('budget'))} />
            </MobileField>
            <div className="cmm-field-pair">
              <MobileField label={t('projectCreate.budgetType')}>
                <select className="cmm-input cmm-select" value={form.budgetType} onChange={(event) => update({ budgetType: event.target.value })}>
                  {policyList('budget_types').map((value) => <option key={value} value={value}>{t(`projectCreate.budgetTypes.${value}`)}</option>)}
                </select>
              </MobileField>
              <MobileField label={t('projectCreate.complexity')}>
                <select className="cmm-input cmm-select" value={form.complexity} onChange={(event) => update({ complexity: event.target.value })}>
                  {policyList('complexities').map((value) => <option key={value} value={value}>{t(`estimate.complexities.${value}`)}</option>)}
                </select>
              </MobileField>
            </div>
            <div className="cmm-field-pair">
              <MobileField label={t('projectCreate.startDate')}>
                <input className="cmm-input" type="date" value={form.startDate} onChange={(event) => update({ startDate: event.target.value })} />
              </MobileField>
              <MobileField label={t('projectCreate.endDate')} error={showError('endDate')}>
                <input className="cmm-input" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => update({ endDate: event.target.value })} aria-invalid={Boolean(showError('endDate'))} />
              </MobileField>
            </div>
          </>
        )}
        {step === 'stack' && (
          <>
            <p className="cmm-hint">{t('projectCreate.listPlaceholder')}</p>
            {CM_STACK_FIELDS.map((field) => (
              <MobileField key={field} label={t(`projectCreate.${field}`)}>
                <input className="cmm-input" value={form.stack[field]} onChange={(event) => updateStack(field, event.target.value)} placeholder={t(`projectCreate.placeholders.${field}`)} />
              </MobileField>
            ))}
            <MobileField label={`${t('attachments.title')} (${t('common.optional')})`} hint={t('mobile.work.create.filesHint', { types: policy.allowedDocumentTypes.join(', '), size: Math.round(policy.maxAttachmentKb / 1024) })}>
              <MobileFilePicker label={t('attachments.choose')} files={files} onChange={setFiles} allowedTypes={policy.allowedDocumentTypes} multiple error={fileIssues[0] ?? false} />
            </MobileField>
          </>
        )}
      </MobileCard>

      {isLast && (
        <MobileCard>
          <MobileKeyValues
            items={[
              { label: t('projectCreate.projectTitle'), value: form.title.trim() },
              { label: t('projectCreate.budget'), value: form.budget ? format.money(form.budget, currency) : '' },
              { label: t('projectCreate.complexity'), value: t(`estimate.complexities.${form.complexity}`, { defaultValue: form.complexity }) },
              { label: t('attachments.title'), value: files.length > 0 ? format.number(files.length) : '' },
            ]}
          />
        </MobileCard>
      )}
      {create.submitted && Object.keys(errors).length > 0 && isLast && <MobileNotice tone="error">{t('projectCreate.errors.fixFields')}</MobileNotice>}

      <div className="cmm-stickybar">
        {stepIndex > 0 ? (
          <MobileButton disabled={pending || uploading} onClick={() => setStepIndex((index) => index - 1)}>{t('common.previous')}</MobileButton>
        ) : (
          <MobileButton to={CM_PROTECTED_ROUTE.projects}>{t('common.cancel')}</MobileButton>
        )}
        {isLast ? (
          <MobileButton variant="primary" loading={pending || uploading} disabled={!canCreate || fileIssues.length > 0} onClick={() => void submit()}>
            {pending || uploading ? t('projectCreate.creating') : t('projectCreate.submit')}
          </MobileButton>
        ) : (
          <MobileButton variant="primary" onClick={next}>{t('common.next')}</MobileButton>
        )}
      </div>
    </MobileScreen>
  );
};

export default MobileProjectCreateScreen;
