<template>
  <div class="codemart-registration-form">
    <div class="registration-header">
      <h1>Join CodeMart Platform</h1>
      <p class="subtitle">Complete registration to start your journey</p>
    </div>

    <!-- Step Indicator -->
    <div class="registration-steps">
      <div
        v-for="(step, index) in registrationSteps"
        :key="step.id"
        :class="['step', { active: currentStep === step.id, completed: isStepCompleted(step.id) }]"
      >
        <div class="step-number">
          <span v-if="!isStepCompleted(step.id)">{{ index + 1 }}</span>
          <span v-else class="step-check">✓</span>
        </div>
        <div class="step-label">{{ step.label }}</div>
      </div>
    </div>

    <!-- Registration Content -->
    <div class="registration-content">
      <!-- Step 1: Register -->
      <div v-if="currentStep === 'register'" class="step-content">
        <RegistrationStepRegister
          @register="handleRegister"
          :loading="registerLoading"
          :error="registerError"
        />
      </div>

      <!-- Step 2: Email Verification -->
      <div v-if="currentStep === 'email_verify'" class="step-content">
        <RegistrationStepEmailVerify
          :email="userEmail"
          @verify="handleVerifyEmail"
          :loading="emailVerifyLoading"
          :error="emailVerifyError"
        />
      </div>

      <!-- Step 3: Phone Verification -->
      <div v-if="currentStep === 'phone_verify'" class="step-content">
        <RegistrationStepPhoneVerify
          @request-verification="handleRequestPhoneVerification"
          @verify="handleVerifyPhoneOtp"
          @resend="handleResendOtp"
          :otp-expires="phoneOtpExpires"
          :request-loading="phoneRequestLoading"
          :verify-loading="phoneVerifyLoading"
          :resend-loading="resendOtpLoading"
          :request-error="phoneRequestError"
          :verify-error="phoneVerifyError"
        />
      </div>

      <!-- Step 4: KYC Verification -->
      <div v-if="currentStep === 'kyc_verify'" class="step-content">
        <RegistrationStepKycVerify
          @upload="handleUploadKycDocuments"
          :loading="kycLoading"
          :error="kycError"
          :upload-progress="kycUploadProgress"
        />
      </div>

      <!-- Step 5: Payment -->
      <div v-if="currentStep === 'payment'" class="step-content">
        <RegistrationStepPayment
          :user-id="userId"
          :role-type="selectedRoleType"
          @payment-complete="handlePaymentComplete"
        />
      </div>

      <!-- Step 6: Complete -->
      <div v-if="currentStep === 'complete'" class="step-content">
        <RegistrationStepComplete
          :username="registrationStatus?.username"
          @continue="handleContinue"
        />
      </div>
    </div>

    <!-- Navigation Buttons -->
    <div v-if="currentStep !== 'complete'" class="registration-navigation">
      <button
        v-if="currentStep !== 'register'"
        class="btn btn-secondary"
        @click="handlePreviousStep"
      >
        Back
      </button>
      <button
        v-if="canProceedToNextStep && currentStep !== 'payment'"
        class="btn btn-primary"
        @click="handleNextStep"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRegistration } from '../composables_app_codemart';
import RegistrationStepRegister from './registration/RegistrationStepRegister.vue';
import RegistrationStepEmailVerify from './registration/RegistrationStepEmailVerify.vue';
import RegistrationStepPhoneVerify from './registration/RegistrationStepPhoneVerify.vue';
import RegistrationStepKycVerify from './registration/RegistrationStepKycVerify.vue';
import RegistrationStepPayment from './registration/RegistrationStepPayment.vue';
import RegistrationStepComplete from './registration/RegistrationStepComplete.vue';

