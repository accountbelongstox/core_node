import React from 'react';
import { KeyRound } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmPasswordInput } from '../../auth/CmPasswordInput';
import { useCmPasswordChange } from '../../shared/useCmPasswordChange';
import { CmNotice, useCmNotice } from './CmStateViews';

/** Signed-in password change on the shared account API (`POST /user/change-password`). */
export const CmPasswordChangeCard: React.FC = () => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const { current, next, confirm, setCurrent, setNext, setConfirm, passwordMin, tooShort, mismatch, invalid, busy, submit } = useCmPasswordChange(notice);

  return (
    <section className="cm-section-card">
      <h2><KeyRound aria-hidden="true" /> {t('settings.password.title')}</h2>
      <p className="cm-section-card__lead">{t('settings.password.lead')}</p>
      <form className="cm-settings-form" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
        <CmNotice notice={notice.notice} onDismiss={notice.clear} />
        <label className="cm-stacked-field">
          <span>{t('settings.password.current')}</span>
          <CmPasswordInput value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" />
        </label>
        <label className="cm-stacked-field">
          <span>{t('settings.password.next')}</span>
          <CmPasswordInput value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" aria-invalid={tooShort} />
          {tooShort && <small className="cm-field-error">{t('publicAuth.errors.passwordLength', { min: passwordMin })}</small>}
        </label>
        <label className="cm-stacked-field">
          <span>{t('settings.password.confirm')}</span>
          <CmPasswordInput value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
          {mismatch && <small className="cm-field-error">{t('publicAuth.errors.passwordMismatch')}</small>}
        </label>
        <div className="cm-table-actions">
          <button type="submit" className="cm-workspace-button is-primary" disabled={busy || invalid}>
            {busy ? t('common.saving') : t('settings.password.submit')}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CmPasswordChangeCard;
