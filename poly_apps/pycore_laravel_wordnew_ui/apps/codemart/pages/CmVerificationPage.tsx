import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, IdCard, Lock, Mail, MessageSquareQuote, Phone, ShieldCheck, UserPlus } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProject, CmRegistrationStatus } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';

const TESTIMONIAL_LOCALES = ['en', 'zh'] as const;
const TESTIMONIAL_MIN_LENGTH = 10;
const TESTIMONIAL_PROJECT_STATUSES = new Set(['completed', 'archived']);
const PHONE_PATTERN = /^\+?\d{10,15}$/;
const OTP_PATTERN = /^\d{6}$/;
const DEFAULT_OTP_SECONDS = 600;
const KYC_OPEN_STATUSES = new Set(['not_started', 'rejected']);
const ID_CARD = 'ID_CARD';
const IDENTITY_TYPES = [
  { value: 'ID_CARD', labelKey: 'verification.typeIdCard' },
  { value: 'PASSPORT', labelKey: 'verification.typePassport' },
  { value: 'DRIVING_LICENSE', labelKey: 'verification.typeDrivingLicense' },
] as const;
const DEFAULT_CURRENCY = 'CNY';

const CmEmailVerification: React.FC<{ email: string | null; onVerified: (message: string) => Promise<void> }> = ({ email, onVerified }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [address, setAddress] = useState(email ?? '');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || !address.trim() || !token.trim()) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.verifyEmail(address.trim(), token.trim());
    setBusy(false);
    if (response.success) {
      setToken('');
      await onVerified(t('verification.emailVerified'));
    } else {
      notice.error(cmErrorMessage(t, response, 'verification.emailFailed'));
    }
  };

  return (
    <section className="cm-section-card">
      <h2><Mail aria-hidden="true" /> {t('verification.emailTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.emailDescription')}</p>
      <form className="cm-project-form" onSubmit={(event) => void verify(event)} noValidate>
        <label>
          <span>{t('verification.emailLabel')}</span>
          <input type="email" autoComplete="email" value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label>
          <span>{t('verification.emailToken')}</span>
          <input value={token} autoComplete="one-time-code" onChange={(event) => setToken(event.target.value)} />
        </label>
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={busy || !address.trim() || !token.trim()}>{busy ? t('verification.verifying') : t('verification.verifyEmail')}</button>
        </div>
      </form>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

const CmPhoneVerification: React.FC<{ onVerified: (message: string) => Promise<void> }> = ({ onVerified }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const phoneValid = PHONE_PATTERN.test(phone.trim().replace(/[\s-]/g, ''));
  const otpValid = OTP_PATTERN.test(otpCode.trim());

  const sendCode = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || !phoneValid) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.requestPhoneVerification(phone.trim().replace(/[\s-]/g, ''));
    setBusy(false);
    if (response.success && response.data) {
      const seconds = typeof response.data.expires_in_seconds === 'number' ? response.data.expires_in_seconds : DEFAULT_OTP_SECONDS;
      setCodeSent(true);
      notice.success(t('verification.codeSent', { minutes: Math.max(1, Math.round(seconds / 60)) }));
    } else {
      notice.error(cmErrorMessage(t, response, 'verification.phoneFailed'));
    }
  };

  const verifyCode = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || !otpValid) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.verifyPhoneOtp(otpCode.trim());
    setBusy(false);
    if (response.success) {
      setOtpCode('');
      setCodeSent(false);
      await onVerified(t('verification.phoneVerified'));
    } else {
      notice.error(cmErrorMessage(t, response, 'verification.phoneFailed'));
    }
  };

  return (
    <section className="cm-section-card">
      <h2><Phone aria-hidden="true" /> {t('verification.phoneTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.phoneDescription')}</p>
      <form className="cm-project-form" onSubmit={(event) => void sendCode(event)} noValidate>
        <label>
          <span>{t('verification.phoneLabel')}</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t('verification.phonePlaceholder')} inputMode="tel" autoComplete="tel" aria-invalid={phone !== '' && !phoneValid} />
          {phone !== '' && !phoneValid && <small className="cm-field-error">{t('verification.phoneInvalid')}</small>}
        </label>
        <div className="cm-project-form__actions is-inline">
          <button type="submit" className={codeSent ? '' : 'is-primary'} disabled={busy || !phoneValid}>
            {busy && !codeSent ? t('verification.sendingCode') : codeSent ? t('verification.resendCode') : t('verification.sendCode')}
          </button>
        </div>
      </form>
      {codeSent && (
        <form className="cm-project-form cm-project-form--follow" onSubmit={(event) => void verifyCode(event)} noValidate>
          <label>
            <span>{t('verification.otpLabel')}</span>
            <input value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))} placeholder={t('verification.otpPlaceholder')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
          </label>
          <div className="cm-project-form__actions is-inline">
            <button type="submit" className="is-primary" disabled={busy || !otpValid}>
              {busy ? t('verification.verifying') : t('verification.verifyCode')}
            </button>
          </div>
        </form>
      )}
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

