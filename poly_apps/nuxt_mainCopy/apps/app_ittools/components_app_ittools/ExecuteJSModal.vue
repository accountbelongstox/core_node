<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b flex-shrink-0">
        <h2 class="text-xl font-semibold text-gray-900">Execute JavaScript</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 flex-grow overflow-y-auto">
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
              JavaScript Code
            </label>
            <textarea
              v-model="formData.script"
              placeholder="// Enter JavaScript code to execute
document.title = 'Hello World';
console.log('Page title changed');
return document.title;"
              required
              rows="8"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              :class="{ 'border-red-500': errors.script }"
            ></textarea>
            <p v-if="errors.script" class="text-red-500 text-sm mt-1">{{ errors.script }}</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Execution Context
            </label>
            <select
              v-model="formData.context"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="page">Page Context</option>
              <option value="content_script">Content Script</option>
              <option value="background">Background Script</option>
            </select>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Wait For Result (seconds)
            </label>
            <input
              v-model.number="formData.timeout"
              type="number"
              min="1"
              max="60"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-6">
            <label class="flex items-center">
              <input
                v-model="formData.returnResult"
                type="checkbox"
                class="mr-2"
              />
              <span class="text-gray-700">Return Result</span>
            </label>
            <p class="text-xs text-gray-500 mt-1">Capture and return the result of the script execution</p>
          </div>

          <!-- Script Templates -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Script Templates:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                v-for="template in scriptTemplates"
                :key="template.name"
                @click="formData.script = template.script"
                class="text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition"
              >
                <div class="font-medium">{{ template.name }}</div>
                <div class="text-xs text-gray-600">{{ template.description }}</div>
              </button>
            </div>
          </div>

          <!-- Common DOM Queries -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Common DOM Queries:</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                v-for="query in commonQueries"
                :key="query.name"
                @click="formData.script = query.script"
                class="text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded text-sm transition"
              >
                <div class="font-medium">{{ query.name }}</div>
                <code class="text-xs bg-white px-1 rounded">{{ query.description }}</code>
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end p-6 border-t bg-gray-50 space-x-3 flex-shrink-0">
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
          <i v-else class="fas fa-code mr-2"></i>
          {{ isSubmitting ? 'Executing...' : 'Execute Script' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const emit = defineEmits<{
  close: [];
  execute: (data: { url: string; script: string; context: string; timeout: number; returnResult: boolean }) => void;
}>();

const isSubmitting = ref(false);
const errors = reactive({
  url: '',
  script: ''
});

const formData = reactive({
  url: '',
  script: '',
  context: 'page',
  timeout: 10,
  returnResult: true
});

const scriptTemplates = [
  {
    name: 'Page Information',
    description: 'Get basic page information',
    script: `return {
  title: document.title,
  url: window.location.href,
  userAgent: navigator.userAgent,
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight
  }
};`
  },
  {
    name: 'All Links',
    description: 'Extract all links from the page',
    script: `const links = Array.from(document.querySelectorAll('a'));
return links.map(link => ({
  text: link.textContent.trim(),
  href: link.href,
  target: link.target
}));`
  },
  {
    name: 'All Images',
    description: 'Extract all images from the page',
    script: `const images = Array.from(document.querySelectorAll('img'));
return images.map(img => ({
  src: img.src,
  alt: img.alt,
  width: img.width,
  height: img.height
}));`
  },
  {
    name: 'Form Data',
    description: 'Get all form inputs and their values',
    script: `const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
return inputs.map(input => ({
  name: input.name,
  type: input.type,
  value: input.value,
  id: input.id
}));`
  },
  {
    name: 'Scroll to Bottom',
    description: 'Smooth scroll to bottom of page',
    script: `window.scrollTo({
  top: document.body.scrollHeight,
  behavior: 'smooth'
});
return 'Scrolled to bottom';`
  },
  {
    name: 'Highlight Elements',
    description: 'Highlight all clickable elements',
    script: `const elements = document.querySelectorAll('button, a, input[type="submit"], input[type="button"]');
elements.forEach(el => {
  el.style.border = '2px solid red';
  el.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
});
return \`Highlighted \${elements.length} elements\`;`
  }
];

const commonQueries = [
  {
    name: 'Get Page Title',
    description: 'document.title',
    script: 'return document.title;'
  },
  {
    name: 'Get Page HTML',
    description: 'document.documentElement.outerHTML',
    script: 'return document.documentElement.outerHTML;'
  },
  {
    name: 'Get All Text',
    description: 'document.body.innerText',
    script: 'return document.body.innerText;'
  },
  {
    name: 'Count Elements',
    description: 'document.querySelectorAll("*").length',
    script: 'return document.querySelectorAll("*").length;'
  },
  {
    name: 'Get Current URL',
    description: 'window.location.href',
    script: 'return window.location.href;'
  },
  {
    name: 'Get Cookies',
    description: 'document.cookie',
    script: 'return document.cookie;'
  },
  {
    name: 'Get Local Storage',
    description: 'Object.keys(localStorage)',
    script: 'return Object.keys(localStorage);'
  },
  {
    name: 'Get Session Storage',
    description: 'Object.keys(sessionStorage)',
    script: 'return Object.keys(sessionStorage);'
  }
];

const validateForm = () => {
  errors.url = '';
  errors.script = '';

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

  // Validate script
  if (!formData.script.trim()) {
    errors.script = 'JavaScript code is required';
    isValid = false;
  }

  return isValid;
};

const handleSubmit = () => {
  if (!validateForm()) return;

  isSubmitting.value = true;

  const data = {
    url: formData.url,
    script: formData.script,
    context: formData.context,
    timeout: formData.timeout,
    returnResult: formData.returnResult
  };

  // Emit with a small delay to show loading state
  setTimeout(() => {
    emit('execute', data);
    isSubmitting.value = false;
    emit('close');
  }, 500);
};
</script>