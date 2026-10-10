import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmAuthApi } from '../../auth/CmAuthApi';
import { CmPasswordInput } from '../../auth/CmPasswordInput';
import { useCmPasswordMinLength } from '../../contexts/useCmPolicy';
import { CmNotice, useCmNotice } from './CmStateViews';

const HTTP_VALIDATION_STATUS = 422;

/** Signed-in password change on the shared account API (`POST /user/change-password`). */
export const CmPasswordChangeCard: React.FC = () => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const passwordMin = useCmPasswordMinLength();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const tooShort = next !== '' && next.length < passwordMin;
  const mismatch = confirm !== '' && confirm !== next;
  const invalid = !current || next.length < passwordMin || confirm !== next;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || invalid) return;
    setBusy(true);
    notice.clear();
    const response = await cmAuthApi.changePassword(current, next, confirm);
    setBusy(false);
    if (response.success) {
      setCurrent('');
      setNext('');
      setConfirm('');
      notice.success(t('settings.password.changed'));
    } else {
      notice.error(t(response.status === HTTP_VALIDATION_STATUS ? 'settings.password.currentIncorrect' : 'settings.password.failed'));
    }
  };

  return (
    <section className="cm-section-card">
      <h2><KeyRound aria-hidden="true" /> {t('settings.password.title')}</h2>
      <p className="cm-section-card__lead">{t('settings.password.lead')}</p>
      <form className="cm-settings-form" onSubmit={(event) => void submit(event)} noValidate>
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
