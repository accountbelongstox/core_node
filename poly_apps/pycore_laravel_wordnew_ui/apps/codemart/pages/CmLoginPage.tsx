import React, { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { notifyAuthLoginSuccess } from '../../../core/auth/AuthRequestCenter';
import { setAuthToken } from '../../../core/auth/AuthSession';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmApi } from '../api/CmApi';
import { cmErrorCode } from '../api/cmErrors';
import { cmAuthApi } from '../auth/CmAuthApi';
import { CmAuthLayout } from '../auth/CmAuthLayout';
import {
  CM_LOGIN_REDIRECT_PARAM,
  cmClearReturnPath,
  cmClearSessionExpired,
  cmDefaultLandingPath,
  cmSafeReturnPath,
  cmSessionExpired,
  cmStoredReturnPath,
} from '../auth/cmAuthSession';
import { CmPasswordInput } from '../auth/CmPasswordInput';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';

type CmLoginField = 'identifier' | 'password';

const INVALID_CREDENTIAL_CODES = ['AUTH_USER_NOT_FOUND', 'AUTH_INVALID_PASSWORD'];
const HTTP_UNPROCESSABLE = 422;
const HTTP_TOO_MANY_REQUESTS = 429;

function loginErrorKey(response: APIResponse<unknown>): string {
  const code = cmErrorCode(response);
  if (code && INVALID_CREDENTIAL_CODES.includes(code)) return 'publicAuth.login.errors.invalidCredentials';
  if (response.status === HTTP_TOO_MANY_REQUESTS) return 'publicAuth.errors.throttled';
  if (response.status === 0 || response.isNetworkError || response.isTimeout) return 'publicAuth.errors.network';
  if (response.status === HTTP_UNPROCESSABLE) return 'publicAuth.login.errors.invalidCredentials';
  return 'publicAuth.login.errors.failed';
}

export const CmLoginPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authenticated = useAuthSession();
  const completingRef = useRef(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CmLoginField, string>>>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionExpired] = useState(cmSessionExpired);
  const returnPath = cmSafeReturnPath(searchParams.get(CM_LOGIN_REDIRECT_PARAM)) ?? cmStoredReturnPath();

  if (authenticated && !completingRef.current) {
    return <Navigate to={returnPath ?? CM_PROTECTED_ROUTE.dashboard} replace />;
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors: Partial<Record<CmLoginField, string>> = {};
    if (!identifier.trim()) errors.identifier = 'publicAuth.login.errors.identifierRequired';
    if (!password) errors.password = 'publicAuth.login.errors.passwordRequired';
    setFieldErrors(errors);
    setErrorKey(null);
    if (Object.keys(errors).length > 0) return;
    setPending(true);
    const response = await cmAuthApi.login(identifier.trim(), password);
    if (!response.success || !response.data?.token) {
      setPending(false);
      setErrorKey(loginErrorKey(response));
      return;
    }
    completingRef.current = true;
    setAuthToken(response.data.token);
    notifyAuthLoginSuccess(response.data.user, null);
    let target = returnPath;
    if (!target) {
      const bootstrap = await cmApi.getBootstrap();
      target = cmDefaultLandingPath(Boolean(bootstrap.data?.is_admin));
    }
    cmClearReturnPath();
    cmClearSessionExpired();
    navigate(target, { replace: true });
  };

  return (
    <CmAuthLayout titleKey="publicAuth.login.title" leadKey="publicAuth.login.lead" icon={<LogIn aria-hidden="true" />}>
      <form className="cm-public-form" onSubmit={(event) => void submit(event)} noValidate>
        {sessionExpired && !errorKey && (
          <p className="cm-public-form__notice" role="status">{t('publicAuth.login.sessionExpired')}</p>
        )}
        {returnPath && !sessionExpired && (
          <p className="cm-public-form__notice" role="status">{t('publicAuth.login.returnNotice')}</p>
        )}
        <label>
          <span>{t('publicAuth.login.identifier')}</span>
          <input
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setFieldErrors((current) => ({ ...current, identifier: undefined }));
            }}
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
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
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
