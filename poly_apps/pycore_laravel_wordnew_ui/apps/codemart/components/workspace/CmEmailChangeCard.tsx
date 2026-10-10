import React from 'react';
import { Mail } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmPasswordInput } from '../../auth/CmPasswordInput';
import { CM_EMAIL_CHANGE_QUERY_PARAM, useCmEmailChange } from '../../shared/useCmProfile';
import { CmNotice, useCmNotice } from './CmStateViews';

export { CM_EMAIL_CHANGE_QUERY_PARAM };

/**
 * Email change with confirmation: the new address receives a one-time link
 * (`/settings?email_change_token=...`); opening it while signed in applies the change.
 */
export const CmEmailChangeCard: React.FC = () => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const form = useCmEmailChange(notice);

  return (
    <section className="cm-section-card">
      <h2><Mail aria-hidden="true" /> {t('settings.email.title')}</h2>
      <p className="cm-section-card__lead">{t('settings.email.lead', { email: form.currentEmail ?? t('common.unavailable') })}</p>
      <form className="cm-settings-form" onSubmit={(event) => { event.preventDefault(); void form.submit(); }} noValidate>
        <CmNotice notice={notice.notice} onDismiss={notice.clear} />
        {form.pendingEmail && <p className="cm-field-hint">{t('settings.email.pending', { email: form.pendingEmail })}</p>}
        <label className="cm-stacked-field">
          <span>{t('settings.email.newEmail')}</span>
          <input type="email" value={form.newEmail} autoComplete="email" onChange={(event) => form.setNewEmail(event.target.value)} aria-invalid={form.newEmail !== '' && !form.emailValid} />
          {form.newEmail !== '' && !form.emailValid && <small className="cm-field-error">{t('publicAuth.errors.emailInvalid')}</small>}
        </label>
        <label className="cm-stacked-field">
          <span>{t('settings.email.password')}</span>
          <CmPasswordInput value={form.password} onChange={(event) => form.setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        <div className="cm-table-actions">
          <button type="submit" className="cm-workspace-button is-primary" disabled={!form.canSubmit}>
            {form.busy ? t('common.saving') : t('settings.email.submit')}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CmEmailChangeCard;
