import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmApi } from '../api/CmApi';
import type { CmProject, CmRegistrationStatus } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { useCmPolicy } from '../contexts/useCmPolicy';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import type { CmFeedback } from './cmFeedback';

export const CM_TESTIMONIAL_MIN_LENGTH = 10;
const TESTIMONIAL_PROJECT_STATUS = 'completed';
const PHONE_PATTERN = /^\+?\d{10,15}$/;
const OTP_PATTERN = /^\d{6}$/;
const OTP_LENGTH = 6;
const DEFAULT_OTP_SECONDS = 600;
const KYC_STEP = 'kyc';
const KYC_NOT_STARTED_STATUS = 'not_started';
const KYC_PENDING_STATUS = 'pending';
const KYC_REJECTED_STATUS = 'rejected';
const ID_CARD = 'ID_CARD';
const EMAIL_RESEND_SENT = 'sent';
const EMAIL_RESEND_ALREADY_VERIFIED = 'already_verified';
const HTTP_TOO_MANY_REQUESTS = 429;
const RETRY_AFTER_FIELD = 'retry_after';
const SECONDS_PER_MINUTE = 60;
const EMAIL_LINK_EMAIL_PARAM = 'email';
const EMAIL_LINK_TOKEN_PARAM = 'token';
const NAME_MAX_LENGTH = 100;

type CmVerified = (message: string) => Promise<void>;

function retryAfterSeconds(response: APIResponse<unknown>): number | null {
  const body = response.debugInfo;
  const seconds = Number(body?.details?.[RETRY_AFTER_FIELD] ?? body?.[RETRY_AFTER_FIELD]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export interface CmEmailVerificationModel {
  address: string;
  setAddress: (value: string) => void;
  token: string;
  setToken: (value: string) => void;
  busy: boolean;
  resending: boolean;
  canVerify: boolean;
  resend: () => Promise<void>;
  verify: () => Promise<void>;
}

/** Email verification: resend with throttle messages, and verify with the emailed code or link params. */
export function useCmEmailVerification(feedback: CmFeedback, email: string | null, onVerified: CmVerified): CmEmailVerificationModel {
  const { t } = useTranslation('cm');
  const [searchParams] = useSearchParams();
  const [address, setAddress] = useState(searchParams.get(EMAIL_LINK_EMAIL_PARAM) || email || '');
  const [token, setToken] = useState(searchParams.get(EMAIL_LINK_TOKEN_PARAM) ?? '');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const canVerify = !busy && address.trim() !== '' && token.trim() !== '';

  const resend = async (): Promise<void> => {
    if (resending) return;
    setResending(true);
    feedback.clear();
    const response = await cmApi.resendVerificationEmail();
    setResending(false);
    const result = response.success ? response.data?.result : null;
    if (result === EMAIL_RESEND_ALREADY_VERIFIED) {
      await onVerified(t('verification.emailAlreadyVerified'));
    } else if (result === EMAIL_RESEND_SENT) {
      feedback.success(t('verification.emailResent', { email: response.data?.email || email || '' }));
    } else if (response.status === HTTP_TOO_MANY_REQUESTS) {
      const wait = retryAfterSeconds(response);
      feedback.error(wait === null
        ? t('verification.emailResendThrottled')
        : t('verification.emailResendThrottledWait', { minutes: Math.max(1, Math.ceil(wait / SECONDS_PER_MINUTE)) }));
    } else {
      feedback.error(cmErrorMessage(t, response, 'verification.emailResendFailed'));
    }
  };

  const verify = async (): Promise<void> => {
    if (!canVerify) return;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.verifyEmail(address.trim(), token.trim());
    setBusy(false);
    if (response.success) {
      setToken('');
      await onVerified(t('verification.emailVerified'));
    } else {
      feedback.error(cmErrorMessage(t, response, 'verification.emailFailed'));
    }
  };

  return { address, setAddress, token, setToken, busy, resending, canVerify, resend, verify };
}

export interface CmPhoneVerificationModel {
  phone: string;
  setPhone: (value: string) => void;
  phoneValid: boolean;
  otpCode: string;
  setOtpCode: (value: string) => void;
  otpValid: boolean;
  otpLength: number;
  codeSent: boolean;
  busy: boolean;
  sendCode: () => Promise<void>;
  verifyCode: () => Promise<void>;
}

/** Phone verification by one-time code (only offered when the server has an SMS provider). */
export function useCmPhoneVerification(feedback: CmFeedback, onVerified: CmVerified): CmPhoneVerificationModel {
  const { t } = useTranslation('cm');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCodeState] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const phoneValid = PHONE_PATTERN.test(phone.trim().replace(/[\s-]/g, ''));
  const otpValid = OTP_PATTERN.test(otpCode.trim());

  const sendCode = async (): Promise<void> => {
    if (busy || !phoneValid) return;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.requestPhoneVerification(phone.trim().replace(/[\s-]/g, ''));
    setBusy(false);
    if (response.success && response.data) {
      const seconds = typeof response.data.expires_in_seconds === 'number' ? response.data.expires_in_seconds : DEFAULT_OTP_SECONDS;
      setCodeSent(true);
      feedback.success(t('verification.codeSent', { minutes: Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE)) }));
    } else {
      feedback.error(cmErrorMessage(t, response, 'verification.phoneFailed'));
    }
  };

  const verifyCode = async (): Promise<void> => {
    if (busy || !otpValid) return;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.verifyPhoneOtp(otpCode.trim());
    setBusy(false);
    if (response.success) {
      setOtpCodeState('');
      setCodeSent(false);
      await onVerified(t('verification.phoneVerified'));
    } else {
      feedback.error(cmErrorMessage(t, response, 'verification.phoneFailed'));
    }
  };

  return {
    phone,
    setPhone,
    phoneValid,
    otpCode,
    setOtpCode: (value) => setOtpCodeState(value.replace(/\D/g, '')),
    otpValid,
    otpLength: OTP_LENGTH,
    codeSent,
    busy,
    sendCode,
    verifyCode,
  };
}