const CmKycForm: React.FC<{ rejected: boolean; onSubmitted: (message: string) => Promise<void> }> = ({ rejected, onSubmitted }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [identityType, setIdentityType] = useState<string>(ID_CARD);
  const [identityNumber, setIdentityNumber] = useState('');
  const [realName, setRealName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const needsBack = identityType === ID_CARD;
  const missing = {
    identityNumber: !identityNumber.trim(),
    realName: !realName.trim(),
    dateOfBirth: !dateOfBirth,
    idFront: !idFrontFile,
    idBack: needsBack && !idBackFile,
    selfie: !selfieFile,
  };
  const invalid = Object.values(missing).some(Boolean);
  const show = (field: keyof typeof missing): boolean => submitted && missing[field];

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (progress !== null || invalid || !idFrontFile || !selfieFile) return;
    notice.clear();
    const formData = new FormData();
    formData.append('identity_type', identityType);
    formData.append('identity_number', identityNumber.trim());
    formData.append('real_name', realName.trim());
    formData.append('date_of_birth', dateOfBirth);
    formData.append('id_front_image', idFrontFile);
    if (needsBack && idBackFile) formData.append('id_back_image', idBackFile);
    formData.append('selfie_image', selfieFile);
    setProgress(0);
    const response = await cmApi.uploadKycDocuments(formData, (percentage) => setProgress(percentage));
    setProgress(null);
    if (response.success) {
      await onSubmitted(t('verification.kycSubmitted'));
    } else {
      notice.error(cmErrorMessage(t, response, 'verification.kycFailed'));
    }
  };

  const fileInput = (field: 'idFront' | 'idBack' | 'selfie', labelKey: string, setter: (file: File | null) => void): React.ReactElement => (
    <label>
      <span>{t(labelKey)}</span>
      <input type="file" accept="image/*" onChange={(event) => setter(event.target.files?.[0] ?? null)} aria-invalid={show(field)} />
      {show(field) && <small className="cm-field-error">{t('verification.fileRequired')}</small>}
    </label>
  );

  return (
    <section className="cm-section-card">
      <h2><IdCard aria-hidden="true" /> {t('verification.kycTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.kycDescription')}</p>
      {rejected && <CmNotice notice={{ tone: 'error', text: t('verification.kycRejectedNote') }} />}
      <form className="cm-project-form" onSubmit={(event) => void submit(event)} noValidate>
        <label>
          <span>{t('verification.identityType')}</span>
          <select value={identityType} onChange={(event) => setIdentityType(event.target.value)}>
            {IDENTITY_TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.labelKey)}</option>)}
          </select>
        </label>
        <label>
          <span>{t('verification.identityNumber')}</span>
          <input value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value)} aria-invalid={show('identityNumber')} />
          {show('identityNumber') && <small className="cm-field-error">{t('verification.fieldRequired')}</small>}
        </label>
        <label>
          <span>{t('verification.realName')}</span>
          <input value={realName} autoComplete="name" onChange={(event) => setRealName(event.target.value)} aria-invalid={show('realName')} />
          {show('realName') && <small className="cm-field-error">{t('verification.fieldRequired')}</small>}
        </label>
        <label>
          <span>{t('verification.dateOfBirth')}</span>
          <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} aria-invalid={show('dateOfBirth')} />
          {show('dateOfBirth') && <small className="cm-field-error">{t('verification.fieldRequired')}</small>}
        </label>
        {fileInput('idFront', 'verification.idFront', setIdFrontFile)}
        {needsBack && fileInput('idBack', 'verification.idBack', setIdBackFile)}
        {fileInput('selfie', 'verification.selfie', setSelfieFile)}
        <p className="cm-field-hint is-wide">{t('verification.kycPrivacy')}</p>
        {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={progress !== null}>
            {progress !== null ? t('verification.uploadingKyc', { progress }) : t('verification.submitKyc')}
          </button>
        </div>
      </form>
    </section>
  );
};

