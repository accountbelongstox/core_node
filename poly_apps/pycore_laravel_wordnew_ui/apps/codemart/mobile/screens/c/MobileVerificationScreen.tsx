import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Lock, ShieldCheck, Wallet } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CM_PROTECTED_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmFormat } from '../../../components/workspace/cmWorkspaceFormat';
import { useCmPolicy } from '../../../contexts/useCmPolicy';
import { useCmVerification } from '../../../shared/useCmVerification';
import { MobileButton, MobileCard, MobileErrorState, MobileList, MobileListRow, MobileScreen, MobileSectionHeader, MobileSkeletonList, MobileStatusBadge, useMobileFeedback } from '../../ui';
import {
  EmailVerificationCard,
  KycPendingCard,
  PhoneUnavailableCard,
  PhoneVerificationCard,
  RoleRequestCard,
  TestimonialCard,
} from './verification/VerificationCards';
import { VerificationKycCard } from './verification/VerificationKycCard';

/** Mobile verification: the onboarding steps with the email, phone, KYC, role and testimonial flows the account still needs. */
const MobileVerificationScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { currency } = useCmPolicy();
  const feedback = useMobileFeedback();
  const verification = useCmVerification(feedback);
  const { bootstrap, loading, error, refresh, roles, phoneVerified, phoneAvailable, kycStatus, kycPending, kycOpen, completed } = verification;

  if (!bootstrap) {
    return (
      <MobileScreen title={t('nav.verification')} onRefresh={refresh}>
        {loading || !error ? <MobileSkeletonList rows={4} /> : <MobileErrorState message={t('errors.bootstrapFailed')} onRetry={() => void refresh()} />}
      </MobileScreen>
    );
  }

  const onboarding = bootstrap.onboarding;
  const depositRoles = Object.entries(onboarding.deposit_required);
  const nextStep = onboarding.next_step ? t(`verification.steps.${onboarding.next_step}`, { defaultValue: onboarding.next_step }) : t('common.unavailable');

  return (
    <MobileScreen title={t('nav.verification')} onRefresh={refresh}>
      <MobileCard tone="accent" className="cmmc-card">
        <h3 className="cmmc-card__title"><ShieldCheck aria-hidden="true" /> {t('verification.stepsTitle')}</h3>
        <ol className="cmmc-steps">
          {onboarding.steps.map((step) => (
            <li key={step.key} data-completed={step.completed} data-blocked={step.blocked} data-current={onboarding.next_step === step.key}>
              {step.completed ? <CheckCircle2 aria-hidden="true" /> : step.blocked ? <Lock aria-hidden="true" /> : <Circle aria-hidden="true" />}
              <span>{t(`verification.steps.${step.key}`, { defaultValue: step.key })}</span>
              {step.optional && !step.completed && <small>{t('verification.optionalStep')}</small>}
            </li>
          ))}
        </ol>
        <p className="cmm-summary">{onboarding.complete ? t('verification.complete') : t('verification.nextStep', { step: nextStep })}</p>
      </MobileCard>

      <MobileList label={t('verification.stepsTitle')}>
        <MobileListRow title={t('verification.email')} trailing={<span className="cmm-badge" data-tone={onboarding.email_verified ? 'success' : 'warning'}>{onboarding.email_verified ? t('verification.verified') : t('verification.unverified')}</span>} />
        <MobileListRow title={t('verification.phone')} trailing={<span className="cmm-badge" data-tone={phoneVerified ? 'success' : phoneAvailable ? 'warning' : undefined}>{phoneVerified ? t('verification.verified') : phoneAvailable ? t('verification.unverified') : t('verification.notAvailable')}</span>} />
        <MobileListRow title={t('verification.kyc')} trailing={<MobileStatusBadge group="kyc" status={kycStatus} />} />
        {Object.entries(roles).map(([role, status]) => (
          <MobileListRow key={role} title={t(`roles.${role}`, { defaultValue: role })} trailing={<MobileStatusBadge group="role" status={status} />} />
        ))}
      </MobileList>

      {verification.showWalletLink && <MobileButton variant="primary" block to={CM_PROTECTED_ROUTE.wallet} icon={<Wallet aria-hidden="true" />}>{t('verification.openWalletDeposit')}</MobileButton>}

      {!onboarding.email_verified && <EmailVerificationCard email={bootstrap.user.email} onVerified={completed} />}
      {!phoneVerified && phoneAvailable && <PhoneVerificationCard onVerified={completed} />}
      {!phoneVerified && !phoneAvailable && <PhoneUnavailableCard />}
      {kycPending && <KycPendingCard />}
      {kycOpen && <VerificationKycCard rejected={verification.kycRejected} onSubmitted={completed} />}

      {depositRoles.length > 0 && (
        <section className="cmm-section">
          <MobileSectionHeader title={t('verification.depositTitle')} />
          <MobileList>
            {depositRoles.map(([role, amount]) => (
              <MobileListRow key={role} title={t(`roles.${role}`, { defaultValue: role })} trailing={<strong>{format.money(amount, currency)}</strong>} />
            ))}
          </MobileList>
          <Link to={CM_PROTECTED_ROUTE.wallet} className="cmm-link-btn">{t('verification.openWalletDeposit')}</Link>
        </section>
      )}

      {verification.canRequestRole && <RoleRequestCard roles={verification.requestableRoles} onRequested={completed} />}
      {verification.canSubmitTestimonial && <TestimonialCard />}
    </MobileScreen>
  );
};

export default MobileVerificationScreen;
