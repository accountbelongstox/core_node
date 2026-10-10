import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PUBLIC_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmForgotPassword, useCmPasswordReset } from '../../../shared/useCmPasswordRecovery';
import { MobileButton, MobileField, MobileNotice, MobilePasswordInput, MobileScreen } from '../../ui';
import { MobileFormLinks, MobilePageHead } from './MobilePublicParts';

/** Mobile "forgot password": request a reset link by email. */
export const MobileForgotPasswordScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const forgot = useCmForgotPassword();
  const { email, fieldError, pending, sent, error } = forgot;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void forgot.submit();
  };

  return (
    <MobileScreen>
      <MobilePageHead
        titleKey="publicAuth.forgot.title"
        leadKey="publicAuth.forgot.lead"
        title={t('publicAuth.forgot.title')}
        lead={t('publicAuth.forgot.lead')}
        icon={<Mail aria-hidden="true" />}
      />
      {sent ? (
        <MobileNotice tone="success" action={<button type="button" className="cmm-link-btn" onClick={forgot.resend}>{t('publicAuth.forgot.resend')}</button>}>
          {t('publicAuth.forgot.sent', { email: email.trim() })}
        </MobileNotice>
      ) : (
        <form className="cmm-a-form" onSubmit={submit} noValidate>
          <MobileField label={t('publicAuth.email')} error={fieldError && t(fieldError)}>
            <input
              className="cmm-input"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => forgot.setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(fieldError)}
            />
          </MobileField>
          {error && <MobileNotice tone="error">{error}</MobileNotice>}
          <MobileButton type="submit" variant="primary" block loading={pending} icon={<Mail aria-hidden="true" />}>
            {pending ? t('publicAuth.forgot.submitting') : t('publicAuth.forgot.submit')}
          </MobileButton>
        </form>
      )}
      <MobileFormLinks links={[
        { to: CM_PUBLIC_ROUTE.login, label: t('publicAuth.haveAccount') },
        { to: CM_PUBLIC_ROUTE.register, label: t('publicAuth.noAccount') },
      ]}
      />
    </MobileScreen>
  );
};

/** Mobile password reset with the token from the emailed link. */
export const MobilePasswordResetScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const { token = '' } = useParams<{ token: string }>();
  const reset = useCmPasswordReset(token);
  const { email, password, passwordConfirmation, fieldErrors, passwordMin, pending, done, error } = reset;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void reset.submit();
  };
  const requestNew = <Link className="cmm-link-btn" to={CM_PUBLIC_ROUTE.forgotPassword}>{t('publicAuth.reset.requestNew')}</Link>;

  return (
    <MobileScreen>
      <MobilePageHead
        titleKey="publicAuth.reset.title"
        leadKey="publicAuth.reset.lead"
        title={t('publicAuth.reset.title')}
        lead={t('publicAuth.reset.lead')}
        icon={<KeyRound aria-hidden="true" />}
      />
      {!token ? (
        <MobileNotice tone="error" action={requestNew}>{t('publicAuth.reset.invalidLink')}</MobileNotice>
      ) : done ? (
        <MobileNotice tone="success" action={<Link className="cmm-link-btn" to={CM_PUBLIC_ROUTE.login}>{t('nav.login')}</Link>}>
          {t('publicAuth.reset.success')}
        </MobileNotice>
      ) : (
        <form className="cmm-a-form" onSubmit={submit} noValidate>
          <MobileField label={t('publicAuth.email')} error={fieldErrors.email && t(fieldErrors.email)}>
            <input
              className="cmm-input"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => reset.setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(fieldErrors.email)}
            />
          </MobileField>
          <MobileField label={t('publicAuth.reset.newPassword')} error={fieldErrors.password && t(fieldErrors.password, { min: passwordMin })}>
            <MobilePasswordInput value={password} onChange={(event) => reset.setPassword(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} />
          </MobileField>
          <MobileField label={t('publicAuth.passwordConfirmation')} error={fieldErrors.passwordConfirmation && t(fieldErrors.passwordConfirmation)}>
            <MobilePasswordInput value={passwordConfirmation} onChange={(event) => reset.setPasswordConfirmation(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.passwordConfirmation)} />
          </MobileField>
          {error && <MobileNotice tone="error" action={requestNew}>{error}</MobileNotice>}
          <MobileButton type="submit" variant="primary" block loading={pending} icon={<KeyRound aria-hidden="true" />}>
            {pending ? t('publicAuth.reset.submitting') : t('publicAuth.reset.submit')}
          </MobileButton>
        </form>
      )}
    </MobileScreen>
  );
};
