<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Open Web Page</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6">
        <form @submit.prevent="handleSubmit">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              URL
            </label>
            <input
              v-model="formData.url"
              type="url"
              placeholder="https://example.com"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :class="{ 'border-red-500': errors.url }"
            />
            <p v-if="errors.url" class="text-red-500 text-sm mt-1">{{ errors.url }}</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Wait For
            </label>
            <select
              v-model="formData.waitFor"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="load">Page Load</option>
              <option value="domcontentloaded">DOM Content Loaded</option>
              <option value="networkidle0">Network Idle (0 connections)</option>
              <option value="networkidle2">Network Idle (2 connections)</option>
              <option value="body">Body Element</option>
              <option value="selector">Custom Selector</option>
            </select>
          </div>

          <div v-if="formData.waitFor === 'selector'" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              CSS Selector
            </label>
            <input
              v-model="formData.selector"
              type="text"
              placeholder="#content, .main, etc."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :class="{ 'border-red-500': errors.selector }"
            />
            <p v-if="errors.selector" class="text-red-500 text-sm mt-1">{{ errors.selector }}</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Timeout (seconds)
            </label>
            <input
              v-model.number="formData.timeout"
              type="number"
              min="1"
              max="120"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              User Agent (optional)
            </label>
            <select
              v-model="formData.userAgent"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Default</option>
              <option value="chrome">Chrome Desktop</option>
              <option value="firefox">Firefox Desktop</option>
              <option value="safari">Safari Desktop</option>
              <option value="chrome-mobile">Chrome Mobile</option>
              <option value="safari-mobile">Safari Mobile</option>
            </select>
          </div>

          <div class="mb-6">
            <label class="flex items-center">
              <input
                v-model="formData.headless"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-gray-700">Headless Mode</span>
            </label>
            <p class="text-xs text-gray-500 mt-1">Run browser without visible UI</p>
          </div>

          <!-- Common URLs -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Quick URLs:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                v-for="quickUrl in quickUrls"
                :key="quickUrl.name"
                @click="formData.url = quickUrl.url"
                class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition"
              >
                {{ quickUrl.name }}
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end p-6 border-t bg-gray-50 space-x-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="isSubmitting"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          <i v-if="isSubmitting" class="fas fa-spinner fa-spin mr-2"></i>
          <i v-else class="fas fa-external-link-alt mr-2"></i>
          {{ isSubmitting ? 'Opening...' : 'Open Page' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const emit = defineEmits<{
  close: [];
  open: (data: { url: string; waitFor: string; selector?: string; timeout: number; userAgent?: string; headless: boolean }) => void;
}>();

const isSubmitting = ref(false);
const errors = reactive({
  url: '',
  selector: ''
});

const formData = reactive({
  url: '',
  waitFor: 'body',
  selector: '',
  timeout: 30,
  userAgent: '',
  headless: true
});

const quickUrls = [
  { name: 'Google', url: 'https://www.google.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { name: 'MDN', url: 'https://developer.mozilla.org' },
  { name: 'W3Schools', url: 'https://www.w3schools.com' },
  { name: 'CodePen', url: 'https://codepen.io' }
];

const validateForm = () => {
  errors.url = '';
  errors.selector = '';

  let isValid = true;

  // Validate URL
  if (!formData.url.trim()) {
    errors.url = 'URL is required';
    isValid = false;
  } else {
    try {
      new URL(formData.url);
    } catch {
      errors.url = 'Please enter a valid URL';
      isValid = false;
    }
  }

  // Validate selector if required
  if (formData.waitFor === 'selector' && !formData.selector.trim()) {
    errors.selector = 'CSS selector is required when "Custom Selector" is selected';
    isValid = false;
  }

  return isValid;
};

const handleSubmit = () => {
  if (!validateForm()) return;

  isSubmitting.value = true;

  const data = {
    url: formData.url,
    waitFor: formData.waitFor,
    selector: formData.waitFor === 'selector' ? formData.selector : undefined,
    timeout: formData.timeout,
    userAgent: formData.userAgent || undefined,
    headless: formData.headless
  };

  // Emit with a small delay to show loading state
  setTimeout(() => {
    emit('open', data);
    isSubmitting.value = false;
    emit('close');
  }, 500);
};
</script>