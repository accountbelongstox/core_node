import React from 'react';
import { Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PUBLIC_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmLogin } from '../../../shared/useCmLogin';
import { MobileButton, MobileField, MobileNotice, MobilePasswordInput, MobileScreen } from '../../ui';
import { MobileFormLinks, MobilePageHead } from './MobilePublicParts';

/** Mobile sign-in: username or email, password with show toggle, session-expired and return-path notices. */
const MobileLoginScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const login = useCmLogin();
  const { fieldErrors, errorKey, pending, sessionExpired, returnPath } = login;

  if (login.redirectTo) return <Navigate to={login.redirectTo} replace />;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void login.submit();
  };

  return (
    <MobileScreen>
      <MobilePageHead
        titleKey="publicAuth.login.title"
        leadKey="publicAuth.login.lead"
        title={t('publicAuth.login.title')}
        lead={t('publicAuth.login.lead')}
        icon={<LogIn aria-hidden="true" />}
      />
      <form className="cmm-a-form" onSubmit={submit} noValidate>
        {sessionExpired && !errorKey && <MobileNotice>{t('publicAuth.login.sessionExpired')}</MobileNotice>}
        {returnPath && !sessionExpired && <MobileNotice>{t('publicAuth.login.returnNotice')}</MobileNotice>}
        <MobileField label={t('publicAuth.login.identifier')} error={fieldErrors.identifier && t(fieldErrors.identifier)}>
          <input
            className="cmm-input"
            value={login.identifier}
            onChange={(event) => login.setIdentifier(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={Boolean(fieldErrors.identifier)}
          />
        </MobileField>
        <MobileField label={t('publicAuth.password')} error={fieldErrors.password && t(fieldErrors.password)}>
          <MobilePasswordInput
            value={login.password}
            onChange={(event) => login.setPassword(event.target.value)}
            autoComplete="current-password"
            enterKeyHint="go"
            aria-invalid={Boolean(fieldErrors.password)}
          />
        </MobileField>
        {errorKey && <MobileNotice tone="error">{t(errorKey)}</MobileNotice>}
        <MobileButton type="submit" variant="primary" block loading={pending} icon={<LogIn aria-hidden="true" />}>
          {pending ? t('publicAuth.login.submitting') : t('publicAuth.login.submit')}
        </MobileButton>
      </form>
      <MobileFormLinks links={[
        { to: CM_PUBLIC_ROUTE.forgotPassword, label: t('publicAuth.forgot.link') },
        { to: CM_PUBLIC_ROUTE.register, label: `${t('publicAuth.login.noAccount')} ${t('nav.register')}` },
      ]}
      />
    </MobileScreen>
  );
};

export default MobileLoginScreen;
