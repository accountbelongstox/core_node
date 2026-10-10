import React, { useState } from 'react';
import { IdCard, Mail, MessageSquareQuote, Phone, Send, UserPlus } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import {
  useCmEmailVerification,
  useCmPhoneVerification,
  useCmRoleRequest,
  useCmTestimonialForm,
} from '../../../../shared/useCmVerification';
import { MobileButton, MobileCard, MobileField, MobileNotice, MobileSheet } from '../../../ui';
import { useInlineFeedback } from '../parts/useInlineFeedback';

type CmVerified = (message: string) => Promise<void>;

export const EmailVerificationCard: React.FC<{ email: string | null; onVerified: CmVerified }> = ({ email, onVerified }) => {
  const { t } = useTranslation('cm');
  const { feedback, notice } = useInlineFeedback();
  const form = useCmEmailVerification(feedback, email, onVerified);

  return (
    <MobileCard className="cmmc-card">
      <h3 className="cmmc-card__title"><Mail aria-hidden="true" /> {t('verification.emailTitle')}</h3>
      <p className="cmm-muted">{t('verification.emailDescription')}</p>
      <div className="cmmc-form">
        <MobileField label={t('verification.emailLabel')}>
          <input className="cmm-input" type="email" autoComplete="email" value={form.address} onChange={(event) => form.setAddress(event.target.value)} />
        </MobileField>
        <MobileField label={t('verification.emailToken')}>
          <input className="cmm-input" autoComplete="one-time-code" value={form.token} onChange={(event) => form.setToken(event.target.value)} />
        </MobileField>
        {notice}
        <div className="cmmc-row-actions">
          <MobileButton loading={form.resending} onClick={() => void form.resend()}>{form.resending ? t('verification.resendingEmail') : t('verification.resendEmail')}</MobileButton>
          <MobileButton variant="primary" loading={form.busy} disabled={!form.canVerify} onClick={() => void form.verify()}>{form.busy ? t('verification.verifying') : t('verification.verifyEmail')}</MobileButton>
        </div>
      </div>
    </MobileCard>
  );
};

export const PhoneVerificationCard: React.FC<{ onVerified: CmVerified }> = ({ onVerified }) => {
  const { t } = useTranslation('cm');
  const { feedback, notice } = useInlineFeedback();
  const form = useCmPhoneVerification(feedback, onVerified);

  return (
    <MobileCard className="cmmc-card">
      <h3 className="cmmc-card__title"><Phone aria-hidden="true" /> {t('verification.phoneTitle')}</h3>
      <p className="cmm-muted">{t('verification.phoneDescription')}</p>
      <div className="cmmc-form">
        <MobileField label={t('verification.phoneLabel')} error={form.phone !== '' && !form.phoneValid && t('verification.phoneInvalid')}>
          <input
            className="cmm-input"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            placeholder={t('verification.phonePlaceholder')}
            aria-invalid={form.phone !== '' && !form.phoneValid}
            onChange={(event) => form.setPhone(event.target.value)}
          />
        </MobileField>
        <MobileButton variant={form.codeSent ? 'secondary' : 'primary'} block loading={form.busy && !form.codeSent} disabled={!form.phoneValid} onClick={() => void form.sendCode()}>
          {form.busy && !form.codeSent ? t('verification.sendingCode') : form.codeSent ? t('verification.resendCode') : t('verification.sendCode')}
        </MobileButton>
        {form.codeSent && (
          <>
            <MobileField label={t('verification.otpLabel')}>
              <input
                className="cmm-input cmmc-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={form.otpLength}
                value={form.otpCode}
                placeholder={t('verification.otpPlaceholder')}
                onChange={(event) => form.setOtpCode(event.target.value)}
              />
            </MobileField>
            <MobileButton variant="primary" block loading={form.busy} disabled={!form.otpValid} onClick={() => void form.verifyCode()}>{form.busy ? t('verification.verifying') : t('verification.verifyCode')}</MobileButton>
          </>
        )}
        {notice}
      </div>
    </MobileCard>
  );
};

export const PhoneUnavailableCard: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <MobileCard className="cmmc-card">
      <h3 className="cmmc-card__title"><Phone aria-hidden="true" /> {t('verification.phoneTitle')}</h3>
      <MobileNotice>{t('verification.phoneUnavailable')}</MobileNotice>
    </MobileCard>
  );
};

export const KycPendingCard: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <MobileCard className="cmmc-card">
      <h3 className="cmmc-card__title"><IdCard aria-hidden="true" /> {t('verification.kycTitle')}</h3>
      <MobileNotice>{t('verification.kycPendingNote')}</MobileNotice>
    </MobileCard>
  );
};

