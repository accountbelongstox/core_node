import React from 'react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { useCmEmailChange } from '../../../../shared/useCmProfile';
import { MobileButton, MobileField, MobileSheet } from '../../../ui';
import { MobilePasswordInput } from '../parts/MobilePasswordInput';
import { useInlineFeedback } from '../parts/useInlineFeedback';

interface EmailChangeSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Email change: the new address gets a confirmation link, the account password authorizes the request. */
export const EmailChangeSheet: React.FC<EmailChangeSheetProps> = ({ open, onClose }) => {
  const { t } = useTranslation('cm');
  const { feedback, notice, clear } = useInlineFeedback();
  const form = useCmEmailChange(feedback);

  const close = (): void => {
    clear();
    onClose();
  };

  return (
    <MobileSheet
      open={open}
      onClose={close}
      title={t('settings.email.title')}
      footer={<MobileButton variant="primary" block loading={form.busy} disabled={!form.canSubmit} onClick={() => void form.submit()}>{form.busy ? t('common.saving') : t('settings.email.submit')}</MobileButton>}
    >
      <div className="cmmc-form">
        <p className="cmm-muted">{t('settings.email.lead', { email: form.currentEmail ?? t('common.unavailable') })}</p>
        {form.pendingEmail && <p className="cmm-muted">{t('settings.email.pending', { email: form.pendingEmail })}</p>}
        <MobileField label={t('settings.email.newEmail')} error={form.newEmail !== '' && !form.emailValid && t('publicAuth.errors.emailInvalid')}>
          <input className="cmm-input" type="email" autoComplete="email" value={form.newEmail} aria-invalid={form.newEmail !== '' && !form.emailValid} onChange={(event) => form.setNewEmail(event.target.value)} />
        </MobileField>
        <MobileField label={t('settings.email.password')}>
          <MobilePasswordInput autoComplete="current-password" value={form.password} onChange={(event) => form.setPassword(event.target.value)} />
        </MobileField>
        {notice}
      </div>
    </MobileSheet>
  );
};
