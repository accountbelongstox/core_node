import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { KeyRound, LogIn, Mail, UserPlus } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmAuthLayout } from '../auth/CmAuthLayout';
import { CmPasswordInput } from '../auth/CmPasswordInput';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';
import { useCmPasswordMinLength } from '../contexts/useCmPolicy';
import { useCmForgotPassword, useCmPasswordReset } from '../shared/useCmPasswordRecovery';
import {
  CM_REAL_NAME_MAX,
  CM_ROLE_CHOICES,
  CM_USERNAME_MAX,
  useCmRegister,
  type CmRegisterField,
} from '../shared/useCmRegister';

const CmFieldError: React.FC<{ id: string; messageKey?: string }> = ({ id, messageKey }) => {
  const { t } = useTranslation('cm');
  const passwordMin = useCmPasswordMinLength();
  return messageKey ? <small className="cm-public-form__error" id={id}>{t(messageKey, { min: passwordMin })}</small> : null;
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
  const register = useCmRegister();
  const { draft, fieldErrors, pending, error, authenticated, registeredWithoutSession } = register;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void register.submit();
  };

  const inputProps = (field: CmRegisterField) => ({
    value: draft[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => register.update(field, event.target.value),
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
          <form className="cm-public-form cm-public-form--two-column" onSubmit={submit} noValidate>
            <fieldset className="cm-public-form__roles is-wide">
              <legend>{t('publicAuth.register.role')}</legend>
              {CM_ROLE_CHOICES.map((role) => (
                <label key={role} className={draft.roleType === role ? 'is-selected' : ''}>
                  <input type="radio" name="role_type" value={role} checked={draft.roleType === role} onChange={() => register.update('roleType', role)} />
                  <strong>{t(`publicAuth.register.roles.${role}.title`)}</strong>
                  <small>{t(`publicAuth.register.roles.${role}.body`)}</small>
                </label>
              ))}
              <CmFieldError id="cm-register-roleType-error" messageKey={fieldErrors.roleType} />
            </fieldset>
            <label>
              <span>{t('publicAuth.register.username')}</span>
              <input {...inputProps('username')} autoComplete="username" maxLength={CM_USERNAME_MAX} />
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
              <input {...inputProps('realName')} autoComplete="name" maxLength={CM_REAL_NAME_MAX} />
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
  const forgot = useCmForgotPassword();
  const { email, fieldError, pending, sent, error } = forgot;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void forgot.submit();
  };

  return (
    <CmAuthLayout titleKey="publicAuth.forgot.title" leadKey="publicAuth.forgot.lead" icon={<Mail aria-hidden="true" />}>
      <div className="cm-auth-shell__body">
        {sent ? (
          <div className="cm-public-form__notice is-success" role="status">
            <span>{t('publicAuth.forgot.sent', { email: email.trim() })}</span>
            <button type="button" className="cm-public-form__link" onClick={forgot.resend}>{t('publicAuth.forgot.resend')}</button>
          </div>
        ) : (
          <form className="cm-public-form" onSubmit={submit} noValidate>
            <label>
              <span>{t('publicAuth.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => forgot.setEmail(event.target.value)}
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

export const CmPasswordResetPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { token = '' } = useParams<{ token: string }>();
  const reset = useCmPasswordReset(token);
  const { email, password, passwordConfirmation, fieldErrors, pending, done, error } = reset;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void reset.submit();
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
          <form className="cm-public-form" onSubmit={submit} noValidate>
            <label>
              <span>{t('publicAuth.email')}</span>
              <input type="email" value={email} onChange={(event) => reset.setEmail(event.target.value)} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby="cm-reset-email-error" />
              <CmFieldError id="cm-reset-email-error" messageKey={fieldErrors.email} />
            </label>
            <label>
              <span>{t('publicAuth.reset.newPassword')}</span>
              <CmPasswordInput value={password} onChange={(event) => reset.setPassword(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby="cm-reset-password-error" />
              <CmFieldError id="cm-reset-password-error" messageKey={fieldErrors.password} />
            </label>
            <label>
              <span>{t('publicAuth.passwordConfirmation')}</span>
              <CmPasswordInput value={passwordConfirmation} onChange={(event) => reset.setPasswordConfirmation(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.passwordConfirmation)} aria-describedby="cm-reset-passwordConfirmation-error" />
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
