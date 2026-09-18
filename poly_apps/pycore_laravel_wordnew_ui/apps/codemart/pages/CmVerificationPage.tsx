import React from 'react';
import { CheckCircle2, Circle, Lock, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

/**
 * Verification page: renders the server-owned onboarding truth from
 * GET /bootstrap (steps, completion, next step, deposit policy) instead of
 * deriving state from missing fields locally.
 */
export const CmVerificationPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { bootstrap, loading } = useCmBootstrap();

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('verification.eyebrow')}</span>
        <h1>{t('nav.verification')}</h1>
        <p>{t('verification.description')}</p>
      </header>
      {loading || !bootstrap ? (
        <p className="cm-contract-note">{t('common.loading')}</p>
      ) : (
        <>
          <section className="cm-dashboard-section">
            <h2>{t('verification.stepsTitle')}</h2>
            <ol className="cm-steps-list">
              {bootstrap.onboarding.steps.map((step) => (
                <li key={step.key} data-completed={step.completed} data-blocked={step.blocked}>
                  {step.completed ? <CheckCircle2 aria-hidden="true" /> : step.blocked ? <Lock aria-hidden="true" /> : <Circle aria-hidden="true" />}
                  <span>{t(`verification.steps.${step.key}`)}</span>
                </li>
              ))}
            </ol>
            <p className="cm-contract-note">
              {bootstrap.onboarding.complete
                ? t('verification.complete')
                : t('verification.nextStep', {
                    step: bootstrap.onboarding.next_step
                      ? t(`verification.steps.${bootstrap.onboarding.next_step}`)
                      : t('common.unavailable'),
                  })}
            </p>
          </section>
          <section className="cm-dashboard-section">
            <h2>{t('verification.statusTitle')}</h2>
            <div className="cm-record-card__meta">
              <span className="cm-status" data-status={bootstrap.onboarding.email_verified ? 'active' : 'pending'}>
                {t('verification.email')}: {bootstrap.onboarding.email_verified ? t('verification.verified') : t('verification.unverified')}
              </span>
              <span className="cm-status" data-status={bootstrap.onboarding.phone_verified ? 'active' : 'pending'}>
                {t('verification.phone')}: {bootstrap.onboarding.phone_verified ? t('verification.verified') : t('verification.unverified')}
              </span>
              <span className="cm-status" data-status={bootstrap.onboarding.kyc_status}>
                {t('verification.kyc')}: {t(`states.kyc.${bootstrap.onboarding.kyc_status}`)}
              </span>
            </div>
          </section>
          {Object.keys(bootstrap.onboarding.deposit_required).length > 0 && (
            <section className="cm-dashboard-section">
              <h2><ShieldCheck aria-hidden="true" /> {t('verification.depositTitle')}</h2>
              <ul>
                {Object.entries(bootstrap.onboarding.deposit_required).map(([role, amount]) => (
                  <li key={role}>{t('verification.depositLine', { role: t(`roles.${role}`), amount })}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
};

export default CmVerificationPage;
