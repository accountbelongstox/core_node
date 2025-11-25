<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-2xl font-bold text-gray-900">Login</h2>
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
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Enter your username"
          />
        </div>

        <!-- Password Field -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            v-model="formData.password"
            type="password"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Enter your password"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="!isLoading">Login</span>
          <span v-else class="flex items-center justify-center">
            <i class="fas fa-spinner fa-spin mr-2"></i>
            Logging in...
          </span>
        </button>

        <!-- Register Link -->
        <div class="text-center text-sm text-gray-600">
          Don't have an account?
          <button
            type="button"
            @click="switchToRegister"
            class="text-blue-600 hover:text-blue-700 font-medium"
          >
            Register here
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '@/app_ittools_pages/stores/auth-store';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'switch-to-register'): void;
}>();

const authStore = useAuthStore();
const isLoading = ref(false);
const errorMessage = ref('');

const formData = ref({
  username: '',
  password: ''
});

function close() {
  emit('update:show', false);
  resetForm();
}

function resetForm() {
  formData.value = {
    username: '',
    password: ''
  };
  errorMessage.value = '';
}

async function handleSubmit() {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const success = await authStore.login(formData.value);

    if (success) {
      close();
    } else {
      errorMessage.value = authStore.error || 'Login failed. Please check your credentials.';
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'An unexpected error occurred';
  } finally {
    isLoading.value = false;
  }
}

function switchToRegister() {
  emit('switch-to-register');
  close();
}

// Reset form when modal closes
watch(() => props.show, (newValue) => {
  if (!newValue) {
    resetForm();
  }
});
</script>