export const RoleRequestCard: React.FC<{ roles: string[]; onRequested: (message: string, depositNeeded: boolean) => Promise<void> }> = ({ roles, onRequested }) => {
  const { t } = useTranslation('cm');
  const { feedback, notice } = useInlineFeedback();
  const { busyRole, request } = useCmRoleRequest(feedback, onRequested);

  return (
    <MobileCard className="cmmc-card">
      <h3 className="cmmc-card__title"><UserPlus aria-hidden="true" /> {t('verification.roleRequestTitle')}</h3>
      <p className="cmm-muted">{t('verification.roleRequestDescription')}</p>
      <div className="cmmc-role-options">
        {roles.map((roleType) => {
          const label = t(`roles.${roleType}`, { defaultValue: roleType });
          return (
            <article key={roleType} className="cmmc-role-option">
              <strong>{label}</strong>
              <p className="cmm-muted">{t(`verification.roleBenefits.${roleType}`, { defaultValue: '' })}</p>
              <MobileButton variant="primary" block loading={busyRole === roleType} disabled={busyRole !== null} onClick={() => void request(roleType)}>
                {busyRole === roleType ? t('common.saving') : t('verification.requestRole', { role: label })}
              </MobileButton>
            </article>
          );
        })}
      </div>
      {notice}
    </MobileCard>
  );
};

const TestimonialBody: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { t } = useTranslation('cm');
  const { feedback, notice } = useInlineFeedback();
  const form = useCmTestimonialForm(feedback);

  const submit = async (): Promise<void> => {
    if (await form.submit()) onDone();
  };

  return (
    <>
      <div className="cmmc-form">
        <p className="cmm-muted">{t('verification.testimonialDescription')}</p>
        {form.locales.map((locale) => (
          <MobileField
            key={locale}
            label={t(`verification.testimonialQuote.${locale}`, { defaultValue: locale })}
            error={form.tooShort(locale) && t('verification.testimonialTooShort', { min: form.minLength })}
          >
            <textarea
              className="cmm-input cmmc-textarea"
              rows={3}
              maxLength={form.maxQuoteLength}
              value={form.quotes[locale] ?? ''}
              placeholder={t('verification.testimonialPlaceholder')}
              aria-invalid={form.tooShort(locale)}
              onChange={(event) => form.setQuote(locale, event.target.value)}
            />
          </MobileField>
        ))}
        <p className="cmm-muted">{t('verification.testimonialOneLanguage')}</p>
        <MobileField label={t('verification.testimonialProject')}>
          <select className="cmm-input" value={form.projectId} onChange={(event) => form.setProjectId(event.target.value)}>
            <option value="">{t('verification.testimonialNoProject')}</option>
            {form.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </MobileField>
        <MobileField label={t('verification.testimonialAuthor')}>
          <input className="cmm-input" maxLength={form.nameMaxLength} value={form.authorLabel} onChange={(event) => form.setAuthorLabel(event.target.value)} />
        </MobileField>
        <MobileField label={t('verification.testimonialRole')}>
          <input className="cmm-input" maxLength={form.nameMaxLength} value={form.roleLabel} onChange={(event) => form.setRoleLabel(event.target.value)} />
        </MobileField>
        {notice}
      </div>
      <div className="cmmc-sheet-submit">
        <MobileButton variant="primary" block icon={<Send aria-hidden="true" />} loading={form.busy} disabled={!form.valid} onClick={() => void submit()}>{form.busy ? t('common.saving') : t('verification.testimonialSubmit')}</MobileButton>
      </div>
    </>
  );
};

/** Testimonial form behind a card button; the sheet closes once the quote is sent. */
export const TestimonialCard: React.FC = () => {
  const { t } = useTranslation('cm');
  const [open, setOpen] = useState(false);

  return (
    <MobileCard className="cmmc-card">
      <h3 className="cmmc-card__title"><MessageSquareQuote aria-hidden="true" /> {t('verification.testimonialTitle')}</h3>
      <p className="cmm-muted">{t('verification.testimonialDescription')}</p>
      <MobileButton block onClick={() => setOpen(true)}>{t('verification.testimonialSubmit')}</MobileButton>
      <MobileSheet open={open} onClose={() => setOpen(false)} title={t('verification.testimonialTitle')}>
        <TestimonialBody onDone={() => setOpen(false)} />
      </MobileSheet>
    </MobileCard>
  );
};
