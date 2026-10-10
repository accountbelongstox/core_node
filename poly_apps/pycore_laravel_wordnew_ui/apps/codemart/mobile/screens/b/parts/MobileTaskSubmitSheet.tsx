import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { useCmTaskSubmit } from '../../../../shared/useCmTaskDetail';
import { MobileButton, MobileField, MobileSheet, useMobileFeedback, MobileFilePicker } from '../../../ui';

interface MobileTaskSubmitSheetProps {
  taskId: number;
  resubmit: boolean;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}

/** Deliverable submission: note, links and files (first submission, or resubmission after a revision request). Mounted only while open. */
export const MobileTaskSubmitSheet: React.FC<MobileTaskSubmitSheetProps> = ({ taskId, resubmit, onClose, onSubmitted }) => {
  const { t } = useTranslation('cm');
  const feedback = useMobileFeedback();
  const form = useCmTaskSubmit(taskId, onSubmitted, feedback);
  const { invalidUrls, rejectedUploads, allowedDocumentTypes, hasContent, canSubmit, busy } = form;

  const submit = async (): Promise<void> => {
    if (await form.submit()) onClose();
  };

  return (
    <MobileSheet
      open
      onClose={busy ? () => undefined : onClose}
      title={resubmit ? t('mobile.work.resubmitTitle') : t('tasks.submitTitle')}
      footer={(
        <>
          <MobileButton disabled={busy} onClick={onClose}>{t('common.cancel')}</MobileButton>
          <MobileButton variant="primary" loading={busy} disabled={!canSubmit} onClick={() => void submit()}>{busy ? t('tasks.submitting') : t('tasks.submit')}</MobileButton>
        </>
      )}
    >
      <p className="cmm-hint">{t('tasks.submitLead')}</p>
      <MobileField label={t('tasks.submissionNote')}>
        <textarea className="cmm-input cmm-textarea" rows={5} value={form.note} onChange={(event) => form.setNote(event.target.value)} placeholder={t('tasks.submissionPlaceholder')} />
      </MobileField>
      <MobileField
        label={`${t('tasks.fileUrls')} (${t('common.optional')})`}
        error={invalidUrls.length > 0 && t('tasks.invalidUrls', { urls: invalidUrls.join(', ') })}
      >
        <textarea className="cmm-input cmm-textarea" rows={2} value={form.fileUrls} onChange={(event) => form.setFileUrls(event.target.value)} placeholder={t('tasks.fileUrlsPlaceholder')} aria-invalid={invalidUrls.length > 0} />
      </MobileField>
      <MobileField label={`${t('tasks.uploads')} (${t('common.optional')})`}>
        <MobileFilePicker
          label={t('mobile.work.chooseFiles')}
          files={form.uploads}
          onChange={form.setUploads}
          allowedTypes={allowedDocumentTypes}
          multiple
          error={rejectedUploads.length > 0 && t('tasks.uploadWrongType', { files: rejectedUploads.map((file) => file.name).join(', '), types: allowedDocumentTypes.join(', ') })}
        />
      </MobileField>
      {!hasContent && <p className="cmm-hint">{t('tasks.submitEmptyHint')}</p>}
    </MobileSheet>
  );
};