const {
  currentStep,
  userId,
  userEmail,
  userPhone,
  registrationStatus,
  phoneOtpExpires,
  kycUploadProgress,

  registerLoading,
  registerError,
  register,

  emailVerifyLoading,
  emailVerifyError,
  verifyEmail,

  phoneRequestLoading,
  phoneRequestError,
  requestPhoneVerification,

  phoneVerifyLoading,
  phoneVerifyError,
  verifyPhoneOtp,

  resendOtpLoading,
  resendOtp,

  kycLoading,
  kycError,
  uploadKycDocuments,

  isStepComplete,
  canProceedToNextStep,
  proceedToNextStep,
  getRegistrationStatus,
} = useRegistration();

const selectedRoleType = ref<'developer' | 'client'>('developer');

const registrationSteps = [
  { id: 'register', label: 'Register' },
  { id: 'email_verify', label: 'Email' },
  { id: 'phone_verify', label: 'Phone' },
  { id: 'kyc_verify', label: 'Identity' },
  { id: 'payment', label: 'Payment' },
  { id: 'complete', label: 'Complete' },
];

onMounted(async () => {
  await getRegistrationStatus();
});

const handleRegister = async (data: any) => {
  selectedRoleType.value = data.role_type;
  await register(data);
  proceedToNextStep();
};

const handleVerifyEmail = async (email: string, token: string) => {
  await verifyEmail(email, token);
  proceedToNextStep();
};

const handleRequestPhoneVerification = async (phone: string) => {
  await requestPhoneVerification(phone);
};

const handleVerifyPhoneOtp = async (otpCode: string) => {
  await verifyPhoneOtp(otpCode);
  proceedToNextStep();
};

const handleResendOtp = async () => {
  await resendOtp();
};

const handleUploadKycDocuments = async (kycData: any) => {
  await uploadKycDocuments(kycData);
  proceedToNextStep();
};

const handlePaymentComplete = () => {
  proceedToNextStep();
};

const handleNextStep = () => {
  proceedToNextStep();
};

const handlePreviousStep = () => {
  const steps = ['register', 'email_verify', 'phone_verify', 'kyc_verify', 'payment', 'complete'];
  const currentIndex = steps.indexOf(currentStep.value as string);
  if (currentIndex > 0) {
    currentStep.value = steps[currentIndex - 1] as any;
  }
};

const handleContinue = () => {
  // Navigate to user dashboard
  navigateTo('/dashboard');
};

const isStepCompleted = (stepId: string) => {
  const completedSteps = ['register', 'email_verify', 'phone_verify', 'kyc_verify'];
  const currentIndex = registrationSteps.findIndex(s => s.id === currentStep.value);
  const stepIndex = registrationSteps.findIndex(s => s.id === stepId);

  return stepIndex < currentIndex;
};
</script>

<style scoped lang="css">
.codemart-registration-form {
  max-width: 600px;
  margin: 40px auto;
  padding: 40px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.registration-header {
  text-align: center;
  margin-bottom: 40px;
}

.registration-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 10px 0;
  color: #1a1a1a;
}

.registration-header .subtitle {
  font-size: 16px;
  color: #666;
  margin: 0;
}

.registration-steps {
  display: flex;
  gap: 8px;
  margin-bottom: 40px;
  overflow-x: auto;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 100px;
  padding: 12px;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.3s ease;
}

.step.active {
  background: #007bff;
  color: white;
}

.step.completed {
  background: #28a745;
  color: white;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  font-weight: 600;
}

.step.active .step-number {
  background: rgba(255, 255, 255, 0.5);
}

.step-check {
  font-size: 14px;
}

.step-label {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.registration-content {
  margin-bottom: 40px;
  min-height: 300px;
}

.step-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.registration-navigation {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #e9ecef;
  color: #333;
}

.btn-secondary:hover {
  background: #dee2e6;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .codemart-registration-form {
    margin: 20px 0;
    padding: 20px;
  }

  .registration-header h1 {
    font-size: 24px;
  }

  .registration-steps {
    gap: 4px;
  }

  .step {
    padding: 8px;
    min-width: 80px;
  }

  .step-label {
    font-size: 10px;
  }

  .registration-navigation {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
