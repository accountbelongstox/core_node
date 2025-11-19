<template>
  <div class="space-y-6">
    <!-- General Settings -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">
        <i class="fas fa-cog text-blue-600 mr-2"></i>
        General Settings
      </h2>

      <div class="space-y-6">
        <!-- Theme Settings -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-3">Appearance</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-gray-700">Dark Mode</label>
                <p class="text-sm text-gray-500">Use dark theme across the application</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.darkMode"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-gray-700">Compact View</label>
                <p class="text-sm text-gray-500">Use more compact layout</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.compactMode"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-gray-700">Show Tool Descriptions</label>
                <p class="text-sm text-gray-500">Display descriptions in tool cards</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.showToolDescriptions"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        <!-- Behavior Settings -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-3">Behavior</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-gray-700">Auto-execute Single Parameter Tools</label>
                <p class="text-sm text-gray-500">Automatically execute tools with single parameter</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.autoExecute"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-gray-700">Save Execution History</label>
                <p class="text-sm text-gray-500">Store tool execution history locally</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.saveHistory"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

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
              <p class="text-xs text-gray-500 mt-1">Keep history for specified number of days</p>
            </div>
          </div>
        </div>

        <!-- Connection Settings -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-3">Connections</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                MCP Server URL
              </label>
              <input
                v-model="settings.mcpServerUrl"
                type="url"
                placeholder="ws://localhost:3000/mcp"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">WebSocket connection to MCP server</p>
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
              <p class="text-xs text-gray-500 mt-1">Maximum time to wait for responses</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Frontend Port
              </label>
              <input
                v-model.number="settings.frontendPort"
                type="number"
                min="1000"
                max="65535"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">Development server port</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tool Preferences -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">
        <i class="fas fa-tools text-green-600 mr-2"></i>
        Tool Preferences
      </h2>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Default Tool Category
          </label>
          <select
            v-model="settings.defaultCategory"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Tools</option>
            <option value="crypto">Crypto & Security</option>
            <option value="converter">Converters</option>
            <option value="web">Web Dev</option>
            <option value="text">Text Processing</option>
            <option value="math">Math</option>
            <option value="network">Network</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Browser Automation
          </label>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-gray-700">Headless Mode</label>
                <p class="text-sm text-gray-500">Run browser without visible UI</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.browserHeadless"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Default Wait Time (ms)
              </label>
              <input
                v-model.number="settings.defaultWaitTime"
                type="number"
                min="0"
                max="10000"
                step="100"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Windows Operations
          </label>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <label class="font-medium text-gray-700">Elevated PowerShell by Default</label>
                <p class="text-sm text-gray-500">Run PowerShell commands as administrator</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.defaultElevated"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Python Environment Path
              </label>
              <input
                v-model="settings.pythonPath"
                type="text"
                placeholder="python"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Data Management -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">
        <i class="fas fa-database text-orange-600 mr-2"></i>
        Data Management
      </h2>

      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 class="font-medium text-gray-900">Clear History</h4>
            <p class="text-sm text-gray-600">Remove all tool execution history</p>
          </div>
          <button
            @click="clearHistory"
            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
          >
            <i class="fas fa-trash mr-2"></i>
            Clear History
          </button>
        </div>

        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 class="font-medium text-gray-900">Reset Settings</h4>
            <p class="text-sm text-gray-600">Restore all settings to defaults</p>
          </div>
          <button
            @click="resetSettings"
            class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
          >
            <i class="fas fa-undo mr-2"></i>
            Reset to Defaults
          </button>
        </div>

        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 class="font-medium text-gray-900">Export Settings</h4>
            <p class="text-sm text-gray-600">Download settings as JSON file</p>
          </div>
          <button
            @click="exportSettings"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            <i class="fas fa-download mr-2"></i>
            Export
          </button>
        </div>

        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 class="font-medium text-gray-900">Import Settings</h4>
            <p class="text-sm text-gray-600">Load settings from JSON file</p>
          </div>
          <label class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition cursor-pointer">
            <i class="fas fa-upload mr-2"></i>
            Import
            <input
              type="file"
              accept=".json"
              @change="importSettings"
              class="hidden"
            />
          </label>
        </div>
      </div>
    </div>

    <!-- About -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">
        <i class="fas fa-info-circle text-indigo-600 mr-2"></i>
        About
      </h2>

      <div class="space-y-4">
        <div class="flex items-center space-x-4">
          <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <i class="fas fa-rocket text-white text-2xl"></i>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900">Developer Hub</h3>
            <p class="text-sm text-gray-600">IT Tools & Automation Platform</p>
            <p class="text-xs text-gray-500">Version 1.0.0</p>
          </div>
        </div>

        <div class="border-t pt-4">
          <h4 class="font-medium text-gray-900 mb-2">Features</h4>
          <ul class="text-sm text-gray-600 space-y-1">
            <li><i class="fas fa-check text-green-500 mr-2"></i>88+ Developer Utilities</li>
            <li><i class="fas fa-check text-green-500 mr-2"></i>Browser Automation</li>
            <li><i class="fas fa-check text-green-500 mr-2"></i>Windows Operations</li>
            <li><i class="fas fa-check text-green-500 mr-2"></i>Python Integration</li>
            <li><i class="fas fa-check text-green-500 mr-2"></i>MCP Server Integration</li>
          </ul>
        </div>

        <div class="border-t pt-4">
          <p class="text-xs text-gray-500 text-center">
            Built with Vue.js 3, Nuxt.js, and Tailwind CSS<br>
            Powered by Node.js MCP Server
          </p>
        </div>
      </div>
    </div>

    <!-- Success Message -->
    <div v-if="showSuccessMessage" class="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
      <i class="fas fa-check-circle"></i>
      <span>{{ successMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

interface Settings {
  // Appearance
  darkMode: boolean;
  compactMode: boolean;
  showToolDescriptions: boolean;

  // Behavior
  autoExecute: boolean;
  saveHistory: boolean;
  historyLimit: number;

  // Connections
  mcpServerUrl: string;
  requestTimeout: number;
  frontendPort: number;

  // Tool Preferences
  defaultCategory: string;
  browserHeadless: boolean;
  defaultWaitTime: number;
  defaultElevated: boolean;
  pythonPath: string;
}

const defaultSettings: Settings = {
  darkMode: false,
  compactMode: false,
  showToolDescriptions: true,
  autoExecute: false,
  saveHistory: true,
  historyLimit: 30,
  mcpServerUrl: 'ws://localhost:3000/mcp',
  requestTimeout: 30,
  frontendPort: 7096,
  defaultCategory: 'all',
  browserHeadless: true,
  defaultWaitTime: 1000,
  defaultElevated: false,
  pythonPath: 'python'
};

const settings = ref<Settings>({ ...defaultSettings });
const showSuccessMessage = ref(false);
const successMessage = ref('');

onMounted(() => {
  loadSettings();
});

// Watch for changes and auto-save
watch(
  settings,
  () => {
    saveSettings();
  },
  { deep: true }
);

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('developer-hub-settings');
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
    localStorage.setItem('developer-hub-settings', JSON.stringify(settings.value));
    showSuccessToast('Settings saved successfully');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

const clearHistory = () => {
  if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
    try {
      localStorage.removeItem('ittools-history');
      showSuccessToast('History cleared successfully');
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Failed to clear history');
    }
  }
};

const resetSettings = () => {
  if (confirm('Are you sure you want to reset all settings to their defaults?')) {
    settings.value = { ...defaultSettings };
    localStorage.removeItem('developer-hub-settings');
    showSuccessToast('Settings reset to defaults');
  }
};

const exportSettings = () => {
  try {
    const dataStr = JSON.stringify(settings.value, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'developer-hub-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    showSuccessToast('Settings exported successfully');
  } catch (error) {
    console.error('Failed to export settings:', error);
    alert('Failed to export settings');
  }
};

const importSettings = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target?.result as string);
      settings.value = { ...defaultSettings, ...imported };
      showSuccessToast('Settings imported successfully');
    } catch (error) {
      console.error('Failed to import settings:', error);
      alert('Failed to import settings. Please check the file format.');
    }
  };
  reader.readAsText(file);
};

const showSuccessToast = (message: string) => {
  successMessage.value = message;
  showSuccessMessage.value = true;
  setTimeout(() => {
    showSuccessMessage.value = false;
  }, 3000);
};
</script>