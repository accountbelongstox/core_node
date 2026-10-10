import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, IdCard, Lock, Mail, MessageSquareQuote, Phone, ShieldCheck, UserPlus } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { useCmPolicy } from '../contexts/useCmPolicy';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { CmErrorState, CmLoadingState, CmNotice, useCmNotice } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import {
  useCmEmailVerification,
  useCmKycForm,
  useCmPhoneVerification,
  useCmRoleRequest,
  useCmTestimonialForm,
  useCmVerification,
  type CmKycFileSlot,
} from '../shared/useCmVerification';

const CmEmailVerification: React.FC<{ email: string | null; onVerified: (message: string) => Promise<void> }> = ({ email, onVerified }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const form = useCmEmailVerification(notice, email, onVerified);

  return (
    <section className="cm-section-card">
      <h2><Mail aria-hidden="true" /> {t('verification.emailTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.emailDescription')}</p>
      <form className="cm-project-form" onSubmit={(event) => { event.preventDefault(); void form.verify(); }} noValidate>
        <label>
          <span>{t('verification.emailLabel')}</span>
          <input type="email" autoComplete="email" value={form.address} onChange={(event) => form.setAddress(event.target.value)} />
        </label>
        <label>
          <span>{t('verification.emailToken')}</span>
          <input value={form.token} autoComplete="one-time-code" onChange={(event) => form.setToken(event.target.value)} />
        </label>
        <div className="cm-project-form__actions">
          <button type="button" disabled={form.resending} onClick={() => void form.resend()}>{form.resending ? t('verification.resendingEmail') : t('verification.resendEmail')}</button>
          <button type="submit" className="is-primary" disabled={!form.canVerify}>{form.busy ? t('verification.verifying') : t('verification.verifyEmail')}</button>
        </div>
      </form>
      <CmNotice notice={notice.notice} onDismiss={notice.clear} />
    </section>
  );
};

