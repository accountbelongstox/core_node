import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import {
  CM_REAL_NAME_MAX,
  CM_ROLE_CHOICES,
  CM_USERNAME_MAX,
  useCmRegister,
  type CmRegisterField,
} from '../../../shared/useCmRegister';
import { MobileButton, MobileField, MobileNotice, MobilePasswordInput, MobileScreen } from '../../ui';
import { MobileFormLinks, MobilePageHead } from './MobilePublicParts';

/** Mobile registration: role cards, account fields and the optional registration code, with server validation mapped to fields. */
const MobileRegisterScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const register = useCmRegister();
  const { draft, fieldErrors, pending, error, authenticated, registeredWithoutSession, passwordMin } = register;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void register.submit();
  };
  const errorText = (field: CmRegisterField): string | undefined => {
    const key = fieldErrors[field];
    return key ? t(key, { min: passwordMin }) : undefined;
  };
  const bind = (field: CmRegisterField) => ({
    value: draft[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => register.update(field, event.target.value),
    'aria-invalid': Boolean(fieldErrors[field]),
  });

  return (
    <MobileScreen>
      <MobilePageHead
        titleKey="publicAuth.register.title"
        leadKey="publicAuth.register.lead"
        title={t('publicAuth.register.title')}
        lead={t('publicAuth.register.lead')}
        icon={<UserPlus aria-hidden="true" />}
      />
      {authenticated && !pending ? (
        <MobileNotice tone="success" action={<Link className="cmm-link-btn" to={CM_PROTECTED_ROUTE.dashboard}>{t('nav.dashboard')}</Link>}>
          {t('publicAuth.register.alreadySignedIn')}
        </MobileNotice>
      ) : registeredWithoutSession ? (
        <MobileNotice tone="success" action={<Link className="cmm-link-btn" to={CM_PUBLIC_ROUTE.login}>{t('nav.login')}</Link>}>
          {t('publicAuth.register.successSignIn')}
        </MobileNotice>
      ) : (
        <form className="cmm-a-form" onSubmit={submit} noValidate>
          <fieldset className="cmm-a-roles">
            <legend>{t('publicAuth.register.role')}</legend>
            {CM_ROLE_CHOICES.map((role) => (
              <label key={role} className={draft.roleType === role ? 'is-selected' : ''}>
                <input type="radio" name="role_type" value={role} checked={draft.roleType === role} onChange={() => register.update('roleType', role)} />
                <strong>{t(`publicAuth.register.roles.${role}.title`)}</strong>
                <small>{t(`publicAuth.register.roles.${role}.body`)}</small>
              </label>
            ))}
            {fieldErrors.roleType && <small className="cmm-field__error" role="alert">{errorText('roleType')}</small>}
          </fieldset>
          <MobileField label={t('publicAuth.register.username')} error={errorText('username')}>
            <input className="cmm-input" {...bind('username')} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={CM_USERNAME_MAX} />
          </MobileField>
          <MobileField label={t('publicAuth.register.realName')} error={errorText('realName')}>
            <input className="cmm-input" {...bind('realName')} autoComplete="name" maxLength={CM_REAL_NAME_MAX} />
          </MobileField>
          <MobileField label={t('publicAuth.email')} error={errorText('email')}>
            <input className="cmm-input" {...bind('email')} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />
          </MobileField>
          <MobileField label={t('publicAuth.password')} error={errorText('password')}>
            <MobilePasswordInput {...bind('password')} autoComplete="new-password" />
          </MobileField>
          <MobileField label={t('publicAuth.passwordConfirmation')} error={errorText('passwordConfirmation')}>
            <MobilePasswordInput {...bind('passwordConfirmation')} autoComplete="new-password" />
          </MobileField>
          <details className="cmm-a-optional" open={Boolean(draft.registrationCode || fieldErrors.registrationCode)}>
            <summary>{t('publicAuth.register.registrationCode')}</summary>
            <MobileField label={t('publicAuth.register.registrationCode')} hint={t('publicAuth.register.registrationCodeHint')} error={errorText('registrationCode')}>
              <input className="cmm-input" {...bind('registrationCode')} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </MobileField>
          </details>
          {error && <MobileNotice tone="error">{error}</MobileNotice>}
          <p className="cmm-a-fine">
            {t('publicAuth.register.termsNotice')}{' '}
            <Link to={CM_PUBLIC_ROUTE.terms}>{t('publicHome.footer.terms')}</Link>
            {' · '}
            <Link to={CM_PUBLIC_ROUTE.privacy}>{t('publicHome.footer.privacy')}</Link>
          </p>
          <MobileButton type="submit" variant="primary" block loading={pending} icon={<UserPlus aria-hidden="true" />}>
            {pending ? t('publicAuth.register.submitting') : t('publicAuth.register.submit')}
          </MobileButton>
        </form>
      )}
      <MobileFormLinks links={[
        { to: CM_PUBLIC_ROUTE.login, label: t('publicAuth.haveAccount') },
      ]}
      />
    </MobileScreen>
  );
};

export default MobileRegisterScreen;
