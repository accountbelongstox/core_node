import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { KeyRound, LogIn, Mail, UserPlus } from 'lucide-react';
import { notifyAuthLoginSuccess } from '../../../core/auth/AuthRequestCenter';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmApi } from '../api/CmApi';
import type { CmRegisterPayload } from '../api/CmApiTypes';
import { cmErrorCode, cmErrorMessage } from '../api/cmErrors';
import { cmPublicApi } from '../api/CmPublicApi';
import { CmAuthLayout } from '../auth/CmAuthLayout';
import { CmPasswordInput } from '../auth/CmPasswordInput';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';

type CmRoleChoice = CmRegisterPayload['role_type'];

interface CmRegisterDraft {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  realName: string;
  roleType: CmRoleChoice;
  registrationCode: string;
}

type CmRegisterField = keyof CmRegisterDraft;
type CmFieldErrors<F extends string> = Partial<Record<F, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 50;
const PASSWORD_MIN = 8;
const REAL_NAME_MAX = 100;
const ROLE_CHOICES: CmRoleChoice[] = ['developer', 'client'];
const EMPTY_REGISTER: CmRegisterDraft = {
  username: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  realName: '',
  roleType: 'developer',
  registrationCode: '',
};
const SERVER_FIELD_MAP: Record<string, CmRegisterField> = {
  username: 'username',
  email: 'email',
  password: 'password',
  real_name: 'realName',
  role_type: 'roleType',
  registration_code: 'registrationCode',
};
const SERVER_FIELD_ERROR_KEYS: Partial<Record<CmRegisterField, string>> = {
  username: 'publicAuth.register.errors.usernameUnavailable',
  email: 'publicAuth.register.errors.emailUnavailable',
  password: 'publicAuth.register.errors.passwordInvalid',
  realName: 'publicAuth.register.errors.realNameRequired',
  roleType: 'publicAuth.register.errors.roleRequired',
  registrationCode: 'errors.invalid_registration_code',
};

/** Field names carrying Laravel validation messages (`data` or `errors`). */
function serverFieldNames(response: APIResponse<unknown>): string[] {
  const body = response.debugInfo;
  const candidates = [body?.errors, body?.data];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return Object.keys(candidate as Record<string, unknown>);
    }
  }
  return [];
}

function validateRegister(draft: CmRegisterDraft): CmFieldErrors<CmRegisterField> {
  const errors: CmFieldErrors<CmRegisterField> = {};
  const username = draft.username.trim();
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) errors.username = 'publicAuth.register.errors.usernameLength';
  if (!EMAIL_PATTERN.test(draft.email.trim())) errors.email = 'publicAuth.errors.emailInvalid';
  if (draft.password.length < PASSWORD_MIN) errors.password = 'publicAuth.errors.passwordLength';
  if (draft.passwordConfirmation !== draft.password) errors.passwordConfirmation = 'publicAuth.errors.passwordMismatch';
  const realName = draft.realName.trim();
  if (!realName) errors.realName = 'publicAuth.register.errors.realNameRequired';
  else if (realName.length > REAL_NAME_MAX) errors.realName = 'publicAuth.register.errors.realNameTooLong';
  if (!ROLE_CHOICES.includes(draft.roleType)) errors.roleType = 'publicAuth.register.errors.roleRequired';
  return errors;
}

const CmFieldError: React.FC<{ id: string; messageKey?: string }> = ({ id, messageKey }) => {
  const { t } = useTranslation('cm');
  return messageKey ? <small className="cm-public-form__error" id={id}>{t(messageKey)}</small> : null;
};

const CmSignInLink: React.FC<{ labelKey?: string }> = ({ labelKey = 'nav.login' }) => {
  const { t } = useTranslation('cm');
  return (
    <Link className="cm-public-form__link" to={CM_PUBLIC_ROUTE.login}>
      <LogIn aria-hidden="true" /> {t(labelKey)}
    </Link>
  );
};

const CmAuthFooterLinks: React.FC<{ showRegister?: boolean; showForgot?: boolean }> = ({ showRegister = false, showForgot = false }) => {
  const { t } = useTranslation('cm');
  return (
    <div className="cm-public-form__links is-wide">
      <CmSignInLink labelKey="publicAuth.haveAccount" />
      {showForgot && <Link className="cm-public-form__link" to={CM_PUBLIC_ROUTE.forgotPassword}>{t('publicAuth.forgot.link')}</Link>}
      {showRegister && <Link className="cm-public-form__link" to={CM_PUBLIC_ROUTE.register}>{t('publicAuth.noAccount')}</Link>}
    </div>
  );
};

