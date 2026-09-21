import React, { useState } from 'react';
import { CheckCircle2, Circle, Lock, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';

type KycIdentityType = 'ID_CARD' | 'PASSPORT' | 'DRIVING_LICENSE';

const readFile = (input: HTMLInputElement): File | null => input.files?.[0] ?? null;

/**
 * Verification page: renders the server-owned onboarding truth from
 * GET /bootstrap (steps, completion, next step, deposit policy) and provides
 * the phone OTP and KYC submission flows for the steps that are still open.
 */
export const CmVerificationPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const { bootstrap, loading, refresh } = useCmBootstrap();

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpExpiresIn, setOtpExpiresIn] = useState<number | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneNotice, setPhoneNotice] = useState<string | null>(null);

  const [identityType, setIdentityType] = useState<KycIdentityType>('ID_CARD');
  const [identityNumber, setIdentityNumber] = useState('');
  const [realName, setRealName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [kycProgress, setKycProgress] = useState<number | null>(null);
  const [kycNotice, setKycNotice] = useState<string | null>(null);

  const sendCode = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (phoneBusy) return;
    setPhoneBusy(true);
    setPhoneNotice(null);
    const response = await cmApi.requestPhoneVerification(phone.trim());
    if (response.success && response.data) {
      const seconds = typeof response.data.expires_in_seconds === 'number' ? response.data.expires_in_seconds : 600;
      setOtpExpiresIn(seconds);
      setPhoneNotice(t('verification.codeSent', { seconds }));
    } else {
      setPhoneNotice(t('verification.phoneFailed'));
    }
    setPhoneBusy(false);
  };

  const verifyCode = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (phoneBusy) return;
    setPhoneBusy(true);
    setPhoneNotice(null);
    const response = await cmApi.verifyPhoneOtp(otpCode.trim());
    setPhoneNotice(response.success ? t('verification.phoneVerified') : t('verification.phoneFailed'));
    setPhoneBusy(false);
    if (response.success) {
      setOtpCode('');
      setOtpExpiresIn(null);
      await refresh();
    }
  };

  const submitKyc = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (kycProgress !== null) return;
    setKycNotice(null);
    if (!idFrontFile || !selfieFile || (identityType === 'ID_CARD' && !idBackFile)) {
      setKycNotice(t('verification.kycFailed'));
      return;
    }
    const formData = new FormData();
    formData.append('identity_type', identityType);
    formData.append('identity_number', identityNumber.trim());
    formData.append('real_name', realName.trim());
    formData.append('date_of_birth', dateOfBirth);
    formData.append('id_front_image', idFrontFile);
    if (identityType === 'ID_CARD' && idBackFile) {
      formData.append('id_back_image', idBackFile);
    }
    formData.append('selfie_image', selfieFile);
    setKycProgress(0);
    const response = await cmApi.uploadKycDocuments(formData, (percentage) => setKycProgress(percentage));
    setKycProgress(null);
    setKycNotice(response.success ? t('verification.kycSubmitted') : t('verification.kycFailed'));
    if (response.success) {
      await refresh();
    }
  };

  const phoneVerified = bootstrap?.onboarding.phone_verified ?? false;
  const kycStatus = bootstrap?.onboarding.kyc_status ?? 'not_started';
  const kycOpen = kycStatus === 'not_started' || kycStatus === 'rejected';

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
              <span className="cm-status" data-status={phoneVerified ? 'active' : 'pending'}>
                {t('verification.phone')}: {phoneVerified ? t('verification.verified') : t('verification.unverified')}
              </span>
              <span className="cm-status" data-status={kycStatus}>
                {t('verification.kyc')}: {t(`states.kyc.${kycStatus}`)}
              </span>
            </div>
          </section>
          {!phoneVerified && (
            <section className="cm-dashboard-section">
              <h2>{t('verification.phoneTitle')}</h2>
              <p className="cm-contract-note">{t('verification.phoneDescription')}</p>
              {phoneNotice && <p className="cm-contract-note">{phoneNotice}</p>}
              <form className="cm-project-form" onSubmit={(event) => void sendCode(event)}>
                <label>
                  <span>{t('verification.phoneLabel')}</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={t('verification.phonePlaceholder')}
                    inputMode="numeric"
                    required
                  />
                </label>
                <div className="cm-project-form__actions">
                  <button type="submit" className="is-primary" disabled={phoneBusy}>
                    {phoneBusy ? t('verification.sendingCode') : t('verification.sendCode')}
                  </button>
                </div>
              </form>
              {otpExpiresIn !== null && (
                <form className="cm-project-form" onSubmit={(event) => void verifyCode(event)}>
                  <label>
                    <span>{t('verification.otpLabel')}</span>
                    <input
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value)}
                      placeholder={t('verification.otpPlaceholder')}
                      inputMode="numeric"
                      maxLength={6}
                      required
                    />
                  </label>
                  <div className="cm-project-form__actions">
                    <button type="submit" className="is-primary" disabled={phoneBusy}>
                      {phoneBusy ? t('verification.verifying') : t('verification.verifyCode')}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
          {kycStatus === 'pending' && (
            <section className="cm-dashboard-section">
              <h2>{t('verification.kycTitle')}</h2>
              <p className="cm-contract-note">{t('verification.kycPendingNote')}</p>
            </section>
          )}
          {kycOpen && (
            <section className="cm-dashboard-section">
              <h2>{t('verification.kycTitle')}</h2>
              <p className="cm-contract-note">{t('verification.kycDescription')}</p>
              {kycNotice && <p className="cm-contract-note">{kycNotice}</p>}
              <form className="cm-project-form" onSubmit={(event) => void submitKyc(event)}>
                <label>
                  <span>{t('verification.identityType')}</span>
                  <select value={identityType} onChange={(event) => setIdentityType(event.target.value as KycIdentityType)}>
                    <option value="ID_CARD">{t('verification.typeIdCard')}</option>
                    <option value="PASSPORT">{t('verification.typePassport')}</option>
                    <option value="DRIVING_LICENSE">{t('verification.typeDrivingLicense')}</option>
                  </select>
                </label>
                <label>
                  <span>{t('verification.identityNumber')}</span>
                  <input value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value)} required />
                </label>
                <label>
                  <span>{t('verification.realName')}</span>
                  <input value={realName} onChange={(event) => setRealName(event.target.value)} required />
                </label>
                <label>
                  <span>{t('verification.dateOfBirth')}</span>
                  <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} required />
                </label>
                <label>
                  <span>{t('verification.idFront')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(event) => setIdFrontFile(readFile(event.target))}
                  />
                </label>
                {identityType === 'ID_CARD' && (
                  <label>
                    <span>{t('verification.idBack')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(event) => setIdBackFile(readFile(event.target))}
                    />
                  </label>
                )}
                <label>
                  <span>{t('verification.selfie')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(event) => setSelfieFile(readFile(event.target))}
                  />
                </label>
                <div className="cm-project-form__actions">
                  <button type="submit" className="is-primary" disabled={kycProgress !== null}>
                    {kycProgress !== null ? t('verification.uploadingKyc', { progress: kycProgress }) : t('verification.submitKyc')}
                  </button>
                </div>
              </form>
            </section>
          )}
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
