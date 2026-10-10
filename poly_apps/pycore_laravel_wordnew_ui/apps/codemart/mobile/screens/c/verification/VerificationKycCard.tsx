import React, { useState } from 'react';
import { IdCard } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { useCmKycForm } from '../../../../shared/useCmVerification';
import { MobileButton, MobileCard, MobileField, MobileNotice, MobileSheet } from '../../../ui';
import { MobileImagePicker } from '../parts/MobileImagePicker';
import { useInlineFeedback } from '../parts/useInlineFeedback';

interface VerificationKycCardProps {
  rejected: boolean;
  onSubmitted: (message: string) => Promise<void>;
}

/** KYC submission in a full form sheet: identity fields and document photos from the camera or the gallery. */
export const VerificationKycCard: React.FC<VerificationKycCardProps> = ({ rejected, onSubmitted }) => {
  const { t } = useTranslation('cm');
  const [open, setOpen] = useState(false);
  const { feedback, notice, clear } = useInlineFeedback();
  const form = useCmKycForm(feedback, async (message) => {
    setOpen(false);
    await onSubmitted(message);
  });
  const uploading = form.progress !== null;
  const required = t('verification.fieldRequired');

  const close = (): void => {
    if (uploading) return;
    clear();
    setOpen(false);
  };

  return (
    <MobileCard className="cmmc-card">
      <h3 className="cmmc-card__title"><IdCard aria-hidden="true" /> {t('verification.kycTitle')}</h3>
      <p className="cmm-muted">{t('verification.kycDescription')}</p>
      {rejected && <MobileNotice tone="error">{t('verification.kycRejectedNote')}</MobileNotice>}
      <MobileButton variant="primary" block onClick={() => setOpen(true)}>{t('verification.submitKyc')}</MobileButton>

      <MobileSheet
        open={open}
        onClose={close}
        title={t('verification.kycTitle')}
        footer={(
          <MobileButton variant="primary" block loading={uploading} onClick={() => void form.submit()}>
            {uploading ? t('verification.uploadingKyc', { progress: form.progress }) : t('verification.submitKyc')}
          </MobileButton>
        )}
      >
        <div className="cmmc-form">
          <MobileField label={t('verification.identityType')}>
            <select className="cmm-input" value={form.identityType} onChange={(event) => form.setIdentityType(event.target.value)}>
              {form.identityTypes.map((type) => <option key={type} value={type}>{t(`verification.identityTypes.${type}`, { defaultValue: type })}</option>)}
            </select>
          </MobileField>
          <MobileField label={t('verification.identityNumber')} error={form.show('identityNumber') && required}>
            <input className="cmm-input" value={form.identityNumber} aria-invalid={form.show('identityNumber')} onChange={(event) => form.setIdentityNumber(event.target.value)} />
          </MobileField>
          <MobileField label={t('verification.realName')} error={form.show('realName') && required}>
            <input className="cmm-input" autoComplete="name" value={form.realName} aria-invalid={form.show('realName')} onChange={(event) => form.setRealName(event.target.value)} />
          </MobileField>
          <MobileField label={t('verification.dateOfBirth')} error={form.show('dateOfBirth') && required}>
            <input className="cmm-input" type="date" value={form.dateOfBirth} aria-invalid={form.show('dateOfBirth')} onChange={(event) => form.setDateOfBirth(event.target.value)} />
          </MobileField>
          <MobileImagePicker label={t('verification.idFront')} file={form.files.idFront} onChange={(file) => form.setFile('idFront', file)} error={form.show('idFront') && t('verification.fileRequired')} />
          {form.needsBack && (
            <MobileImagePicker label={t('verification.idBack')} file={form.files.idBack} onChange={(file) => form.setFile('idBack', file)} error={form.show('idBack') && t('verification.fileRequired')} />
          )}
          <MobileImagePicker label={t('verification.selfie')} camera="user" file={form.files.selfie} onChange={(file) => form.setFile('selfie', file)} error={form.show('selfie') && t('verification.fileRequired')} />
          {uploading && <progress className="cmmc-progress" max={100} value={form.progress ?? 0} aria-label={t('verification.uploadingKyc', { progress: form.progress })} />}
          <p className="cmm-muted">{t('verification.kycPrivacy')}</p>
          {notice}
        </div>
      </MobileSheet>
    </MobileCard>
  );
};