export const CmRegisterPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const authenticated = useAuthSession();
  const [draft, setDraft] = useState<CmRegisterDraft>(EMPTY_REGISTER);
  const [fieldErrors, setFieldErrors] = useState<CmFieldErrors<CmRegisterField>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredWithoutSession, setRegisteredWithoutSession] = useState(false);

  const update = (field: CmRegisterField) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const value = event.target.value;
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors = validateRegister(draft);
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    setPending(true);
    const registrationCode = draft.registrationCode.trim();
    const response = await cmApi.register({
      username: draft.username.trim(),
      email: draft.email.trim(),
      password: draft.password,
      password_confirmation: draft.passwordConfirmation,
      real_name: draft.realName.trim(),
      role_type: draft.roleType,
      ...(registrationCode ? { registration_code: registrationCode } : {}),
    });
    setPending(false);
    if (response.success && response.data) {
      if (!response.data.token) {
        setRegisteredWithoutSession(true);
        return;
      }
      notifyAuthLoginSuccess(response.data, null);
      navigate(response.data.is_admin ? CM_PROTECTED_ROUTE.dashboard : CM_PROTECTED_ROUTE.verification);
      return;
    }
    if (cmErrorCode(response) === 'invalid_registration_code') {
      setFieldErrors({ registrationCode: 'errors.invalid_registration_code' });
      return;
    }
    const serverErrors: CmFieldErrors<CmRegisterField> = {};
    serverFieldNames(response).forEach((name) => {
      const field = SERVER_FIELD_MAP[name];
      if (field) serverErrors[field] = SERVER_FIELD_ERROR_KEYS[field];
    });
    setFieldErrors(serverErrors);
    setError(cmErrorMessage(t, response, 'publicAuth.register.failed'));
  };

  const inputProps = (field: CmRegisterField) => ({
    value: draft[field],
    onChange: update(field),
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': `cm-register-${field}-error`,
  });

  return (
    <CmAuthLayout titleKey="publicAuth.register.title" leadKey="publicAuth.register.lead" icon={<UserPlus aria-hidden="true" />} wide>
      <div className="cm-auth-shell__body">
        {authenticated && !pending ? (
          <div className="cm-public-form__notice is-success" role="status">
            <span>{t('publicAuth.register.alreadySignedIn')}</span>
            <Link className="cm-public-form__link" to={CM_PROTECTED_ROUTE.dashboard}>{t('nav.dashboard')}</Link>
          </div>
        ) : registeredWithoutSession ? (
          <div className="cm-public-form__notice is-success" role="status">
            <span>{t('publicAuth.register.successSignIn')}</span>
            <CmSignInLink />
          </div>
        ) : (
          <form className="cm-public-form cm-public-form--two-column" onSubmit={(event) => void submit(event)} noValidate>
            <fieldset className="cm-public-form__roles is-wide">
              <legend>{t('publicAuth.register.role')}</legend>
              {ROLE_CHOICES.map((role) => (
                <label key={role} className={draft.roleType === role ? 'is-selected' : ''}>
                  <input type="radio" name="role_type" value={role} checked={draft.roleType === role} onChange={update('roleType')} />
                  <strong>{t(`publicAuth.register.roles.${role}.title`)}</strong>
                  <small>{t(`publicAuth.register.roles.${role}.body`)}</small>
                </label>
              ))}
              <CmFieldError id="cm-register-roleType-error" messageKey={fieldErrors.roleType} />
            </fieldset>
            <label>
              <span>{t('publicAuth.register.username')}</span>
              <input {...inputProps('username')} autoComplete="username" maxLength={USERNAME_MAX} />
              <CmFieldError id="cm-register-username-error" messageKey={fieldErrors.username} />
            </label>
            <label>
              <span>{t('publicAuth.email')}</span>
              <input {...inputProps('email')} type="email" autoComplete="email" />
              <CmFieldError id="cm-register-email-error" messageKey={fieldErrors.email} />
            </label>
            <label>
              <span>{t('publicAuth.password')}</span>
              <CmPasswordInput {...inputProps('password')} autoComplete="new-password" />
              <CmFieldError id="cm-register-password-error" messageKey={fieldErrors.password} />
            </label>
            <label>
              <span>{t('publicAuth.passwordConfirmation')}</span>
              <CmPasswordInput {...inputProps('passwordConfirmation')} autoComplete="new-password" />
              <CmFieldError id="cm-register-passwordConfirmation-error" messageKey={fieldErrors.passwordConfirmation} />
            </label>
            <label>
              <span>{t('publicAuth.register.realName')}</span>
              <input {...inputProps('realName')} autoComplete="name" maxLength={REAL_NAME_MAX} />
              <CmFieldError id="cm-register-realName-error" messageKey={fieldErrors.realName} />
            </label>
            <label>
              <span>{t('publicAuth.register.registrationCode')}</span>
              <input {...inputProps('registrationCode')} autoComplete="off" />
              <small className="cm-public-form__hint">{t('publicAuth.register.registrationCodeHint')}</small>
              <CmFieldError id="cm-register-registrationCode-error" messageKey={fieldErrors.registrationCode} />
            </label>
            {error && <p className="cm-public-form__notice is-error is-wide" role="alert">{error}</p>}
            <p className="cm-public-form__hint is-wide">
              {t('publicAuth.register.termsNotice')}{' '}
              <Link to={CM_PUBLIC_ROUTE.terms}>{t('publicHome.footer.terms')}</Link>
              {' · '}
              <Link to={CM_PUBLIC_ROUTE.privacy}>{t('publicHome.footer.privacy')}</Link>
            </p>
            <button type="submit" className="cm-public-button cm-public-button--primary cm-public-form__submit" disabled={pending}>
              <UserPlus aria-hidden="true" /> {pending ? t('publicAuth.register.submitting') : t('publicAuth.register.submit')}
            </button>
            <CmAuthFooterLinks showForgot />
          </form>
        )}
      </div>
    </CmAuthLayout>
  );
};