const CmPhoneVerification: React.FC<{ onVerified: (message: string) => Promise<void> }> = ({ onVerified }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const form = useCmPhoneVerification(notice, onVerified);

  return (
    <section className="cm-section-card">
      <h2><Phone aria-hidden="true" /> {t('verification.phoneTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.phoneDescription')}</p>
      <form className="cm-project-form" onSubmit={(event) => { event.preventDefault(); void form.sendCode(); }} noValidate>
        <label>
          <span>{t('verification.phoneLabel')}</span>
          <input value={form.phone} onChange={(event) => form.setPhone(event.target.value)} placeholder={t('verification.phonePlaceholder')} inputMode="tel" autoComplete="tel" aria-invalid={form.phone !== '' && !form.phoneValid} />
          {form.phone !== '' && !form.phoneValid && <small className="cm-field-error">{t('verification.phoneInvalid')}</small>}
        </label>
        <div className="cm-project-form__actions is-inline">
          <button type="submit" className={form.codeSent ? '' : 'is-primary'} disabled={form.busy || !form.phoneValid}>
            {form.busy && !form.codeSent ? t('verification.sendingCode') : form.codeSent ? t('verification.resendCode') : t('verification.sendCode')}
          </button>
        </div>
      </form>
      {form.codeSent && (
        <form className="cm-project-form cm-project-form--follow" onSubmit={(event) => { event.preventDefault(); void form.verifyCode(); }} noValidate>
          <label>
            <span>{t('verification.otpLabel')}</span>
            <input value={form.otpCode} onChange={(event) => form.setOtpCode(event.target.value)} placeholder={t('verification.otpPlaceholder')} inputMode="numeric" autoComplete="one-time-code" maxLength={form.otpLength} />
          </label>
          <div className="cm-project-form__actions is-inline">
            <button type="submit" className="is-primary" disabled={form.busy || !form.otpValid}>
              {form.busy ? t('verification.verifying') : t('verification.verifyCode')}
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
  const form = useCmKycForm(notice, onSubmitted);

  const fileInput = (field: CmKycFileSlot, labelKey: string): React.ReactElement => (
    <label>
      <span>{t(labelKey)}</span>
      <input type="file" accept="image/*" onChange={(event) => form.setFile(field, event.target.files?.[0] ?? null)} aria-invalid={form.show(field)} />
      {form.show(field) && <small className="cm-field-error">{t('verification.fileRequired')}</small>}
    </label>
  );

  return (
    <section className="cm-section-card">
      <h2><IdCard aria-hidden="true" /> {t('verification.kycTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.kycDescription')}</p>
      {rejected && <CmNotice notice={{ tone: 'error', text: t('verification.kycRejectedNote') }} />}
      <form className="cm-project-form" onSubmit={(event) => { event.preventDefault(); void form.submit(); }} noValidate>
        <label>
          <span>{t('verification.identityType')}</span>
          <select value={form.identityType} onChange={(event) => form.setIdentityType(event.target.value)}>
            {form.identityTypes.map((type) => <option key={type} value={type}>{t(`verification.identityTypes.${type}`, { defaultValue: type })}</option>)}
          </select>
        </label>
        <label>
          <span>{t('verification.identityNumber')}</span>
          <input value={form.identityNumber} onChange={(event) => form.setIdentityNumber(event.target.value)} aria-invalid={form.show('identityNumber')} />
          {form.show('identityNumber') && <small className="cm-field-error">{t('verification.fieldRequired')}</small>}
        </label>
        <label>
          <span>{t('verification.realName')}</span>
          <input value={form.realName} autoComplete="name" onChange={(event) => form.setRealName(event.target.value)} aria-invalid={form.show('realName')} />
          {form.show('realName') && <small className="cm-field-error">{t('verification.fieldRequired')}</small>}
        </label>
        <label>
          <span>{t('verification.dateOfBirth')}</span>
          <input type="date" value={form.dateOfBirth} onChange={(event) => form.setDateOfBirth(event.target.value)} aria-invalid={form.show('dateOfBirth')} />
          {form.show('dateOfBirth') && <small className="cm-field-error">{t('verification.fieldRequired')}</small>}
        </label>
        {fileInput('idFront', 'verification.idFront')}
        {form.needsBack && fileInput('idBack', 'verification.idBack')}
        {fileInput('selfie', 'verification.selfie')}
        <p className="cm-field-hint is-wide">{t('verification.kycPrivacy')}</p>
        {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={form.progress !== null}>
            {form.progress !== null ? t('verification.uploadingKyc', { progress: form.progress }) : t('verification.submitKyc')}
          </button>
        </div>
      </form>
    </section>
  );
};

const CmRoleRequest: React.FC<{ roles: string[]; onRequested: (message: string, depositNeeded: boolean) => Promise<void> }> = ({ roles, onRequested }) => {
  const { t } = useTranslation('cm');
  const notice = useCmNotice();
  const { busyRole, request } = useCmRoleRequest(notice, onRequested);

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
  const form = useCmTestimonialForm(notice);

  return (
    <section className="cm-section-card">
      <h2><MessageSquareQuote aria-hidden="true" /> {t('verification.testimonialTitle')}</h2>
      <p className="cm-section-card__lead">{t('verification.testimonialDescription')}</p>
      <form className="cm-project-form" onSubmit={(event) => { event.preventDefault(); void form.submit(); }} noValidate>
        {form.locales.map((locale) => (
          <label key={locale} className="is-wide">
            <span>{t(`verification.testimonialQuote.${locale}`, { defaultValue: locale })}</span>
            <textarea
              rows={3}
              maxLength={form.maxQuoteLength}
              value={form.quotes[locale] ?? ''}
              onChange={(event) => form.setQuote(locale, event.target.value)}
              placeholder={t('verification.testimonialPlaceholder')}
              aria-invalid={form.tooShort(locale)}
            />
            {form.tooShort(locale) && <small className="cm-field-error">{t('verification.testimonialTooShort', { min: form.minLength })}</small>}
          </label>
        ))}
        <p className="cm-field-hint is-wide">{t('verification.testimonialOneLanguage')}</p>
        <label>
          <span>{t('verification.testimonialProject')}</span>
          <select value={form.projectId} onChange={(event) => form.setProjectId(event.target.value)}>
            <option value="">{t('verification.testimonialNoProject')}</option>
            {form.projects.map((project) => (
              <option key={project.id} value={project.id}>{project.title}</option>
            ))}
          </select>
        </label>
        <span className="cm-project-form__spacer" aria-hidden="true" />
        <label>
          <span>{t('verification.testimonialAuthor')}</span>
          <input value={form.authorLabel} onChange={(event) => form.setAuthorLabel(event.target.value)} maxLength={form.nameMaxLength} />
        </label>
        <label>
          <span>{t('verification.testimonialRole')}</span>
          <input value={form.roleLabel} onChange={(event) => form.setRoleLabel(event.target.value)} maxLength={form.nameMaxLength} />
        </label>
        {notice.notice && <div className="is-wide"><CmNotice notice={notice.notice} onDismiss={notice.clear} /></div>}
        <div className="cm-project-form__actions">
          <button type="submit" className="is-primary" disabled={form.busy || !form.valid}>{form.busy ? t('common.saving') : t('verification.testimonialSubmit')}</button>
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
  const { currency } = useCmPolicy();
  const pageNotice = useCmNotice();
  const verification = useCmVerification(pageNotice);
  const { bootstrap, loading, error, refresh, roles, phoneVerified, phoneAvailable, kycStatus, kycPending, kycOpen, requestableRoles, completed } = verification;

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

  return (
    <main className="cm-workspace-page">
      {header}
      <CmNotice notice={pageNotice.notice} onDismiss={pageNotice.clear} />
      {verification.showWalletLink && <p className="cm-inline-action"><Link to={CM_PROTECTED_ROUTE.wallet} className="cm-workspace-button is-primary">{t('verification.openWalletDeposit')}</Link></p>}
      <div className="cm-verification-layout">
        <aside className="cm-section-card cm-verification-summary">
          <h2><ShieldCheck aria-hidden="true" /> {t('verification.stepsTitle')}</h2>
          <ol className="cm-steps-list">
            {onboarding.steps.map((step) => (
              <li key={step.key} data-completed={step.completed} data-blocked={step.blocked} data-current={onboarding.next_step === step.key}>
                {step.completed ? <CheckCircle2 aria-hidden="true" /> : step.blocked ? <Lock aria-hidden="true" /> : <Circle aria-hidden="true" />}
                <span>{t(`verification.steps.${step.key}`, { defaultValue: step.key })}</span>
                {step.optional && !step.completed && <small className="cm-step-optional">{t('verification.optionalStep')}</small>}
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
            <div><dt>{t('verification.phone')}</dt><dd><span className="cm-status" data-status={phoneVerified ? 'completed' : phoneAvailable ? 'pending' : 'unavailable'}>{phoneVerified ? t('verification.verified') : phoneAvailable ? t('verification.unverified') : t('verification.notAvailable')}</span></dd></div>
            <div><dt>{t('verification.kyc')}</dt><dd><CmStatusBadge group="kyc" status={kycStatus} /></dd></div>
            {Object.entries(roles).map(([role, status]) => (
              <div key={role}><dt>{t(`roles.${role}`, { defaultValue: role })}</dt><dd><CmStatusBadge group="role" status={status} /></dd></div>
            ))}
          </dl>
        </aside>
        <div className="cm-verification-main">
          {!onboarding.email_verified && <CmEmailVerification email={bootstrap.user.email} onVerified={completed} />}
          {!phoneVerified && phoneAvailable && <CmPhoneVerification onVerified={completed} />}
          {!phoneVerified && !phoneAvailable && (
            <section className="cm-section-card">
              <h2><Phone aria-hidden="true" /> {t('verification.phoneTitle')}</h2>
              <CmNotice notice={{ tone: 'info', text: t('verification.phoneUnavailable') }} />
            </section>
          )}
          {kycPending && (
            <section className="cm-section-card">
              <h2><IdCard aria-hidden="true" /> {t('verification.kycTitle')}</h2>
              <CmNotice notice={{ tone: 'info', text: t('verification.kycPendingNote') }} />
            </section>
          )}
          {kycOpen && <CmKycForm rejected={verification.kycRejected} onSubmitted={completed} />}
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
                <Link to={CM_PROTECTED_ROUTE.wallet} className="cm-workspace-button is-primary">{t('verification.openWalletDeposit')}</Link>
              </div>
            </section>
          )}
          {verification.canRequestRole && <CmRoleRequest roles={requestableRoles} onRequested={completed} />}
          {verification.canSubmitTestimonial && <CmTestimonialForm />}
        </div>
      </div>
    </main>
  );
};

export default CmVerificationPage;
