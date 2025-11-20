<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Install Python Package</h2>
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
              Package Name
            </label>
            <input
              v-model="formData.packageName"
              type="text"
              placeholder="requests, numpy, pandas"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :class="{ 'border-red-500': errors.packageName }"
            />
            <p v-if="errors.packageName" class="text-red-500 text-sm mt-1">{{ errors.packageName }}</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Version (optional)
            </label>
            <input
              v-model="formData.version"
              type="text"
              placeholder="==1.2.3, >=1.0.0, latest"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">e.g. ==1.2.3, >=1.0.0, or leave blank for latest</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Environment
            </label>
            <select
              v-model="formData.environment"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="global">Global Python</option>
              <option value="venv">Current Virtual Environment</option>
              <option value="custom">Custom Environment</option>
            </select>
          </div>

          <div v-if="formData.environment === 'custom'" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Custom Python Path
            </label>
            <input
              v-model="formData.pythonPath"
              type="text"
              placeholder="C:\Python39\python.exe"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Installation Options
            </label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input
                  v-model="formData.upgrade"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Upgrade if already installed</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="formData.forceReinstall"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Force reinstall</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="formData.user"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">User installation</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="formData.verbose"
                  type="checkbox"
                  class="mr-2"
                />
                <span class="text-gray-700">Verbose output</span>
              </label>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Index URL (optional)
            </label>
            <input
              v-model="formData.indexUrl"
              type="url"
              placeholder="https://pypi.org/simple/"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">Custom package index URL</p>
          </div>

          <!-- Popular Packages -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Popular Packages:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                v-for="pkg in popularPackages"
                :key="pkg.name"
                @click="formData.packageName = pkg.name"
                class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition"
              >
                {{ pkg.name }}
              </button>
            </div>
          </div>

          <!-- Web Development Packages -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Web Development:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                v-for="pkg in webPackages"
                :key="pkg.name"
                @click="formData.packageName = pkg.name"
                class="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-full text-sm text-blue-700 transition"
              >
                {{ pkg.name }}
              </button>
            </div>
          </div>

          <!-- Data Science Packages -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Data Science:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                v-for="pkg in dataSciencePackages"
                :key="pkg.name"
                @click="formData.packageName = pkg.name"
                class="px-3 py-1 bg-green-100 hover:bg-green-200 rounded-full text-sm text-green-700 transition"
              >
                {{ pkg.name }}
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
          <i v-else class="fas fa-download mr-2"></i>
          {{ isSubmitting ? 'Installing...' : 'Install Package' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const emit = defineEmits<{
  close: [];
  install: (data: { packageName: string; environment: string; options: any }) => void;
}>();

const isSubmitting = ref(false);
const errors = reactive({
  packageName: ''
});

const formData = reactive({
  packageName: '',
  version: '',
  environment: 'global',
  pythonPath: '',
  upgrade: false,
  forceReinstall: false,
  user: false,
  verbose: false,
  indexUrl: ''
});

const popularPackages = [
  { name: 'requests' },
  { name: 'numpy' },
  { name: 'pandas' },
  { name: 'matplotlib' },
  { name: 'pillow' },
  { name: 'beautifulsoup4' },
  { name: 'lxml' },
  { name: 'scipy' }
];

const webPackages = [
  { name: 'flask' },
  { name: 'django' },
  { name: 'fastapi' },
  { name: 'uvicorn' },
  { name: 'selenium' },
  { name: 'playwright' },
  { name: 'aiohttp' },
  { name: 'jinja2' }
];

const dataSciencePackages = [
  { name: 'tensorflow' },
  { name: 'pytorch' },
  { name: 'scikit-learn' },
  { name: 'jupyter' },
  { name: 'plotly' },
  { name: 'seaborn' },
  { name: 'statsmodels' },
  { name: 'nltk' }
];

const validateForm = () => {
  errors.packageName = '';

  let isValid = true;

  // Validate package name
  if (!formData.packageName.trim()) {
    errors.packageName = 'Package name is required';
    isValid = false;
  } else {
    // Basic validation for package name format
    const packageNamePattern = /^[a-zA-Z0-9_.-]+$/;
    if (!packageNamePattern.test(formData.packageName)) {
      errors.packageName = 'Invalid package name format';
      isValid = false;
    }
  }

  return isValid;
};

const handleSubmit = () => {
  if (!validateForm()) return;

  isSubmitting.value = true;

  const packageSpec = formData.version ?
    `${formData.packageName}${formData.version}` :
    formData.packageName;

  const options = {
    version: formData.version,
    pythonPath: formData.environment === 'custom' ? formData.pythonPath : undefined,
    upgrade: formData.upgrade,
    forceReinstall: formData.forceReinstall,
    user: formData.user,
    verbose: formData.verbose,
    indexUrl: formData.indexUrl || undefined
  };

  const data = {
    packageName: packageSpec,
    environment: formData.environment,
    options
  };

  // Emit with a small delay to show loading state
  setTimeout(() => {
    emit('install', data);
    isSubmitting.value = false;
    emit('close');
  }, 500);
};
</script>