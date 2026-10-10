import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { cmPublicApi } from '../api/CmPublicApi';
import { useCmPasswordMinLength } from '../contexts/useCmPolicy';
import { CM_EMAIL_PATTERN, cmServerFieldNames, type CmFieldErrors } from './useCmRegister';

const HTTP_TOO_MANY_REQUESTS = 429;

export interface CmForgotPasswordModel {
  email: string;
  setEmail: (value: string) => void;
  /** Translation key of the field error. */
  fieldError: string | undefined;
  pending: boolean;
  sent: boolean;
  error: string | null;
  resend: () => void;
  submit: () => Promise<void>;
}

/** Password-reset request (email) shared by the web and mobile forgot-password screens. */
export function useCmForgotPassword(): CmForgotPasswordModel {
  const { t } = useTranslation('cm');
  const [email, setEmailState] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setEmail = useCallback((value: string): void => {
    setEmailState(value);
    setFieldError(undefined);
  }, []);

  const submit = useCallback(async (): Promise<void> => {
    setError(null);
    if (!CM_EMAIL_PATTERN.test(email.trim())) {
      setFieldError('publicAuth.errors.emailInvalid');
      return;
    }
    setFieldError(undefined);
    setPending(true);
    const response = await cmPublicApi.requestPasswordReset(email.trim());
    setPending(false);
    if (response.success) {
      setSent(true);
      return;
    }
    if (response.status === HTTP_TOO_MANY_REQUESTS) setError(t('publicAuth.errors.throttled'));
    else if (cmServerFieldNames(response).includes('email')) setFieldError('publicAuth.forgot.emailRejected');
    else setError(cmErrorMessage(t, response, 'publicAuth.forgot.failed'));
  }, [email, t]);

  const resend = useCallback((): void => setSent(false), []);

  return { email, setEmail, fieldError, pending, sent, error, resend, submit };
}

export type CmResetField = 'email' | 'password' | 'passwordConfirmation';

export interface CmPasswordResetModel {
  token: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setPasswordConfirmation: (value: string) => void;
  /** Translation keys of the field errors (some take the `min` password length). */
  fieldErrors: CmFieldErrors<CmResetField>;
  passwordMin: number;
  pending: boolean;
  done: boolean;
  error: string | null;
  submit: () => Promise<void>;
}

/** Password reset with the emailed token, shared by the web and mobile reset screens. */
export function useCmPasswordReset(token: string): CmPasswordResetModel {
  const { t } = useTranslation('cm');
  const [searchParams] = useSearchParams();
  const passwordMin = useCmPasswordMinLength();
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CmFieldErrors<CmResetField>>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (): Promise<void> => {
    setError(null);
    const errors: CmFieldErrors<CmResetField> = {};
    if (!CM_EMAIL_PATTERN.test(email.trim())) errors.email = 'publicAuth.errors.emailInvalid';
    if (password.length < passwordMin) errors.password = 'publicAuth.errors.passwordLength';
    if (passwordConfirmation !== password) errors.passwordConfirmation = 'publicAuth.errors.passwordMismatch';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setPending(true);
    const response = await cmPublicApi.resetPassword({
      token,
      email: email.trim(),
      password,
      password_confirmation: passwordConfirmation,
    });
    setPending(false);
    if (response.success) {
      setDone(true);
      return;
    }
    const fields = cmServerFieldNames(response);
    if (response.status === HTTP_TOO_MANY_REQUESTS) setError(t('publicAuth.errors.throttled'));
    else if (fields.includes('password')) setFieldErrors({ password: 'publicAuth.reset.passwordRejected' });
    else if (fields.includes('email') || fields.includes('token')) setError(t('publicAuth.reset.invalidLink'));
    else setError(cmErrorMessage(t, response, 'publicAuth.reset.failed'));
  }, [email, password, passwordConfirmation, passwordMin, token, t]);

  return {
    token, email, password, passwordConfirmation, setEmail, setPassword, setPasswordConfirmation,
    fieldErrors, passwordMin, pending, done, error, submit,
  };
}
