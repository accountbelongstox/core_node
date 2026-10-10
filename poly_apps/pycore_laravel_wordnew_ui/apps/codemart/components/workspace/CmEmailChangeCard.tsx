import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { cmApi } from '../../api/CmApi';
import { cmErrorMessage } from '../../api/cmErrors';
import { CmPasswordInput } from '../../auth/CmPasswordInput';
import { useCmBootstrap } from '../../contexts/CmBootstrapContext';
import { CmNotice, useCmNotice } from './CmStateViews';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CM_EMAIL_CHANGE_QUERY_PARAM = 'email_change_token';

/**
 * Email change with confirmation: the new address receives a one-time link
 * (`/settings?email_change_token=...`); opening it while signed in applies the change.
 */
export const CmEmailChangeCard: React.FC = () => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const { bootstrap, refresh } = useCmBootstrap();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const confirmedToken = useRef<string | null>(null);
  const token = searchParams.get(CM_EMAIL_CHANGE_QUERY_PARAM);
  const emailValid = EMAIL_PATTERN.test(newEmail.trim());

  useEffect(() => {
    if (!token || confirmedToken.current === token) return;
    confirmedToken.current = token;
    void (async () => {
      const response = await cmApi.confirmEmailChange(token);
      const next = new URLSearchParams(searchParams);
      next.delete(CM_EMAIL_CHANGE_QUERY_PARAM);
      setSearchParams(next, { replace: true });
      if (response.success && response.data) {
        setPendingEmail(null);
        notice.success(t('settings.email.changed', { email: response.data.email }));
        await refresh();
      } else {
        notice.error(cmErrorMessage(t, response, 'settings.email.confirmFailed'));
      }
    })();
  }, [token, searchParams, setSearchParams, notice, refresh, t]);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || !emailValid || !password) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.requestEmailChange(newEmail.trim(), password);
    setBusy(false);
    if (response.success && response.data) {
      setPendingEmail(response.data.pending_email);
      setPassword('');
      setNewEmail('');
      notice.success(t('settings.email.requested', { email: response.data.pending_email, hours: response.data.expires_in_hours }));
    } else {
      notice.error(cmErrorMessage(t, response, 'settings.email.failed'));
    }
  };

  return (
    <section className="cm-section-card">
      <h2><Mail aria-hidden="true" /> {t('settings.email.title')}</h2>
      <p className="cm-section-card__lead">{t('settings.email.lead', { email: bootstrap?.user.email ?? t('common.unavailable') })}</p>
      <form className="cm-settings-form" onSubmit={(event) => void submit(event)} noValidate>
        <CmNotice notice={notice.notice} onDismiss={notice.clear} />
        {pendingEmail && <p className="cm-field-hint">{t('settings.email.pending', { email: pendingEmail })}</p>}
        <label className="cm-stacked-field">
          <span>{t('settings.email.newEmail')}</span>
          <input type="email" value={newEmail} autoComplete="email" onChange={(event) => setNewEmail(event.target.value)} aria-invalid={newEmail !== '' && !emailValid} />
          {newEmail !== '' && !emailValid && <small className="cm-field-error">{t('publicAuth.errors.emailInvalid')}</small>}
        </label>
        <label className="cm-stacked-field">
          <span>{t('settings.email.password')}</span>
          <CmPasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        <div className="cm-table-actions">
          <button type="submit" className="cm-workspace-button is-primary" disabled={busy || !emailValid || !password}>
            {busy ? t('common.saving') : t('settings.email.submit')}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CmEmailChangeCard;