const CmRoleRequest: React.FC<{ roles: string[]; onRequested: (message: string, depositNeeded: boolean) => Promise<void> }> = ({ roles, onRequested }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap } = useCmBootstrap();
  const notice = useCmNotice();
  const [busyRole, setBusyRole] = useState<string | null>(null);

  const request = async (roleType: string): Promise<void> => {
    setBusyRole(roleType);
    notice.clear();
    const response = await cmApi.requestRole(roleType);
    setBusyRole(null);
    if (response.success && response.data) {
      const roleLabel = t(`roles.${response.data.role_type}`, { defaultValue: response.data.role_type });
      const depositNeeded = response.data.next_step === 'deposit';
      await onRequested(depositNeeded
        ? t('verification.roleRequestedDeposit', { role: roleLabel, amount: format.money(response.data.deposit_amount ?? 0, bootstrap?.vocabulary.policy.currency ?? DEFAULT_CURRENCY) })
        : t('verification.roleRequested', { role: roleLabel, status: t(`states.role.${response.data.role_status}`, { defaultValue: response.data.role_status }) }), depositNeeded);
    } else {
      notice.error(cmErrorMessage(t, response, 'verification.roleRequestFailed'));
    }
  };

  return (
    <section className="cm-section-card">
      <h2><UserPlus aria-hidden="true" /> {t('verification.roleRequestTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.roleRequestDescription')}</p>
      <div className="cm-role-options">
        {roles.map((roleType) => (
          <article key={roleType} className="cm-role-option">
            <strong>{t(`roles.${roleType}`, { defaultValue: roleType })}</strong>
            <p>{t(`verification.roleBenefits.${roleType}`, { defaultValue: '' })}</p>
            <button type="button" className="cm-workspace-button is-primary" disabled={busyRole !== null} onClick={() => void request(roleType)}>
              {busyRole === roleType ? t('common.saving') : t('verification.requestRole', { role: t(`roles.${roleType}`, { defaultValue: roleType }) })}
            </button>
          </article>
        ))}
      </div>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

const CmTestimonialForm: React.FC = () => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const [quotes, setQuotes] = useState<Record<string, string>>({ en: '', zh: '' });
  const [projects, setProjects] = useState<CmProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [authorLabel, setAuthorLabel] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void cmApi.getProjects({ include_assigned: true }).then((response) => {
      if (!cancelled && response.success && response.data) {
        setProjects((response.data.projects ?? []).filter((project) => TESTIMONIAL_PROJECT_STATUSES.has(project.status)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filled: Record<string, string> = Object.fromEntries(
    Object.entries(quotes).map(([locale, text]) => [locale, text.trim()] as [string, string]).filter(([, text]) => text !== ''),
  );
  const tooShort = Object.values(filled).some((text) => text.length < TESTIMONIAL_MIN_LENGTH);
  const valid = Object.keys(filled).length > 0 && !tooShort;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    notice.clear();
    const response = await cmApi.submitTestimonial({
      quotes: filled,
      project_id: projectId ? Number(projectId) : undefined,
      author_label: authorLabel.trim() || undefined,
      role_label: roleLabel.trim() || undefined,
    });
    setBusy(false);
    if (response.success) {
      setQuotes({ en: '', zh: '' });
      notice.success(t('verification.testimonialSubmitted'));
    } else {
      notice.error(cmErrorMessage(t, response, 'verification.testimonialFailed'));
    }
  };

  return (
    <section className="cm-section-card">
      <h2><MessageSquareQuote aria-hidden="true" /> {t('verification.testimonialTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.testimonialDescription')}</p>
      <form className="cm-project-form" onSubmit={(event) => void submit(event)} noValidate>
        {TESTIMONIAL_LOCALES.map((locale) => {
          const text = (quotes[locale] ?? '').trim();
          return (
            <label key={locale} className="is-wide">
              <span>{t(`verification.testimonialQuote.${locale}`)}</span>
              <textarea
                rows={3}
                maxLength={1000}
                value={quotes[locale] ?? ''}
                onChange={(event) => setQuotes((current) => ({ ...current, [locale]: event.target.value }))}
                placeholder={t('verification.testimonialPlaceholder')}
                aria-invalid={text !== '' && text.length < TESTIMONIAL_MIN_LENGTH}
              />
              {text !== '' && text.length < TESTIMONIAL_MIN_LENGTH && <small className="cm-field-error">{t('verification.testimonialTooShort', { min: TESTIMONIAL_MIN_LENGTH })}</small>}
            </label>
          );
        })}
        <p className="cm-field-hint is-wide">{t('verification.testimonialOneLanguage')}</p>
        <label>
          <span>{t('verification.testimonialProject')}</span>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">{t('verification.testimonialNoProject')}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.title}</option>
            ))}
          </select>
        </label>
        <span className="cm-project-form__spacer" aria-hidden="true" />
        <label>
          <span>{t('verification.testimonialAuthor')}</span>
          <input value={authorLabel} onChange={(event) => setAuthorLabel(event.target.value)} maxLength={100} />
        </label>
        <label>
          <span>{t('verification.testimonialRole')}</span>
          <input value={roleLabel} onChange={(event) => setRoleLabel(event.target.value)} maxLength={100} />
        </label>
        {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={busy || !valid}>{busy ? t('common.saving') : t('verification.testimonialSubmit')}</button>
        </div>
      </form>
    </section>
  );
};

/**
 * Verification page: renders the server-owned onboarding state from
 * GET /bootstrap and provides the email, phone, KYC, role and testimonial flows.
 */
export const CmVerificationPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, loading, error, refresh, hasCapability } = useCmBootstrap();
  const [registration, setRegistration] = useState<CmRegistrationStatus | null>(null);

  const loadRegistration = useCallback(async (): Promise<void> => {
    const response = await cmApi.getRegistrationStatus();
    if (response.success && response.data) setRegistration(response.data);
  }, []);

  useEffect(() => {
    void loadRegistration();
  }, [loadRegistration]);

  const pageNotice = useCmNotice();
  const [showWalletLink, setShowWalletLink] = useState(false);

  const refreshAll = useCallback(async (): Promise<void> => {
    await refresh();
    await loadRegistration();
  }, [refresh, loadRegistration]);

  const completed = useCallback(async (message: string, depositNeeded = false): Promise<void> => {
    pageNotice.success(message);
    setShowWalletLink(depositNeeded);
    await refreshAll();
  }, [pageNotice.success, refreshAll]);

  const header = <CmPageHeader eyebrowKey="verification.eyebrow" titleKey="nav.verification" purposeKey="verification.description" />;

  if (!bootstrap) {
    return (
      <main className="cm-workspace-page">
        {header}
        {loading || !error ? <CmLoadingState /> : <CmErrorState message={t('errors.bootstrapFailed')} onRetry={() => void refresh()} />}
      </main>
    );
  }

  const onboarding = bootstrap.onboarding;
  const phoneVerified = onboarding.phone_verified;
  const kycStatus = onboarding.kyc_status || 'not_started';
  const requestableRoles = onboarding.requestable_roles ?? [];
  const currency = bootstrap.vocabulary.policy.currency ?? DEFAULT_CURRENCY;
  const roles = registration?.roles ?? bootstrap.roles;

  return (
    <main className="cm-workspace-page">
      {header}
      <CmNotice notice={pageNotice.notice} onDismiss={pageNotice.clear} />
      {showWalletLink && <p className="cm-inline-action"><Link to="/codemart/wallet" className="cm-workspace-button is-primary">{t('verification.openWalletDeposit')}</Link></p>}
      <div className="cm-verification-layout">
        <aside className="cm-section-card cm-verification-summary">
          <h2><ShieldCheck aria-hidden="true" /> {t('verification.stepsTitle')}</h2>
          <ol className="cm-steps-list">
            {onboarding.steps.map((step) => (
              <li key={step.key} data-completed={step.completed} data-blocked={step.blocked} data-current={onboarding.next_step === step.key}>
                {step.completed ? <CheckCircle2 aria-hidden="true" /> : step.blocked ? <Lock aria-hidden="true" /> : <Circle aria-hidden="true" />}
                <span>{t(`verification.steps.${step.key}`, { defaultValue: step.key })}</span>
              </li>
            ))}
          </ol>
          <p className="cm-field-hint">
            {onboarding.complete
              ? t('verification.complete')
              : t('verification.nextStep', { step: onboarding.next_step ? t(`verification.steps.${onboarding.next_step}`, { defaultValue: onboarding.next_step }) : t('common.unavailable') })}
          </p>
          <dl className="cm-kv is-single">
            <div><dt>{t('verification.email')}</dt><dd><span className="cm-status" data-status={onboarding.email_verified ? 'completed' : 'pending'}>{onboarding.email_verified ? t('verification.verified') : t('verification.unverified')}</span></dd></div>
            <div><dt>{t('verification.phone')}</dt><dd><span className="cm-status" data-status={phoneVerified ? 'completed' : 'pending'}>{phoneVerified ? t('verification.verified') : t('verification.unverified')}</span></dd></div>
            <div><dt>{t('verification.kyc')}</dt><dd><CmStatusBadge group="kyc" status={kycStatus} /></dd></div>
            {Object.entries(roles).map(([role, status]) => (
              <div key={role}><dt>{t(`roles.${role}`, { defaultValue: role })}</dt><dd><CmStatusBadge group="role" status={status} /></dd></div>
            ))}
          </dl>
        </aside>
        <div className="cm-verification-main">
          {!onboarding.email_verified && <CmEmailVerification email={bootstrap.user.email} onVerified={completed} />}
          {!phoneVerified && <CmPhoneVerification onVerified={completed} />}
          {kycStatus === 'pending' && (
            <section className="cm-section-card">
              <h2><IdCard aria-hidden="true" /> {t('verification.kycTitle')}</h2>
              <CmNotice notice={{ tone: 'info', text: t('verification.kycPendingNote') }} />
            </section>
          )}
          {KYC_OPEN_STATUSES.has(kycStatus) && <CmKycForm rejected={kycStatus === 'rejected'} onSubmitted={completed} />}
          {Object.keys(onboarding.deposit_required).length > 0 && (
            <section className="cm-section-card">
              <h2><ShieldCheck aria-hidden="true" /> {t('verification.depositTitle')}</h2>
              <ul className="cm-requirement-list">
                {Object.entries(onboarding.deposit_required).map(([role, amount]) => (
                  <li key={role}>
                    <Circle aria-hidden="true" />
                    <span>{t(`roles.${role}`, { defaultValue: role })}</span>
                    <strong>{format.money(amount, currency)}</strong>
                  </li>
                ))}
              </ul>
              <div className="cm-section-card__actions">
                <Link to="/codemart/wallet" className="cm-workspace-button is-primary">{t('verification.openWalletDeposit')}</Link>
              </div>
            </section>
          )}
          {hasCapability('role.request') && requestableRoles.length > 0 && <CmRoleRequest roles={requestableRoles} onRequested={completed} />}
          {hasCapability('testimonial.create') && <CmTestimonialForm />}
        </div>
      </div>
    </main>
  );
};

export default CmVerificationPage;