export type CmKycFileSlot = 'idFront' | 'idBack' | 'selfie';

export interface CmKycFormModel {
  identityTypes: readonly string[];
  identityType: string;
  setIdentityType: (value: string) => void;
  identityNumber: string;
  setIdentityNumber: (value: string) => void;
  realName: string;
  setRealName: (value: string) => void;
  dateOfBirth: string;
  setDateOfBirth: (value: string) => void;
  files: Record<CmKycFileSlot, File | null>;
  setFile: (slot: CmKycFileSlot, file: File | null) => void;
  needsBack: boolean;
  progress: number | null;
  /** True once a required field is missing after a submit attempt. */
  show: (field: 'identityNumber' | 'realName' | 'dateOfBirth' | CmKycFileSlot) => boolean;
  submit: () => Promise<void>;
}

/** KYC submission: identity fields plus front/back/selfie images, uploaded with progress. */
export function useCmKycForm(feedback: CmFeedback, onSubmitted: CmVerified): CmKycFormModel {
  const { t } = useTranslation('cm');
  const { policyList } = useCmBootstrap();
  const [identityType, setIdentityType] = useState<string>(ID_CARD);
  const [identityNumber, setIdentityNumber] = useState('');
  const [realName, setRealName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [files, setFiles] = useState<Record<CmKycFileSlot, File | null>>({ idFront: null, idBack: null, selfie: null });
  const [progress, setProgress] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const needsBack = identityType === ID_CARD;
  const missing = {
    identityNumber: !identityNumber.trim(),
    realName: !realName.trim(),
    dateOfBirth: !dateOfBirth,
    idFront: !files.idFront,
    idBack: needsBack && !files.idBack,
    selfie: !files.selfie,
  };
  const invalid = Object.values(missing).some(Boolean);

  const submit = async (): Promise<void> => {
    setSubmitted(true);
    if (progress !== null || invalid || !files.idFront || !files.selfie) return;
    feedback.clear();
    const formData = new FormData();
    formData.append('identity_type', identityType);
    formData.append('identity_number', identityNumber.trim());
    formData.append('real_name', realName.trim());
    formData.append('date_of_birth', dateOfBirth);
    formData.append('id_front_image', files.idFront);
    if (needsBack && files.idBack) formData.append('id_back_image', files.idBack);
    formData.append('selfie_image', files.selfie);
    setProgress(0);
    const response = await cmApi.uploadKycDocuments(formData, (percentage) => setProgress(percentage));
    setProgress(null);
    if (response.success) {
      await onSubmitted(t('verification.kycSubmitted'));
    } else {
      feedback.error(cmErrorMessage(t, response, 'verification.kycFailed'));
    }
  };

  return {
    identityTypes: policyList('identity_types'),
    identityType,
    setIdentityType,
    identityNumber,
    setIdentityNumber,
    realName,
    setRealName,
    dateOfBirth,
    setDateOfBirth,
    files,
    setFile: (slot, file) => setFiles((current) => ({ ...current, [slot]: file })),
    needsBack,
    progress,
    show: (field) => submitted && missing[field],
    submit,
  };
}

export interface CmRoleRequestModel {
  busyRole: string | null;
  request: (roleType: string) => Promise<void>;
}

/** Request an additional CodeMart role; the reply says whether a deposit is the next step. */
export function useCmRoleRequest(feedback: CmFeedback, onRequested: (message: string, depositNeeded: boolean) => Promise<void>): CmRoleRequestModel {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { currency } = useCmPolicy();
  const [busyRole, setBusyRole] = useState<string | null>(null);

  const request = async (roleType: string): Promise<void> => {
    setBusyRole(roleType);
    feedback.clear();
    const response = await cmApi.requestRole(roleType);
    setBusyRole(null);
    if (response.success && response.data) {
      const roleLabel = t(`roles.${response.data.role_type}`, { defaultValue: response.data.role_type });
      const depositNeeded = response.data.next_step === 'deposit';
      await onRequested(depositNeeded
        ? t('verification.roleRequestedDeposit', { role: roleLabel, amount: format.money(response.data.deposit_amount ?? 0, currency) })
        : t('verification.roleRequested', { role: roleLabel, status: t(`states.role.${response.data.role_status}`, { defaultValue: response.data.role_status }) }), depositNeeded);
    } else {
      feedback.error(cmErrorMessage(t, response, 'verification.roleRequestFailed'));
    }
  };

  return { busyRole, request };
}

export interface CmTestimonialFormModel {
  locales: readonly string[];
  maxQuoteLength: number;
  minLength: number;
  quotes: Record<string, string>;
  setQuote: (locale: string, text: string) => void;
  tooShort: (locale: string) => boolean;
  projects: CmProject[];
  projectId: string;
  setProjectId: (value: string) => void;
  authorLabel: string;
  setAuthorLabel: (value: string) => void;
  roleLabel: string;
  setRoleLabel: (value: string) => void;
  nameMaxLength: number;
  valid: boolean;
  busy: boolean;
  submit: () => Promise<void>;
}

/** Testimonial submission in one or more languages, optionally tied to a completed project. */
export function useCmTestimonialForm(feedback: CmFeedback): CmTestimonialFormModel {
  const { t } = useTranslation('cm');
  const { testimonialMaxQuoteLength } = useCmPolicy();
  const { policyList } = useCmBootstrap();
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<CmProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [authorLabel, setAuthorLabel] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void cmApi.getProjects({ include_assigned: true }).then((response) => {
      if (!cancelled && response.success && response.data) {
        setProjects((response.data.projects ?? []).filter((project) => project.status === TESTIMONIAL_PROJECT_STATUS));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filled: Record<string, string> = Object.fromEntries(
    Object.entries(quotes).map(([locale, text]) => [locale, text.trim()] as [string, string]).filter(([, text]) => text !== ''),
  );
  const tooShortAny = Object.values(filled).some((text) => text.length < CM_TESTIMONIAL_MIN_LENGTH);
  const valid = Object.keys(filled).length > 0 && !tooShortAny;

  const submit = async (): Promise<void> => {
    if (busy || !valid) return;
    setBusy(true);
    feedback.clear();
    const response = await cmApi.submitTestimonial({
      quotes: filled,
      project_id: projectId ? Number(projectId) : undefined,
      author_label: authorLabel.trim() || undefined,
      role_label: roleLabel.trim() || undefined,
    });
    setBusy(false);
    if (response.success) {
      setQuotes({});
      feedback.success(t('verification.testimonialSubmitted'));
    } else {
      feedback.error(cmErrorMessage(t, response, 'verification.testimonialFailed'));
    }
  };

  return {
    locales: policyList('supported_locales'),
    maxQuoteLength: testimonialMaxQuoteLength,
    minLength: CM_TESTIMONIAL_MIN_LENGTH,
    quotes,
    setQuote: (locale, text) => setQuotes((current) => ({ ...current, [locale]: text })),
    tooShort: (locale) => {
      const text = (quotes[locale] ?? '').trim();
      return text !== '' && text.length < CM_TESTIMONIAL_MIN_LENGTH;
    },
    projects,
    projectId,
    setProjectId,
    authorLabel,
    setAuthorLabel,
    roleLabel,
    setRoleLabel,
    nameMaxLength: NAME_MAX_LENGTH,
    valid,
    busy,
    submit,
  };
}

export interface CmVerificationModel {
  bootstrap: ReturnType<typeof useCmBootstrap>['bootstrap'];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  registration: CmRegistrationStatus | null;
  roles: Record<string, string>;
  phoneVerified: boolean;
  phoneAvailable: boolean;
  kycStatus: string;
  kycPending: boolean;
  kycOpen: boolean;
  kycRejected: boolean;
  requestableRoles: string[];
  canRequestRole: boolean;
  canSubmitTestimonial: boolean;
  /** The last completed step needs a wallet deposit next. */
  showWalletLink: boolean;
  completed: (message: string, depositNeeded?: boolean) => Promise<void>;
}

/** Onboarding state of the signed-in account from the bootstrap, plus the step-completed refresh. */
export function useCmVerification(feedback: CmFeedback): CmVerificationModel {
  const { bootstrap, loading, error, refresh, hasCapability } = useCmBootstrap();
  const [registration, setRegistration] = useState<CmRegistrationStatus | null>(null);
  const [showWalletLink, setShowWalletLink] = useState(false);

  const loadRegistration = useCallback(async (): Promise<void> => {
    const response = await cmApi.getRegistrationStatus();
    if (response.success && response.data) setRegistration(response.data);
  }, []);

  useEffect(() => {
    void loadRegistration();
  }, [loadRegistration]);

  const completed = useCallback(async (message: string, depositNeeded = false): Promise<void> => {
    feedback.success(message);
    setShowWalletLink(depositNeeded);
    await refresh();
    await loadRegistration();
  }, [feedback, refresh, loadRegistration]);

  const onboarding = bootstrap?.onboarding;
  const kycStatus = onboarding?.kyc_status || KYC_NOT_STARTED_STATUS;
  const kycPending = kycStatus === KYC_PENDING_STATUS;
  const requestableRoles = onboarding?.requestable_roles ?? [];

  return {
    bootstrap,
    loading,
    error,
    refresh,
    registration,
    roles: registration?.roles ?? bootstrap?.roles ?? {},
    phoneVerified: onboarding?.phone_verified ?? false,
    phoneAvailable: onboarding?.phone_verification_available !== false,
    kycStatus,
    kycPending,
    kycOpen: Boolean(onboarding) && !kycPending && onboarding?.steps.find((step) => step.key === KYC_STEP)?.completed !== true,
    kycRejected: kycStatus === KYC_REJECTED_STATUS,
    requestableRoles,
    canRequestRole: hasCapability('role.request') && requestableRoles.length > 0,
    canSubmitTestimonial: hasCapability('testimonial.create'),
    showWalletLink,
    completed,
  };
}
