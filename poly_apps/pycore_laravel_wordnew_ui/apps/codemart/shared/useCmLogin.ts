import { useCallback, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { notifyAuthLoginSuccess } from '../../../core/auth/AuthRequestCenter';
import { setAuthToken } from '../../../core/auth/AuthSession';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmApi } from '../api/CmApi';
import { cmErrorCode } from '../api/cmErrors';
import { cmAuthApi } from '../auth/CmAuthApi';
import {
  CM_LOGIN_REDIRECT_PARAM,
  cmClearReturnPath,
  cmClearSessionExpired,
  cmDefaultLandingPath,
  cmSafeReturnPath,
  cmSessionExpired,
  cmStoredReturnPath,
} from '../auth/cmAuthSession';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';

export type CmLoginField = 'identifier' | 'password';

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

export interface CmLoginModel {
  identifier: string;
  password: string;
  setIdentifier: (value: string) => void;
  setPassword: (value: string) => void;
  /** Translation keys of the field errors. */
  fieldErrors: Partial<Record<CmLoginField, string>>;
  /** Translation key of the submit error. */
  errorKey: string | null;
  pending: boolean;
  sessionExpired: boolean;
  returnPath: string | null;
  /** Path to leave for when a session already exists, otherwise null. */
  redirectTo: string | null;
  submit: () => Promise<void>;
}

/** Sign-in form state and flow shared by the web and mobile login screens. */
export function useCmLogin(): CmLoginModel {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authenticated = useAuthSession();
  const completingRef = useRef(false);
  const [identifier, setIdentifierState] = useState('');
  const [password, setPasswordState] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CmLoginField, string>>>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionExpired] = useState(cmSessionExpired);
  const returnPath = cmSafeReturnPath(searchParams.get(CM_LOGIN_REDIRECT_PARAM)) ?? cmStoredReturnPath();
  const redirectTo = authenticated && !completingRef.current ? returnPath ?? CM_PROTECTED_ROUTE.dashboard : null;

  const setIdentifier = useCallback((value: string): void => {
    setIdentifierState(value);
    setFieldErrors((current) => ({ ...current, identifier: undefined }));
  }, []);

  const setPassword = useCallback((value: string): void => {
    setPasswordState(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
  }, []);

  const submit = useCallback(async (): Promise<void> => {
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
  }, [identifier, password, returnPath, navigate]);

  return { identifier, password, setIdentifier, setPassword, fieldErrors, errorKey, pending, sessionExpired, returnPath, redirectTo, submit };
}
