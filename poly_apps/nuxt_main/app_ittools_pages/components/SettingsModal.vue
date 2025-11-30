<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Settings</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-6">
        <!-- Theme Settings -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-3">Appearance</h3>
          <div class="space-y-3">
            <label class="flex items-center">
              <input
                v-model="settings.darkMode"
                type="checkbox"
                class="mr-3"
              />
              <span class="text-gray-700">Dark Mode</span>
            </label>

            <label class="flex items-center">
              <input
                v-model="settings.compactMode"
                type="checkbox"
                class="mr-3"
              />
              <span class="text-gray-700">Compact View</span>
            </label>
          </div>
        </div>

        <!-- Behavior Settings -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-3">Behavior</h3>
          <div class="space-y-3">
            <label class="flex items-center">
              <input
                v-model="settings.autoExecute"
                type="checkbox"
                class="mr-3"
              />
              <span class="text-gray-700">Auto-execute single parameter tools</span>
            </label>

            <label class="flex items-center">
              <input
                v-model="settings.saveHistory"
                type="checkbox"
                class="mr-3"
              />
              <span class="text-gray-700">Save execution history</span>
            </label>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                History Limit (days)
              </label>
              <input
                v-model.number="settings.historyLimit"
                type="number"
                min="1"
                max="365"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- API Settings -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-3">API</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                API Base URL
              </label>
              <input
                v-model="settings.apiBaseUrl"
                type="url"
                placeholder="http://localhost:3000/api"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Request Timeout (seconds)
              </label>
              <input
                v-model.number="settings.requestTimeout"
                type="number"
                min="5"
                max="300"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Data Management -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-3">Data Management</h3>
          <div class="space-y-3">
            <button
              @click="clearHistory"
              class="w-full px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
            >
              <i class="fas fa-trash mr-2"></i>
              Clear History
            </button>

            <button
              @click="resetSettings"
              class="w-full px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition"
            >
              <i class="fas fa-undo mr-2"></i>
              Reset to Defaults
            </button>
          </div>
        </div>
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
          @click="saveSettings"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Save Settings
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Settings {
  darkMode: boolean;
  compactMode: boolean;
  autoExecute: boolean;
  saveHistory: boolean;
  historyLimit: number;
  apiBaseUrl: string;
  requestTimeout: number;
}

const emit = defineEmits<{
  close: [];
}>();

const defaultSettings: Settings = {
  darkMode: false,
  compactMode: false,
  autoExecute: false,
  saveHistory: true,
  historyLimit: 30,
  apiBaseUrl: 'http://localhost:3000/api',
  requestTimeout: 30
};

const settings = ref<Settings>({ ...defaultSettings });

onMounted(() => {
  loadSettings();
});

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('ittools-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      settings.value = { ...defaultSettings, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
};

const saveSettings = () => {
  try {
    localStorage.setItem('ittools-settings', JSON.stringify(settings.value));
    emit('close');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

const clearHistory = () => {
  if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
    try {
      localStorage.removeItem('ittools-history');
      alert('History cleared successfully');
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Failed to clear history');
    }
  }
};

const resetSettings = () => {
  if (confirm('Are you sure you want to reset all settings to their defaults?')) {
    settings.value = { ...defaultSettings };
    localStorage.removeItem('ittools-settings');
    alert('Settings reset to defaults');
  }
};
</script>