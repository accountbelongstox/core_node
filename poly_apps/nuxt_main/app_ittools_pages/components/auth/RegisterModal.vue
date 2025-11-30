<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-2xl font-bold text-gray-900">Create Account</h2>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- Error Message -->
        <div
          v-if="errorMessage"
          class="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start"
        >
          <i class="fas fa-exclamation-circle text-red-500 mt-0.5 mr-2"></i>
          <span class="text-sm text-red-800">{{ errorMessage }}</span>
        </div>

        <!-- Username Field -->
        <div>
          <label for="reg-username" class="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="reg-username"
            v-model="formData.username"
            type="text"
            required
            minlength="3"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Choose a username (min 3 characters)"
          />
        </div>

        <!-- Email Field -->
        <div>
          <label for="reg-email" class="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="reg-email"
            v-model="formData.email"
            type="email"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Enter your email address"
          />
        </div>

        <!-- Password Field -->
        <div>
          <label for="reg-password" class="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="reg-password"
            v-model="formData.password"
            type="password"
            required
            minlength="6"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            :class="{ 'border-red-300': passwordMismatch }"
            placeholder="Enter password (min 6 characters)"
          />
        </div>

        <!-- Confirm Password Field -->
        <div>
          <label for="reg-confirm-password" class="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="reg-confirm-password"
            v-model="formData.confirmPassword"
            type="password"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            :class="{ 'border-red-300': passwordMismatch }"
            placeholder="Re-enter your password"
          />
          <p v-if="passwordMismatch" class="text-xs text-red-600 mt-1">
            Passwords do not match
          </p>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading || passwordMismatch"
          class="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="!isLoading">Create Account</span>
          <span v-else class="flex items-center justify-center">
            <i class="fas fa-spinner fa-spin mr-2"></i>
            Creating account...
          </span>
        </button>

        <!-- Login Link -->
        <div class="text-center text-sm text-gray-600">
          Already have an account?
          <button
            type="button"
            @click="switchToLogin"
            class="text-blue-600 hover:text-blue-700 font-medium"
          >
            Login here
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/app_ittools_pages/stores/auth-store';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'switch-to-login'): void;
}>();

const authStore = useAuthStore();
const isLoading = ref(false);
const errorMessage = ref('');

const formData = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
});

const passwordMismatch = computed(() => {
  return formData.value.password !== '' &&
         formData.value.confirmPassword !== '' &&
         formData.value.password !== formData.value.confirmPassword;
});

function close() {
  emit('update:show', false);
  resetForm();
}

function resetForm() {
  formData.value = {
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  };
  errorMessage.value = '';
}

async function handleSubmit() {
  if (passwordMismatch.value) {
    errorMessage.value = 'Passwords do not match';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const success = await authStore.register(formData.value);

    if (success) {
      close();
    } else {
      errorMessage.value = authStore.error || 'Registration failed. Please try again.';
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'An unexpected error occurred';
  } finally {
    isLoading.value = false;
  }
}

function switchToLogin() {
  emit('switch-to-login');
  close();
}

// Reset form when modal closes
watch(() => props.show, (newValue) => {
  if (!newValue) {
    resetForm();
  }
});
</script>
