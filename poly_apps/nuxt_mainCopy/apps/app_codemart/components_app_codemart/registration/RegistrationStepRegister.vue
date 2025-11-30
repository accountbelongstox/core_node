<template>
  <div class="step-register">
    <h2>Create Your Account</h2>

    <form @submit.prevent="handleSubmit">
      <!-- Role Selection -->
      <div class="form-group">
        <label>Select Your Role</label>
        <div class="role-options">
          <div
            :class="['role-option', { selected: form.role_type === 'developer' }]"
            @click="form.role_type = 'developer'"
          >
            <div class="role-icon">👨‍💻</div>
            <div class="role-name">Developer</div>
            <p class="role-desc">Build projects and earn</p>
          </div>
          <div
            :class="['role-option', { selected: form.role_type === 'client' }]"
            @click="form.role_type = 'client'"
          >
            <div class="role-icon">🏢</div>
            <div class="role-name">Client</div>
            <p class="role-desc">Hire developers</p>
          </div>
        </div>
      </div>

      <!-- Real Name -->
      <div class="form-group">
        <label for="realName">Full Name *</label>
        <input
          id="realName"
          v-model="form.real_name"
          type="text"
          placeholder="Enter your full name"
          required
        />
      </div>

      <!-- Username -->
      <div class="form-group">
        <label for="username">Username *</label>
        <input
          id="username"
          v-model="form.username"
          type="text"
          placeholder="Choose a username (3-50 characters)"
          required
          minlength="3"
          maxlength="50"
        />
        <p v-if="usernameAvailable !== null" :class="['hint', usernameAvailable ? 'available' : 'taken']">
          {{ usernameAvailable ? '✓ Available' : '✗ Not available' }}
        </p>
      </div>

      <!-- Email -->
      <div class="form-group">
        <label for="email">Email Address *</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          placeholder="your@email.com"
          required
        />
        <p v-if="emailAvailable !== null" :class="['hint', emailAvailable ? 'available' : 'taken']">
          {{ emailAvailable ? '✓ Available' : '✗ Already registered' }}
        </p>
      </div>

      <!-- Password -->
      <div class="form-group">
        <label for="password">Password *</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          placeholder="At least 8 characters"
          required
          minlength="8"
        />
        <p class="hint">Must be at least 8 characters with mix of letters and numbers</p>
      </div>

      <!-- Confirm Password -->
      <div class="form-group">
        <label for="passwordConfirmation">Confirm Password *</label>
        <input
          id="passwordConfirmation"
          v-model="form.passwordConfirmation"
          type="password"
          placeholder="Repeat your password"
          required
          minlength="8"
        />
      </div>

      <!-- Terms & Conditions -->
      <div class="form-group checkbox">
        <input
          id="terms"
          v-model="form.agreedToTerms"
          type="checkbox"
          required
        />
        <label for="terms">
          I agree to the
          <a href="#" target="_blank">Terms of Service</a>
          and
          <a href="#" target="_blank">Privacy Policy</a>
        </label>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        {{ error.message }}
      </div>

      <!-- Submit Button -->
      <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
        <span v-if="!loading">Create Account</span>
        <span v-else>Creating Account...</span>
      </button>
    </form>

    <!-- Login Link -->
    <p class="login-link">
      Already have an account?
      <a href="/auth/login">Log in here</a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface RegistrationForm {
  real_name: string;
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  role_type: 'developer' | 'client';
  agreedToTerms: boolean;
}

interface ErrorType {
  field?: string;
  message: string;
}

const props = defineProps<{
  loading: boolean;
  error: ErrorType | null;
}>();

const emit = defineEmits<{
  register: [data: RegistrationForm];
}>();

const form = ref<RegistrationForm>({
  real_name: '',
  username: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  role_type: 'developer',
  agreedToTerms: false,
});

const usernameAvailable = ref<boolean | null>(null);
const emailAvailable = ref<boolean | null>(null);
const checkUsername = ref<NodeJS.Timeout>();
const checkEmail = ref<NodeJS.Timeout>();

// Debounced username check
watch(
  () => form.value.username,
  (username) => {
    clearTimeout(checkUsername.value);
    if (username.length >= 3) {
      checkUsername.value = setTimeout(async () => {
        try {
          // TODO: Call API to check username availability
          usernameAvailable.value = true;
        } catch (e) {
          usernameAvailable.value = false;
        }
      }, 500);
    }
  }
);

// Debounced email check
watch(
  () => form.value.email,
  (email) => {
    clearTimeout(checkEmail.value);
    if (email.includes('@')) {
      checkEmail.value = setTimeout(async () => {
        try {
          // TODO: Call API to check email availability
          emailAvailable.value = true;
        } catch (e) {
          emailAvailable.value = false;
        }
      }, 500);
    }
  }
);

const handleSubmit = () => {
  if (!form.value.agreedToTerms) {
    alert('Please agree to Terms of Service');
    return;
  }

  if (form.value.password !== form.value.passwordConfirmation) {
    alert('Passwords do not match');
    return;
  }

  emit('register', {
    ...form.value,
  });
};
</script>

<style scoped lang="css">
.step-register {
  max-width: 500px;
}

.step-register h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1a1a1a;
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

.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="password"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-group.checkbox {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 24px;
}

.form-group.checkbox input[type="checkbox"] {
  width: auto;
  margin-top: 3px;
}

.form-group.checkbox label {
  margin: 0;
  font-size: 13px;
  color: #666;
  cursor: pointer;
}

.form-group.checkbox a {
  color: #007bff;
  text-decoration: none;
}

.form-group.checkbox a:hover {
  text-decoration: underline;
}

.role-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 8px;
}

.role-option {
  padding: 16px;
  border: 2px solid #ddd;
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.role-option:hover {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

.role-option.selected {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.1);
}

.role-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.role-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.role-desc {
  font-size: 12px;
  color: #666;
  margin: 0;
}

.hint {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.hint.available {
  color: #28a745;
}

.hint.taken {
  color: #dc3545;
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

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-block {
  width: 100%;
}

.login-link {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #666;
}

.login-link a {
  color: #007bff;
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}
</style>
