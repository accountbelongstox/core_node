<template>
  <div class="step-phone-verify">
    <h2>Verify Your Phone Number</h2>

    <!-- Phone Request Section -->
    <div v-if="!phoneRequested" class="phone-request-section">
      <p class="subtitle">Enter your mobile number to receive a verification code</p>

      <div class="form-group">
        <label for="phone">Mobile Number *</label>
        <div class="phone-input-wrapper">
          <span class="country-code">+86</span>
          <input
            id="phone"
            v-model="phone"
            type="tel"
            placeholder="Your 11-digit phone number"
            @keyup.enter="handleRequestVerification"
          />
        </div>
      </div>

      <button
        class="btn btn-primary btn-block"
        @click="handleRequestVerification"
        :disabled="!phone || requestLoading"
      >
        <span v-if="!requestLoading">Send Verification Code</span>
        <span v-else>Sending...</span>
      </button>

      <div v-if="requestError" class="error-message">
        {{ requestError.message }}
      </div>
    </div>

    <!-- OTP Verification Section -->
    <div v-else class="otp-verify-section">
      <div class="phone-icon">📱</div>
      <p class="subtitle">Enter the 6-digit code sent to {{ maskedPhone }}</p>

      <div class="form-group">
        <label for="otp">Verification Code *</label>
        <input
          id="otp"
          v-model="otp"
          type="text"
          maxlength="6"
          placeholder="000000"
          class="otp-input"
          @keyup.enter="handleVerify"
          @input="handleOtpInput"
        />
        <p class="hint">Enter 6-digit code</p>
      </div>

      <div v-if="otpExpires" class="countdown">
        Code expires in: {{ formatCountdown }}
      </div>

      <button
        class="btn btn-primary btn-block"
        @click="handleVerify"
        :disabled="!isOtpComplete || verifyLoading"
      >
        <span v-if="!verifyLoading">Verify Code</span>
        <span v-else>Verifying...</span>
      </button>

      <div v-if="verifyError" class="error-message">
        {{ verifyError.message }}
      </div>

      <div class="resend-section">
        <button
          class="btn btn-link"
          @click="handleResend"
          :disabled="!canResend || resendLoading"
        >
          {{ canResend ? 'Resend Code' : `Resend in ${resendCountdown}s` }}
        </button>
        <button
          class="btn btn-link"
          @click="phoneRequested = false"
        >
          Change Phone Number
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

interface ErrorType {
  field?: string;
  message: string;
}

const props = defineProps<{
  otpExpires: number;
  requestLoading: boolean;
  verifyLoading: boolean;
  resendLoading: boolean;
  requestError: ErrorType | null;
  verifyError: ErrorType | null;
}>();

const emit = defineEmits<{
  'request-verification': [phone: string];
  verify: [otpCode: string];
  resend: [];
}>();

const phone = ref('');
const otp = ref('');
const phoneRequested = ref(false);
const countdown = ref(0);
const resendCountdown = ref(0);
const countdownInterval = ref<NodeJS.Timeout>();
const resendInterval = ref<NodeJS.Timeout>();

const maskedPhone = computed(() => {
  if (!phone.value) return '';
  return `+86 ${phone.value.substring(0, 3)} **** ${phone.value.substring(7)}`;
});

const isOtpComplete = computed(() => otp.value.length === 6);

const canResend = computed(() => resendCountdown.value === 0);

const formatCountdown = computed(() => {
  if (countdown.value <= 0) return 'Expired';
  const minutes = Math.floor(countdown.value / 60);
  const seconds = countdown.value % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

onMounted(() => {
  startCountdowns();
});

onUnmounted(() => {
  clearInterval(countdownInterval.value);
  clearInterval(resendInterval.value);
});

const startCountdowns = () => {
  if (props.otpExpires > 0) {
    const now = Math.floor(Date.now() / 1000);
    countdown.value = Math.max(0, props.otpExpires - now);
    resendCountdown.value = 60;

    countdownInterval.value = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(countdownInterval.value);
      }
    }, 1000);

    resendInterval.value = setInterval(() => {
      resendCountdown.value--;
      if (resendCountdown.value <= 0) {
        clearInterval(resendInterval.value);
      }
    }, 1000);
  }
};

const handleRequestVerification = () => {
  if (!phone.value || phone.value.length < 10) {
    alert('Please enter a valid phone number');
    return;
  }
  emit('request-verification', phone.value);
  phoneRequested.value = true;
  startCountdowns();
};

const handleOtpInput = () => {
  otp.value = otp.value.replace(/[^0-9]/g, '').substring(0, 6);
};

const handleVerify = () => {
  if (!isOtpComplete.value) {
    alert('Please enter a complete 6-digit code');
    return;
  }
  emit('verify', otp.value);
};

const handleResend = () => {
  if (canResend.value) {
    emit('resend');
    resendCountdown.value = 60;
    startCountdowns();
  }
};
</script>

<style scoped lang="css">
.step-phone-verify {
  max-width: 500px;
}

.step-phone-verify h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1a1a1a;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
}

.phone-request-section,
.otp-verify-section {
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

.phone-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.phone-input-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.country-code {
  padding: 10px 12px;
  background: #f5f5f5;
  font-size: 14px;
  font-weight: 600;
  border-right: 1px solid #ddd;
  color: #666;
}

.phone-input-wrapper input {
  flex: 1;
  padding: 10px 12px;
  border: none;
  font-size: 14px;
}

.phone-input-wrapper input:focus {
  outline: none;
  background: #f9f9f9;
}

.otp-input {
  width: 100%;
  padding: 16px;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 32px;
  font-weight: 600;
  text-align: center;
  letter-spacing: 8px;
  font-family: monospace;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.otp-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.countdown {
  text-align: center;
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-link {
  background: none;
  color: #007bff;
  padding: 8px 0;
  text-decoration: underline;
  font-size: 13px;
}

.btn-link:hover:not(:disabled) {
  color: #0056b3;
}

.btn-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-block {
  width: 100%;
  margin-bottom: 12px;
}

.error-message {
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
  font-size: 14px;
  margin-bottom: 20px;
}

.resend-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
