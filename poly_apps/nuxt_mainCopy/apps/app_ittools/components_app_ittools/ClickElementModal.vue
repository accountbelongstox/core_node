<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Click Element</h2>
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
              CSS Selector
            </label>
            <input
              v-model="formData.selector"
              type="text"
              placeholder="#button, .submit-btn, [data-click]"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :class="{ 'border-red-500': errors.selector }"
            />
            <p v-if="errors.selector" class="text-red-500 text-sm mt-1">{{ errors.selector }}</p>
            <p class="text-xs text-gray-500 mt-1">CSS selector for the element to click</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Click Type
            </label>
            <select
              v-model="formData.clickType"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="click">Normal Click</option>
              <option value="doubleclick">Double Click</option>
              <option value="rightclick">Right Click</option>
            </select>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Wait Before Click (seconds)
            </label>
            <input
              v-model.number="formData.waitBefore"
              type="number"
              min="0"
              max="30"
              step="0.5"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Wait After Click (seconds)
            </label>
            <input
              v-model.number="formData.waitAfter"
              type="number"
              min="0"
              max="30"
              step="0.5"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-6">
            <label class="flex items-center">
              <input
                v-model="formData.waitForNavigation"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-gray-700">Wait for Navigation</span>
            </label>
            <p class="text-xs text-gray-500 mt-1">Wait for page navigation after click</p>
          </div>

          <!-- Common Selectors -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Common Selectors:</p>
            <div class="space-y-2">
              <button
                type="button"
                v-for="commonSelector in commonSelectors"
                :key="commonSelector.name"
                @click="formData.selector = commonSelector.selector"
                class="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition flex justify-between items-center"
              >
                <span>{{ commonSelector.name }}</span>
                <code class="text-xs bg-gray-200 px-2 py-1 rounded">{{ commonSelector.selector }}</code>
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
          <i v-else class="fas fa-mouse-pointer mr-2"></i>
          {{ isSubmitting ? 'Clicking...' : 'Click Element' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const emit = defineEmits<{
  close: [];
  click: (data: { url: string; selector: string; clickType: string; waitBefore: number; waitAfter: number; waitForNavigation: boolean }) => void;
}>();

const isSubmitting = ref(false);
const errors = reactive({
  url: '',
  selector: ''
});

const formData = reactive({
  url: '',
  selector: '',
  clickType: 'click',
  waitBefore: 2,
  waitAfter: 2,
  waitForNavigation: true
});

const commonSelectors = [
  { name: 'Submit Button', selector: 'button[type="submit"], input[type="submit"]' },
  { name: 'Login Button', selector: 'button:contains("Login"), .login-btn, #login' },
  { name: 'Search Button', selector: 'button[type="search"], .search-btn, #search' },
  { name: 'Menu Toggle', selector: '.menu-toggle, .hamburger, #menu-toggle' },
  { name: 'Close Button', selector: '.close, .modal-close, [aria-label="close"]' },
  { name: 'Next Button', selector: '.next, .btn-next, #next' },
  { name: 'Previous Button', selector: '.prev, .btn-prev, #previous' },
  { name: 'Download Link', selector: 'a[href*="download"], .download, .btn-download' }
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

  // Validate selector
  if (!formData.selector.trim()) {
    errors.selector = 'CSS selector is required';
    isValid = false;
  }

  return isValid;
};

const handleSubmit = () => {
  if (!validateForm()) return;

  isSubmitting.value = true;

  const data = {
    url: formData.url,
    selector: formData.selector,
    clickType: formData.clickType,
    waitBefore: formData.waitBefore,
    waitAfter: formData.waitAfter,
    waitForNavigation: formData.waitForNavigation
  };

  // Emit with a small delay to show loading state
  setTimeout(() => {
    emit('click', data);
    isSubmitting.value = false;
    emit('close');
  }, 500);
};
</script>