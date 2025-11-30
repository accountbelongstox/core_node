<template>
  <div class="step-email-verify">
    <h2>Verify Your Email</h2>
    <p class="subtitle">We've sent a verification link to {{ email }}</p>

    <div class="verification-content">
      <div class="email-icon">📧</div>

      <p class="instruction">
        Click the verification link sent to your email address to confirm your account. The link will expire in 24 hours.
      </p>

      <div class="form-group">
        <label for="token">Or paste the verification token here</label>
        <textarea
          id="token"
          v-model="token"
          placeholder="Paste verification token from email"
          rows="4"
          class="token-input"
        ></textarea>
      </div>

      <button
        v-if="token"
        class="btn btn-primary btn-block"
        @click="handleVerify"
        :disabled="loading"
      >
        <span v-if="!loading">Verify Email</span>
        <span v-else>Verifying...</span>
      </button>

      <div v-if="error" class="error-message">
        {{ error.message }}
      </div>

      <div class="resend-section">
        <p>Didn't receive the email?</p>
        <button class="btn btn-link" @click="handleResend">
          Resend verification email
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface ErrorType {
  field?: string;
  message: string;
}

const props = defineProps<{
  email: string;
  loading: boolean;
  error: ErrorType | null;
}>();

const emit = defineEmits<{
  verify: [email: string, token: string];
}>();

const token = ref('');

const handleVerify = () => {
  if (!token.value.trim()) {
    alert('Please enter verification token');
    return;
  }
  emit('verify', props.email, token.value.trim());
};

const handleResend = () => {
  // TODO: Implement resend functionality
  alert('Verification email resent');
};
</script>

<style scoped lang="css">
.step-email-verify {
  max-width: 500px;
}

.step-email-verify h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #1a1a1a;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 30px;
}

.verification-content {
  text-align: center;
}

.email-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.instruction {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 30px;
  background: #f5f5f5;
  padding: 16px;
  border-radius: 6px;
}

.form-group {
  text-align: left;
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.token-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: monospace;
  resize: vertical;
  box-sizing: border-box;
}

.token-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
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
  padding: 0;
  text-decoration: underline;
}

.btn-link:hover {
  color: #0056b3;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
  font-size: 14px;
  margin: 20px 0;
}

.resend-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.resend-section p {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}
</style>