export const CmForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
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
    if (response.status === 429) setError(t('publicAuth.errors.throttled'));
    else if (serverFieldNames(response).includes('email')) setFieldError('publicAuth.forgot.emailRejected');
    else setError(cmErrorMessage(t, response, 'publicAuth.forgot.failed'));
  };

  return (
    <CmAuthLayout titleKey="publicAuth.forgot.title" leadKey="publicAuth.forgot.lead" icon={<Mail aria-hidden="true" />}>
      <div className="cm-auth-shell__body">
        {sent ? (
          <div className="cm-public-form__notice is-success" role="status">
            <span>{t('publicAuth.forgot.sent', { email: email.trim() })}</span>
            <button type="button" className="cm-public-form__link" onClick={() => setSent(false)}>{t('publicAuth.forgot.resend')}</button>
          </div>
        ) : (
          <form className="cm-public-form" onSubmit={(event) => void submit(event)} noValidate>
            <label>
              <span>{t('publicAuth.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldError(undefined);
                }}
                autoComplete="email"
                aria-invalid={Boolean(fieldError)}
                aria-describedby="cm-forgot-email-error"
              />
              <CmFieldError id="cm-forgot-email-error" messageKey={fieldError} />
            </label>
            {error && <p className="cm-public-form__notice is-error" role="alert">{error}</p>}
            <button type="submit" className="cm-public-button cm-public-button--primary cm-public-form__submit" disabled={pending}>
              <Mail aria-hidden="true" /> {pending ? t('publicAuth.forgot.submitting') : t('publicAuth.forgot.submit')}
            </button>
          </form>
        )}
        <CmAuthFooterLinks showRegister />
      </div>
    </CmAuthLayout>
  );
};

type CmResetField = 'email' | 'password' | 'passwordConfirmation';

export const CmPasswordResetPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { token = '' } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CmFieldErrors<CmResetField>>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: CmFieldErrors<CmResetField> = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'publicAuth.errors.emailInvalid';
    if (password.length < PASSWORD_MIN) errors.password = 'publicAuth.errors.passwordLength';
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
    const fields = serverFieldNames(response);
    if (response.status === 429) setError(t('publicAuth.errors.throttled'));
    else if (fields.includes('password')) setFieldErrors({ password: 'publicAuth.reset.passwordRejected' });
    else if (fields.includes('email') || fields.includes('token')) setError(t('publicAuth.reset.invalidLink'));
    else setError(cmErrorMessage(t, response, 'publicAuth.reset.failed'));
  };

  return (
    <CmAuthLayout titleKey="publicAuth.reset.title" leadKey="publicAuth.reset.lead" icon={<KeyRound aria-hidden="true" />}>
      <div className="cm-auth-shell__body">
        {!token ? (
          <div className="cm-public-form__notice is-error" role="alert">
            <span>{t('publicAuth.reset.invalidLink')}</span>
            <Link className="cm-public-form__link" to={CM_PUBLIC_ROUTE.forgotPassword}>{t('publicAuth.reset.requestNew')}</Link>
          </div>
        ) : done ? (
          <div className="cm-public-form__notice is-success" role="status">
            <span>{t('publicAuth.reset.success')}</span>
            <CmSignInLink />
          </div>
        ) : (
          <form className="cm-public-form" onSubmit={(event) => void submit(event)} noValidate>
            <label>
              <span>{t('publicAuth.email')}</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby="cm-reset-email-error" />
              <CmFieldError id="cm-reset-email-error" messageKey={fieldErrors.email} />
            </label>
            <label>
              <span>{t('publicAuth.reset.newPassword')}</span>
              <CmPasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby="cm-reset-password-error" />
              <CmFieldError id="cm-reset-password-error" messageKey={fieldErrors.password} />
            </label>
            <label>
              <span>{t('publicAuth.passwordConfirmation')}</span>
              <CmPasswordInput value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.passwordConfirmation)} aria-describedby="cm-reset-passwordConfirmation-error" />
              <CmFieldError id="cm-reset-passwordConfirmation-error" messageKey={fieldErrors.passwordConfirmation} />
            </label>
            {error && (
              <div className="cm-public-form__notice is-error" role="alert">
                <span>{error}</span>
                <Link className="cm-public-form__link" to={CM_PUBLIC_ROUTE.forgotPassword}>{t('publicAuth.reset.requestNew')}</Link>
              </div>
            )}
            <button type="submit" className="cm-public-button cm-public-button--primary cm-public-form__submit" disabled={pending}>
              <KeyRound aria-hidden="true" /> {pending ? t('publicAuth.reset.submitting') : t('publicAuth.reset.submit')}
            </button>
          </form>
        )}
      </div>
    </CmAuthLayout>
  );
};
