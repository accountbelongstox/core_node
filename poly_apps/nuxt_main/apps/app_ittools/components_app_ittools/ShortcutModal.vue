<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Create Shortcut</h2>
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
              Target Path
            </label>
            <div class="flex">
              <input
                v-model="formData.targetPath"
                type="text"
                placeholder="C:\Program Files\app.exe"
                required
                class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                :class="{ 'border-red-500': errors.targetPath }"
              />
              <button
                type="button"
                @click="browseTargetPath"
                class="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 transition"
              >
                <i class="fas fa-folder-open"></i>
              </button>
            </div>
            <p v-if="errors.targetPath" class="text-red-500 text-sm mt-1">{{ errors.targetPath }}</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Shortcut Location
            </label>
            <select
              v-model="formData.locationType"
              @change="handleLocationChange"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desktop">Desktop</option>
              <option value="startmenu">Start Menu</option>
              <option value="custom">Custom Location</option>
            </select>
          </div>

          <div v-if="formData.locationType === 'custom'" class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Custom Path
            </label>
            <div class="flex">
              <input
                v-model="formData.customPath"
                type="text"
                placeholder="C:\Shortcuts"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                @click="browseCustomPath"
                class="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 transition"
              >
                <i class="fas fa-folder-open"></i>
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Shortcut Name
            </label>
            <input
              v-model="formData.name"
              type="text"
              placeholder="My Application"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">Leave blank to use target filename</p>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Arguments (optional)
            </label>
            <input
              v-model="formData.arguments"
              type="text"
              placeholder="--arg1 value1 --arg2 value2"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <input
              v-model="formData.description"
              type="text"
              placeholder="Application description"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Working Directory (optional)
            </label>
            <div class="flex">
              <input
                v-model="formData.workingDirectory"
                type="text"
                placeholder="C:\Program Files\App"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                @click="browseWorkingDirectory"
                class="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 transition"
              >
                <i class="fas fa-folder-open"></i>
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Icon (optional)
            </label>
            <div class="flex">
              <input
                v-model="formData.iconLocation"
                type="text"
                placeholder="C:\Program Files\App\icon.ico"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                @click="browseIconLocation"
                class="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200 transition"
              >
                <i class="fas fa-image"></i>
              </button>
            </div>
          </div>

          <!-- Common Applications -->
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-700 mb-2">Common Applications:</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                v-for="app in commonApps"
                :key="app.name"
                @click="setCommonApp(app)"
                class="text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm transition"
              >
                <div class="font-medium">{{ app.name }}</div>
                <div class="text-xs text-gray-600">{{ app.path }}</div>
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
          <i v-else class="fas fa-link mr-2"></i>
          {{ isSubmitting ? 'Creating...' : 'Create Shortcut' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';

const emit = defineEmits<{
  close: [];
  create: (data: { targetPath: string; shortcutPath: string; options: any }) => void;
}>();

const isSubmitting = ref(false);
const errors = reactive({
  targetPath: ''
});

const formData = reactive({
  targetPath: '',
  locationType: 'desktop',
  customPath: '',
  name: '',
  arguments: '',
  description: '',
  workingDirectory: '',
  iconLocation: ''
});

const commonApps = [
  { name: 'Notepad', path: 'C:\\Windows\\System32\\notepad.exe' },
  { name: 'Calculator', path: 'C:\\Windows\\System32\\calc.exe' },
  { name: 'Command Prompt', path: 'C:\\Windows\\System32\\cmd.exe' },
  { name: 'PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' },
  { name: 'Task Manager', path: 'C:\\Windows\\System32\\taskmgr.exe' },
  { name: 'Registry Editor', path: 'C:\\Windows\\System32\\regedit.exe' }
];

const shortcutPath = computed(() => {
  const fileName = formData.name || getFileNameFromPath(formData.targetPath);
  const baseName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

  switch (formData.locationType) {
    case 'desktop':
      return `${require('os').homedir()}\\Desktop\\${baseName}.lnk`;
    case 'startmenu':
      return `${require('os').homedir()}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\${baseName}.lnk`;
    case 'custom':
      return formData.customPath ? `${formData.customPath}\\${baseName}.lnk` : '';
    default:
      return '';
  }
});

const getFileNameFromPath = (path: string) => {
  if (!path) return '';
  return path.split(/[\\\/]/).pop() || '';
};

const handleLocationChange = () => {
  if (formData.locationType !== 'custom') {
    formData.customPath = '';
  }
};

const setCommonApp = (app: { name: string; path: string }) => {
  formData.targetPath = app.path;
  formData.name = app.name;
  formData.description = `Shortcut to ${app.name}`;
  formData.workingDirectory = app.path.substring(0, app.path.lastIndexOf('\\'));
};

const browseTargetPath = () => {
  // In a real implementation, this would open a file dialog
  // For now, we'll set a placeholder
  alert('File browser would open here. Please enter the path manually.');
};

const browseCustomPath = () => {
  // In a real implementation, this would open a folder dialog
  alert('Folder browser would open here. Please enter the path manually.');
};

const browseWorkingDirectory = () => {
  // In a real implementation, this would open a folder dialog
  alert('Folder browser would open here. Please enter the path manually.');
};

const browseIconLocation = () => {
  // In a real implementation, this would open a file dialog
  alert('File browser would open here. Please enter the path manually.');
};

const validateForm = () => {
  errors.targetPath = '';

  let isValid = true;

  // Validate target path
  if (!formData.targetPath.trim()) {
    errors.targetPath = 'Target path is required';
    isValid = false;
  }

  return isValid;
};

const handleSubmit = () => {
  if (!validateForm()) return;

  isSubmitting.value = true;

  const options = {
    arguments: formData.arguments || undefined,
    description: formData.description || undefined,
    workingDirectory: formData.workingDirectory || undefined,
    iconLocation: formData.iconLocation || undefined
  };

  const data = {
    targetPath: formData.targetPath,
    shortcutPath: shortcutPath.value,
    options
  };

  // Emit with a small delay to show loading state
  setTimeout(() => {
    emit('create', data);
    isSubmitting.value = false;
    emit('close');
  }, 500);
};
</script>