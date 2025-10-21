/**
 * CodeMart Registration Composable
 * Manages the complete registration flow: register -> email verify -> phone verify -> KYC -> Payment
 */

import { ref, computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { useAsyncOperation } from './use-async-operation';
import { authApi } from '../services_app_codemart';
import type {
  RegisterRequest,
  RegisterResponse,
  VerifyEmailRequest,
  RequestPhoneVerificationRequest,
  VerifyPhoneOtpRequest,
  KycDocumentsRequest,
  KycDocumentsResponse,
  RegistrationStatusResponse,
} from '../services_app_codemart/auth-api';

export type RegistrationStep = 'register' | 'email_verify' | 'phone_verify' | 'kyc_verify' | 'payment' | 'complete';

export interface RegistrationError {
  field?: string;
  message: string;
  code?: string;
}

export interface UseRegistrationReturn {
  currentStep: Ref<RegistrationStep>;
  userId: Ref<number | null>;
  userEmail: Ref<string>;
  userPhone: Ref<string>;
  registrationStatus: Ref<RegistrationStatusResponse | null>;

  // Step 1: Registration
  registerLoading: Ref<boolean>;
  registerError: Ref<RegistrationError | null>;
  register: (data: RegisterRequest) => Promise<void>;

  // Step 2: Email Verification
  emailVerifyLoading: Ref<boolean>;
  emailVerifyError: Ref<RegistrationError | null>;
  verifyEmail: (email: string, token: string) => Promise<void>;

  // Step 3: Phone Verification
  phoneRequestLoading: Ref<boolean>;
  phoneRequestError: Ref<RegistrationError | null>;
  phoneOtpExpires: Ref<number>;
  requestPhoneVerification: (phone: string) => Promise<void>;

  phoneVerifyLoading: Ref<boolean>;
  phoneVerifyError: Ref<RegistrationError | null>;
  verifyPhoneOtp: (otpCode: string) => Promise<void>;

  resendOtpLoading: Ref<boolean>;
  resendOtp: () => Promise<void>;

  // Step 4: KYC Verification
  kycLoading: Ref<boolean>;
  kycError: Ref<RegistrationError | null>;
  kycUploadProgress: Ref<number>;
  uploadKycDocuments: (data: KycDocumentsRequest) => Promise<void>;

  // Overall
  isStepComplete: ComputedRef<boolean>;
  canProceedToNextStep: ComputedRef<boolean>;
  proceedToNextStep: () => void;
  getRegistrationStatus: () => Promise<void>;
  reset: () => void;
}

export function useRegistration(): UseRegistrationReturn {
  // State
  const currentStep = ref<RegistrationStep>('register');
  const userId = ref<number | null>(null);
  const userEmail = ref('');
  const userPhone = ref('');
  const registrationStatus = ref<RegistrationStatusResponse | null>(null);
  const phoneOtpExpires = ref(0);
  const kycUploadProgress = ref(0);

  // Registration step
  const registerOperation = useAsyncOperation(
    async () => {
      throw new Error('Not implemented directly - use register method');
    },
    { resetOnExecute: true }
  );
  const registerLoading = registerOperation.loading;
  const registerError = ref<RegistrationError | null>(null);

  // Email verification step
  const emailVerifyOperation = useAsyncOperation(
    async () => {
      throw new Error('Not implemented directly - use verifyEmail method');
    },
    { resetOnExecute: true }
  );
  const emailVerifyLoading = emailVerifyOperation.loading;
  const emailVerifyError = ref<RegistrationError | null>(null);

  // Phone request OTP step
  const phoneRequestOperation = useAsyncOperation(
    async () => {
      throw new Error('Not implemented directly - use requestPhoneVerification method');
    },
    { resetOnExecute: true }
  );
  const phoneRequestLoading = phoneRequestOperation.loading;
  const phoneRequestError = ref<RegistrationError | null>(null);

  // Phone OTP verification step
  const phoneVerifyOperation = useAsyncOperation(
    async () => {
      throw new Error('Not implemented directly - use verifyPhoneOtp method');
    },
    { resetOnExecute: true }
  );
  const phoneVerifyLoading = phoneVerifyOperation.loading;
  const phoneVerifyError = ref<RegistrationError | null>(null);

  // Resend OTP step
  const resendOtpOperation = useAsyncOperation(
    async () => {
      throw new Error('Not implemented directly - use resendOtp method');
    },
    { resetOnExecute: true }
  );
  const resendOtpLoading = resendOtpOperation.loading;

  // KYC upload step
  const kycOperation = useAsyncOperation(
    async () => {
      throw new Error('Not implemented directly - use uploadKycDocuments method');
    },
    { resetOnExecute: true }
  );
  const kycLoading = kycOperation.loading;
  const kycError = ref<RegistrationError | null>(null);

  // Methods
  const register = async (data: RegisterRequest): Promise<void> => {
    try {
      registerError.value = null;
      const response = await authApi.register(data);
      userId.value = response.data.user_id;
      userEmail.value = response.data.email;
    } catch (error) {
      registerError.value = {
        message: error instanceof Error ? error.message : 'Registration failed',
      };
      throw error;
    }
  };

  const verifyEmail = async (email: string, token: string): Promise<void> => {
    try {
      emailVerifyError.value = null;
      const data: VerifyEmailRequest = { email, token };
      const response = await authApi.verifyEmail(data);
      userId.value = response.data.user_id;
      currentStep.value = 'phone_verify';
    } catch (error) {
      emailVerifyError.value = {
        message: error instanceof Error ? error.message : 'Email verification failed',
      };
      throw error;
    }
  };

  const requestPhoneVerification = async (phone: string): Promise<void> => {
    try {
      phoneRequestError.value = null;
      const data: RequestPhoneVerificationRequest = { phone };
      const response = await authApi.requestPhoneVerification(data);
      userPhone.value = response.data.phone;
      phoneOtpExpires.value = Math.floor(Date.now() / 1000) + response.data.expires_in_seconds;
    } catch (error) {
      phoneRequestError.value = {
        message: error instanceof Error ? error.message : 'Failed to request phone verification',
      };
      throw error;
    }
  };

  const verifyPhoneOtp = async (otpCode: string): Promise<void> => {
    try {
      phoneVerifyError.value = null;
      const data: VerifyPhoneOtpRequest = { otp_code: otpCode };
      const response = await authApi.verifyPhoneOtp(data);
      userId.value = response.data.user_id;
      currentStep.value = 'kyc_verify';
    } catch (error) {
      phoneVerifyError.value = {
        message: error instanceof Error ? error.message : 'Phone verification failed',
      };
      throw error;
    }
  };

  const resendOtp = async (): Promise<void> => {
    try {
      const response = await authApi.resendPhoneOtp();
      phoneOtpExpires.value = Math.floor(Date.now() / 1000) + response.data.expires_in_seconds;
    } catch (error) {
      throw error;
    }
  };

  const uploadKycDocuments = async (data: KycDocumentsRequest): Promise<void> => {
    try {
      kycError.value = null;
      kycUploadProgress.value = 0;
      const response = await authApi.uploadKycDocuments(data);
      currentStep.value = 'payment';
    } catch (error) {
      kycError.value = {
        message: error instanceof Error ? error.message : 'KYC document upload failed',
      };
      throw error;
    }
  };

  const getRegistrationStatus = async (): Promise<void> => {
    try {
      const response = await authApi.getRegistrationStatus();
      registrationStatus.value = response.data;

      // Update current step based on registration status
      if (response.data.registration_complete) {
        currentStep.value = 'complete';
      } else if (response.data.kyc_status === 'approved') {
        currentStep.value = 'payment';
      } else if (response.data.kyc_status !== 'not_started') {
        currentStep.value = 'kyc_verify';
      } else if (response.data.phone_verified) {
        currentStep.value = 'kyc_verify';
      } else if (response.data.email_verified) {
        currentStep.value = 'phone_verify';
      }
    } catch (error) {
      console.error('Failed to get registration status:', error);
    }
  };

  const proceedToNextStep = (): void => {
    const steps: RegistrationStep[] = ['register', 'email_verify', 'phone_verify', 'kyc_verify', 'payment', 'complete'];
    const currentIndex = steps.indexOf(currentStep.value);

    if (currentIndex < steps.length - 1) {
      currentStep.value = steps[currentIndex + 1];
    }
  };

  const isStepComplete = computed((): boolean => {
    switch (currentStep.value) {
      case 'register':
        return userId.value !== null;
      case 'email_verify':
        return registrationStatus.value?.email_verified ?? false;
      case 'phone_verify':
        return registrationStatus.value?.phone_verified ?? false;
      case 'kyc_verify':
        return registrationStatus.value?.kyc_status === 'approved';
      case 'payment':
        return registrationStatus.value?.registration_complete ?? false;
      case 'complete':
        return true;
      default:
        return false;
    }
  });

  const canProceedToNextStep = computed((): boolean => {
    return isStepComplete.value && currentStep.value !== 'complete';
  });

  const reset = (): void => {
    currentStep.value = 'register';
    userId.value = null;
    userEmail.value = '';
    userPhone.value = '';
    registrationStatus.value = null;
    phoneOtpExpires.value = 0;
    kycUploadProgress.value = 0;
    registerError.value = null;
    emailVerifyError.value = null;
    phoneRequestError.value = null;
    phoneVerifyError.value = null;
    kycError.value = null;
  };

  return {
    currentStep,
    userId,
    userEmail,
    userPhone,
    registrationStatus,

    registerLoading,
    registerError,
    register,

    emailVerifyLoading,
    emailVerifyError,
    verifyEmail,

    phoneRequestLoading,
    phoneRequestError,
    phoneOtpExpires,
    requestPhoneVerification,

    phoneVerifyLoading,
    phoneVerifyError,
    verifyPhoneOtp,

    resendOtpLoading,
    resendOtp,

    kycLoading,
    kycError,
    kycUploadProgress,
    uploadKycDocuments,

    isStepComplete,
    canProceedToNextStep,
    proceedToNextStep,
    getRegistrationStatus,
    reset,
  };
}

export default useRegistration;
