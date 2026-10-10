import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmAuthLayout } from '../auth/CmAuthLayout';
import { CmPasswordInput } from '../auth/CmPasswordInput';
import { CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';
import { useCmLogin } from '../shared/useCmLogin';

export const CmLoginPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const login = useCmLogin();
  const { fieldErrors, errorKey, pending, sessionExpired, returnPath } = login;

  if (login.redirectTo) return <Navigate to={login.redirectTo} replace />;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void login.submit();
  };

  return (
    <CmAuthLayout titleKey="publicAuth.login.title" leadKey="publicAuth.login.lead" icon={<LogIn aria-hidden="true" />}>
      <form className="cm-public-form" onSubmit={submit} noValidate>
        {sessionExpired && !errorKey && (
          <p className="cm-public-form__notice" role="status">{t('publicAuth.login.sessionExpired')}</p>
        )}
        {returnPath && !sessionExpired && (
          <p className="cm-public-form__notice" role="status">{t('publicAuth.login.returnNotice')}</p>
        )}
        <label>
          <span>{t('publicAuth.login.identifier')}</span>
          <input
            value={login.identifier}
            onChange={(event) => login.setIdentifier(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            aria-invalid={Boolean(fieldErrors.identifier)}
            aria-describedby="cm-login-identifier-error"
          />
          {fieldErrors.identifier && <small className="cm-public-form__error" id="cm-login-identifier-error">{t(fieldErrors.identifier)}</small>}
        </label>
        <label>
          <span className="cm-auth-shell__label-row">
            {t('publicAuth.password')}
            <Link className="cm-public-form__link" to={CM_PUBLIC_ROUTE.forgotPassword}>{t('publicAuth.forgot.link')}</Link>
          </span>
          <CmPasswordInput
            value={login.password}
            onChange={(event) => login.setPassword(event.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby="cm-login-password-error"
          />
          {fieldErrors.password && <small className="cm-public-form__error" id="cm-login-password-error">{t(fieldErrors.password)}</small>}
        </label>
        {errorKey && <p className="cm-public-form__notice is-error" role="alert">{t(errorKey)}</p>}
        <button type="submit" className="cm-public-button cm-public-button--primary cm-public-form__submit" disabled={pending}>
          <LogIn aria-hidden="true" /> {pending ? t('publicAuth.login.submitting') : t('publicAuth.login.submit')}
        </button>
        <p className="cm-auth-shell__switch">
          {t('publicAuth.login.noAccount')}{' '}
          <Link className="cm-public-form__link" to={CM_PUBLIC_ROUTE.register}>{t('nav.register')}</Link>
        </p>
      </form>
    </CmAuthLayout>
  );
};

export default CmLoginPage;
